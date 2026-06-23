#!/usr/bin/env node
/*
 * home-visual-parity-audit.js — guard / (home) fully native Astro contract.
 *
 * 2026-06-23 visual-fix-home lane removes loadLegacyFullDocument(), ?raw
 * imports and src/components/home/_legacy/*.html. The home page must now be
 * composed from named Astro components only while preserving legacy SEO/body
 * markers for visual parity.
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
function mustNotExist(rel, label) {
  !exists(rel) ? ok(`deleted ${label || rel}`) : bad(`forbidden file still exists: ${label || rel}`);
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
must(page, 'HomePageHead', 'Astro / uses HomePageHead component');
must(page, 'HomePageChrome', 'Astro / uses HomePageChrome component');
must(page, 'HomeMain', 'Astro / uses HomeMain component');
must(page, '<body class="home-page">', 'Astro / preserves body class');
mustNot(page, 'loadLegacyFullDocument', 'loadLegacyFullDocument');
mustNot(page, 'set:html', 'set:html transport');
mustNot(page, '?raw', '?raw import transport');
mustNot(page, '_legacy/', '_legacy imports');

for (const rel of [
  'src/components/home/HomePageHead.astro',
  'src/components/home/HomePageChrome.astro',
  'src/components/home/HomeMain.astro',
  'src/components/home/HomeHero.astro',
  'src/components/home/HomePageFooter.astro',
  'src/components/home/HomeArticleEndBlock.astro',
  'src/components/home/HomeSections/ResumeMobile.astro',
  'src/components/home/HomeSections/Directions.astro',
  'src/components/home/HomeSections/Planned.astro',
  'src/components/home/HomeSections/Publications.astro',
  'src/components/home/HomeSections/Refutations.astro',
  'src/components/home/HomeSections/About.astro',
  'src/components/home/HomeSections/Quote.astro',
  'src/components/home/HomeSections/Accuracy.astro',
]) {
  mustExist(rel);
}
mustNotExist('src/components/home/_legacy', 'src/components/home/_legacy directory');

const head = read('src/components/home/HomePageHead.astro');
for (const marker of [
  '<title>Господь Бог — Сила Моя — Материалы для изучения Писания</title>',
  'rel="canonical" href="https://gospod-bog.ru/"',
  'property="og:image" content="https://gospod-bog.ru/images/og-preview-1200x630.webp"',
  'name="twitter:card" content="summary_large_image"',
  'application/ld+json',
  'fonts/fonts.css',
  'css/home.css',
  'theme-color',
]) {
  must(head, marker, `HomePageHead marker: ${marker}`);
}

const chrome = read('src/components/home/HomePageChrome.astro');
for (const marker of [
  'class="skip-link"', 'class="h-navbar"', 'id="hMobileNav"',
  'class="home-v20"', 'id="hScriptureBg"', 'class="h-mobile-dock"',
  'id="hScrollTop"', 'window.SITE_CONFIG', 'js/site.js', 'js/search.js',
  'mc.yandex.ru/metrika/tag.js',
]) {
  must(chrome, marker, `HomePageChrome marker: ${marker}`);
}
mustNot(chrome, 'set:html', 'HomePageChrome set:html');
mustNot(chrome, '?raw', 'HomePageChrome raw imports');

const main = read('src/components/home/HomeMain.astro');
must(main, '<main id="main-content" data-pagefind-body>', 'HomeMain semantic wrapper');
must(main, '<div class="home-content">', 'HomeMain home-content wrapper');
for (const comp of [
  'HomeHero', 'ResumeMobile', 'Directions', 'Planned', 'Publications',
  'Refutations', 'About', 'Quote', 'Accuracy', 'HomePageFooter',
  'HomeArticleEndBlock',
]) {
  must(main, comp, `HomeMain uses ${comp}`);
}
mustNot(main, 'set:html', 'HomeMain set:html transport');
mustNot(main, '?raw', 'HomeMain raw imports');

for (const [rel, markers] of Object.entries({
  'src/components/home/HomeHero.astro': ['h-hero-title', 'heroSearchBar', 'h-mobile-hero-hub'],
  'src/components/home/HomeSections/ResumeMobile.astro': ['resume-reading-block', 'h-mobile-dashboard', 'h-mobile-rail', 'h-mobile-paths'],
  'src/components/home/HomeSections/Directions.astro': ['hDirectionsLabel', 'h-grid-4'],
  'src/components/home/HomeSections/Planned.astro': ['hPlannedLabel', 'h-grid-3'],
  'src/components/home/HomeSections/Publications.astro': ['id="publikacii"', 'h-featured-series', 'h-article-list'],
  'src/components/home/HomeSections/Refutations.astro': ['id="razbor"', 'h-article-list--grid'],
  'src/components/home/HomeSections/About.astro': ['id="about"', 'h-drop-cap__letter'],
  'src/components/home/HomeSections/Quote.astro': ['h-quote-section', 'Аввакум 3:19'],
  'src/components/home/HomeSections/Accuracy.astro': ['gb-accuracy-block', 'fedormilovanov'],
  'src/components/home/HomePageFooter.astro': ['h-footer', 'Об авторе'],
  'src/components/home/HomeArticleEndBlock.astro': ['Soli Deo Gloria'],
})) {
  const file = read(rel);
  for (const marker of markers) must(file, marker, `${path.basename(rel)} marker: ${marker}`);
  mustNot(file, 'set:html', `${path.basename(rel)} set:html`);
  mustNot(file, '?raw', `${path.basename(rel)} raw import`);
}

for (const marker of [
  'import BaseLayout', '<BaseLayout', 'astro-card-grid',
  'class="astro-home"', 'class="astro-page"', 'astro-shell',
]) {
  mustNot(page, marker, `old/generic home wrapper marker: ${marker}`);
  mustNot(main, marker, `old/generic home main marker: ${marker}`);
}

const dist = exists('dist/index.html') ? read('dist/index.html') : '';
if (dist) {
  for (const marker of ['home-v20', 'h-hero', 'h-mobile-dashboard', 'main-content', 'gb-accuracy-block']) {
    must(dist, marker, `dist / marker: ${marker}`);
  }
  mustNot(dist, 'class="astro-shell"', 'dist / has no astro-shell chrome');
  mustNot(dist, '_legacy/', 'dist / no legacy path leaks');
} else {
  warn('dist/index.html not found — run npm run astro:build before push');
}

console.log('\nHOME VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). / fully-native contract violated.`);
  process.exit(1);
}
console.log('✅ / Astro migration is fully-native guarded (no legacy loader, no raw imports, no _legacy HTML)');
if (warnings.length) console.log(`ℹ️ ${warnings.length} advisory warning(s) remain.`);
