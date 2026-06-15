#!/usr/bin/env node
/*
 * check-page-ownership.js — build-time strangler ownership guard.
 *
 * The manifest in migration/page-ownership.json is intentionally small while
 * legacy remains the production source of truth: it declares non-implicit
 * ownership exceptions (Astro routes, build-only routes, built app assets).
 * Public baseline pages not listed there are treated as implicitly legacy-owned
 * during the transition.
 *
 * Usage:
 *   node scripts/check-page-ownership.js
 *   node scripts/check-page-ownership.js --dist
 *   node scripts/check-page-ownership.js --dist --production-like
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OWNERSHIP_REL = 'migration/page-ownership.json';
const BASELINE_REL = 'data/public-content-baseline.json';
const OWNERSHIP = path.join(ROOT, OWNERSHIP_REL);
const BASELINE = path.join(ROOT, BASELINE_REL);
const SITE = 'https://gospod-bog.ru';
const CHECK_DIST = process.argv.includes('--dist');
const PRODUCTION_LIKE = process.argv.includes('--production-like') || process.argv.includes('--forbid-build-only');

const ALLOWED_OWNERS = new Set(['astro', 'astro-noindex', 'legacy', 'system', 'embedded-app-wrapper', 'built-app']);
const ASTRO_OWNERS = new Set(['astro', 'astro-noindex']);
const SYSTEM_DIST_FILES = [
  '.nojekyll',
  '404.html',
  'CNAME',
  'robots.txt',
  'sitemap.xml',
  'feed.xml',
  'manifest.json',
  'sw.js',
];

const problems = [];
const notes = [];

function bad(msg) { problems.push(msg); console.log('❌ ' + msg); }
function ok(msg) { console.log('✅ ' + msg); }
function note(msg) { notes.push(msg); console.log('ℹ️ ' + msg); }
function rootPath(rel) { return path.join(ROOT, rel); }
function distPath(rel) { return path.join(DIST, rel); }
function slash(rel) { return rel.replace(/\\/g, '/'); }
function safeRel(rel) { return slash(rel || '').replace(/^\.\//, ''); }
function existsRoot(rel) { return fs.existsSync(rootPath(rel)); }
function existsDist(rel) { return fs.existsSync(distPath(rel)); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function isBuildOnly(meta) { return String(meta.status || '') === 'build-only'; }
function isAstroOwner(meta) { return ASTRO_OWNERS.has(String(meta.owner || '')); }
function routeToRel(route) {
  if (route === '/') return 'index.html';
  if (route.endsWith('/')) return route.replace(/^\//, '') + 'index.html';
  return route.replace(/^\//, '');
}
function routeToRootFile(route) { return rootPath(routeToRel(route)); }
function routeToDistFile(route) { return distPath(routeToRel(route)); }
function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function hasNoindex(html) {
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*\bnoindex\b/i.test(html);
}
function canonicalRouteFromUrl(url) {
  const u = new URL(url);
  if (u.origin !== SITE) return '';
  let pathname = decodeURI(u.pathname || '/');
  if (!pathname.startsWith('/')) pathname = '/' + pathname;
  return pathname;
}
function astroRouteFromSource(source) {
  const rel = safeRel(source);
  if (!rel.startsWith('src/pages/')) return '';
  if (!/\.(astro|mdx?|html)$/i.test(rel)) return '';
  let route = rel.slice('src/pages/'.length).replace(/\.(astro|mdx?|html)$/i, '');
  route = route.replace(/(^|\/)index$/, '$1').replace(/\/$/, '');
  if (!route) return '/';
  return '/' + route.replace(/^\//, '') + '/';
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
function loadJson(file, label) {
  if (!fs.existsSync(file)) {
    bad(`${label} missing: ${slash(path.relative(ROOT, file))}`);
    return null;
  }
  try { return JSON.parse(read(file)); }
  catch (e) { bad(`${label} invalid JSON: ${e.message}`); return null; }
}
function validateRouteShape(route, meta) {
  if (!route.startsWith('/')) bad(`ownership route must start with /: ${route}`);
  if (/\/\//.test(route)) bad(`ownership route contains //: ${route}`);
  if (route !== '/' && !route.endsWith('/') && !/\.[a-z0-9]+$/i.test(route)) {
    bad(`ownership route should be trailing-slash page route or file route: ${route}`);
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    bad(`ownership route ${route} metadata must be an object`);
    return;
  }
  const owner = String(meta.owner || '');
  if (!ALLOWED_OWNERS.has(owner)) bad(`${route}: unsupported owner "${owner}"`);
  if (typeof meta.status !== 'string' || !meta.status.trim()) bad(`${route}: status is required`);
  if (!Number.isInteger(meta.risk) || meta.risk < 0 || meta.risk > 6) bad(`${route}: risk must be integer 0..6`);

  const source = safeRel(meta.source || '');
  if (!source) bad(`${route}: source is required`);
  if (path.isAbsolute(source) || source.split('/').includes('..')) bad(`${route}: source must stay inside repository`);
  else if (source && !existsRoot(source)) bad(`${route}: source does not exist: ${source}`);

  if (isAstroOwner(meta)) {
    const fromSource = astroRouteFromSource(source);
    if (!fromSource) bad(`${route}: Astro-owned source must be under src/pages and be route-like`);
    else if (fromSource !== route) bad(`${route}: Astro source route mismatch (${source} -> ${fromSource})`);
  }
  if (owner === 'astro-noindex' && !isBuildOnly(meta)) bad(`${route}: astro-noindex routes should be status:"build-only" until explicitly promoted`);
  if (owner === 'built-app' && !source.endsWith('/')) note(`${route}: built-app source is not a directory; accepted but review manually`);
}
function validateManifest(manifest) {
  if (!manifest) return new Map();
  if (manifest.version !== 1) bad(`${OWNERSHIP_REL}: expected version 1`);
  if (!manifest.routes || typeof manifest.routes !== 'object' || Array.isArray(manifest.routes)) {
    bad(`${OWNERSHIP_REL}: routes object missing`);
    return new Map();
  }
  const routes = new Map(Object.entries(manifest.routes));
  for (const [route, meta] of routes) validateRouteShape(route, meta);

  const declaredAstroSources = new Map([...routes].filter(([, meta]) => isAstroOwner(meta)).map(([route, meta]) => [safeRel(meta.source), route]));
  const srcPages = walk(path.join(ROOT, 'src/pages')).filter((file) => /\.(astro|mdx?|html)$/i.test(file));
  for (const file of srcPages) {
    const rel = slash(path.relative(ROOT, file));
    if (!declaredAstroSources.has(rel)) bad(`src page is not declared in ${OWNERSHIP_REL}: ${rel}`);
  }
  if (srcPages.length) ok(`Astro src/pages ownership declared (${srcPages.length} route file(s))`);

  ok(`ownership manifest parsed (${routes.size} explicit route(s))`);
  return routes;
}
function validateDistRoute(route, meta) {
  const rel = routeToRel(route);
  const file = routeToDistFile(route);
  const present = fs.existsSync(file);
  if (isBuildOnly(meta) && PRODUCTION_LIKE) {
    if (present) bad(`${route}: build-only route must be absent from production-like dist (${rel})`);
    else ok(`${route}: build-only route absent from production-like dist`);
    return;
  }

  if (isAstroOwner(meta)) {
    if (!present) return bad(`${route}: Astro-owned route missing in dist (${rel})`);
    const html = read(file);
    if (String(meta.owner) === 'astro-noindex') {
      if (hasNoindex(html)) ok(`${route}: Astro noindex route present and guarded`);
      else bad(`${route}: astro-noindex route is present without robots noindex`);
    } else {
      ok(`${route}: Astro-owned route exists in dist`);
    }
    const legacyFile = routeToRootFile(route);
    if (fs.existsSync(legacyFile) && read(legacyFile) === html) {
      bad(`${route}: dist output is byte-identical to legacy root; Astro output may have been overwritten`);
    }
    return;
  }

  if (String(meta.owner || '') === 'built-app') {
    if (!present) bad(`${route}: built-app entry missing in dist (${rel})`);
    else {
      ok(`${route}: built-app entry copied to dist`);
      const html = read(file);
      if (hasNoindex(html)) ok(`${route}: built-app remains noindex`);
      else note(`${route}: built-app entry has no explicit noindex; wrapper/page audit should cover exposure risk`);
    }
  }
}
function validateDist(routes) {
  if (!fs.existsSync(DIST)) {
    bad('dist/ missing. Run npm run strangler:build first or omit --dist for manifest-only check.');
    return;
  }
  ok('dist/ exists');
  for (const file of SYSTEM_DIST_FILES) {
    if (!existsDist(file)) bad(`dist system file missing: ${file}`);
  }
  if (SYSTEM_DIST_FILES.every(existsDist)) ok(`dist system files present (${SYSTEM_DIST_FILES.length})`);

  for (const [route, meta] of routes) validateDistRoute(route, meta);

  const baseline = loadJson(BASELINE, 'public content baseline');
  const pages = baseline && Array.isArray(baseline.pages) ? baseline.pages : [];
  const missing = [];
  const explicitAstro = [];
  const implicitLegacy = [];
  for (const page of pages) {
    if (!page || !page.url) continue;
    const route = canonicalRouteFromUrl(page.url);
    if (!route) continue;
    const rel = routeToRel(route);
    if (!existsDist(rel)) missing.push(`${page.url} -> ${rel}`);
    const meta = routes.get(route);
    if (meta && isAstroOwner(meta) && !isBuildOnly(meta)) explicitAstro.push(route);
    else implicitLegacy.push(route);
  }
  if (missing.length) missing.slice(0, 30).forEach((m) => bad(`baseline URL missing in dist: ${m}`));
  else ok(`baseline public URLs resolve in dist (${pages.length})`);
  ok(`explicit Astro baseline route(s): ${explicitAstro.length ? [...new Set(explicitAstro)].join(', ') : 'none'}`);
  note(`implicit legacy baseline route(s): ${new Set(implicitLegacy).size}; these remain copied legacy pages until individually promoted`);
}

function main() {
  console.log(`PAGE OWNERSHIP CHECK (${CHECK_DIST ? 'manifest + dist' : 'manifest only'}, ${PRODUCTION_LIKE ? 'production-like' : 'build-only routes allowed'})`);
  const manifest = loadJson(OWNERSHIP, 'ownership manifest');
  const routes = validateManifest(manifest);
  if (CHECK_DIST) validateDist(routes);
  console.log('');
  if (problems.length) {
    console.log(`❌ page ownership check failed: ${problems.length} issue(s)`);
    problems.forEach((p) => console.log('  - ' + p));
    process.exit(1);
  }
  console.log('✅ page ownership check passed');
  if (notes.length) console.log('ℹ️ Ownership notes are expected while the legacy root remains production truth.');
}

main();
