#!/usr/bin/env node
/** Read-only comparison of actual catalog and neutral native history behavior.
 * --origin=http(s)://HOST --output=NEW_DIR [--transfer=MANIFEST]
 * Uses the same Chromium/default BFCache policy as the strict browser gate.
 * Never changes Product CSS, scroll/focus restoration or an acceptance assertion.
 * Exit0 means diagnostic collection succeeded, NOT that native Back passed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { catalogProvenance, parseCatalogArguments } from './articles-editorial-contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = parseCatalogArguments(process.argv.slice(2), ['origin', 'output', 'transfer']);
assert.ok(args.origin && args.output, '--origin and a new --output directory are required');
const origin = new URL(args.origin).origin;
assert.equal(origin, args.origin, 'Use an http(s) origin without a path/trailing slash');
assert.match(origin, /^https?:/);
const provenance = catalogProvenance(args.transfer);
assert.ok(!provenance.worktree, 'Commit source before a pinned diagnostic');
const out = path.resolve(root, args.output);
assert.ok(!fs.existsSync(out), 'Refusing to overwrite earlier diagnostic evidence');
fs.mkdirSync(out, { recursive: true });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const htmlHash = sha(fs.readFileSync(path.join(root, 'dist/articles/index.html')));
// Fixed-size synthetic rows belong only to this QA fixture, never the feed.
const rows = Array.from({ length: 90 }, (_, i) => `<li><a data-fixture-entry="${i}" id="fixture-entry-${i}" href="/qa-native-target/"><h3>Neutral heading ${i}</h3><p>QA-only plain text row ${i}. No Product facts, fonts, scripts, images or external CSS.</p></a></li>`).join('');
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://qa.invalid');
  let html;
  if (url.pathname === '/qa-native-back/') {
    const behavior = url.searchParams.get('behavior');
    if (!['auto', 'smooth'].includes(behavior)) { response.writeHead(400); response.end(); return; }
    html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Neutral native Back fixture</title><style>html{scroll-behavior:${behavior}}body{margin:20px;font:18px/1.6 system-ui}header{min-height:500px}section{scroll-margin-top:75px}li{margin:24px 0;min-height:160px}a{display:block}:focus-visible{outline:3px solid blue}</style><header><h1>Neutral native Back fixture</h1><p>QA only. Not a publication, catalog or source authority.</p><a id="fixture-jump" href="#fixture-materials">Materials</a></header><section id="fixture-materials" tabindex="-1"><h2>Materials</h2><ul>${rows}</ul></section></html>`;
  } else if (url.pathname === '/qa-native-target/') {
    html = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Neutral target</title><h1>Neutral target</h1><p>QA only. No Product authority.</p><a href="/qa-native-back/?behavior=auto">Neutral fallback</a></html>';
  } else { response.writeHead(404); response.end(); return; }
  const bytes = Buffer.from(html);
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': bytes.length, 'X-QA-Only-Fixture': 'neutral-native-back' });
  response.end(bytes);
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '0.0.0.0', resolve); });
const neutralOrigin = `http://127.0.0.1:${server.address().port}`;
const report = { ...provenance, notProduction: true, diagnosticOnly: true, productMutation: false, browserRoutesIntercepted: false, cacheExplicitlyDisabled: false, expectedHtmlHash: htmlHash, cases: [], note: 'Neutral controls do not waive the strict native Back assertion. Native history length does not guarantee a destination, scroll position or focus. A successful collection exit is not Product acceptance.' };
let browser;
async function settle(page) {
  let previous = await page.evaluate(() => scrollY), stable = 0;
  for (let n = 0; n < 80; n++) {
    await page.waitForTimeout(60); const y = await page.evaluate(() => scrollY);
    stable = Math.abs(y - previous) < .5 ? stable + 1 : 0; previous = y;
    if (stable >= 5) return;
  }
  throw new Error('Native scroll did not settle');
}
async function state(page) {
  return page.evaluate(() => ({ url: location.href, y: scrollY, height: document.documentElement.scrollHeight, clientWidth: document.documentElement.clientWidth, behavior: getComputedStyle(document.documentElement).scrollBehavior, focus: document.activeElement.id || document.activeElement.tagName, focusHref: document.activeElement.getAttribute('href'), historyLength: history.length, scrollRestoration: history.scrollRestoration, navigationType: performance.getEntriesByType('navigation')[0]?.type }));
}
const variants = [...['auto', 'smooth'].flatMap((behavior) => [false, true].map((hash) => ({ name: `neutral-${behavior}-${hash ? 'hash' : 'nohash'}`, neutral: true, behavior, hash }))), { name: 'actual-hash', hash: true }, { name: 'actual-nohash', hash: false }];
try {
  browser = await chromium.launch({ executablePath: process.env.ARTICLES_CHROMIUM_EXECUTABLE || process.env.JOURNAL_CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  report.version = browser.version();
  for (const width of [390, 1440]) for (const javaScriptEnabled of [false, true]) for (const variant of variants) {
    const item = { width, javaScriptEnabled, variant: variant.name }; report.cases.push(item);
    const context = await browser.newContext({ javaScriptEnabled, viewport: { width, height: width === 390 ? 844 : 1080 }, colorScheme: 'light', serviceWorkers: 'allow' });
    context.setDefaultTimeout(10000); const page = await context.newPage();
    try {
      const cdp = await context.newCDPSession(page), events = [];
      cdp.on('Page.frameNavigated', (event) => events.push({ url: event.frame.url, type: event.type })); await cdp.send('Page.enable');
      const host = variant.neutral ? neutralOrigin : origin;
      const response = await page.goto(host + (variant.neutral ? `/qa-native-back/?behavior=${variant.behavior}` : '/articles/'), { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200); item.responseSha256 = sha(await response.body());
      if (!variant.neutral) assert.equal(item.responseSha256, htmlHash, 'Served actual HTML differs from pinned dist');
      await page.evaluate(() => document.fonts.ready);
      if (variant.hash) {
        await page.locator(variant.neutral ? '#fixture-jump' : '.articles-hero-links a[href="#catalog-materials"]').focus();
        await page.keyboard.press('Enter'); await settle(page);
      }
      item.afterFragment = await state(page);
      const links = page.locator(variant.neutral ? '[data-fixture-entry]' : '[data-catalog-route],[data-catalog-series]');
      await links.nth(await links.count() - 2).focus(); await page.keyboard.press('Tab'); await settle(page);
      item.before = await state(page); item.historyBefore = await cdp.send('Page.getNavigationHistory');
      const href = await links.last().getAttribute('href'); assert.equal(item.before.focusHref, href);
      await page.keyboard.press('Enter'); await page.waitForURL((url) => url.pathname === new URL(href, host).pathname);
      await page.waitForLoadState('networkidle'); item.target = await state(page);
      await page.goBack({ waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); await settle(page);
      item.after = await state(page); await page.waitForTimeout(1200); item.after1200 = await state(page);
      item.historyAfter = await cdp.send('Page.getNavigationHistory'); item.navigationEvents = events;
      item.scrollRestored = Math.abs(item.after1200.y - item.before.y) <= 1;
      if (!javaScriptEnabled && variant.hash) { item.screenshot = `${variant.name}-${width}-nojs-after.png`; await page.screenshot({ path: path.join(out, item.screenshot) }); }
      console.log(JSON.stringify({ width, javaScriptEnabled, variant: variant.name, before: item.before.y, after: item.after1200.y, scrollRestored: item.scrollRestored }));
    } catch (error) { item.error = error.stack; console.error(error.stack); }
    finally { await context.close(); }
  }
} finally {
  await browser?.close(); await new Promise((resolve) => server.close(resolve));
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
}
assert.equal(report.cases.length, 24, 'Incomplete diagnostic collection');
assert.ok(report.cases.every((item) => !item.error), 'Diagnostic collection error; raw evidence retained');
console.log('NATIVE DIAGNOSTIC COLLECTED; inspect restored=false cases. This does not pass or replace the strict browser acceptance gate.');
