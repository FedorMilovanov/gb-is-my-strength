#!/usr/bin/env node
/**
 * Bounded Journal/G3 regression witness, not a Research/publication approval.
 * Run after the canonical production-like build:
 *   node scripts/journal-editorial-contract.mjs [--public-only] [--probe-hold]
 * --public-only omits the held manuscript's presentation bibliography check so
 * the public components/tests transfer without importing history-only data.
 * It NEVER skips publication/HOLD, discovery, source or production-guard checks.
 * The optional probe renders the REAL held component in an isolated temporary
 * Astro production build. It must fail with its own PUBLICATION_HOLD guard.
 * No public route, registry, dependency or CI policy is written by this test.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'parse5';
import { G3_PUBLICATION_HANDOFF as handoff } from '../src/data/journal/g3PublicationHandoff.ts';
import { G3_SOURCE_BIBLIOGRAPHY as sources } from '../src/data/journal/g3SourceBibliography.ts';
import { G3_PRODUCT_METADATA as metadata } from '../src/data/journal/g3ProductMetadata.ts';
import { G3_HISTORY_DRAFT_METADATA as draft } from '../src/data/journal/g3HistoryDraftMetadata.ts';

const args = new Set(process.argv.slice(2));
for (const arg of args) assert.ok(['--public-only', '--probe-hold'].includes(arg), `Unknown Journal contract option: ${arg}`);
const publicOnly = args.has('--public-only');
const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const attrs = (node) => Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
// Collapse whitespace only after joining text nodes. Trimming each inline node
// would hide the very missing-space regressions this witness needs to detect.
const rawText = (node) => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(rawText).join('');
const text = (node) => rawText(node).replace(/\s+/g, ' ').trim();
let verifiedReadingParagraphs = 0;
function elements(document) {
  const result = [];
  function walk(node) { if (node.tagName) result.push(node); (node.childNodes || []).forEach(walk); }
  walk(document);
  return result;
}
function requireOne(nodes, predicate, message) {
  const selected = nodes.filter(predicate);
  assert.equal(selected.length, 1, message);
  return selected[0];
}
const claims = Array.from({ length: 16 }, (_, i) => `G3-PUB-${String(i + 1).padStart(3, '0')}`);
assert.deepEqual([...handoff.claimIds], claims, 'This proposal must not expand the September claim set');
assert.equal(handoff.researchSealCommit, '298d00ddc4db46522c8ad904016e98a4426c9fcf');
assert.equal(sources.length, 21);
assert.deepEqual(sources.map((entry) => entry.id).sort(), [...handoff.sourceIds].sort());
assert.equal(draft.publicationStatus, 'PUBLICATION_HOLD');
const heldCandidates = Array.from({ length: 9 }, (_, i) => `G3-HIST-PUB-${String(i + 1).padStart(2, '0')}`);
// Canonical b2ae predates the manuscript metadata rename. In public-only mode
// read its legacy label as held candidate IDs, NEVER as publication authority.
// Do not manufacture a NOT_ISSUED field where the baseline has no such field.
const legacyHeldDraft = publicOnly && !Object.hasOwn(draft, 'candidateClaimIds');
if (legacyHeldDraft) {
  assert.ok(Array.isArray(draft.approvalClaimIds), 'Legacy held candidate array required');
  assert.ok(!Object.hasOwn(draft, 'handoffStatus'), 'Legacy held labels must not carry an issued/mixed handoff state');
  assert.deepEqual([...draft.approvalClaimIds], heldCandidates, 'Legacy held candidates must remain the exact nine IDs');
} else {
  assert.ok(!Object.hasOwn(draft, 'approvalClaimIds'), 'Ambiguous history claim metadata');
  assert.equal(draft.handoffStatus, 'NOT_ISSUED');
  assert.deepEqual([...draft.candidateClaimIds], heldCandidates);
}
if (!publicOnly) {
  const { G3_HISTORY_BIBLIOGRAPHY: historySources } = await import('../src/data/journal/g3HistoryBibliography.ts');
  assert.equal(new Set(historySources.map((entry) => entry.id)).size, historySources.length);
}
assert.equal(metadata.publishedAt, '2026-09-09T00:00:00+03:00');

for (const file of ['G3HistoryArticle.astro', 'G3HistoryFeature.astro']) {
  const source = read(`src/components/journal/${file}`);
  assert.match(source, /if\s*\(import\.meta\.env\.PROD\)\s*\{\s*throw new Error\([^;]*PUBLICATION_HOLD/s, `${file}: production guard`);
}
for (const directory of ['src/pages', 'dist/journal']) {
  for (const file of fs.readdirSync(path.join(root, directory), { recursive: true }).filter((name) => /\.(astro|html)$/.test(name))) {
    const contents = read(`${directory}/${file}`);
    assert.doesNotMatch(contents, /(?:G3History(?:Article|Feature)|g3History(?:DraftMetadata|Bibliography)|G3-HIST-PUB-|data-g3-article="history")/, `${directory}/${file}: held history activation`);
  }
}
assert.ok(!fs.existsSync(path.join(root, 'dist/journal/dossiers/g3/history')), 'No public history output');
for (const file of ['migration/page-ownership.json', 'data/search-manifest.json', 'sitemap.xml', 'feed.xml', 'dist/sitemap.xml', 'dist/feed.xml']) {
  assert.doesNotMatch(read(file), /\/journal\/dossiers\/g3\/history\//, `${file}: held route discovery leak`);
}

for (const [route, title, kind] of [
  ['/journal/', 'Журнал', 'CollectionPage'],
  ['/journal/dossiers/g3/', metadata.title, 'Article'],
]) {
  const html = read(`dist${route}index.html`);
  const nodes = elements(parse(html));
  const idList = nodes.map((node) => attrs(node).id).filter(Boolean);
  assert.equal(new Set(idList).size, idList.length, `${route}: duplicate DOM IDs`);
  assert.equal(text(requireOne(nodes, (node) => node.tagName === 'h1', `${route}: one H1`)), title);
  requireOne(nodes, (node) => node.tagName === 'main' && attrs(node).id === 'main-content', `${route}: skip target`);
  const canonical = attrs(requireOne(nodes, (node) => node.tagName === 'link' && attrs(node).rel === 'canonical', `${route}: canonical`)).href;
  assert.equal(canonical, `https://gospod-bog.ru${route}`);
  for (const property of ['og:title', 'og:url', 'og:image', 'article:published_time', 'article:modified_time']) {
    requireOne(nodes, (node) => node.tagName === 'meta' && attrs(node).property === property, `${route}: unique ${property}`);
  }
  const scripts = nodes.filter((node) => node.tagName === 'script' && attrs(node).type === 'application/ld+json');
  const graph = scripts.flatMap((node) => { const value = JSON.parse(text(node)); return value['@graph'] || [value]; });
  const entity = requireOne(graph, (node) => node['@type'] === kind, `${route}: one ${kind} schema owner`);
  assert.equal(entity.url, canonical);
  const ids = new Set(idList);
  for (const node of nodes.filter((entry) => entry.tagName === 'a' && attrs(entry).href?.startsWith('#'))) {
    const target = decodeURIComponent(attrs(node).href.slice(1));
    assert.ok(ids.has(target), `${route}: missing anchor #${target}`);
  }
  const cover = requireOne(nodes, (node) => node.tagName === 'img' && attrs(node).src?.includes('g3-ministries-cover'), `${route}: one cover`);
  assert.equal(attrs(cover).width, '1200');
  assert.equal(attrs(cover).height, '675');
  assert.match(attrs(cover).srcset, /640\.webp 640w, .*1200\.webp 1200w/);
  assert.ok(nodes.some((node) => node.tagName === 'source' && attrs(node).type === 'image/avif'), `${route}: AVIF selection with WebP fallback`);
  const runtimeSources = nodes.filter((node) => node.tagName === 'script' && attrs(node).src).map((node) => attrs(node).src);
  assert.equal(new Set(runtimeSources).size, runtimeSources.length, `${route}: duplicate runtime script owner`);
  if (kind === 'Article') {
    assert.equal(entity.datePublished, metadata.publishedAt);
    assert.equal(entity.dateModified, metadata.modifiedAt);
    assert.equal(entity.headline, metadata.title);
    // The Astro source remains the only prose owner. Compare its literal reading
    // paragraphs with the compressed production DOM, not a handwritten text fixture.
    // Dynamic expressions are deliberately not interpreted by this HTML witness.
    const sourceDocument = read('src/components/journal/G3Dossier.astro').replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, '');
    const sourceNodes = elements(parse(sourceDocument));
    for (const id of ['overview', 'timeline', 'finance', 'governance', 'buice', 'buck', 'wind-down', 'unknowns', 'documents']) {
      const fromSource = requireOne(sourceNodes, (node) => attrs(node).id === id, `${id}: source reading section`);
      const inDist = requireOne(nodes, (node) => attrs(node).id === id, `${id}: built reading section`);
      const expected = elements(fromSource).filter((node) => node.tagName === 'p' && !/[{}]/.test(rawText(node))).map(text).filter(Boolean);
      const rendered = elements(inDist).filter((node) => node.tagName === 'p').map(text);
      assert.ok(expected.length > 0, `${id}: literal source paragraphs available`);
      for (const paragraph of expected) {
        assert.ok(rendered.includes(paragraph), `${id}: source paragraph word boundaries lost during HTML compression: ${paragraph.slice(0, 120)}…`);
        verifiedReadingParagraphs++;
      }
    }
    const projected = [...new Set(nodes.flatMap((node) => (attrs(node)['data-research-claims'] || '').split(/\s+/).filter(Boolean)))].sort();
    assert.deepEqual(projected, claims, `${route}: approved claims remain traceable`);
    for (const source of sources) {
      const entry = requireOne(nodes, (node) => attrs(node).id === `src-${source.id}`, `${source.id}: bibliography target`);
      assert.equal(attrs(entry)['data-source-tier'], source.tier, `${source.id}: inherited evidence class preserved`);
      assert.equal(attrs(entry)['data-source-eligibility'], source.eligibility, `${source.id}: eligibility is not inferred from a reader label`);
    }
    assert.ok(nodes.some((node) => attrs(node).class?.split(' ').includes('article-header')));
    assert.ok(nodes.some((node) => attrs(node).class?.split(' ').includes('author-card')));
  }
}

let productionProbe = 'not requested (use --probe-hold)';
if (args.has('--probe-hold')) {
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const fixture = fs.mkdtempSync(path.join(root, '.cache/g3-hold-probe-'));
  try {
    fs.mkdirSync(path.join(fixture, 'src/pages'), { recursive: true });
    fs.writeFileSync(path.join(fixture, 'src/pages/index.astro'), `---\nimport History from ${JSON.stringify(path.join(root, 'src/components/journal/G3HistoryArticle.astro'))};\n---\n<History />\n`);
    const config = `export default {root:${JSON.stringify(fixture)}, srcDir:${JSON.stringify(path.join(fixture, 'src'))}, publicDir:${JSON.stringify(path.join(fixture, 'empty-public'))}, outDir:${JSON.stringify(path.join(fixture, 'output'))}, cacheDir:${JSON.stringify(path.join(fixture, 'cache'))}, vite:{resolve:{alias:{'@':${JSON.stringify(path.join(root, 'src'))}}}}};\n`;
    fs.writeFileSync(path.join(fixture, 'astro.config.mjs'), config);
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/astro-cli.mjs'), 'build', '--config', path.relative(root, path.join(fixture, 'astro.config.mjs'))], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 5 * 1024 * 1024 });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, 'Production probe must reject history');
    assert.match(result.stdout + result.stderr, /G3 history PUBLICATION_HOLD: signed Research→Product handoff required/);
    productionProbe = 'PASS: real history render rejected in isolated production build';
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
}
console.log('Journal/G3 contract PASS: two public routes, 16 claims, 21 sources, nine held candidates; anchors, metadata and prepared cover projections.');
console.log(`Reading text parity PASS: ${verifiedReadingParagraphs} literal dossier paragraphs preserve source word boundaries.`);
console.log(`History fail-closed probe: ${productionProbe}`);
if (legacyHeldDraft) console.log('History metadata: legacy held-candidate label preserved; no handoffStatus field or publication permission inferred.');
console.log(publicOnly
  ? 'History presentation bibliography: NOT RUN (--public-only); all publication/HOLD checks remain mandatory.'
  : 'History presentation bibliography: PASS (default strict mode).');
