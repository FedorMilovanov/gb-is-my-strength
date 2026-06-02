/* ============================================================
   sw.js — Service Worker
   Господь Бог — Сила Моя · v1.6.0

   Стратегии:
   — CSS / JS / шрифты / иконки → Cache First
   — HTML-статьи → Stale While Revalidate
   — Images → Cache First (с ограничением)
   — Все остальные запросы → Network First
   ============================================================ */

var CACHE_VERSION = 'gb-v164-gill-cleanup-20260602';
var CACHE_STATIC   = CACHE_VERSION + '-static';
var CACHE_CONTENT  = CACHE_VERSION + '-content';
var CACHE_IMAGES   = CACHE_VERSION + '-images';
/* B-04: отдельный кэш для данных Pagefind — сбрасывается независимо от статики.
   pagefind.js и *.pagefind (wasm, fragment-idx) кэшируются агрессивно только если
   они не являются данными индекса (fragment/ и index/).                           */
var CACHE_PAGEFIND = CACHE_VERSION + '-pagefind';

/* Ресурсы для прекэша при установке */
var PRECACHE_ASSETS = [
  '/css/site.css',
  '/css/home.css',
  '/css/command-palette.css',
  '/css/mobile-hotfix.css',
  '/css/nagornaya-mobile-toc.css',
  '/fonts/fonts.css',
  '/nagornaya/tw.min.css',
  '/js/site.js',
  '/js/site-utils.js',
  '/js/scroll-perf.js',
  '/js/search.js',
  '/js/highlights.js',
  '/js/bookmark-engine.js',
  '/js/enhancements.js',
  '/js/sw-register.js',
  '/js/nagornaya-mobile-toc.js',
  '/js/glossary.js',
  '/js/series-cards.js',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-48.png',
  '/apple-touch-icon.png',
  '/404.html',
  /* SUS-D: pagefind.js в precache → поиск доступен офлайн с первого визита */
  '/pagefind/pagefind.js',
  '/data/search-manifest.json'
];

/* ── Install: precache static assets ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_STATIC).then(function(cache) {
      return Promise.allSettled(
        PRECACHE_ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Failed to precache:', url, err);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── Activate: cleanup old caches ── */
