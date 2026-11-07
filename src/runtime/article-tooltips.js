const VERSION = 20;
const OWNER = 'article-inline-tooltip';
const SELECTOR = '.gterm, .fn-marker, .bref[data-ref]';
const OWNED_LEGACY_SELECTORS = new Set(['.gterm', '.fn-marker', '.bref[data-ref]']);
const HOVER_TRANSIT_MS = 520;
const HOVER_TRANSIT_PADDING = 12;
const VIEWPORT_MARGIN = 16;
const TIP_GAP = 10;
const MIN_SCROLL_HEIGHT = 96;
const MOBILE_MAX_VIEWPORT_RATIO = 0.85;

let active = null;
let closeTimer = 0;
let pointerEpoch = 0;
let pointerX = null;
let pointerY = null;
// Generated Scripture cards live beside their trigger until portaled to body;
// never nest a navigable <a> inside the <button.bref>.
const scriptureTips = new WeakMap();

function overlayRuntime() {
  return window.OverlayRuntime || window.SiteUtils?.OverlayRuntime || null;
}

function mobileMode() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function viewportBounds() {
  const visual = window.visualViewport;
  const left = Number(visual?.offsetLeft) || 0;
  const top = Number(visual?.offsetTop) || 0;
  const width = Number(visual?.width) || document.documentElement.clientWidth || window.innerWidth;
  const height = Number(visual?.height) || window.innerHeight;
  return { left, top, width, height, right: left + width, bottom: top + height };
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

// Reference-only fallback: a real external passage, not a dead placeholder.
 // The displayed site's corpus may be held under a publication-rights gate.
 // Link to a separate Russian Synodal edition; NEVER copy a held translation.
function scriptureExternalUrl(reference) {
  const value = String(reference || '').replace(/\u00a0/g, ' ').replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s+/g, ' ').trim();
  const match = value.match(/^([1-4]?\s*[А-ЯЁа-яё.\s-]+?)\s+(\d{1,3})(?::(\d{1,3}[а-яa-z]?)(?:-(\d{1,3}[а-яa-z]?))?)?$/iu);
  if (!match || value.length > 100) return '';
  const chapter = Number(match[2]), first = match[3] ? Number.parseInt(match[3], 10) : 0;
  const last = match[4] ? Number.parseInt(match[4], 10) : 0;
  if (chapter < 1 || chapter > 150 || first > 176 || (match[3] && first < 1) ||
      last > 176 || (match[4] && (last < first || last < 1))) return '';
  const book = match[1].trim().replace(/\.+$/,'');
  const aliases = {
    'Луки':'От Луки','Лк':'От Луки','Матфея':'От Матфея','Мф':'От Матфея',
    'Марка':'От Марка','Мк':'От Марка','Иоанна':'От Иоанна','Ин':'От Иоанна',
    'Ефесянам':'К Ефесянам','Еф':'К Ефесянам',
  };
  const title = aliases[book] || book;
  const verse = match[3] ? ':' + first + (match[4] ? '-' + last : '') : '';
  const url = new URL('https://www.biblegateway.com/passage/');
  url.searchParams.set('search', title + ' ' + match[2] + verse);
  url.searchParams.set('version', 'RUSV');
  return url.href;
}

function createScriptureTip(anchor) {
  const reference = String(anchor.dataset.ref || anchor.textContent || '').trim();
  const permittedText = configuredScripture(reference);
  const externalUrl = scriptureExternalUrl(reference);
  const tip = document.createElement('span');
  tip.className = 'btip';
  tip.dataset.generatedScriptureTip = '1';
  const label = document.createElement('strong');
  label.className = 'btip__reference';
  label.textContent = reference;
  const body = document.createElement('span');
  body.className = 'btip__text';
  body.textContent = permittedText || (externalUrl
    ? 'Текст этого перевода на сайте не опубликован.'
    : 'Ссылка на указанное место Священного Писания.');
  tip.append(label, document.createTextNode(' '), body);
  if (externalUrl) {
    // Navigable content is a non-modal dialog, not a tooltip role with a
    // focusable child. The opener remains the single keyboard entry point.
    tip.setAttribute('role', 'dialog');
    tip.setAttribute('aria-label', 'Место Писания: ' + reference);
    const link = document.createElement('a');
    link.className = 'btip__external';
    link.href = externalUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Открыть в Библии · Синодальный перевод ↗';
    tip.appendChild(link);
  }
  anchor.insertAdjacentElement('afterend', tip);
  scriptureTips.set(anchor, tip);
  return tip;
}

