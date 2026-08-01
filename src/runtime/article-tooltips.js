const VERSION = 14;
const OWNER = 'site-utils-tooltip';
const SELECTOR = '.gterm, .fn-marker, .bref[data-ref]';
const INTERACTIVE = 'a[href],button,input,select,textarea,summary,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])';
const TOUCH_SLOP_SQUARED = 144;

let closeTimer = 0;
let pointerEpoch = 0;
let pointerX = null;
let pointerY = null;
let touchStart = null;
let touchMoved = false;

function siteUtils() {
  window.SiteUtils = window.SiteUtils || {};
  const api = window.SiteUtils;
  if (!Array.isArray(api._tooltipControllers)) api._tooltipControllers = [];
  return api;
}

function overlayRuntime() {
  return window.OverlayRuntime || window.SiteUtils?.OverlayRuntime || null;
}

function mobileViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function controllerMobileSheet(controller) {
  if (!controller?.opts?.mobileSheet) return false;
  const breakpoint = Number(controller.opts.mobileSheetBreakpoint || 768);
  return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
}

function activeController() {
  return siteUtils()._tooltipControllers.find((candidate) => candidate.activeEl && candidate.activeTip) || null;
}

function controllerFor(anchor) {
  return siteUtils()._tooltipControllers.find((candidate) => {
    try {
      return anchor.matches(candidate.anchorSel);
    } catch {
      return false;
    }
  }) || null;
}

function registerController(anchorSel, tipSel, opts = {}) {
  const api = siteUtils();
  const existing = api._tooltipControllers.find((candidate) => candidate.anchorSel === anchorSel && candidate.tipSel === tipSel);
  if (existing) return { open: existing.open, close: existing.close };

  const controller = {
    owner: OWNER,
    anchorSel,
    tipSel,
    opts: { ...opts },
    activeEl: null,
    activeTip: null,
    _gbState: null,
    isDesktop() {
      return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    },
    isMobileSheet() {
      return controllerMobileSheet(controller);
    },
    open(anchor, reason = 'api') {
      openController(controller, anchor, reason);
    },
    close(force = false, reason = 'close') {
      closeController(controller, force ? 'force' : reason);
    },
  };
  api._tooltipControllers.push(controller);
  return { open: controller.open, close: controller.close };
}

function installSharedRegistry() {
  const api = siteUtils();
  if (typeof api.makeTooltipController !== 'function') api.makeTooltipController = registerController;
  api.makeTooltipController('.bref[data-ref]', '.btip', {
    extraCloseSelectors: ['.btoc-nav', '.btoc-panel', '#toc-panel'],
  });
  api.makeTooltipController('.fn-marker', '.tooltip', {
    mobileSheet: true,
    mobileSheetBreakpoint: 768,
  });
  api.makeTooltipController('.gterm', '.gtip', {
    useFocusBlur: true,
    mobileSheet: true,
    mobileSheetBreakpoint: 768,
  });
  return api;
}

function cancelClose() {
  if (closeTimer) window.clearTimeout(closeTimer);
  closeTimer = 0;
}

function containsOwnedSurface(controller, target) {
  return Boolean(
    controller?.activeEl &&
    controller?.activeTip &&
    target instanceof Node &&
    (controller.activeEl.contains(target) || controller.activeTip.contains(target)),
  );
}

function recordPointerMovement(event) {
  const x = Number(event.clientX);
  const y = Number(event.clientY);
  const hasCoordinates = Number.isFinite(x) && Number.isFinite(y);
  const moved = pointerX == null || pointerY == null
    ? Math.abs(Number(event.movementX) || 0) > 0 || Math.abs(Number(event.movementY) || 0) > 0
    : hasCoordinates && (Math.abs(x - pointerX) > 0.5 || Math.abs(y - pointerY) > 0.5);
  if (hasCoordinates) {
    pointerX = x;
    pointerY = y;
  }
  if (moved) pointerEpoch += 1;
  return moved;
}

