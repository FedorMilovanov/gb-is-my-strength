#!/usr/bin/env node
/*
 * home-visual-parity-audit.js — guard / (home) native-shadow Astro contract.
 *
 * Refactoring 5.0 promoted / to a native-shadow landing route. Refactoring 6.0
 * parallel pilot now replaces the monolithic `_legacy/main.html?raw` import
 * with named legacy-faithful fragments for hero, resume/mobile shell, guided
 * sections, catalog sections, about block and quote/post block.
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

const legacy = read('index.html');
for (const marker of [
  '<main id="main-content" data-pagefind-body', 'class="home-v20"',
  'h-hero', 'h-mobile-hero-hub', 'h-mobile-dashboard', 'h-mobile-rail',
  'h-mobile-paths', 'h-featured', 'h-card-glass', 'h-card-planned',
  'h-article-list', 'h-about', 'h-quote-section',
  'h-mobile-dock', 'gb-accuracy-block', 'resume-reading-block',
  'Господь Бог — Сила Моя',
]) {
  must(legacy, marker, `legacy / marker: ${marker}`);
}

const page = read('src/pages/index.astro');
must(page, "loadLegacyFullDocument('index.html')",
     'Astro / uses shared full-document loader for head');
must(page, '<!DOCTYPE html>', 'Astro / emits full document');
must(page, '<Fragment set:html={headHtml}',
     'Astro / preserves exact legacy head inner HTML');
must(page, 'HomeMain', 'Astro / uses extracted HomeMain component');
must(page, '_legacy/body-segment-0.html',
     'Astro / preserves verbatim legacy body chrome before <main>');
must(page, '_legacy/body-segment-1.html',
     'Astro / preserves verbatim legacy body chrome after <main>');

mustExist('src/components/home/HomeMain.astro', 'HomeMain.astro component file');
mustExist('src/components/home/HomeHeroSection.astro', 'HomeHeroSection.astro');
mustExist('src/components/home/HomeArticleEndBlock.astro', 'HomeArticleEndBlock.astro');
mustExist('src/components/home/_legacy/main.html', 'home main.html legacy baseline');
for (const rel of ['hero.html','resume-mobile.html','directions.html','planned.html','publications.html','refutations.html','about.html','quote.html','post-article.html']) {
  mustExist(`src/components/home/_legacy/${rel}`, rel);
}
mustExist('src/components/home/_legacy/body-segment-0.html', 'home body-segment-0.html frame fragment');
mustExist('src/components/home/_legacy/body-segment-1.html', 'home body-segment-1.html frame fragment');

const main = read('src/components/home/HomeMain.astro');
must(main, '<main id="main-content" data-pagefind-body>', 'HomeMain preserves semantic main wrapper');
must(main, '<div class="home-content">', 'HomeMain preserves home-content wrapper');
must(main, 'HomeHeroSection', 'HomeMain uses HomeHeroSection');
must(main, 'HomeArticleEndBlock', 'HomeMain uses HomeArticleEndBlock');
for (const frag of ['resume-mobile.html?raw','directions.html?raw','planned.html?raw','publications.html?raw','refutations.html?raw','about.html?raw','quote.html?raw']) {
  must(main, frag, `HomeMain uses ${frag}`);
}
for (const banned of ['hero.html?raw','post-article.html?raw']) {
  mustNot(main, banned, `removed raw import: ${banned}`);
}
mustNot(main, "import legacyHtml from './_legacy/main.html?raw'", 'raw monolithic main import removed');

const mainFragment = read('src/components/home/_legacy/main.html');
for (const marker of ['main-content', 'h-hero', 'h-mobile-dashboard', 'h-featured',
                      'h-article-list', 'h-about', 'h-quote-section',
                      'gb-accuracy-block']) {
  must(mainFragment, marker, `main baseline preserves ${marker}`);
}
must(read('src/components/home/HomeHeroSection.astro'), 'h-hero-title', 'HomeHeroSection marker: h-hero-title');
must(read('src/components/home/HomeHeroSection.astro'), 'heroSearchBar', 'HomeHeroSection marker: heroSearchBar');
must(read('src/components/home/HomeHeroSection.astro'), 'h-mobile-hero-hub', 'HomeHeroSection marker: h-mobile-hero-hub');
for (const [file, marker] of [
  ['resume-mobile.html','resume-reading-block'],
  ['directions.html','hDirectionsLabel'],
  ['planned.html','hPlannedLabel'],
  ['publications.html','id="publikacii"'],
  ['refutations.html','id="razbor"'],
  ['about.html','id="about"'],
  ['quote.html','h-quote-section'],
]) {
  must(read(`src/components/home/_legacy/${file}`), marker, `${file} marker: ${marker}`);
}
must(read('src/components/home/HomeArticleEndBlock.astro'), 'Soli Deo Gloria', 'HomeArticleEndBlock marker: Soli Deo Gloria');

const segBefore = read('src/components/home/_legacy/body-segment-0.html');
for (const marker of ['skip-link', 'h-mobile-nav', 'h-navbar', 'home-v20']) {
  must(segBefore, marker, `body-segment-0.html preserves ${marker}`);
}

const segAfter = read('src/components/home/_legacy/body-segment-1.html');
for (const marker of ['h-mobile-dock', 'site.js', 'sw-register']) {
  must(segAfter, marker, `body-segment-1.html preserves ${marker}`);
}

for (const marker of [
  'import BaseLayout', '<BaseLayout', 'astro-card-grid',
  'class="astro-home"', 'class="astro-page"',
  'astro-shell',
]) {
  mustNot(page, marker, `old/generic home wrapper marker: ${marker}`);
  mustNot(main, marker, `old/generic home main marker: ${marker}`);
}

const dist = exists('dist/index.html') ? read('dist/index.html') : '';
if (dist) {
  for (const marker of ['home-v20', 'h-hero', 'h-mobile-dashboard', 'main-content']) {
    must(dist, marker, `dist / marker: ${marker}`);
  }
  mustNot(dist, 'class="astro-shell"',
          'dist / has no astro-shell chrome (native-shadow)');
} else {
  warn('dist/index.html not found — run npm run strangler:build before push');
}

console.log('\nHOME VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). / native-shadow contract violated.`);
  process.exit(1);
}
console.log('✅ / Astro migration is native-shadow guarded (componentized home main)');
if (warnings.length) console.log(`ℹ️ ${warnings.length} advisory warning(s) remain.`);