let tipIdSeq = 0;
function nextTipId() {
  tipIdSeq += 1;
  const id = `gb-tip-${tipIdSeq}`;
  return document.getElementById(id) ? nextTipId() : id;
}

function inlineTip(anchor) {
  if (anchor.matches('.gterm')) return anchor.querySelector('.gtip');
  if (anchor.matches('.fn-marker')) return anchor.querySelector('.tooltip');
  if (anchor.matches('.bref[data-ref]')) return anchor.querySelector('.btip') || scriptureTips.get(anchor) || createScriptureTip(anchor);
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

function resetGlossaryTip(tip) {
  if (!tip?.classList.contains('gtip')) return;
  const frame = tip.querySelector(':scope > .gtip-luxury');
  const expand = frame?.querySelector('[data-gtip-expand]');
  const detail = frame?.querySelector('.gtip-detail-wrap');
  if (frame && expand) setGlossaryExpanded(tip, frame, expand, detail, false);
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
  tip.dataset.luxury = 'true';
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
    if (active?.tip === tip) scheduleGeometry(active, true);
  });
}

/* GBS-FOOTNOTE-RICH-TOOLTIP-FOCUS-MODEL: rich popups (payloads retaining
   source links) get a deliberate focus contract — Tab from the opener
   enters the popup, Shift+Tab from its first control returns to the
   opener, Escape/outside-focus close restores the opener exactly, and a
   locked mobile sheet never leaves focus on body. */
let escapeSuppress = null;
let mobileDismissedAnchor = null;
let mobileDismissedUntil = 0;
const TIP_FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function tipFocusables(tip) {
  if (!tip) return [];
  return Array.from(tip.querySelectorAll(TIP_FOCUSABLE))
    .filter((el) => !el.disabled && !el.hasAttribute('inert') && !el.closest('[inert]'));
}

function setTipInert(tip, inert) {
  if (!tip) return;
  if (inert) tip.setAttribute('inert', '');
  else tip.removeAttribute('inert');
}

function prepareTip(tip) {
  prepareGlossaryTip(tip);
  // A closed tip is a hidden panel: its links/buttons must not stay in the tab
  // order, otherwise its focusable descendants sit inside the marker's own
  // focusable control (axe nested-interactive). Open tips are un-inert below.
  setTipInert(tip, true);
  return tip;
}

function setImportant(style, property, value) {
  style.setProperty(property, value, 'important');
}

function clearPositionGeometry(tip) {
  for (const property of ['left', 'top', 'right', 'bottom']) tip.style.removeProperty(property);
}

function clearSizeGeometry(tip) {
  for (const property of ['max-height', 'overflow-y']) tip.style.removeProperty(property);
}

function clearAuthoritativeGeometry(tip) {
  clearPositionGeometry(tip);
  clearSizeGeometry(tip);
  tip.removeAttribute('data-placement');
}

function applyOverflow(tip, maxHeight) {
  if (!Number.isFinite(maxHeight) || maxHeight <= 0) return false;
  const height = Math.max(1, Math.floor(maxHeight));
  setImportant(tip.style, 'max-height', `${height}px`);
  const needsScroll = tip.scrollHeight > height + 1;
  setImportant(tip.style, 'overflow-y', needsScroll ? 'auto' : 'visible');
  return needsScroll;
}

function mobileSheetBudget(viewport) {
  const ratioBudget = Math.floor(viewport.height * MOBILE_MAX_VIEWPORT_RATIO);
  const visualBudget = Math.floor(viewport.height - VIEWPORT_MARGIN);
  return Math.max(MIN_SCROLL_HEIGHT, Math.min(ratioBudget, visualBudget));
}