function settleHover(controller) {
  window.requestAnimationFrame(() => {
    const state = controller?._gbState;
    if (!state || state.reason !== 'hover') return;
    state.hoverSettled = true;
    state.pointerBaseline = pointerEpoch;
  });
}

function scheduleClose(controller = activeController(), delay = 220) {
  cancelClose();
  if (!controller?._gbState) return;
  closeTimer = window.setTimeout(() => {
    closeTimer = 0;
    const state = controller._gbState;
    if (!state || activeController() !== controller) return;
    const focused = document.activeElement;
    if (focused === controller.activeEl || controller.activeTip.contains(focused)) return;
    if (controller.activeEl.matches(':hover') || controller.activeTip.matches(':hover')) return;
    if (state.reason === 'hover' && (!state.hoverSettled || pointerEpoch === state.pointerBaseline)) return;
    closeController(controller, 'leave');
  }, delay);
}

function configuredScripture(reference) {
  const sources = [window.SITE_CONFIG?.scripture, window.SITE_CONFIG?.bible, window.BIBLE_VERSES, window.SCRIPTURE_DATA];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const value = source[reference];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value.text === 'string' && value.text.trim()) return value.text.trim();
  }
  return '';
}

function createScriptureTip(anchor) {
  const reference = String(anchor.dataset.ref || anchor.textContent || '').trim();
  const tip = document.createElement('span');
  tip.className = 'btip';
  tip.dataset.generatedScriptureTip = '1';
  const label = document.createElement('strong');
  label.className = 'btip__reference';
  label.textContent = reference;
  const body = document.createElement('span');
  body.className = 'btip__text';
  body.textContent = configuredScripture(reference) || 'Ссылка на указанное место Священного Писания.';
  tip.append(label, body);
  anchor.appendChild(tip);
  return tip;
}

function inlineTip(anchor, create = true, selector = '') {
  if (selector) return anchor.querySelector(selector);
  if (anchor.matches('.gterm')) return anchor.querySelector('.gtip');
  if (anchor.matches('.fn-marker')) return anchor.querySelector('.tooltip');
  if (anchor.matches('.bref[data-ref]')) return anchor.querySelector('.btip') || (create ? createScriptureTip(anchor) : null);
  return null;
}

function prepareGlossaryTip(tip) {
  if (!tip?.classList.contains('gtip')) return;
  let frame = tip.querySelector(':scope > .gtip-luxury');
  if (!frame) {
    frame = document.createElement('span');
    frame.className = 'gtip-luxury';
    while (tip.firstChild) frame.appendChild(tip.firstChild);
    tip.appendChild(frame);
  }
  const expand = frame.querySelector('[data-gtip-expand]');
  if (!expand || expand.dataset.gbExpandReady === '1') return;
  expand.dataset.gbExpandReady = '1';
  const detail = frame.querySelector('.gtip-detail-wrap');
  expand.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const expanded = expand.getAttribute('aria-expanded') !== 'true';
    expand.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    frame.classList.toggle('is-expanded', expanded);
    if (detail) detail.setAttribute('aria-hidden', expanded ? 'false' : 'true');
    const controller = activeController();
    if (controller?.activeTip === tip) position(controller);
  });
}

function prepareTip(tip) {
  prepareGlossaryTip(tip);
  return tip;
}

function setImportant(style, property, value) {
  style.setProperty(property, value, 'important');
}

function clearAuthoritativeGeometry(tip) {
  for (const property of ['left', 'top', 'right', 'bottom', 'max-height']) tip.style.removeProperty(property);
}

