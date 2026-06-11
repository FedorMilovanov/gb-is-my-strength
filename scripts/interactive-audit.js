#!/usr/bin/env node
/**
 * Interactive regression audit for runtime-only bugs that static HTML checks miss.
 * Requires a local server. Example:
 *   python3 -m http.server 8080 --bind 127.0.0.1
 *   AUDIT_BASE=http://127.0.0.1:8080 npm run interactive-audit
 */
'use strict';

const path = require('path');
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH ||
  path.join(process.env.HOME || process.cwd(), '.cache', 'ms-playwright');

const { chromium } = require('playwright');
const BASE = (process.env.AUDIT_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');

const SERIES_URLS = [
  '/articles/dzhon-gill-istoricheskiy-kontekst/',
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/dzhon-gill-chast-2-uchenyi/',
  '/articles/dzhon-gill-chast-3-nasledie/',
  '/articles/dzhon-gill-spravochnik/',
  '/articles/krajne-li-isporcheno-serdce/',
  '/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/',
];
const QUIZ_URLS = [
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/dzhon-gill-chast-2-uchenyi/',
  '/articles/dzhon-gill-chast-3-nasledie/',
  '/articles/dzhon-gill-spravochnik/',
  '/articles/kod-da-vinchi/',
  '/articles/krajne-li-isporcheno-serdce/',
];
const GLOSSARY_URLS = [
  '/articles/dzhon-gill-istoricheskiy-kontekst/',
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/krajne-li-isporcheno-serdce/',
];
const THEME_URLS = [
  '/',
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
  '/articles/krajne-li-isporcheno-serdce/',
  '/nagornaya/',
  '/nagornaya/chast-1/',
];
const SEARCH_URLS = [
  '/',
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/krajne-li-isporcheno-serdce/',
  '/nagornaya/chast-1/',
];
const MEDIA_URLS = [
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/krajne-li-isporcheno-serdce/',
];

const issues = [];
const stats = { pages: 0, series: 0, quizzes: 0, glossary: 0, theme: 0, search: 0, media: 0 };

function isNoise(text) {
  return /Content Security Policy directive.*https:\/\/gospod-bog\.ru\/(?:favicon|apple-touch-icon|icons|images)|favicon\.ico|mc\.yandex/i.test(text);
}
function push(kind, url, detail) { issues.push({ kind, url, detail }); }

async function openPage(browser, urlPath, viewport = { width: 1200, height: 800 }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error' && !isNoise(msg.text())) consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGE_ERROR: ' + err.message));
  const resp = await page.goto(BASE + urlPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(900);
  stats.pages++;
  if (!resp || !resp.ok()) push('page-status', urlPath, resp ? resp.status() : 'null response');
  if (consoleErrors.length) push('console-error', urlPath, consoleErrors.slice(0, 4));
  return page;
}