function positionMobile(tip) {
  const viewport = viewportBounds();
  clearAuthoritativeGeometry(tip);
  setImportant(tip.style, 'left', '0px');
  setImportant(tip.style, 'right', '0px');
  setImportant(tip.style, 'top', 'auto');
  setImportant(tip.style, 'bottom', '0px');
  applyOverflow(tip, mobileSheetBudget(viewport));
}

function preferredPlacement(naturalHeight, availableAbove, availableBelow, previousPlacement, preservePlacement) {
  const fitsAbove = naturalHeight <= availableAbove;
  const fitsBelow = naturalHeight <= availableBelow;
  if (preservePlacement && previousPlacement === 'top' && fitsAbove) return 'top';
  if (preservePlacement && previousPlacement === 'bottom' && fitsBelow) return 'bottom';
  if (fitsAbove && fitsBelow) return previousPlacement === 'bottom' ? 'bottom' : 'top';
  if (fitsAbove) return 'top';
  if (fitsBelow) return 'bottom';
  return availableAbove >= availableBelow ? 'top' : 'bottom';
}

function positionDesktop(tip, anchor, preservePlacement = false) {
  const previousPlacement = tip.dataset.placement || '';
  const viewport = viewportBounds();
  clearPositionGeometry(tip);
  clearSizeGeometry(tip);
  setImportant(tip.style, 'position', 'fixed');
  setImportant(tip.style, 'right', 'auto');
  setImportant(tip.style, 'bottom', 'auto');

  const anchorRect = anchor.getBoundingClientRect();
  let tipRect = tip.getBoundingClientRect();
  const width = Math.min(tipRect.width, Math.max(0, viewport.width - VIEWPORT_MARGIN * 2));
  let left = anchorRect.left + anchorRect.width / 2 - width / 2;
  left = Math.max(viewport.left + VIEWPORT_MARGIN, Math.min(left, viewport.right - VIEWPORT_MARGIN - width));

  const viewportMax = Math.max(MIN_SCROLL_HEIGHT, viewport.height - VIEWPORT_MARGIN * 2);
  const availableAbove = Math.max(0, anchorRect.top - viewport.top - VIEWPORT_MARGIN - TIP_GAP);
  const availableBelow = Math.max(0, viewport.bottom - VIEWPORT_MARGIN - anchorRect.bottom - TIP_GAP);
  const naturalHeight = Math.max(tip.scrollHeight || 0, tipRect.height || 0);
  const placement = preferredPlacement(naturalHeight, availableAbove, availableBelow, previousPlacement, preservePlacement);
  const available = placement === 'top' ? availableAbove : availableBelow;

  if (naturalHeight > available) applyOverflow(tip, Math.min(available, viewportMax));
  else setImportant(tip.style, 'overflow-y', 'visible');

  tipRect = tip.getBoundingClientRect();
  const renderedHeight = Math.min(tipRect.height, viewportMax);
  let top = placement === 'top'
    ? anchorRect.top - renderedHeight - TIP_GAP
    : anchorRect.bottom + TIP_GAP;
  top = Math.max(viewport.top + VIEWPORT_MARGIN, Math.min(top, viewport.bottom - VIEWPORT_MARGIN - renderedHeight));

  tip.dataset.placement = placement;
  setImportant(tip.style, 'left', `${Math.round(left)}px`);
  setImportant(tip.style, 'top', `${Math.round(top)}px`);
  tip.style.setProperty('--gb-tip-arrow-x', `${Math.round(anchorRect.left + anchorRect.width / 2 - left)}px`);
}

function position(tip, anchor, preservePlacement = false) {
  if (mobileMode()) positionMobile(tip);
  else positionDesktop(tip, anchor, preservePlacement);
}

function stopGeometry(record) {
  if (!record) return;
  if (record.geometryFrame) window.cancelAnimationFrame(record.geometryFrame);
  record.geometryFrame = 0;
  record.geometryObserver?.disconnect();
  record.geometryObserver = null;
}

