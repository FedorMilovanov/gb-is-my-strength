#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIR = path.join(ROOT, 'reports', 'standalone-reader-layout-guards');
const BASE = String(process.env.AUDIT_BASE || '').trim().replace(/\/$/, '');
const VIEWPORTS = [390, 768, 1199, 1200, 1280, 1366, 1440, 1920];
const MEASURES = { narrow: 42, normal: 50, wide: 58 };
const ROUTES = [
  {
    key: 'HM',
    label: 'Hermenevtika',
    path: '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
    main: '.article-main.article-main--hrail',
    summary: '.summary-card',
    prose: '.summary-card + p',
    canvas: null,
  },
  {
    key: 'KDV',
    label: 'Kod Da Vinci',
    path: '/articles/kod-da-vinchi/',
    main: '.article-main.article-main--hrail',
    summary: '.summary-card',
    prose: '.article-body > p',
    canvas: '.page-wrap.page-wrap--hrail',
  },
];

assert.ok(BASE, 'AUDIT_BASE is required');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const checks = [];
const record = (id, description, pass, evidence = null, area = 'standalone-reader-layout') => checks.push({ id, area, description, pass: Boolean(pass), evidence });
const read = (relativePath) => {
  const filePath = path.join(ROOT, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
};

function sourceContracts() {
  const rail = read('src/components/article-pilots/_shared/ReaderRail.astro');
  const settings = read('src/components/article-pilots/_shared/ReaderSettings.astro');
  const kdvMain = read('src/components/article-pilots/kod-da-vinchi/KodDaVinchiMainShell.astro');
  const kdvChrome = read('src/components/article-pilots/kod-da-vinchi/KodDaVinchiPageChrome.astro');
  const kdvRoute = read('src/pages/articles/kod-da-vinchi/index.astro');
  const lane = rail.match(/\.article-main\.article-main--hrail\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  const canvas = kdvChrome.match(/\.page-wrap\.page-wrap--hrail\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  const assertions = [
    ['SRL-S01', 'one-sided legacy 334px formula is retired', !rail.includes('margin-left: max((100vw - min(820px, 92vw)) / 2, 334px)')],
    ['SRL-S02', 'desktop and mobile rail breakpoints do not overlap', rail.includes('@media(max-width:1199px)') && rail.includes('@media(min-width:1200px)')],
    ['SRL-S03', 'ReaderRail declares the rail-safe edge and remaining width', lane.includes('--hrail-safe-left') && lane.includes('--hrail-available-width')],
    ['SRL-S04', 'ReaderRail prefers viewport centre and clamps only at the rail-safe edge', lane.includes('--hrail-centered-left') && lane.includes('margin-left:max(var(--hrail-centered-left),var(--hrail-safe-left))') && lane.includes('margin-right:auto') && !lane.includes('--hrail-lane-balance')],
    ['SRL-S05', 'rail geometry uses no positional transform trick', !/(?:^|\n)\s*(?:position|left|transform)\s*:/.test(lane)],
    ['SRL-S06', 'available width uses containing-block percentage, not viewport units', lane.includes('calc(100% -') && !lane.includes('100vw') && !lane.includes('100dvw')],
    ['SRL-S07', 'ReaderSettings owns one normal 50rem measure', settings.includes('--hm-article-measure: 50rem')],
    ['SRL-S08', 'ReaderSettings derives shell from measure plus 6rem', settings.includes('--hm-article-shell: calc(var(--hm-article-measure) + 6rem)')],
    ['SRL-S09', 'every direct article block shares the measure owner', settings.includes('[data-reader-root] .article-body > *') && settings.includes('max-width: var(--hm-article-measure)')],
    ['SRL-S10', 'measure modes are exactly 42rem, 50rem and 58rem', /narrow:\s*'42rem'[\s\S]*normal:\s*'50rem'[\s\S]*wide:\s*'58rem'/.test(settings)],
    ['SRL-S11', 'Kod Da Vinci main explicitly declares the shared rail contract', kdvMain.includes('class="article-main article-main--hrail"') && kdvMain.includes('data-reader-root')],
    ['SRL-S12', 'Kod Da Vinci route explicitly declares its rail canvas', kdvRoute.includes('class="page-wrap page-wrap--hrail"')],
    ['SRL-S13', 'Kod Da Vinci adapter expands only the structural canvas', canvas.includes('width: 100%') && canvas.includes('max-width: none') && canvas.includes('margin-left: 0') && canvas.includes('margin-right: 0')],
    ['SRL-S14', 'Kod Da Vinci adapter owns no article offset or measure', !/--hrail-|--hm-article-|\.article-main|(?:^|\n)\s*(?:left|right|transform)\s*:/.test(canvas)],
  ];
  assertions.forEach(([id, description, pass]) => record(id, description, pass, null, 'source'));
}

const twoFrames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function setMeasure(page, measure) {
  await page.evaluate((value) => {
    const api = window.GBReaderPreferences;
    if (!api?.set) throw new Error('GBReaderPreferences.set is unavailable');
    api.set({ measure: value }, { source: 'standalone-reader-layout-guard' });
  }, measure);
  await twoFrames(page);
  await page.waitForFunction((value) => window.GBReaderPreferences?.get?.()?.measure === value, measure, { timeout: 3000 });
}

async function layoutState(page, route) {
  return page.evaluate((selectors) => {
    const visible = (element) => {
      if (!(element instanceof Element)) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };
    const rect = (selector) => {
      if (!selector) return null;
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height, centerX: box.left + box.width / 2 } : null;
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
    const safeLeft = resolveVar('--hrail-safe-left');
    const clientWidth = document.documentElement.clientWidth;
    const mainRect = rect(selectors.main);
    const centeredLeft = mainRect ? (clientWidth - mainRect.width) / 2 : null;
    return {
      rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth,
      railVisible: visible(document.querySelector('.hrail')),
      rail: rect('.hrail'),
      main: mainRect,
      summary: rect(selectors.summary),
      prose: rect(selectors.prose),
      canvas: rect(selectors.canvas),
      safeLeft: Number.isFinite(safeLeft) ? safeLeft : null,
      centeredLeft,
      expectedLeft: Number.isFinite(safeLeft) && centeredLeft != null ? Math.max(centeredLeft, safeLeft) : null,
      viewportCenter: clientWidth / 2,
    };
  }, route);
}

function recordLayout(route, width, state) {
  const desktop = width >= 1200;
  const id = `${route.key}-L${width}`;
  record(`${id}-01`, `${route.label} ${width}px rail visibility matches breakpoint`, state.railVisible === desktop, state, 'layout');
  record(`${id}-02`, `${route.label} ${width}px has no horizontal overflow`, state.scrollWidth - state.clientWidth <= 1, state, 'layout');
  record(`${id}-03`, `${route.label} ${width}px main stays inside client viewport`, Boolean(state.main && state.main.width > 300 && state.main.left >= -1 && state.main.right <= state.clientWidth + 1), state, 'layout');
  record(`${id}-04`, `${route.label} ${width}px summary and prose centres differ by at most 2px`, Boolean(state.summary && state.prose && Math.abs(state.summary.centerX - state.prose.centerX) <= 2), state, 'layout');
  record(`${id}-05`, `${route.label} ${width}px summary and prose widths differ by at most 2px`, Boolean(state.summary && state.prose && Math.abs(state.summary.width - state.prose.width) <= 2), state, 'layout');
  if (!desktop) {
    record(`${id}-06`, `${route.label} ${width}px article stays viewport-centred`, Boolean(state.main && Math.abs(state.main.centerX - state.viewportCenter) <= 3), state, 'layout');
    return;
  }
  record(`${id}-06`, `${route.label} ${width}px article clears the fixed rail`, Boolean(state.rail && state.main && state.main.left >= state.rail.right + 20), state, 'layout');
  record(`${id}-07`, `${route.label} ${width}px article uses only the minimum rail collision shift`, Boolean(state.main && state.expectedLeft != null && Math.abs(state.main.left - state.expectedLeft) <= 3), state, 'layout');
  const centeringSafe = state.centeredLeft != null && state.safeLeft != null && state.centeredLeft >= state.safeLeft - 1;
  record(`${id}-10`, `${route.label} ${width}px returns to the client-viewport centre whenever rail clearance allows it`, Boolean(!centeringSafe || (state.main && Math.abs(state.main.centerX - state.viewportCenter) <= 3)), { centeringSafe, state }, 'layout');
  const minimum = width >= 1280 ? 760 : 700;
  record(`${id}-08`, `${route.label} ${width}px normal prose is not pathologically narrow`, Boolean(state.prose && state.prose.width >= minimum), { minimum, state }, 'layout');
  if (route.canvas) record(`${id}-09`, `${route.label} ${width}px rail canvas spans client width`, Boolean(state.canvas && Math.abs(state.canvas.width - state.clientWidth) <= 2 && Math.abs(state.canvas.centerX - state.viewportCenter) <= 2), state, 'layout');
}

sourceContracts();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
try {
  for (const route of ROUTES) {
    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction((selectors) => Boolean(window.GBReaderPreferences && document.querySelector(selectors.main) && document.querySelector(selectors.summary) && document.querySelector(selectors.prose)), route, { timeout: 15000 });
      await setMeasure(page, 'normal');
      recordLayout(route, width, await layoutState(page, route));
      if (width === 1366) await page.screenshot({ path: path.join(REPORT_DIR, `${route.key.toLowerCase()}-1366.png`), fullPage: false });
    }

    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction((selectors) => Boolean(window.GBReaderPreferences && document.querySelector(selectors.main) && document.querySelector(selectors.summary) && document.querySelector(selectors.prose)), route, { timeout: 15000 });
    const measured = {};
    for (const [measure, rem] of Object.entries(MEASURES)) {
      await setMeasure(page, measure);
      const state = await layoutState(page, route);
      measured[measure] = state.prose?.width || 0;
      const expected = rem * state.rootFont;
      record(`${route.key}-M-${measure}-01`, `${route.label} ${measure} measure matches rem contract`, Boolean(state.prose && Math.abs(state.prose.width - expected) <= 6), { expected, state }, 'measure');
      record(`${route.key}-M-${measure}-02`, `${route.label} ${measure} summary and prose remain aligned`, Boolean(state.summary && state.prose && Math.abs(state.summary.centerX - state.prose.centerX) <= 2), state, 'measure');
      record(`${route.key}-M-${measure}-03`, `${route.label} ${measure} summary and prose share width`, Boolean(state.summary && state.prose && Math.abs(state.summary.width - state.prose.width) <= 2), state, 'measure');
      record(`${route.key}-M-${measure}-04`, `${route.label} ${measure} has no horizontal overflow`, state.scrollWidth - state.clientWidth <= 1, state, 'measure');
      const centeringSafe = state.centeredLeft != null && state.safeLeft != null && state.centeredLeft >= state.safeLeft - 1;
      record(`${route.key}-M-${measure}-05`, `${route.label} ${measure} keeps viewport centre whenever the selected measure clears the rail`, Boolean(!centeringSafe || (state.main && Math.abs(state.main.centerX - state.viewportCenter) <= 3)), { centeringSafe, state }, 'measure');
    }
    record(`${route.key}-M-ORDER`, `${route.label} measure modes grow monotonically`, measured.narrow < measured.normal && measured.normal < measured.wide, measured, 'measure');
  }
  record('SRL-RUNTIME-ERRORS', 'standalone reader layout guard has no uncaught page errors', pageErrors.length === 0, pageErrors, 'runtime');
} finally {
  await context.close();
  await browser.close();
}

assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'layout guard check IDs must be unique');
assert.ok(checks.length >= 178, `Standalone reader layout guard requires at least 178 checks, got ${checks.length}`);
const failed = checks.filter((item) => !item.pass);
const summary = { sha: process.env.GITHUB_SHA || null, checks: checks.length, passed: checks.length - failed.length, failed: failed.length };
fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify({ summary, checks }, null, 2));
fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), ['# Standalone reader layout guards', '', `- SHA: \`${summary.sha || 'local'}\``, `- Checks: **${summary.checks}**`, `- Passed: **${summary.passed}**`, `- Failed: **${summary.failed}**`, '', '| ID | Result | Description |', '|---|---|---|', ...checks.map((item) => `| ${item.id} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.description.replace(/\|/g, '\\|')} |`)].join('\n'));
checks.forEach((item) => console.log(`[STANDALONE-READER-LAYOUT] ${item.pass ? 'PASS' : 'FAIL'} ${item.id} :: ${item.description}`));
console.log('[STANDALONE-READER-LAYOUT-SUMMARY]', JSON.stringify(summary));
assert.equal(failed.length, 0, `Standalone reader layout guards failed: ${failed.map((item) => item.id).join(', ')}`);
console.log('Standalone reader layout guards: PASS');