async function checkSeries(browser) {
  for (const url of SERIES_URLS) {
    // Desktop: GBS rail must exist with current part + live toc, no legacy UI
    const page = await openPage(browser, url, { width: 1366, height: 850 });
    const state = await page.evaluate(() => ({
      world: !!document.querySelector('.gbs2-world'),
      rail: !!document.querySelector('.gbs2-rail'),
      railVisible: (() => { const r = document.querySelector('.gbs2-rail'); if (!r) return false; const b = r.getBoundingClientRect(); return b.width > 200 && b.height > 400; })(),
      current: !!document.querySelector('.gbs2-part[aria-current="page"]'),
      tocLinks: document.querySelectorAll('.gbs2-toc a').length,
      ring: !!document.getElementById('gbs2Ring'),
      legacy: ['reading-progress', 'bottomBar', 'btocOverlay', 'tocSidebar', 'themeToggle'].filter(id => document.getElementById(id)),
      oldSeriesUi: document.querySelectorAll('[data-series-strip],[data-series-nav],.gb-strip,.series-next-cta').length,
    }));
    if (!state.world || !state.rail) push('gbs-world-missing', url, state);
    else {
      if (!state.railVisible) push('gbs-rail-not-visible', url, state);
      if (!state.current) push('gbs-no-current-part', url, state);
      if (!state.tocLinks) push('gbs-empty-toc', url, state);
      if (!state.ring) push('gbs-no-progress-ring', url, state);
    }
    if (state.legacy.length) push('gbs-legacy-leftover', url, state.legacy);
    if (state.oldSeriesUi) push('gbs-old-series-ui-leftover', url, state.oldSeriesUi);
    // toc click must scroll, not navigate away
    const before = page.url();
    const clicked = await page.evaluate(() => {
      const a = document.querySelector('.gbs2-toc a'); if (!a) return false; a.click(); return true;
    });
    await page.waitForTimeout(300);
    if (clicked && page.url().split('#')[0] !== before.split('#')[0]) push('gbs-toc-click-navigated', url, page.url());
    await page.close();

    // Mobile: bottom capsule opens sheet, tabs switch, sheet closes
    const mob = await openPage(browser, url, { width: 390, height: 844 });
    const mobState = await mob.evaluate(() => ({
      head: !!document.querySelector('.gbs2-mobile-head'),
      bbar: !!document.getElementById('gbs2Bbar'),
      sheet: !!document.getElementById('gbs2Sheet'),
    }));
    if (!mobState.head || !mobState.bbar || !mobState.sheet) { push('gbs-mobile-ui-missing', url, mobState); await mob.close(); continue; }
    try { await mob.locator('#gbs2Bbar').click({ timeout: 5000 }); } catch (e) { push('gbs-sheet-open-failed', url, e.message.slice(0, 200)); await mob.close(); continue; }
    await mob.waitForTimeout(350);
    const open = await mob.evaluate(() => document.getElementById('gbs2Sheet').classList.contains('gbs2-open'));
    if (!open) push('gbs-sheet-did-not-open', url, null);
    const tabOk = await mob.evaluate(() => {
      const t = document.querySelector('.gbs2-sheet-tab[data-gbs2-tab="toc"]'); if (!t) return false; t.click();
      const pane = document.querySelector('.gbs2-sheet-pane[data-gbs2-pane="toc"]');
      return !!(pane && pane.classList.contains('gbs2-on'));
    });
    if (!tabOk) push('gbs-sheet-tab-broken', url, null);
    await mob.evaluate(() => { const c = document.querySelector('[data-gbs2-close]'); if (c) c.click(); });
    await mob.waitForTimeout(250);
    const closed = await mob.evaluate(() => !document.getElementById('gbs2Sheet').classList.contains('gbs2-open'));
    if (!closed) push('gbs-sheet-did-not-close', url, null);
    stats.series++;
    await mob.close();
  }
}

async function checkQuiz(browser) {
  for (const url of QUIZ_URLS) {
    const page = await openPage(browser, url, { width: 1100, height: 800 });
    const cfg = await page.evaluate(() => ({
      placeholder: !!document.getElementById('quizPlaceholder'),
      launch: !!document.getElementById('quizLaunch'),
      questions: window.SITE_CONFIG && window.SITE_CONFIG.quiz && Array.isArray(window.SITE_CONFIG.quiz.questions)
        ? window.SITE_CONFIG.quiz.questions.length
        : 0,
    }));
    if (cfg.questions > 0 && !cfg.placeholder) push('quiz-missing-placeholder', url, cfg);
    if (cfg.questions > 0 && !cfg.launch) push('quiz-missing-launch', url, cfg);
    if (cfg.launch) {
      await page.locator('#quizLaunch').click({ timeout: 5000 });
      await page.waitForTimeout(400);
      const state = await page.evaluate(() => ({
        question: (document.querySelector('#quizQuestion')?.textContent || '').trim(),
        options: document.querySelectorAll('.quiz-option').length,
      }));
      if (!state.question || state.options < 2) push('quiz-question-options-not-rendered', url, state);
    }
    stats.quizzes++;
    await page.close();
  }
}