function scheduleGeometry(record, preservePlacement = true) {
  if (!record || active !== record || record.mobile || record.geometryFrame) return;
  record.geometryFrame = window.requestAnimationFrame(() => {
    record.geometryFrame = 0;
    if (active !== record || !record.anchor.isConnected || !record.tip.isConnected) return;
    position(record.tip, record.anchor, preservePlacement);
  });
}

function observeGeometry(record) {
  if (!record || record.mobile || typeof ResizeObserver !== 'function') return;
  record.geometryObserver = new ResizeObserver(() => scheduleGeometry(record, true));
  record.geometryObserver.observe(record.tip);
}

function restore(record) {
  const { tip, placeholder } = record;
  stopGeometry(record);
  resetGlossaryTip(tip);
  setTipInert(tip, true);
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
  // A closed tip is inert — drop the relation so AT never resolves a
  // describedby reference into an excluded subtree.
  record.anchor.removeAttribute('aria-describedby');
  if (record.mobile) {
    // OverlayRuntime restores focus to the reference opener on mobile.
    // Without suppressing that restoration, its focus listener re-opens
    // the sheet immediately after Escape or an outside tap.
    const opener = record.anchor;
    // SiteUtils may retry focus restoration for up to eight 60ms ticks.
    // A one-shot focus suppression is insufficient and causes ghost reopen.
    mobileDismissedAnchor = opener;
    mobileDismissedUntil = window.performance.now() + 650;
    escapeSuppress = opener;
    if (overlayRuntime()) overlayRuntime().close(OWNER, reason);
    else window.SiteUtils?.unlockScroll?.(`overlay:${OWNER}`);
    window.setTimeout(() => { if (escapeSuppress === opener) escapeSuppress = null; }, 250);
  }
  restore(record);
}

function openTooltip(anchor, reason = 'open') {
  if ((reason === 'focus' || reason === 'hover') && anchor === mobileDismissedAnchor &&
      window.performance.now() < mobileDismissedUntil) return;
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
    setTipInert(tip, false);
    position(tip, anchor, true);
    return;
  }
  closeTooltip('replace');
  cancelClose();

  const placeholder = document.createComment('gb-inline-tooltip');
  tip.parentNode?.insertBefore(placeholder, tip);
  document.body.appendChild(tip);
  tip.classList.add('gb-floating-tip', 'is-open');
  setTipInert(tip, false);
  setImportant(tip.style, 'pointer-events', 'auto');
  anchor.classList.add('is-open');
  anchor.setAttribute('aria-expanded', 'true');
  // GBS-INLINE-TOOLTIP-DEFINITION-ASSOCIATION: the opened definition must be
  // exposed to AT as the trigger's description — the tip gets a stable id and
  // tooltip role, and the anchor points at it via aria-describedby while open.
  if (!tip.getAttribute('role')) tip.setAttribute('role', 'tooltip');
  if (!tip.id) tip.id = nextTipId();
  anchor.setAttribute('aria-describedby', tip.id);

  active = {
    anchor,
    tip,
    placeholder,
    mobile: mobileMode(),
    reason,
    hoverSettled: reason !== 'hover',
    pointerBaseline: pointerEpoch,
    hoverTransitUntil: 0,
    geometryFrame: 0,
    geometryObserver: null,
  };
  position(tip, anchor);
  observeGeometry(active);
  scheduleGeometry(active, true);
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
    // Mobile scroll locking fixes <body> and offsets it by the prior scrollY.
    // WebKit can retain the pre-lock geometry for one frame, displaying the
    // popup thousands of pixels below the viewport in long articles.
    // Reposition after the lock mutation, before the next paint.
    if (active?.tip === tip) positionMobile(tip);
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
  anchor.addEventListener('focus', () => {
    // An Escape close that restored focus to this opener must not be
    // undone by the focus-open listener (popup contract: Escape wins).
    if (escapeSuppress === anchor) { escapeSuppress = null; return; }
    // A mobile second tap refocuses the opener from the portal link before
    // the click. Do not overwrite the existing click reason or it won't close.
    if (active?.anchor === anchor) { cancelClose(); return; }
    openTooltip(anchor, 'focus');
  });
  anchor.addEventListener('blur', (event) => {
    // Focus travelling into our own open popup is not abandonment.
    if (active?.anchor === anchor && event.relatedTarget && active.tip.contains(event.relatedTarget)) {
      cancelClose();
      return;
    }
    scheduleClose(120);
  });
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
    if (event.key === 'Tab' && !event.shiftKey && active?.anchor === anchor) {
      const first = tipFocusables(active.tip)[0];
      if (first) {
        event.preventDefault();
        cancelClose();
        first.focus();
        return;
      }
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    cancelClose();
    if (active?.anchor === anchor && active.reason === 'keyboard') closeTooltip('toggle');
    else openTooltip(anchor, 'keyboard');
  });
}

