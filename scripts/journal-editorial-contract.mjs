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
const baseline = '560ad663c6985e94eefbc67609e654660e142eb7';
const args = new Set(process.argv.slice(2));
for (const arg of args) assert.ok(['--source-only', '--probe-publication', '--require-dist'].includes(arg) || /^--output=.+/.test(arg), `Unknown option: ${arg}`);
assert.ok(!(args.has('--source-only') && args.has('--require-dist')), 'Source-only cannot prove dist acceptance');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const previous = (name) => execFileSync('git', ['show', `${baseline}:${name}`], { cwd: root, encoding: 'utf8' });
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
const { G3_HISTORY_METADATA: history } = await load('src/data/journal/g3HistoryMetadata.ts');
const { G3_HISTORY_SOURCES: historySources } = await load('src/data/journal/g3HistorySources.ts');
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
const claimIds = [...new Set(current.match(/G3-PUB-\d{3}/g) || [])].sort();
const frozenClaimIds = [...new Set(old.match(/G3-PUB-\d{3}/g) || [])].sort();
assert.deepEqual(claimIds, frozenClaimIds, 'historical route must not alter the frozen crisis claim projection');
// Research Q020 (2026-11-21) withdrew G3-PUB-015 from reader-visible prose.
// The immutable 16-ID Research handoff remains preserved; do not reinstate its
// disproven Jenkins reissue inference merely to satisfy an obsolete test count.
const readerSafeClaims = Array.from({ length: 16 }, (_, i) => `G3-PUB-${String(i + 1).padStart(3, '0')}`)
  .filter(id => id !== 'G3-PUB-015');
assert.deepEqual(claimIds, readerSafeClaims, 'Q020-corrected crisis projection: exactly 15 approved reader-visible claim IDs');
assert.ok(!current.includes('G3-PUB-015'), 'withdrawn G3-PUB-015 cannot return in crisis reader prose');
assert.ok(!current.includes('G3-HIST-PUB-'), 'historical candidates must not enter the crisis claim projection');
assert.deepEqual([...history.approvedClaimIds], Array.from({ length: 9 }, (_, i) => `G3-HIST-PUB-${String(i + 1).padStart(2, '0')}`));
assert.ok(history.researchHandoffUrl.includes('389de7b1fca6bf2317aa4e0bf187f13600792384'), 'adopted Research #628 is pinned');
assert.equal(new Set(historySources.map(s => s.id)).size, historySources.length);
assert.ok(historySources.length >= 22);
for (const name of ['G3HistoryArticle', 'G3HistoryFeature']) {
  const source = read(`src/components/journal/${name}.astro`);
  assert.doesNotMatch(source, /PUBLICATION_HOLD|RESEARCH_DRAFT|Не опубликовано|data-research-candidates/, `${name} must be public-ready`);
}
const historyRoute = '/journal/dossiers/g3/history/';
assert.ok(fs.existsSync(path.join(root, 'src/pages/journal/dossiers/g3/history/index.astro')));
assert.equal(JSON.parse(read('migration/page-ownership.json')).routes[historyRoute]?.status, 'production-dist');
for (const name of ['data/route-search-policy.json', 'data/search-manifest.json', 'sitemap.xml', 'feed.xml']) {
  assert.ok(read(name).includes(historyRoute), `${name} must register public historical article`);
  assert.ok(!read(name).includes('/_review/g3-history/'), 'review route may not leak');
}
const css = read('src/components/journal/journalEditorial.css') + read('src/components/journal/g3History.css');
assert.ok(!css.includes('!important'), 'route-local cascade must not rely on important patches');

