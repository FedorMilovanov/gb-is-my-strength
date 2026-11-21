#!/usr/bin/env node
/**
 * Scoped, read-only Journal regression witness. Not a publication approval.
 * Node >= repository minimum; run after the canonical production-like build.
 * Optional --source-only omits dist checks. Reports are ignored build artifacts.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'parse5';

const root = fileURLToPath(new URL('../', import.meta.url));
const baseline = 'b2ae614730b0c2e164d3b07453797074253d9698';
const args = new Set(process.argv.slice(2));
for (const arg of args) assert.ok(['--source-only', '--public-only', '--probe-hold', '--require-dist'].includes(arg) || /^(?:--output|--transfer)=.+/.test(arg), `Unknown option: ${arg}`);
const publicOnly = args.has('--public-only');
assert.ok(!(args.has('--source-only') && args.has('--require-dist')), 'Source-only is not dist acceptance');
const transferArg = [...args].find((arg) => arg.startsWith('--transfer='));
const transfer = transferArg ? JSON.parse(fs.readFileSync(transferArg.slice('--transfer='.length), 'utf8')) : null;
if (transfer) {
  assert.ok(publicOnly, 'A gitless transfer witness must explicitly use --public-only');
  assert.equal(transfer.base, baseline, 'Rebuild the transfer contract for another canonical base');
  assert.match(transfer.source, /^[a-f0-9]{40}$/);
}

const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const previous = (name) => {
  if (!transfer) return execFileSync('git', ['show', `${baseline}:${name}`], { cwd: root, encoding: 'utf8' });
  const value = transfer.baselineSourceContent?.[name];
  assert.equal(typeof value, 'string', `Missing pinned comparison source: ${name}`);
  const state = transfer.files.find((item) => item.path === name)?.before || transfer.preserved.find((item) => item.path === name)?.state;
  const bytes = Buffer.from(value);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), state?.blob, `Baseline source blob mismatch: ${name}`);
  return value;
};
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
const hasClass = (node, name) => (attr(node, 'class') || '').split(/\s+/).includes(name);
function all(node, predicate) {
  return [...(predicate(node) ? [node] : []), ...(node.childNodes || []).flatMap((child) => all(child, predicate))];
}
const byId = (doc, id) => all(doc, (node) => attr(node, 'id') === id)[0];
const text = (node) => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
const normalize = (value) => value.replace(/\s+/gu, '');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const load = (name) => import(pathToFileURL(path.join(root, name)).href);
const { G3_PRODUCT_METADATA: metadata } = await load('src/data/journal/g3ProductMetadata.ts');
const { JOURNAL_PRODUCT_METADATA: journal } = await load('src/data/journal/journalProductMetadata.ts');
const { G3_HISTORY_DRAFT_METADATA: history } = await load('src/data/journal/g3HistoryDraftMetadata.ts');
const historySources = publicOnly ? null : (await load('src/data/journal/g3HistoryDraftSources.ts')).G3_HISTORY_DRAFT_SOURCES;
const { G3_SOURCE_BIBLIOGRAPHY: sources } = await load('src/data/journal/g3SourceBibliography.ts');
const current = read('src/components/journal/G3Dossier.astro');
const old = previous('src/components/journal/G3Dossier.astro');
const values = [...current.match(/const financeDeltas = \[([\s\S]*?)\];/)[1].matchAll(/value:\s*(\d+)/g)].map((match) => Number(match[1]));
assert.deepEqual(values, [1061800, 817283, 246511], 'the comparison must retain the exact pinned G3-PUB-002 deltas');
function sourceDoc(value) {
  return parse(value
    .replace(/\{formatNumber\(financeDeltas\[(\d)\]\.value\)\}/g, (_, index) => String(values[index]))
    .replace(/\{['"] ['"]\}/g, ' '));
}
const before = sourceDoc(old);
const after = sourceDoc(current);
// Compare every non-citation paragraph in factual modules, including timeline.
// Only whitespace is normalized (explicit Astro inline separators were repaired).
// Header/dek, source labels, bibliography and two translated h3s are editorial UI.
const factualModules = ['overview', 'timeline', 'finance', 'governance', 'buice', 'buck', 'wind-down', 'unknowns', 'documents', 'corrections'];
let paragraphCount = 0;
const proseHashes = {};
for (const id of factualModules) {
  const paragraphs = (doc) => {
    const section = byId(doc, id);
    assert.ok(section, `missing factual module: ${id}`);
    return all(section, (node) => node.tagName === 'p' && !hasClass(node, 'source-note-paragraph')).map((node) => normalize(text(node)));
  };
  const a = paragraphs(before), b = paragraphs(after);
  assert.deepEqual(b, a, `factual narrative changed in #${id}`);
  paragraphCount += a.length;
  proseHashes[id] = digest(b.join('\n'));
}
for (const name of ['g3ProductMetadata', 'g3PublicationHandoff', 'g3SourceBibliography', 'journalProductMetadata']) {
  const file = `src/data/journal/${name}.ts`;
  assert.equal(read(file), previous(file), `${file} is an unchanged authority owner in this lane`);
}
assert.equal(sources.length, 21);
const claimIds = [...new Set(current.match(/G3-PUB-\d{3}/g))].sort();
assert.deepEqual(claimIds, Array.from({ length: 16 }, (_, i) => `G3-PUB-${String(i + 1).padStart(3, '0')}`));
assert.ok(!current.includes('G3-HIST-PUB-'), 'historical candidates must not enter the crisis claim projection');
assert.equal(history.publicationStatus, 'PUBLICATION_HOLD');
assert.deepEqual([...history.approvalClaimIds], Array.from({ length: 9 }, (_, i) => `G3-HIST-PUB-${String(i + 1).padStart(2, '0')}`));
assert.ok(!Object.hasOwn(history, 'handoffStatus'), 'Do not infer/issue a history handoff or mix authority schemas');
for (const name of ['G3HistoryArticle', 'G3HistoryFeature']) {
  const source = read(`src/components/journal/${name}.astro`);
  assert.match(source, /if \(import\.meta\.env\.PROD\)\s*\{\s*throw new Error\(/, `${name} must fail closed in production`);
}
if (!publicOnly) {
  assert.equal(new Set(historySources.map((source) => source.id)).size, historySources.length);
  const previousHistory = previous('src/components/journal/G3HistoryFeature.astro');
  for (const source of historySources) assert.ok(previousHistory.includes(source.url), `new/unreviewed source URL: ${source.url}`);
}
for (const file of fs.readdirSync(path.join(root, 'src/pages'), { recursive: true }).filter((file) => /\.(astro|mdx?)$/.test(file))) {
  assert.doesNotMatch(read(`src/pages/${file}`), /G3History(?:Article|Feature)|G3-HIST-PUB-/, `Held history activated in ${file}`);
}
for (const file of ['migration/page-ownership.json', 'data/route-search-policy.json', 'data/search-manifest.json', 'sitemap.xml', 'feed.xml']) {
  assert.ok(!read(file).includes('/journal/dossiers/g3/history/'), `held manuscript leaked into ${file}`);
  assert.ok(!read(file).includes('/_review/'), `review route leaked into ${file}`);
}
assert.ok(!fs.existsSync(path.join(root, 'src/pages/journal/dossiers/g3/history')), 'no public history route may be created');
// Public-only preserves the baseline held stylesheet byte-for-byte; it is not
// mounted by the public pages and is outside this presentation acceptance.
const css = read('src/components/journal/journalEditorial.css') + (publicOnly ? '' : read('src/components/journal/g3History.css'));
if (publicOnly) for (const name of ['G3Dossier', 'JournalLanding', 'JournalEditorialShell', 'JournalMasthead']) {
  assert.ok(!read(`src/components/journal/${name}.astro`).includes('g3History.css'), `${name}: held CSS must not enter public presentation`);
}
assert.ok(!css.includes('!important'), 'route-local cascade must not rely on important patches');

let literalParagraphs = 0;
const built = [];
if (!process.argv.includes('--source-only')) {
  for (const [route, data, type] of [['/journal/', journal, 'CollectionPage'], ['/journal/dossiers/g3/', metadata, 'Article']]) {
    const html = read(`dist${route}index.html`);
    const doc = parse(html);
    const nodes = all(doc, (node) => Boolean(node.tagName));
    const metas = (key, value) => nodes.filter((node) => node.tagName === 'meta' && attr(node, key) === value);
    const oneMeta = (key, value, expected) => {
      const matched = metas(key, value);
      assert.equal(matched.length, 1, `duplicate/missing ${value} at ${route}`);
      assert.equal(attr(matched[0], 'content'), expected, `${value} drift at ${route}`);
    };
    assert.equal(nodes.filter((node) => node.tagName === 'h1').length, 1);
    const canonicals = nodes.filter((node) => node.tagName === 'link' && attr(node, 'rel') === 'canonical');
    assert.equal(canonicals.length, 1);
    assert.equal(attr(canonicals[0], 'href'), data.canonical);
    oneMeta('name', 'description', data.description);
    oneMeta('property', 'og:url', data.canonical);
    oneMeta('property', 'og:type', type === 'Article' ? 'article' : 'website');
    if (type === 'Article') {
      oneMeta('property', 'article:published_time', data.publishedAt);
      oneMeta('property', 'article:modified_time', data.modifiedAt);
    } else {
      for (const field of ['article:published_time', 'article:modified_time']) assert.equal(metas('property', field).length, 0, `CollectionPage must not leak ${field}`);
    }
    const imageAlt = metas('property', 'og:image:alt');
    assert.equal(imageAlt.length, 1, 'one route-owned image description');
    assert.ok(attr(imageAlt[0], 'content')?.trim());
    oneMeta('name', 'twitter:image:alt', attr(imageAlt[0], 'content'));
    assert.equal(metas('name', 'robots').length, 1);
    assert.match(attr(metas('name', 'robots')[0], 'content'), /^index, follow/);
    const graphs = nodes.filter((node) => node.tagName === 'script' && attr(node, 'type') === 'application/ld+json').map((node) => JSON.parse(text(node)));
    const entities = graphs.flatMap((graph) => graph['@graph'] || [graph]);
    const entity = entities.filter((item) => item['@type'] === type);
    assert.equal(entity.length, 1, `exactly one ${type} schema at ${route}`);
    assert.equal(entity[0].headline, data.title);
    assert.equal(entity[0].datePublished, data.publishedAt);
    assert.equal(entity[0].dateModified, data.modifiedAt);
    const ids = nodes.map((node) => attr(node, 'id')).filter(Boolean);
    assert.equal(ids.length, new Set(ids).size, `duplicate element IDs at ${route}`);
    for (const node of nodes.filter((node) => node.tagName === 'a' && attr(node, 'href')?.startsWith('#'))) {
      const hash = decodeURIComponent(attr(node, 'href').slice(1));
      assert.ok(ids.includes(hash), `broken anchor #${hash} at ${route}`);
    }
    assert.ok(!html.includes('history-source-') && !html.includes('G3-HIST-PUB-'), 'history must not enter a public artifact');
    const covers = nodes.filter((node) => node.tagName === 'source' && attr(node, 'type') === 'image/avif');
    assert.equal(covers.length, 1, `exactly one responsive AVIF cover at ${route}`);
    const fontHints = nodes.filter((node) => node.tagName === 'link' && attr(node, 'rel') === 'preload' && attr(node, 'as') === 'font');
    assert.equal(fontHints.length, 4, `one critical font-hint set at ${route}`);
    assert.equal(new Set(fontHints.map((node) => attr(node, 'href'))).size, 4, 'no duplicate font hints');
    for (const hint of fontHints) assert.ok(fs.existsSync(path.join(root, attr(hint, 'href'))), 'font hints must reuse existing local files');
    assert.ok(!html.includes('localhost') && !html.includes('127.0.0.1'), 'browser-facing URLs must not point to the sandbox loopback');
    const sourceAdapters = nodes.filter((node) => node.tagName === 'script' && text(node).includes('journalSourceNavigationBound'));
    assert.equal(sourceAdapters.length, type === 'Article' ? 1 : 0, 'Astro must deduplicate the bounded adapter, not emit one script per source');
    // Adapted from QA#2344: semantic owner counts, not another UI implementation.
    for (const [tag, className] of [['header', 'je-masthead'], ['nav', 'je-masthead__nav'], ['header', 'mcp-top'], ['button', 'mcp-search']]) {
      assert.equal(nodes.filter((node) => node.tagName === tag && hasClass(node, className)).length, 1, `${route}: one ${className} owner`);
    }
    assert.equal(nodes.filter((node) => node.tagName === 'main' && attr(node, 'id') === 'main-content').length, 1);
    if (type === 'Article') {
      // Agent1's literal source→compressed-DOM word-boundary witness, adapted to
      // selected Agent8 markup. The existing baseline factual-parity gate stays.
      const words = (value) => value.replace(/\s+/gu, ' ').trim();
      // Classify literals BEFORE sourceDoc projects formatNumber expressions.
      // Dynamic formatted currency is covered by the exact values/baseline gate,
      // not compared as an ungrouped literal against real Intl-grouped numbers.
      const literalSource = parse(current.replace(/\{['"] ['"]\}/g, ' '));
      for (const value of values) assert.ok(normalize(text(byId(doc, 'finance'))).includes(String(value)), `Exact finance projection missing: ${value}`);
      for (const id of factualModules) {
        const expected = all(byId(literalSource, id), (node) => node.tagName === 'p' && !hasClass(node, 'source-note-paragraph'))
          .map(text).filter((value) => !/[{}]/.test(value)).map(words);
        const rendered = all(byId(doc, id), (node) => node.tagName === 'p').map((node) => words(text(node)));
        for (const paragraph of expected) {
          assert.ok(rendered.includes(paragraph), `#${id}: compressed DOM changed source word boundaries: ${paragraph.slice(0, 100)}`);
          literalParagraphs++;
        }
      }
      assert.ok(literalParagraphs >= 30, 'Literal paragraph witness must not silently lose coverage');
      assert.ok(nodes.some((node) => hasClass(node, 'article-header')));
      assert.ok(nodes.some((node) => hasClass(node, 'author-card')));
      assert.equal(nodes.filter((node) => hasClass(node, 'je-contents')).length, 1);
      assert.equal(nodes.filter((node) => hasClass(node, 'bibliography-item')).length, 21);
      for (const source of sources) {
        const entry = byId(doc, `src-${source.id}`);
        assert.ok(entry);
        const returns = all(entry, (node) => node.tagName === 'a' && attr(node, 'data-journal-source-return') !== undefined);
        assert.equal(returns.length, 1, `one honest SSR return at ${source.id}`);
        assert.equal(attr(returns[0], 'href'), '#documents');
        assert.notEqual(attr(returns[0], 'data-pagefind-ignore'), undefined, 'navigation-only fallback text must not pollute search');
        assert.match(text(returns[0]), /К методике проверки/);
      }
      assert.equal(nodes.filter((node) => attr(node, 'data-journal-source-navigation') !== undefined).length, 1);
      const citations = nodes.filter((node) => node.tagName === 'a' && attr(node, 'href')?.startsWith('#src-'));
      assert.ok(citations.length > 0);
      for (const citation of citations) {
        assert.ok(attr(citation, 'id')?.startsWith('cite-'), 'citations need stable, SSR-owned fragment IDs');
        assert.notEqual(attr(citation, 'data-journal-citation'), undefined, 'every existing source citation must be enhanced, not a parallel map');
      }
    }
    built.push({ route, schema: type, bytes: Buffer.byteLength(html), canonical: data.canonical });
  }
  for (const file of ['dist/journal/dossiers/g3/history/index.html', 'dist/_review/g3-history/index.html']) {
    assert.ok(!fs.existsSync(path.join(root, file)), `PUBLICATION_HOLD violation: ${file}`);
  }
  for (const file of ['dist/sitemap.xml', 'dist/feed.xml', 'dist/data/search-manifest.json']) {
    assert.ok(!read(file).includes('/journal/dossiers/g3/history/') && !read(file).includes('/_review/'), `held manuscript leaked into ${file}`);
  }
}
// Read actual Pagefind artifacts, adapted from QA#2344. A positive G3 control
// is mandatory; held-token queries may honestly yield zero results.
async function inspectPagefind() {
  const pagefindRoot = path.join(root, 'dist/pagefind');
  assert.ok(JSON.parse(read('dist/pagefind/pagefind-entry.json')).languages?.ru?.page_count > 0);
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(pagefindRoot, decodeURIComponent(pathname).replace(/^\/pagefind\//, ''));
    if (!pathname.startsWith('/pagefind/') || !file.startsWith(pagefindRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return response.writeHead(404).end();
    response.setHeader('Content-Type', 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const module = await import(`data:text/javascript;base64,${Buffer.from(read('dist/pagefind/pagefind.js')).toString('base64')}`);
    const index = await module.createInstance({ basePath: `${baseUrl}/pagefind/`, baseUrl, primary: true, language: 'ru' });
    const probes = [];
    for (const query of ['G3', 'G3-HIST-PUB-01', 'PUBLICATION_HOLD', '_review/g3-history']) {
      const result = await index.search(query);
      const items = await Promise.all(result.results.map((item) => item.data()));
      const paths = items.map((item) => new URL(item.url, baseUrl).pathname);
      assert.ok(!paths.some((value) => /\/journal\/dossiers\/g3\/history\/|\/_review\//i.test(value)), `Held history indexed: ${query}`);
      for (const item of items) assert.doesNotMatch(item.content || '', /G3-HIST-PUB-|PUBLICATION_HOLD/);
      if (query === 'G3') assert.ok(paths.includes('/journal/dossiers/g3/'), 'Actual index must return the public G3 control');
      probes.push({ query, hits: items.length, paths });
    }
    return { actualIndex: true, probes };
  } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}
function probeHeldEntrypoints() {
  const probes = [];
  for (const name of ['G3HistoryArticle', 'G3HistoryFeature']) {
    const parent = path.join(root, '.cache'); fs.mkdirSync(parent, { recursive: true });
    const fixture = fs.mkdtempSync(path.join(parent, 'g3-hold-integration-'));
    try {
      fs.mkdirSync(path.join(fixture, 'src/pages'), { recursive: true });
      fs.writeFileSync(path.join(fixture, 'src/pages/index.astro'), `---\nimport Held from ${JSON.stringify(path.join(root, `src/components/journal/${name}.astro`))};\n---\n<Held />\n`);
      const config = path.join(fixture, 'astro.config.mjs');
      fs.writeFileSync(config, `export default {root:${JSON.stringify(fixture)},srcDir:${JSON.stringify(path.join(fixture, 'src'))},publicDir:${JSON.stringify(path.join(fixture, 'empty'))},outDir:${JSON.stringify(path.join(fixture, 'output'))},cacheDir:${JSON.stringify(path.join(fixture, 'cache'))},vite:{resolve:{alias:{'@':${JSON.stringify(path.join(root, 'src'))}}}}};`);
      const result = spawnSync(process.execPath, [path.join(root, 'scripts/astro-cli.mjs'), 'build', '--config', path.relative(root, config)], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 5 * 1024 * 1024 });
      const log = result.stdout + result.stderr;
      const logDirectory = path.resolve(root, [...args].find((arg) => arg.startsWith('--output='))?.slice('--output='.length) || 'reports/g3-editorial-local-20261118');
      fs.mkdirSync(logDirectory, { recursive: true });
      fs.writeFileSync(path.join(logDirectory, `hold-probe-${name}.log`), log);
      assert.ifError(result.error); assert.notEqual(result.status, 0, `${name} must reject real production rendering`);
      const expectedGuard = read(`src/components/journal/${name}.astro`).match(/throw new Error\('([^']+PUBLICATION_HOLD[^']+)'\)/)?.[1];
      assert.ok(expectedGuard && log.includes(expectedGuard), `${name}: production failure must name the exact guard, not configuration/import failure: ${log}`);
      probes.push({ entrypoint: name, actualExit: result.status, expectedNonzero: true, exactGuardMessage: expectedGuard, publicRouteCreated: false });
    } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
  }
  return probes;
}
const pagefind = !args.has('--source-only') ? await inspectPagefind() : null;
const productionProbes = args.has('--probe-hold') ? probeHeldEntrypoints() : 'NOT RUN (use --probe-hold)';
const report = { baseline, head: transfer ? null : execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  transferredSourceHead: transfer?.source || null, publicOnly, literalParagraphs, pagefind, productionProbes,
  note: 'Working-tree witness; source hashes identify tested bytes. Not a Research handoff or production claim.',
  dossierSourceSha256: digest(current), factualParagraphsUnchanged: paragraphCount, proseHashes,
  approvedClaims: claimIds.length, approvedSourceObjects: sources.length, historyDraftSourceLinks: historySources?.length ?? 'NOT RUN: --public-only excludes only manuscript presentation-source checks',
  publicationHoldRetained: true, built };
const outputDirectory = process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length) || 'reports/g3-editorial-local-20261118';
const output = path.resolve(root, outputDirectory, 'contract.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(`PASS: ${paragraphCount} factual paragraphs unchanged; 16 approved claims / 21 sources; history HOLD; ${built.length} built SEO/DOM surfaces.`);
console.log(path.relative(root, output));
