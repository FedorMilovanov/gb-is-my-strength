#!/usr/bin/env node
/*
 * copy-legacy-to-dist.js — build-time strangler prototype.
 *
 * Run after astro build. It copies current legacy public files/assets into dist
 * without overwriting Astro-owned routes from migration/page-ownership.json.
 * Production deploy is not changed by this script; it is for local/dist parity.
 *
 * Flags:
 *   --omit-build-only / --production-like
 *     Remove Astro routes marked status:"build-only" after `astro build`.
 *     This gives us a deploy-like dist without exposing /dev/astro-test/.
 *
 *   --dry-run
 *     Do not mutate dist/. Record planned copies/removals and write an ignored
 *     report to reports/dist-copy-dry-run-manifest.json unless --no-manifest.
 *
 *   --no-manifest
 *     Skip writing the ignored reports/dist-copy-*.json operation manifest.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { serializePublicScriptureIndex } = require('./public-scripture-index.js');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OWNERSHIP = path.join(ROOT, 'migration/page-ownership.json');
const OMIT_BUILD_ONLY = process.argv.includes('--omit-build-only') || process.argv.includes('--production-like');
const DRY_RUN = process.argv.includes('--dry-run');
const WRITE_MANIFEST = !process.argv.includes('--no-manifest');
const PUBLIC_SCRIPTURE_INDEX = 'data/scripture-search-index.json';
const INTERNAL_SOURCE_DIRS = new Set(['data/bible']);

const PUBLIC_ROOT_FILES = [
  '.nojekyll',
  '404.html',
  'CNAME',
  'robots.txt',
  'sitemap.xml',
  'feed.xml',
  'manifest.json',
  'sw.js',
  'llms.txt',
  'favicon.ico',
  'favicon-48.png',
  'favicon-120.png',
  'apple-touch-icon.png',
  'google7e02f9855e02b89a.html',
  'yandex_42bc0d54a1ca4952.html',
  'yandex_d8876d66da1b4592.html',
];
const PUBLIC_DIRS = [
  'articles',
  'about',
  'baptisty-rossii',
  'biografii',
  'css',
  'data',
  'fonts',
  'hard-texts',
  'icons',
  'images',
  'js',
  'karty',
  'konfessii',
  'map',
  'nagornaya',
  'pastor-series',
];
const NEVER_COPY_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'audit', '.astro', '_build-tools', 'src', 'scripts', 'docs', 'migration', 'research', '_legacy', 'raw-sources', 'map-data']);

function rel(abs) { return path.relative(ROOT, abs).replace(/\\/g, '/'); }
function relDist(abs) { return path.relative(DIST, abs).replace(/\\/g, '/'); }
function isAstroOwned(meta) { return String(meta.owner || '').startsWith('astro'); }
function isBuildOnly(meta) { return String(meta.status || '') === 'build-only'; }
function isInternalSourceDir(abs) { return INTERNAL_SOURCE_DIRS.has(rel(abs)); }
function loadOwnership() {
  const astroRoutes = new Map();
  const omittedRoutes = new Map();
  if (!fs.existsSync(OWNERSHIP)) return { astroRoutes, omittedRoutes };
  const json = JSON.parse(fs.readFileSync(OWNERSHIP, 'utf8'));
  const routes = json.routes || {};
  for (const [route, meta] of Object.entries(routes)) {
    if (!isAstroOwned(meta)) continue;
    if (OMIT_BUILD_ONLY && isBuildOnly(meta)) omittedRoutes.set(route, meta);
    else astroRoutes.set(route, meta);
  }
  return { astroRoutes, omittedRoutes };
}
function routeForFile(srcAbs) {
  const r = rel(srcAbs);
  if (path.basename(r) !== 'index.html') {
    if (r === '404.html') return '/404.html';
    return '/' + r;
  }
  let route = '/' + r.replace(/\/index\.html$/, '/');
  if (route === '/index.html') route = '/';
  return route;
}
function distPathForRoute(route) {
  if (route === '/') return path.join(DIST, 'index.html');
  if (route.endsWith('/')) return path.join(DIST, route.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
  return path.join(DIST, route.replace(/^\//, ''));
}
function makeStats() {
  return {
    mode: DRY_RUN ? 'dry-run' : 'write',
    files: 0,
    bytes: 0,
    copied: [],
    skippedAstroOwned: [],
    skippedExisting: [],
    skippedInternalSourceDirs: [],
    removedGenerated: [],
    omittedBuildOnly: [],
  };
}
function pruneEmptyDirs(startDir) {
  if (DRY_RUN) return;
  let dir = startDir;
  while (dir && dir.startsWith(DIST) && dir !== DIST) {
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
      else break;
    } catch (_) { break; }
    dir = path.dirname(dir);
  }
}
function removeRouteOutput(route, stats) {
  const file = distPathForRoute(route);
  if (route.endsWith('/')) {
    const dir = path.dirname(file);
    if (fs.existsSync(dir)) {
      if (!DRY_RUN) fs.rmSync(dir, { recursive: true, force: true });
      stats.omittedBuildOnly.push(route);
      pruneEmptyDirs(path.dirname(dir));
    }
    return;
  }
  if (fs.existsSync(file)) {
    if (!DRY_RUN) fs.rmSync(file, { force: true });
    stats.omittedBuildOnly.push(route);
    pruneEmptyDirs(path.dirname(file));
  }
}
function shouldSkipLegacyFile(srcAbs, astroRoutes) {
  const route = routeForFile(srcAbs);
  return astroRoutes.has(route);
}
function ensureDir(file) {
  if (!DRY_RUN) fs.mkdirSync(path.dirname(file), { recursive: true });
}
function transformedPublicBytes(src) {
  if (rel(src) !== PUBLIC_SCRIPTURE_INDEX) return null;
  const input = JSON.parse(fs.readFileSync(src, 'utf8'));
  return Buffer.from(serializePublicScriptureIndex(input), 'utf8');
}
function copyFile(src, dest, stats) {
  const transformed = transformedPublicBytes(src);
  const size = transformed ? transformed.length : fs.statSync(src).size;
  ensureDir(dest);
  if (!DRY_RUN) {
    if (transformed) fs.writeFileSync(dest, transformed);
    else fs.copyFileSync(src, dest);
  }
  stats.files += 1;
  stats.bytes += size;
  stats.copied.push({
    source: rel(src),
    destination: relDist(dest),
    bytes: size,
    route: routeForFile(src),
    ...(transformed ? { transform: 'public-scripture-search-index-v1' } : {}),
  });
}

function removeAstroGeneratedSitemaps(stats) {
  // Until Astro owns sitemap generation for the full site, keep legacy sitemap.xml
  // as the only sitemap advertised by robots.txt. Astro's partial sitemap-index.xml
  // would list only Astro-owned routes and is dangerous in a strangler dist.
  if (!fs.existsSync(DIST)) return;
  for (const name of fs.readdirSync(DIST)) {
    if (/^sitemap-(?:index|\d+)\.xml$/i.test(name)) {
      if (!DRY_RUN) fs.rmSync(path.join(DIST, name), { force: true });
      stats.removedGenerated.push(name);
    }
  }
}

function copyDir(srcDir, destDir, astroRoutes, stats) {
  if (!fs.existsSync(srcDir)) return;
  const base = path.basename(srcDir);
  if (NEVER_COPY_DIRS.has(base)) return;
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, ent.name);
    const dest = path.join(destDir, ent.name);
    if (ent.isDirectory()) {
      if (NEVER_COPY_DIRS.has(ent.name)) continue;
      if (isInternalSourceDir(src)) {
        stats.skippedInternalSourceDirs.push(rel(src));
        continue;
      }
      copyDir(src, dest, astroRoutes, stats);
    } else if (ent.isFile()) {
      if (shouldSkipLegacyFile(src, astroRoutes)) {
        stats.skippedAstroOwned.push(routeForFile(src));
        continue;
      }
      if (fs.existsSync(dest)) {
        // Dist file already exists. This can happen for Astro-owned assets or root generated files.
        // Never overwrite silently; skip and report.
        stats.skippedExisting.push(rel(src));
        continue;
      }
      copyFile(src, dest, stats);
    }
  }
}
function verifyRequiredDist(astroRoutes, omittedRoutes) {
  const missing = [];
  const forbidden = [];
  for (const route of astroRoutes.keys()) {
    const dest = distPathForRoute(route);
    if (!fs.existsSync(dest)) missing.push(route);
  }
  for (const route of omittedRoutes.keys()) {
    const dest = distPathForRoute(route);
    if (fs.existsSync(dest)) forbidden.push(route);
  }
  const mustExist = ['index.html', 'sitemap.xml', 'feed.xml', 'robots.txt', 'CNAME', 'css/site.css', 'js/site.js', 'images/og-preview-1200x630.webp'];
  for (const file of mustExist) if (!fs.existsSync(path.join(DIST, file))) missing.push('/' + file);
  if (missing.length || forbidden.length) {
    if (missing.length) {
      console.error('❌ dist missing required route/file(s):');
      missing.forEach(x => console.error('  - ' + x));
    }
    if (forbidden.length) {
      console.error('❌ dist still contains omitted build-only route(s):');
      forbidden.forEach(x => console.error('  - ' + x));
    }
    process.exit(1);
  }
}
function writeCopyManifest(stats, astroRoutes, omittedRoutes) {
  if (!WRITE_MANIFEST) return;
  const reportsDir = path.join(ROOT, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const file = path.join(reportsDir, DRY_RUN ? 'dist-copy-dry-run-manifest.json' : 'dist-copy-manifest.json');
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: stats.mode,
    omitBuildOnly: OMIT_BUILD_ONLY,
    dryRunDoesNotMutateDist: DRY_RUN,
    copiedFileCount: stats.files,
    copiedBytes: stats.bytes,
    astroOwnedRoutes: [...astroRoutes.keys()],
    omittedBuildOnlyRoutes: [...omittedRoutes.keys()],
    copied: stats.copied,
    skippedAstroOwned: [...new Set(stats.skippedAstroOwned)],
    skippedExisting: stats.skippedExisting,
    skippedInternalSourceDirs: [...new Set(stats.skippedInternalSourceDirs)],
    removedGenerated: stats.removedGenerated,
    omittedBuildOnly: stats.omittedBuildOnly,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
  console.log(`   Copy operation manifest: ${path.relative(ROOT, file).replace(/\\/g, '/')}`);
}
function printSummary(stats) {
  const action = DRY_RUN ? 'would copy' : 'copied';
  console.log(`✅ copy-legacy-to-dist: ${action} ${stats.files} files (${Math.round(stats.bytes / 1024)} KB)`);
  if (stats.skippedAstroOwned.length) console.log(`   Astro-owned legacy pages skipped: ${[...new Set(stats.skippedAstroOwned)].join(', ')}`);
  if (stats.skippedInternalSourceDirs.length) console.log(`   Internal source directories not published: ${[...new Set(stats.skippedInternalSourceDirs)].join(', ')}`);
  if (stats.omittedBuildOnly.length) console.log(`   Build-only Astro routes ${DRY_RUN ? 'would be omitted' : 'omitted'}: ${stats.omittedBuildOnly.join(', ')}`);
  if (stats.removedGenerated.length) console.log(`   Partial Astro sitemap files ${DRY_RUN ? 'would be removed' : 'removed'}: ${stats.removedGenerated.join(', ')}`);
  if (stats.skippedExisting.length) console.log(`   Existing dist files preserved: ${stats.skippedExisting.slice(0, 12).join(', ')}${stats.skippedExisting.length > 12 ? '…' : ''}`);
}
function main() {
  if (!fs.existsSync(DIST)) {
    console.error('❌ dist/ does not exist. Run npm run astro:build first.');
    process.exit(1);
  }
  const { astroRoutes, omittedRoutes } = loadOwnership();
  const stats = makeStats();
  removeAstroGeneratedSitemaps(stats);
  for (const route of omittedRoutes.keys()) removeRouteOutput(route, stats);
  for (const file of PUBLIC_ROOT_FILES) {
    const src = path.join(ROOT, file);
    const dest = path.join(DIST, file);
    if (!fs.existsSync(src)) continue;
    if (fs.existsSync(dest)) { stats.skippedExisting.push(file); continue; }
    copyFile(src, dest, stats);
  }
  // root index.html is public and not Astro-owned yet.
  const rootIndex = path.join(ROOT, 'index.html');
  const distIndex = path.join(DIST, 'index.html');
  if (fs.existsSync(rootIndex) && !fs.existsSync(distIndex)) copyFile(rootIndex, distIndex, stats);
  for (const dir of PUBLIC_DIRS) copyDir(path.join(ROOT, dir), path.join(DIST, dir), astroRoutes, stats);
  writeCopyManifest(stats, astroRoutes, omittedRoutes);
  if (!DRY_RUN) verifyRequiredDist(astroRoutes, omittedRoutes);
  printSummary(stats);
  if (DRY_RUN) console.log('ℹ️ Dry run completed: dist/ was not mutated; run without --dry-run to copy legacy files.');
}

main();
