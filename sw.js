/* ============================================================
   sw.js — Service Worker
   Господь Бог — Сила Моя · v1.0

   Стратегии:
   — CSS / JS / шрифты / иконки → Cache First
   — HTML-статьи → Stale While Revalidate
   — Images → Cache First (с ограничением)
   — Все остальные запросы → Network First
   ============================================================ */

var CACHE_VERSION = 'gb-v4';
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
  '/css/nagornaya-mobile-toc.css',
  '/nagornaya/tw.min.css',
  '/js/site.js',
  '/js/search.js',
  '/js/highlights.js',
  '/js/bookmark-engine.js',
  '/js/enhancements.js',
  '/js/sw-register.js',
  '/js/nagornaya-mobile-toc.js',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-48.png',
  '/apple-touch-icon.png',
  '/404.html',
  /* SUS-D: pagefind.js в precache → поиск доступен офлайн с первого визита */
  '/pagefind/pagefind.js',
  '/pagefind/pagefind-highlight.js',
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
  return /\.(css|js|woff2?|ttf|otf|ico|png|svg|webmanifest)(\?|$)/.test(url.pathname) ||
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
var IMG_CACHE_LIMIT = 60; /* BUG-06: ограничение кэша изображений */

function cacheFirst(req, cacheName) {
  var isImages = cacheName === CACHE_IMAGES;
  return caches.open(cacheName).then(function(cache) {
    return cache.match(req).then(function(cached) {
      if (cached) return cached;
      return fetch(req).then(function(res) {
        if (res && res.status === 200 && res.type !== 'opaque') {
          cache.put(req, res.clone());
          if (isImages) {
            cache.keys().then(function(keys) {
              if (keys.length > IMG_CACHE_LIMIT) {
                cache.delete(keys[0]);
              }
            });
          }
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
        cache.put(req, res.clone());
      }
      return res;
    }).catch(function() {
      return cache.match(req).then(function(cached) {
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
