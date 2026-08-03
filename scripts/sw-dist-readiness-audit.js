#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BASELINE = path.join(ROOT, 'migration', 'sw-cache-version-baseline.json');
const MATRIX = path.join(ROOT, 'data', 'offline-route-matrix.json');
const REPORT_DIR = path.join(ROOT, 'reports');
const REQUIRE_PAGEFIND = process.argv.includes('--require-pagefind');
const REQUIRE_CACHE_BUMP = process.argv.includes('--require-cache-bump');

const problems = [];
const notes = [];
const checks = [];

function bad(message) { problems.push(message); checks.push({ status: 'error', message }); console.log(`❌ ${message}`); }
function ok(message) { checks.push({ status: 'pass', message }); console.log(`✅ ${message}`); }
function note(message) { notes.push(message); checks.push({ status: 'note', message }); console.log(`ℹ️ ${message}`); }
function existsInDist(relative) { return fs.existsSync(path.join(DIST, relative)); }
function readRoot(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function readDist(relative) { return fs.readFileSync(path.join(DIST, relative), 'utf8'); }
function parseCacheVersion(sw) { return sw.match(/\bCACHE_VERSION\s*=\s*["']([^"']+)["']/)?.[1] || ''; }
function parsePrecache(sw) {
  const match = sw.match(/\bPRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  return match ? [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]) : [];
}
function localPath(asset) { return asset.split('?')[0].replace(/^\//, ''); }
function requirePattern(label, text, pattern, message) {
  if (pattern.test(text)) ok(`${label}: ${message}`);
  else bad(`${label}: missing ${message}`);
}
function forbidPattern(label, text, pattern, message) {
  if (pattern.test(text)) bad(`${label}: forbidden ${message}`);
  else ok(`${label}: no ${message}`);
}

function routeToDist(route) {
  if (route === '/') return path.join(DIST, 'index.html');
  return path.join(DIST, route.replace(/^\/+|\/+$/g, ''), 'index.html');
}

function walk(root, extensions, output = []) {
  if (!fs.existsSync(root)) return output;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) walk(file, extensions, output);
    else if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))) output.push(file);
  }
  return output;
}

function checkDistPresence() {
  if (!fs.existsSync(DIST)) {
    console.error('❌ dist/ missing. Run npm run strangler:build:production-like first.');
    process.exit(1);
  }
  for (const relative of ['sw.js', 'js/sw-register.js']) {
    if (existsInDist(relative)) ok(`dist/${relative} exists`);
    else bad(`dist/${relative} missing`);
  }
}

function checkSwIdentity(rootSw, distSw) {
  if (rootSw === distSw) ok('dist/sw.js is copied byte-for-byte from root sw.js');
  else bad('dist/sw.js differs from root sw.js; document ownership before deploy switch');
}

function checkCacheVersion(rootSw, matrix) {
  const version = parseCacheVersion(rootSw);
  if (!version) {
    bad('sw.js CACHE_VERSION not found');
    return '';
  }
  ok(`sw.js CACHE_VERSION parsed: ${version}`);
  if (/^gb-v\d+-.+\d{8}$/.test(version)) ok('CACHE_VERSION uses the governed release format');
  else bad(`CACHE_VERSION format is invalid: ${version}`);

  let baseline;
  try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
  catch (error) { bad(`cache-version baseline JSON invalid: ${error.message}`); return version; }

  const previous = baseline.preSwitchProductionCacheVersion || '';
  const expected = baseline.currentExpectedCacheVersion || baseline.currentDistProductionCacheVersion || '';
  if (!previous) bad('baseline missing preSwitchProductionCacheVersion');
  else if (version === previous) bad(`CACHE_VERSION reuses historical pre-switch version ${previous}`);
  else ok(`CACHE_VERSION differs from historical pre-switch version ${previous}`);

  if (!expected) bad('baseline missing currentExpectedCacheVersion');
  else if (version !== expected) bad(`CACHE_VERSION ${version} != baseline currentExpectedCacheVersion ${expected}`);
  else ok(`CACHE_VERSION matches baseline currentExpectedCacheVersion ${expected}`);

  if (REQUIRE_CACHE_BUMP && version === baseline.lastReviewedDistProductionCacheVersion) {
    bad(`deploy-switch requires a cache bump beyond lastReviewedDistProductionCacheVersion ${baseline.lastReviewedDistProductionCacheVersion}`);
  }
  if (matrix.cacheVersion !== version) bad(`offline matrix cacheVersion ${matrix.cacheVersion} != sw.js ${version}`);
  else ok('offline matrix cacheVersion matches sw.js');
  return version;
}

