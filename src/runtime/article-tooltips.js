const VERSION = 14;
const OWNER = 'article-inline-tooltip';
const SELECTOR = '.gterm, .fn-marker, .bref[data-ref]';
const OWNED_LEGACY_SELECTORS = new Set(['.gterm', '.fn-marker', '.bref[data-ref]']);
const HOVER_TRANSIT_MS = 520;
const HOVER_TRANSIT_PADDING = 12;
const VIEWPORT_MARGIN = 16;
const TIP_GAP = 10;

let active = null;
let closeTimer = 0;
let pointerEpoch = 0;
let pointerX = null;
let pointerY = null;

function overlayRuntime() {
  return window.OverlayRuntime || window.SiteUtils?.OverlayRuntime || null;
}

function mobileMode() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function cancelClose() {
  if (closeTimer) window.clearTimeout(closeTimer);
  closeTimer = 0;
}

function containsInteractive(record, target) {
  return Boolean(record && target instanceof Node && (record.anchor.contains(target) || record.tip.contains(target)));
}

function containsPoint(element, x, y) {
  if (!(element instanceof Element) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const rect = element.getBoundingClientRect();
  const epsilon = 1;
  return rect.width > 0 && rect.height > 0 &&
    x >= rect.left - epsilon && x <= rect.right + epsilon &&
    y >= rect.top - epsilon && y <= rect.bottom + epsilon;
}

function pointerInside(record, x = pointerX, y = pointerY) {
  return Boolean(record && (containsPoint(record.anchor, x, y) || containsPoint(record.tip, x, y)));
}

function pointerInHoverTransit(record, x = pointerX, y = pointerY) {
  if (!record || record.reason !== 'hover' || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const remaining = Number(record.hoverTransitUntil || 0) - window.performance.now();
  if (remaining <= 0) return false;
  const anchorRect = record.anchor.getBoundingClientRect();
  const tipRect = record.tip.getBoundingClientRect();
  if (anchorRect.width <= 0 || anchorRect.height <= 0 || tipRect.width <= 0 || tipRect.height <= 0) return false;
  const left = Math.min(anchorRect.left, tipRect.left) - HOVER_TRANSIT_PADDING;
  const top = Math.min(anchorRect.top, tipRect.top) - HOVER_TRANSIT_PADDING;
  const right = Math.max(anchorRect.right, tipRect.right) + HOVER_TRANSIT_PADDING;
  const bottom = Math.max(anchorRect.bottom, tipRect.bottom) + HOVER_TRANSIT_PADDING;
  return x >= left && x <= right && y >= top && y <= bottom;
}

function currentPointerTarget() {
  if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) return null;
  return document.elementFromPoint(pointerX, pointerY);
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

function settleHover(record) {
  window.requestAnimationFrame(() => {
    if (active !== record || record.reason !== 'hover') return;
    record.hoverSettled = true;
    record.pointerBaseline = pointerEpoch;
  });
}

function beginHoverTransit(record) {
  if (!record || record.reason !== 'hover') return;
  record.hoverTransitUntil = window.performance.now() + HOVER_TRANSIT_MS;
}

function scheduleClose(delay = 220) {
  cancelClose();
  const record = active;
  if (!record) return;
  closeTimer = window.setTimeout(() => {
    closeTimer = 0;
    if (active !== record) return;
    const focused = document.activeElement;
    if (focused === record.anchor || record.tip.contains(focused)) return;
    if (containsInteractive(record, currentPointerTarget()) || pointerInside(record)) return;
    if (record.anchor.matches(':hover') || record.tip.matches(':hover')) return;
    if (pointerInHoverTransit(record)) {
      const remaining = Math.max(1, Math.ceil(record.hoverTransitUntil - window.performance.now()));
      scheduleClose(Math.min(90, remaining));
      return;
    }
    if (record.reason === 'hover' && (!record.hoverSettled || pointerEpoch === record.pointerBaseline)) return;
    closeTooltip('leave');
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

function inlineTip(anchor) {
  if (anchor.matches('.gterm')) return anchor.querySelector('.gtip');
  if (anchor.matches('.fn-marker')) return anchor.querySelector('.tooltip');
  if (anchor.matches('.bref[data-ref]')) return anchor.querySelector('.btip') || createScriptureTip(anchor);
  return null;
}

function setGlossaryExpanded(tip, frame, expand, detail, expanded) {
  expand.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  expand.setAttribute('aria-label', expanded ? 'Кратко' : 'Подробнее');
  tip.classList.toggle('gtip--expanded', expanded);
  frame.classList.remove('is-expanded');
  const text = expand.querySelector('.gtip-expand-txt');
  if (text) text.textContent = expanded ? 'Кратко' : 'Подробнее';
  if (detail) detail.setAttribute('aria-hidden', expanded ? 'false' : 'true');
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
  setGlossaryExpanded(tip, frame, expand, detail, expand.getAttribute('aria-expanded') === 'true');
  expand.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const expanded = expand.getAttribute('aria-expanded') !== 'true';
    setGlossaryExpanded(tip, frame, expand, detail, expanded);
    if (active?.tip === tip) {
      window.requestAnimationFrame(() => {
        if (active?.tip === tip) position(tip, active.anchor);
      });
    }
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
  for (const property of ['left', 'top', 'right', 'bottom', 'max-height', 'overflow-y']) {
    tip.style.removeProperty(property);
  }
  tip.removeAttribute('data-placement');
}

function applyOverflow(tip, maxHeight) {
  if (!Number.isFinite(maxHeight) || maxHeight <= 0) return;
  setImportant(tip.style, 'max-height', `${Math.floor(maxHeight)}px`);
  const needsScroll = tip.scrollHeight > Math.floor(maxHeight) + 1;
  setImportant(tip.style, 'overflow-y', needsScroll ? 'auto' : 'visible');
}

function positionMobile(tip) {
  clearAuthoritativeGeometry(tip);
  setImportant(tip.style, 'left', '0px');
  setImportant(tip.style, 'right', '0px');
  setImportant(tip.style, 'top', 'auto');
  setImportant(tip.style, 'bottom', '0px');
  applyOverflow(tip, Math.max(180, Math.floor(window.innerHeight * 0.72)));
}

function positionDesktop(tip, anchor) {
  clearAuthoritativeGeometry(tip);
  setImportant(tip.style, 'position', 'fixed');
  setImportant(tip.style, 'right', 'auto');
  setImportant(tip.style, 'bottom', 'auto');
  setImportant(tip.style, 'overflow-y', 'visible');

  const anchorRect = anchor.getBoundingClientRect();
  let tipRect = tip.getBoundingClientRect();
  const width = Math.min(tipRect.width, Math.max(0, window.innerWidth - VIEWPORT_MARGIN * 2));
  let left = anchorRect.left + anchorRect.width / 2 - width / 2;
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - VIEWPORT_MARGIN - width));

  const availableAbove = Math.max(0, anchorRect.top - VIEWPORT_MARGIN - TIP_GAP);
  const availableBelow = Math.max(0, window.innerHeight - VIEWPORT_MARGIN - anchorRect.bottom - TIP_GAP);
  const naturalHeight = tip.scrollHeight || tipRect.height;
  let placement = 'top';
  let top;

  if (naturalHeight <= availableAbove) {
    top = anchorRect.top - naturalHeight - TIP_GAP;
  } else if (naturalHeight <= availableBelow) {
    placement = 'bottom';
    top = anchorRect.bottom + TIP_GAP;
  } else {
    placement = availableAbove >= availableBelow ? 'top' : 'bottom';
    const available = Math.max(160, placement === 'top' ? availableAbove : availableBelow);
    applyOverflow(tip, Math.min(available, window.innerHeight - VIEWPORT_MARGIN * 2));
    tipRect = tip.getBoundingClientRect();
    const constrainedHeight = Math.min(tipRect.height, window.innerHeight - VIEWPORT_MARGIN * 2);
    top = placement === 'top'
      ? anchorRect.top - constrainedHeight - TIP_GAP
      : anchorRect.bottom + TIP_GAP;
  }

  top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - VIEWPORT_MARGIN - tip.getBoundingClientRect().height));
  tip.dataset.placement = placement;
  setImportant(tip.style, 'left', `${Math.round(left)}px`);
  setImportant(tip.style, 'top', `${Math.round(top)}px`);
  tip.style.setProperty('--gb-tip-arrow-x', `${Math.round(anchorRect.left + anchorRect.width / 2 - left)}px`);
}

function position(tip, anchor) {
  if (mobileMode()) positionMobile(tip);
  else positionDesktop(tip, anchor);
}

function restore(record) {
  const { tip, placeholder } = record;
  tip.classList.remove('gb-floating-tip', 'is-open');
  clearAuthoritativeGeometry(tip);
  tip.style.removeProperty('position');
  tip.style.removeProperty('pointer-events');
  tip.style.removeProperty('--gb-tip-arrow-x');
  if (placeholder?.parentNode) {
    placeholder.parentNode.insertBefore(tip, placeholder);
    placeholder.remove();
  }
}

export function closeTooltip(reason = 'close') {
  cancelClose();
  const record = active;
  if (!record) return;
  active = null;
  record.anchor.classList.remove('is-open');
  record.anchor.setAttribute('aria-expanded', 'false');
  if (record.mobile) {
    if (overlayRuntime()) overlayRuntime().close(OWNER, reason);
    else window.SiteUtils?.unlockScroll?.(`overlay:${OWNER}`);
  }
  restore(record);
}

function openTooltip(anchor, reason = 'open') {
  if (reason === 'hover' && active && active.anchor !== anchor && active.reason !== 'hover'
    && pointerEpoch === active.pointerBaseline) return;
  cancelClose();
  const tip = prepareTip(inlineTip(anchor));
  if (!tip) return;
  if (active?.anchor === anchor) {
    active.reason = reason;
    active.pointerBaseline = pointerEpoch;
    active.hoverTransitUntil = 0;
    if (reason === 'hover') {
      active.hoverSettled = false;
      settleHover(active);
    }
    setImportant(tip.style, 'pointer-events', 'auto');
    position(tip, anchor);
    return;
  }
  closeTooltip('replace');
  cancelClose();

  const placeholder = document.createComment('gb-inline-tooltip');
  tip.parentNode?.insertBefore(placeholder, tip);
  document.body.appendChild(tip);
  tip.classList.add('gb-floating-tip', 'is-open');
  setImportant(tip.style, 'pointer-events', 'auto');
  anchor.classList.add('is-open');
  anchor.setAttribute('aria-expanded', 'true');

  active = {
    anchor,
    tip,
    placeholder,
    mobile: mobileMode(),
    reason,
    hoverSettled: reason !== 'hover',
    pointerBaseline: pointerEpoch,
    hoverTransitUntil: 0,
  };
  position(tip, anchor);
  window.requestAnimationFrame(() => {
    if (active?.tip === tip) position(tip, anchor);
  });
  if (reason === 'hover') settleHover(active);

  if (tip.dataset.gbInteractionBound !== '1') {
    tip.dataset.gbInteractionBound = '1';
    tip.addEventListener('pointerenter', () => {
      if (active?.tip === tip) active.hoverTransitUntil = 0;
      cancelClose();
    });
    tip.addEventListener('mouseenter', () => {
      if (active?.tip === tip) active.hoverTransitUntil = 0;
      cancelClose();
    });
    tip.addEventListener('pointerleave', () => scheduleClose());
    tip.addEventListener('mouseleave', () => scheduleClose());
    tip.addEventListener('click', (event) => event.stopPropagation());
  }

  if (active.mobile) {
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
          closeTooltip(closeReason || 'request');
          return false;
        },
        reason,
      });
    } else window.SiteUtils?.lockScroll?.(`overlay:${OWNER}`);
  }
}