function position(controller) {
  const state = controller?._gbState;
  const tip = controller?.activeTip;
  const anchor = controller?.activeEl;
  if (!state || !tip || !anchor) return;
  if (state.mobileSheet) {
    clearAuthoritativeGeometry(tip);
    setImportant(tip.style, 'left', '0px');
    setImportant(tip.style, 'right', '0px');
    setImportant(tip.style, 'top', 'auto');
    setImportant(tip.style, 'bottom', '0px');
    setImportant(tip.style, 'max-height', `${Math.max(180, Math.floor(window.innerHeight * 0.72))}px`);
    return;
  }

  const margin = 16;
  const gap = 10;
  setImportant(tip.style, 'position', 'fixed');
  setImportant(tip.style, 'right', 'auto');
  setImportant(tip.style, 'bottom', 'auto');
  setImportant(tip.style, 'max-height', `${Math.max(160, window.innerHeight - margin * 2)}px`);
  const anchorRect = anchor.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const width = Math.min(tipRect.width, Math.max(0, window.innerWidth - margin * 2));
  const height = Math.min(tipRect.height, Math.max(0, window.innerHeight - margin * 2));
  let left = anchorRect.left + anchorRect.width / 2 - width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - margin - width));
  let top = anchorRect.top - height - gap;
  if (top < margin) top = anchorRect.bottom + gap;
  top = Math.max(margin, Math.min(top, window.innerHeight - margin - height));
  setImportant(tip.style, 'left', `${Math.round(left)}px`);
  setImportant(tip.style, 'top', `${Math.round(top)}px`);
  tip.style.setProperty('--gb-tip-arrow-x', `${Math.round(anchorRect.left + anchorRect.width / 2 - left)}px`);
}

function ensureMobileClose(tip, controller) {
  if (!controller?.isMobileSheet?.() || tip.querySelector('[data-tooltip-close]')) return;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'gb-tooltip-close';
  close.dataset.tooltipClose = '';
  close.dataset.gbGeneratedClose = '1';
  close.setAttribute('aria-label', 'Закрыть подсказку');
  close.textContent = '×';
  tip.insertBefore(close, tip.firstChild);
}

function restore(controller) {
  const state = controller?._gbState;
  const tip = controller?.activeTip;
  if (!state || !tip) return;
  tip.classList.remove('gb-floating-tip', 'is-open');
  clearAuthoritativeGeometry(tip);
  tip.style.removeProperty('position');
  tip.style.removeProperty('--gb-tip-arrow-x');
  if (state.placeholder?.parentNode) {
    state.placeholder.parentNode.insertBefore(tip, state.placeholder);
    state.placeholder.remove();
  }
}

function closeController(controller, reason = 'close') {
  cancelClose();
  const state = controller?._gbState;
  const anchor = controller?.activeEl;
  if (!state || !anchor || !controller.activeTip) return false;
  anchor.classList.remove('is-open');
  anchor.setAttribute('aria-expanded', 'false');
  if (state.mobileSheet) {
    if (overlayRuntime()) overlayRuntime().close(OWNER, reason);
    else window.SiteUtils?.unlockScroll?.(`overlay:${OWNER}`);
  }
  restore(controller);
  controller.activeEl = null;
  controller.activeTip = null;
  controller._gbState = null;
  if (!activeController()) document.documentElement.classList.remove('gb-tooltip-open');
  if (!state.mobileSheet && /^escape/.test(reason)) anchor.focus({ preventScroll: true });
  return true;
}

export function closeTooltip(reason = 'close') {
  const controller = activeController();
  return controller ? closeController(controller, reason) : false;
}

function bindTipInteraction(tip) {
  if (tip.dataset.gbInteractionBound === '1') return;
  tip.dataset.gbInteractionBound = '1';
  tip.addEventListener('pointerenter', cancelClose);
  tip.addEventListener('mouseenter', cancelClose);
  tip.addEventListener('pointerleave', () => scheduleClose());
  tip.addEventListener('mouseleave', () => scheduleClose());
  tip.addEventListener('click', (event) => {
    const controller = activeController();
    if (!controller || controller.activeTip !== tip) return;
    const close = event.target instanceof Element ? event.target.closest('[data-tooltip-close]') : null;
    if (close && tip.contains(close)) {
      event.preventDefault();
      event.stopPropagation();
      closeController(controller, 'control');
      return;
    }
    const interactive = event.target instanceof Element ? event.target.closest(INTERACTIVE) : null;
    if (interactive && tip.contains(interactive)) {
      event.stopPropagation();
      return;
    }
    if (mobileViewport()) {
      event.preventDefault();
      event.stopPropagation();
      closeController(controller, 'surface');
      return;
    }
    event.stopPropagation();
  });
}

