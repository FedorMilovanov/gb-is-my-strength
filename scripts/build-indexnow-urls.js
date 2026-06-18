#!/usr/bin/env node
/**
 * build-indexnow-urls.js — map changed repository files to public URLs.
 *
 * Why this exists: after the root→dist deploy switch, many public pages are
 * generated from Astro pages and MDX content. A naive
 * git-diff regex over legacy *.html paths misses those changes and IndexNow
 * only receives the homepage. This script keeps the notification contract tied
 * to the real production URL surface.
 *
 * Usage:
 *   git diff --name-only BEFORE AFTER | node scripts/build-indexnow-urls.js
 *   printf 'src/content/articles/kod-da-vinchi.mdx\n' | node scripts/build-indexnow-urls.js --base https://gospod-bog.ru
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_BASE = 'https://gospod-bog.ru';

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const BASE = String(argValue('--base', process.env.INDEXNOW_BASE || DEFAULT_BASE)).replace(/\/+$/, '');
const INCLUDE_HOME = !process.argv.includes('--no-home');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function safeRead(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch { return ''; }
}

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, predicate, out);
    else if (ent.isFile() && (!predicate || predicate(full))) out.push(full);
  }
  return out;
}

function loadContentRouteIndex() {
  const pagesDir = path.join(ROOT, 'src/pages');
  const index = new Map();
  for (const file of walkFiles(pagesDir, (full) => /\.astro$/i.test(full))) {
    const rel = file.replace(ROOT + path.sep, '').replace(/\\/g, '/');
    const src = safeRead(rel);
    const entry = src.match(/getEntry\(\s*['"]articles['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
    if (!entry) continue;
    const slug = entry[1];
    const canonical = src.match(/const\s+canonical\s*=\s*`\$\{SITE\.url\}([^`]+)`/);
    if (canonical?.[1]) index.set(slug, canonical[1]);
    else index.set(slug, srcPageRoute(rel));
  }
  return index;
}

function loadBaselineUrls() {
  const file = path.join(ROOT, 'data/public-content-baseline.json');
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(json.pages) ? json.pages.map((p) => p.url).filter(Boolean) : [];
  } catch {
    return [];
  }
}

const baselineUrls = loadBaselineUrls();
const baselineSet = new Set(baselineUrls);
const contentRouteIndex = loadContentRouteIndex();
const routeOrder = new Map(baselineUrls.map((url, idx) => [url, idx]));
const urls = new Set();

function normalizeRel(raw) {
  return String(raw || '')
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/^'|'$/g, '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function toUrl(routeOrUrl) {
  if (!routeOrUrl) return '';
  if (/^https?:\/\//i.test(routeOrUrl)) return routeOrUrl;
  let route = routeOrUrl.startsWith('/') ? routeOrUrl : `/${routeOrUrl}`;
  if (route !== '/' && !route.endsWith('/') && !/\.[a-z0-9]+$/i.test(route)) route += '/';
  return `${BASE}${route}`;
}

function addUrl(routeOrUrl) {
  const url = toUrl(routeOrUrl);
  if (!url) return;
  // Do not notify noindex/system/private URLs unless they are in the public baseline.
  if (baselineSet.size && !baselineSet.has(url)) return;
  urls.add(url);
}

function addAllPublic() {
  for (const url of baselineUrls) urls.add(url);
}

function rootHtmlRoute(rel) {
  if (rel === 'index.html') return '/';
  if (rel === '404.html') return '';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return '';
}

function srcPageRoute(rel) {
  if (!rel.startsWith('src/pages/')) return '';
  if (/^src\/pages\/dev\//.test(rel)) return '';
  if (!/\.(astro|mdx?|html)$/i.test(rel)) return '';
  let route = rel.slice('src/pages/'.length).replace(/\.(astro|mdx?|html)$/i, '');
  route = route.replace(/(^|\/)index$/, '$1').replace(/\/$/, '');
  return route ? `/${route}/` : '/';
}

function parseFrontmatterValue(src, key) {
  const fm = src.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fm) return '';
  const rx = new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm');
  return fm[1].match(rx)?.[1]?.trim() || '';
}

function srcContentRoute(rel) {
  if (!rel.startsWith('src/content/articles/') || !/\.mdx?$/i.test(rel)) return '';
  const src = safeRead(rel);
  const canonical = parseFrontmatterValue(src, 'canonicalOverride');
  if (canonical) return canonical;
  const slug = parseFrontmatterValue(src, 'slug') || path.basename(rel).replace(/\.mdx?$/i, '');
  const indexedRoute = contentRouteIndex.get(slug);
  if (indexedRoute) return indexedRoute;
  const section = parseFrontmatterValue(src, 'section') || 'articles';
  return `/${section}/${slug}/`;
}

function legacySectionRoute(rel) {
  const first = rel.split('/')[0];
  const publicDirs = new Set([
    'about', 'articles', 'baptisty-rossii', 'biografii', 'hard-texts',
    'karty', 'konfessii', 'map', 'nagornaya', 'pastor-series',
  ]);
  if (!publicDirs.has(first)) return '';

  const html = rootHtmlRoute(rel);
  if (html) return html;

  // Data/assets inside a public route directory. Notify the nearest route when
  // it is a baseline URL; for shared map engines notify all map pages.
  if (rel.startsWith('karty/_engine/') || rel.startsWith('karty/_shared/')) {
    for (const url of baselineUrls.filter((u) => u.startsWith(`${BASE}/karty/`))) urls.add(url);
    return '';
  }
  const parts = rel.split('/');
  if (parts.length >= 2 && first !== 'map' && first !== 'about' && first !== 'biografii' && first !== 'hard-texts' && first !== 'pastor-series') {
    return `/${first}/${parts[1]}/`;
  }
  return `/${first}/`;
}

function isGlobalProductionInput(rel) {
  return /^(css|js|fonts|icons|images|data)\//.test(rel)
    || /^(sw\.js|manifest\.json|robots\.txt|sitemap\.xml|feed\.xml|llms\.txt|CNAME|\.nojekyll)$/.test(rel);
}

function isAstroGlobalInput(rel) {
  return /^(src\/layouts|src\/components|src\/styles|src\/data)\//.test(rel)
    || /^(astro\.config\.mjs|tsconfig\.json|package\.json|package-lock\.json)$/.test(rel)
    || /^scripts\/(copy-legacy-to-dist|extract-url-contract|compare-url-contract|build-pagefind|dist-publication-audit|sw-dist-readiness-audit|check-page-ownership)\.js$/.test(rel);
}

const inputFiles = readStdin()
  .split(/\r?\n/)
  .map(normalizeRel)
  .filter(Boolean);

for (const rel of inputFiles) {
  const contentRoute = srcContentRoute(rel);
  if (contentRoute) { addUrl(contentRoute); continue; }

  const pageRoute = srcPageRoute(rel);
  if (pageRoute) { addUrl(pageRoute); continue; }

  const htmlRoute = rootHtmlRoute(rel);
  if (htmlRoute) { addUrl(htmlRoute); continue; }

  const legacyRoute = legacySectionRoute(rel);
  if (legacyRoute) { addUrl(legacyRoute); continue; }

  if (isGlobalProductionInput(rel) || isAstroGlobalInput(rel) || rel === '.github/workflows/deploy.yml') {
    addAllPublic();
  }
}

if (INCLUDE_HOME) urls.add(`${BASE}/`);

const sorted = [...urls].sort((a, b) => {
  const ai = routeOrder.has(a) ? routeOrder.get(a) : Number.MAX_SAFE_INTEGER;
  const bi = routeOrder.has(b) ? routeOrder.get(b) : Number.MAX_SAFE_INTEGER;
  if (ai !== bi) return ai - bi;
  return a.localeCompare(b);
});

process.stdout.write(JSON.stringify(sorted));
