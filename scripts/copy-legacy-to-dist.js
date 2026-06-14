#!/usr/bin/env node
/*
 * copy-legacy-to-dist.js — build-time strangler prototype.
 *
 * Run after astro build. It copies current legacy public files/assets into dist
 * without overwriting Astro-owned routes from migration/page-ownership.json.
 * Production deploy is not changed by this script; it is for local/dist parity.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OWNERSHIP = path.join(ROOT, 'migration/page-ownership.json');

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
const NEVER_COPY_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'audit', '.astro', '_build-tools', 'src', 'scripts', 'docs', 'migration']);

function rel(abs) { return path.relative(ROOT, abs).replace(/\\/g, '/'); }
function loadOwnership() {
  if (!fs.existsSync(OWNERSHIP)) return new Map();
  const json = JSON.parse(fs.readFileSync(OWNERSHIP, 'utf8'));
  const routes = json.routes || {};
  return new Map(Object.entries(routes).filter(([, v]) => String(v.owner || '').startsWith('astro')));
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
function shouldSkipLegacyFile(srcAbs, astroRoutes) {
  const route = routeForFile(srcAbs);
  return astroRoutes.has(route);
}
function ensureDir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function copyFile(src, dest, stats) {
  ensureDir(dest);
  fs.copyFileSync(src, dest);
  stats.files += 1;
  stats.bytes += fs.statSync(src).size;
}

function removeAstroGeneratedSitemaps(stats) {
  // Until Astro owns sitemap generation for the full site, keep legacy sitemap.xml
  // as the only sitemap advertised by robots.txt. Astro's partial sitemap-index.xml
  // would list only Astro-owned routes and is dangerous in a strangler dist.
  if (!fs.existsSync(DIST)) return;
  for (const name of fs.readdirSync(DIST)) {
    if (/^sitemap-(?:index|\d+)\.xml$/i.test(name)) {
      fs.rmSync(path.join(DIST, name), { force: true });
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
function verifyRequiredDist(astroRoutes, stats) {
  const missing = [];
  for (const route of astroRoutes.keys()) {
    const dest = route.endsWith('/')
      ? path.join(DIST, route.replace(/^\//, ''), 'index.html')
      : path.join(DIST, route.replace(/^\//, ''));
    if (!fs.existsSync(dest)) missing.push(route);
  }
  const mustExist = ['index.html', 'sitemap.xml', 'feed.xml', 'robots.txt', 'CNAME', 'css/site.css', 'js/site.js', 'images/og-preview-1200x630.webp'];
  for (const file of mustExist) if (!fs.existsSync(path.join(DIST, file))) missing.push('/' + file);
  if (missing.length) {
    console.error('❌ dist missing required route/file(s):');
    missing.forEach(x => console.error('  - ' + x));
    process.exit(1);
  }
  console.log(`✅ copy-legacy-to-dist: copied ${stats.files} files (${Math.round(stats.bytes / 1024)} KB)`);
  if (stats.skippedAstroOwned.length) console.log(`   Astro-owned legacy pages skipped: ${[...new Set(stats.skippedAstroOwned)].join(', ')}`);
  if (stats.removedGenerated.length) console.log(`   Removed partial Astro sitemap files: ${stats.removedGenerated.join(', ')}`);
  if (stats.skippedExisting.length) console.log(`   Existing dist files preserved: ${stats.skippedExisting.slice(0, 12).join(', ')}${stats.skippedExisting.length > 12 ? '…' : ''}`);
}
function main() {
  if (!fs.existsSync(DIST)) {
    console.error('❌ dist/ does not exist. Run npm run astro:build first.');
    process.exit(1);
  }
  const astroRoutes = loadOwnership();
  const stats = { files: 0, bytes: 0, skippedAstroOwned: [], skippedExisting: [], removedGenerated: [] };
  removeAstroGeneratedSitemaps(stats);
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
  verifyRequiredDist(astroRoutes, stats);
}

main();
