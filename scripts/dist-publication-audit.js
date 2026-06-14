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
    'index.html', 'about/index.html', '404.html', 'CNAME', 'robots.txt', 'sitemap.xml', 'feed.xml',
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
function checkDevNoindex() {
  const present = exists('dev/astro-test/index.html');
  if (FORBID_DEV) {
    if (present) bad('/dev/astro-test/ is present in production-like dist');
    else ok('/dev/astro-test/ absent from production-like dist');
    return;
  }
  if (!present) return note('dev/astro-test not present in dist');
  const html = read('dev/astro-test/index.html');
  if (!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html)) bad('/dev/astro-test/ is not noindex');
  else ok('/dev/astro-test/ remains noindex');
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
  if (!expectedPages.includes('about/index.html')) bad('Pagefind source pages missing Astro /about/ body');
  else ok('Pagefind source pages include Astro /about/');
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
checkDevNoindex();
checkSwPrecache();
checkPagefind();
console.log('');
if (problems.length) {
  console.log(`❌ dist publication audit failed: ${problems.length} issue(s)`);
  process.exit(1);
}
console.log('✅ dist publication audit passed');
