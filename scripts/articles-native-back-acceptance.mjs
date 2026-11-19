#!/usr/bin/env node
/** Opt-in no-JS native Back diagnostic. Source/build identity is explicit.
 * --matrix=/absolute/endpoints.json --out=reports/g3-editorial-wave/NEW
 * [--suite=matrix|target-keyboard] [--widths=390,1440] [--css-rehearsal]
 * [--bfcache=default|permitted] removes only PW's disable flag, NOT a use guarantee.
 * Matrix = temporary HTTP endpoints/receipts, NEVER publication/feed data.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { parse } from 'parse5';
import { catalogReportDirectory, assertCatalogBuildReceipt } from './articles-catalog-coverage.mjs';
import { catalogExpectation, assertCatalogHtml } from './lib/articles-catalog-coverage.mjs';
import { NATIVE_BACK_OBSERVATION_MS, assessNativeBack, nativeBackFixture, nativeBackSnapshot, settleNativeScroll, validateNativeBackMatrix } from './lib/articles-native-back.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const git = (args) => execFileSync('git', ['--no-optional-locks', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const all = (n) => [n, ...(n.childNodes || []).flatMap(all)];
const attr = (n, k) => n.attrs?.find((a) => a.name === k)?.value;
export function nativeBackOptions(argv) {
  const { values: a } = parseArgs({ args: argv, options: { matrix: { type: 'string' }, out: { type: 'string' },
    suite: { type: 'string', default: 'matrix' }, widths: { type: 'string', default: '390,1440' }, 'css-rehearsal': { type: 'boolean', default: false },
    bfcache: { type: 'string', default: 'default' } } });
  assert.ok(a.matrix && a.out, 'Required --matrix and --out');
  assert.ok(['default', 'permitted'].includes(a.bfcache), 'BFCache mode is a launch control, never an expected result');
  assert.ok(['matrix', 'target-keyboard'].includes(a.suite), 'Unknown native Back suite');
  assert.ok(!a['css-rehearsal'] || a.suite === 'matrix', 'CSS controls belong only to the matrix suite');
  const widths = a.widths.split(',').map(Number);
  assert.ok(widths.length && new Set(widths).size === widths.length && widths.every((w) => [390, 1440].includes(w)), 'Use unique390/1440 widths');
  return { ...a, widths };
}
function loadCandidate(candidate) {
  assert.equal(git(['cat-file', '-t', candidate.sourceSha]).trim(), 'commit');
  const artifactRoot = fs.realpathSync(candidate.artifactRoot), html = fs.readFileSync(path.join(artifactRoot, 'articles/index.html'));
  const names = ['data/search-manifest.json', 'migration/page-ownership.json', 'src/components/articles/ArticlesRefutationsSection.astro'];
  const sources = Object.fromEntries(names.map((name) => [name, Buffer.from(git(['show', `${candidate.sourceSha}:${name}`]))]));
  const bytes = fs.readFileSync(candidate.provenance), receipt = JSON.parse(bytes);
  assertCatalogBuildReceipt(receipt, { runtimeSha: candidate.sourceSha, artifact: artifactRoot, html, sources });
  const librarySource = git(['show', `${candidate.sourceSha}:src/components/articles/ArticlesLibrarySection.astro`]);
  const expectation = catalogExpectation({ manifest: JSON.parse(sources[names[0]]), ownership: JSON.parse(sources[names[1]]), curatedSource: sources[names[2]].toString(), librarySource });
  assertCatalogHtml(expectation, html.toString());
  const nodes = all(parse(html.toString(), { scriptingEnabled: false }));
  const library = nodes.find((n) => attr(n, 'data-catalog-source') === 'search-manifest+page-ownership');
  const fragment = nodes.some((n) => attr(n, 'id') === 'catalog-materials') ? '#catalog-materials' : '#' + attr(library, 'id');
  assert.ok(fragment !== '#undefined', 'A real native library target is required');
  return { name: candidate.name, role: candidate.role, sourceSha: candidate.sourceSha, artifactRoot,
    origin: candidate.origin, route: '/articles/', fragment, selector: expectation.counts.series ? '[data-catalog-series]' : '[data-catalog-route]',
    published: expectation.published.length, htmlSha256: hash(html), provenanceSha256: hash(bytes), runtimeScope: receipt.scope };
}
function startControls(candidate, rows) {
  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
  return createServer((req, res) => {
    try {
      const u = new URL(req.url, 'http://native-control.invalid'); let bytes, type = 'text/html; charset=utf-8', modified;
      if (u.pathname === '/__agent1_native_back__/catalog.html') bytes = Buffer.from(nativeBackFixture({ rows, behavior: u.searchParams.get('css') === 'auto' ? 'auto' : 'smooth' }));
      else if (u.pathname === '/__agent1_native_back__/destination.html') bytes = Buffer.from('<!doctype html><h1>ТЕСТ, НЕ ПУБЛИКАЦИЯ</h1><p>Script-free native destination.</p>');
      else {
        let name = decodeURIComponent(u.pathname); if (name.endsWith('/')) name += 'index.html';
        const file = path.resolve(candidate.artifactRoot, '.' + name), real = fs.realpathSync(file);
        assert.ok(real.startsWith(candidate.artifactRoot + path.sep), 'Control path escapes artifact');
        bytes = fs.readFileSync(file); type = mime[path.extname(file)] || 'application/octet-stream'; modified = fs.statSync(file).mtime.toUTCString();
        if (u.pathname === '/articles/' && u.searchParams.get('__agent1_native_css') === 'auto') bytes = Buffer.from(bytes.toString().replace('</head>', '<style>html{scroll-behavior:auto}</style></head>'));
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length, ...(modified ? { 'Last-Modified': modified } : {}) }); res.end(bytes);
    } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('No diagnostic artifact'); }
  });
}
async function prepareLast(page, source, withHash, sequential, item) {
  if (withHash) {
    const jump = page.locator(`a[href="${source.fragment}"]`).first();
    if (await jump.count()) { await jump.focus(); await page.keyboard.press('Enter'); item.hashEntry = 'native-anchor-Enter'; }
    else { await page.goto(source.origin + source.route + source.fragment, { waitUntil: 'domcontentloaded' }); item.hashEntry = 'native-URL-fragment; old library has no topic jump'; }
    await settleNativeScroll(page, source.selector);
  }
  const last = page.locator(source.selector).last(), href = await last.getAttribute('href');
  if (sequential) {
    const order = await page.locator('[data-catalog-route],[data-catalog-series]').evaluateAll((ns) => ns.map((n) => n.getAttribute('href')));
    const targetIndex = order.lastIndexOf(href); assert.ok(targetIndex >= 0);
    item.nativeTabSteps = [];
    for (let i = 0; i <= targetIndex; i++) {
      await page.keyboard.press('Tab'); const current = await settleNativeScroll(page, source.selector);
      item.nativeTabSteps.push({ expectedHref: order[i], active: current.active, settling: current.settling });
      assert.equal(current.active.href, order[i], 'Native Tab order differs from actual SSR order');
      assert.ok(current.active.focusVisible && current.active.outlineWidth >= 2 && current.active.outlineStyle !== 'none', 'Native focus outline is missing');
      assert.ok(current.active.titleTop >= current.active.headerBottom - 1 && current.active.titleBottom <= current.viewport + 1, 'Native focused title is clipped/covered');
    }
    item.preparation = 'native fragment Enter, then every publication Tab through the last series; no last-link focus injection';
  } else {
    await last.focus(); await settleNativeScroll(page, source.selector);
    item.preparation = 'last-series focus preparation, matching Agent8 final Enter/Back portion; NOT its179-key traversal';
  }
  return { last, href };
}
export async function runNativeBackAcceptance(argv = process.argv.slice(2)) {
  const args = nativeBackOptions(argv), output = catalogReportDirectory(args.out); fs.mkdirSync(output, { recursive: true });
  const report = { runnerHead: git(['rev-parse', 'HEAD']).trim(), runnerWorktree: git(['status', '--porcelain']).trim(),
    suite: args.suite, publicationPermission: false, javaScriptEnabled: false, networkInterception: false,
    reducedMotionOverride: false, observationMs: NATIVE_BACK_OBSERVATION_MS, bfcacheLaunchMode: args.bfcache,
    startedAt: new Date().toISOString(), browser: null, candidates: [], cases: [], problems: [],
    limits: ['Chromium lab only; native Back scroll/focus is not guaranteed by history.length', 'No Product JS scroll/focus restoration or reduced-motion repair is injected',
      'CSS virtual copies are causal controls, not candidate Git artifacts or proposed fixes', 'Default Playwright BFCache behavior is not renamed BFCache coverage; reload is measured by performance.timeOrigin',
      'PASS means only observed scroll within this4000ms window; focus is recorded separately; no canonical, visual, AT/device or deployment approval'] };
  let browser, server;
  try {
    const config = validateNativeBackMatrix(JSON.parse(fs.readFileSync(args.matrix)));
    const candidates = config.candidates.map(loadCandidate); report.candidates = candidates;
    const target = candidates.find((c) => c.role === 'target'), sources = [...candidates];
    if (args.suite === 'matrix') {
      server = startControls(target, target.published); await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));
      const origin = 'http://127.0.0.1:' + server.address().port;
      for (const behavior of ['smooth', 'auto']) sources.push({ name: 'neutral-' + behavior, role: 'platform-control', origin,
        route: `/__agent1_native_back__/catalog.html?css=${behavior}`, fragment: '#native-back-materials', selector: '[data-native-back-fixture]', behavior });
      if (args['css-rehearsal']) for (const behavior of ['baseline', 'auto']) sources.push({ ...target, sourceSha: null, name: 'virtual-' + behavior, role: 'css-rehearsal', origin,
        route: '/articles/?__agent1_native_css=' + behavior, derivedFrom: target.sourceSha, behavior, notExactGitArtifact: true });
    }
    browser = await chromium.launch({ headless: true, ...(process.env.ARTICLES_CHROMIUM_EXECUTABLE || process.env.CATALOG_CHROMIUM_EXECUTABLE ? {
      executablePath: process.env.ARTICLES_CHROMIUM_EXECUTABLE || process.env.CATALOG_CHROMIUM_EXECUTABLE } : {}),
      ...(args.bfcache === 'permitted' ? { ignoreDefaultArgs: ['--disable-back-forward-cache'] } : {}),
      args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    report.browser = `Chromium ${browser.version()}`;
    for (const width of args.widths) for (const source of sources) {
      if (args.suite === 'target-keyboard' && source.role !== 'target') continue;
      const hashModes = args.suite === 'target-keyboard' || source.role === 'css-rehearsal' || source.behavior === 'auto' ? [true] : [true, false];
      for (const withHash of hashModes) {
        const id = `${source.name}-${width}-${withHash ? 'hash' : 'no-hash'}`;
        const item = { id, sourceName: source.name, role: source.role, sourceSha: source.sourceSha ?? null,
          derivedFrom: source.derivedFrom ?? null, width, withHash, javaScriptEnabled: false, status: 'ERROR', samples: [], events: [] };
        report.cases.push(item);
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1080 }, javaScriptEnabled: false, colorScheme: 'light', serviceWorkers: 'block' });
        const page = await context.newPage(); page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(15000);
        const started = Date.now(); page.on('domcontentloaded', () => item.events.push({ event: 'domcontentloaded', elapsedMs: Date.now() - started }));
        page.on('load', () => item.events.push({ event: 'load', elapsedMs: Date.now() - started }));
        try {
          const address = source.origin + source.route, response = await fetch(address, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
          assert.equal(response.status, 200); const bytes = Buffer.from(await response.arrayBuffer()); item.httpHtmlSha256 = hash(bytes);
          if (source.role === 'target' || source.role === 'comparison') assert.equal(item.httpHtmlSha256, source.htmlSha256, 'Native HTTP document differs from declared artifact');
          assert.equal((await page.goto(address, { waitUntil: 'domcontentloaded' })).status(), 200);
          await page.evaluate(() => document.fonts.ready); await settleNativeScroll(page, source.selector);
          const { href } = await prepareLast(page, source, withHash, args.suite === 'target-keyboard', item);
          item.before = await page.evaluate(nativeBackSnapshot, source.selector);
          if (source.role === 'target' && withHash) { item.beforePng = id + '-before.png'; await page.screenshot({ path: path.join(output, item.beforePng) }); }
          const destination = new URL(href, page.url());
          await Promise.all([page.waitForURL((u) => u.href === destination.href, { waitUntil: 'domcontentloaded' }), page.keyboard.press('Enter')]);
          assert.ok(await page.locator('h1').count()); item.destination = await page.evaluate(nativeBackSnapshot, source.selector);
          const startBack = Date.now(), backResponse = await page.goBack({ waitUntil: 'domcontentloaded' });
          item.backDomContentLoadedMs = Date.now() - startBack; item.backHttpStatus = backResponse?.status() ?? null;
          while (Date.now() - startBack < NATIVE_BACK_OBSERVATION_MS) {
            item.samples.push({ elapsedMs: Date.now() - startBack, ...await page.evaluate(nativeBackSnapshot, source.selector) });
            await page.waitForTimeout(100);
          }
          item.after = await page.evaluate(nativeBackSnapshot, source.selector);
          item.assessment = assessNativeBack({ before: item.before, after: item.after, samples: item.samples, observedForMs: Date.now() - startBack });
          item.status = item.assessment.status;
          if (source.role === 'target' && withHash) { item.afterPng = id + '-after.png'; await page.screenshot({ path: path.join(output, item.afterPng) }); }
          console.log(`${id}: ${item.status}; ${item.before.y}→${item.after.y}; focus=${item.assessment.focusStatus}; reload=${item.assessment.documentReloaded}`);
        } catch (error) { item.error = String(error.stack || error); report.problems.push({ id, message: item.error }); console.error(item.error); }
        finally { await context.close(); fs.writeFileSync(path.join(output, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n'); }
      }
    }
  } catch (error) { report.problems.push({ type: 'setup', message: String(error.stack || error) }); }
  finally {
    if (browser) await browser.close(); if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const targets = report.cases.filter((c) => c.role === 'target');
    report.summary = { targetCases: targets.length, targetObservedScrollPasses: targets.filter((c) => c.status === 'PASS_OBSERVED_SCROLL').length,
      targetNativeScrollFailures: targets.filter((c) => c.status === 'FAIL_NATIVE_SCROLL').length, otherTargetOutcomes: targets.filter((c) => !['PASS_OBSERVED_SCROLL', 'FAIL_NATIVE_SCROLL'].includes(c.status)).length,
      comparisonAndControlCases: report.cases.length - targets.length, setupErrors: report.problems.length };
    report.finishedAt = new Date().toISOString();
    report.status = report.problems.length || !targets.length || targets.some((c) => c.status !== 'PASS_OBSERVED_SCROLL') ? 'FAIL_TARGET_NATIVE_BACK' : 'PASS_OBSERVED_SCROLL_ONLY';
    fs.writeFileSync(path.join(output, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(report.status, JSON.stringify(report.summary)); return report.status === 'PASS_OBSERVED_SCROLL_ONLY' ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runNativeBackAcceptance().then((code) => { process.exitCode = code; }).catch((error) => { console.error(error); process.exitCode = 1; });
