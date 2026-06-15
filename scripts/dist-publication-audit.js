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

function rel(p) { return path.relative(DIST, p).replace(/\\/g, '/'); }
function exists(file) { return fs.existsSync(path.join(DIST, file)); }
function bad(msg) { problems.push(msg); console.log('❌ ' + msg); }
function ok(msg) { console.log('✅ ' + msg); }
function note(msg) { notes.push(msg); console.log('ℹ️ ' + msg); }
function read(file) { return fs.readFileSync(path.join(DIST, file), 'utf8'); }
function stripTags(html) { return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
function pagePathToFile(urlPath) {
  if (urlPath === '/') return 'index.html';
  if (urlPath.endsWith('/')) return urlPath.replace(/^\//, '') + 'index.html';
  return urlPath.replace(/^\//, '');
}
function localTargetExistsFromUrl(url) {
  if (!url.startsWith(SITE)) return true;
  const u = new URL(url);
  return exists(pagePathToFile(u.pathname));
}
function parseSwPrecache(sw) {
  const m = sw.match(/PRECACHE_ASSETS=\[([^\]]+)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);
}
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.isFile()) acc.push(full);
  }
  return acc;
}
function htmlFiles() {
  return walk(DIST).filter(f => f.endsWith('.html'));
}
function isNoindex(html) {
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*\bnoindex\b/i.test(html);
}
function pagefindBodyPages() {
  return htmlFiles().filter(file => {
    const html = fs.readFileSync(file, 'utf8');
    return /\bdata-pagefind-body\b/.test(html) && !isNoindex(html);
  }).map(file => rel(file));
}

