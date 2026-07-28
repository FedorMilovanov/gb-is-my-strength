#!/usr/bin/env node

/*
 * dist-publication-audit.js — static checks for a future GitHub Pages dist artifact.
 *
 * Run after `strangler:build`; add `--require-pagefind` after generating Pagefind
 * into dist/pagefind. This script does not deploy anything.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const REPORT_PATH = path.join(ROOT, 'reports', 'dist-publication-audit.json');
const REQUIRE_PAGEFIND = process.argv.includes('--require-pagefind');
const FORBID_DEV = process.argv.includes('--forbid-dev') || process.argv.includes('--production-like');
const SITE = 'https://gospod-bog.ru';
const SHADOW_ARTICLES = [
  'dzhon-gill-spravochnik',
  'dzhon-gill-istoricheskiy-kontekst',
  'rimlyanam-7-veruyushchiy-ili-neveruyushchiy',
  'kod-da-vinchi',
  'dzhon-gill-chast-1-chelovek',
  'dzhon-gill-chast-2-uchenyi',
  'dzhon-gill-chast-3-nasledie',
  'dzhon-gill-chast-4-ekzeget',
  'krajne-li-isporcheno-serdce',
  'hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki',
  '20-antisovetov-pastoru',
];
const SHADOW_BAPTISTY_ARTICLES = [
  'noch-na-kure',
  'yuzhnaya-shtunda',
  'dva-sezda-1884',
  'peterburgskaya-liniya',
  'goneniya-i-sovest',
  'sovetskaya-noch',
  'vsehib-1944',
  'iniciativnaya-gruppa',
  'podpolnaya-pechat',
  'spravochnik',
];
const problems = [];
const notes = [];
const checks = [];

function rel(file) {
  return path.relative(DIST, file).replace(/\\/g, '/');
}
function exists(file) {
  return fs.existsSync(path.join(DIST, file));
}
function record(status, message) {
  checks.push({ status, message });
  console.log(`${status === 'pass' ? '✅' : status === 'fail' ? '❌' : 'ℹ️'} ${message}`);
}
function bad(message) {
  problems.push(message);
  record('fail', message);
}
function ok(message) {
  record('pass', message);
}
function note(message) {
  notes.push(message);
  record('note', message);
}
function read(file) {
  return fs.readFileSync(path.join(DIST, file), 'utf8');
}
function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function canonicalHref(html) {
  for (const match of String(html || '').matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = match[1] || '';
    if (!/\brel=["']canonical["']/i.test(attrs)) continue;
    return attrs.match(/\bhref=["']([^"']+)["']/i)?.[1] || '';
  }
  return '';
}
function pagePathToFile(urlPath) {
  if (urlPath === '/') return 'index.html';
  if (urlPath.endsWith('/')) return urlPath.replace(/^\//, '') + 'index.html';
  return urlPath.replace(/^\//, '');
}
function localTargetExistsFromUrl(url) {
  if (!url.startsWith(SITE)) return true;
  return exists(pagePathToFile(new URL(url).pathname));
}
function parseSwPrecache(sw) {
  const match = sw.match(/PRECACHE_ASSETS=\[([^\]]+)\]/);
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile()) acc.push(full);
  }
  return acc;
}
function htmlFiles() {
  return walk(DIST).filter((file) => file.endsWith('.html'));
}
function isNoindex(html) {
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*\bnoindex\b/i.test(html);
}
function pagefindBodyPages() {
  return htmlFiles()
    .filter((file) => /\bdata-pagefind-body\b/.test(fs.readFileSync(file, 'utf8')))
    .map((file) => rel(file));
}
function writeReport(result) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify({
    schemaVersion: 1,
    result,
    requirePagefind: REQUIRE_PAGEFIND,
    forbidDev: FORBID_DEV,
    dist: path.relative(ROOT, DIST).replace(/\\/g, '/'),
    problems,
    notes,
    checks,
  }, null, 2)}\n`, 'utf8');
  console.log(`ℹ️ durable report: ${path.relative(ROOT, REPORT_PATH).replace(/\\/g, '/')}`);
}

function checkRequiredFiles() {
  const required = [
    'index.html', 'about/index.html', 'articles/index.html', 'biografii/index.html',
    'hard-texts/index.html', 'pastor-series/index.html', 'rodosloviye/index.html', 'nagornaya/index.html',
    'nagornaya/chast-1/index.html', 'nagornaya/chast-2/index.html', 'nagornaya/chast-3/index.html',
    'nagornaya/chast-4/index.html', 'nagornaya/chast-5/index.html', 'nagornaya/seriya/index.html',
    'nagornaya/istochniki/index.html', 'nagornaya/nakhodki/index.html', 'karty/index.html',
    'karty/avraam/index.html', 'karty/ishod/index.html', 'konfessii/index.html',
    'konfessii/russkij-baptizm/index.html', 'map/index.html',
    ...SHADOW_ARTICLES.map((slug) => `articles/${slug}/index.html`),
    '404.html', 'CNAME', 'robots.txt', 'sitemap.xml', 'feed.xml',
    'manifest.json', 'sw.js', 'llms.txt', 'css/site.css', 'js/site.js', 'js/sw-register.js',
    'images/og-preview-1200x630.webp', 'konfessii/russkij-baptizm/_app/index.html',
  ];
  const missing = required.filter((file) => !exists(file));
  if (missing.length) missing.forEach((file) => bad(`dist missing required file: ${file}`));
  else ok(`required dist files present (${required.length})`);
}

function checkNoPrivateDirs() {
  const forbidden = ['.git', 'node_modules', 'src', 'scripts', 'docs', 'audit', '_build-tools', 'migration', 'reports', 'research', '_legacy'];
  const present = forbidden.filter((file) => fs.existsSync(path.join(DIST, file)));
  if (present.length) present.forEach((file) => bad(`forbidden private/build dir copied to dist: ${file}`));
  else ok('no private/build directories copied to dist');

  const nestedForbiddenDirs = ['research', '_legacy', 'raw-sources', 'map-data'];
  function walkCheck(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (nestedForbiddenDirs.includes(entry.name)) {
        bad(`forbidden internal research/data dir copied to dist: ${path.relative(DIST, full)}`);
      } else {
        walkCheck(full);
      }
    }
  }
  walkCheck(DIST);
}

function checkSitemaps() {
  const generated = fs.readdirSync(DIST).filter((name) => /^sitemap-(?:index|\d+)\.xml$/i.test(name));
  if (generated.length) generated.forEach((name) => bad(`partial Astro sitemap file present in dist: ${name}`));
  else ok('no partial Astro sitemap-index/sitemap-N files in dist');
  if (!exists('sitemap.xml')) return;
  const sitemap = read('sitemap.xml');
  if (/\/dev\/astro-test\//.test(sitemap)) bad('sitemap.xml includes dev/astro-test');
  if (/\/dev\/article-mdx-pilot\//.test(sitemap)) bad('sitemap.xml includes dev/article-mdx-pilot');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const missing = locations.filter((url) => url.startsWith(SITE) && !localTargetExistsFromUrl(url));
  if (missing.length) missing.slice(0, 20).forEach((url) => bad(`sitemap loc missing in dist: ${url}`));
  else ok(`sitemap.xml locs resolve in dist (${locations.length})`);
}

function checkRobots() {
  if (!exists('robots.txt')) return;
  const robots = read('robots.txt');
  if (!/Sitemap:\s*https:\/\/gospod-bog\.ru\/sitemap\.xml/i.test(robots)) bad('robots.txt does not point to canonical sitemap.xml');
  else ok('robots.txt points to canonical sitemap.xml');
}

function checkAstroAboutOwnership() {
  if (!exists('about/index.html')) return;
  const html = read('about/index.html');
  if (!/<article class="about-page"/.test(html)) bad('/about/ in dist is not the legacy about visual document');
  else ok('/about/ in dist is Astro-owned via full-document visual parity');
  for (const marker of ['about-page', 'about-resources', 'about-contact-card', 'gb-accuracy-block']) {
    if (!html.includes(marker)) bad(`/about/ dist missing legacy visual marker: ${marker}`);
    else ok(`/about/ dist keeps legacy marker: ${marker}`);
  }
  if (/class="astro-about"|astro-contact-grid|astro-accuracy-block|astro-shell|astro-about-shadow/.test(html)) bad('/about/ contains old generic/shadow-wrapper Astro about markers');
  else ok('/about/ has no old generic/shadow-wrapper Astro about markers');
  if (/Astro scaffold|Технический прототип|production switch/i.test(stripTags(html))) bad('/about/ contains technical scaffold copy');
  else ok('/about/ has no technical scaffold copy');
}

function checkAstroSeriesLandingOwnership() {
  const surfaces = [
    ['biografii/index.html', '/biografii/', `${SITE}/biografii/`, ['home-v20']],
    ['hard-texts/index.html', '/hard-texts/', `${SITE}/hard-texts/`, ['home-v20']],
    ['pastor-series/index.html', '/pastor-series/', `${SITE}/pastor-series/`, ['home-v20']],
    ['nagornaya/index.html', '/nagornaya/', `${SITE}/nagornaya/`, ['nagornaya-page']],
    ['nagornaya/chast-1/index.html', '/nagornaya/chast-1/', `${SITE}/nagornaya/chast-1/`, ['nagornaya-page']],
    ['nagornaya/chast-2/index.html', '/nagornaya/chast-2/', `${SITE}/nagornaya/chast-2/`, ['nagornaya-page']],
    ['nagornaya/chast-3/index.html', '/nagornaya/chast-3/', `${SITE}/nagornaya/chast-3/`, ['nagornaya-page']],
    ['nagornaya/chast-4/index.html', '/nagornaya/chast-4/', `${SITE}/nagornaya/chast-4/`, ['nagornaya-page']],
    ['nagornaya/chast-5/index.html', '/nagornaya/chast-5/', `${SITE}/nagornaya/chast-5/`, ['nagornaya-page']],
    ['nagornaya/seriya/index.html', '/nagornaya/seriya/', `${SITE}/nagornaya/seriya/`, ['nagornaya-series-page']],
    ['nagornaya/istochniki/index.html', '/nagornaya/istochniki/', `${SITE}/nagornaya/istochniki/`, ['nagornaya-page']],
    ['nagornaya/nakhodki/index.html', '/nagornaya/nakhodki/', `${SITE}/nagornaya/nakhodki/`, ['nagornaya-page']],
    ['karty/index.html', '/karty/', `${SITE}/karty/`, ['karty-hub']],
    ['karty/avraam/index.html', '/karty/avraam/', `${SITE}/karty/avraam/`, ['id="stage"', 'Путь Авраама', 'map-engine.js']],
    ['karty/ishod/index.html', '/karty/ishod/', `${SITE}/karty/ishod/`, ['id="stage"', 'Исход из Египта', 'map-engine.js']],
    ['konfessii/index.html', '/konfessii/', `${SITE}/konfessii/`, ['Конфессии и Деноминации']],
    ['konfessii/russkij-baptizm/index.html', '/konfessii/russkij-baptizm/', `${SITE}/konfessii/russkij-baptizm/`, ['id="appframe"', 'Карта Русского Баптизма']],
    [
      'map/index.html',
      '/map/',
      `${SITE}/map/`,
      ['id="atlasApp"', 'class="atlas-topbar"', 'data-relation-engine=', 'data-pagefind-body'],
    ],
  ];

  for (const [file, route, expectedCanonical, requiredMarkers] of surfaces) {
    if (!exists(file)) continue;
    const html = read(file);
    const markers = Array.isArray(requiredMarkers) ? requiredMarkers : [requiredMarkers];
    const missingMarkers = markers.filter((marker) => !html.includes(marker));
    if (missingMarkers.length) bad(`${route} in dist is not Astro-owned landing output (missing marker(s): ${missingMarkers.join(', ')})`);
    else ok(`${route} in dist is Astro-owned landing/full-document shadow output`);
    if (isNoindex(html)) bad(`${route} is noindex in dist`);
    else ok(`${route} is indexable in dist`);
    if (!html.includes(`rel="canonical" href="${expectedCanonical}"`) && !html.includes(`rel='canonical' href='${expectedCanonical}'`)) bad(`${route} canonical mismatch in dist`);
    else ok(`${route} canonical is public URL`);
  }
}

function checkAstroArticlesIndexOwnership() {
  if (!exists('articles/index.html')) return;
  const html = read('articles/index.html');
  if (!html.includes('articles-index-page') || !html.includes('home-v20') || !html.includes('h-article-card')) bad('/articles/ in dist is not full-document visual-parity catalog output');
  else ok('/articles/ in dist is full-document visual-parity catalog output');
  if (/astro-card-grid|class="astro-page/.test(html)) bad('/articles/ contains forbidden generic Astro catalog markers');
  else ok('/articles/ has no generic Astro catalog markers');
  if (isNoindex(html)) bad('/articles/ is noindex in dist');
  else ok('/articles/ is indexable in dist');
  if (!/<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/gospod-bog\.ru\/articles\/["']/i.test(html)) bad('/articles/ canonical mismatch in dist');
  else ok('/articles/ canonical is public URL');
}

function checkAstroArticleOwnership() {
  const visualShadowArticleMarkers = {
    'dzhon-gill-spravochnik': ['gbs-world', 'data-gbs2-series="dzhon-gill"', 'gbs-rail'],
    'dzhon-gill-istoricheskiy-kontekst': ['gbs-world', 'data-gbs2-series="dzhon-gill"', 'gbs-rail'],
    'dzhon-gill-chast-1-chelovek': ['gbs-world', 'data-gbs2-series="dzhon-gill"', 'gbs-rail'],
    'dzhon-gill-chast-2-uchenyi': ['gbs-world', 'data-gbs2-series="dzhon-gill"', 'gbs-rail'],
    'dzhon-gill-chast-3-nasledie': ['gbs-world', 'data-gbs2-series="dzhon-gill"', 'gbs-rail'],
    'dzhon-gill-chast-4-ekzeget': ['gbs-world', 'data-gbs2-series="dzhon-gill"', 'gbs-rail'],
    'rimlyanam-7-veruyushchiy-ili-neveruyushchiy': ['gbs-world', 'data-gbs2-series="hard-texts"', 'gbs-rail'],
    'krajne-li-isporcheno-serdce': ['gbs-world', 'data-gbs2-series="hard-texts"', 'gbs-rail'],
    'kod-da-vinchi': ['article-body', 'data-pagefind-body'],
    'hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki': ['article-body', 'data-pagefind-body'],
    '20-antisovetov-pastoru': ['article-body', 'data-pagefind-body'],
  };
  for (const slug of SHADOW_ARTICLES) {
    const file = `articles/${slug}/index.html`;
    const route = `/articles/${slug}/`;
    if (!exists(file)) continue;
    const html = read(file);
    if (visualShadowArticleMarkers[slug]) {
      const missing = visualShadowArticleMarkers[slug].filter((marker) => !html.includes(marker));
      if (missing.length) bad(`${route} in dist is missing visual-shadow markers: ${missing.join(', ')}`);
      else ok(`${route} in dist is full-document/shadow-breakout visual output`);
      if (/class="astro-article"|astro-series-nav/.test(html)) bad(`${route} contains forbidden generic Astro article markers`);
      else ok(`${route} has no generic Astro article markers`);
    } else if (!/class="astro-article"/.test(html)) {
      bad(`${route} in dist is not Astro-owned output`);
    } else {
      ok(`${route} in dist is Astro-owned`);
    }
    if (/Build-only MDX pilot|MDX content pilot|noindex/i.test(stripTags(html))) bad(`${route} contains pilot/noindex copy`);
    else ok(`${route} has no pilot copy`);
    if (isNoindex(html)) bad(`${route} is noindex in dist`);
    else ok(`${route} is indexable in dist`);
    const canonicalUrl = `${SITE}/articles/${slug}/`;
    if (canonicalHref(html) !== canonicalUrl) bad(`${route} canonical mismatch in dist`);
    else ok(`${route} canonical is public URL`);
  }
}

function checkDevNoindex() {
  const devRoutes = [
    ['dev/astro-test/index.html', '/dev/astro-test/'],
    ['dev/article-mdx-pilot/index.html', '/dev/article-mdx-pilot/'],
  ];
  if (FORBID_DEV) {
    for (const [file, route] of devRoutes) {
      if (exists(file)) bad(`${route} is present in production-like dist`);
      else ok(`${route} absent from production-like dist`);
    }
    return;
  }
  for (const [file, route] of devRoutes) {
    if (!exists(file)) {
      note(`${route} not present in dist`);
      continue;
    }
    const html = read(file);
    if (!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html)) bad(`${route} is not noindex`);
    else ok(`${route} remains noindex`);
  }
}

function cspMetaTag(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return tags.find((tag) => /http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(tag)) || '';
}

function checkCspCoverage() {
  const missing = [];
  const missingForm = [];
  for (const file of htmlFiles()) {
    const fileRel = rel(file);
    const html = fs.readFileSync(file, 'utf8');
    if (!/<html\b/i.test(html)) continue;
    const csp = cspMetaTag(html);
    if (!csp) {
      missing.push(fileRel);
      continue;
    }
    if (!/(?:^|;)\s*form-action\s+'self'/i.test(csp)) missingForm.push(fileRel);
  }
  if (missing.length) missing.forEach((file) => bad(`dist HTML missing CSP meta: ${file}`));
  else ok('dist HTML CSP meta present on every HTML document');
  if (missingForm.length) missingForm.forEach((file) => bad(`dist CSP missing form-action 'self': ${file}`));
  else ok("dist CSP includes form-action 'self' on every CSP meta");
}

function checkSwPrecache() {
  if (!exists('sw.js')) return;
  const sw = read('sw.js');
  const assets = parseSwPrecache(sw);
  if (!assets.length) {
    bad('sw.js PRECACHE_ASSETS not parsed');
    return;
  }
  const missing = [];
  for (const asset of assets) {
    const clean = asset.split('?')[0].replace(/^\//, '');
    if (clean.startsWith('pagefind/')) {
      if (REQUIRE_PAGEFIND && !exists(clean)) missing.push(asset);
      continue;
    }
    if (!exists(clean)) missing.push(asset);
  }
  if (missing.length) missing.forEach((asset) => bad(`sw.js precache asset missing in dist: ${asset}`));
  else ok(`sw.js precache assets resolve in dist (${assets.length}, pagefind ${REQUIRE_PAGEFIND ? 'required' : 'optional'})`);

  try {
    const { ASSETS, LAZY_NO_PRECACHE } = require('./cache-bust-assets');
    const lazyNoPrecache = new Set(LAZY_NO_PRECACHE);
    const swAssets = new Set(assets.map((asset) => asset.replace(/^\//, '').split('?')[0]));
    const drift = ASSETS.filter((asset) => !swAssets.has(asset) && !lazyNoPrecache.has(asset));
    if (drift.length) drift.forEach((asset) => bad(`sw.js PRECACHE_ASSETS is missing cache-busted asset: ${asset}`));
    else ok('sw.js PRECACHE_ASSETS is synchronized with cache-bust-assets.js (lazy set excluded by design)');
    const reintroduced = [...lazyNoPrecache].filter((asset) => swAssets.has(asset));
    if (reintroduced.length) reintroduced.forEach((asset) => bad(`sw.js PRECACHE_ASSETS re-introduced lazy asset: ${asset}`));
  } catch (error) {
    bad(`cache-bust-assets sync check failed: ${error.message}`);
  }
}

function checkPagefind() {
  const has = exists('pagefind/pagefind.js');
  if (REQUIRE_PAGEFIND && !has) bad('Pagefind required but dist/pagefind/pagefind.js missing');
  else if (has) ok('Pagefind index present in dist');
  else {
    note('Pagefind not present in dist (allowed before deploy-switch; use --require-pagefind for deploy-like audit)');
    return;
  }

  const entryFile = path.join(DIST, 'pagefind/pagefind-entry.json');
  if (!fs.existsSync(entryFile)) {
    if (REQUIRE_PAGEFIND) bad('Pagefind entry metadata missing: pagefind/pagefind-entry.json');
    return;
  }
  let entry;
  try {
    entry = JSON.parse(fs.readFileSync(entryFile, 'utf8'));
  } catch (error) {
    bad(`Pagefind entry metadata invalid JSON: ${error.message}`);
    return;
  }
  const indexedCount = Object.values(entry.languages || {}).reduce((sum, language) => sum + Number(language.page_count || 0), 0);
  const expectedPages = pagefindBodyPages();
  if (indexedCount !== expectedPages.length) bad(`Pagefind page_count ${indexedCount} != data-pagefind-body pages ${expectedPages.length}`);
  else ok(`Pagefind page_count matches data-pagefind-body pages (${indexedCount})`);

  const requiredIndexedPages = [
    'index.html',
    'about/index.html',
    'articles/index.html',
    'baptisty-rossii/index.html',
    'biografii/index.html',
    'hard-texts/index.html',
    'karty/index.html',
    'karty/avraam/index.html',
    'karty/ishod/index.html',
    'konfessii/index.html',
    'konfessii/russkij-baptizm/index.html',
    'map/index.html',
    'rodosloviye/index.html',
    'nagornaya/index.html',
    'nagornaya/chast-1/index.html',
    'nagornaya/chast-2/index.html',
    'nagornaya/chast-3/index.html',
    'nagornaya/chast-4/index.html',
    'nagornaya/chast-5/index.html',
    'nagornaya/istochniki/index.html',
    'nagornaya/nakhodki/index.html',
    'nagornaya/seriya/index.html',
    'pastor-series/index.html',
    ...SHADOW_ARTICLES.map((slug) => `articles/${slug}/index.html`),
    ...SHADOW_BAPTISTY_ARTICLES.map((slug) => `baptisty-rossii/${slug}/index.html`),
  ];
  const missingIndexedPages = requiredIndexedPages.filter((page) => !expectedPages.includes(page));
  if (missingIndexedPages.length) missingIndexedPages.forEach((page) => bad(`Pagefind source pages missing required public body: ${page}`));
  else ok(`Pagefind source pages include required Astro public routes (${requiredIndexedPages.length})`);

  const devIndexed = expectedPages.filter((page) => page.startsWith('dev/'));
  if (devIndexed.length) devIndexed.forEach((page) => bad(`Pagefind source pages include dev route: ${page}`));
  else ok('Pagefind source pages exclude dev routes');
}

if (!fs.existsSync(DIST)) {
  bad('dist/ missing. Run npm run strangler:build first.');
  writeReport('FAIL');
  process.exit(1);
}

console.log(`DIST PUBLICATION AUDIT (${REQUIRE_PAGEFIND ? 'pagefind required' : 'pagefind optional'}, ${FORBID_DEV ? 'dev forbidden' : 'dev noindex allowed'})`);
checkRequiredFiles();
checkNoPrivateDirs();
checkSitemaps();
checkRobots();
checkAstroAboutOwnership();
checkAstroArticlesIndexOwnership();
checkAstroSeriesLandingOwnership();
checkAstroArticleOwnership();
checkDevNoindex();
checkCspCoverage();
checkSwPrecache();
checkPagefind();
console.log('');
writeReport(problems.length ? 'FAIL' : 'PASS');
if (problems.length) {
  console.log(`❌ dist publication audit failed: ${problems.length} issue(s)`);
  process.exit(1);
}
console.log('✅ dist publication audit passed');