function openController(controller, anchor, reason = 'open') {
  if (!controller || !anchor) return;
  const current = activeController();
  if (current && current !== controller) current.close(true, 'replace');
  if (controller.activeEl === anchor && controller._gbState) {
    controller._gbState.reason = reason;
    controller._gbState.pointerBaseline = pointerEpoch;
    if (reason === 'hover') {
      controller._gbState.hoverSettled = false;
      settleHover(controller);
    }
    position(controller);
    return;
  }
  if (controller._gbState) closeController(controller, 'replace');

  const tip = prepareTip(inlineTip(anchor));
  if (!tip) return;
  const placeholder = document.createComment('gb-inline-tooltip');
  tip.parentNode?.insertBefore(placeholder, tip);
  document.body.appendChild(tip);
  ensureMobileClose(tip, controller);
  bindTipInteraction(tip);
  tip.classList.add('gb-floating-tip', 'is-open');
  anchor.classList.add('is-open');
  anchor.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('gb-tooltip-open');

  controller.activeEl = anchor;
  controller.activeTip = tip;
  controller._gbState = {
    placeholder,
    mobileSheet: controller.isMobileSheet(),
    reason,
    hoverSettled: reason !== 'hover',
    pointerBaseline: pointerEpoch,
  };
  position(controller);
  window.requestAnimationFrame(() => {
    if (controller.activeTip === tip) position(controller);
  });
  if (reason === 'hover') settleHover(controller);

  if (controller._gbState.mobileSheet) {
    const runtime = overlayRuntime();
    if (runtime) {
      runtime.open(OWNER, {
        element: tip,
        opener: anchor,
        closeOnEscape: true,
        trapFocus: false,
        restoreFocus: true,
        lockScroll: true,
        onRequestClose: (closeReason) => {
          closeController(controller, closeReason || 'request');
          return false;
        },
        reason,
      });
    } else window.SiteUtils?.lockScroll?.(`overlay:${OWNER}`);
  }
}

function initializeAnchor(anchor) {
  if (!(anchor instanceof Element) || anchor.dataset.gbTooltipReady === '1') return;
  const controller = controllerFor(anchor);
  const tip = prepareTip(inlineTip(anchor));
  if (!controller || !tip) return;
  anchor.dataset.gbTooltipReady = '1';
  anchor.setAttribute('aria-expanded', 'false');
  if (!anchor.hasAttribute('tabindex') && !anchor.matches('button, a[href], input, select, textarea')) anchor.tabIndex = 0;
  if (!anchor.hasAttribute('role') && !anchor.matches('button, a[href]')) anchor.setAttribute('role', 'button');

  const openHover = (event) => {
    if (event.pointerType === 'touch' || mobileViewport()) return;
    openController(controller, anchor, 'hover');
  };
  const leaveHover = (event) => {
    if (event.pointerType === 'touch' || mobileViewport()) return;
    if (containsOwnedSurface(controller, event.relatedTarget)) {
      cancelClose();
      return;
    }
    scheduleClose(controller);
  };
  anchor.addEventListener('pointerenter', openHover);
  anchor.addEventListener('mouseenter', openHover);
  anchor.addEventListener('pointerleave', leaveHover);
  anchor.addEventListener('mouseleave', leaveHover);
  anchor.addEventListener('focus', () => openController(controller, anchor, 'focus'));
  anchor.addEventListener('blur', () => scheduleClose(controller, 120));
  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    cancelClose();
    if (controller.activeEl !== anchor) {
      openController(controller, anchor, 'click');
      return;
    }
    if (controller._gbState?.reason === 'click') closeController(controller, 'toggle');
    else {
      controller._gbState.reason = 'click';
      controller._gbState.pointerBaseline = pointerEpoch;
    }
  });
  anchor.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    cancelClose();
    if (controller.activeEl === anchor && controller._gbState?.reason === 'keyboard') closeController(controller, 'toggle');
    else openController(controller, anchor, 'keyboard');
  });
}

