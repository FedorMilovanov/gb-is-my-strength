#!/usr/bin/env node
/**
 * Opt-in, read-only catalog witness. No package/CI/app writes or UI authority.
 * See docs/reviews/G3_AGENT1_ARTICLES_CATALOG_SUPPORT_2026-11-19.md.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { createArtifactAssetQueue as catalogAssetQueue, verifiedArtifactRoute as verifiedCatalogRoute, createVerifiedArtifactTransport } from './lib/acceptance-artifact-transport.mjs';
export { catalogAssetQueue, verifiedCatalogRoute };
import {
  CATALOG_ROUTE, CATALOG_SELECTORS, catalogExpectation, assertCatalogHtml,
  catalogBrowserSnapshot, assertBrowserCatalog, assertCatalogDestination,
} from './lib/articles-catalog-coverage.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_FILES = ['data/search-manifest.json', 'migration/page-ownership.json', 'src/components/articles/ArticlesRefutationsSection.astro'];
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const git = (args) => execFileSync('git', ['--no-optional-locks', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
export function catalogOptions(argv) {
  const { values: args } = parseArgs({ args: argv, options: {
    origin: { type: 'string' }, 'runtime-sha': { type: 'string' }, 'artifact-root': { type: 'string' },
    provenance: { type: 'string' }, out: { type: 'string' }, widths: { type: 'string', default: '390,1440' },
  } });
  for (const key of ['origin', 'runtime-sha', 'artifact-root', 'provenance', 'out']) assert.ok(args[key], `Required --${key}`);
  const origin = new URL(args.origin);
  assert.ok(['http:', 'https:'].includes(origin.protocol) && !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash, 'An HTTP origin, not a page/credentials, is required');
  assert.match(args['runtime-sha'], /^[a-f0-9]{40}$/, 'Use exact runtime SHA40, not a branch label');
  const widths = args.widths.split(',').map(Number);
  assert.ok(widths.length && new Set(widths).size === widths.length && widths.every((w) => [320, 390, 768, 1440].includes(w)), 'Widths: unique selection of 320,390,768,1440');
  return { ...args, origin, widths };
}
/** Refuse overwrites, symlinks and nonignored/source output destinations. */
export function catalogReportDirectory(out) {
  const resolvedRoot = path.resolve(ROOT), output = path.resolve(resolvedRoot, out), relative = path.relative(resolvedRoot, output);
  assert.ok(relative.startsWith(`reports${path.sep}g3-editorial-wave${path.sep}`) && !relative.split(path.sep).includes('..'), 'Use a new ignored reports/g3-editorial-wave/ directory');
  assert.ok(!fs.existsSync(output), 'Refusing to overwrite prior evidence');
  for (let p = output; p !== resolvedRoot; p = path.dirname(p)) {
    assert.notEqual(p, path.dirname(p), 'Containment walk must reach repository root');
    try { assert.ok(!fs.lstatSync(p).isSymbolicLink(), 'Report path must not traverse a symlink'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  git(['check-ignore', '-q', '--', relative]);
  return output;
}
export function assertCatalogBuildReceipt(receipt, { runtimeSha, artifact, html, sources }) {
  assert.equal(receipt.runtimeSourceSha, runtimeSha, 'Build receipt/runtime SHA mismatch');
  assert.ok(typeof receipt.scope === 'string' && receipt.scope.trim(), 'Explicit build scope required');
  assert.equal(receipt.buildExitCode, 0, 'An actual successful build receipt is required');
  assert.equal(fs.realpathSync(receipt.artifactRoot), artifact, 'Receipt points to another artifact root');
  assert.equal(receipt.catalogHtmlSha256, sha256(html), 'Receipt/catalog artifact bytes differ');
  for (const name of SOURCE_FILES) assert.equal(receipt.sourceFiles?.[name], sha256(sources[name]), `${name}: receipt does not pin the tested source authority`);
}
function containedFile(root, name) {
  assert.ok(!path.isAbsolute(name) && !name.split(/[\\/]/).includes('..'), 'Unsafe sealed path');
  const file = path.resolve(root, name), real = fs.realpathSync(file);
  assert.ok(real.startsWith(root + path.sep), 'Sealed file escapes its root');
  return file;
}
function verifyOptionalSeals(receipt, runtimeSha, artifact) {
  const result = { source: null, artifact: null };
  if (receipt.sourcePinManifest) {
    const sourceRoot = fs.realpathSync(receipt.sourceRoot), bytes = fs.readFileSync(receipt.sourcePinManifest), pins = JSON.parse(bytes);
    const tree = git(['ls-tree', '-r', '-z', runtimeSha]).split('\0').filter(Boolean).map((row) => {
      const [header, name] = row.split('\t'), [mode, kind, oid] = header.split(' '); return { name, mode, kind, oid };
    });
    assert.deepEqual(Object.keys(pins).sort(), tree.map((e) => e.name).sort(), 'Source seal must cover the entire exact Git tree');
    for (const { name, mode, kind, oid } of tree) {
      assert.equal(kind, 'blob', 'Unsupported source-tree entry');
      const file = path.resolve(sourceRoot, name);
      assert.ok(file.startsWith(sourceRoot + path.sep), 'Unsafe source tree path');
      const stat = fs.lstatSync(file), data = stat.isSymbolicLink() ? Buffer.from(fs.readlinkSync(file)) : fs.readFileSync(containedFile(sourceRoot, name));
      assert.equal(createHash('sha1').update(Buffer.from(`blob ${data.length}\0`)).update(data).digest('hex'), oid, `${name}: exported bytes differ from runtime Git object`);
      assert.equal(pins[name].blob, oid); assert.equal(pins[name].mode, mode);
      assert.equal(pins[name].sha256, sha256(data), `${name}: source seal mismatch`);
      assert.equal(mode === '120000', stat.isSymbolicLink(), `${name}: symlink mode mismatch`);
      if (!stat.isSymbolicLink()) assert.equal(Boolean(stat.mode & 0o111), mode === '100755', `${name}: executable mode mismatch`);
    }
    result.source = { files: tree.length, manifestSha256: sha256(bytes) };
  }
  if (receipt.artifactPinManifest) {
    const bytes = fs.readFileSync(receipt.artifactPinManifest), pins = JSON.parse(bytes);
    const files = [];
    function walk(dir, prefix = '') {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const name = prefix + entry.name;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), name + '/'); else files.push(name);
      }
    }
    walk(artifact); assert.deepEqual(files.sort(), Object.keys(pins).sort(), 'Artifact seal must cover the full output');
    for (const [name, pin] of Object.entries(pins)) assert.equal(sha256(fs.readFileSync(containedFile(artifact, name))), pin.sha256, `${name}: artifact seal mismatch`);
    result.artifact = { files: files.length, manifestSha256: sha256(bytes) };
  }
  return result;
}

