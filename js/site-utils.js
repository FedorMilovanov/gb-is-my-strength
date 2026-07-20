(function () {
  'use strict';

  var api = window.SiteUtils || {};
  var globalSources = new Set();
  var globalSourceMap = Object.create(null);
  var legacyLockActive = false;
  var savedScrollY = 0;
  var emergencyTimer = null;
  var restoring = false;
  var highlightObserver = null;
  var HIGHLIGHTS_KEY = 'gb-highlights-v1';

  function normalizeSource(source) {
    return typeof source === 'string' && source.trim() ? source.trim() : '__anonymous__';
  }

  function hasOpenOverlay() {
    return Boolean(
      document.querySelector('.mobile-nav.active, .mobile-nav[aria-hidden="false"]') ||
      document.querySelector('.cp-backdrop.is-open, .cp-panel[aria-hidden="false"]') ||
      document.querySelector('#btocOverlay.open, .btoc-panel[aria-hidden="false"]') ||
      document.querySelector('.sd-panel.open') ||
      document.querySelector('.toc-overlay.is-open, #partTocOverlay.is-open, #seriesTocOverlay.is-open') ||
      document.querySelector('#gb-hl-backdrop.is-open')
    );
  }

  function effectiveLocked() {
    return legacyLockActive || globalSources.size > 0;
  }

  function syncPublicState() {
    for (var key in globalSourceMap) delete globalSourceMap[key];
    globalSources.forEach(function (source) { globalSourceMap[source] = true; });
    if (legacyLockActive) globalSourceMap.__site_js_local__ = true;
  }

  function readLockedScrollY() {
    var top = parseFloat(document.body.style.top || '');
    if (Number.isFinite(top) && top < 0) return -top;
    return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  function applyLock() {
    if (!effectiveLocked() || restoring) return;
    restoring = true;
    try {
      var body = document.body;
      if (body.style.position !== 'fixed') savedScrollY = readLockedScrollY();
      var scrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      document.documentElement.style.setProperty('--scroll-lock-top', '-' + savedScrollY + 'px');
      document.documentElement.setAttribute('data-scroll-locked', '1');
      document.documentElement.classList.remove('cp-scroll-lock');
      body.classList.remove('no-scroll', 'ng-toc-lock');
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
      body.style.position = 'fixed';
      body.style.top = '-' + savedScrollY + 'px';
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.paddingRight = scrollbar ? scrollbar + 'px' : '';
    } finally {
      restoring = false;
    }
  }

  function releaseLock() {
    if (effectiveLocked() || restoring) return;
    restoring = true;
    try {
      var body = document.body;
      var top = parseFloat(body.style.top || '');
      var restoreY = Number.isFinite(top) && top < 0 ? -top : savedScrollY;
      body.style.removeProperty('overflow');
      body.style.removeProperty('overscroll-behavior');
      body.style.removeProperty('position');
      body.style.removeProperty('top');
      body.style.removeProperty('left');
      body.style.removeProperty('right');
      body.style.removeProperty('width');
      body.style.removeProperty('padding-right');
      body.classList.remove('no-scroll', 'ng-toc-lock');
      document.documentElement.classList.remove('cp-scroll-lock');
      document.documentElement.removeAttribute('data-scroll-locked');
      document.documentElement.style.removeProperty('--scroll-lock-top');
      var oldBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, restoreY || 0);
      document.documentElement.style.scrollBehavior = oldBehavior;
    } finally {
      restoring = false;
    }
  }

  function ensureLockState() {
    syncPublicState();
    if (effectiveLocked()) applyLock();
    else releaseLock();
  }

  function emergencyCheck() {
    if (!effectiveLocked()) return;
    if (!hasOpenOverlay()) {
      try { console.warn('[SiteUtils] Emergency unlock — модалок нет, замки висят:', globalSourceMap); } catch (_) {}
      forceUnlock();
    }
  }

  function startEmergencyTimer() {
    if (!emergencyTimer) emergencyTimer = setInterval(emergencyCheck, 3000);
  }

  function stopEmergencyTimer() {
    if (emergencyTimer) {
      clearInterval(emergencyTimer);
      emergencyTimer = null;
    }
  }

  function lockScroll(source) {
    source = normalizeSource(source);
    if (!globalSources.has(source)) globalSources.add(source);
    syncPublicState();
    applyLock();
    startEmergencyTimer();
  }

  function unlockScroll(source) {
    source = normalizeSource(source);
    globalSources.delete(source);
    syncPublicState();
    if (!effectiveLocked()) {
      releaseLock();
      stopEmergencyTimer();
    }
  }

  function forceUnlock() {
    globalSources.clear();
    legacyLockActive = false;
    syncPublicState();
    releaseLock();
    stopEmergencyTimer();
  }

  // site.js has a private SiteUtils object. It calls these two global hooks only
  // when its private lock set changes 0→1 / 1→0, which lets us coordinate both
  // implementations without editing the large minified bundle.
  function noteLegacyLockStart() {
    legacyLockActive = true;
    syncPublicState();
    startEmergencyTimer();
    queueMicrotask(ensureLockState);
  }

  function noteLegacyLockStop() {
    legacyLockActive = false;
    syncPublicState();
    queueMicrotask(ensureLockState);
    if (!effectiveLocked()) stopEmergencyTimer();
  }

  function protectedMethod(name, fn) {
    Object.defineProperty(api, name, {
      configurable: false,
      enumerable: true,
      get: function () { return fn; },
      // site.js copies its private methods onto window.SiteUtils. Ignore only
      // these protected assignments so every external module keeps one state.
      set: function () {}
    });
  }

  protectedMethod('lockScroll', lockScroll);
  protectedMethod('unlockScroll', unlockScroll);
  protectedMethod('forceUnlockScroll', forceUnlock);
  protectedMethod('forceUnlockEmergency', forceUnlock);
  protectedMethod('_startEmergencyTimer', noteLegacyLockStart);
  protectedMethod('_stopEmergencyTimer', noteLegacyLockStop);

  Object.defineProperty(api, '_scrollLockSources', {
    configurable: false,
    enumerable: true,
    get: function () { return globalSourceMap; },
    set: function () {}
  });
  Object.defineProperty(api, '_scrollLockCount', {
    configurable: false,
    enumerable: true,
    get: function () { return Object.keys(globalSourceMap).length; },
    set: function () {}
  });

  if (typeof api.ready !== 'function') {
    api.ready = function (fn) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
      else fn();
    };
  }

  window.SiteUtils = api;

  function canonicalPage(url) {
    try {
      var parsed = new URL(url || '', window.location.href);
      return parsed.origin + parsed.pathname.replace(/\/+$/, '') + '/';
    } catch (_) {
      return String(url || '').split('#')[0];
    }
  }

  function normalizeQuoteText(text) {
    return String(text || '').trim().replace(/\s+/g, ' ');
  }

  function dedupeHighlights(items) {
    if (!Array.isArray(items)) return [];
    var seen = new Set();
    var result = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item || typeof item !== 'object') continue;
      var text = normalizeQuoteText(item.text);
      if (!text) continue;
      var key = canonicalPage(item.url) + '\n' + text;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result;
  }

  function installHighlightStorageGuard() {
    if (!window.Storage || !Storage.prototype || Storage.prototype.__gbHighlightDedupe) return;
    var originalSetItem = Storage.prototype.setItem;
    Object.defineProperty(Storage.prototype, '__gbHighlightDedupe', { value: true });
    Storage.prototype.setItem = function (key, value) {
      if (key === HIGHLIGHTS_KEY) {
        try {
          var parsed = JSON.parse(String(value));
          value = JSON.stringify(dedupeHighlights(parsed));
        } catch (_) {}
      }
      return originalSetItem.call(this, key, value);
    };

    try {
      var current = localStorage.getItem(HIGHLIGHTS_KEY);
      if (current) {
        var parsed = JSON.parse(current);
        var clean = dedupeHighlights(parsed);
        if (clean.length !== parsed.length) originalSetItem.call(localStorage, HIGHLIGHTS_KEY, JSON.stringify(clean));
      }
    } catch (_) {}
  }

  function syncHighlightDialog(dialog) {
    if (!dialog || dialog.id !== 'gb-hl-backdrop') return;
    var open = dialog.classList.contains('is-open');
    dialog.setAttribute('aria-hidden', open ? 'false' : 'true');
    if ('inert' in dialog) dialog.inert = !open;
    if (!dialog.__gbAriaObserver) {
      var observer = new MutationObserver(function () { syncHighlightDialog(dialog); });
      observer.observe(dialog, { attributes: true, attributeFilter: ['class'] });
      dialog.__gbAriaObserver = observer;
    }
  }

  function findHighlightDialog() {
    var dialog = document.getElementById('gb-hl-backdrop');
    if (dialog) syncHighlightDialog(dialog);
  }

  function installHighlightAriaGuard() {
    findHighlightDialog();
    if (highlightObserver || !window.MutationObserver || !document.documentElement) return;
    highlightObserver = new MutationObserver(findHighlightDialog);
    highlightObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  installHighlightStorageGuard();
  installHighlightAriaGuard();

  // A private site.js unlock can remove body styles while a global overlay is
  // still open. Restore them on the next microtask/animation frame.
  if (window.MutationObserver && document.body) {
    var lockObserver = new MutationObserver(function () {
      if (!restoring && effectiveLocked()) queueMicrotask(ensureLockState);
    });
    lockObserver.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    lockObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-scroll-locked', 'class'] });
  }

  window.addEventListener('pagehide', stopEmergencyTimer);
  window.addEventListener('beforeunload', stopEmergencyTimer);

  window.GBRuntimeIntegrity = {
    dedupeHighlights: dedupeHighlights,
    quoteKey: function (item) { return canonicalPage(item && item.url) + '\n' + normalizeQuoteText(item && item.text); },
    lockState: function () {
      return { global: Array.from(globalSources), legacy: legacyLockActive, effective: effectiveLocked() };
    }
  };
})();
