#!/usr/bin/env node
/*
 * sw-dist-readiness-audit.js — service-worker readiness checks for the
 * build-time strangler dist artifact.
 *
 * This script does not deploy or mutate files. It is intentionally static and
 * deterministic: use it for the current `upload-pages-artifact: dist` pipeline and any
 * future rollback/re-switch to catch stale-cache and offline/search regressions early.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BASELINE = path.join(ROOT, 'migration', 'sw-cache-version-baseline.json');
const REQUIRE_PAGEFIND = process.argv.includes('--require-pagefind');
const REQUIRE_CACHE_BUMP = process.argv.includes('--require-cache-bump');

const problems = [];
const notes = [];

function bad(msg) { problems.push(msg); console.log('❌ ' + msg); }
function ok(msg) { console.log('✅ ' + msg); }
function note(msg) { notes.push(msg); console.log('ℹ️ ' + msg); }
function existsInDist(rel) { return fs.existsSync(path.join(DIST, rel)); }
function readRoot(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function readDist(rel) { return fs.readFileSync(path.join(DIST, rel), 'utf8'); }
function parseCacheVersion(sw) {
  const m = sw.match(/\bCACHE_VERSION\s*=\s*["']([^"']+)["']/);
  return m ? m[1] : '';
}
function parsePrecache(sw) {
  const m = sw.match(/\bPRECACHE_ASSETS\s*=\s*\[([^\]]+)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/["']([^"']+)["']/g)].map(x => x[1]);
}
function localPath(asset) {
  return asset.split('?')[0].replace(/^\//, '');
}
function requirePattern(label, text, rx, message) {
  if (rx.test(text)) ok(`${label}: ${message}`);
  else bad(`${label}: missing ${message}`);
}

function checkDistPresence() {
  if (!fs.existsSync(DIST)) {
    console.error('❌ dist/ missing. Run npm run strangler:build first.');
    process.exit(1);
  }
  if (!existsInDist('sw.js')) bad('dist/sw.js missing');
  else ok('dist/sw.js exists');
  if (!existsInDist('js/sw-register.js')) bad('dist/js/sw-register.js missing');
  else ok('dist/js/sw-register.js exists');
}
function checkSwIdentity(rootSw, distSw) {
  if (rootSw === distSw) ok('dist/sw.js is copied byte-for-byte from root sw.js');
  else bad('dist/sw.js differs from root sw.js; document ownership before deploy switch');
}
function checkCacheVersion(rootSw) {
  const version = parseCacheVersion(rootSw);
  if (!version) return bad('sw.js CACHE_VERSION not found');
  ok(`sw.js CACHE_VERSION parsed: ${version}`);
  if (!/^gb-v\d+-.+\d{8}$/.test(version)) {
    note(`CACHE_VERSION format is non-standard: ${version}`);
  }
  if (!fs.existsSync(BASELINE)) {
    if (REQUIRE_CACHE_BUMP) bad('cache-version baseline missing: migration/sw-cache-version-baseline.json');
    else note('cache-version baseline missing; --require-cache-bump cannot be enforced yet');
    return version;
  }
  let baseline;
  try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
  catch (e) { bad(`cache-version baseline JSON invalid: ${e.message}`); return version; }
  const previous = baseline.preSwitchProductionCacheVersion || baseline.currentProductionCacheVersion || baseline.cacheVersion || '';
  if (!previous) {
    bad('cache-version baseline does not declare preSwitchProductionCacheVersion/currentProductionCacheVersion');
    return version;
  }
  if (version === previous) {
    const msg = `CACHE_VERSION still equals recorded pre-switch root baseline (${previous})`;
    if (REQUIRE_CACHE_BUMP) bad(`${msg}; bump it before serving dist to evict stale legacy-root HTML caches`);
    else note(`${msg}; this is only acceptable before a root→dist switch, not in dist production`);
  } else {
    ok(`CACHE_VERSION differs from recorded pre-switch baseline (${previous})`);
  }
  // BUG-SW-BASELINE-DRIFT: the baseline's currentExpectedCacheVersion must
  // track sw.js exactly — v182 vs v187 rotted unnoticed for 5 bumps because
  // this was only a note(). Under --require-cache-bump a mismatch is fatal;
  // update the baseline in the same commit as every intentional bump.
  const expected = baseline.currentExpectedCacheVersion || baseline.currentDistProductionCacheVersion;
  if (expected && version !== expected) {
    const msg = `CACHE_VERSION (${version}) != baseline currentExpectedCacheVersion (${expected}) — update migration/sw-cache-version-baseline.json in the same commit as the bump`;
    if (REQUIRE_CACHE_BUMP) bad(msg);
    else note(msg);
  } else if (expected) {
    ok(`CACHE_VERSION matches baseline currentExpectedCacheVersion (${expected})`);
  }
  return version;
}
function checkPrecache(rootSw) {
  const assets = parsePrecache(rootSw);
  if (!assets.length) return bad('sw.js PRECACHE_ASSETS not parsed');
  ok(`PRECACHE_ASSETS parsed (${assets.length})`);
  const duplicates = assets.filter((a, i) => assets.indexOf(a) !== i);
  if (duplicates.length) duplicates.forEach(a => bad(`duplicate PRECACHE_ASSETS entry: ${a}`));
  else ok('PRECACHE_ASSETS has no duplicates');

  const missing = [];
  for (const asset of assets) {
    const clean = localPath(asset);
    if (clean.startsWith('pagefind/') && !REQUIRE_PAGEFIND) continue;
    if (!existsInDist(clean)) missing.push(asset);
  }
  if (missing.length) missing.forEach(a => bad(`PRECACHE_ASSETS entry missing in dist: ${a}`));
  else ok(`PRECACHE_ASSETS entries resolve in dist (${REQUIRE_PAGEFIND ? 'pagefind required' : 'pagefind optional'})`);

  const htmlPages = assets.filter(a => /\.html(?:[?#]|$)/i.test(a) || a === '/' || /\/$/.test(a));
  const allowedHtml = new Set(['/404.html']);
  const forbiddenHtml = htmlPages.filter(a => !allowedHtml.has(a));
  if (forbiddenHtml.length) forbiddenHtml.forEach(a => bad(`HTML page should not be precached across Astro/legacy ownership switch: ${a}`));
  else ok('PRECACHE_ASSETS does not freeze content HTML pages (only /404.html is allowed)');

  if (REQUIRE_PAGEFIND) {
    if (assets.includes('/pagefind/pagefind.js')) ok('Pagefind bootstrap is included in PRECACHE_ASSETS');
    else bad('Pagefind bootstrap /pagefind/pagefind.js missing from PRECACHE_ASSETS');
  }
}
function checkSwRuntimeShape(rootSw) {
  requirePattern('sw.js install', rootSw, /self\.skipWaiting\s*\(/, 'skipWaiting()');
  requirePattern('sw.js activate', rootSw, /self\.clients\.claim\s*\(/, 'clients.claim()');
  requirePattern('sw.js activate', rootSw, /caches\.keys\s*\(/, 'caches.keys() cleanup');
  requirePattern('sw.js activate', rootSw, /caches\.delete\s*\(/, 'old cache deletion');
  requirePattern('sw.js HTML strategy', rootSw, /isHtmlPage[\s\S]+staleWhileRevalidate/, 'HTML requests use stale-while-revalidate');
  requirePattern('sw.js static strategy', rootSw, /isStaticAsset[\s\S]+cacheFirst/, 'static assets use cache-first');
  requirePattern('sw.js image strategy', rootSw, /isImage[\s\S]+CACHE_IMAGES/, 'images use the image cache');
  requirePattern('sw.js Pagefind data strategy', rootSw, /isPagefindData[\s\S]+networkFirstWithCache/, 'Pagefind index/fragment data uses network-first cache');
  requirePattern('sw.js Pagefind static strategy', rootSw, /isPagefindStatic[\s\S]+CACHE_PAGEFIND/, 'Pagefind static assets use the Pagefind cache');
}
function checkRegister() {
  if (!existsInDist('js/sw-register.js')) return;
  const reg = readDist('js/sw-register.js');
  requirePattern('sw-register.js', reg, /navigator\.serviceWorker\.register\(n,\{scope:\s*["']\/["']\}\)/, 'registers /sw.js with root scope');
  requirePattern('sw-register.js', reg, /(?:var\s+|[,;])\s*[A-Za-z_$][\w$]*\s*=\s*["']\/sw\.js["']/, 'uses root /sw.js URL');
}

function main() {
  console.log(`SW DIST READINESS AUDIT (pagefind ${REQUIRE_PAGEFIND ? 'required' : 'optional'}, cache bump ${REQUIRE_CACHE_BUMP ? 'required' : 'advisory'})`);
  checkDistPresence();
  if (!fs.existsSync(path.join(ROOT, 'sw.js')) || !existsInDist('sw.js')) {
    console.log('');
    console.log(`❌ SW dist readiness audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  const rootSw = readRoot('sw.js');
  const distSw = readDist('sw.js');
  checkSwIdentity(rootSw, distSw);
  checkCacheVersion(rootSw);
  checkPrecache(rootSw);
  checkSwRuntimeShape(rootSw);
  checkRegister();
  console.log('');
  if (problems.length) {
    console.log(`❌ SW dist readiness audit failed: ${problems.length} issue(s)`);
    problems.forEach(p => console.log('  - ' + p));
    process.exit(1);
  }
  console.log('✅ SW dist readiness audit passed');
  if (notes.length) console.log('ℹ️ Advisory notes are expected until the explicit deploy-switch commit.');
}

main();
