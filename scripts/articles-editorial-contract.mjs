#!/usr/bin/env node
/** Scoped catalog assertions. Reads existing publication authorities, never writes them.
 * HTML is parsed as no-JS SSR, not matched by presentation-specific text regexes.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const { isExternalTelemetryNetworkNoise } = createRequire(import.meta.url)('./lib/browser-runtime-noise.js');

const root = fileURLToPath(new URL('../', import.meta.url));
const normalize = (value) => String(value ?? '').replace(/\s+/gu, ' ').trim();
export const attribute = (node, name) => node.attrs?.find((a) => a.name === name)?.value;
export const hasClass = (node, name) => (attribute(node, 'class') || '').split(/\s+/).includes(name);
export function descendants(node) { return (node.childNodes || []).flatMap((child) => [child, ...descendants(child)]); }
export function text(node) { return node?.nodeName === '#text' ? node.value : (node?.childNodes || []).map(text).join(''); }
export function parseCatalogArguments(argv, valueNames, flagNames = []) {
  const result = {};
  for (const arg of argv) {
    assert.ok(arg.startsWith('--'), `Use --name=value: ${arg}`);
    const at = arg.indexOf('='), name = arg.slice(2, at === -1 ? undefined : at);
    assert.ok(!Object.hasOwn(result, name), `Duplicate option: ${name}`);
    if (flagNames.includes(name)) { assert.equal(at, -1, `Flag takes no value: ${name}`); result[name] = true; }
    else { assert.ok(valueNames.includes(name), `Unknown option: ${name}`); assert.ok(at > 2 && arg.slice(at + 1), `Option requires a value: ${name}`); result[name] = arg.slice(at + 1); }
  }
  return result;
}
/** Keep raw requests in the browser receipt. The no-JS Metrica pixel is not
 * a cover download; only the existing structured telemetry owner may classify
 * it. Unknown external images and every extra same-origin image still fail. */
