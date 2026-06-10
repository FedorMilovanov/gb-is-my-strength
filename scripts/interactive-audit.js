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

const issues = [];
const stats = { pages: 0, series: 0, quizzes: 0, glossary: 0, theme: 0 };

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
    const page = await openPage(browser, url);
    const count = await page.locator('.gb-strip__toggle').count();
    if (!count) { push('series-missing-toggle', url, 'no .gb-strip__toggle'); await page.close(); continue; }
    const before = page.url();
    try { await page.locator('.gb-strip__toggle').first().click({ timeout: 5000 }); }
    catch (e) { push('series-toggle-click-failed', url, e.message.slice(0, 240)); await page.close(); continue; }
    await page.waitForTimeout(250);
    const after = page.url();
    const state = await page.evaluate(() => {
      const dd = document.querySelector('.gb-strip__dropdown');
      const btn = document.querySelector('.gb-strip__toggle');
      if (!dd || !btn) return null;
      const r = dd.getBoundingClientRect();
      const cs = getComputedStyle(dd);
      return {
        hidden: dd.hidden,
        display: cs.display,
        w: Math.round(r.width),
        h: Math.round(r.height),
        aria: btn.getAttribute('aria-expanded'),
        btnContainsAnchor: !!document.querySelector('.gb-strip__toggle a'),
        dotsOutside: !!document.querySelector('.gb-strip__center > .gb-strip__dots'),
      };
    });
    if (after !== before) push('series-toggle-navigated', url, { before, after });
    if (!state || state.hidden || state.display === 'none' || state.w < 100 || state.h < 40 || state.aria !== 'true') {
      push('series-dropdown-not-visible', url, state);
    }
    if (state && state.btnContainsAnchor) push('series-button-contains-anchor', url, state);
    if (state && !state.dotsOutside) push('series-dots-not-outside-toggle', url, state);
    await page.mouse.click(10, 10);
    await page.waitForTimeout(120);
    const closed = await page.evaluate(() => document.querySelector('.gb-strip__dropdown')?.hidden);
    if (!closed) push('series-dropdown-does-not-close-outside', url, null);
    stats.series++;
    await page.close();
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
    const selectors = ['.gb-fc-theme', '#barThemeBtn', '#themeToggle', '.theme-toggle', '.nag-sidebar-theme-btn'];
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

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  try {
    await checkSeries(browser);
    await checkQuiz(browser);
    await checkGlossary(browser);
    await checkMobileTheme(browser);
  } finally {
    await browser.close();
  }
  console.log('\nGB INTERACTIVE AUDIT');
  console.log(`Pages: ${stats.pages} · series: ${stats.series} · quizzes: ${stats.quizzes} · glossary: ${stats.glossary} · theme: ${stats.theme}`);
  if (issues.length) {
    console.log(`❌ ${issues.length} issue(s):`);
    issues.forEach(i => console.log(`- ${i.kind} ${i.url}: ${JSON.stringify(i.detail)}`));
    process.exit(1);
  }
  console.log('✅ Interactive audit passed');
})().catch(err => { console.error('FATAL', err); process.exit(1); });
