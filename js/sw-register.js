(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  var siteVersion = window.SITE_CONFIG && window.SITE_CONFIG.version || '';
  var workerUrl = '/sw.js' + (siteVersion ? '?v=' + encodeURIComponent(siteVersion) : '');
  var toast;
  var hideTimer = 0;
  var reloadHandler = null;
  var hadController = Boolean(navigator.serviceWorker.controller);

  function mountToast() {
    if (!document.querySelector('link[data-sw-toast-style]')) {
      var style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = '/css/sw-toast.css?v=' + siteVersion;
      style.setAttribute('data-sw-toast-style', '');
      document.head.appendChild(style);
    }
    toast = document.getElementById('gb-sw-toast') || document.createElement('div');
    toast.id = 'gb-sw-toast';
    if (!toast.parentNode && document.body) document.body.appendChild(toast);
  }

  function ensureMounted() {
    if (document.body) mountToast();
    else document.addEventListener('DOMContentLoaded', mountToast, { once: true });
  }

  function clearReloadHandler() {
    if (toast && reloadHandler) toast.removeEventListener('click', reloadHandler);
    reloadHandler = null;
  }

  function hideToast() {
    if (toast) toast.classList.remove('visible');
  }

  function showToast(message, reload, className) {
    if (!toast) mountToast();
    if (!toast) return;
    clearTimeout(hideTimer);
    clearReloadHandler();
    toast.className = '';
    if (className) toast.classList.add(className);
    if (reload) toast.classList.add('toast-reload');
    while (toast.firstChild) toast.removeChild(toast.firstChild);
    var dot = document.createElement('span');
    dot.className = 'toast-dot';
    var text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(dot);
    toast.appendChild(text);
    toast.classList.add('visible');
    if (reload) {
      reloadHandler = function () { window.location.reload(); };
      toast.addEventListener('click', reloadHandler);
      hideTimer = setTimeout(function () { clearReloadHandler(); hideToast(); }, 8000);
    } else {
      hideTimer = setTimeout(hideToast, 3500);
    }
  }

  async function currentPageCached() {
    if (!window.caches) return false;
    try {
      if (await caches.match(location.href)) return true;
      return Boolean(await caches.match(location.origin + location.pathname));
    } catch (_) {
      return false;
    }
  }

  async function showOfflineState() {
    var cached = await currentPageCached();
    showToast(
      cached ? 'Вы офлайн — эта страница доступна' : 'Вы офлайн — эта страница не сохранена',
      false,
      'toast-offline'
    );
  }

  ensureMounted();

  navigator.serviceWorker.register(workerUrl, { scope: '/' }).then(function (registration) {
    registration.addEventListener('updatefound', function () {
      var installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', function () {
        if (installing.state === 'installed' && hadController) {
          showToast('Доступно обновление сайта — обновите страницу', true);
        }
      });
    });
  }).catch(function (error) {
    console.warn('[SW Register]', error);
  });

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (hadController) showToast('Сайт обновлён — обновите страницу', true);
    hadController = true;
  });

  navigator.serviceWorker.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'GB_SW_ACTIVATED') hadController = true;
  });

  window.addEventListener('offline', showOfflineState);
  window.addEventListener('online', function () { showToast('Соединение восстановлено', false); });
  window.addEventListener('pagehide', function () {
    clearTimeout(hideTimer);
    clearReloadHandler();
  });

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.querySelector('article[data-pagefind-body], article')) return;
    setTimeout(async function () {
      if (document.hidden || !navigator.serviceWorker.controller) return;
      var key = 'gb-offline-hint-count';
      try {
        var count = Number.parseInt(localStorage.getItem(key) || '0', 10);
        if (count >= 2 || !(await currentPageCached())) return;
        localStorage.setItem(key, String(count + 1));
        showToast('Эта страница доступна офлайн', false, 'toast-cached');
      } catch (_) {}
    }, 2500);
  }, { once: true });

  window.showToast = showToast;
  window.GBOffline = { currentPageCached: currentPageCached };
})();
