'use strict';

const CACHE_VERSION = 'gb-v197-bible-legacy-authority-20260804';
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_CONTENT = `${CACHE_VERSION}-content`;
const CACHE_DATA = `${CACHE_VERSION}-data`;
const CACHE_IMAGES = `${CACHE_VERSION}-images`;
const CACHE_PAGEFIND = `${CACHE_VERSION}-pagefind`;
const CACHE_META = `${CACHE_VERSION}-meta`;
const EXPECTED_CACHES = new Set([
  CACHE_STATIC,
  CACHE_CONTENT,
  CACHE_DATA,
  CACHE_IMAGES,
  CACHE_PAGEFIND,
  CACHE_META,
]);
const OFFLINE_FALLBACK = '/404.html';
const PRECACHE_ASSETS = [
  '/css/site.css',
  '/css/home.css',
  '/css/command-palette.css',
  '/css/mobile-hotfix.css',
  '/css/nagornaya-mobile-toc.css',
  '/css/floating-cluster.css',
  '/css/series-samizdat.css',
  '/css/reader-preferences.css',
  '/css/enhancements-runtime.css',
  '/css/highlights-runtime.css',
  '/css/sw-toast.css',
  '/fonts/fonts.css',
  '/nagornaya/tw.min.css',
  '/js/nagornaya-bar-extras.js',
  '/js/site.js',
  '/js/site-utils.js',
  '/js/scroll-perf.js',
  '/js/bookmark-engine.js',
  '/js/enhancements.js',
  '/js/highlights.js',
  '/js/sw-register.js',
  '/js/nagornaya-mobile-toc.js',
  '/js/floating-cluster-controller.js',
  '/js/reader-preferences-head.js',
  '/js/reader-preferences.js',
  '/js/reader-state.js',
  '/pagefind/pagefind.js',
  '/favicon.ico',
  '/favicon-48.png',
  '/apple-touch-icon.png',
  OFFLINE_FALLBACK,
];

const IMAGE_CACHE_LIMIT = 60;
const CONTENT_CACHE_LIMIT = 30;
const DATA_CACHE_LIMIT = 60;
const PAGEFIND_CACHE_LIMIT = 50;

function isPagefindData(url) {
  return url.pathname.startsWith('/pagefind/fragment/') || url.pathname.startsWith('/pagefind/index/');
}

function isPagefindStatic(url) {
  return url.pathname.startsWith('/pagefind/') && !isPagefindData(url);
}

function isMutableData(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/data/') && /\.json$/i.test(url.pathname);
}

function isStaticAsset(url) {
  return /\.(css|js|woff2?|ttf|otf|ico|svg|webmanifest)(?:$|\?)/i.test(url.pathname) || url.pathname.startsWith('/icons/');
}

function isHtmlPage(request) {
  return request.mode === 'navigate' || (
    request.method === 'GET' &&
    request.headers.get('accept') &&
    request.headers.get('accept').includes('text/html')
  );
}

function isImage(url) {
  return /\.(?:jpg|jpeg|webp|avif|gif|png)$/i.test(url.pathname);
}

function isFont(url) {
  return (url.origin === self.location.origin && url.pathname.startsWith('/fonts/')) || url.hostname === 'fonts.gstatic.com';
}

function isRevisioned(url) {
  return url.origin === self.location.origin && url.searchParams.has('v');
}

function mustBypassCache(request, url) {
  if (request.headers.has('range')) return true;
  if (request.destination === 'audio' || request.destination === 'video') return true;
  return /^(?:\/audio\/|\/models?\/|\/tts(?:-model)?\/|\/vosk\/)/i.test(url.pathname) ||
    /\.(?:mp3|m4a|ogg|wav|flac|mp4|webm|zip|bin)$/i.test(url.pathname);
}

function cacheable(response) {
  return Boolean(response && response.status === 200 && response.type !== 'opaque');
}

function canonicalUrl(url) {
  return `${url.origin}${url.pathname}`;
}

function canonicalRuntimeRequest(request) {
  return new Request(canonicalUrl(new URL(request.url)), { method: 'GET' });
}

function metadataRequest(cacheName, requestUrl) {
  return new Request(`${self.location.origin}/__gb-cache-meta__/${encodeURIComponent(cacheName)}/${encodeURIComponent(requestUrl)}`);
}

async function touchCache(cacheName, requestUrl) {
  const meta = await caches.open(CACHE_META);
  await meta.put(metadataRequest(cacheName, requestUrl), new Response(String(Date.now()), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  }));
}

async function forgetCacheEntry(cacheName, requestUrl) {
  const meta = await caches.open(CACHE_META);
  await meta.delete(metadataRequest(cacheName, requestUrl));
}

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  if (requests.length <= limit) return;
  const meta = await caches.open(CACHE_META);
  const rows = await Promise.all(requests.map(async (request) => {
    const response = await meta.match(metadataRequest(cacheName, request.url));
    const timestamp = response ? Number(await response.text()) || 0 : 0;
    return { request, timestamp };
  }));
  rows.sort((left, right) => left.timestamp - right.timestamp || left.request.url.localeCompare(right.request.url));
  for (const row of rows.slice(0, rows.length - limit)) {
    await cache.delete(row.request);
    await forgetCacheEntry(cacheName, row.request.url);
  }
}

