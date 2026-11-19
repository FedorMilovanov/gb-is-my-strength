#!/usr/bin/env node
/** Exact-head /articles/ witness. Existing Playwright + explicitly supplied axe.
 * --origin=URL --output=DIR --axe=FILE [--transfer=MANIFEST] [--baseline=HTML]
 * --development=true labels dirty dev renders; they are never final acceptance.
 * --suite=print emits actual Chromium PDFs; no emulated-print substitute.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { parse } from 'parse5';
import { assertCatalogImageBudget, attribute, catalogProvenance, descendants, inspectCatalogHtml, parseCatalogArguments, projectCatalog } from './articles-editorial-contract.mjs';
const require = createRequire(import.meta.url);
const { monitorRuntime } = require('./lib/browser-runtime-noise.js');
const root = fileURLToPath(new URL('../', import.meta.url));
const args = parseCatalogArguments(process.argv.slice(2), ['origin', 'output', 'axe', 'transfer', 'baseline', 'development', 'suite']);
if (args.development) assert.ok(['true', 'false'].includes(args.development), 'Use --development=true|false');
const origin = args.origin || 'http://127.0.0.1:4173', development = args.development === 'true', suite = args.suite || 'full';
assert.ok(['full', 'responsive', 'keyboard', 'forced-colors', 'text', 'interactions', 'print'].includes(suite));
const selected = (name) => suite === 'full' || suite === name;
assert.equal(new URL(origin).origin, origin, 'Origin must be an http(s) origin without a path/trailing slash');
assert.ok(/^https?:/.test(origin));
const out = path.resolve(root, args.output || 'reports/articles-editorial-integration-20261118/browser');
assert.ok(!fs.existsSync(path.join(out, 'report.json')), 'Refusing to overwrite an earlier browser report');
fs.mkdirSync(path.join(out, 'screens'), { recursive: true }); fs.mkdirSync(path.join(out, 'print'), { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/search-manifest.json'))), ownership = JSON.parse(fs.readFileSync(path.join(root, 'migration/page-ownership.json')));
const expected = projectCatalog(manifest, ownership), baselineHtml = args.baseline ? fs.readFileSync(args.baseline, 'utf8') : undefined;
const provenance = catalogProvenance(args.transfer);
assert.ok(development || !provenance.worktree, 'Commit source before final browser acceptance');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const expectedHtmlHash = development ? null : sha(fs.readFileSync(path.join(root, 'dist/articles/index.html')));
const axe = selected('responsive') ? fs.readFileSync(args.axe || path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8') : '';
const report = { ...provenance, development, suite, notProduction: true, engine: 'Chromium', version: null, expectedHtmlHash, expected: { articles: expected.filter((i) => i.type === 'article').length, series: expected.filter((i) => i.type === 'series').length }, cases: [], keyboards: [], forcedColors: [], text: [], interactions: [], printCases: [], destinations: [], assets: [], problems: [], sharedSystemStatus: { searchEscape: 'OPEN_FAIL_NOT_REPAIRED', scope: 'Prior shared Search Escape failure remains open; the smoke below is a narrow observation, not a repair or global clearance.' }, note: 'Local lab/Chromium only. No physical device/UIzoom/Windows-HC/printer/screen-reader/full-WCAG/owner-artistic/production signoff. No-JS retains the existing SSR palette. Playwright Chromium disables BFCache; native reload-Back focus reset is recorded, not repaired or claimed as focus restoration. External telemetry is classified only by the existing structured runtime-noise owner. Shared Search Escape is not repaired by this lane.' };
const browser = await chromium.launch({ executablePath: process.env.ARTICLES_CHROMIUM_EXECUTABLE || process.env.JOURNAL_CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage'] }); report.version = browser.version();
async function contextFor(width, theme, extra = {}) { const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1080 }, colorScheme: theme, serviceWorkers: 'allow', ...extra }); context.setDefaultTimeout(10000); return context; }
async function load(page) {
  const response = await page.goto(origin + '/articles/', { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200);
  // Capture the original response before SW activation/dev HMR can evict its CDP id.
  const bytes = await response.body();
  if (expectedHtmlHash) assert.equal(sha(bytes), expectedHtmlHash, 'Served bytes differ from pinned dist');
  await page.waitForLoadState('networkidle'); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(100);
  return { html: bytes.toString('utf8'), fromServiceWorker: response.fromServiceWorker() };
}
// Poll from the host even with Product JS disabled. Always call after a key:
// a quiet first30ms does not mean the native smooth scroll will not start.
// No scrollIntoView, forced focus or reduced-motion override repairs a key path.
async function settle(page) {
  const started = Date.now(), samples = [];
  let prior = await page.evaluate(() => scrollY), stable = 0;
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(60); const current = await page.evaluate(() => scrollY);
    samples.push({ elapsedMs: Date.now() - started, y: current });
    stable = Math.abs(current - prior) < .5 ? stable + 1 : 0; prior = current;
    if (stable >= 5) return { elapsedMs: Date.now() - started, samples };
  }
  throw new Error('Native scroll did not settle');
}
async function geometry(page) {
  return page.evaluate(() => {
    const paper = document.querySelector('.journal-edition--articles'), issues = [], clamped = [];
    const walker = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT); let nodeCount = 0, rectCount = 0;
    while (walker.nextNode()) {
      const n = walker.currentNode, p = n.parentElement;
      if (!n.textContent.trim() || p.closest('script,style,noscript,[hidden]') || !p.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const range = document.createRange(); range.selectNodeContents(n); nodeCount++;
      for (const r of range.getClientRects()) { if (r.width < .05 || !r.height) continue; rectCount++; if (r.left < -1 || r.right > document.documentElement.clientWidth + 1) issues.push({ text: n.textContent.trim().slice(0, 100), rect: r.toJSON() }); }
    }
    for (const n of paper.querySelectorAll('.h-article-title,.h-article-abstract')) { const s = getComputedStyle(n); if (!['none', 'unset', ''].includes(s.webkitLineClamp) || /hidden|clip/.test(s.overflowY)) clamped.push(n.textContent.slice(0, 80)); }
    const first = paper.querySelector('[data-catalog-route]'), title = first.querySelector('.h-article-title');
    return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, nodeCount, rectCount, issues, clamped, rootFont: getComputedStyle(document.documentElement).fontSize, readerScale: getComputedStyle(document.documentElement).getPropertyValue('--gb-reader-font-scale').trim(), titleSize: getComputedStyle(title).fontSize, titleWidth: title.getBoundingClientRect().width, firstMaterialY: first.getBoundingClientRect().top + scrollY, documentHeight: document.documentElement.scrollHeight };
  });
}
async function assertGeometry(page) { const result = await geometry(page); assert.equal(result.overflow, 0); assert.deepEqual(result.issues, []); assert.deepEqual(result.clamped, []); return result; }
async function auditAxe(page) { await page.addScriptTag({ content: axe }); const result = await page.evaluate(async () => { const r = await axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }); return { violations: r.violations, incomplete: r.incomplete }; }); return result; }
async function run(bucket, item, fn) { try { await fn(item); console.log('PASS articles', JSON.stringify(Object.fromEntries(Object.entries(item).filter(([k]) => ['width', 'theme', 'javaScriptEnabled', 'mode', 'paper'].includes(k))))); } catch (error) { item.failure = error.message; item.stack = error.stack; report.problems.push({ width: item.width, theme: item.theme, mode: item.mode, failure: error.message }); console.error(error.stack); } finally { bucket.push(item); } }
try {
 if (selected('responsive')) {
  for (const width of [320, 390, 768, 1440, 1920]) for (const theme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
    const context = await contextFor(width, theme, { javaScriptEnabled }); const page = await context.newPage(); const item = { width, theme, javaScriptEnabled, runtime: [], clientAborts: [] }; monitorRuntime(page, item.runtime, { clientAborts: item.clientAborts, isIgnoredConsole: (message) => development && /^\[vite\] (?:connecting\.\.\.|connected\.|hot updated:)/.test(message) });
    try { await run(report.cases, item, async () => {
      await context.addInitScript(() => { window.__catalogCLS = 0; window.__catalogShiftEntries = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) { window.__catalogCLS += e.value; window.__catalogShiftEntries.push({ at: e.startTime, value: e.value, sources: e.sources.map((s) => ({ node: s.node?.id || s.node?.className || s.node?.nodeName, previousRect: s.previousRect.toJSON(), currentRect: s.currentRect.toJSON() })) }); } })).observe({ type: 'layout-shift', buffered: true }); } catch {} });
      const response = await load(page); item.projection = inspectCatalogHtml(response.html, { manifest, ownership, baselineHtml }); item.fromServiceWorker = response.fromServiceWorker; item.liveProjection = inspectCatalogHtml(await page.content(), { manifest, ownership, baselineHtml }); item.geometry = await assertGeometry(page);
      item.coldFonts = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\.woff2(?:\?|$)/.test(e.name)).map((e) => ({ url: e.name, bytes: e.encodedBodySize, duration: e.duration })));
      item.cls = await page.evaluate(() => window.__catalogCLS ?? null); item.layoutShifts = await page.evaluate(() => window.__catalogShiftEntries ?? []); item.themeActual = await page.locator('html').getAttribute('data-reader-theme');
      if (javaScriptEnabled) assert.equal(item.themeActual, theme);
      await page.screenshot({ path: path.join(out, 'screens', `opening-${width}-${theme}-${javaScriptEnabled ? 'js' : 'nojs'}.png`) });
      item.indexImageCount = await page.locator('[data-catalog-source] :is(img,picture,source)').count(); assert.equal(item.indexImageCount, 0);
      await page.locator('.articles-hero-links a[href="#catalog-materials"]').click(); await settle(page); await page.screenshot({ path: path.join(out, 'screens', `materials-${width}-${theme}-${javaScriptEnabled ? 'js' : 'nojs'}.png`) });
      if (javaScriptEnabled) { item.axe = await auditAxe(page); assert.deepEqual(item.axe.violations, []); assert.deepEqual(item.axe.incomplete, []); }
      const anchors = await page.locator('[data-catalog-topics] a').evaluateAll((els) => els.map((e) => e.getAttribute('href'))); item.nativeTopicAnchors = anchors.length;
      for (const href of [anchors[0], anchors.at(-1)]) { await page.locator(`[data-catalog-topics] a[href="${href}"]`).scrollIntoViewIfNeeded(); await settle(page); await page.locator(`[data-catalog-topics] a[href="${href}"]`).click(); await settle(page); assert.equal(new URL(page.url()).hash, encodeURI(href)); const target = page.locator(`[id="${decodeURIComponent(href.slice(1))}"]`); assert.ok(await target.isVisible()); }
      await page.locator('#catalog-series').scrollIntoViewIfNeeded(); await page.waitForTimeout(350); if (javaScriptEnabled) { item.seriesAxe = await auditAxe(page); assert.deepEqual(item.seriesAxe.violations, []); assert.deepEqual(item.seriesAxe.incomplete, []); }
      await page.screenshot({ path: path.join(out, 'screens', `series-${width}-${theme}-${javaScriptEnabled ? 'js' : 'nojs'}.png`) });
      const curated = page.locator('[data-catalog-featured-repeat]');
      if (await curated.count()) { await curated.scrollIntoViewIfNeeded(); await settle(page); item.curatedImageDecoded = await curated.locator('img').evaluate((e) => e.complete && e.naturalWidth > 0); assert.equal(item.curatedImageDecoded, true); await page.screenshot({ path: path.join(out, 'screens', `curated-${width}-${theme}-${javaScriptEnabled ? 'js' : 'nojs'}.png`) }); }
      item.readerImageRequests = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.initiatorType === 'img').map((e) => ({ url: e.name, bytes: e.encodedBodySize, duration: e.duration })));
      const renderedImageSources = await page.locator('.journal-edition--articles img').evaluateAll((els) => els.map((e) => e.currentSrc));
      item.imageBudget = assertCatalogImageBudget(item.readerImageRequests, renderedImageSources);
      assert.deepEqual(item.runtime, []);
    }); } finally { await context.close(); }
  }
 }
 if (selected('keyboard')) {
  for (const width of [390, 1440]) for (const javaScriptEnabled of [true, false]) {
    const context = await contextFor(width, 'light', { javaScriptEnabled }); const page = await context.newPage();
    try { await run(report.keyboards, { width, javaScriptEnabled, mode: 'native-full-list-forward-reverse' }, async (item) => {
      await load(page); await page.locator('.articles-hero-links a[href="#catalog-materials"]').focus(); await page.keyboard.press('Enter'); await settle(page);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'catalog-materials');
      const order = await page.locator('[data-catalog-route],[data-catalog-series]').evaluateAll((els) => els.map((e) => e.getAttribute('href'))); const steps = []; item.steps = steps;
      async function check(expectedHref, key) {
        await page.keyboard.press(key); const settling = await settle(page);
        const focus = await page.evaluate(() => {
          const e = document.activeElement, s = getComputedStyle(e), r = e.getBoundingClientRect(), title = e.querySelector('.h-article-title'), heading = title?.getBoundingClientRect(), bar = document.querySelector('.mcp-top'), br = bar?.getBoundingClientRect(), bs = bar && getComputedStyle(bar);
          const hit = heading && document.elementFromPoint(Math.min(document.documentElement.clientWidth - 1, (heading.left + heading.right) / 2), (heading.top + heading.bottom) / 2);
          return { href: e.getAttribute('href'), focusVisible: e.matches(':focus-visible'), outlineWidth: parseFloat(s.outlineWidth), outlineStyle: s.outlineStyle, top: r.top, bottom: r.bottom, headingTop: heading?.top, headingBottom: heading?.bottom, headingPaint: Boolean(hit && e.contains(hit)), viewport: innerHeight, headerBottom: br && bs.visibility !== 'hidden' && bs.display !== 'none' && br.bottom > 0 ? br.bottom : 0 };
        });
        steps.push({ key, ...focus, settling });
        assert.equal(focus.href, expectedHref); assert.equal(focus.focusVisible, true);
        assert.ok(focus.outlineWidth >= 2 && focus.outlineStyle !== 'none');
        assert.ok(focus.headingTop >= focus.headerBottom - 1 && focus.headingBottom <= focus.viewport + 1, JSON.stringify(focus));
        assert.equal(focus.headingPaint, true, JSON.stringify(focus));
      }
      for (const href of order) await check(href, 'Tab');
      for (const href of order.slice(0, -1).reverse()) await check(href, 'Shift+Tab');
      item.destinations = order.length;
      // Real last-link Enter → destination → native Back, not a synthetic click.
      const last = page.locator('[data-catalog-series]').last();
      await last.focus(); await settle(page); const href = await last.getAttribute('href');
      item.lastActivationScrollY = await page.evaluate(() => scrollY);
      await page.keyboard.press('Enter'); await page.waitForURL((url) => url.pathname === new URL(href, origin).pathname);
      assert.equal((await page.locator('h1').count()) > 0, true); item.lastActivated = page.url();
      await page.goBack({ waitUntil: 'networkidle' }); await settle(page);
      assert.equal(new URL(page.url()).pathname, '/articles/');
      item.lastReturnFocus = await page.evaluate(() => document.activeElement.getAttribute('href'));
      item.lastReturnFocusRestored = item.lastReturnFocus === href;
      item.lastReturnScrollY = await page.evaluate(() => scrollY);
      item.lastReturnScrollRestored = Math.abs(item.lastReturnScrollY - item.lastActivationScrollY) <= 1;
      assert.equal(item.lastReturnScrollRestored, true, 'Native reload-Back did not preserve last-link scroll position');
      assert.equal(await page.locator('[data-catalog-route],[data-catalog-series]').count(), expected.length);
      item.nativeReloadBackNote = 'Playwright disables BFCache; no Product or test focus-restoration script is injected.';
      await page.screenshot({ path: path.join(out, 'screens', `last-return-${width}-${javaScriptEnabled ? 'js' : 'nojs'}.png`) });
    }); } finally { await context.close(); }
  }
 }
 if (selected('forced-colors')) {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    const context = await contextFor(width, theme, { forcedColors: 'active' }); const page = await context.newPage();
    try { await run(report.forcedColors, { width, theme, mode: 'forced-colors-system-palette' }, async (item) => {
      await load(page); item.colors = await page.evaluate(() => { const color = (name) => { const e = document.createElement('span'); e.style.color = name; document.body.append(e); const value = getComputedStyle(e).color; e.remove(); return value; }; return { canvas: color('Canvas'), highlight: color('Highlight'), links: [...document.querySelectorAll('.je-masthead__nav a')].map((e) => ({ href: e.getAttribute('href'), current: e.hasAttribute('aria-current'), border: getComputedStyle(e).borderBottomColor })) }; });
      for (const link of item.colors.links) assert.equal(link.border, link.current ? item.colors.highlight : item.colors.canvas);
      for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); if (await page.locator('.je-masthead__nav a[aria-current]').evaluate((e) => e === document.activeElement)) break; }
      item.focus = await page.locator('.je-masthead__nav a[aria-current]').evaluate((e) => { const s = getComputedStyle(e); return { reached: e === document.activeElement, visible: e.matches(':focus-visible'), width: parseFloat(s.outlineWidth), style: s.outlineStyle }; }); assert.ok(item.focus.reached && item.focus.visible && item.focus.width >= 2 && item.focus.style !== 'none');
      await page.screenshot({ path: path.join(out, 'screens', `forced-${width}-${theme}.png`) });
    }); } finally { await context.close(); }
  }
 }
 if (selected('text')) {
  for (const width of [320, 1440]) for (const theme of ['light', 'dark']) for (const mode of ['root200-reader-max125', 'text-spacing', 'reduced-motion']) {
    const context = await contextFor(width, theme, mode === 'reduced-motion' ? { reducedMotion: 'reduce' } : {}); const page = await context.newPage();
    try { await run(report.text, { width, theme, mode }, async (item) => {
      await load(page);
      if (mode === 'root200-reader-max125') { await page.evaluate(() => { window.GBReaderPreferences.set({ fontScale: 1.4 }, { source: 'articles-read-only-diagnostic' }); document.documentElement.style.fontSize = '200%'; }); item.apiScale = await page.evaluate(() => window.GBReaderPreferences.get().fontScale); assert.equal(item.apiScale, 1.25); }
      if (mode === 'text-spacing') await page.addStyleTag({ content: '.journal-edition--articles * { line-height:1.5 !important; letter-spacing:.12em !important; word-spacing:.16em !important; } .journal-edition--articles p { margin-bottom:2em !important; }' });
      item.geometry = await assertGeometry(page); await page.locator('[data-catalog-route]').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, 'screens', `${mode}-${width}-${theme}.png`) });
    }); } finally { await context.close(); }
  }
 }
 if (selected('interactions')) {
  const context = await contextFor(1440, 'light'), page = await context.newPage();
  try { await run(report.interactions, { mode: 'theme-search-smoke-discovery' }, async (item) => {
    await load(page); await page.locator('[data-journal-theme]').click(); assert.equal(await page.locator('html').getAttribute('data-reader-theme'), 'dark'); await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.locator('html').getAttribute('data-reader-theme'), 'dark'); item.themePersistence = true;
    const tab = await context.newPage(); await tab.goto(origin + '/articles/', { waitUntil: 'networkidle' }); assert.equal(await tab.locator('html').getAttribute('data-reader-theme'), 'dark'); await tab.close(); item.crossTabTheme = true;
    await page.keyboard.press('Control+k'); await page.locator('.cp-backdrop.is-open').waitFor();
    await page.locator('.cp-input').fill('Римлянам 7'); await page.waitForTimeout(800); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    item.searchEscapeWithQueryObservedClosed = await page.locator('.cp-backdrop.is-open').count() === 0;
    if (!item.searchEscapeWithQueryObservedClosed) await page.locator('.cp-close').click();
    await page.locator('.cp-backdrop.is-open').waitFor({ state: 'hidden' }); assert.equal(await page.locator('.cp-backdrop').count(), 1); item.singleSearchPalette = true;
    if (!development) {
      for (const original of expected) {
        const url = new URL(original.url, origin), response = await context.request.get(url.href); assert.equal(response.status(), 200, original.url);
        const destination = { url: original.url, status: response.status(), fragmentPresent: null };
        if (url.hash) { const id = decodeURIComponent(url.hash.slice(1)); const nodes = descendants(parse(await response.text())); destination.fragmentPresent = nodes.filter((n) => attribute(n, 'id') === id).length === 1; assert.equal(destination.fragmentPresent, true, original.url); }
        report.destinations.push(destination);
      }
      for (const image of new Set(expected.map((i) => i.image))) {
        const response = await context.request.get(new URL(image, origin).href); assert.equal(response.status(), 200, image); assert.match(response.headers()['content-type'] || '', /^image\//);
        report.assets.push({ url: image, status: response.status(), bytes: (await response.body()).length });
      }
    }
    await page.goto(origin + '/journal/', { waitUntil: 'networkidle' }); await page.locator('.je-masthead__nav a[href="/articles/"]').click(); await page.waitForURL('**/articles/'); await page.locator('[data-catalog-route]').first().click(); await page.waitForURL((url) => url.pathname !== '/articles/'); assert.ok(await page.locator('h1').isVisible()); item.publication = page.url(); await page.goBack({ waitUntil: 'networkidle' }); assert.equal(new URL(page.url()).pathname, '/articles/'); assert.equal(await page.locator('[data-catalog-route],[data-catalog-series]').count(), expected.length); await page.goForward({ waitUntil: 'networkidle' }); assert.equal(page.url(), item.publication); await page.goBack({ waitUntil: 'networkidle' }); assert.equal(new URL(page.url()).pathname, '/articles/'); await page.goBack({ waitUntil: 'networkidle' }); assert.equal(new URL(page.url()).pathname, '/journal/'); item.nativeBackForwardRoundTrip = true;
  }); } finally { await context.close(); }
 }
 if (selected('print')) for (const paper of ['A4', 'Letter']) for (const theme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
  const context = await contextFor(1440, theme, { javaScriptEnabled }), page = await context.newPage();
  try { await run(report.printCases, { paper, theme, javaScriptEnabled }, async (item) => { await load(page); await page.emulateMedia({ media: 'print' }); await page.evaluate(() => document.fonts.ready); item.dom = await page.evaluate(() => ({ heading: document.querySelector('h1').textContent, sourceTitles: [...document.querySelectorAll('[data-catalog-route] .h-article-title,[data-catalog-series] .h-article-title')].map((e) => e.textContent), screenOnlyLabels: ['Все материалы ↓', 'Поиск по сайту…', 'Открыть поиск по сайту'] }));
    const name = `catalog-${paper}-${theme}-${javaScriptEnabled ? 'js' : 'nojs'}.pdf`; await page.pdf({ path: path.join(out, 'print', name), format: paper, printBackground: true, displayHeaderFooter: false, margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' } }); item.pdf = `print/${name}`; item.bytes = fs.statSync(path.join(out, item.pdf)).size; assert.ok(item.bytes > 10000); }); } finally { await context.close(); }
 }
} finally { await browser.close(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
assert.deepEqual(report.problems, []);
for (const [name, bucket, count] of [['responsive', 'cases', 20], ['keyboard', 'keyboards', 4], ['forced-colors', 'forcedColors', 4], ['text', 'text', 12], ['interactions', 'interactions', 1], ['print', 'printCases', 8]]) {
  if (selected(name)) assert.equal(report[bucket].length, count, `Incomplete ${name} matrix`);
}
if (!development && !args.transfer) assert.deepEqual(catalogProvenance(), provenance, 'Source head/worktree changed during the run');
if (args.transfer) catalogProvenance(args.transfer);
console.log('ARTICLES BROWSER COMPLETE', JSON.stringify({ responsive: report.cases.length, keyboard: report.keyboards.length, forcedColors: report.forcedColors.length, text: report.text.length, actualPDFs: report.printCases.length, interactions: report.interactions.length, problems: report.problems.length }));
