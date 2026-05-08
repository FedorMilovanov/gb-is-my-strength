/* ============================================================
   sw.js — Service Worker
   Господь Бог — Сила Моя · v1.0

   Стратегии:
   — CSS / JS / шрифты / иконки → Cache First
   — HTML-статьи → Stale While Revalidate
   — Images → Cache First (с ограничением)
   — Все остальные запросы → Network First
   ============================================================ */

var CACHE_VERSION = 'gb-v3';
var CACHE_STATIC  = CACHE_VERSION + '-static';
var CACHE_CONTENT = CACHE_VERSION + '-content';
var CACHE_IMAGES  = CACHE_VERSION + '-images';

/* Ресурсы для прекэша при установке */
var PRECACHE_ASSETS = [
  '/css/site.css',
  '/css/home.css',
  '/nagornaya/tw.min.css',
  '/js/site.js',
  '/js/search.js',
  '/js/highlights.js',
  '/js/bookmark-engine.js',
  '/js/enhancements.js',
  '/js/sw-register.js',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-48.png',
  '/apple-touch-icon.png',
  '/404.html'
];

/* ── Install: precache static assets ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_STATIC).then(function(cache) {
      return cache.addAll(PRECACHE_ASSETS).catch(function(err) {
        console.warn('[SW] Precache partial failure:', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── Activate: cleanup old caches ── */
self.addEventListener('activate', function(e) {
  var KNOWN = [CACHE_STATIC, CACHE_CONTENT, CACHE_IMAGES];
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k){ return KNOWN.indexOf(k) === -1; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── Helpers ── */
function isStaticAsset(url) {
  return /\.(css|js|woff2?|ttf|otf|ico|png|svg|webmanifest)(\?|$)/.test(url.pathname) ||
         url.pathname.startsWith('/pagefind/') ||
         url.pathname.startsWith('/icons/');
}

function isHtmlPage(req) {
  return req.mode === 'navigate' ||
         (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'));
}

function isImage(url) {
  return /\.(jpg|jpeg|webp|avif|gif|png)(\?|$)/.test(url.pathname);
}

function isFont(url) {
  return url.hostname === 'fonts.gstatic.com';
}

/* Cache First — good for static assets and fonts */
function cacheFirst(req, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(req).then(function(cached) {
      if (cached) return cached;
      return fetch(req).then(function(res) {
        if (res && res.status === 200 && res.type !== 'opaque') {
          cache.put(req, res.clone());
        }
        return res;
      });
    });
  });
}

/* Stale While Revalidate — good for HTML pages */
function staleWhileRevalidate(req) {
  return caches.open(CACHE_CONTENT).then(function(cache) {
    return cache.match(req).then(function(cached) {
      var fetchPromise = fetch(req).then(function(res) {
        if (res && res.status === 200) {
          cache.put(req, res.clone());
          /* Notify clients about update */
          self.clients.matchAll().then(function(clients) {
            clients.forEach(function(client) {
              client.postMessage({ type: 'SW_UPDATE', url: req.url });
            });
          });
        }
        return res;
      }).catch(function() {
        return cached || caches.match('/404.html');
      });

      return cached || fetchPromise;
    });
  });
}

/* Network First — fallback for other requests */
function networkFirst(req) {
  return fetch(req).catch(function() {
    return caches.match(req).then(function(cached) {
      return cached || caches.match('/404.html');
    });
  });
}

/* ── Fetch strategy router ── */
self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch(e) { return; }

  /* Only handle same-origin + fonts.gstatic */
  if (url.origin !== self.location.origin && !isFont(url)) return;

  if (isFont(url)) {
    e.respondWith(cacheFirst(req, CACHE_STATIC));
    return;
  }

  if (isStaticAsset(url)) {
    e.respondWith(cacheFirst(req, CACHE_STATIC));
    return;
  }

  if (isImage(url)) {
    e.respondWith(cacheFirst(req, CACHE_IMAGES));
    return;
  }

  if (isHtmlPage(req)) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  e.respondWith(networkFirst(req));
});

/* ── Push: cache an article on demand ── */
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'CACHE_ARTICLE') {
    var url = e.data.url;
    if (!url) return;
    caches.open(CACHE_CONTENT).then(function(cache) {
      return fetch(url).then(function(res) {
        if (res && res.status === 200) {
          cache.put(url, res.clone());
        }
      });
    });
  }
});
