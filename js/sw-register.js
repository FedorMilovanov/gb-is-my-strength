/* ============================================================
   sw-register.js — Service Worker Registration + Offline Toast
   Господь Бог — Сила Моя · v1.1
   ============================================================
   Изменения v1.1:
   · Версионированный URL SW (/sw.js?v=…) из SITE_CONFIG для
     надёжного cache-bust при обновлении
   · Toast строится через DOM-API (без innerHTML) — XSS-безопасность
   · pagehide: cleanup _reloadHandler при уходе со страницы
   · Lazy body injection: toastEl вставляется после DOMContentLoaded
     без дублирования (защита от двойного монтирования)
   ============================================================ */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  /* ── Версионированный URL SW для надёжного cache-bust ── */
  var swVersion = (window.SITE_CONFIG && window.SITE_CONFIG.version) || '';
  var swUrl = '/sw.js' + (swVersion ? '?v=' + encodeURIComponent(swVersion) : '');

  /* ── Register ── */
  navigator.serviceWorker.register(swUrl, { scope: '/' }).then(function(reg) {
    /* Check for update on each visit */
    reg.addEventListener('updatefound', function() {
      var newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', function() {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showToast('Сайт обновлён — обновите страницу', true);
        }
      });
    });
  }).catch(function(err) {
    /* Silent failure — SW is enhancement, not critical */
    console.warn('[SW Register]', err);
  });

  /* ── Offline/online status toast ── */
  var TOAST_STYLES = `
    #gb-sw-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(80px);
      background: var(--ink, #14100b);
      color: #f5f0e8;
      padding: 10px 18px;
      border-radius: 6px;
      font-family: var(--mono, monospace);
      font-size: 11px;
      letter-spacing: .06em;
      white-space: nowrap;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(20,16,11,.35);
      transition: transform .3s ease, opacity .3s ease;
      opacity: 0;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #gb-sw-toast.visible {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
      pointer-events: auto;
    }
    #gb-sw-toast.toast-offline { background: var(--red, #9b2d2d); }
    #gb-sw-toast.toast-reload { cursor: pointer; }
    #gb-sw-toast .toast-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #6ee7a0; flex-shrink: 0;
    }
    #gb-sw-toast.toast-offline .toast-dot { background: #f5a0a0; }
    #gb-sw-toast.toast-cached { background: var(--green, #2d6b3a); }
  `;

  var styleEl = document.createElement('style');
  styleEl.textContent = TOAST_STYLES;
  document.head.appendChild(styleEl);

  /* ── Toast element ── */
  var toastEl = document.createElement('div');
  toastEl.id = 'gb-sw-toast';

  function _mountToast() {
    if (!document.body || document.getElementById('gb-sw-toast')) return;
    document.body.appendChild(toastEl);
  }

  if (document.body) {
    _mountToast();
  } else {
    document.addEventListener('DOMContentLoaded', _mountToast);
  }

  var hideTimer;
  var _reloadHandler = null;

  /* ── pagehide: cleanup при уходе со страницы ── */
  window.addEventListener('pagehide', function() {
    clearTimeout(hideTimer);
    if (_reloadHandler) {
      toastEl.removeEventListener('click', _reloadHandler);
      _reloadHandler = null;
    }
  });

  /* ── Toast builder через DOM-API (без innerHTML) ── */
  function buildToastContent(msg) {
    while (toastEl.firstChild) toastEl.removeChild(toastEl.firstChild);
    var dot = document.createElement('span');
    dot.className = 'toast-dot';
    var text = document.createElement('span');
    text.textContent = msg;
    toastEl.appendChild(dot);
    toastEl.appendChild(text);
  }

  function showToast(msg, isReload, type) {
    clearTimeout(hideTimer);
    toastEl.className = '';
    if (type) toastEl.classList.add(type);
    if (isReload) toastEl.classList.add('toast-reload');

    buildToastContent(msg);
    toastEl.classList.add('visible');

    if (isReload) {
      if (_reloadHandler) {
        toastEl.removeEventListener('click', _reloadHandler);
      }
      _reloadHandler = function () {
        toastEl.removeEventListener('click', _reloadHandler);
        _reloadHandler = null;
        window.location.reload();
      };
      toastEl.addEventListener('click', _reloadHandler);
      hideTimer = setTimeout(function () {
        if (_reloadHandler) {
          toastEl.removeEventListener('click', _reloadHandler);
          _reloadHandler = null;
        }
        hideToast();
      }, 8000);
    } else {
      if (_reloadHandler) {
        toastEl.removeEventListener('click', _reloadHandler);
        _reloadHandler = null;
      }
      hideTimer = setTimeout(hideToast, 3500);
    }
  }

  function hideToast() {
    toastEl.classList.remove('visible');
  }

  /* Offline / online events */
  window.addEventListener('offline', function() {
    showToast('Вы офлайн — кэшированные статьи доступны', false, 'toast-offline');
  });

  window.addEventListener('online', function() {
    showToast('Соединение восстановлено', false);
  });

  /* Cache article notification from SW */
  navigator.serviceWorker.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'SW_UPDATE') {
      /* Silently update */
    }
  });

  /* On article pages: show "available offline" after 2.5 sec */
  document.addEventListener('DOMContentLoaded', function() {
    if (!document.querySelector('article[data-pagefind-body], article')) return;

    var shown = false;
    setTimeout(function() {
      if (!shown && !document.hidden) {
        var key = 'gb-offline-hint-count';
        try {
          var count = parseInt(localStorage.getItem(key) || '0', 10);
          if (count < 2) {
            localStorage.setItem(key, String(count + 1));
            showToast('Статья доступна офлайн', false, 'toast-cached');
            shown = true;
          }
        } catch(e) {}
      }
    }, 2500);
  });
})();
