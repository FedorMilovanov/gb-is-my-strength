#!/usr/bin/env node
/*
 * Guard /articles/ native Astro catalog contract.
 *
 * The exhaustive library is derived from existing publication authorities:
 * data/search-manifest.json owns reader-facing metadata (including covers) and
 * migration/page-ownership.json owns current production disposition. The old
 * hand-maintained ArticlesPublicationsSection must not return as a second
 * catalog authority.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function readJson(rel){ return JSON.parse(read(rel)); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
function ok(msg){ console.log('✅ ' + msg); }
function bad(msg){ problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label){ haystack.includes(needle) ? ok(label || needle) : bad(`missing: ${label || needle}`); }
function mustNot(haystack, needle, label){ !haystack.includes(needle) ? ok(`no ${label || needle}`) : bad(`forbidden present: ${label || needle}`); }
function mustExist(rel, label){ exists(rel) ? ok(label || rel) : bad(`missing file: ${label || rel}`); }
function mustNotExist(rel, label){ !exists(rel) ? ok(`absent: ${label || rel}`) : bad(`forbidden file/dir present: ${label || rel}`); }
function publicRoute(url){
  const route = String(url || '').split(/[?#]/, 1)[0] || '/';
  return route === '/' ? '/' : `${route.replace(/^\/+|\/+$/g, '')}/`.replace(/^/, '/');
}
function repositoryMediaPath(image){
  const value = String(image || '').split(/[?#]/, 1)[0];
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  const rel = value.replace(/^\/+/, '');
  if (!rel || rel.includes('..')) return null;
  return rel;
}

const legacy = read('articles/index.html');
const page = read('src/pages/articles/index.astro');
const chrome = read('src/components/articles/ArticlesPageChrome.astro');
const main = read('src/components/articles/ArticlesMain.astro');
const footer = read('src/components/articles/ArticlesPageFooter.astro');
const library = read('src/components/articles/ArticlesLibrarySection.astro');
const refutations = read('src/components/articles/ArticlesRefutationsSection.astro');
const hero = read('src/components/articles/ArticlesHeroSection.astro');
const endBlock = read('src/components/articles/ArticlesArticleEndBlock.astro');
const searchManifest = readJson('data/search-manifest.json');
const pageOwnership = readJson('migration/page-ownership.json');

for (const marker of ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card', 'h-article-list']) {
  must(legacy, marker, `legacy /articles/ marker: ${marker}`);
}

for (const [rel, label] of [
  ['src/components/articles/ArticlesPageChrome.astro', 'ArticlesPageChrome.astro'],
  ['src/components/articles/ArticlesMain.astro', 'ArticlesMain.astro'],
  ['src/components/articles/ArticlesPageFooter.astro', 'ArticlesPageFooter.astro'],
  ['src/components/articles/ArticlesHeroSection.astro', 'ArticlesHeroSection.astro'],
  ['src/components/articles/ArticlesLibrarySection.astro', 'ArticlesLibrarySection.astro'],
  ['src/components/articles/ArticlesRefutationsSection.astro', 'ArticlesRefutationsSection.astro'],
  ['src/components/articles/ArticlesArticleEndBlock.astro', 'ArticlesArticleEndBlock.astro'],
]) mustExist(rel, label);

mustNotExist('src/components/articles/ArticlesPublicationsSection.astro', 'retired hand-authored ArticlesPublicationsSection');
mustNotExist('src/components/articles/_legacy', 'src/components/articles/_legacy deleted');

for (const comp of ['ArticlesPageChrome', 'ArticlesMain', 'ArticlesPageFooter']) {
  must(page, comp, `page uses ${comp}`);
}

must(page, '<!DOCTYPE html>', 'Astro /articles/ emits full document doctype');
must(chrome, '<head>', 'ArticlesPageChrome owns <head>');
must(chrome, '<body class="articles-index-page">', 'ArticlesPageChrome owns body class');
must(chrome, 'CollectionPage', 'ArticlesPageChrome preserves JSON-LD CollectionPage');
must(chrome, 'SITE_CONFIG', 'ArticlesPageChrome preserves SITE_CONFIG');
must(chrome, 'h-navbar', 'ArticlesPageChrome preserves top navigation');
must(main, '<main id="main-content">', 'ArticlesMain preserves semantic main wrapper');
must(main, 'h-mobile-nav', 'ArticlesMain preserves mobile nav');
must(main, 'home-v20', 'ArticlesMain preserves premium home-v20 wrapper');
for (const comp of ['ArticlesHeroSection','ArticlesLibrarySection','ArticlesRefutationsSection','ArticlesArticleEndBlock']) {
  must(main, comp, `ArticlesMain uses ${comp}`);
}
mustNot(main, 'ArticlesPublicationsSection', 'retired hand-authored publications owner');
mustNot(main, '../../../data/series.json', 'second catalog projection through series.json');
must(footer, 'gb-accuracy-block', 'ArticlesPageFooter preserves feedback block');
must(footer, 'h-scroll-top', 'ArticlesPageFooter preserves scroll-top control');
must(footer, 'site.js', 'ArticlesPageFooter preserves runtime script');

for (const [content, marker, label] of [
  [hero, 'h-hero-title', 'ArticlesHeroSection marker: h-hero-title'],
  [library, "../../../data/search-manifest.json", 'ArticlesLibrarySection uses canonical reader metadata'],
  [library, "../../../migration/page-ownership.json", 'ArticlesLibrarySection uses route publication authority'],
  [library, "item.type === 'article'", 'ArticlesLibrarySection derives article membership'],
  [library, "item.type === 'series'", 'ArticlesLibrarySection derives series membership'],
  [library, "status === 'production-dist'", 'ArticlesLibrarySection filters current production routes'],
  [library, 'data-catalog-source="search-manifest+page-ownership"', 'ArticlesLibrarySection records projection authority'],
  [library, 'id="publikacii"', 'ArticlesLibrarySection preserves publications anchor'],
  [library, 'data-catalog-route={item.url}', 'ArticlesLibrarySection renders canonical article routes'],
  [library, 'data-catalog-series={item.url}', 'ArticlesLibrarySection renders canonical series routes'],
  [library, 'item.image &&', 'ArticlesLibrarySection projects manifest cover presence'],
  [library, 'class="h-article-thumb"', 'ArticlesLibrarySection preserves premium thumbnail shell'],
  [library, 'src={item.image}', 'ArticlesLibrarySection projects canonical cover path'],
  [library, 'h-article-list--grid', 'ArticlesLibrarySection preserves premium grid classes'],
  [library, 'author?: string;', 'ArticlesLibrarySection consumes structured author authority'],
  [library, 'translator?: string;', 'ArticlesLibrarySection keeps translator authority distinct'],
  [library, "kind: 'author-editor' | 'editor' | 'author' | 'translator' | 'site'", 'ArticlesLibrarySection declares bounded attribution states'],
  [library, 'author === editor && !translator', 'ArticlesLibrarySection recognizes owner-approved author-editor identity'],
  [library, 'Автор-редактор: ${author}', 'ArticlesLibrarySection emits owner-approved original-material label'],
  [library, 'Автор: Автор, не редактор', 'ArticlesLibrarySection build-time fixture protects author-only attribution'],
  [library, 'Ред.: Фёдор Милованов', 'ArticlesLibrarySection build-time fixture preserves translation/editor catalog label'],
  [library, 'data-catalog-role={catalogAttribution(item).kind}', 'ArticlesLibrarySection exposes rendered attribution role for browser evidence'],
  [refutations, 'id="razbor"', 'ArticlesRefutationsSection marker: refutations section'],
  [refutations, 'историческая подмена', 'ArticlesRefutationsSection marker: kod-da-vinchi copy'],
  [endBlock, 'Soli Deo Gloria', 'ArticlesArticleEndBlock marker: SDG'],
]) must(content, marker, label);

mustNot(library, "item.editor ? `Редактор: ${item.editor}` : 'Господь Бог — Сила Моя'", 'retired editor-only attribution fallback');
mustNot(library, 'editor = author', 'catalog must never synthesize editor from author');
mustNot(library, 'editor: author', 'catalog must never copy author into editor authority');

for (const content of [page, chrome, main, footer, library, refutations, hero, endBlock]) {
  for (const marker of [
    'loadLegacyFullDocument',
    '?raw',
    '_legacy/',
    'import BaseLayout',
    '<BaseLayout',
    'astro-card-grid',
    'astro-shell',
    'Fragment set:html',
  ]) {
    mustNot(content, marker, `forbidden native articles marker: ${marker}`);
  }
}

const productionRoutes = pageOwnership.routes || {};
const projected = (searchManifest.items || []).filter((item) => {
  if (!['article', 'series'].includes(item.type)) return false;
  return productionRoutes[publicRoute(item.url)]?.status === 'production-dist';
});
const projectedUrls = projected.map((item) => String(item.url || ''));
if (new Set(projectedUrls).size === projectedUrls.length) ok(`derived catalog routes are unique: ${projectedUrls.length}`);
else bad('derived catalog would render duplicate article/series URLs');

for (const item of projected) {
  const label = item.id || item.url || '<unknown>';
  const rel = repositoryMediaPath(item.image);
  if (!rel) {
    bad(`${label}: published catalog item has no repository-local image authority`);
    continue;
  }
  if (!exists(rel)) {
    bad(`${label}: catalog image missing from repository: ${rel}`);
    continue;
  }
  ok(`${label}: catalog image authority resolves: ${rel}`);
}
if (projected.length) ok(`derived catalog media coverage checked for ${projected.length} published article/series item(s)`);
else bad('derived catalog projection has no published article/series items');

const dist = exists('dist/articles/index.html') ? read('dist/articles/index.html') : '';
if (dist) {
  for (const marker of ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card', 'h-article-thumb', 'gb-accuracy-block', 'data-catalog-role=']) {
    must(dist, marker, `dist /articles/ marker: ${marker}`);
  }
  mustNot(dist, 'astro-card-grid', 'dist /articles/ generic regression marker absent');
  const renderedThumbs = (dist.match(/class=["'][^"']*\bh-article-thumb\b[^"']*["']/g) || []).length;
  if (renderedThumbs >= projected.length) ok(`dist catalog thumbnails cover projected items: ${renderedThumbs}/${projected.length}`);
  else bad(`dist catalog thumbnail count ${renderedThumbs} is below projected item count ${projected.length}`);
}

console.log('\nARTICLES VISUAL PARITY AUDIT');
if (problems.length) { console.log(`❌ ${problems.length} problem(s).`); process.exit(1); }
ok('/articles/ catalog is native Astro, authority-derived, role-aware, media-complete and visual-parity guarded');