export async function runCatalogCoverage(argv = process.argv.slice(2)) {
  const args = catalogOptions(argv), output = catalogReportDirectory(args.out);
  fs.mkdirSync(output, { recursive: true });
  const report = {
    version: 1, startedAt: new Date().toISOString(), runnerHead: git(['rev-parse', 'HEAD']).trim(), runnerWorktree: git(['status', '--porcelain']).trim(),
    runtimeSourceSha: args['runtime-sha'], origin: args.origin.origin, browser: null, publicationPermission: false,
    provenance: null, provenanceSha256: null, expectation: null, ssr: null, sourceSeals: null, finalSeals: null,
    destinations: [], resourcePins: [], cases: [], negativeSelfChecks: [], problems: [],
    limits: ['Candidate/staging evidence is not canonical integration or production acceptance', 'Chromium only; no Firefox/WebKit, physical device, UI zoom, screen reader or Owner visual signoff',
      'No publication/HOLD release, Research writes, print/SEO/Pagefind/Search or visual-design approval', 'CSS line-clamp/typography and reading-order design are separate reviews',
      'Browser color-scheme preferences are requested; no-JS retains the actual SSR palette', 'Build identity is a caller receipt; optional full source/artifact seals are independently verified when supplied'],
  };
  let browser;
  const resourcePins = new Map();
  let transport;
  try {
    assert.equal(git(['cat-file', '-t', args['runtime-sha']]).trim(), 'commit', 'Fetch the exact source commit without switching branches');
    const artifact = fs.realpathSync(args['artifact-root']);
    transport = createVerifiedArtifactTransport({ origin: args.origin.origin,
      readArtifact: (name) => fs.readFileSync(containedFile(artifact, name)),
      onPin: (pin) => resourcePins.set(pin.url, pin),
      onError: ({ label, url, error }) => report.problems.push({ type: 'resource-pin', label, requestUrl: url, message: String(error) }),
    });
    const provenanceBytes = fs.readFileSync(args.provenance), receipt = JSON.parse(provenanceBytes);
    const sources = Object.fromEntries(SOURCE_FILES.map((name) => [name, Buffer.from(git(['show', `${args['runtime-sha']}:${name}`]))]));
    const html = fs.readFileSync(containedFile(artifact, 'articles/index.html'));
    assertCatalogBuildReceipt(receipt, { runtimeSha: args['runtime-sha'], artifact, html, sources });
    report.provenance = receipt; report.provenanceSha256 = sha256(provenanceBytes);
    report.sourceSeals = verifyOptionalSeals(receipt, args['runtime-sha'], artifact);
    report.expectation = catalogExpectation({ manifest: JSON.parse(sources[SOURCE_FILES[0]]), ownership: JSON.parse(sources[SOURCE_FILES[1]]), curatedSource: sources[SOURCE_FILES[2]].toString() });
    report.ssr = assertCatalogHtml(report.expectation, html.toString());
    const href = (route) => new URL(route, args.origin).href;
    const pageResponse = await fetch(href(CATALOG_ROUTE), { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    assert.equal(pageResponse.status, 200, 'Catalog HTTP status');
    assert.equal(sha256(Buffer.from(await pageResponse.arrayBuffer())), sha256(html), 'HTTP catalog differs from the declared build artifact');
    const responses = new Map();
    async function destination(item) {
      if (!responses.has(item.route)) responses.set(item.route, (async () => {
        const response = await fetch(href(item.route), { redirect: 'manual', signal: AbortSignal.timeout(15000) });
        const body = Buffer.from(await response.arrayBuffer());
        assert.equal(sha256(body), sha256(fs.readFileSync(containedFile(artifact, item.route.slice(1) + 'index.html'))), `${item.route}: destination HTTP/artifact bytes differ`);
        return { status: response.status, redirected: response.redirected || response.status >= 300 && response.status < 400, responsePath: new URL(response.url).pathname,
          contentType: response.headers.get('content-type'), html: body.toString() };
      })());
      return assertCatalogDestination(item, await responses.get(item.route));
    }
    for (let start = 0; start < report.expectation.published.length; start += 6) {
      await Promise.all(report.expectation.published.slice(start, start + 6).map(async (item) => {
        try { report.destinations.push(await destination(item)); } catch (e) { report.problems.push({ type: 'destination', href: item.href, message: String(e.stack || e) }); }
      }));
    }
    report.destinations.sort((a, b) => a.href.localeCompare(b.href));
    browser = await chromium.launch({ headless: true, ...(process.env.CATALOG_CHROMIUM_EXECUTABLE || process.env.JOURNAL_CHROMIUM_EXECUTABLE ? {
      executablePath: process.env.CATALOG_CHROMIUM_EXECUTABLE || process.env.JOURNAL_CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage'],
    } : {}) });
    report.browser = `Chromium ${browser.version()}`;
    for (const width of args.widths) for (const preference of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
      const label = `${width}-${preference}-${javaScriptEnabled ? 'js' : 'no-js'}`;
      const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1080 }, colorScheme: preference, javaScriptEnabled, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await transport.install(context, label);
      context.setDefaultTimeout(8000); context.setDefaultNavigationTimeout(20000);
      const page = await context.newPage(), entry = { width, preference, javaScriptEnabled, nativeDetailsOpened: 0, screenshots: [], status: 'FAIL' };
      report.cases.push(entry);
      page.on('pageerror', (e) => report.problems.push({ type: 'pageerror', label, pageUrl: page.url(), message: String(e) }));
      try {
        const response = await page.goto(href(CATALOG_ROUTE), { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        await page.evaluate(() => document.fonts.ready);
        entry.palette = await page.locator('html').getAttribute('data-theme');
        // Native details are a valid no-JS disclosure, unlike hidden/filter gates.
        const details = page.locator('details');
        for (let i = 0; i < await details.count(); i++) {
          const d = details.nth(i);
          if (await d.evaluate((n, s) => Boolean(n.querySelector(s.published) || n.querySelector(s.curated)), CATALOG_SELECTORS) && !await d.evaluate((n) => n.open)) {
            const summary = d.locator(':scope > summary'); assert.equal(await summary.count(), 1);
            await summary.focus(); await page.keyboard.press('Enter'); assert.equal(await d.evaluate((n) => n.open), true); entry.nativeDetailsOpened++;
          }
        }
        assertCatalogHtml(report.expectation, await page.content());
        entry.facts = await page.evaluate(catalogBrowserSnapshot, CATALOG_SELECTORS);
        entry.coverage = assertBrowserCatalog(report.ssr, entry.facts);
        // Use actual stable hook order; do not prescribe editorial sorting.
        const cards = page.locator(CATALOG_SELECTORS.published), cardCount = await cards.count();
        const firstHref = await cards.first().getAttribute('href');
        const targetHref = await cards.nth(cardCount > 1 ? 1 : 0).getAttribute('href');
        const targetUrl = new URL(targetHref, href(CATALOG_ROUTE)).href;
        await cards.first().focus();
        if (cardCount > 1) {
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), targetHref, 'Native Tab must reach the next SSR card');
        }
        const [navigated] = await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.keyboard.press('Enter')]);
        assert.equal(navigated.status(), 200, 'Native Enter destination HTTP status');
        assert.equal(page.url(), targetUrl, 'Native Enter must use the actual publication href');
        await page.goBack({ waitUntil: 'networkidle' }); assert.equal(page.url(), href(CATALOG_ROUTE));
        assertCatalogHtml(report.expectation, await page.content());
        entry.nativeKeyboard = { tabFrom: firstHref, tabTo: cardCount > 1 ? targetHref : null, enterDestination: targetUrl, backToCatalog: true };
        for (const [kind, selector] of [['first', CATALOG_SELECTORS.published], ['curated', `${CATALOG_SELECTORS.curated} a`]]) {
          await page.locator(selector).first().scrollIntoViewIfNeeded();
          // A newly scrolled lazy image must finish before it becomes evidence.
          await page.waitForFunction((selector) => [...document.querySelector(selector).querySelectorAll('img')].every((img) => img.complete && img.naturalWidth > 0), selector, { timeout: 8000 });
          const file = `catalog-${kind}-${label}.png`; await page.screenshot({ path: path.join(output, file) }); entry.screenshots.push(file);
        }
        entry.status = 'PASS'; console.log(`${label}: ${entry.coverage.published} published + ${entry.coverage.curated} curated; native Tab/Enter/Back PASS`);
      } catch (e) {
        entry.error = String(e.stack || e); report.problems.push({ type: 'catalog-browser', label, message: entry.error });
        try { const file = `failure-${label}.png`; await page.screenshot({ path: path.join(output, file) }); entry.screenshots.push(file); } catch { /* Original failure remains. */ }
      } finally { try { await transport.drain(); } finally { await context.close(); } }
    }
    // Actual computed-CSS negative proofs live only in a disposable test tab.
    const negativeContext = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
    const negativePage = await negativeContext.newPage();
    try {
      await negativePage.goto(href(CATALOG_ROUTE), { waitUntil: 'domcontentloaded' });
      const role = '<span data-catalog-role="site">Господь Бог — Сила Моя</span>';
      const source = `---\n---\n<section id="razbor"><a href="/articles/fixture/"><h2>Выбор</h2><span class="h-meta-author">Ред.: Тест</span><p>Кураторский текст.</p></a></section>`;
      const synthetic = `<div class="fixture-host"><section data-catalog-source="search-manifest+page-ownership"><a href="/articles/fixture/" data-catalog-route="/articles/fixture/"><h2>Материал</h2>${role}<p>Полный текст.</p></a></section></div>${source.replace(/^---\n---\n/, '')}`;
      const e = catalogExpectation({ manifest: { items: [{ type: 'article', url: '/articles/fixture/', title: 'Материал', description: 'Полный текст.' }] }, ownership: { routes: { '/articles/fixture/': { status: 'production-dist' } } }, curatedSource: source });
      const expected = assertCatalogHtml(e, synthetic);
      await negativePage.setContent(synthetic); assertBrowserCatalog(expected, await negativePage.evaluate(catalogBrowserSnapshot, CATALOG_SELECTORS));
      for (const [name, css] of [
        ['display-none-link', '[data-catalog-route]{display:none}'], ['hidden-ancestor', '.fixture-host{visibility:hidden}'],
        ['transparent-ancestor', '.fixture-host{opacity:0}'], ['hidden-description', '[data-catalog-route] p{display:none}'],
        ['offscreen-link', '[data-catalog-route]{position:absolute;left:-9999px}'], ['clipped-ancestor', '.fixture-host{height:0;overflow:hidden}'],
      ]) {
        await negativePage.setContent(`<style>${css}</style>${synthetic}`);
        const facts = await negativePage.evaluate(catalogBrowserSnapshot, CATALOG_SELECTORS);
        let rejected = false;
        try { assertBrowserCatalog(expected, facts); } catch { rejected = true; }
        assert.ok(rejected, `Computed CSS negative was falsely accepted: ${name}`);
        report.negativeSelfChecks.push({ name, rejected: true });
      }
    } finally { await negativeContext.close(); }
    report.finalSeals = verifyOptionalSeals(receipt, args['runtime-sha'], artifact);
    assert.deepEqual(report.finalSeals, report.sourceSeals, 'Build/source seals changed during the witness');
  } catch (e) { report.problems.push({ type: 'setup-or-contract', message: String(e.stack || e) }); }
  finally {
    try { if (transport) await transport.drain(); } catch (e) { report.problems.push({ type: 'resource-drain', message: String(e) }); }
    if (browser) await browser.close();
    report.resourcePins = [...resourcePins.values()].sort((a, b) => a.url.localeCompare(b.url));
    report.finishedAt = new Date().toISOString(); report.status = report.problems.length ? 'FAIL' : 'PASS';
    fs.writeFileSync(path.join(output, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(`${report.status}: ${report.problems.length} problem(s); ${path.relative(ROOT, output)}/acceptance.json`);
  return report.problems.length ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCatalogCoverage().then((code) => { process.exitCode = code; }).catch((e) => { console.error(e); process.exitCode = 1; });
}
