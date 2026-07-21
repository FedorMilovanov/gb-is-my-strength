(function () {
  'use strict';

  var api = window.SiteUtils || {};
  var globalSources = new Set();
  var globalSourceMap = Object.create(null);
  var legacyLockActive = false;
  var savedScrollY = 0;
  var savedLockStyles = null;
  var emergencyTimer = null;
  var restoring = false;
  var highlightObserver = null;
  var HIGHLIGHTS_KEY = 'gb-highlights-v1';

  function normalizeSource(source) {
    return typeof source === 'string' && source.trim() ? source.trim() : '__anonymous__';
  }

  function hasOpenOverlay() {
    if (window.OverlayRuntime && typeof window.OverlayRuntime.hasLiveLayers === 'function' && window.OverlayRuntime.hasLiveLayers()) return true;
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

  function lockStylesApplied() {
  var body = document.body;
  var html = document.documentElement;
  return Boolean(
    body && html &&
    html.getAttribute('data-scroll-locked') === '1' &&
    body.style.position === 'fixed' &&
    body.style.overflow === 'hidden' &&
    body.style.overscrollBehavior === 'none' &&
    body.style.width === '100%'
  );
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

  function readStyle(style, property, camelName) {
    if (!style) return '';
    if (typeof style.getPropertyValue === 'function') return style.getPropertyValue(property) || '';
    return style[camelName] || '';
  }

  function writeStyle(style, property, camelName, value) {
    if (!style) return;
    if (value) {
      if (typeof style.setProperty === 'function') style.setProperty(property, value);
      else style[camelName] = value;
    } else if (typeof style.removeProperty === 'function') style.removeProperty(property);
    else style[camelName] = '';
  }

  function captureLockStyles() {
    var body = document.body;
    var html = document.documentElement;
    return {
      body: {
        overflow: readStyle(body.style, 'overflow', 'overflow'),
        overscrollBehavior: readStyle(body.style, 'overscroll-behavior', 'overscrollBehavior'),
        position: readStyle(body.style, 'position', 'position'),
        top: readStyle(body.style, 'top', 'top'),
        left: readStyle(body.style, 'left', 'left'),
        right: readStyle(body.style, 'right', 'right'),
        width: readStyle(body.style, 'width', 'width'),
        paddingRight: readStyle(body.style, 'padding-right', 'paddingRight'),
        noScroll: body.classList.contains('no-scroll'),
        nagornayaLock: body.classList.contains('ng-toc-lock')
      },
      html: {
        scrollLockTop: readStyle(html.style, '--scroll-lock-top', '--scroll-lock-top'),
        dataScrollLocked: html.getAttribute('data-scroll-locked'),
        controlPanelLock: html.classList.contains('cp-scroll-lock')
      }
    };
  }

  function restoreLockStyles(snapshot) {
    snapshot = snapshot || { body: {}, html: {} };
    var body = document.body;
    var html = document.documentElement;
    writeStyle(body.style, 'overflow', 'overflow', snapshot.body.overflow || '');
    writeStyle(body.style, 'overscroll-behavior', 'overscrollBehavior', snapshot.body.overscrollBehavior || '');
    writeStyle(body.style, 'position', 'position', snapshot.body.position || '');
    writeStyle(body.style, 'top', 'top', snapshot.body.top || '');
    writeStyle(body.style, 'left', 'left', snapshot.body.left || '');
    writeStyle(body.style, 'right', 'right', snapshot.body.right || '');
    writeStyle(body.style, 'width', 'width', snapshot.body.width || '');
    writeStyle(body.style, 'padding-right', 'paddingRight', snapshot.body.paddingRight || '');
    body.classList.toggle('no-scroll', Boolean(snapshot.body.noScroll));
    body.classList.toggle('ng-toc-lock', Boolean(snapshot.body.nagornayaLock));
    html.classList.toggle('cp-scroll-lock', Boolean(snapshot.html.controlPanelLock));
    if (snapshot.html.dataScrollLocked === null || snapshot.html.dataScrollLocked === undefined) html.removeAttribute('data-scroll-locked');
    else html.setAttribute('data-scroll-locked', snapshot.html.dataScrollLocked);
    writeStyle(html.style, '--scroll-lock-top', '--scroll-lock-top', snapshot.html.scrollLockTop || '');
  }

  function applyLock() {
    if (!effectiveLocked() || restoring || lockStylesApplied()) return;
    restoring = true;
    try {
      var body = document.body;
      if (!savedLockStyles) savedLockStyles = captureLockStyles();
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
    } finally { restoring = false; }
  }

  function releaseLock() {
    if (effectiveLocked() || restoring) return;
    restoring = true;
    try {
      var top = parseFloat(document.body.style.top || '');
      var restoreY = Number.isFinite(top) && top < 0 ? -top : savedScrollY;
      restoreLockStyles(savedLockStyles);
      savedLockStyles = null;
      var oldBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, restoreY || 0);
      document.documentElement.style.scrollBehavior = oldBehavior;
    } finally { restoring = false; }
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

  var overlayRecords = new Map();
  var overlayStack = [];
  var inertClaims = new Map();
  var overlaySequence = 0;
  var overlayRecovering = false;
  var overlayFocusableSelector = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function overlayId(value) {
    var id = normalizeSource(value);
    return id === '__anonymous__' ? 'overlay:anonymous' : id;
  }

  function overlayElement(value) {
    if (!value) return null;
    if (typeof value === 'string') return document.querySelector(value);
    return value;
  }

  function overlayRecord(ownerId, options) {
    var id = overlayId(ownerId);
    var record = overlayRecords.get(id);
    if (!record) {
      record = {
        ownerId: id,
        element: null,
        opener: null,
        focusTarget: null,
        inertTargets: [],
        claimedInert: [],
        onRequestClose: null,
        closeOnEscape: true,
        trapFocus: true,
        restoreFocus: true,
        lockScroll: true,
        open: false,
        sequence: 0,
        requesting: false
      };
      overlayRecords.set(id, record);
    }
    options = options || {};
    ['element', 'opener', 'focusTarget', 'inertTargets', 'onRequestClose'].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(options, key)) record[key] = options[key];
    });
    ['closeOnEscape', 'trapFocus', 'restoreFocus', 'lockScroll'].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(options, key)) record[key] = options[key] !== false;
    });
    record.element = overlayElement(record.element);
    record.opener = overlayElement(record.opener);
    return record;
  }

  function canOverlayFocus(element) {
    if (!element || typeof element.focus !== 'function' || element.isConnected === false || element.disabled) return false;
    if (element.getAttribute && element.getAttribute('aria-hidden') === 'true') return false;
    return element.offsetParent !== null || element === document.activeElement;
  }

  function overlayFocus(element) {
    if (!canOverlayFocus(element)) return false;
    try { element.focus({ preventScroll: true }); return true; }
    catch (_) { try { element.focus(); return true; } catch (_) { return false; } }
  }

  function firstOverlayFocus(record) {
    var target = typeof record.focusTarget === 'function' ? record.focusTarget(record) : overlayElement(record.focusTarget);
    if (target) return target;
    return record.element && record.element.querySelector ? record.element.querySelector(overlayFocusableSelector) : null;
  }

  function inertElements(values) {
    var result = [];
    (Array.isArray(values) ? values : [values]).forEach(function (value) {
      if (!value) return;
      if (typeof value === 'string') {
        try { Array.prototype.push.apply(result, document.querySelectorAll(value)); } catch (_) {}
      } else result.push(value);
    });
    return result.filter(function (element, index) { return element && result.indexOf(element) === index; });
  }

  function claimOverlayInert(record) {
    record.claimedInert = inertElements(record.inertTargets);
    record.claimedInert.forEach(function (element) {
      var claim = inertClaims.get(element);
      if (!claim) {
        claim = {
          count: 0,
          inert: element.hasAttribute ? element.hasAttribute('inert') : Boolean(element.inert),
          ariaHidden: element.getAttribute ? element.getAttribute('aria-hidden') : null
        };
        inertClaims.set(element, claim);
      }
      claim.count += 1;
      if ('inert' in element) element.inert = true;
      if (element.setAttribute) {
        element.setAttribute('inert', '');
        element.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function releaseOverlayInert(record) {
    (record.claimedInert || []).forEach(function (element) {
      var claim = inertClaims.get(element);
      if (!claim) return;
      claim.count -= 1;
      if (claim.count > 0) return;
      inertClaims.delete(element);
      if ('inert' in element) element.inert = claim.inert;
      if (element.setAttribute) {
        if (claim.inert) element.setAttribute('inert', '');
        else element.removeAttribute('inert');
        if (claim.ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', claim.ariaHidden);
      }
    });
    record.claimedInert = [];
  }

  function topOverlayRecord() {
    for (var index = overlayStack.length - 1; index >= 0; index -= 1) {
      var record = overlayRecords.get(overlayStack[index]);
      if (record && record.open) return record;
    }
    return null;
  }

  function overlaySnapshot() {
    return overlayStack.map(function (id) {
      var record = overlayRecords.get(id);
      return record && record.open ? {
        ownerId: record.ownerId,
        sequence: record.sequence,
        lockScroll: record.lockScroll,
        elementId: record.element && record.element.id || ''
      } : null;
    }).filter(Boolean);
  }

  function syncOverlayDiagnostics() {
    var top = topOverlayRecord();
    document.documentElement.setAttribute('data-overlay-count', String(overlaySnapshot().length));
    if (top) document.documentElement.setAttribute('data-overlay-top', top.ownerId);
    else document.documentElement.removeAttribute('data-overlay-top');
  }

  function overlayEvent(name, record, reason) {
    try {
      if (typeof window.CustomEvent === 'function') {
        document.dispatchEvent(new window.CustomEvent(name, { detail: { ownerId: record.ownerId, reason: reason || '' } }));
      }
    } catch (_) {}
  }

  function openOverlayOwner(ownerId, options) {
    options = options || {};
    var id = overlayId(ownerId);
    var existing = overlayRecords.get(id);
    var wasOpen = Boolean(existing && existing.open);
    var originalOpener = wasOpen && existing ? existing.opener : null;
    var record = overlayRecord(id, options);
    if (wasOpen && originalOpener) record.opener = originalOpener;
    if (!record.opener) {
      var active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) record.opener = active;
    }
    overlayStack = overlayStack.filter(function (stackId) { return stackId !== record.ownerId; });
    overlayStack.push(record.ownerId);
    record.open = true;
    record.sequence = ++overlaySequence;
    if (record.element) {
      record.element.setAttribute('aria-hidden', 'false');
      record.element.removeAttribute('inert');
      if ('inert' in record.element) record.element.inert = false;
      record.element.setAttribute('data-overlay-owner', record.ownerId);
      record.element.setAttribute('data-overlay-open', '1');
    }
    if (!wasOpen) {
      claimOverlayInert(record);
      if (record.lockScroll) lockScroll('overlay:' + record.ownerId);
      overlayEvent('gb:overlay-open', record, options.reason || 'open');
    }
    syncOverlayDiagnostics();
    var target = firstOverlayFocus(record);
    if (target) setTimeout(function () { if (record.open) overlayFocus(target); }, 0);
    return { ownerId: record.ownerId, element: record.element, sequence: record.sequence };
  }

  function closeOverlayOwner(ownerId, reason, options) {
    var record = overlayRecords.get(overlayId(ownerId));
    if (!record || !record.open) return false;
    options = options || {};
    record.open = false;
    overlayStack = overlayStack.filter(function (id) { return id !== record.ownerId; });
    if (record.element) {
      record.element.setAttribute('aria-hidden', 'true');
      record.element.setAttribute('inert', '');
      if ('inert' in record.element) record.element.inert = true;
      record.element.removeAttribute('data-overlay-open');
    }
    releaseOverlayInert(record);
    if (record.lockScroll) unlockScroll('overlay:' + record.ownerId);
    syncOverlayDiagnostics();
    overlayEvent('gb:overlay-close', record, reason || 'close');
    var restore = options.restoreFocus !== false && record.restoreFocus && !/^(?:pagehide|beforeunload|force)$/.test(reason || '');
    var opener = record.opener;
    record.opener = null;
    if (restore && opener) setTimeout(function () { overlayFocus(opener); }, 0);
    return true;
  }

  function requestOverlayClose(ownerId, reason) {
    var record = overlayRecords.get(overlayId(ownerId));
    if (!record || !record.open || record.requesting) return false;
    record.requesting = true;
    var result;
    try {
      if (typeof record.onRequestClose === 'function') result = record.onRequestClose(reason || 'request', record);
    } finally { record.requesting = false; }
    if (!record.open) return true;
    if (result === false) return false;
    return closeOverlayOwner(record.ownerId, reason || 'request');
  }

  function destroyOverlayOwner(ownerId) {
    var id = overlayId(ownerId);
    var record = overlayRecords.get(id);
    if (!record) return false;
    if (record.open) closeOverlayOwner(id, 'destroy', { restoreFocus: false });
    if (record.element) {
      record.element.removeAttribute('data-overlay-owner');
      record.element.removeAttribute('data-overlay-open');
    }
    overlayRecords.delete(id);
    syncOverlayDiagnostics();
    return true;
  }

  function recoverOverlayOwners(reason) {
    if (overlayRecovering) return false;
    overlayRecovering = true;
    try {
      overlayStack.slice().reverse().forEach(function (id) {
        closeOverlayOwner(id, reason || 'force', { restoreFocus: false });
      });
      overlayStack = [];
      syncOverlayDiagnostics();
      return true;
    } finally { overlayRecovering = false; }
  }

  function hasLiveOverlayOwners() {
    return overlayStack.some(function (id) {
      var record = overlayRecords.get(id);
      if (!record || !record.open) return false;
      if (!record.element) return true;
      return record.element.isConnected !== false && record.element.getAttribute('aria-hidden') !== 'true';
    });
  }

  function trapTopOverlayFocus(event, record) {
    if (!record || !record.trapFocus || !record.element || !record.element.querySelectorAll) return false;
    var focusable = Array.prototype.slice.call(record.element.querySelectorAll(overlayFocusableSelector)).filter(canOverlayFocus);
    if (!focusable.length) return false;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); overlayFocus(last); return true;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); overlayFocus(first); return true;
    }
    return false;
  }

  document.addEventListener('keydown', function (event) {
    var top = topOverlayRecord();
    if (!top) return;
    if (event.key === 'Escape' || event.key === 'Esc') {
      if (!top.closeOnEscape) return;
      if (requestOverlayClose(top.ownerId, 'escape')) {
        event.preventDefault();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      }
      return;
    }
    if (event.key === 'Tab') trapTopOverlayFocus(event, top);
  }, true);

  window.addEventListener('pagehide', function () { recoverOverlayOwners('pagehide'); });
  window.addEventListener('beforeunload', function () { recoverOverlayOwners('beforeunload'); });

  var overlayApi = {
    register: function (ownerId, options) {
      var record = overlayRecord(ownerId, options || {});
      return {
        ownerId: record.ownerId,
        open: function (next) { return openOverlayOwner(record.ownerId, next || {}); },
        close: function (reason, closeOptions) { return closeOverlayOwner(record.ownerId, reason, closeOptions); },
        requestClose: function (reason) { return requestOverlayClose(record.ownerId, reason); },
        destroy: function () { return destroyOverlayOwner(record.ownerId); },
        isOpen: function () { var current = overlayRecords.get(record.ownerId); return Boolean(current && current.open); }
      };
    },
    open: openOverlayOwner,
    close: closeOverlayOwner,
    requestClose: requestOverlayClose,
    destroy: destroyOverlayOwner,
    lockScroll: lockScroll,
    unlockScroll: unlockScroll,
    topLayer: function () {
      var record = topOverlayRecord();
      return record ? { ownerId: record.ownerId, element: record.element, sequence: record.sequence } : null;
    },
    size: function () { return overlaySnapshot().length; },
    isOpen: function (ownerId) { var record = overlayRecords.get(overlayId(ownerId)); return Boolean(record && record.open); },
    snapshot: overlaySnapshot,
    hasLiveLayers: hasLiveOverlayOwners,
    forceRecover: recoverOverlayOwners
  };

  try {
    Object.defineProperty(window, 'OverlayRuntime', {
      configurable: false,
      enumerable: true,
      get: function () { return overlayApi; },
      set: function () {}
    });
  } catch (_) { window.OverlayRuntime = overlayApi; }

  Object.defineProperty(api, 'OverlayRuntime', {
    configurable: false,
    enumerable: true,
    get: function () { return overlayApi; },
    set: function () {}
  });

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
      if (!restoring && effectiveLocked() && !lockStylesApplied()) queueMicrotask(ensureLockState);
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
