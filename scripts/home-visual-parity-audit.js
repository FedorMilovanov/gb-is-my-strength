#!/usr/bin/env node
/*
 * home-visual-parity-audit.js — guard / (home) fully native Astro contract.
 *
 * 2026-06-23 visual-fix-home lane removes loadLegacyFullDocument(), ?raw
 * imports and src/components/home/_legacy/*.html. The home page must now be
 * composed from named Astro components only. The 2026-07 owner-approved home
 * direction preserves the sacred text/content but deliberately replaces the
 * rejected mobile dashboard/dock experiment with one responsive gateway.
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
  'src/components/home/HomeSections/Favorites.astro',
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
  'class="home-v20"', 'id="hScriptureBg"', 'h-mobile-nav__primary',
  'id="hScrollTop"', 'window.SITE_CONFIG', 'js/site.js', 'js/search.js',
  'mc.yandex.ru/metrika/tag.js',
]) {
  must(chrome, marker, `HomePageChrome marker: ${marker}`);
}
for (const rejected of ['h-mobile-dock', 'h-mobile-dashboard', 'h-mobile-rail', 'h-mobile-paths']) {
  mustNot(chrome, rejected, `rejected home chrome: ${rejected}`);
}
mustNot(chrome, 'set:html', 'HomePageChrome set:html');
mustNot(chrome, '?raw', 'HomePageChrome raw imports');
must(chrome, 'backToTop: { enabled: true', 'HomePageChrome back-to-top config matches rendered control');
must(chrome, 'readingProgress: { enabled: true }', 'HomePageChrome progress config matches rendered control');
must(chrome, 'hidden aria-hidden="true" data-home-scroll-hook', 'HomePageChrome keeps a non-visual scroll runtime hook');
mustNot(chrome, 'class="h-reading-progress"', 'HomePageChrome has no competing top progress bar');
must(chrome, 'data-search-shortcut-label="Поиск"', 'HomePageChrome has platform-aware search label hook');
must(chrome, 'event.altKey || event.shiftKey || (event.metaKey && event.ctrlKey)', 'HomePageChrome rejects modified search shortcuts');
must(chrome, 'if (window.GBSearch?.__ready) return;', 'HomePageChrome avoids duplicate ready-search shortcut handling');
must(chrome, "closest?.('[data-close-nav]')", 'HomePageChrome closes the mobile sheet for marked actions');
must(chrome, 'role="dialog" aria-modal="true" aria-labelledby="hMobileNavTitle"', 'HomePageChrome exposes the mobile sheet as a labelled modal');
must(chrome, 'aria-controls="hMobileNav"', 'HomePageChrome connects the menu trigger to its sheet');
must(chrome, "event.shiftKey && (active === first || !panel.contains(active))", 'HomePageChrome traps reverse focus inside the mobile sheet');
must(chrome, "!event.shiftKey && (active === last || !panel.contains(active))", 'HomePageChrome traps forward focus inside the mobile sheet');
must(chrome, "trigger.focus({ preventScroll: true })", 'HomePageChrome restores focus when the mobile sheet closes');
must(chrome, 'is:inline src="js/site.js', 'HomePageChrome external home runtime script has explicit Astro directive');

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
if (main.indexOf('<Publications />') < main.indexOf('<Planned />')) {
  ok('HomeMain publishes real materials before roadmap');
} else {
  bad('HomeMain must place Publications before Planned');
}
mustNot(main, 'set:html', 'HomeMain set:html transport');
mustNot(main, '?raw', 'HomeMain raw imports');

for (const [rel, markers] of Object.entries({
  'src/components/home/HomeHero.astro': ['h-hero-title', 'heroSearchBar', 'Аввакум 3:19', 'h-hero-cues', 'aria-pressed'],
  'src/components/home/HomeSections/ResumeMobile.astro': ['resume-reading-block', 'resume-list-block'],
  'src/components/home/HomeSections/Directions.astro': ['hDirectionsLabel', 'h-home-gateway', 'h-home-routes', 'h-home-route__mark'],
  'src/components/home/HomeSections/Planned.astro': ['hPlannedLabel', 'h-home-roadmap'],
  'src/components/home/HomeSections/Publications.astro': ['id="publikacii"', 'h-featured-series', 'h-article-list'],
  'src/components/home/HomeSections/Refutations.astro': ['id="razbor"', 'h-article-list--grid'],
  'src/components/home/HomeSections/About.astro': ['id="about"', 'h-drop-cap__letter', 'h-lion-label', 'AudioContext'],
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
for (const rel of [
  'src/components/home/HomeHero.astro',
  'src/components/home/HomeSections/ResumeMobile.astro',
  'src/components/home/HomeSections/Directions.astro',
]) {
  const file = read(rel);
  for (const rejected of ['h-mobile-dock', 'h-mobile-dashboard', 'h-mobile-rail', 'h-mobile-paths', 'h-mobile-hero-hub']) {
    mustNot(file, rejected, `${path.basename(rel)} rejected marker: ${rejected}`);
  }
}

const directions = read('src/components/home/HomeSections/Directions.astro');
const routeCount = (directions.match(/class="h-home-route /g) || []).length;
routeCount === 4 ? ok('single library gateway has exactly four primary routes') : bad(`single library gateway route count: ${routeCount} (expected 4)`);
for (const href of ['/articles/', '/nagornaya/', '/biografii/', '/karty/']) {
  must(directions, `href="${href}"`, `library gateway link: ${href}`);
}

const hero = read('src/components/home/HomeHero.astro');
must(hero, 'data-search-shortcut-modifier', 'HomeHero has platform-aware shortcut hint');
must(hero, 'role="list" aria-label="Особенности библиотеки"', 'HomeHero exposes feature cues as a named list');
mustNot(hero, '<kbd>⌘</kbd><kbd>K</kbd>', 'HomeHero no longer hardcodes an Apple-only shortcut');

const favorites = read('src/components/home/HomeSections/Favorites.astro');
must(favorites, "node.textContent = String(value == null ? '' : value)", 'Favorites renders stored copy as text');
must(favorites, "imageUrl.protocol === 'http:' || imageUrl.protocol === 'https:'", 'Favorites accepts only web image protocols');
must(favorites, 'if (!Array.isArray(favs) || !favs.length) return;', 'Favorites rejects malformed storage roots');
must(favorites, "if (!f || typeof f !== 'object' || Array.isArray(f)) return;", 'Favorites skips malformed stored entries');
mustNot(favorites, 'card.innerHTML', 'Favorites does not inject stored HTML');

for (const marker of [
  'import BaseLayout', '<BaseLayout', 'astro-card-grid',
  'class="astro-home"', 'class="astro-page"', 'astro-shell',
]) {
  mustNot(page, marker, `old/generic home wrapper marker: ${marker}`);
  mustNot(main, marker, `old/generic home main marker: ${marker}`);
}

const dist = exists('dist/index.html') ? read('dist/index.html') : '';
if (dist) {
  for (const marker of ['home-v20', 'h-hero', 'h-home-gateway', 'main-content', 'gb-accuracy-block']) {
    must(dist, marker, `dist / marker: ${marker}`);
  }
  for (const rejected of ['h-mobile-dock', 'h-mobile-dashboard', 'h-mobile-rail', 'h-mobile-paths', 'h-mobile-hero-hub']) {
    mustNot(dist, rejected, `dist / rejected home marker: ${rejected}`);
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
console.log('✅ / native home contract guarded: sacred identity + one responsive gateway + no rejected mobile dock');
if (warnings.length) console.log(`ℹ️ ${warnings.length} advisory warning(s) remain.`);
