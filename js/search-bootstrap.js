(function (window, document) {
  'use strict';

  const VERSION = 1;
  if (window.GBSearchBootstrap?.version === VERSION) return;

  const ownerScript = document.currentScript || document.querySelector('script[data-gb-search-bootstrap]');
  const defaultSource = ownerScript?.dataset.searchSrc || '/js/search.js';
  const state = { phase: 'idle', promise: null, pendingOpen: false, opener: null };
  const preloads = new Set();
  const triggers = [
    '#gbSearchBtn', '[data-gbs2-search]', '[data-fc-action="search"]',
    '.gb-nav-search-icon', '.gb-search-btn', '.mcp-search', '[data-action="open-search"]',
  ].join(',');

  const sourceUrl = (source) => new URL(source || defaultSource, document.baseURI).href;
  const runtimeReady = () => Boolean(window.GBSearch?.__ready && typeof window.GBSearch.open === 'function');

  function preload(source) {
    if (runtimeReady() || state.phase === 'loading') return false;
    const href = sourceUrl(source);
    if (preloads.has(href)) return true;
    const existing = [...document.querySelectorAll('link[rel="preload"][as="script"]')]
      .some((link) => link.href === href);
    if (existing) { preloads.add(href); return true; }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = href;
    link.dataset.gbSearchPreload = '';
    link.setAttribute('fetchpriority', 'low');
    link.addEventListener('error', () => preloads.delete(href), { once: true });
    preloads.add(href);
    document.head.appendChild(link);
    return true;
  }

  function ensureRuntime(source) {
    if (runtimeReady()) { state.phase = 'ready'; return Promise.resolve(true); }
    if (state.phase === 'loading' && state.promise) return state.promise;

    const href = sourceUrl(source);
    state.phase = 'loading';
    window.__gbSearchBootRequested = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = href;
    state.promise = new Promise((resolve, reject) => {
      const fail = (error) => {
        script.remove();
        state.phase = 'failed';
        state.promise = null;
        state.pendingOpen = false;
        state.opener = null;
        window.__gbSearchBootRequested = false;
        reject(error);
      };
      script.onload = () => {
        if (!runtimeReady()) return fail(new Error('search.js loaded without a ready GBSearch runtime'));
        state.phase = 'ready';
        state.promise = null;
        resolve(true);
      };
      script.onerror = () => fail(new Error(`Unable to load search runtime: ${href}`));
      document.head.appendChild(script);
    });
    return state.promise;
  }

  function openReady() {
    if (!runtimeReady()) return false;
    const opener = state.opener;
    state.pendingOpen = false;
    state.opener = null;
    state.phase = 'ready';
    if (opener?.isConnected && document.activeElement !== opener) opener.focus({ preventScroll: true });
    window.GBSearch.open();
    return true;
  }

  function stableOpener(candidate) {
    if (candidate?.matches?.('[data-action="open-search"]')) return document.getElementById('hMobileMenuBtn') || candidate;
    if (candidate instanceof window.HTMLElement && candidate !== document.body && candidate.isConnected) return candidate;
    return document.getElementById('gbSearchBtn') || candidate || document.activeElement;
  }

  function open(source, opener) {
    state.opener = stableOpener(opener || document.activeElement);
    if (runtimeReady()) { state.phase = 'ready'; return Promise.resolve(openReady()); }
    state.pendingOpen = true;
    return ensureRuntime(source).then(() => state.pendingOpen ? openReady() : false).catch(() => false);
  }

  function activateFromTrigger(trigger) {
    const opener = stableOpener(trigger);
    const menu = document.getElementById('hMobileNav');
    const menuButton = document.getElementById('hMobileMenuBtn');
    const menuOpen = menuButton?.getAttribute('aria-expanded') === 'true' && menu?.classList.contains('open');
    if (!menuOpen) { open(trigger.dataset.searchSrc, opener); return; }

    window.closeMobileNav?.();
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const stable = menuButton?.isConnected ? menuButton : opener;
      if (stable?.focus) stable.focus({ preventScroll: true });
      open(trigger.dataset.searchSrc, stable);
    }));
  }

  function addPaletteStylesheet(trigger) {
    const href = trigger.dataset.paletteCss;
    if (!href || document.querySelector('link[data-gb-search-palette-css]')) return;
    const clean = href.split('?')[0];
    const present = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .some((link) => link.href.split('?')[0].endsWith(clean));
    if (present) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.gbSearchPaletteCss = '';
    document.head.appendChild(link);
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target?.closest?.(triggers);
    if (!trigger) return;
    if (!trigger.matches('.mcp-search, [data-action="open-search"]') && runtimeReady()) return;
    event.preventDefault();
    addPaletteStylesheet(trigger);
    activateFromTrigger(trigger);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'k') return;
    const editableTarget = event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
    const closedPaletteInput = event.target?.matches?.('.cp-input') && !event.target.closest('.cp-backdrop.is-open');
    if (editableTarget && !closedPaletteInput) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open(undefined, document.activeElement);
  }, true);

  window.addEventListener('gb:openSearch', (event) => {
    if (runtimeReady()) return;
    event.preventDefault?.();
    open(undefined, document.activeElement);
  });

  if (document.querySelector('[data-gb-search-preload-on-interaction]')) {
    const events = ['pointerdown', 'touchstart', 'click', 'keydown'];
    const firstInteraction = () => {
      events.forEach((name) => document.removeEventListener(name, firstInteraction, true));
      preload();
    };
    events.forEach((name) => document.addEventListener(name, firstInteraction, { capture: true, passive: true, once: true }));
  }

  window.GBSearchBootstrap = {
    version: VERSION,
    open,
    preload,
    getState: () => ({ phase: runtimeReady() ? 'ready' : state.phase, pendingOpen: state.pendingOpen }),
  };
})(window, document);