function initializeAnchor(anchor) {
  if (!(anchor instanceof Element) || anchor.dataset.gbTooltipReady === '1') return;
  const tip = prepareTip(inlineTip(anchor));
  if (!tip) return;
  anchor.dataset.gbTooltipReady = '1';
  anchor.setAttribute('aria-expanded', 'false');
  if (!anchor.hasAttribute('tabindex') && !anchor.matches('button, a[href], input, select, textarea')) anchor.tabIndex = 0;
  if (!anchor.hasAttribute('role') && !anchor.matches('button, a[href]')) anchor.setAttribute('role', 'button');

  const openHover = (event) => {
    if (event.pointerType === 'touch' || mobileMode()) return;
    openTooltip(anchor, 'hover');
  };
  const leaveHover = (event) => {
    if (event.pointerType === 'touch' || mobileMode()) return;
    if (containsInteractive(active, event.relatedTarget)) {
      cancelClose();
      return;
    }
    if (active?.anchor === anchor) beginHoverTransit(active);
    scheduleClose();
  };

  anchor.addEventListener('pointerenter', openHover);
  anchor.addEventListener('mouseenter', openHover);
  anchor.addEventListener('pointerleave', leaveHover);
  anchor.addEventListener('mouseleave', leaveHover);
  anchor.addEventListener('focus', () => openTooltip(anchor, 'focus'));
  anchor.addEventListener('blur', () => scheduleClose(120));
  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    cancelClose();
    if (active?.anchor !== anchor) {
      openTooltip(anchor, 'click');
      return;
    }
    if (active.reason === 'click') closeTooltip('toggle');
    else {
      active.reason = 'click';
      active.pointerBaseline = pointerEpoch;
      active.hoverTransitUntil = 0;
    }
  });
  anchor.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    cancelClose();
    if (active?.anchor === anchor && active.reason === 'keyboard') closeTooltip('toggle');
    else openTooltip(anchor, 'keyboard');
  });
}

