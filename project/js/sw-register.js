/* ============================================================
   sw-register.js — Service Worker Registration + Offline Toast
   Господь Бог — Сила Моя · v1.0
   ============================================================ */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  /* ── Register ── */
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(reg) {
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

  var toastEl = document.createElement('div');
  toastEl.id = 'gb-sw-toast';
  document.body ? document.body.appendChild(toastEl) :
    document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(toastEl); });

  var hideTimer;
  function showToast(msg, isReload, type) {
    clearTimeout(hideTimer);
    toastEl.className = '';
    if (type) toastEl.classList.add(type);
    if (isReload) toastEl.classList.add('toast-reload');
    toastEl.innerHTML = '<span class="toast-dot"></span><span>' + msg + '</span>';
    toastEl.classList.add('visible');

    if (isReload) {
      toastEl.addEventListener('click', function handler() {
        window.location.reload();
        toastEl.removeEventListener('click', handler);
      }, { once: true });
      hideTimer = setTimeout(hideToast, 8000);
    } else {
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
      /* Silently update — don't bother user unless they're active */
    }
  });

  /* On article pages: show "available offline" after 2 sec of reading */
  document.addEventListener('DOMContentLoaded', function() {
    if (!document.querySelector('article[data-pagefind-body], article')) return;

    var shown = false;
    setTimeout(function() {
      if (!shown && !document.hidden) {
        /* Article is being read — it's being cached by SW stale-while-revalidate */
        /* Show subtle toast only if user hasn't seen it this session */
        var key = 'gb-offline-hint';
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            showToast('Статья доступна офлайн', false, 'toast-cached');
            shown = true;
          }
        } catch(e) {}
      }
    }, 2500);
  });
})();