async function checkGlossary(browser) {
  for (const url of GLOSSARY_URLS) {
    const page = await openPage(browser, url, { width: 900, height: 650 });
    const summaryTerms = await page.locator('.summary-card .gterm, .summary-card .gtip').count();
    if (summaryTerms) push('summary-has-glossary-terms', url, summaryTerms);
    const count = await page.locator('article .gterm:not(.summary-card .gterm)').count();
    if (count > 0) {
      await page.locator('article .gterm:not(.summary-card .gterm)').first().hover({ force: true });
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => {
        const tip = document.querySelector('.gtip.gb-floating-tip.is-open');
        if (!tip) return null;
        const r = tip.getBoundingClientRect();
        const inner = tip.querySelector('.gtip-luxury');
        const cs = getComputedStyle(tip);
        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          bg: cs.backgroundColor,
          innerDisplay: inner ? getComputedStyle(inner).display : null,
        };
      });
      if (!state || state.w < 100 || state.h < 50 || state.top < 0 || state.bottom > 651 || /rgba\(0, 0, 0, 0\)/.test(state.bg) || state.innerDisplay !== 'block') {
        push('glossary-tooltip-bad-layout', url, state);
      }
    }
    stats.glossary++;
    await page.close();
  }
}

async function visibleThemeHandle(page) {
  return await page.evaluateHandle(() => {
    const selectors = ['.gbs2-mctl[data-gbs2-theme]', '.gbs2-ctl[data-gbs2-theme]', '.gb-fc-theme', '#barThemeBtn', '#themeToggle', '.theme-toggle', '.nag-sidebar-theme-btn'];
    function visible(el) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) !== 0 &&
        r.width >= 20 && r.height >= 20 && r.bottom >= 0 && r.right >= 0 && r.top <= innerHeight && r.left <= innerWidth;
    }
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (visible(el)) return el;
      }
    }
    return null;
  });
}

async function checkMobileTheme(browser) {
  for (const url of THEME_URLS) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.on('console', msg => { if (msg.type() === 'error' && !isNoise(msg.text())) push('mobile-theme-console-error', url, msg.text()); });
    page.on('pageerror', err => push('mobile-theme-page-error', url, err.message));
    const resp = await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(900);
    stats.pages++;
    if (!resp || !resp.ok()) push('mobile-theme-page-status', url, resp ? resp.status() : 'null response');
    const enabled = await page.evaluate(() => !(window.SITE_CONFIG && window.SITE_CONFIG.features && window.SITE_CONFIG.features.themeToggle && window.SITE_CONFIG.features.themeToggle.enabled === false));
    if (!enabled) { await page.close(); continue; }
    await page.evaluate(() => { try { localStorage.setItem('theme', 'light'); } catch (_) {} document.documentElement.classList.remove('dark'); });
    const handle = await visibleThemeHandle(page);
    const el = handle.asElement();
    if (!el) {
      push('mobile-theme-control-not-visible', url, 'theme enabled but no visible control');
      await page.close();
      continue;
    }
    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await el.click({ timeout: 5000 });
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (after === before) push('mobile-theme-click-did-not-toggle', url, { before, after });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const persisted = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (persisted !== after) push('mobile-theme-not-persisted', url, { after, persisted });
    stats.theme++;
    await page.close();
  }
}

async function checkSearchShortcuts(browser) {
  for (const url of SEARCH_URLS) {
    const page = await openPage(browser, url, { width: 1200, height: 800 });
    await page.evaluate(() => {
      window.__gbKeyAudit = [];
      document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && (String(e.key).toLowerCase() === 'f' || String(e.key).toLowerCase() === 'k')) {
          window.__gbKeyAudit.push({ key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, defaultPrevented: e.defaultPrevented, phase: 'late-bubble' });
        }
      }, false);
    });
    await page.keyboard.press('Control+F');
    await page.waitForTimeout(250);
    const ctrlF = await page.evaluate(() => ({
      events: window.__gbKeyAudit || [],
      cpOpen: !!document.querySelector('.cp-backdrop.is-open'),
      activeTag: document.activeElement && document.activeElement.tagName,
    }));
    const fEvent = ctrlF.events.find(e => String(e.key).toLowerCase() === 'f' && e.ctrl);
    if (!fEvent) push('ctrl-f-not-observed', url, ctrlF);
    else if (fEvent.defaultPrevented || ctrlF.cpOpen) push('ctrl-f-hijacked', url, ctrlF);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+K');
    await page.waitForTimeout(450);
    const ctrlK = await page.evaluate(() => ({
      cpOpen: !!document.querySelector('.cp-backdrop.is-open'),
      inputFocused: document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('cp-input'),
      activeTag: document.activeElement && document.activeElement.tagName,
      activeClass: document.activeElement && document.activeElement.className,
    }));
    if (!ctrlK.cpOpen || !ctrlK.inputFocused) push('ctrl-k-command-palette-not-open', url, ctrlK);
    if (ctrlK.cpOpen) {
      await page.keyboard.type('Гилл');
      await page.waitForTimeout(450);
      const results = await page.evaluate(() => ({ items: document.querySelectorAll('.cp-item').length, empty: !!document.querySelector('.cp-empty') }));
      if (results.items < 1) push('command-palette-no-results-for-gill', url, results);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      const closed = await page.evaluate(() => !document.querySelector('.cp-backdrop.is-open'));
      if (!closed) push('command-palette-escape-did-not-close', url, null);
    }
    stats.search++;
    await page.close();
  }
}

