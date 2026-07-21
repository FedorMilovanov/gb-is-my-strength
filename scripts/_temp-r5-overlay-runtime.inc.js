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
    var record = overlayRecord(ownerId, options);
    if (!record.opener) {
      var active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) record.opener = active;
    }
    overlayStack = overlayStack.filter(function (id) { return id !== record.ownerId; });
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
    claimOverlayInert(record);
    if (record.lockScroll) lockScroll('overlay:' + record.ownerId);
    syncOverlayDiagnostics();
    overlayEvent('gb:overlay-open', record, options.reason || 'open');
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