self.addEventListener('activate', function(e) {
  var KNOWN = [CACHE_STATIC, CACHE_CONTENT, CACHE_IMAGES, CACHE_PAGEFIND];
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

/* B-04: файлы данных Pagefind (fragment/, index/) обновляются при каждом деплое —
   нельзя кэшировать агрессивно. JS/WASM/css Pagefind — стабильны, можно Cache-First. */
function isPagefindData(url) {
  return url.pathname.startsWith('/pagefind/fragment/') ||
         url.pathname.startsWith('/pagefind/index/');
}

function isPagefindStatic(url) {
  return url.pathname.startsWith('/pagefind/') && !isPagefindData(url);
}

function isStaticAsset(url) {
  return /\.(css|js|json|woff2?|ttf|otf|ico|svg|webmanifest)(\?|$)/.test(url.pathname) ||
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
  /* AUDIT V2 / PERF-1: после миграции на self-host шрифтов проверяем
     local /fonts/*.woff2. fonts.gstatic.com оставлен как fallback. */
  if (url.origin === self.location.origin && url.pathname.startsWith('/fonts/')) return true;
  return url.hostname === 'fonts.gstatic.com';
}

/* Cache First — good for static assets and fonts */
var IMG_CACHE_LIMIT = 60;
var PAGEFIND_CACHE_LIMIT = 50;
var CONTENT_CACHE_LIMIT = 30; /* V2-FIX: LRU для контентного кэша */

var CACHE_METADATA = new Map();
function updateMetadata(url) { CACHE_METADATA.set(url, Date.now()); }

function trimCache(cache, limit) {
  return cache.keys().then(function(keys) {
    if (keys.length <= limit) return Promise.resolve();
    var sorted = keys.sort(function(a, b) {
      return (CACHE_METADATA.get(a.url) || 0) - (CACHE_METADATA.get(b.url) || 0);
    });
    var overflow = keys.length - limit;
    return Promise.all(sorted.slice(0, overflow).map(function(key) {
      CACHE_METADATA.delete(key.url);
      return cache.delete(key);
    }));
  });
}

function cacheFirst(req, cacheName) {
  var isImages = cacheName === CACHE_IMAGES;
  var isVersioned = /[?&]v=/.test(req.url);

  function fallbackToPrecache(cache) {
    if (!isVersioned) return Promise.resolve(undefined);
    var bare = new URL(req.url);
    bare.search = '';
    return cache.match(bare.pathname);
  }

  return caches.open(cacheName).then(function(cache) {
    /* P0: versioned assets (?v=hash) must be matched by the full request URL.
       Query-agnostic matching served stale /css/site.css for /css/site.css?v=newhash.
       We still fallback to the bare precache key only when offline/network fails. */
    return cache.match(req).then(function(cached) {
      if (cached) { updateMetadata(req.url); return cached; }
      return fetch(req).then(function(res) {
        if (res && res.status === 200 && res.type !== 'opaque') {
          return cache.put(req, res.clone()).then(function() {
            if (isImages) return trimCache(cache, IMG_CACHE_LIMIT);
          }).catch(function(err) {
            if (err.name === 'QuotaExceededError' || err.code === 22) {
              return trimCache(cache, Math.floor(IMG_CACHE_LIMIT / 2));
            }
          }).then(function() { return res; });
        }
        return res;
      }).catch(function() {
        return fallbackToPrecache(cache).then(function(fallback) {
          if (fallback) return fallback;
          throw new Error('[SW] cacheFirst miss and network failed: ' + req.url);
        });
      });
    });
  });
}

/* Stale While Revalidate — good for HTML pages */
function staleWhileRevalidate(req, evt) {
  return caches.open(CACHE_CONTENT).then(function(cache) {
    return cache.match(req).then(function(cached) {
      var networkRes = null;
      var fetchPromise = fetch(req).then(function(res) {
        networkRes = res;
        if (res && res.status === 200) {
          cache.put(req, res.clone()).then(function() {
            return trimCache(cache, CONTENT_CACHE_LIMIT);
          }).catch(function() {
            /* Кэширование не должно ломать сетевой ответ. */
          });
        }
        return res;
      }).catch(function() {
        if (cached) updateMetadata(req.url);
        return cached || caches.match('/404.html');
      });

      if (cached && evt && evt.waitUntil) {
        evt.waitUntil(fetchPromise.then(function(){ return undefined; }).catch(function(){ return undefined; }));
      }
      return cached || fetchPromise;
    });
  });
}

/* Network First — fallback for other requests */
function networkFirst(req) {
  return fetch(req).catch(function() {
    return caches.match(req).then(function(cached) {
      if (cached) updateMetadata(req.url);
      return cached || caches.match('/404.html');
    });
  });
}

/* B-04: Network First WITH cache write — для pagefind-данных.
   Пробуем сеть (всегда свежий индекс), кэшируем успех в CACHE_PAGEFIND,
   при ошибке отдаём закэшированное (поиск работает офлайн).
   НЕ используем /404.html как fallback: pagefind получит HTML-страницу
   вместо бинарных данных и упадёт при попытке wasm-декомпрессии. Вместо
   этого возвращаем 503 — pagefind обрабатывает его штатно (нет результатов). */
function networkFirstWithCache(req, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return fetch(req).then(function(res) {
      if (res && res.status === 200 && res.type !== 'opaque') {
        cache.put(req, res.clone()).then(function() { return trimCache(cache, PAGEFIND_CACHE_LIMIT); }).catch(function(){});
      }
      return res;
    }).catch(function() {
      return cache.match(req).then(function(cached) {
        if (cached) updateMetadata(req.url);
      return cached || new Response('', { status: 503, statusText: 'Service Unavailable' });
      });
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

  /* B-04: Pagefind данные (fragment/, index/) — Network-First c кэшированием:
     свежий индекс в онлайне, кэшированный — в офлайне (поиск продолжает работать).
     Pagefind JS/WASM — Cache-First: бинарные ресурсы не меняются между деплоями.  */
  if (isPagefindData(url)) {
    e.respondWith(networkFirstWithCache(req, CACHE_PAGEFIND));
    return;
  }

  if (isPagefindStatic(url)) {
    e.respondWith(cacheFirst(req, CACHE_PAGEFIND));
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
    e.respondWith(staleWhileRevalidate(req, e));
    return;
  }

  e.respondWith(networkFirst(req));
});

/* ── Push: cache an article on demand ── */
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'CACHE_ARTICLE') {
    var url = e.data.url;
    if (!url) return;
    e.waitUntil(
      caches.open(CACHE_CONTENT).then(function(cache) {
        return fetch(url).then(function(res) {
          if (res && res.status === 200) {
            cache.put(url, res.clone()).catch(function(){ /* ignore */ });
          }
        });
      }).catch(function() { /* ignore cache failures */ })
    );
  }
});

/* ── Background Sync for Offline Caching ── */
self.addEventListener('sync', function(e) {
  if (e.tag && e.tag.indexOf('cache-article:') === 0) {
    var url = e.tag.replace('cache-article:', '');
    e.waitUntil(
      caches.open(CACHE_CONTENT).then(function(cache) {
        return fetch(url).then(function(res) {
          if (res && res.status === 200) {
            return cache.put(url, res.clone());
          }
        });
      })
    );
  }
});