async function putRuntime(cacheName, request, response, limit) {
  if (!cacheable(response)) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  await touchCache(cacheName, request.url);
  if (limit) await trimCache(cacheName, limit);
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    if (limit) await touchCache(cacheName, request.url);
    return cached;
  }
  const response = await fetch(request);
  await putRuntime(cacheName, request, response, limit);
  return response;
}

async function pagefindStaticCacheFirst(request) {
  const runtimeCache = await caches.open(CACHE_PAGEFIND);
  const runtimeCached = await runtimeCache.match(request) || await runtimeCache.match(request, { ignoreSearch: true });
  if (runtimeCached) {
    await touchCache(CACHE_PAGEFIND, request.url);
    return runtimeCached;
  }

  const installCache = await caches.open(CACHE_STATIC);
  const installCached = await installCache.match(request) || await installCache.match(request, { ignoreSearch: true });
  if (installCached) return installCached;

  const response = await fetch(request);
  await putRuntime(CACHE_PAGEFIND, request, response, PAGEFIND_CACHE_LIMIT);
  return response;
}

async function revisionedStaticNetworkFirst(request) {
  const cache = await caches.open(CACHE_STATIC);
  try {
    const response = await fetch(request);
    if (cacheable(response)) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const exact = await cache.match(request);
    if (exact) return exact;
    const url = new URL(request.url);
    const canonical = await cache.match(canonicalUrl(url));
    if (canonical) return canonical;
    throw error;
  }
}

async function networkFirstWithCache(request, cacheName, limit, fallbackFactory) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    await putRuntime(cacheName, request, response, limit);
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      await touchCache(cacheName, request.url);
      return cached;
    }
    if (fallbackFactory) return fallbackFactory(error);
    throw error;
  }
}

async function networkFirstPagefindData(request) {
  const cache = await caches.open(CACHE_PAGEFIND);
  const canonicalRequest = canonicalRuntimeRequest(request);
  try {
    const response = await fetch(request);
    if (cacheable(response)) {
      await putRuntime(CACHE_PAGEFIND, request, response, PAGEFIND_CACHE_LIMIT);
      if (request.url !== canonicalRequest.url) {
        await putRuntime(CACHE_PAGEFIND, canonicalRequest, response, PAGEFIND_CACHE_LIMIT);
      }
    }
    return response;
  } catch (error) {
    const exact = await cache.match(request);
    if (exact) {
      await touchCache(CACHE_PAGEFIND, request.url);
      return exact;
    }
    const canonical = await cache.match(canonicalRequest);
    if (canonical) {
      await touchCache(CACHE_PAGEFIND, canonicalRequest.url);
      return canonical;
    }
    const searchInsensitive = await cache.match(request, { ignoreSearch: true });
    if (searchInsensitive) {
      await touchCache(CACHE_PAGEFIND, canonicalRequest.url);
      return searchInsensitive;
    }
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirstHtml(request) {
  const cache = await caches.open(CACHE_CONTENT);
  const url = new URL(request.url);
  const canonical = canonicalUrl(url);
  try {
    const response = await fetch(request);
    if (cacheable(response)) {
      await putRuntime(CACHE_CONTENT, request, response, CONTENT_CACHE_LIMIT);
      if (request.url !== canonical) {
        const canonicalRequest = new Request(canonical, { headers: { accept: 'text/html' } });
        await putRuntime(CACHE_CONTENT, canonicalRequest, response, CONTENT_CACHE_LIMIT);
      }
    }
    return response;
  } catch (error) {
    const exact = await cache.match(request);
    if (exact) {
      await touchCache(CACHE_CONTENT, request.url);
      return exact;
    }
    const canonicalResponse = await cache.match(canonical);
    if (canonicalResponse) {
      await touchCache(CACHE_CONTENT, canonical);
      return canonicalResponse;
    }
    const fallback = await caches.match(OFFLINE_FALLBACK);
    if (fallback) return fallback;
    throw error;
  }
}

async function notifyClients() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: 'GB_SW_ACTIVATED', cacheVersion: CACHE_VERSION });
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    try {
      await cache.addAll(PRECACHE_ASSETS);
    } catch (error) {
      await caches.delete(CACHE_STATIC);
      throw error;
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('gb-') && !EXPECTED_CACHES.has(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
    await notifyClients();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (_) { return; }
  if (mustBypassCache(request, url)) return;
  if (url.origin !== self.location.origin && !isFont(url)) return;

  if (isFont(url)) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
  } else if (isPagefindData(url)) {
    event.respondWith(networkFirstPagefindData(request));
  } else if (isPagefindStatic(url)) {
    event.respondWith(pagefindStaticCacheFirst(request));
  } else if (isMutableData(url)) {
    event.respondWith(networkFirstWithCache(
      request,
      CACHE_DATA,
      DATA_CACHE_LIMIT,
      () => new Response('', { status: 503, statusText: 'Service Unavailable' }),
    ));
  } else if (isStaticAsset(url)) {
    event.respondWith(isRevisioned(url)
      ? revisionedStaticNetworkFirst(request)
      : cacheFirst(request, CACHE_STATIC));
  } else if (isImage(url)) {
    event.respondWith(cacheFirst(request, CACHE_IMAGES, IMAGE_CACHE_LIMIT));
  } else if (isHtmlPage(request)) {
    event.respondWith(networkFirstHtml(request));
  }
});
