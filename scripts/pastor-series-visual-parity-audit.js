#!/usr/bin/env node
/*
 * Guard the current strict-native /pastor-series/ publication contract.
 *
 * The retired root HTML is historical evidence, not the approved render owner.
 * Blocking correctness is defined by native Astro composition, exact published
 * inventory, roadmap separation, metadata and the named browser/source guards.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function readJson(rel) {
  return JSON.parse(read(rel));
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}
function ok(message) {
  console.log(`✅ ${message}`);
}
function bad(message) {
  problems.push(message);
  console.log(`❌ ${message}`);
}
function must(haystack, needle, label = needle) {
  haystack.includes(needle) ? ok(label) : bad(`missing: ${label}`);
}
function mustNot(haystack, needle, label = needle) {
  !haystack.includes(needle) ? ok(`no ${label}`) : bad(`forbidden present: ${label}`);
}
function mustExist(rel, label = rel) {
  exists(rel) ? ok(label) : bad(`missing file: ${label}`);
}
function mustNotExist(rel, label = rel) {
  !exists(rel) ? ok(`removed ${label}`) : bad(`legacy file still present: ${label}`);
}
function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}
function equal(actual, expected, label) {
  actual === expected ? ok(`${label}: ${expected}`) : bad(`${label}: ${actual} != ${expected}`);
}

const page = read('src/pages/pastor-series/index.astro');
const head = read('src/components/pastor-series/PastorSeriesPageHead.astro');
const chrome = read('src/components/pastor-series/PastorSeriesPageChrome.astro');
const main = read('src/components/pastor-series/PastorSeriesMain.astro');
const cards = read('src/components/pastor-series/PastorSeriesCardsSection.astro');
const stats = read('src/components/pastor-series/PastorSeriesStatsSection.astro');
const end = read('src/components/pastor-series/PastorSeriesArticleEndBlock.astro');
const baseline = readJson('data/visual-parity-baseline.json');
const seriesRegistry = readJson('data/series.json');
const nativeText = [head, chrome, main, cards, stats, end].join('\n');

must(page, 'PastorSeriesPageHead', 'Astro /pastor-series/ uses native head component');
must(page, 'PastorSeriesPageChrome', 'Astro /pastor-series/ uses native chrome component');
must(page, 'PastorSeriesMain', 'Astro /pastor-series/ uses extracted PastorSeriesMain component');
mustNot(page, 'loadLegacyFullDocument', 'loadLegacyFullDocument in page');
mustNot(page, '?raw', 'raw imports in page');
mustNot(page, '_legacy/', 'legacy fragment imports in page');

for (const rel of [
  'src/components/pastor-series/PastorSeriesPageHead.astro',
  'src/components/pastor-series/PastorSeriesPageChrome.astro',
  'src/components/pastor-series/PastorSeriesMain.astro',
  'src/components/pastor-series/PastorSeriesCardsSection.astro',
  'src/components/pastor-series/PastorSeriesStatsSection.astro',
  'src/components/pastor-series/PastorSeriesArticleEndBlock.astro',
]) {
  mustExist(rel);
}
for (const rel of [
  'src/components/pastor-series/_legacy/body-segment-0.html',
  'src/components/pastor-series/_legacy/body-segment-1.html',
  'src/components/pastor-series/_legacy/main.html',
]) {
  mustNotExist(rel);
}

must(head, "const title = 'Тёмная сторона кафедры — пастырская власть и подотчётность | Господь Бог';", 'native title authority');
must(head, '<title>{title}</title>', 'native head renders title authority');
must(head, '<link rel="canonical" href={canonical}>', 'native canonical');
must(head, 'href="https://gospod-bog.ru/feed.xml"', 'canonical site RSS discovery');
must(head, 'href="https://gospod-bog.ru/feed-pastor-series.xml"', 'series RSS discovery');
must(head, 'application/ld+json', 'native JSON-LD');
must(head, 'numberOfItems: 2', 'structured data publishes exactly two parts');
must(head, "name: 'Диотрефы нашего времени: власть, подотчётность и верность'", 'Wave 12 structured-data part');
must(head, 'readingTime: 102', 'canonical 102-minute series total');
must(head, 'window.SITE_CONFIG', 'native SITE_CONFIG');

must(chrome, '<nav class="h-navbar"', 'native chrome keeps navbar');
must(chrome, '<section class="h-hero"', 'native chrome keeps hero');
must(chrome, '<slot />', 'native chrome has slot for PastorSeriesMain');
must(chrome, '<footer class="h-footer"', 'native chrome keeps footer');
must(chrome, 'src="../js/site.js', 'native chrome keeps site runtime');

must(main, '<main id="main-content">', 'PastorSeriesMain preserves semantic main wrapper');
must(main, 'PastorSeriesCardsSection', 'PastorSeriesMain uses cards component');
must(main, 'PastorSeriesStatsSection', 'PastorSeriesMain uses stats component');
must(main, 'PastorSeriesArticleEndBlock', 'PastorSeriesMain uses terminal SDG block component');
mustNot(main, "import legacyHtml from './_legacy/main.html?raw'", 'raw monolithic main import');

must(cards, 'Материалы серии', 'series materials heading');
must(cards, 'Опубликованные части', 'published-parts heading');
must(cards, 'href="../articles/20-antisovetov-pastoru/"', 'Part I route');
must(cards, 'Часть I · 67 мин', 'Part I duration');
must(cards, 'href="../articles/diotrefy-nashego-vremeni/"', 'Part II route');
must(cards, 'data-wave12-series-card="true"', 'Wave 12 card authority marker');
must(cards, 'Часть II · 35 мин', 'Part II duration');
must(cards, '181 источник', 'Wave 12 source-count marker');
equal(count(cards, 'class="h-meta-tag">Опубликована</span>'), 2, 'published card count');

for (const heading of [
  'Дорожная карта: диагностика',
  'Дорожная карта: распознавание',
  'Дорожная карта: здоровый образец',
]) {
  must(cards, heading, `roadmap group: ${heading}`);
}
equal(count(cards, 'aria-disabled="true"'), 8, 'disabled future-module count');
equal(count(cards, 'data-pagefind-ignore'), 8, 'search-excluded future-module count');
for (const part of ['III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']) {
  must(cards, `data-part="${part}"`, `planned part ${part}`);
}
for (const retired of ['Блок 2. Распознавание', 'Блок 3. Здоровый образец']) {
  mustNot(nativeText, retired, `retired roadmap marker: ${retired}`);
}

const pastorSeries = seriesRegistry['pastor-series'];
if (!pastorSeries) {
  bad('data/series.json: pastor-series missing');
} else {
  const published = (pastorSeries.parts || []).filter((part) => part.status === 'published');
  equal(published.length, 2, 'canonical published-part count');
  const slugs = published.map((part) => part.slug).sort();
  const expected = ['20-antisovetov-pastoru', 'diotrefy-nashego-vremeni'].sort();
  JSON.stringify(slugs) === JSON.stringify(expected)
    ? ok('canonical published slugs')
    : bad(`canonical published slugs: ${JSON.stringify(slugs)} != ${JSON.stringify(expected)}`);
}

const visualPolicy = baseline.routeModes?.['/pastor-series/'];
if (!visualPolicy) {
  bad('visual parity policy for /pastor-series/ missing');
} else {
  equal(visualPolicy.mode, 'native-contract', 'visual parity mode');
  const requiredGuards = new Set(visualPolicy.requiredGuards || []);
  for (const guard of [
    'scripts/pastor-series-visual-parity-audit.js',
    'scripts/diotrophes-wave12-browser-contract.mjs',
    'scripts/public-surface-browser-matrix.mjs',
  ]) {
    requiredGuards.has(guard) ? ok(`visual guard registered: ${guard}`) : bad(`visual guard missing: ${guard}`);
  }
}

for (const marker of ['import BaseLayout', '<BaseLayout', 'astro-card-grid']) {
  mustNot(page, marker, `forbidden page marker: ${marker}`);
  mustNot(main, marker, `forbidden main marker: ${marker}`);
}

console.log('\nPASTOR-SERIES NATIVE PUBLICATION AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s).`);
  process.exit(1);
}
ok('/pastor-series/ current native publication contract passed');
