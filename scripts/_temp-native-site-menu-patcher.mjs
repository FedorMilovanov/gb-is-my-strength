#!/usr/bin/env node
import fs from 'node:fs';

const path = 'src/runtime/reader-controls-a11y.js';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected fragment not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: expected fragment is not unique`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce("  const VERSION = 2;", "  const VERSION = 3;", 'runtime version');

replaceOnce(
`  function bindSurfaceRelations() {
    [
      { trigger: '#hmBottomBtn, #hmSectionBtn', target: '#hmSheet', fallbackId: 'hmSheet', popup: 'dialog' },
      { trigger: '#hmSettingsBtn, #hrailSettingsBtn, #gbFcSettings', target: '#hmSettings', fallbackId: 'hmSettings', popup: 'dialog' },
      { trigger: '#mobPartTocBtn', target: '#partTocOverlay', fallbackId: 'partTocOverlay', popup: 'dialog' },
      { trigger: '#mobTocBtn', target: '#seriesTocOverlay', fallbackId: 'seriesTocOverlay', popup: 'dialog' },
      { trigger: '[data-gill-settings-open]', target: '#gillSettingsOverlay', fallbackId: 'gillSettingsOverlay', popup: 'dialog' },
      { trigger: '[data-gill-learning-open]', target: '#gillLearningOverlay', fallbackId: 'gillLearningOverlay', popup: 'dialog' },
      { trigger: '#hMobileMenuBtn', target: '#hMobileNav', fallbackId: 'hMobileNav', popup: null },
    ].forEach(bindSurfaceRelation);
  }
`,
`  function bindSurfaceRelations() {
    [
      { trigger: '#hmBottomBtn, #hmSectionBtn', target: '#hmSheet', fallbackId: 'hmSheet', popup: 'dialog' },
      { trigger: '#hmSettingsBtn, #hrailSettingsBtn, #gbFcSettings', target: '#hmSettings', fallbackId: 'hmSettings', popup: 'dialog' },
      { trigger: '#mobPartTocBtn', target: '#partTocOverlay', fallbackId: 'partTocOverlay', popup: 'dialog' },
      { trigger: '#mobTocBtn', target: '#seriesTocOverlay', fallbackId: 'seriesTocOverlay', popup: 'dialog' },
      { trigger: '[data-gill-settings-open]', target: '#gillSettingsOverlay', fallbackId: 'gillSettingsOverlay', popup: 'dialog' },
      { trigger: '[data-gill-learning-open]', target: '#gillLearningOverlay', fallbackId: 'gillLearningOverlay', popup: 'dialog' },
      { trigger: '#hMobileMenuBtn', target: '#hMobileNav', fallbackId: 'hMobileNav', popup: null },
    ].forEach(bindSurfaceRelation);
  }

  function bindNativeSiteSectionsMenu() {
    const trigger = document.getElementById('hMobileMenuBtn');
    const target = document.getElementById('hMobileNav');
    const backdrop = document.getElementById('hMobileBackdrop');
    if (!(trigger instanceof HTMLElement) || !(target instanceof HTMLElement)) return;

    // Gill/series retains the existing site.js owner. This fallback exists only
    // for strict-native standalone readers, which intentionally do not load the
    // legacy site.js bundle.
    if (document.querySelector('.gbs-world, [data-gbs2-series]')) return;
    if (typeof window.closeMobileNav === 'function') return;
    if (trigger.dataset.readerSiteMenuBound === 'native') return;
    trigger.dataset.readerSiteMenuBound = 'native';

    const lockSource = 'reader-site-sections-menu';
    let open = surfaceIsOpen(target);

    function sync(next, { restoreFocus = false } = {}) {
      const wasOpen = open;
      open = Boolean(next);
      target.classList.toggle('open', open);
      setAttr(target, 'aria-hidden', open ? null : 'true');
      trigger.classList.toggle('is-open', open);
      setAttr(trigger, 'aria-expanded', open ? 'true' : 'false');
      setAttr(trigger, 'aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      if (backdrop instanceof HTMLElement) backdrop.classList.toggle('open', open);

      if (open && !wasOpen) window.SiteUtils?.lockScroll?.(lockSource);
      if (!open && wasOpen) window.SiteUtils?.unlockScroll?.(lockSource);
      if (!open && restoreFocus) {
        try { trigger.focus({ preventScroll: true }); } catch (_) { try { trigger.focus(); } catch (_) {} }
      }
    }

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      sync(!open);
    });
    backdrop?.addEventListener('click', () => sync(false, { restoreFocus: true }));
    target.addEventListener('click', (event) => {
      const closeLink = event.target instanceof Element ? event.target.closest('[data-close-nav]') : null;
      if (closeLink) sync(false);
    });
    document.addEventListener('keydown', (event) => {
      if (open && (event.key === 'Escape' || event.key === 'Esc')) {
        event.preventDefault();
        sync(false, { restoreFocus: true });
      }
    });

    sync(false);
  }
`,
'native site sections menu binding');

replaceOnce(
`  function refresh() {
    bindSlots();
    bindSurfaceRelations();
`,
`  function refresh() {
    bindSlots();
    bindSurfaceRelations();
    bindNativeSiteSectionsMenu();
`,
'refresh menu binding');

fs.writeFileSync(path, source);
console.log('native site menu patch: PASS');