function checkRequiredFiles() {
  const required = [
    'index.html', 'about/index.html', 'articles/index.html', 'biografii/index.html',
    'hard-texts/index.html', 'pastor-series/index.html', 'nagornaya/index.html',
    'nagornaya/seriya/index.html', 'nagornaya/istochniki/index.html', 'nagornaya/nakhodki/index.html', 'karty/index.html', 'konfessii/index.html', 'konfessii/russkij-baptizm/index.html', ...SHADOW_ARTICLES.map(slug => `articles/${slug}/index.html`),
    '404.html', 'CNAME', 'robots.txt', 'sitemap.xml', 'feed.xml',
    'manifest.json', 'sw.js', 'llms.txt', 'css/site.css', 'js/site.js', 'js/sw-register.js',
    'images/og-preview-1200x630.webp', 'konfessii/russkij-baptizm/_app/index.html'
  ];
  const missing = required.filter(f => !exists(f));
  if (missing.length) missing.forEach(f => bad(`dist missing required file: ${f}`));
  else ok(`required dist files present (${required.length})`);
}
function checkNoPrivateDirs() {
  const forbidden = ['.git', 'node_modules', 'src', 'scripts', 'docs', 'audit', '_build-tools', 'migration', 'reports'];
  const present = forbidden.filter(f => fs.existsSync(path.join(DIST, f)));
  if (present.length) present.forEach(f => bad(`forbidden private/build dir copied to dist: ${f}`));
  else ok('no private/build directories copied to dist');
}
function checkSitemaps() {
  const generated = fs.readdirSync(DIST).filter(name => /^sitemap-(?:index|\d+)\.xml$/i.test(name));
  if (generated.length) generated.forEach(name => bad(`partial Astro sitemap file present in dist: ${name}`));
  else ok('no partial Astro sitemap-index/sitemap-N files in dist');
  if (!exists('sitemap.xml')) return;
  const sitemap = read('sitemap.xml');
  if (/\/dev\/astro-test\//.test(sitemap)) bad('sitemap.xml includes dev/astro-test');
  if (/\/dev\/article-mdx-pilot\//.test(sitemap)) bad('sitemap.xml includes dev/article-mdx-pilot');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const missing = locs.filter(u => u.startsWith(SITE) && !localTargetExistsFromUrl(u));
  if (missing.length) missing.slice(0, 20).forEach(u => bad(`sitemap loc missing in dist: ${u}`));
  else ok(`sitemap.xml locs resolve in dist (${locs.length})`);
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
  if (!/class="astro-about"/.test(html)) bad('/about/ in dist is not Astro-owned output');
  else ok('/about/ in dist is Astro-owned');
  if (/Astro scaffold|Технический прототип|production switch/i.test(stripTags(html))) bad('/about/ contains technical scaffold copy');
  else ok('/about/ has no technical scaffold copy');
}
function checkAstroSeriesLandingOwnership() {
  for (const [file, route, expectedCanonical, classNeedle] of [
    ['biografii/index.html', '/biografii/', 'https://gospod-bog.ru/biografii/', 'astro-biografii-index'],
    ['hard-texts/index.html', '/hard-texts/', 'https://gospod-bog.ru/hard-texts/', 'astro-series-page'],
    ['pastor-series/index.html', '/pastor-series/', 'https://gospod-bog.ru/pastor-series/', 'astro-series-page'],
    ['nagornaya/index.html', '/nagornaya/', 'https://gospod-bog.ru/nagornaya/', 'astro-nagornaya-index'],
    ['nagornaya/seriya/index.html', '/nagornaya/seriya/', 'https://gospod-bog.ru/nagornaya/seriya/', 'astro-series-page'],
    ['nagornaya/istochniki/index.html', '/nagornaya/istochniki/', 'https://gospod-bog.ru/nagornaya/istochniki/', 'astro-nagornaya-sources'],
    ['nagornaya/nakhodki/index.html', '/nagornaya/nakhodki/', 'https://gospod-bog.ru/nagornaya/nakhodki/', 'astro-nagornaya-findings'],
    ['karty/index.html', '/karty/', 'https://gospod-bog.ru/karty/', 'astro-karty-index'],
    ['konfessii/index.html', '/konfessii/', 'https://gospod-bog.ru/konfessii/', 'astro-konfessii-index'],
    ['konfessii/russkij-baptizm/index.html', '/konfessii/russkij-baptizm/', 'https://gospod-bog.ru/konfessii/russkij-baptizm/', 'astro-map-wrapper'],
  ]) {
    if (!exists(file)) continue;
    const html = read(file);
    if (!html.includes(classNeedle)) bad(`${route} in dist is not Astro-owned landing output`);
    else ok(`${route} in dist is Astro-owned landing output`);
    if (isNoindex(html)) bad(`${route} is noindex in dist`);
    else ok(`${route} is indexable in dist`);
    if (!html.includes(`rel="canonical" href="${expectedCanonical}"`) && !html.includes(`rel='canonical' href='${expectedCanonical}'`)) bad(`${route} canonical mismatch in dist`);
    else ok(`${route} canonical is public URL`);
  }
}
function checkAstroArticlesIndexOwnership() {
  if (!exists('articles/index.html')) return;
  const html = read('articles/index.html');
  if (!/class="astro-page[^"]*astro-articles-index/.test(html)) bad('/articles/ in dist is not Astro-owned catalog output');
  else ok('/articles/ in dist is Astro-owned catalog output');
  if (isNoindex(html)) bad('/articles/ is noindex in dist');
  else ok('/articles/ is indexable in dist');
  if (!/<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/gospod-bog\.ru\/articles\/["']/i.test(html)) bad('/articles/ canonical mismatch in dist');
  else ok('/articles/ canonical is public URL');
}
function checkAstroArticleOwnership() {
  for (const slug of SHADOW_ARTICLES) {
    const file = `articles/${slug}/index.html`;
    const route = `/articles/${slug}/`;
    if (!exists(file)) continue;
    const html = read(file);
    if (!/class="astro-article"/.test(html)) bad(`${route} in dist is not Astro-owned output`);
    else ok(`${route} in dist is Astro-owned`);
    if (/Build-only MDX pilot|MDX content pilot|noindex/i.test(stripTags(html))) bad(`${route} contains pilot/noindex copy`);
    else ok(`${route} has no pilot copy`);
    if (isNoindex(html)) bad(`${route} is noindex in dist`);
    else ok(`${route} is indexable in dist`);
    const canonicalRe = new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/gospod-bog\.ru\/articles\/${slug}\/["']`, 'i');
    if (!canonicalRe.test(html)) bad(`${route} canonical mismatch in dist`);
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
    if (!exists(file)) { note(`${route} not present in dist`); continue; }
    const html = read(file);
    if (!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html)) bad(`${route} is not noindex`);
    else ok(`${route} remains noindex`);
  }
}
function checkSwPrecache() {
  if (!exists('sw.js')) return;
  const sw = read('sw.js');
  const assets = parseSwPrecache(sw);
  if (!assets.length) return bad('sw.js PRECACHE_ASSETS not parsed');
  const missing = [];
  for (const asset of assets) {
    const clean = asset.split('?')[0].replace(/^\//, '');
    if (clean.startsWith('pagefind/')) {
      if (REQUIRE_PAGEFIND && !exists(clean)) missing.push(asset);
      continue;
    }
    if (!exists(clean)) missing.push(asset);
  }
  if (missing.length) missing.forEach(a => bad(`sw.js precache asset missing in dist: ${a}`));
  else ok(`sw.js precache assets resolve in dist (${assets.length}, pagefind ${REQUIRE_PAGEFIND ? 'required' : 'optional'})`);
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
  try { entry = JSON.parse(fs.readFileSync(entryFile, 'utf8')); }
  catch (e) { bad(`Pagefind entry metadata invalid JSON: ${e.message}`); return; }
  const indexedCount = Object.values(entry.languages || {}).reduce((sum, lang) => sum + Number(lang.page_count || 0), 0);
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
    'konfessii/index.html',
    'konfessii/russkij-baptizm/index.html',
    'nagornaya/index.html',
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

  const devIndexed = expectedPages.filter(p => p.startsWith('dev/'));
  if (devIndexed.length) devIndexed.forEach(p => bad(`Pagefind source pages include dev route: ${p}`));
  else ok('Pagefind source pages exclude dev routes');
}

if (!fs.existsSync(DIST)) {
  console.error('❌ dist/ missing. Run npm run strangler:build first.');
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
checkSwPrecache();
checkPagefind();
console.log('');
if (problems.length) {
  console.log(`❌ dist publication audit failed: ${problems.length} issue(s)`);
  process.exit(1);
}
console.log('✅ dist publication audit passed');