export function assertCatalogImageBudget(requests, renderedSources) {
  const classified = (entry) => isExternalTelemetryNetworkNoise(`REQUEST image ${entry.url}`);
  const telemetry = requests.filter(classified), content = requests.filter((entry) => !classified(entry));
  assert.ok(new Set(renderedSources).size <= 1, 'Text-first catalog rendered an image gallery');
  assert.ok(content.length <= 1, 'Text-first catalog fetched an image gallery');
  for (const entry of content) assert.ok(renderedSources.includes(entry.url), `Unexpected catalog image request: ${entry.url}`);
  return { content, telemetry };
}
export function documentMetadata(html) {
  const nodes = descendants(parse(html, { scriptingEnabled: false }));
  return {
    title: normalize(text(nodes.find((n) => n.tagName === 'title'))),
    canonical: nodes.filter((n) => n.tagName === 'link' && attribute(n, 'rel') === 'canonical').map((n) => attribute(n, 'href')),
    meta: nodes.filter((n) => n.tagName === 'meta' && /^(?:description|robots|author|editor|keywords|og:|twitter:|article:)/.test(attribute(n, 'name') || attribute(n, 'property') || '')).map((n) => [attribute(n, 'name') || attribute(n, 'property'), attribute(n, 'content')]).sort((a, b) => a[0].localeCompare(b[0])),
    jsonld: nodes.filter((n) => n.tagName === 'script' && attribute(n, 'type') === 'application/ld+json').map((n) => JSON.parse(text(n))),
  };
}
export function projectCatalog(manifest, ownership) {
  assert.ok(Array.isArray(manifest.items), 'Catalog manifest items missing');
  assert.ok(ownership.routes && typeof ownership.routes === 'object', 'Route authority missing');
  const items = manifest.items.filter((item) => {
    if (!['article', 'series'].includes(item.type)) return false;
    assert.ok(typeof item.url === 'string' && item.url.startsWith('/') && !item.url.startsWith('//'), 'Catalog requires a same-site URL');
    const owner = ownership.routes[item.url.split('#')[0]];
    const held = (record) => ['status', 'publicationStatus', 'publicationGate'].some((key) => record?.[key] === 'PUBLICATION_HOLD');
    return owner?.status === 'production-dist' && !held(item) && !held(owner);
  });
  assert.ok(items.length, 'Refuse an empty published catalog');
  assert.equal(new Set(items.map((i) => i.url)).size, items.length, 'Duplicate authority route');
  return items;
}
export function expectedAttribution(item) {
  const author = normalize(item.author), editor = normalize(item.editor), translator = normalize(item.translator);
  if (author && editor && author === editor && !translator) return { kind: 'author-editor', label: `Автор-редактор: ${author}` };
  assert.ok(!((author === 'Фёдор Милованов' || translator === 'Фёдор Милованов') && !editor), 'Owner role lacks editor authority');
  if (editor) return { kind: 'editor', label: `Ред.: ${editor}` };
  if (author) return { kind: 'author', label: `Автор: ${author}` };
  if (translator) return { kind: 'translator', label: `Перевод: ${translator}` };
  return { kind: 'site', label: 'Господь Бог — Сила Моя' };
}
export function inspectCatalogHtml(html, { manifest, ownership, baselineHtml, edition = true }) {
  const nodes = descendants(parse(html, { scriptingEnabled: false }));
  const expected = projectCatalog(manifest, ownership);
  const cards = nodes.filter((n) => attribute(n, 'data-catalog-route') !== undefined || attribute(n, 'data-catalog-series') !== undefined);
  const urls = cards.map((n) => attribute(n, 'data-catalog-route') ?? attribute(n, 'data-catalog-series'));
  assert.equal(new Set(urls).size, urls.length, 'Duplicate rendered catalog route');
  assert.deepEqual([...urls].sort(), expected.map((i) => i.url).sort(), 'Rendered published set differs from authority');
  for (const card of cards) {
    const url = attribute(card, 'data-catalog-route') ?? attribute(card, 'data-catalog-series');
    const original = expected.find((i) => i.url === url), children = descendants(card);
    assert.equal(card.tagName, 'a', `Catalog destination is not a native link: ${url}`);
    assert.equal(attribute(card, 'href'), url, `Catalog href mismatch: ${url}`);
    assert.equal(attribute(card, original.type === 'article' ? 'data-catalog-route' : 'data-catalog-series'), url, `Catalog kind changed: ${url}`);
    const heading = children.find((n) => /^h[2-6]$/.test(n.tagName || ''));
    assert.equal(normalize(text(heading)), normalize(original.title || original.id || original.url), `Title drift: ${url}`);
    assert.equal(normalize(text(children.find((n) => hasClass(n, 'h-article-abstract')))), normalize(original.description), `Description drift: ${url}`);
    const images = children.filter((n) => n.tagName === 'img' || n.tagName === 'picture' || n.tagName === 'source');
    if (edition) assert.equal(images.length, 0, `Exhaustive text-first index must not fetch OG thumbnails: ${url}`);
    else if (original.image) {
      const image = images.find((n) => n.tagName === 'img');
      assert.ok(image && attribute(image, 'alt') !== undefined, `Missing image/alt: ${url}`);
      assert.equal(attribute(image, 'src'), original.image, `Media authority changed: ${url}`);
      assert.ok(Number(attribute(image, 'width')) > 0 && Number(attribute(image, 'height')) > 0, `Image dimensions missing: ${url}`);
    }
    if (original.type === 'article') {
      const role = children.find((n) => attribute(n, 'data-catalog-role') !== undefined), attribution = expectedAttribution(original);
      assert.equal(attribute(role || {}, 'data-catalog-role'), attribution.kind, `Role kind drift: ${url}`);
      assert.equal(normalize(text(role)), attribution.label, `Role label drift: ${url}`);
    }
    if (Number.isFinite(original.readTime)) assert.equal(normalize(text(children.find((n) => hasClass(n, 'h-meta-time')))), `${original.readTime} мин`, `Reading time drift: ${url}`);
  }
  const ids = nodes.map((n) => attribute(n, 'id')).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate DOM id');
  for (const n of nodes.filter((n) => n.tagName === 'a' && attribute(n, 'href')?.startsWith('#'))) {
    assert.ok(ids.includes(decodeURIComponent(attribute(n, 'href').slice(1))), `Orphan native anchor: ${attribute(n, 'href')}`);
  }
  const featured = nodes.filter((n) => attribute(n, 'data-catalog-featured-repeat') !== undefined);
  const featuredExpected = expected.some((i) => i.type === 'article' && i.url === '/articles/kod-da-vinchi/');
  assert.equal(featured.length, featuredExpected ? 1 : 0, 'Curated repeat must be explicit and published');
  for (const n of featured) {
    assert.equal(attribute(n, 'data-catalog-featured-repeat'), '/articles/kod-da-vinchi/', 'Unexpected curated duplicate');
    assert.equal(attribute(n, 'href'), '/articles/kod-da-vinchi/', 'Curated repeat route drift');
    if (edition) {
      const images = descendants(n).filter((child) => child.tagName === 'img');
      assert.equal(images.length, 1, 'Keep the one source-owned curated picture, not an index image gallery');
      assert.ok(attribute(images[0], 'alt'), 'Curated image alt missing');
      assert.ok(Number(attribute(images[0], 'width')) > 0 && Number(attribute(images[0], 'height')) > 0, 'Curated image dimensions missing');
    }
  }
  const metadata = documentMetadata(html);
  if (edition) {
    for (const card of [...cards, ...featured]) {
      assert.ok(hasClass(card, 'articles-entry') && !hasClass(card, 'h-article-card'), 'Catalog must use its edition entry class, not legacy href hotfix styling');
      assert.ok(card.parentNode?.tagName === 'li' && hasClass(card.parentNode, 'h-article-card'), 'Retain the semantic catalog card container hook on its list item');
    }
    const articles = expected.filter((i) => i.type === 'article'), series = expected.filter((i) => i.type === 'series');
    const groups = [...new Set(articles.map((i) => i.section || 'Другие материалы'))];
    const library = nodes.filter((n) => attribute(n, 'data-catalog-source') === 'search-manifest+page-ownership');
    assert.equal(library.length, 1, 'Exactly one authority-derived library');
    const summary = descendants(library[0]).find((n) => hasClass(n, 'articles-count'));
    assert.ok(summary, 'Dynamic library summary missing');
    assert.equal(Number(normalize(text(descendants(summary).find((n) => n.tagName === 'strong')))), articles.length, 'Dynamic article count drift');
    assert.equal(Number(normalize(text(descendants(summary).find((n) => n.tagName === 'span'))).match(/^\d+/)?.[0]), series.length, 'Dynamic series count drift');
    const navigation = nodes.filter((n) => attribute(n, 'data-catalog-topics') !== undefined);
    assert.equal(navigation.length, 1, 'Exactly one SSR topics navigation');
    const topicLinks = descendants(navigation[0]).filter((n) => n.tagName === 'a' && attribute(n, 'href') !== '#catalog-series');
    assert.equal(topicLinks.length, groups.length, 'Topic navigation set drift');
    assert.equal(nodes.filter((n) => hasClass(n, 'articles-topic')).length, groups.length, 'Rendered topic group set drift');
    const visited = new Set();
    for (const link of topicLinks) {
      const id = attribute(link, 'href')?.slice(1), heading = nodes.find((n) => attribute(n, 'id') === id);
      const name = normalize(text(heading));
      assert.ok(groups.includes(name) && !visited.has(name), `Invalid/duplicate projected topic: ${name}`); visited.add(name);
      const group = nodes.find((n) => hasClass(n, 'articles-topic') && attribute(n, 'aria-labelledby') === id);
      assert.ok(group, `Topic target is not its semantic group: ${name}`);
      const wanted = articles.filter((i) => (i.section || 'Другие материалы') === name);
      const rendered = descendants(group).filter((n) => attribute(n, 'data-catalog-route') !== undefined).map((n) => attribute(n, 'data-catalog-route'));
      assert.deepEqual(rendered.sort(), wanted.map((i) => i.url).sort(), `Topic membership drift: ${name}`);
      assert.equal(Number(normalize(text(descendants(link).find((n) => hasClass(n, 'articles-topic-count'))))), wanted.length, `Dynamic topic count drift: ${name}`);
    }
    const seriesCards = cards.filter((n) => attribute(n, 'data-catalog-series') !== undefined), articleCards = cards.filter((n) => attribute(n, 'data-catalog-route') !== undefined);
    if (seriesCards.length) assert.ok(Math.max(...articleCards.map((n) => nodes.indexOf(n))) < Math.min(...seriesCards.map((n) => nodes.indexOf(n))), 'Materials must precede series in native reading order');
    const count = (predicate) => nodes.filter(predicate).length;
    assert.equal(count((n) => n.tagName === 'main'), 1, 'Exactly one main');
    assert.equal(count((n) => n.tagName === 'h1'), 1, 'Exactly one h1');
    assert.equal(count((n) => hasClass(n, 'je-masthead')), 1, 'Exactly one selected masthead');
    assert.equal(count((n) => attribute(n, 'id') === 'mobileChromePage'), 1, 'Exactly one registry mobile chrome');
    assert.equal(count((n) => hasClass(n, 'skip-link')), 1, 'Exactly one skip link');
    assert.equal(count((n) => attribute(n, 'data-gb-search-bootstrap') !== undefined), 1, 'Exactly one search bootstrap');
    assert.equal(count((n) => attribute(n, 'data-journal-theme') !== undefined), 1, 'Exactly one theme adapter');
    assert.equal(count((n) => ['hNavbar', 'hMobileNav', 'themeToggle', 'hScrollTop'].includes(attribute(n, 'id'))), 0, 'Competing legacy chrome');
    const active = nodes.filter((n) => n.tagName === 'a' && attribute(n, 'aria-current') !== undefined);
    assert.equal(active.length, 1, 'Exactly one active edition section');
    assert.equal(attribute(active[0], 'href'), '/articles/', 'Active section is not articles');
    assert.deepEqual(metadata.canonical, ['https://gospod-bog.ru/articles/'], 'Catalog canonical drift');
    assert.equal(metadata.meta.filter(([name]) => name.startsWith('article:')).length, 0, 'CollectionPage leaked Article timestamps');
    const graph = metadata.jsonld.flatMap((v) => v['@graph'] || [v]);
    assert.equal(graph.filter((v) => v['@type'] === 'CollectionPage').length, 1, 'Exactly one CollectionPage owner');
    assert.equal(graph.filter((v) => v['@type'] === 'BreadcrumbList').length, 1, 'Exactly one breadcrumb owner');
    assert.ok(metadata.meta.some(([name, value]) => name === 'og:image:alt' && value), 'OG alt missing');
    assert.ok(metadata.meta.some(([name, value]) => name === 'twitter:image:alt' && value), 'Twitter alt missing');
    const preloads = nodes.filter((n) => n.tagName === 'link' && attribute(n, 'rel') === 'preload' && attribute(n, 'as') === 'font');
    assert.equal(preloads.length, 4, 'Exactly four selected font hints');
    assert.equal(new Set(preloads.map((n) => attribute(n, 'href'))).size, 4, 'Duplicate font hint');
  }
  if (baselineHtml) assert.deepEqual(metadata, documentMetadata(baselineHtml), 'Route-owned SEO/date/JSON-LD changed during visual work');
  return { articles: expected.filter((i) => i.type === 'article').length, series: expected.filter((i) => i.type === 'series').length, rendered: cards.length, explicitCuratedRepeats: featured.length, exactTextRoles: true, indexMedia: edition ? 'text-only-original-covers-retained-in-authority' : 'legacy-source-images', metadata };
}
export function assertCatalogSource() {
  const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
  const page = read('src/pages/articles/index.astro'), chrome = read('src/components/articles/ArticlesPageChrome.astro'), main = read('src/components/articles/ArticlesMain.astro');
  assert.match(page, /<JournalEditorialShell[\s\S]*?kind="articles"/, 'Use selected edition shell');
  assert.match(page, /mobileChromeFor\('\/articles\/'\)/, 'Keep mobile registry authority');
  assert.equal((chrome.match(/<JournalFontPreloads\s*\/>/g) || []).length, 1, 'Exactly one selected font hint owner');
  assert.ok(!chrome.includes('css/home.css') && !chrome.includes('id="hNavbar"'), 'Retired home presentation returned');
  assert.ok(!main.includes('<SiteSectionsMenu'), 'Second navigation owner returned');
  const footer = read('src/components/articles/ArticlesPageFooter.astro');
  assert.ok(!/js\/(?:site|site-utils|scroll-perf)\.js/.test(footer), 'Legacy catalog interaction owner returned');
  assert.match(footer, /js\/sw-register\.js\?v=/, 'Keep existing SW registration revision');
  const css = read('src/components/articles/articlesEditorial.css');
  assert.ok(!/!important\s*[;}]/.test(css), 'Catalog CSS uses important');
  assert.ok(!/-webkit-line-clamp\s*:\s*\d/.test(css), 'Catalog text is clamped');
  const library = read('src/components/articles/ArticlesLibrarySection.astro');
  assert.match(library, /data-catalog-source="search-manifest\+page-ownership"/);
  assert.ok(!/<(?:img|picture|source)\b/.test(library), 'Do not return OG images to the exhaustive index');
  assert.ok(!/\b80\s*(?:опубликованных|материалов)/u.test(library), 'Hardcoded current inventory count');
  return { selectedShell: true, registryMobile: true, oneFontHintOwner: true, oldCatalogRuntimeRetired: true, noClampOrImportant: true, textFirstIndex: true };
}
export function catalogProvenance(transferPath) {
  if (transferPath) {
    const transfer = JSON.parse(fs.readFileSync(transferPath, 'utf8'));
    assert.match(transfer.source || '', /^[a-f0-9]{40}$/); assert.match(transfer.base || '', /^[a-f0-9]{40}$/);
    for (const item of transfer.files) {
      assert.ok(!path.isAbsolute(item.path) && !item.path.split('/').includes('..'), 'Unsafe transfer source pin');
      const bytes = fs.readFileSync(path.join(root, item.path));
      assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), item.after.blob, `Transferred source changed: ${item.path}`);
    }
    return { head: null, worktree: null, composite: { base: transfer.base, source: transfer.source, notCanonicalGitCommit: true }, transferredSourcePins: transfer.files.length };
  }
  return { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), worktree: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() };
}
function main() {
  const args = parseCatalogArguments(process.argv.slice(2), ['dist', 'baseline', 'output', 'transfer'], ['source-only', 'functional-check']);
  assert.ok(!(args.transfer && args['functional-check']), 'Do not mix pinned transfer provenance with an unattributed functional check');
  // Existing repository UI audits also run in Gitless release exports. They
  // assert the same full source/SSR contract without inventing a Git HEAD.
  // Exact-head acceptance runs this CLI separately with Git or --transfer.
  const provenance = args['functional-check'] ? { head: null, worktree: null, unattributedFunctionalCheck: true, exactHeadAcceptance: false } : catalogProvenance(args.transfer);
  const report = { ...provenance, source: assertCatalogSource() };
  if (!args['source-only']) {
    const html = fs.readFileSync(path.join(root, args.dist || 'dist', 'articles/index.html'), 'utf8');
    report.catalog = inspectCatalogHtml(html, { manifest: JSON.parse(fs.readFileSync(path.join(root, 'data/search-manifest.json'))), ownership: JSON.parse(fs.readFileSync(path.join(root, 'migration/page-ownership.json'))), baselineHtml: args.baseline ? fs.readFileSync(args.baseline, 'utf8') : undefined });
    report.htmlSha256 = createHash('sha256').update(html).digest('hex');
  }
  if (args.output) { const out = path.resolve(root, args.output); fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'contract.json'), JSON.stringify(report, null, 2) + '\n'); }
  console.log(JSON.stringify(report, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`Articles editorial contract FAIL: ${error.message}`); process.exitCode = 1; }
}