let literalParagraphs = 0;
const built = [];
if (!process.argv.includes('--source-only')) {
  for (const [route, data, type] of [['/journal/', journal, 'CollectionPage'], ['/journal/dossiers/g3/', metadata, 'Article'], [historyRoute, history, 'Article']]) {
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
    assert.ok(!html.includes('PUBLICATION_HOLD') && !html.includes('/_review/'), 'draft history must not enter public HTML');
    if (route !== historyRoute) assert.ok(!html.includes('history-source-'), 'history bibliography must remain separate');
    const covers = nodes.filter((node) => node.tagName === 'source' && attr(node, 'type') === 'image/avif');
    assert.equal(covers.length, 1, `exactly one responsive AVIF cover at ${route}`);
    const fontHints = nodes.filter((node) => node.tagName === 'link' && attr(node, 'rel') === 'preload' && attr(node, 'as') === 'font');
    // The Journal collection retains its four original critical faces.
    // Both G3 articles add semibold Source Sans for real labels; only the
    // dossier uses semibold Lora. History must NOT preload the unused face
    // (Firefox reports a genuine unused-WOFF2 console warning).
    // Reject any missing, extra, or duplicate font hint.
    const expectedFontHints = [
      '/fonts/PlayfairDisplay/playfairdisplay-cyrillic-600.woff2',
      '/fonts/Lora/lora-cyrillic-400.woff2',
      '/fonts/SourceSans3/sourcesans3-cyrillic-400.woff2',
      '/fonts/SourceSans3/sourcesans3-latin-400.woff2',
      ...(type === 'Article' ? [
        '/fonts/SourceSans3/sourcesans3-cyrillic-600.woff2',
      ] : []),
      ...(route === '/journal/dossiers/g3/' ? [
        '/fonts/Lora/lora-cyrillic-600.woff2',
      ] : []),
    ];
    const actualFontHints = fontHints.map((node) => attr(node, 'href'));
    assert.deepEqual([...actualFontHints].sort(), [...expectedFontHints].sort(),
      `exact Journal/G3 critical local font-hint set at ${route}`);
    assert.equal(new Set(actualFontHints).size, expectedFontHints.length, 'no duplicate font hints');
    for (const hint of fontHints) assert.ok(fs.existsSync(path.join(root, attr(hint, 'href'))), 'font hints must reuse existing local files');
    assert.ok(!html.includes('localhost') && !html.includes('127.0.0.1'), 'browser-facing URLs must not point to the sandbox loopback');
    const sourceAdapters = nodes.filter((node) => node.tagName === 'script' && text(node).includes('journalSourceNavigationBound'));
    assert.equal(sourceAdapters.length, type === 'Article' ? 1 : 0, 'Astro must deduplicate the bounded adapter, not emit one script per source');
    // Adapted from QA#2344: semantic owner counts, not another UI implementation.
    for (const [tag, className] of [['header', 'je-masthead'], ['nav', 'je-masthead__nav'], ['header', 'mcp-top'], ['button', 'mcp-search']]) {
      assert.equal(nodes.filter((node) => node.tagName === tag && hasClass(node, className)).length, 1, `${route}: one ${className} owner`);
    }
    assert.equal(nodes.filter((node) => node.tagName === 'main' && attr(node, 'id') === 'main-content').length, 1);
    if (route === '/journal/dossiers/g3/') {
      // Agent1's literal source→compressed-DOM word-boundary witness, adapted to
      // selected Agent8 markup. The existing baseline factual-parity gate stays.
      const words = (value) => value.replace(/\s+/gu, ' ').trim();
      // Classify literals BEFORE sourceDoc projects formatNumber expressions.
      // Dynamic formatted currency is covered by the exact values/baseline gate,
      // not compared as an ungrouped literal against real Intl-grouped numbers.
      const literalSource = parse(current.replace(/\{['"] ['"]\}/g, ' '));
      for (const value of values) assert.ok(normalize(text(byId(doc, 'finance'))).includes(String(value)), `Exact finance projection missing: ${value}`);
      // The correction journal is an Astro conditional. Only its active
      // branch is emitted: when dated correction records exist, the
      // "no material corrections" placeholder must NOT appear in dist.
      // Compare its real source-owned date and replacement text instead.
      const correctionDeclaration = current.match(/const corrections:[\s\S]*?=\s*\[([\s\S]*?)\];\s*const contents/);
      assert.ok(correctionDeclaration, 'correction record declaration must remain inspectable');
      const expectedCorrections = [...correctionDeclaration[1].matchAll(/correctedAt:\s*'([^']+)'[\s\S]*?newMeaning:\s*'([^']+)'/g)];
      const correctionSection = byId(doc, 'corrections');
      const actualCorrections = all(correctionSection, (node) => node.tagName === 'li');
      assert.equal(actualCorrections.length, expectedCorrections.length, 'published correction entries must match source records');
      assert.equal(all(correctionSection, (node) => hasClass(node, 'empty-corrections')).length,
        expectedCorrections.length ? 0 : 1, 'inactive correction placeholder must not be published');
      for (const [index, [, when, meaning]] of expectedCorrections.entries()) {
        const entry = actualCorrections[index];
        const stamps = all(entry, (node) => node.tagName === 'time');
        assert.equal(stamps.length, 1, `correction ${index + 1}: exactly one dated record`);
        assert.equal(attr(stamps[0], 'datetime'), when, `correction ${index + 1}: source date drift`);
        assert.ok(normalize(text(entry)).includes(normalize(meaning)), `correction ${index + 1}: source meaning drift`);
      }
      for (const id of factualModules) {
        const expected = all(byId(literalSource, id), (node) => node.tagName === 'p' &&
          !hasClass(node, 'source-note-paragraph') &&
          !(id === 'corrections' && expectedCorrections.length && hasClass(node, 'empty-corrections')))
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
    if (route === historyRoute) {
      // Internal handoff is checked against the canonical metadata above;
      // it is editorial provenance, not a public bibliographic source.
      assert.ok(!nodes.some(node => node.tagName === 'a' &&
        /github\.com\/FedorMilovanov\/Research(?:\/|$)/i.test(attr(node, 'href') || '')),
        'internal Research links must not appear in public history');
      assert.equal(nodes.filter(node => hasClass(node, 'research-disclosure')).length, 0);
      assert.doesNotMatch(text(doc), /Принятый редакционный пакет Research|Основание источниковой сверки/u);
      assert.equal(nodes.filter((node) => hasClass(node, 'bibliography-item')).length, historySources.length);
      assert.equal(nodes.filter((node) => hasClass(node, 'je-contents')).length, 1);
      assert.equal(nodes.filter((node) => hasClass(node, 'article-header')).length, 1);
      assert.equal(nodes.filter((node) => hasClass(node, 'author-card')).length, 1);
      assert.equal(nodes.filter((node) => attr(node,'data-journal-source-navigation') !== undefined).length, 1);
      for (const source of historySources) {
        const entry = byId(doc, `history-source-${source.id}`);
        assert.ok(entry, `Missing history citation bibliography ${source.id}`);
        assert.equal(all(entry, node => node.tagName === 'a' && attr(node, 'href') === source.url).length, 1, 'original source link preserved');
        assert.equal(all(entry, node => node.tagName === 'details' && hasClass(node, 'biblio-details')).length, 1, 'one native source disclosure');
        assert.ok(normalize(text(entry)).includes(normalize(source.boundary)), 'source context preserved in disclosure');
        const returns = all(entry, node => node.tagName === 'a' && attr(node,'data-journal-source-return') !== undefined);
        assert.equal(returns.length, 1, `${source.id}: exactly one bibliography return`);
        assert.equal(attr(returns[0],'href'), source.returnHref, `${source.id}: return must target its source context`);
      }
    }
    built.push({ route, schema: type, bytes: Buffer.byteLength(html), canonical: data.canonical });
  }
  assert.ok(!fs.existsSync(path.join(root,'dist/_review/g3-history/index.html')), 'local preview must not ship');
  for (const file of ['dist/sitemap.xml', 'dist/feed.xml', 'dist/data/search-manifest.json']) {
    assert.ok(read(file).includes(historyRoute), `${file}: published history must be discoverable`);
    assert.ok(!read(file).includes('/_review/g3-history/'), `${file}: preview leaked`);
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
    for (const query of ['G3', 'конференция G3', 'PUBLICATION_HOLD', '_review/g3-history']) {
      const result = await index.search(query);
      const items = await Promise.all(result.results.map(item => item.data()));
      const paths = items.map(item => new URL(item.url,baseUrl).pathname);
      assert.ok(!paths.some(value => value.startsWith('/_review/')), `Preview was indexed for ${query}`);
      for (const item of items) assert.doesNotMatch(item.content || '', /PUBLICATION_HOLD|RESEARCH_DRAFT/);
      if (query === 'G3') {
        assert.ok(paths.includes('/journal/dossiers/g3/'), 'Crisis dossier must remain indexed');
        assert.ok(paths.includes(historyRoute), 'Historical G3 must be indexed');
      }
      probes.push({ query, hits: items.length, paths });
    }
    return { actualIndex: true, probes };
  } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}
function probePublishedRoute() {
  const routeFile='dist/journal/dossiers/g3/history/index.html';
  assert.ok(fs.existsSync(path.join(root,routeFile)), 'production history HTML missing');
  const html=read(routeFile);
  assert.ok(html.includes(history.canonical));
  assert.ok(!html.includes('PUBLICATION_HOLD') && !html.includes('/_review/'));
  return {route:historyRoute,htmlFile:routeFile,exists:true,proof:'production-like generated HTML; not a live deploy'};
}
const pagefind = !args.has('--source-only') ? await inspectPagefind() : null;
const productionProbes = args.has('--probe-publication') ? probePublishedRoute() : 'NOT RUN (use --probe-publication)';
const report = { baseline, head: execFileSync('git', ['rev-parse','HEAD'], {cwd:root,encoding:'utf8'}).trim(),
  literalParagraphs, pagefind, productionProbes,
  note: 'Built Journal and G3 history publication contract; not a completed live GitHub Pages deployment',
  dossierSourceSha256: digest(current), factualParagraphsUnchanged: paragraphCount, proseHashes,
  approvedClaims: claimIds.length, approvedSourceObjects: sources.length, historySourceLinks: historySources.length,
  historyApprovedClaims: history.approvedClaimIds.length, historyResearchHandoff: history.researchHandoffUrl, historyPublished: true, built };
const outputDirectory = process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length) || 'reports/g3-editorial-local-20261118';
const output = path.resolve(root, outputDirectory, 'contract.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(`PASS: ${paragraphCount} crisis factual paragraphs unchanged; ${claimIds.length}/21 reader-visible crisis claim/source projection (Q020 withdrawal preserved; 16-ID historical handoff unchanged), 9 approved historical groups, ${historySources.length} historical sources; ${built.length} built routes.`);
console.log(path.relative(root, output));
