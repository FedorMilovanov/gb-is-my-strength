#!/usr/bin/env node
/*
 * home-visual-parity-audit.js — source/dist contract for the native homepage.
 *
 * The guard protects semantic ownership, progressive enhancement and the
 * owner-selected cinematic direction-object system. Leaf components own their
 * behavior and visuals; HomeMain must not reintroduce duplicate implementations.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const problems = [];
const warnings = [];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function ok(message) { console.log(`✅ ${message}`); }
function bad(message) { problems.push(message); console.log(`❌ ${message}`); }
function warn(message) { warnings.push(message); console.log(`ℹ️ ${message}`); }
function must(haystack, needle, label = needle) {
  haystack.includes(needle) ? ok(label) : bad(`missing: ${label}`);
}
function mustNot(haystack, needle, label = needle) {
  haystack.includes(needle) ? bad(`forbidden present: ${label}`) : ok(`no ${label}`);
}
function mustExist(rel) { exists(rel) ? ok(rel) : bad(`missing file: ${rel}`); }
function mustNotExist(rel) { exists(rel) ? bad(`obsolete file remains: ${rel}`) : ok(`no obsolete ${rel}`); }
function count(haystack, regex) { return (haystack.match(regex) || []).length; }

const directionAssets = [
  'public/images/home/directions/articles-scroll.png',
  'public/images/home/directions/series-documents.png',
  'public/images/home/directions/biographies-theologian.png',
  'public/images/home/directions/maps-biblical-atlas.png',
  'public/images/home/directions/confessions-dossier.png',
];

const obsoletePictograms = [
  'src/components/home/pictograms/ManuscriptPictogram.astro',
  'src/components/home/pictograms/VolumesPictogram.astro',
  'src/components/home/pictograms/FolioPictogram.astro',
  'src/components/home/pictograms/AtlasPictogram.astro',
  'src/components/home/pictograms/CodexPictogram.astro',
];

const files = [
  'src/components/home/HomePageHead.astro',
  'src/components/home/HomePageChrome.astro',
  'src/components/home/HomePageChromeStyles.astro',
  'src/components/home/HomeMain.astro',
  'src/components/home/HomeHero.astro',
  'src/components/home/HomeAmbientPhrases.astro',
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
];

files.forEach(mustExist);
obsoletePictograms.forEach(mustNotExist);
mustNotExist('public/images/home/directions/README.tmp');
mustNotExist('public/images/home/directions/.keep');

for (const rel of directionAssets) {
  mustExist(rel);
  if (!exists(rel)) continue;
  const bytes = fs.readFileSync(path.join(ROOT, rel));
  const signature = bytes.subarray(0, 8).toString('hex');
  signature === '89504e470d0a1a0a'
    ? ok(`${rel} has PNG signature`)
    : bad(`${rel} is not a binary PNG`);
  try {
    const png = PNG.sync.read(bytes);
    const pixels = png.width * png.height;
    let visiblePixels = 0;
    for (let index = 3; index < png.data.length; index += 4) {
      if (png.data[index] > 16) visiblePixels += 1;
    }
    const visibleCoverage = pixels === 0 ? 0 : visiblePixels / pixels;
    png.width >= 200 && png.height >= 200
      ? ok(`${rel} decodes at ${png.width}×${png.height}`)
      : bad(`${rel} decoded dimensions are too small (${png.width}×${png.height})`);
    visibleCoverage >= 0.08
      ? ok(`${rel} has visible pixel coverage (${(visibleCoverage * 100).toFixed(1)}%)`)
      : bad(`${rel} is visually empty (${(visibleCoverage * 100).toFixed(1)}% visible pixels)`);
  } catch (error) {
    bad(`${rel} cannot be fully decoded: ${error.message}`);
  }
  bytes.length >= 4000 && bytes.length <= 50000
    ? ok(`${rel} is within the web asset budget (${bytes.length} bytes)`)
    : bad(`${rel} size is outside 4–50 KB budget (${bytes.length} bytes)`);
}

const page = read('src/pages/index.astro');
for (const marker of ['HomePageHead', 'HomePageChrome', 'HomePageChromeStyles', 'HomeMain', 'HomePageFooter', 'HomeArticleEndBlock']) {
  must(page, marker, `Astro / uses ${marker}`);
}
must(page, '<body class="home-page">', 'Astro / preserves home body class');
for (const forbidden of ['loadLegacyFullDocument', 'set:html', '?raw', '_legacy/', 'import BaseLayout', '<BaseLayout']) {
  mustNot(page, forbidden, `Astro / ${forbidden}`);
}
const chromeStylesPos = page.indexOf('<HomePageChromeStyles />');
const mainPos = page.indexOf('<HomeMain />');
const footerPos = page.indexOf('<HomePageFooter />');
const endPos = page.indexOf('<HomeArticleEndBlock />');
chromeStylesPos !== -1 && mainPos > chromeStylesPos && footerPos > mainPos && endPos > footerPos
  ? ok('Astro / preserves chrome styles → main → footer → Soli Deo Gloria order')
  : bad('Astro / homepage landmark/style owner order is invalid');

const head = read('src/components/home/HomePageHead.astro');
for (const marker of [
  '<title>Господь Бог — Сила Моя — Материалы для изучения Писания</title>',
  'rel="canonical" href="https://gospod-bog.ru/"',
  'property="og:image" content="https://gospod-bog.ru/images/og-preview-1200x630.webp"',
  'name="twitter:card" content="summary_large_image"',
  'application/ld+json', 'fonts/fonts.css', 'css/home.css', 'theme-color',
  '.home-page .h-nojs-nav__sheet', '.home-page #hMobileMenuBtn',
]) must(head, marker, `HomePageHead marker: ${marker}`);
mustNot(head, 'fetchpriority="high" imagesrcset="images/og-nagornaya-propoved', 'below-fold Nagornaya preload');

const chrome = read('src/components/home/HomePageChrome.astro');
for (const marker of [
  'class="skip-link"', 'class="h-navbar"', 'id="hMobileNav"',
  'class="home-v20"', 'h-mobile-nav__primary', 'id="hScrollTop"',
  'window.SITE_CONFIG', 'js/site.js', 'js/search.js',
  'mc.yandex.ru/metrika/tag.js', 'class="h-nojs-nav"',
  'aria-label="Навигация без JavaScript"',
  'class="h-mobile-nav__close"',
  "root.toggleAttribute('inert', open)",
]) must(chrome, marker, `HomePageChrome marker: ${marker}`);
must(chrome, 'role="dialog" aria-modal="true" aria-labelledby="hMobileNavTitle"', 'mobile sheet labelled modal');
must(chrome, 'aria-controls="hMobileNav"', 'menu trigger connected to sheet');
must(chrome, "window.matchMedia('(min-width: 761px)')", 'exact mobile/desktop boundary');
must(chrome, "window.addEventListener('pageshow'", 'BFCache restoration handler');
mustNot(chrome, 'id="hScriptureBg"', 'legacy ambient owner hook');
mustNot(chrome, '.addListener(', 'deprecated MediaQueryList.addListener fallback');

const noJsStart = chrome.indexOf('<nav class="h-nojs-nav__links"');
const noJsEnd = chrome.indexOf('</nav>', noJsStart);
const noJsBlock = noJsStart === -1 || noJsEnd === -1 ? '' : chrome.slice(noJsStart, noJsEnd);
count(noJsBlock, /<a href=/g) === 8
  ? ok('no-JS menu exposes exactly eight routes')
  : bad('no-JS menu must expose exactly eight routes');

const chromeStyles = read('src/components/home/HomePageChromeStyles.astro');
for (const marker of [
  'body.home-page .h-navbar',
  'body.home-page .h-navbar__inner',
  'body.home-page .h-navbar .mobile-controls > button',
  '@media (min-width: 761px)',
  'body.home-page .h-navbar #hMobileMenuBtn',
]) must(chromeStyles, marker, `HomePageChromeStyles marker: ${marker}`);
for (const rejected of ['.h-home-route', '.h-sacred-block', '.h-about']) {
  mustNot(chromeStyles, rejected, `chrome style cross-owner rule: ${rejected}`);
}

const main = read('src/components/home/HomeMain.astro');
must(main, '<main id="main-content" data-pagefind-body>', 'HomeMain semantic wrapper');
must(main, '<div class="home-content">', 'HomeMain home-content wrapper');
for (const component of [
  'HomeHero', 'ResumeMobile', 'Favorites', 'Directions', 'Publications',
  'Refutations', 'About', 'Quote', 'Planned', 'Accuracy',
]) must(main, component, `HomeMain uses ${component}`);
main.indexOf('<Publications />') < main.indexOf('<Planned />')
  ? ok('real publications precede roadmap')
  : bad('real publications must precede roadmap');
for (const forbidden of [
  'HomePageFooter', 'HomeArticleEndBlock', '<footer', 'set:html', '?raw',
  'h-brand-lion', 'h-hero-brand__mark',
  'body.home-page .h-hero::before',
  'body.home-page .h-home-routes',
  'body.home-page .h-home-route',
  'body.home-page .h-navbar',
  'scroll-snap-type: inline mandatory',
]) mustNot(main, forbidden, `HomeMain cross-owner rule: ${forbidden}`);

const hero = read('src/components/home/HomeHero.astro');
for (const marker of [
  'HomeAmbientPhrases', 'h-hero-brand', 'h-sacred-block--hero', 'h-hero-title',
  'heroSearchBar', 'Что вы хотите изучить?', 'Аввакум 3:19', 'h-hero-cues',
  '<button class="h-tetra" type="button" disabled',
  '<button class="hb-w" type="button" disabled',
  'word.disabled = false',
  '<a class="h-hero-search" id="heroSearchBar" href="/articles/"',
  'button:is(.hb-w, .h-tetra):focus-visible',
]) must(hero, marker, `HomeHero marker: ${marker}`);
const sacredButtonCount = count(hero, /<button class="(?:hb-w|h-tetra)" type="button" disabled/g);
sacredButtonCount === 9
  ? ok('Habakkuk exposes exactly nine native controls')
  : bad(`Habakkuk native control count: ${sacredButtonCount} (expected 9)`);
mustNot(hero, 'role="button"', 'Habakkuk pseudo-buttons');
mustNot(hero, 'tabindex="0"', 'manual Habakkuk tabindex');
mustNot(hero, "event.key === 'Enter'", 'manual native-button keyboard emulation');
for (const forbidden of [
  'h-brand-lion', 'Разбудить льва', 'AudioContext', 'webkitAudioContext',
  '.h-navbar', '.h-nav-links', '.h-home-gateway', '.h-featured-', '.h-about', '--h-muted:',
]) mustNot(hero, forbidden, `HomeHero cross-owner rule: ${forbidden}`);

const ambient = read('src/components/home/HomeAmbientPhrases.astro');
const phraseEntries = ambient
  .split('\n')
  .filter((line) => line.trimStart().startsWith("{ type: '"));
const phraseCount = phraseEntries.length;
const leftCount = phraseEntries.filter((line) => line.includes("side: 'left'")).length;
const rightCount = phraseEntries.filter((line) => line.includes("side: 'right'")).length;
phraseCount === 32 ? ok('ambient scripture has 32 phrases') : bad(`ambient phrase count: ${phraseCount}`);
leftCount === 16 ? ok('ambient scripture has 16 left phrases') : bad(`left phrase count: ${leftCount}`);
rightCount === 16 ? ok('ambient scripture has 16 right phrases') : bad(`right phrase count: ${rightCount}`);
must(ambient, 'data-pagefind-ignore', 'ambient scripture is excluded from Pagefind');
must(ambient, '@media (prefers-reduced-motion: reduce)', 'ambient reduced-motion contract');
mustNot(ambient, '#hScriptureBg', 'legacy ambient selector');
mustNot(ambient, '!important', 'ambient cascade override');
const reducedStart = ambient.indexOf('@media (prefers-reduced-motion: reduce)');
mustNot(reducedStart === -1 ? '' : ambient.slice(reducedStart), 'display: none', 'reduced-motion phrase removal');

const directions = read('src/components/home/HomeSections/Directions.astro');
for (const marker of [
  'hDirectionsLabel', 'h-home-gateway', 'h-home-routes', 'h-home-route__glyph',
  '<img', 'alt=""', 'loading="eager"', 'decoding="async"', 'fetchpriority="low"',
  'h-route-object', 'h-route-object--articles', 'h-route-object--series',
  'h-route-object--biographies', 'h-route-object--maps', 'h-route-object--confessions',
  'grid-template-columns: repeat(5, minmax(0, 1fr))',
  'grid-template-columns: repeat(6, minmax(0, 1fr))',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  'width: min(calc(100vw - 260px), 1480px)',
  'grid-column: 1 / -1',
]) must(directions, marker, `Directions marker: ${marker}`);

for (const asset of directionAssets) {
  const publicUrl = `/${asset.replace(/^public\//, '')}`;
  must(directions, `image: '${publicUrl}'`, `Directions asset: ${publicUrl}`);
}

count(directions, /href: '\//g) === 5
  ? ok('gateway has exactly five destinations')
  : bad('gateway must have exactly five destinations');
count(directions, /class=\{`h-route-object h-route-object--\$\{route\.key\}`\}/g) === 1
  ? ok('gateway renders one semantic image-object template')
  : bad('gateway image-object template changed');

for (const href of ['/articles/', '/nagornaya/', '/biografii/', '/karty/', '/konfessii/']) {
  must(directions, `href: '${href}'`, `gateway route: ${href}`);
}

for (const rejected of [
  'ManuscriptPictogram', 'VolumesPictogram', 'FolioPictogram', 'AtlasPictogram', 'CodexPictogram',
  '<svg', 'h-route-pictogram', 'stroke-dasharray', 'data:image/png;base64,',
  'h-home-route__mark', 'Наведите или нажмите на знак',
  '.h-navbar', '.h-hero::before', '#hMobileMenuBtn',
]) mustNot(directions, rejected, `Directions rejected implementation: ${rejected}`);

const about = read('src/components/home/HomeSections/About.astro');
for (const marker of [
  'id="about"', 'h-about-principles',
  'Библиотека, где содержание важнее шума',
  '<p class="h-about-text">',
  'Это не лента быстрых заметок',
  'body.home-page #main-content .h-about-text::first-letter',
]) must(about, marker, `About marker: ${marker}`);
for (const retired of [
  'h-drop-cap__letter',
  '<span class="sr-only">Это</span>',
  '<span aria-hidden="true"><span class="h-drop-cap__letter">Э</span>то</span>',
]) mustNot(about, retired, `retired duplicated About drop-cap markup: ${retired}`);
count(about, /Это не лента быстрых заметок/g) === 1
  ? ok('About lead exists exactly once in source')
  : bad('About lead must exist exactly once in source');

const favorites = read('src/components/home/HomeSections/Favorites.astro');
must(favorites, '<h2 class="favorites-block__heading"', 'Favorites uses an h2 section heading');
must(favorites, "node.textContent = String(value == null ? '' : value)", 'Favorites renders stored copy as text');
mustNot(favorites, 'card.innerHTML', 'Favorites stored HTML injection');

const resume = read('src/components/home/HomeSections/ResumeMobile.astro');
must(resume, '<h2 id="resumeListTitle">Недочитанные статьи</h2>', 'resume list uses an h2 heading');

const refutations = read('src/components/home/HomeSections/Refutations.astro');
must(refutations, '<h2 class="h-section-label" id="hRefutationsLabel">', 'Refutations uses an h2 heading');

const planned = read('src/components/home/HomeSections/Planned.astro');
must(planned, '<h2 class="h-planned-label" id="hPlannedLabel">', 'Roadmap uses an h2 heading');

const publications = read('src/components/home/HomeSections/Publications.astro');
must(publications, 'href="/articles/krajne-li-isporcheno-serdce/"', 'Jeremiah card opens the article route');
must(publications, 'id="publikacii" aria-labelledby="hPublicationsLabel" data-pagefind-ignore', 'repeated homepage catalogue is excluded from Pagefind');
mustNot(publications, 'fetchpriority="high"', 'below-fold high image priority');
mustNot(publications, 'loading="eager"', 'below-fold eager image loading');

for (const rel of files) {
  const file = read(rel);
  mustNot(file, 'set:html', `${path.basename(rel)} set:html`);
  mustNot(file, '?raw', `${path.basename(rel)} raw import`);
}

const dist = exists('dist/index.html') ? read('dist/index.html') : '';
if (dist) {
  for (const marker of ['home-v20', 'h-hero-brand', 'h-ambient-native', 'h-home-gateway', 'h-route-object', 'main-content', 'gb-accuracy-block']) {
    must(dist, marker, `dist / marker: ${marker}`);
  }
  for (const asset of directionAssets) {
    const publicUrl = `/${asset.replace(/^public\//, '')}`;
    must(dist, publicUrl, `dist / direction asset: ${publicUrl}`);
  }
  mustNot(dist, 'data:image/png;base64,', 'dist / embedded direction data URI');
  mustNot(dist, 'h-route-pictogram', 'dist / obsolete SVG direction family');
  mustNot(dist, 'id="hScriptureBg"', 'dist / legacy ambient hook');
  mustNot(dist, 'role="button" class="hb-w"', 'dist / Hebrew pseudo-button');
  must(dist, 'href="/articles/krajne-li-isporcheno-serdce/"', 'dist / corrected Jeremiah route');
  count(dist, /class="h-ambient-word /g) === 32
    ? ok('dist / renders exactly 32 ambient phrases')
    : bad('dist / must render exactly 32 ambient phrases');
  count(dist, /Это не лента быстрых заметок/g) === 1
    ? ok('dist / About lead renders exactly once')
    : bad('dist / About lead must render exactly once');
  for (const retired of [
    'h-drop-cap__letter',
    '<span class="sr-only">Это</span>',
  ]) mustNot(dist, retired, `dist / retired duplicated About drop-cap markup: ${retired}`);
  const distMainClose = dist.indexOf('</main>');
  const distFooter = dist.indexOf('<footer');
  const distSoli = dist.indexOf('class="article-end-sdg"', distFooter);
  distMainClose !== -1 && distFooter > distMainClose && distSoli > distFooter
    ? ok('dist / preserves main → footer → Soli Deo Gloria order')
    : bad('dist / landmark order is invalid');
  for (const forbidden of ['h-brand-lion', 'AudioContext', 'class="astro-shell"', '_legacy/']) {
    mustNot(dist, forbidden, `dist / ${forbidden}`);
  }
} else {
  warn('dist/index.html not found — production-like build remains required');
}

console.log('\nHOME NATIVE CONTRACT AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). Homepage native contract violated.`);
  process.exit(1);
}
console.log('✅ Homepage native contract guarded: semantics, ownership, resilience, real PNG gateway and visual identity.');
if (warnings.length) console.log(`ℹ️ ${warnings.length} advisory warning(s) remain.`);