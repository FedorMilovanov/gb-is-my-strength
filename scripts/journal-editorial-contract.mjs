#!/usr/bin/env node
/**
 * Scoped, read-only Journal regression witness. Not a publication approval.
 * Node >= repository minimum; run after the canonical production-like build.
 * Optional --source-only omits dist checks. Reports are ignored build artifacts.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'parse5';

const root = fileURLToPath(new URL('../', import.meta.url));
const baseline = 'b2ae614730b0c2e164d3b07453797074253d9698';
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
const { G3_HISTORY_DRAFT_METADATA: history } = await load('src/data/journal/g3HistoryDraftMetadata.ts');
const { G3_HISTORY_DRAFT_SOURCES: historySources } = await load('src/data/journal/g3HistoryDraftSources.ts');
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
assert.equal(history.approvalClaimIds.length, 9);
for (const name of ['G3HistoryArticle', 'G3HistoryFeature']) {
  const source = read(`src/components/journal/${name}.astro`);
  assert.match(source, /if \(import\.meta\.env\.PROD\)\s*\{\s*throw new Error\(/, `${name} must fail closed in production`);
}
assert.equal(new Set(historySources.map((source) => source.id)).size, historySources.length);
const previousHistory = previous('src/components/journal/G3HistoryFeature.astro');
for (const source of historySources) assert.ok(previousHistory.includes(source.url), `new/unreviewed source URL: ${source.url}`);
for (const file of ['migration/page-ownership.json', 'data/route-search-policy.json', 'data/search-manifest.json', 'sitemap.xml', 'feed.xml']) {
  assert.ok(!read(file).includes('/journal/dossiers/g3/history/'), `held manuscript leaked into ${file}`);
  assert.ok(!read(file).includes('/_review/'), `review route leaked into ${file}`);
}
assert.ok(!fs.existsSync(path.join(root, 'src/pages/journal/dossiers/g3/history')), 'no public history route may be created');
const css = read('src/components/journal/journalEditorial.css') + read('src/components/journal/g3History.css');
assert.ok(!css.includes('!important'), 'route-local cascade must not rely on important patches');

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
    oneMeta('property', 'article:published_time', data.publishedAt);
    oneMeta('property', 'article:modified_time', data.modifiedAt);
    assert.equal(metas('name', 'robots').length, 1);
    assert.match(attr(metas('name', 'robots')[0], 'content'), /^index, follow/);
    const graphs = nodes.filter((node) => node.tagName === 'script' && attr(node, 'type') === 'application/ld+json').map((node) => JSON.parse(text(node)));
    const entities = graphs.flatMap((graph) => graph['@graph'] || [graph]);
    const entity = entities.filter((item) => item['@type'] === type);
    assert.equal(entity.length, 1, `exactly one ${type} schema at ${route}`);
    assert.equal(entity[0].headline, data.title);
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
    if (type === 'Article') {
      assert.ok(nodes.some((node) => hasClass(node, 'article-header')));
      assert.ok(nodes.some((node) => hasClass(node, 'author-card')));
      assert.equal(nodes.filter((node) => hasClass(node, 'je-contents')).length, 1);
      assert.equal(nodes.filter((node) => hasClass(node, 'bibliography-item')).length, 21);
      for (const source of sources) assert.ok(byId(doc, `src-${source.id}`));
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
const report = { baseline, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  note: 'Working-tree witness; source hashes identify tested bytes. Not a Research handoff or production claim.',
  dossierSourceSha256: digest(current), factualParagraphsUnchanged: paragraphCount, proseHashes,
  approvedClaims: claimIds.length, approvedSourceObjects: sources.length, historyDraftSourceLinks: historySources.length,
  publicationHoldRetained: true, built };
const output = path.join(root, 'reports/g3-editorial-local-20261118/contract.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(`PASS: ${paragraphCount} factual paragraphs unchanged; 16 approved claims / 21 sources; history HOLD; ${built.length} built SEO/DOM surfaces.`);
console.log(path.relative(root, output));