async function checkMediaViewerAndShare(browser) {
  for (const url of MEDIA_URLS) {
    const page = await openPage(browser, url, { width: 1000, height: 800 });
    const imgCount = await page.locator('.article-figure img, .article-img img, .nagornaya-hero-img').count();
    if (imgCount > 0) {
      await page.locator('.article-figure img, .article-img img, .nagornaya-hero-img').first().click({ force: true });
      await page.waitForTimeout(250);
      const opened = await page.evaluate(() => ({
        open: !!document.querySelector('.img-viewer.is-open, .gbx-imgview.gbx-imgview--open'),
        scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden'
      }));
      if (!opened.open || !opened.scrollLocked) push('image-viewer-did-not-open-lock-scroll', url, opened);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(420);
      const closed = await page.evaluate(() => ({
        open: !!document.querySelector('.img-viewer.is-open, .gbx-imgview.gbx-imgview--open'),
        scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden'
      }));
      if (closed.open || closed.scrollLocked) push('image-viewer-escape-did-not-close', url, closed);
    }
    const endShare = await page.locator('#articleEndShareBtn').count();
    if (endShare > 0) {
      await page.locator('#articleEndShareBtn').scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      await page.locator('#articleEndShareBtn').click({ timeout: 5000 });
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => {
        const ov = document.querySelector('#share-dialog-overlay');
        const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
        return {
          open: !!(ov && (ov.classList.contains('is-open') || ov.getAttribute('aria-hidden') === 'false')),
          hidden: ov && ov.getAttribute('aria-hidden'),
          canonical,
          buttons: document.querySelectorAll('#share-dialog button').length,
        };
      });
      if (!state.open || state.hidden !== 'false' || state.buttons < 3) push('share-dialog-did-not-open', url, state);
      if (state.canonical && /preview|localhost|127\.0\.0\.1/i.test(state.canonical)) push('share-canonical-url-suspicious', url, state.canonical);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      const closed = await page.evaluate(() => ({ open: !!document.querySelector('#share-dialog-overlay.is-open'), hidden: document.querySelector('#share-dialog-overlay')?.getAttribute('aria-hidden') }));
      if (closed.open || closed.hidden !== 'true') push('share-dialog-escape-did-not-close', url, closed);
    }
    stats.media++;
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  try {
    await checkSeries(browser);
    await checkQuiz(browser);
    await checkGlossary(browser);
    await checkMobileTheme(browser);
    await checkSearchShortcuts(browser);
    await checkMediaViewerAndShare(browser);
  } finally {
    await browser.close();
  }
  console.log('\nGB INTERACTIVE AUDIT');
  console.log(`Pages: ${stats.pages} · series: ${stats.series} · quizzes: ${stats.quizzes} · glossary: ${stats.glossary} · theme: ${stats.theme} · search: ${stats.search} · media: ${stats.media}`);
  if (issues.length) {
    console.log(`❌ ${issues.length} issue(s):`);
    issues.forEach(i => console.log(`- ${i.kind} ${i.url}: ${JSON.stringify(i.detail)}`));
    process.exit(1);
  }
  console.log('✅ Interactive audit passed');
})().catch(err => { console.error('FATAL', err); process.exit(1); });
