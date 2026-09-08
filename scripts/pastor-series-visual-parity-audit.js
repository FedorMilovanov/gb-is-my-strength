#!/usr/bin/env node
/*
 * Guard the strict-native /pastor-series/ publication contract.
 *
 * The retired root HTML is historical evidence, not the approved render owner.
 * Blocking correctness is defined by native Astro composition, exact published
 * inventory, canonical I–IX core / Dossier A separation, metadata and named guards.
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

const expectedCore = [
  { roman: 'I', slug: '20-antisovetov-pastoru', minutes: 67 },
  { roman: 'II', slug: 'anatomiya-padeniya-pyat-stadiy', minutes: 29 },
  { roman: 'III', slug: 'teksty-pisaniya-kotorymi-manipuliruyut', minutes: 36 },
  { roman: 'IV', slug: 'sem-tipov-razlichenie-uchiteley', minutes: 30 },
  { roman: 'V', slug: 'cerkovnaya-disciplina-vlast-granicy-zashchita', minutes: 34 },
  { roman: 'VI', slug: 'kogda-uhodit-kogda-ostavatsya', minutes: 33 },
  { roman: 'VII', slug: 'vernye-i-neizvestnye-zdorovoe-pastyrstvo', minutes: 31 },
  { roman: 'VIII', slug: 'priznaki-zdorovoy-cerkvi', minutes: 30 },
  { roman: 'IX', slug: 'nesovershennyy-chelovek-v-nesovershennoy-cerkvi', minutes: 31 },
];
const expectedCoreMinutes = expectedCore.reduce((sum, part) => sum + part.minutes, 0);

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
must(head, 'numberOfItems: 10', 'structured data publishes nine core parts plus Dossier A');
must(head, "name: 'Диотрефы нашего времени: власть, подотчётность и верность'", 'Dossier A structured-data material');
must(head, 'readingTime: 356', 'published-material total: 321-minute core plus 35-minute Dossier A');
must(head, 'window.SITE_CONFIG', 'native SITE_CONFIG');
for (const part of expectedCore) {
  must(head, `url: 'https://gospod-bog.ru/articles/${part.slug}/'`, `structured-data core Part ${part.roman}`);
}
mustNot(head, 'Две опубликованные части', 'staging two-material description');

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
must(cards, 'Опубликованные материалы', 'published-materials heading');
for (const part of expectedCore) {
  must(cards, `href="../articles/${part.slug}/"`, `public route for Part ${part.roman}`);
  must(cards, `Часть ${part.roman} · ${part.minutes} мин`, `published duration for Part ${part.roman}`);
  mustNot(cards, `Часть ${part.roman} · редакционный черновик`, `draft status for Part ${part.roman}`);
}
must(cards, 'href="../articles/diotrefy-nashego-vremeni/"', 'Dossier A route');
must(cards, 'data-wave12-series-card="true"', 'Dossier A card authority marker');
must(cards, 'Досье A · 35 мин', 'Dossier A duration');
must(cards, '181 источник', 'Dossier A source-count marker');
equal(count(cards, '<a href="../articles/'), 10, 'published linked-material count');
equal(count(cards, 'aria-disabled="true"'), 1, 'non-public card count: field guide only');
equal(count(cards, 'data-pagefind-ignore'), 1, 'search-excluded non-public card count: field guide only');
mustNot(cards, 'редакционный черновик', 'retired staging draft marker');

for (const heading of [
  'Каноническое ядро: диагностика и границы власти',
  'Каноническое ядро: здоровый образец',
  'Сопутствующие инструменты',
]) {
  must(cards, heading, `canonical group: ${heading}`);
}

for (const retired of [
  'Опубликованные части',
  'Часть II · 35 мин',
  'Дорожная карта: диагностика',
  'Дорожная карта: распознавание',
  'Дорожная карта: здоровый образец',
  'Блок 2. Распознавание',
  'Блок 3. Здоровый образец',
]) {
  mustNot(nativeText, retired, `retired series marker: ${retired}`);
}

must(stats, '>10</div>', 'ten published materials stat');
must(stats, 'опубликованных материалов', 'published-material stat label');
must(stats, '>9</div>', 'nine-part canonical core stat');
must(stats, 'частей канонического ядра', 'canonical-core stat label');
must(stats, '>321</div>', '321-minute canonical core stat');
must(stats, 'минута канонического ядра I–IX', 'canonical-core duration label');
must(stats, '>181</div>', 'Dossier A source-count stat');

const pastorSeries = seriesRegistry['pastor-series'];
if (!pastorSeries) {
  bad('data/series.json: pastor-series missing');
} else {
  const published = (pastorSeries.parts || []).filter((part) => part.status === 'published');
  equal(published.length, 9, 'registry published-core count');
  const slugs = published.map((part) => part.slug).sort();
  const expected = expectedCore.map((part) => part.slug).sort();
  JSON.stringify(slugs) === JSON.stringify(expected)
    ? ok('canonical published core slugs')
    : bad(`canonical published core slugs: ${JSON.stringify(slugs)} != ${JSON.stringify(expected)}`);
  const totalMinutes = published.reduce((sum, part) => sum + Number(part.readingTime || 0), 0);
  equal(totalMinutes, expectedCoreMinutes, 'registry canonical-core minute total');
}

equal(expectedCoreMinutes, 321, 'contract canonical-core minute total');

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
ok('/pastor-series/ I–IX + Dossier A native publication contract passed');