function retireLegacyTooltipOwners() {
  const siteUtils = window.SiteUtils;
  const controllers = siteUtils?._tooltipControllers;
  if (!Array.isArray(controllers)) return;
  const retained = [];
  for (const controller of controllers) {
    if (OWNED_LEGACY_SELECTORS.has(controller?.anchorSel)) {
      controller.close?.(true);
      continue;
    }
    retained.push(controller);
  }
  if (retained.length !== controllers.length) siteUtils._tooltipControllers = retained;
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
  retireLegacyTooltipOwners();
  window.SiteUtils = window.SiteUtils || {};
  window.SiteUtils.initGlossaryTooltips = initGlossaryTooltips;
  initInlineTooltips(document);
  document.addEventListener('gb:quiz-rendered', (event) => initInlineTooltips(event.detail?.root || document));
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || !recordPointerMovement(event)) return;
    if (!active || active.mobile || active.reason !== 'hover') return;
    if (containsInteractive(active, event.target) || pointerInside(active, event.clientX, event.clientY)) cancelClose();
    else scheduleClose();
  }, true);
  document.addEventListener('pointerdown', (event) => {
    if (!active) return;
    if (containsInteractive(active, event.target)) return;
    closeTooltip('outside');
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && active && !active.mobile) closeTooltip('escape');
  }, true);
  window.addEventListener('resize', () => active && position(active.tip, active.anchor), { passive: true });
  window.addEventListener('scroll', () => {
    if (!active || active.mobile) return;
    if (!active.anchor.isConnected) closeTooltip('detached');
    else position(active.tip, active.anchor);
  }, { passive: true, capture: true });
  window.GBArticleTooltips = Object.freeze({ version: VERSION, init: initInlineTooltips, close: closeTooltip });
  return window.GBArticleTooltips;
}
