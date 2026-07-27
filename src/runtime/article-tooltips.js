const VERSION = 5;
const OWNER = 'article-inline-tooltip';
const SELECTOR = '.gterm, .fn-marker, .bref[data-ref]';

let active = null;
let closeTimer = 0;

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

function scheduleClose(delay = 220) {
  cancelClose();
  closeTimer = window.setTimeout(() => closeTooltip('leave'), delay);
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
    if (active?.tip === tip) position(tip, active.anchor);
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

function position(tip, anchor) {
  if (mobileMode()) {
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

function restore(record) {
  const { tip, placeholder } = record;
  tip.classList.remove('gb-floating-tip', 'is-open');
  clearAuthoritativeGeometry(tip);
  tip.style.removeProperty('position');
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
  cancelClose();
  const tip = prepareTip(inlineTip(anchor));
  if (!tip) return;
  if (active?.anchor === anchor) {
    active.reason = reason;
    position(tip, anchor);
    return;
  }
  closeTooltip('replace');
  cancelClose();

  const placeholder = document.createComment('gb-inline-tooltip');
  tip.parentNode?.insertBefore(placeholder, tip);
  document.body.appendChild(tip);
  tip.classList.add('gb-floating-tip', 'is-open');
  anchor.classList.add('is-open');
  anchor.setAttribute('aria-expanded', 'true');

  active = { anchor, tip, placeholder, mobile: mobileMode(), reason };
  position(tip, anchor);
  window.requestAnimationFrame(() => {
    if (active?.tip === tip) position(tip, anchor);
  });

  if (tip.dataset.gbInteractionBound !== '1') {
    tip.dataset.gbInteractionBound = '1';
    tip.addEventListener('pointerenter', cancelClose);
    tip.addEventListener('pointerleave', () => scheduleClose());
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

  anchor.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch' || mobileMode()) return;
    openTooltip(anchor, 'hover');
  });
  anchor.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch' || mobileMode()) return;
    scheduleClose();
  });
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
    else active.reason = 'click';
  });
  anchor.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    cancelClose();
    if (active?.anchor === anchor && active.reason === 'keyboard') closeTooltip('toggle');
    else openTooltip(anchor, 'keyboard');
  });
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
  window.SiteUtils = window.SiteUtils || {};
  window.SiteUtils.initGlossaryTooltips = initGlossaryTooltips;
  initInlineTooltips(document);
  document.addEventListener('gb:quiz-rendered', (event) => initInlineTooltips(event.detail?.root || document));
  document.addEventListener('pointerdown', (event) => {
    if (!active) return;
    if (active.anchor.contains(event.target) || active.tip.contains(event.target)) return;
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
