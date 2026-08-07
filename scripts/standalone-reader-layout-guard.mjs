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
  },
  {
    key: 'KDV',
    label: 'Kod Da Vinci',
    path: '/articles/kod-da-vinchi/',
    main: '.page-wrap[data-reader-root][data-reader-rail-main]',
    summary: '.summary-card',
    prose: '.article-body > p',
  },
];

assert.ok(BASE, 'AUDIT_BASE is required');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const checks = [];
const record = (id, description, pass, evidence = null, area = 'standalone-reader-layout') => {
  checks.push({ id, area, description, pass: Boolean(pass), evidence });
};
const read = (relativePath) => {
  const filePath = path.join(ROOT, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
};

function sourceContracts() {
  const rail = read('src/components/article-pilots/_shared/ReaderRail.astro');
  const settings = read('src/components/article-pilots/_shared/ReaderSettings.astro');
  const siteCss = read('css/site.css');
  const kdvMain = read('src/components/article-pilots/kod-da-vinchi/KodDaVinchiMainShell.astro');
  const kdvChrome = read('src/components/article-pilots/kod-da-vinchi/KodDaVinchiPageChrome.astro');
  const kdvRoute = read('src/pages/articles/kod-da-vinchi/index.astro');
  const lane = rail.match(/:is\(\.article-main\.article-main--hrail,\[data-reader-rail-main\]\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  const summaryOwner = settings.match(/:global\(body:not\(\.nagornaya-page\) \[data-reader-root\] \.article-body > \.summary-card\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  const kdvShell = settings.match(/:global\(\.page-wrap\[data-reader-root\]\[data-reader-rail-main\]\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  const relevantGeometry = [rail, settings, kdvMain, kdvChrome, kdvRoute].join('\n');
  const assertions = [
    ['SRL-S01', 'one-sided legacy 334px geometry is retired from every standalone-reader owner', !relevantGeometry.includes('334px') && !relevantGeometry.includes('max((100vw - min(820px, 92vw)) / 2')],
    ['SRL-S02', 'desktop and mobile rail breakpoints do not overlap', rail.includes('@media(max-width:1199px)') && rail.includes('@media(min-width:1200px)')],
    ['SRL-S03', 'ReaderRail owns a viewport-coordinate safe readable edge', lane.includes('--hrail-safe-readable-left-viewport') && lane.includes('--hrail-safe-readable-left')],
    ['SRL-S04', 'ReaderRail derives readable space and content inset from the selected measure', lane.includes('--hrail-readable-space') && lane.includes('--hrail-readable-width') && lane.includes('--hrail-content-inset')],
    ['SRL-S05', 'ReaderRail clamps the shell only after subtracting readable content inset', lane.includes('--hrail-safe-shell-left') && lane.includes('margin-left:max(var(--hrail-centered-left),var(--hrail-safe-shell-left))') && lane.includes('margin-right:auto')],
    ['SRL-S06', 'ReaderRail geometry uses no positional transform trick', !/(?:^|\n)\s*(?:position|left|transform)\s*:/.test(lane)],
    ['SRL-S07', 'ReaderRail shell width uses containing-block percentage, not viewport units', lane.includes('calc(100% -') && !lane.includes('100vw') && !lane.includes('100dvw')],
    ['SRL-S08', 'ReaderSettings owns one normal 50rem measure', settings.includes('--hm-article-measure: 50rem')],
    ['SRL-S09', 'ReaderSettings derives shell from measure plus 6rem', settings.includes('--hm-article-shell: calc(var(--hm-article-measure) + 6rem)')],
    ['SRL-S10', 'every direct article block shares the ReaderSettings measure owner', settings.includes('[data-reader-root] .article-body > *') && settings.includes('max-width: var(--hm-article-measure)')],
    ['SRL-S11', 'measure modes are exactly 42rem, 50rem and 58rem', /narrow:\s*'42rem'[\s\S]*normal:\s*'50rem'[\s\S]*wide:\s*'58rem'/.test(settings)],
    ['SRL-S12', 'ReaderSettings explicitly owns summary inline centring', summaryOwner.includes('margin-left: auto') && summaryOwner.includes('margin-right: auto')],
    ['SRL-S13', 'summary centring uses normal cascade ownership, not important compensation', summaryOwner.length > 0 && !summaryOwner.includes('!important')],
    ['SRL-S14', 'Kod Da Vinci route declares one outer page-wrap as both reader root and rail shell', /<div[^>]*class="page-wrap"[^>]*data-reader-root[^>]*data-reader-rail-main[^>]*>/.test(kdvRoute)],
    ['SRL-S15', 'Kod Da Vinci semantic main stays classless and owns no reader geometry', /<main\s+id="main-content"\s*>/.test(kdvMain) && !/<main[^>]*(?:class=|data-reader-root|data-reader-rail-main)/.test(kdvMain)],
    ['SRL-S16', 'Kod Da Vinci has no nested rail geometry owner', !kdvMain.includes('data-reader-rail-main') && !kdvMain.includes('data-reader-root')],
    ['SRL-S17', 'Kod Da Vinci route-local page-wrap hrail adapter is fully retired', !kdvChrome.includes('page-wrap--hrail') && !kdvChrome.includes('--hrail-canvas-inset-left') && !kdvRoute.includes('page-wrap--hrail')],
    ['SRL-S18', 'ReaderSettings contains a dedicated padded page-wrap shell contract', kdvShell.length > 0],
    ['SRL-S19', 'Kod Da Vinci outer shell retires only the inherited max-width cap', kdvShell.includes('max-width: none')],
    ['SRL-S20', 'Kod Da Vinci outer shell exposes its true 24px inline inset to ReaderRail', kdvShell.includes('--hrail-base-inset: 24px')],
    ['SRL-S21', 'Kod Da Vinci shell contract has no width, offset, transform or overflow masking workaround', !/(?:^|\n)\s*(?:width|margin-left|margin-right|left|right|transform|overflow|overflow-x)\s*:/.test(kdvShell) && !kdvShell.includes('100vw') && !kdvShell.includes('100dvw')],
    ['SRL-S22', 'Kod Da Vinci classless base-shell reset remains present', siteCss.includes('.page-wrap>main:not([class]){width:auto!important;max-width:100%!important;margin:0!important;padding:0!important}')],
    ['SRL-S23', 'Hermenevtika retains its real 24px shell inset', rail.includes('.article-main.article-main--hrail{--hrail-base-inset:24px}')],
    ['SRL-S24', 'Kod Da Vinci route contains exactly one static rail owner marker', (kdvRoute.match(/data-reader-rail-main/g) || []).length === 1 && !kdvChrome.includes('data-reader-rail-main') && !kdvMain.includes('data-reader-rail-main')],
    ['SRL-S25', 'Kod Da Vinci reader root and rail shell are the same static element', (kdvRoute.match(/data-reader-root/g) || []).length === 1 && /<div[^>]*class="page-wrap"[^>]*data-reader-root[^>]*data-reader-rail-main[^>]*>/.test(kdvRoute)],
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
      const element = selector ? document.querySelector(selector) : null;
      if (!(element instanceof Element)) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height, centerX: box.left + box.width / 2 };
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
    const safeReadableLeft = resolveVar('--hrail-safe-readable-left-viewport');
    const clientWidth = document.documentElement.clientWidth;
    const bodyBox = document.body.getBoundingClientRect();
    const layoutLeft = bodyBox.left;
    const layoutRight = bodyBox.right;
    const layoutCenter = bodyBox.left + bodyBox.width / 2;
    const mainRect = rect(selectors.main);
    const summary = rect(selectors.summary);
    const prose = rect(selectors.prose);
    const centeredReadableLeft = prose ? layoutCenter - prose.width / 2 : null;
    return {
      rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth,
      layoutLeft,
      layoutRight,
      layoutCenter,
      railVisible: visible(document.querySelector('.hrail')),
      rail: rect('.hrail'),
      main: mainRect,
      summary,
      prose,
      safeReadableLeft: Number.isFinite(safeReadableLeft) ? safeReadableLeft : null,
      centeredReadableLeft,
      expectedReadableLeft: Number.isFinite(safeReadableLeft) && centeredReadableLeft != null ? Math.max(centeredReadableLeft, safeReadableLeft) : null,
      railOwnerCount: document.querySelectorAll('[data-reader-rail-main]').length,
      readerRootCount: document.querySelectorAll('[data-reader-root]').length,
      rootIsRailOwner: main instanceof Element && main.matches('[data-reader-root][data-reader-rail-main]'),
    };
  }, route);
}

function recordLayout(route, width, state) {
  const desktop = width >= 1200;
  const id = `${route.key}-L${width}`;
  record(`${id}-01`, `${route.label} ${width}px rail visibility matches breakpoint`, state.railVisible === desktop, state, 'layout');
  record(`${id}-02`, `${route.label} ${width}px has no horizontal overflow`, state.scrollWidth - state.clientWidth <= 1, state, 'layout');
  record(`${id}-03`, `${route.label} ${width}px reader shell stays inside the real layout scrollport`, Boolean(state.main && state.main.width > 300 && state.main.left >= state.layoutLeft - 1 && state.main.right <= state.layoutRight + 1), state, 'layout');
  record(`${id}-04`, `${route.label} ${width}px summary and prose centres differ by at most 2px`, Boolean(state.summary && state.prose && Math.abs(state.summary.centerX - state.prose.centerX) <= 2), state, 'layout');
  record(`${id}-05`, `${route.label} ${width}px summary and prose widths differ by at most 2px`, Boolean(state.summary && state.prose && Math.abs(state.summary.width - state.prose.width) <= 2), state, 'layout');
  if (!desktop) {
    record(`${id}-06`, `${route.label} ${width}px reader shell stays centred in the real layout scrollport`, Boolean(state.main && Math.abs(state.main.centerX - state.layoutCenter) <= 3), state, 'layout');
    return;
  }
  record(`${id}-06`, `${route.label} ${width}px readable summary and prose clear rail plus declared gap`, Boolean(state.safeReadableLeft != null && state.prose && state.summary && state.prose.left >= state.safeReadableLeft - 2 && state.summary.left >= state.safeReadableLeft - 2), state, 'layout');
  record(`${id}-07`, `${route.label} ${width}px readable content uses only the minimum rail collision shift`, Boolean(state.prose && state.expectedReadableLeft != null && Math.abs(state.prose.left - state.expectedReadableLeft) <= 3), state, 'layout');
  const minimum = width >= 1280 ? 760 : 700;
  record(`${id}-08`, `${route.label} ${width}px normal prose is not pathologically narrow`, Boolean(state.prose && state.prose.width >= minimum), { minimum, state }, 'layout');
  const centeringSafe = state.centeredReadableLeft != null && state.safeReadableLeft != null && state.centeredReadableLeft >= state.safeReadableLeft - 1;
  record(`${id}-09`, `${route.label} ${width}px readable content returns to layout centre whenever rail clearance allows it`, Boolean(!centeringSafe || (state.prose && state.summary && Math.abs(state.prose.centerX - state.layoutCenter) <= 3 && Math.abs(state.summary.centerX - state.layoutCenter) <= 3)), { centeringSafe, state }, 'layout');
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
      const centeringSafe = state.centeredReadableLeft != null && state.safeReadableLeft != null && state.centeredReadableLeft >= state.safeReadableLeft - 1;
      record(`${route.key}-M-${measure}-05`, `${route.label} ${measure} keeps layout centre whenever selected measure clears the rail`, Boolean(!centeringSafe || (state.prose && state.summary && Math.abs(state.prose.centerX - state.layoutCenter) <= 3 && Math.abs(state.summary.centerX - state.layoutCenter) <= 3)), { centeringSafe, state }, 'measure');
    }
    record(`${route.key}-M-ORDER`, `${route.label} measure modes grow monotonically`, measured.narrow < measured.normal && measured.normal < measured.wide, measured, 'measure');
  }
  record('SRL-RUNTIME-ERRORS', 'standalone reader layout guard has no uncaught page errors', pageErrors.length === 0, pageErrors, 'runtime');
} finally {
  await context.close();
  await browser.close();
}

assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'layout guard check IDs must be unique');
assert.ok(checks.length >= 184, `Standalone reader layout guard requires at least 184 checks, got ${checks.length}`);
const failed = checks.filter((item) => !item.pass);
const summary = { sha: process.env.SOURCE_SHA || process.env.GITHUB_SHA || null, checks: checks.length, passed: checks.length - failed.length, failed: failed.length };
fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify({ summary, checks }, null, 2));
fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), ['# Standalone reader layout guards', '', `- SHA: \`${summary.sha || 'local'}\``, `- Checks: **${summary.checks}**`, `- Passed: **${summary.passed}**`, `- Failed: **${summary.failed}**`, '', '| ID | Result | Description |', '|---|---|---|', ...checks.map((item) => `| ${item.id} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.description.replace(/\|/g, '\\|')} |`)].join('\n'));
checks.forEach((item) => {
  console.log(`[STANDALONE-READER-LAYOUT] ${item.pass ? 'PASS' : 'FAIL'} ${item.id} :: ${item.description}`);
  if (!item.pass) console.log(`[STANDALONE-READER-LAYOUT-EVIDENCE] ${item.id} :: ${JSON.stringify(item.evidence)}`);
});
console.log('[STANDALONE-READER-LAYOUT-SUMMARY]', JSON.stringify(summary));
assert.equal(failed.length, 0, `Standalone reader layout guards failed: ${failed.map((item) => item.id).join(', ')}`);
console.log('Standalone reader layout guards: PASS');
