#!/usr/bin/env node
/**
 * Opt-in, read-only functional support for the selected Agent 8 presentation.
 * Does not transfer a visual component, change app/runtime/package/CI, or grant
 * Research/publication approval. Runtime source and runner HEAD are separate.
 *
 * node scripts/journal-integrator-acceptance.mjs --origin=http://HOST:PORT \
 *   --runtime-sha=SHA40 --artifact-root=/absolute/build/output \
 *   --provenance=/absolute/build-receipt.json --out=reports/g3-editorial-wave/NEW
 * Existing Playwright is used; JOURNAL_CHROMIUM_EXECUTABLE may select Chromium.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { readingExpectation, assertReadingParity, citationInventory } from './lib/journal-reading-parity.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const { values: args } = parseArgs({ options: {
  origin: { type: 'string' }, 'runtime-sha': { type: 'string' },
  'artifact-root': { type: 'string' }, provenance: { type: 'string' },
  out: { type: 'string' }, widths: { type: 'string', default: '390,1440' },
} });
for (const key of ['origin', 'runtime-sha', 'artifact-root', 'provenance', 'out']) assert.ok(args[key], `Required --${key}`);
const origin = new URL(args.origin);
assert.ok(['http:', 'https:'].includes(origin.protocol) && !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash, 'Provide an HTTP origin, not a page or credentials');
assert.match(args['runtime-sha'], /^[a-f0-9]{40}$/, 'Pin the runtime source to SHA40, never a branch label');
const widths = args.widths.split(',').map(Number);
assert.ok(widths.length > 0 && new Set(widths).size === widths.length && widths.every((w) => [390, 1440].includes(w)), 'Use widths 390 and/or 1440');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (argv) => execFileSync('git', ['--no-optional-locks', ...argv], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const runtimeSha = args['runtime-sha'];
assert.equal(git(['cat-file', '-t', runtimeSha]).trim(), 'commit');
const source = (name, anchor = runtimeSha) => git(['show', `${anchor}:${name}`]);
const artifact = fs.realpathSync(args['artifact-root']);
const provenanceBytes = fs.readFileSync(args.provenance), provenance = JSON.parse(provenanceBytes);
assert.equal(provenance.runtimeSourceSha, runtimeSha, 'Build receipt/runtime SHA mismatch');
assert.ok(typeof provenance.scope === 'string' && provenance.scope.length > 0, 'Explicit build scope required');
const output = path.resolve(root, args.out), relative = path.relative(root, output);
assert.ok(relative.startsWith(`reports${path.sep}g3-editorial-wave${path.sep}`) && !relative.split(path.sep).includes('..'), 'Use a new ignored Journal report directory');
assert.ok(!fs.existsSync(output), 'Refusing to overwrite prior evidence');
for (let p = path.dirname(output); p !== root; p = path.dirname(p)) {
  assert.notEqual(p, path.dirname(p), 'Output containment walk must reach the repository root');
  try { assert.ok(!fs.lstatSync(p).isSymbolicLink(), 'Output must not traverse a symlink'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
git(['check-ignore', '-q', '--', relative]);
fs.mkdirSync(output, { recursive: true });
const report = {
  runnerHead: git(['rev-parse', 'HEAD']).trim(), runnerWorktree: git(['status', '--porcelain']).trim(),
  runtimeSourceSha: runtimeSha, runtimeScope: provenance.scope, provenanceSha256: sha(provenanceBytes), provenance,
  browser: null, publicationPermission: false,
  limits: ['Chromium only; not Firefox/WebKit', 'No real device/UI zoom/screen-reader/physical-print/Owner visual signoff', 'Not a full build/typecheck/Pagefind/SEO/publication or shared Search acceptance', 'Canonical completion requires the actual new canonical SHA; selected-source fixture is not integration'],
  sourceParity: null, inventory: null, authorityPins: [], htmlPins: [], requestedResourcePins: [],
  screens: [], toc: [], citations: [], directSources: [], noJs: [], problems: [],
};
const dossierPath = '/journal/dossiers/g3/';
const url = (pathname) => new URL(pathname, origin).href;
const dossier = source('src/components/journal/G3Dossier.astro');
const expressions = {};
const deltas = dossier.match(/const financeDeltas = \[([\s\S]*?)\];/);
if (deltas) {
  const values = [...deltas[1].matchAll(/value:\s*(\d+)/g)].map((match) => Number(match[1]));
  assert.deepEqual(values, [1061800, 817283, 246511], 'Pinned G3-PUB-002 projection changed');
  for (const [index, value] of values.entries()) expressions[`formatNumber(financeDeltas[${index}].value)`] = new Intl.NumberFormat('ru-RU').format(value);
}
const baseline = 'b2ae614730b0c2e164d3b07453797074253d9698';
for (const name of ['g3ProductMetadata', 'g3PublicationHandoff', 'g3SourceBibliography', 'journalProductMetadata']) {
  const p = `src/data/journal/${name}.ts`, current = source(p);
  assert.equal(current, source(p, baseline), `${name}: public authority changed; re-scope rather than importing a fixture`);
  report.authorityPins.push({ path: p, sha256: sha(current), baseline });
}
const approved = [...source('src/data/journal/g3SourceBibliography.ts').matchAll(/id:\s*'(G3-S\d{3})'/g)].map((m) => `src-${m[1]}`);
assert.equal(approved.length, 21);
const html = fs.readFileSync(path.join(artifact, 'journal/dossiers/g3/index.html'), 'utf8');
try {
  report.sourceParity = assertReadingParity(readingExpectation(dossier, { expressions }), html);
  assert.equal(report.sourceParity.excluded.length, 0, 'Unverified dynamic reading paragraph; add an explicit bounded projection before claiming coverage');
} catch (error) {
  report.sourceParity = { status: 'FAIL', message: String(error.message) };
  report.problems.push({ type: 'source-parity', message: String(error.message) });
}
report.inventory = citationInventory(html, { expectedSources: approved });
for (const route of ['/journal/', dossierPath]) {
  const file = path.join(artifact, route.slice(1), 'index.html'), expected = fs.readFileSync(file);
  const response = await fetch(url(route));
  assert.equal(response.status, 200);
  assert.equal(sha(Buffer.from(await response.arrayBuffer())), sha(expected), 'HTTP page must match the explicit build artifact');
  report.htmlPins.push({ route, sha256: sha(expected) });
}
assert.equal(fs.existsSync(path.join(artifact, 'journal/dossiers/g3/history/index.html')), false, 'No public history artifact');
assert.equal((await fetch(url('/journal/dossiers/g3/history/'))).status, 404, 'No public history URL');
assert.doesNotMatch(html, /G3-HIST-PUB-|data-g3-article="history"/);
const browser = await chromium.launch({ headless: true, ...(process.env.JOURNAL_CHROMIUM_EXECUTABLE ? {
  executablePath: process.env.JOURNAL_CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage'],
} : {}) });
report.browser = `Chromium ${browser.version()}`;
const resourceJobs = [], resourcePins = new Map();
function track(page, label) {
  page.on('pageerror', (e) => report.problems.push({ type: 'pageerror', label, message: String(e) }));
  page.on('response', (response) => {
    if (new URL(response.url()).origin !== origin.origin || response.request().resourceType() === 'document') return;
    resourceJobs.push((async () => {
      const request = new URL(response.url()), name = decodeURIComponent(request.pathname).slice(1);
      const file = path.resolve(artifact, name);
      assert.ok(file.startsWith(artifact + path.sep), 'Asset path escapes artifact');
      assert.equal(response.status(), 200, `Asset HTTP failure: ${request.pathname}`);
      const local = fs.readFileSync(file), bytes = await response.body();
      assert.equal(sha(bytes), sha(local), `Served resource differs from build: ${name}`);
      resourcePins.set(request.pathname + request.search, { url: request.pathname + request.search, sha256: sha(local) });
    })().catch((e) => report.problems.push({ type: 'resource-pin', label, message: String(e) })));
  });
}
const go = async (page, address) => {
  assert.equal((await page.goto(address, { waitUntil: 'networkidle' })).status(), 200);
  await page.evaluate(() => document.fonts.ready);
};
// Node-side polling also works with page scripting disabled. Browser timers do not.
async function settle(page) {
  let previous = '', stable = 0;
  for (let n = 0; n < 45; n++) {
    await page.waitForTimeout(60);
    const current = await page.evaluate(() => [Math.round(scrollY), Math.round(document.querySelector('.mobile-chrome.is-shown .mcp-top')?.getBoundingClientRect().bottom || 0)].join(':'));
    stable = current === previous ? stable + 1 : 0; previous = current;
    if (stable >= 5) return;
  }
  throw Error('Native scroll/mobile chrome did not settle');
}
async function position(page, id) {
  return page.locator(`[id="${id}"]`).evaluate((el) => {
    const box = el.getBoundingClientRect(), bar = document.querySelector('.mobile-chrome.is-shown .mcp-top'), br = bar?.getBoundingClientRect();
    return { id: el.id, hash: location.hash, focused: document.activeElement === el,
      visible: el.checkVisibility(), top: box.top, bottom: box.bottom, viewport: innerHeight,
      barBottom: br && getComputedStyle(bar).visibility !== 'hidden' ? Math.max(0, br.bottom) : 0 };
  });
}
function visibleTarget(facts) {
  assert.ok(facts.visible && facts.top >= facts.barBottom - 1 && facts.top < facts.viewport - 20, `Fragment hidden/clipped: ${JSON.stringify(facts)}`);
  assert.equal(facts.hash, `#${facts.id}`);
  assert.ok(facts.focused, `Fragment did not receive native focus: ${facts.id}`);
}
async function keyboardActivate(page, link) { await link.focus(); await page.keyboard.press('Enter'); await settle(page); }
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, `${name}.png`) }); report.screens.push(`${name}.png`);
}
try {
  for (const width of widths) for (const theme of ['light', 'dark']) {
    const label = `${width}-${theme}`;
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1080 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.addInitScript((t) => { localStorage.setItem('theme', t); localStorage.setItem('gb:reader-preferences:v1', JSON.stringify({ version: 1, theme: t })); }, theme);
    context.setDefaultTimeout(6000); context.setDefaultNavigationTimeout(15000);
    const page = await context.newPage(); track(page, label);
    try {
      for (const [name, route] of [['journal', '/journal/'], ['dossier', dossierPath]]) {
        await go(page, url(route));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'Document overflow');
        assert.equal(await page.locator('h1').count(), 1);
        if (name === 'dossier') {
          const projected = await page.locator('[data-publication-claims], [data-research-claims]').evaluateAll((nodes) => [...new Set(nodes.flatMap((node) => (node.getAttribute('data-publication-claims') || node.getAttribute('data-research-claims') || '').split(/\s+/).filter(Boolean)))].sort());
          assert.deepEqual(projected, Array.from({ length: 16 }, (_, i) => `G3-PUB-${String(i + 1).padStart(3, '0')}`), 'Only the 16 approved public claims');
        }
        await screenshot(page, `${name}-${label}`);
      }
      for (const href of report.inventory.tocLinks) {
        const toc = page.locator('[data-journal-contents]');
        if (!await toc.getAttribute('open').then((value) => value !== null)) await keyboardActivate(page, toc.locator('summary'));
        await keyboardActivate(page, toc.locator(`a[href="${href}"]`));
        const facts = await position(page, href.slice(1)); visibleTarget(facts);
        report.toc.push({ width, theme, href, ...facts });
      }
      for (const [index, citation] of report.inventory.citations.entries()) {
        const link = page.locator(`[id="${citation.id}"]`);
        if (index % 2) await keyboardActivate(page, link); else { await link.click(); await settle(page); }
        const atSource = await position(page, citation.href.slice(1)); visibleTarget(atSource);
        const back = page.locator(`${citation.href} [data-journal-source-return]`);
        assert.equal(await back.getAttribute('href'), `#${citation.id}`, 'Must return to this activation, including repeated uses');
        assert.equal(await back.getAttribute('aria-label'), `К месту чтения: ${citation.text}`);
        if (citation.id === 'cite-finance-G3-S002-2') await screenshot(page, `source-active-${label}`);
        await keyboardActivate(page, back);
        const returned = await position(page, citation.id); visibleTarget(returned);
        await page.keyboard.press('Tab');
        const following = await link.evaluate((citation) => ({ tag: document.activeElement.tagName, href: document.activeElement.getAttribute('href'),
          afterCitation: Boolean(citation.compareDocumentPosition(document.activeElement) & Node.DOCUMENT_POSITION_FOLLOWING) }));
        assert.ok(following.tag !== 'BODY' && following.afterCitation, 'Tab must continue forward from the returned citation, not restart at page chrome');
        if (citation.id === 'cite-finance-G3-S002-2') await screenshot(page, `citation-returned-${label}`);
        report.citations.push({ width, theme, id: citation.id, href: citation.href, keyboardOutbound: Boolean(index % 2), keyboardReturn: true, atSource, returned, following });
      }
      for (const id of report.inventory.sources) {
        // Force a NEW document: goto(hash) alone can be same-document and return
        // null, leaving the previous citation map alive. Model a copied URL, not
        // a same-tab hash mutation masquerading as a clean direct-load witness.
        await page.goto('about:blank');
        await go(page, url(dossierPath + '#' + id)); await settle(page);
        const facts = await position(page, id); visibleTarget(facts);
        await page.keyboard.press('Tab');
        assert.ok(await page.locator(`[id="${id}"]`).evaluate((el) => el.contains(document.activeElement)), 'Tab must enter this source');
        const back = page.locator(`[id="${id}"] [data-journal-source-return]`);
        assert.equal(await back.getAttribute('href'), report.inventory.fallback);
        await keyboardActivate(page, back); const returned = await position(page, report.inventory.fallback.slice(1)); visibleTarget(returned);
        report.directSources.push({ width, theme, id, facts, returned });
      }
      console.log(`${label}: all ${report.inventory.tocLinks.length} TOC / ${report.inventory.citations.length} citations / ${report.inventory.sources.length} direct sources PASS`);
    } catch (e) { report.problems.push({ type: 'interaction', label, message: String(e.stack || e) }); }
    finally { await context.close(); }
    const noJsContext = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1080 }, colorScheme: theme, javaScriptEnabled: false, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const noJsPage = await noJsContext.newPage(); track(noJsPage, label + '-no-js');
    try {
      await go(noJsPage, url(dossierPath));
      for (const citation of report.inventory.citations) {
        await keyboardActivate(noJsPage, noJsPage.locator(`[id="${citation.id}"]`));
        const atSource = await position(noJsPage, citation.href.slice(1)); visibleTarget(atSource);
        const back = noJsPage.locator(`${citation.href} [data-journal-source-return]`);
        assert.equal(await back.getAttribute('href'), report.inventory.fallback);
        assert.equal(await back.getAttribute('aria-label'), null, 'No-JS must not promise an exact remembered return');
        await keyboardActivate(noJsPage, back);
        const returned = await position(noJsPage, report.inventory.fallback.slice(1)); visibleTarget(returned);
        report.noJs.push({ width, browserTheme: theme, themeNote: 'No-JS retains the selected SSR palette, not an emulated runtime theme', id: citation.id, atSource, returned });
      }
    } catch (e) { report.problems.push({ type: 'no-js', label, message: String(e.stack || e) }); }
    finally { await noJsContext.close(); }
  }
} finally {
  await browser.close(); await Promise.all(resourceJobs);
  report.requestedResourcePins = [...resourcePins.values()];
  report.totals = { toc: report.toc.length, citations: report.citations.length, directSources: report.directSources.length, noJsFallbacks: report.noJs.length, problems: report.problems.length };
  fs.writeFileSync(path.join(output, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.totals));
  if (report.problems.length) { console.error(report.problems); process.exitCode = 1; }
}
