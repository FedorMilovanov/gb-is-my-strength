#!/usr/bin/env node
/*
 * Guard /articles/ 100% native Astro catalog contract.
 *
 * LANE visual-fix-articles-index-2026-06-23 replaces the former
 * native-shadow recipe (loadLegacyFullDocument + _legacy fragments) with a
 * full native document split into named Astro components.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
function ok(msg){ console.log('✅ ' + msg); }
function bad(msg){ problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label){ haystack.includes(needle) ? ok(label || needle) : bad(`missing: ${label || needle}`); }
function mustNot(haystack, needle, label){ !haystack.includes(needle) ? ok(`no ${label || needle}`) : bad(`forbidden present: ${label || needle}`); }
function mustExist(rel, label){ exists(rel) ? ok(label || rel) : bad(`missing file: ${label || rel}`); }
function mustNotExist(rel, label){ !exists(rel) ? ok(`absent: ${label || rel}`) : bad(`forbidden file/dir present: ${label || rel}`); }

const legacy = read('articles/index.html');
const page = read('src/pages/articles/index.astro');
const chrome = read('src/components/articles/ArticlesPageChrome.astro');
const main = read('src/components/articles/ArticlesMain.astro');
const footer = read('src/components/articles/ArticlesPageFooter.astro');
const publications = read('src/components/articles/ArticlesPublicationsSection.astro');
const refutations = read('src/components/articles/ArticlesRefutationsSection.astro');
const hero = read('src/components/articles/ArticlesHeroSection.astro');
const endBlock = read('src/components/articles/ArticlesArticleEndBlock.astro');

for (const marker of ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card', 'h-article-list']) {
  must(legacy, marker, `legacy /articles/ marker: ${marker}`);
}

for (const [rel, label] of [
  ['src/components/articles/ArticlesPageChrome.astro', 'ArticlesPageChrome.astro'],
  ['src/components/articles/ArticlesMain.astro', 'ArticlesMain.astro'],
  ['src/components/articles/ArticlesPageFooter.astro', 'ArticlesPageFooter.astro'],
  ['src/components/articles/ArticlesHeroSection.astro', 'ArticlesHeroSection.astro'],
  ['src/components/articles/ArticlesPublicationsSection.astro', 'ArticlesPublicationsSection.astro'],
  ['src/components/articles/ArticlesRefutationsSection.astro', 'ArticlesRefutationsSection.astro'],
  ['src/components/articles/ArticlesArticleEndBlock.astro', 'ArticlesArticleEndBlock.astro'],
]) mustExist(rel, label);

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
must(main, "../../../data/series.json", 'ArticlesMain uses shared data/series.json');
for (const comp of ['ArticlesHeroSection','ArticlesPublicationsSection','ArticlesRefutationsSection','ArticlesArticleEndBlock']) {
  must(main, comp, `ArticlesMain uses ${comp}`);
}
must(footer, 'gb-accuracy-block', 'ArticlesPageFooter preserves feedback block');
must(footer, 'h-scroll-top', 'ArticlesPageFooter preserves scroll-top control');
must(footer, 'site.js', 'ArticlesPageFooter preserves runtime script');

for (const [content, marker, label] of [
  [hero, 'h-hero-title', 'ArticlesHeroSection marker: h-hero-title'],
  [publications, 'id="publikacii"', 'ArticlesPublicationsSection marker: publications section'],
  [publications, 'Тайны человеческого сердца — серия', 'ArticlesPublicationsSection marker: hard-texts series'],
  [publications, '/nagornaya/seriya/', 'ArticlesPublicationsSection marker: nagornaya series'],
  [publications, 'hardTextsPartsLabel', 'ArticlesPublicationsSection receives series label from data'],
  [refutations, 'id="razbor"', 'ArticlesRefutationsSection marker: refutations section'],
  [refutations, 'историческая подмена', 'ArticlesRefutationsSection marker: kod-da-vinchi copy'],
  [endBlock, 'Soli Deo Gloria', 'ArticlesArticleEndBlock marker: SDG'],
]) must(content, marker, label);

for (const content of [page, chrome, main, footer, publications, refutations, hero, endBlock]) {
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

const dist = exists('dist/articles/index.html') ? read('dist/articles/index.html') : '';
if (dist) {
  for (const marker of ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card', 'gb-accuracy-block']) {
    must(dist, marker, `dist /articles/ marker: ${marker}`);
  }
  mustNot(dist, 'astro-card-grid', 'dist /articles/ generic regression marker absent');
}

console.log('\nARTICLES VISUAL PARITY AUDIT');
if (problems.length) { console.log(`❌ ${problems.length} problem(s).`); process.exit(1); }
ok('/articles/ catalog is 100% native Astro and visual-parity guarded');