function checkPrecache(rootSw) {
  const assets = parsePrecache(rootSw);
  if (!assets.length) return bad('sw.js PRECACHE_ASSETS not parsed');
  ok(`PRECACHE_ASSETS parsed (${assets.length})`);
  const duplicates = [...new Set(assets.filter((asset, index) => assets.indexOf(asset) !== index))];
  if (duplicates.length) duplicates.forEach((asset) => bad(`duplicate PRECACHE_ASSETS entry: ${asset}`));
  else ok('PRECACHE_ASSETS has no duplicates');

  const missing = [];
  for (const asset of assets) {
    const clean = localPath(asset);
    if (clean.startsWith('pagefind/') && !REQUIRE_PAGEFIND) continue;
    if (!existsInDist(clean)) missing.push(asset);
  }
  if (missing.length) missing.forEach((asset) => bad(`PRECACHE_ASSETS entry missing in dist: ${asset}`));
  else ok(`PRECACHE_ASSETS entries resolve in dist (${REQUIRE_PAGEFIND ? 'pagefind required' : 'pagefind optional'})`);

  const htmlPages = assets.filter((asset) => /\.html(?:[?#]|$)/i.test(asset) || asset === '/' || /\/$/.test(asset));
  const forbiddenHtml = htmlPages.filter((asset) => asset !== '/404.html');
  if (forbiddenHtml.length) forbiddenHtml.forEach((asset) => bad(`content HTML must not be precached: ${asset}`));
  else ok('only /404.html is precached; content routes remain visit-driven');

  if (REQUIRE_PAGEFIND) {
    if (assets.includes('/pagefind/pagefind.js')) ok('Pagefind bootstrap is precached');
    else bad('Pagefind bootstrap /pagefind/pagefind.js missing from PRECACHE_ASSETS');
  }
  if (assets.some((asset) => /(?:audio|tts|model|vosk)|\.(?:zip|bin|mp3|m4a|ogg|wav)$/i.test(asset))) {
    bad('TTS/audio/model assets must not be precached');
  } else ok('PRECACHE_ASSETS excludes TTS/audio/model payloads');
}

function checkSwRuntimeShape(rootSw) {
  requirePattern('sw.js install', rootSw, /cache\.addAll\s*\(\s*PRECACHE_ASSETS\s*\)/, 'atomic cache.addAll(PRECACHE_ASSETS)');
  forbidPattern('sw.js install', rootSw, /Promise\.allSettled|Failed to precache/, 'fail-open partial precache');
  requirePattern('sw.js install', rootSw, /caches\.delete\s*\(\s*CACHE_STATIC\s*\)[\s\S]*throw\s+error/, 'failed staging cache cleanup before rethrow');
  requirePattern('sw.js install', rootSw, /await\s+self\.skipWaiting\s*\(\s*\)/, 'skipWaiting only after successful precache');

  requirePattern('sw.js activate', rootSw, /name\.startsWith\s*\(\s*["']gb-["']\s*\)/, 'deletes only governed gb-* caches');
  requirePattern('sw.js activate', rootSw, /self\.clients\.claim\s*\(/, 'clients.claim()');
  requirePattern('sw.js activate', rootSw, /GB_SW_ACTIVATED/, 'activation message');

  requirePattern('sw.js HTML strategy', rootSw, /function\s+networkFirstHtml\s*\(/, 'network-first navigation owner');
  forbidPattern('sw.js HTML strategy', rootSw, /staleWhileRevalidate/, 'stale-while-revalidate navigation');
  requirePattern('sw.js revisioned static strategy', rootSw, /function\s+revisionedStaticNetworkFirst\s*\(/, 'network-first revisioned assets');
  requirePattern('sw.js revisioned static fallback', rootSw, /canonicalUrl\s*\(\s*url\s*\)/, 'canonical precache fallback');
  requirePattern('sw.js mutable data strategy', rootSw, /isMutableData[\s\S]+CACHE_DATA/, 'mutable /data/*.json network-first cache');
  requirePattern('sw.js Pagefind data strategy', rootSw, /isPagefindData[\s\S]+CACHE_PAGEFIND/, 'Pagefind data network-first cache');
  requirePattern('sw.js Pagefind static strategy', rootSw, /isPagefindStatic[\s\S]+cacheFirst/, 'Pagefind static cache-first');
  requirePattern('sw.js persistent eviction', rootSw, /CACHE_META[\s\S]+metadataRequest[\s\S]+touchCache/, 'persistent cache metadata');
  forbidPattern('sw.js persistent eviction', rootSw, /new\s+Map\s*\(/, 'in-memory-only LRU metadata');
  requirePattern('sw.js streaming boundary', rootSw, /request\.headers\.has\s*\(\s*["']range["']\s*\)/i, 'Range request bypass');
  requirePattern('sw.js TTS boundary', rootSw, /request\.destination\s*===\s*["']audio["']/, 'audio bypass');
  forbidPattern('sw.js dead manual API', rootSw, /CACHE_ARTICLE|cache-article:|addEventListener\s*\(\s*["']sync["']/, 'orphan CACHE_ARTICLE/background-sync API');
}

function checkRegister() {
  if (!existsInDist('js/sw-register.js')) return;
  const register = readDist('js/sw-register.js');
  requirePattern('sw-register.js', register, /navigator\.serviceWorker\.register\s*\(\s*workerUrl\s*,\s*\{\s*scope:\s*["']\/["']\s*\}/, 'registers root /sw.js with root scope');
  requirePattern('sw-register.js', register, /async\s+function\s+currentPageCached/, 'checks current route cache state');
  requirePattern('sw-register.js', register, /эта страница доступна/, 'honest cached-page offline message');
  requirePattern('sw-register.js', register, /эта страница не сохранена/, 'honest uncached-page offline message');
  forbidPattern('sw-register.js', register, /кэшированные статьи доступны/, 'blanket cached-articles claim');
}

function checkDeadProducers() {
  const candidates = [
    ...walk(path.join(ROOT, 'js'), ['.js', '.mjs']),
    ...walk(path.join(ROOT, 'src'), ['.js', '.mjs', '.ts', '.astro']),
    ...fs.readdirSync(ROOT).filter((name) => name.endsWith('.html')).map((name) => path.join(ROOT, name)),
  ];
  const found = [];
  for (const file of candidates) {
    const text = fs.readFileSync(file, 'utf8');
    if (/CACHE_ARTICLE|cache-article:/.test(text)) found.push(path.relative(ROOT, file));
  }
  if (found.length) found.forEach((file) => bad(`orphan manual offline producer remains: ${file}`));
  else ok('no source producer depends on removed CACHE_ARTICLE/background-sync API');
}

function checkMatrix(matrix) {
  if (matrix.schemaVersion !== 1) bad('offline route matrix schemaVersion must be 1');
  if (matrix.decision !== 'REBUILD_CURRENT_MAIN') bad(`offline route matrix decision must be REBUILD_CURRENT_MAIN, got ${matrix.decision}`);
  if (!matrix.principles || matrix.principles.partialPrecacheMayActivate !== false) bad('offline matrix must forbid partial precache activation');
  if (!Array.isArray(matrix.browserScenarios) || matrix.browserScenarios.length < 9) bad('offline matrix must list all nine browser scenarios');
  else ok(`offline matrix declares ${matrix.browserScenarios.length} browser scenarios`);
  for (const record of matrix.representativeRoutes || []) {
    if (record.role === 'missing') continue;
    const file = routeToDist(record.route);
    if (!fs.existsSync(file)) bad(`offline representative route missing in dist: ${record.route}`);
    else ok(`offline representative route exists: ${record.route}`);
  }
}

function writeReport(version, matrix) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    contract: 'A07-honest-offline-pwa',
    cacheVersion: version,
    decision: matrix.decision,
    pagefindRequired: REQUIRE_PAGEFIND,
    cacheBumpRequired: REQUIRE_CACHE_BUMP,
    checks,
    errors: problems,
    notes,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'a07-sw-static-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    '# A07 SW static audit', '',
    `- Cache version: \`${version}\``,
    `- Decision: \`${matrix.decision}\``,
    `- Passed checks: **${checks.filter((item) => item.status === 'pass').length}**`,
    `- Errors: **${problems.length}**`,
    `- Notes: **${notes.length}**`, '',
  ];
  if (problems.length) lines.push('## Errors', '', ...problems.map((item) => `- ${item}`), '');
  fs.writeFileSync(path.join(REPORT_DIR, 'a07-sw-static-audit.md'), `${lines.join('\n')}\n`);
}

function main() {
  console.log(`SW DIST READINESS AUDIT (pagefind ${REQUIRE_PAGEFIND ? 'required' : 'optional'}, cache bump ${REQUIRE_CACHE_BUMP ? 'required' : 'advisory'})`);
  checkDistPresence();
  if (!fs.existsSync(path.join(ROOT, 'sw.js')) || !existsInDist('sw.js')) process.exit(1);
  let matrix = {};
  try { matrix = JSON.parse(fs.readFileSync(MATRIX, 'utf8')); }
  catch (error) { bad(`offline route matrix invalid: ${error.message}`); }
  const rootSw = readRoot('sw.js');
  const distSw = readDist('sw.js');
  checkSwIdentity(rootSw, distSw);
  const version = checkCacheVersion(rootSw, matrix);
  checkPrecache(rootSw);
  checkSwRuntimeShape(rootSw);
  checkRegister();
  checkDeadProducers();
  checkMatrix(matrix);
  writeReport(version, matrix);
  console.log('');
  if (problems.length) {
    console.log(`❌ SW dist readiness audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log('✅ SW dist readiness audit passed');
}

main();
