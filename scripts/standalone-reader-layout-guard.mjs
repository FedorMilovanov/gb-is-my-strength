#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = String(process.env.AUDIT_BASE || '').trim().replace(/\/$/, '');
const ROUTES = [
  {
    key: 'HM',
    path: '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
    main: '.article-main.article-main--hrail',
    summary: '.summary-card',
    prose: '.summary-card + p',
  },
  {
    key: 'KDV',
    path: '/articles/kod-da-vinchi/',
    main: '.page-wrap[data-reader-root][data-reader-rail-main]',
    summary: '.summary-card',
    prose: '.article-body > p',
  },
];
const MEASURES = ['narrow', 'normal', 'wide'];
const failures = [];

assert.ok(BASE, 'AUDIT_BASE is required');

const twoFrames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function setMeasure(page, measure) {
  await page.evaluate((value) => {
    const api = window.GBReaderPreferences;
    if (!api?.set) throw new Error('GBReaderPreferences.set is unavailable');
    api.set({ measure: value }, { source: 'standalone-reader-clientbox-center-probe' });
  }, measure);
  await twoFrames(page);
  await page.waitForFunction((value) => window.GBReaderPreferences?.get?.()?.measure === value, measure, { timeout: 3000 });
}

async function state(page, route) {
  return page.evaluate((selectors) => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof Element)) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width, centerX: box.left + box.width / 2 };
    };
    const main = document.querySelector(selectors.main);
    const resolveVar = (property) => {
      if (!(main instanceof HTMLElement)) return Number.NaN;
      const probe = document.createElement('span');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;height:0;width:var(${property});`;
      main.appendChild(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    };
    const bodyBox = document.body.getBoundingClientRect();
    const layoutLeft = bodyBox.left + document.body.clientLeft;
    const layoutWidth = document.body.clientWidth;
    const layoutRight = layoutLeft + layoutWidth;
    const layoutCenter = layoutLeft + layoutWidth / 2;
    const mainRect = rect(selectors.main);
    const summary = rect(selectors.summary);
    const prose = rect(selectors.prose);
    const safeReadableLeft = resolveVar('--hrail-safe-readable-left-viewport');
    const centeredReadableLeft = prose ? layoutCenter - prose.width / 2 : null;
    return {
      htmlClientWidth: document.documentElement.clientWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyBorderWidth: bodyBox.width,
      gutterWidth: bodyBox.width - document.body.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      layoutLeft,
      layoutRight,
      layoutCenter,
      main: mainRect,
      summary,
      prose,
      safeReadableLeft: Number.isFinite(safeReadableLeft) ? safeReadableLeft : null,
      centeredReadableLeft,
      expectedReadableLeft: Number.isFinite(safeReadableLeft) && centeredReadableLeft != null
        ? Math.max(centeredReadableLeft, safeReadableLeft)
        : null,
    };
  }, route);
}

function check(id, pass, evidence) {
  console.log(`[READER-CLIENTBOX-CENTER] ${pass ? 'PASS' : 'FAIL'} ${id}`);
  if (!pass) {
    failures.push({ id, evidence });
    console.log(`[READER-CLIENTBOX-CENTER-EVIDENCE] ${id} :: ${JSON.stringify(evidence)}`);
  }
}

function checkMobile(route, width, s) {
  check(`${route.key}-C${width}`, Boolean(s.main && Math.abs(s.main.centerX - s.layoutCenter) <= 3), s);
}

function checkDesktop(route, suffix, s) {
  const centeringSafe = s.centeredReadableLeft != null && s.safeReadableLeft != null && s.centeredReadableLeft >= s.safeReadableLeft - 1;
  check(`${route.key}-${suffix}-MINSHIFT`, Boolean(s.prose && s.expectedReadableLeft != null && Math.abs(s.prose.left - s.expectedReadableLeft) <= 3), { centeringSafe, ...s });
  check(`${route.key}-${suffix}-CENTER`, Boolean(!centeringSafe || (s.prose && s.summary && Math.abs(s.prose.centerX - s.layoutCenter) <= 3 && Math.abs(s.summary.centerX - s.layoutCenter) <= 3)), { centeringSafe, ...s });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
try {
  for (const route of ROUTES) {
    for (const width of [390, 768, 1199]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction((selectors) => Boolean(window.GBReaderPreferences && document.querySelector(selectors.main) && document.querySelector(selectors.summary) && document.querySelector(selectors.prose)), route, { timeout: 15000 });
      await setMeasure(page, 'normal');
      checkMobile(route, width, await state(page, route));
    }

    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction((selectors) => Boolean(window.GBReaderPreferences && document.querySelector(selectors.main) && document.querySelector(selectors.summary) && document.querySelector(selectors.prose)), route, { timeout: 15000 });
    await setMeasure(page, 'normal');
    checkDesktop(route, 'L1920', await state(page, route));
    for (const measure of MEASURES) {
      await setMeasure(page, measure);
      const s = await state(page, route);
      const centeringSafe = s.centeredReadableLeft != null && s.safeReadableLeft != null && s.centeredReadableLeft >= s.safeReadableLeft - 1;
      check(`${route.key}-M-${measure}-CENTER`, Boolean(!centeringSafe || (s.prose && s.summary && Math.abs(s.prose.centerX - s.layoutCenter) <= 3 && Math.abs(s.summary.centerX - s.layoutCenter) <= 3)), { centeringSafe, ...s });
    }
  }
} finally {
  await context.close();
  await browser.close();
}

console.log('[READER-CLIENTBOX-CENTER-SUMMARY]', JSON.stringify({ checks: 16, passed: 16 - failures.length, failed: failures.length }));
assert.equal(failures.length, 0, `Reader client-box centre probe failed: ${failures.map((item) => item.id).join(', ')}`);
console.log('Reader client-box centre probe: PASS');