function resetTouchState() {
  touchStart = null;
  touchMoved = false;
}

function touchPoint(event, listName) {
  const touch = event[listName]?.[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

function touchTarget(event) {
  if (event.target instanceof Element) return event.target;
  const point = touchPoint(event, 'changedTouches');
  if (point && document.elementFromPoint) return document.elementFromPoint(point.x, point.y);
  return null;
}

export function initGlossaryTooltips(scope = document) {
  const root = scope?.querySelectorAll ? scope : document;
  root.querySelectorAll('.gterm').forEach(initializeAnchor);
}

export function initInlineTooltips(scope = document) {
  const root = scope?.querySelectorAll ? scope : document;
  root.querySelectorAll(SELECTOR).forEach(initializeAnchor);
}

export function installArticleTooltips() {
  if (window.GBArticleTooltips?.version === VERSION) return window.GBArticleTooltips;
  const api = installSharedRegistry();
  api.initGlossaryTooltips = initGlossaryTooltips;
  initInlineTooltips(document);
  document.addEventListener('gb:quiz-rendered', (event) => initInlineTooltips(event.detail?.root || document));
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || !recordPointerMovement(event)) return;
    const controller = activeController();
    if (!controller || controller._gbState?.mobileSheet || controller._gbState?.reason !== 'hover') return;
    if (containsOwnedSurface(controller, event.target)) cancelClose();
    else scheduleClose(controller);
  }, true);
  window.addEventListener('touchstart', (event) => {
    touchStart = touchPoint(event, 'touches');
    touchMoved = false;
  }, { capture: true, passive: true });
  window.addEventListener('touchmove', (event) => {
    const point = touchPoint(event, 'touches');
    if (!touchStart || !point) {
      touchMoved = true;
      return;
    }
    const dx = point.x - touchStart.x;
    const dy = point.y - touchStart.y;
    if (dx * dx + dy * dy > TOUCH_SLOP_SQUARED) touchMoved = true;
  }, { capture: true, passive: true });
  window.addEventListener('touchend', (event) => {
    const controller = activeController();
    const moved = touchMoved;
    const target = touchTarget(event);
    resetTouchState();
    if (!controller || moved || !(target instanceof Element)) return;
    const close = target.closest('[data-tooltip-close]');
    if (close && controller.activeTip.contains(close)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      controller.close(true, 'control-touchend');
      return;
    }
    if (!controller.activeTip.contains(target)) return;
    const interactive = target.closest(INTERACTIVE);
    if (interactive && controller.activeTip.contains(interactive)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    controller.close(true, 'surface-touchend');
  }, { capture: true, passive: false });
  document.addEventListener('pointerdown', (event) => {
    const controller = activeController();
    if (!controller || containsOwnedSurface(controller, event.target)) return;
    controller.close(true, 'outside');
  }, true);
  document.addEventListener('keydown', (event) => {
    const controller = activeController();
    if (event.key === 'Escape' && controller) {
      event.preventDefault();
      controller.close(false, 'escape');
    }
  }, true);
  window.addEventListener('resize', () => {
    const controller = activeController();
    if (controller) position(controller);
  }, { passive: true });
  window.addEventListener('scroll', () => {
    const controller = activeController();
    if (!controller || controller._gbState?.mobileSheet) return;
    if (!controller.activeEl.isConnected) controller.close(true, 'detached');
    else position(controller);
  }, { passive: true, capture: true });
  window.GBArticleTooltips = Object.freeze({
    version: VERSION,
    init: initInlineTooltips,
    close: closeTooltip,
    snapshot: () => {
      const controller = activeController();
      return controller ? {
        anchorSel: controller.anchorSel,
        tipSel: controller.tipSel,
        active: true,
        mobileSheet: Boolean(controller._gbState?.mobileSheet),
      } : { active: false };
    },
  });
  return window.GBArticleTooltips;
}
