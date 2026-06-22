#!/usr/bin/env node
/*
 * baptisty-rossii-visual-parity-audit.js — guard /baptisty-rossii/ native-shadow
 * Astro contract.
 *
 * Refactoring 5.0 promoted /baptisty-rossii/ to a native-shadow landing.
 * Refactoring 6.0 parallel pilot now replaces the monolithic
 * `_legacy/main.html?raw` import with named legacy-faithful fragments for the
 * hero/header, article body and post-article block.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];
const warnings = [];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function ok(msg) { console.log('✅ ' + msg); }
function warn(msg) { warnings.push(msg); console.log('ℹ️ ' + msg); }
function bad(msg) { problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label) {
  haystack.includes(needle) ? ok(label || needle) : bad(`missing: ${label || needle}`);
}
function mustNot(haystack, needle, label) {
  !haystack.includes(needle) ? ok(`no ${label || needle}`) : bad(`forbidden present: ${label || needle}`);
}
function mustExist(rel, label) {
  exists(rel) ? ok(label || rel) : bad(`missing file: ${label || rel}`);
}

const legacy = read('baptisty-rossii/index.html');
for (const marker of [
  'class="gbs-world"', 'data-gbs2-series="russian-baptism"',
  'gbs2-mobile-head', 'gbs2-rail', 'gbs2-rtitle', 'gbs2-parts', 'gbs2-bbar',
  'gbs2-sheet', 'gbs2-hero', 'h-article-list', 'main-content',
  'Баптисты России',
]) {
  must(legacy, marker, `legacy /baptisty-rossii/ marker: ${marker}`);
}

const page = read('src/pages/baptisty-rossii/index.astro');
must(page, "loadLegacyFullDocument('baptisty-rossii/index.html')",
     'Astro /baptisty-rossii/ uses shared full-document loader for head');
must(page, '<!DOCTYPE html>', 'Astro /baptisty-rossii/ emits full document');
must(page, '<Fragment set:html={headHtml}',
     'Astro /baptisty-rossii/ preserves exact legacy head inner HTML');
must(page, 'BaptistyRossiiMain',
     'Astro /baptisty-rossii/ uses extracted BaptistyRossiiMain component');
must(page, '_legacy/body-segment-0.html',
     'Astro /baptisty-rossii/ preserves verbatim legacy body chrome before <main>');
must(page, '_legacy/body-segment-1.html',
     'Astro /baptisty-rossii/ preserves verbatim legacy body chrome after <main>');

mustExist('src/components/baptisty-rossii/BaptistyRossiiMain.astro',
          'BaptistyRossiiMain.astro component file');
mustExist('src/components/baptisty-rossii/_legacy/main.html',
          'baptisty-rossii main.html legacy baseline');
mustExist('src/components/baptisty-rossii/_legacy/header-hero.html',
          'baptisty-rossii header-hero.html fragment');
mustExist('src/components/baptisty-rossii/_legacy/article-body.html',
          'baptisty-rossii article-body.html fragment');
mustExist('src/components/baptisty-rossii/_legacy/post-article.html',
          'baptisty-rossii post-article.html fragment');
mustExist('src/components/baptisty-rossii/_legacy/body-segment-0.html',
          'baptisty-rossii body-segment-0.html frame fragment');
mustExist('src/components/baptisty-rossii/_legacy/body-segment-1.html',
          'baptisty-rossii body-segment-1.html frame fragment');

const main = read('src/components/baptisty-rossii/BaptistyRossiiMain.astro');
must(main, '<main id="main-content">', 'BaptistyRossiiMain preserves semantic main wrapper');
must(main, 'header-hero.html?raw', 'BaptistyRossiiMain uses headerHero fragment');
must(main, 'article-body.html?raw', 'BaptistyRossiiMain uses articleBody fragment');
must(main, 'post-article.html?raw', 'BaptistyRossiiMain uses postArticle fragment');
mustNot(main, "import legacyHtml from './_legacy/main.html?raw'",
        'raw monolithic main import removed');

const mainBaseline = read('src/components/baptisty-rossii/_legacy/main.html');
for (const marker of ['main-content', 'gbs2-hero', 'article-header', 'article-body',
                      'h-article-list', 'h-article-card', 'article-end-block']) {
  must(mainBaseline, marker, `main.html baseline preserves ${marker}`);
}

const headerHero = read('src/components/baptisty-rossii/_legacy/header-hero.html');
for (const marker of ['gbs2-hero', 'article-header', 'Баптисты России']) {
  must(headerHero, marker, `header-hero.html preserves ${marker}`);
}

const articleBody = read('src/components/baptisty-rossii/_legacy/article-body.html');
for (const marker of ['<article class="article-body">', 'summary-card', 'h-article-list', 'Исследовательская база']) {
  must(articleBody, marker, `article-body.html preserves ${marker}`);
}

const postArticle = read('src/components/baptisty-rossii/_legacy/post-article.html');
for (const marker of ['article-end-block', 'Soli Deo Gloria']) {
  must(postArticle, marker, `post-article.html preserves ${marker}`);
}

const segBefore = read('src/components/baptisty-rossii/_legacy/body-segment-0.html');
for (const marker of ['gbs2-mobile-head', 'gbs2-rail', 'gbs2-rtitle', 'breadcrumb']) {
  must(segBefore, marker, `body-segment-0.html preserves ${marker}`);
}

const segAfter = read('src/components/baptisty-rossii/_legacy/body-segment-1.html');
for (const marker of ['gbs2-bbar', 'gbs2-sheet', 'site.js']) {
  must(segAfter, marker, `body-segment-1.html preserves ${marker}`);
}

for (const marker of [
  'import BaseLayout', '<BaseLayout', 'astro-card-grid',
  'class="astro-page"', 'class="astro-baptisty-shadow"',
  'astro-shell', 'astro-baptisty-rail',
]) {
  mustNot(page, marker, `old/generic baptisty-rossii wrapper marker: ${marker}`);
  mustNot(main, marker, `old/generic baptisty-rossii main marker: ${marker}`);
}

const dist = exists('dist/baptisty-rossii/index.html') ? read('dist/baptisty-rossii/index.html') : '';
if (dist) {
  for (const marker of ['gbs-world', 'gbs2-rail', 'gbs2-bbar', 'gbs2-sheet', 'main-content']) {
    must(dist, marker, `dist /baptisty-rossii/ marker: ${marker}`);
  }
  mustNot(dist, 'class="astro-shell"',
          'dist /baptisty-rossii/ has no astro-shell chrome (native-shadow)');
} else {
  warn('dist/baptisty-rossii/index.html not found — run npm run strangler:build before push');
}

console.log('\nBAPTISTY-ROSSII VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). /baptisty-rossii/ native-shadow contract violated.`);
  process.exit(1);
}
console.log('✅ /baptisty-rossii/ Astro migration is native-shadow guarded (componentized landing main)');
if (warnings.length) console.log(`ℹ️ ${warnings.length} advisory warning(s) remain.`);