function clearLegacyControllerTimers(controller) {
  for (const key of ['_hoverTimer', '_stickyT', 'hoverTimer', 'stickyTimer']) {
    const timer = Number(controller?.[key] || 0);
    if (timer) window.clearTimeout(timer);
  }
}

function retireLegacyTooltipOwners() {
  const controllers = window.SiteUtils?._tooltipControllers;
  if (!Array.isArray(controllers)) return;
  for (let index = controllers.length - 1; index >= 0; index -= 1) {
    const controller = controllers[index];
    if (!OWNED_LEGACY_SELECTORS.has(controller?.anchorSel)) continue;
    clearLegacyControllerTimers(controller);
    controller.close?.(true);
    controllers.splice(index, 1);
  }
}

function claimOwner() {
  document.documentElement.dataset.gbArticleTooltipsOwner = OWNER;
  document.documentElement.dataset.gbArticleTooltipsVersion = String(VERSION);
}

function handleViewportChange() {
  if (!active) return;
  if (active.mobile !== mobileMode()) {
    closeTooltip('mode-change');
    return;
  }
  position(active.tip, active.anchor, true);
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
  if (window.GBArticleTooltips?.version === VERSION) {
    claimOwner();
    return window.GBArticleTooltips;
  }
  window.SiteUtils = window.SiteUtils || {};
  claimOwner();
  retireLegacyTooltipOwners();
  if (document.readyState === 'complete') retireLegacyTooltipOwners();
  else window.addEventListener('load', retireLegacyTooltipOwners, { once: true });
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
    if (event.key === 'Escape' && active && !active.mobile) {
      const opener = active.anchor;
      const hadFocusInside = active.tip.contains(document.activeElement);
      closeTooltip('escape');
      if (hadFocusInside && opener && opener.isConnected) {
        escapeSuppress = opener;
        opener.focus();
        window.setTimeout(() => { if (escapeSuppress === opener) escapeSuppress = null; }, 0);
      }
      return;
    }
    if (event.key !== 'Tab' || !active) return;
    const tip = active.tip;
    if (!tip.contains(document.activeElement)) return;
    const items = tipFocusables(tip);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      cancelClose();
      active.anchor.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      // Locked mobile sheet: cycle inside the popup so focus never lands
      // on body. Desktop: let Tab continue naturally; focusout closes.
      if (active.mobile) {
        event.preventDefault();
        first.focus();
      }
    }
  }, true);
  document.addEventListener('focusin', (event) => {
    if (!active) return;
    if (active.tip.contains(event.target) || event.target === active.anchor) {
      cancelClose();
      return;
    }
    if (active.reason === 'focus' || active.reason === 'keyboard') scheduleClose(120);
  }, true);
  window.addEventListener('resize', handleViewportChange, { passive: true });
  window.visualViewport?.addEventListener('resize', handleViewportChange, { passive: true });
  window.visualViewport?.addEventListener('scroll', handleViewportChange, { passive: true });
  window.addEventListener('scroll', () => {
    if (!active || active.mobile) return;
    if (!active.anchor.isConnected) closeTooltip('detached');
    else position(active.tip, active.anchor, true);
  }, { passive: true, capture: true });
  window.GBArticleTooltips = Object.freeze({ version: VERSION, owner: OWNER, init: initInlineTooltips, close: closeTooltip });
  return window.GBArticleTooltips;
}
