#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://gospod-bog.ru';

function normalizeRoute(value) {
  let route = String(value || '/').trim();
  if (!route.startsWith('/')) route = `/${route}`;
  route = route.replace(/\/+/g, '/');
  if (route !== '/' && !route.endsWith('/')) route += '/';
  return route;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function attr(tag, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(tag || '').match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]?.trim() || '';
}

function metaContent(html, keyAttr, key) {
  for (const tag of String(html || '').match(/<meta\b[^>]*>/gi) || []) {
    if (attr(tag, keyAttr).toLowerCase() === String(key).toLowerCase()) return attr(tag, 'content');
  }
  return '';
}

function titleText(html) {
  return String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '';
}

function pagefindMeta(html, key) {
  const pattern = new RegExp(`<[^>]+\\bdata-pagefind-meta=["']${String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i');
  return String(html || '').match(pattern)?.[1]?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || '';
}

function normalizeImage(value) {
  if (!value) return '';
  const url = new URL(value, SITE);
  return url.origin === SITE ? url.pathname : url.toString();
}

function routeId(route) {
  const normalized = normalizeRoute(route);
  return normalized === '/' ? 'home' : normalized.replace(/^\/+|\/+$/g, '').split('/').pop();
}

function parseIso(value, field, seriesId) {
  const raw = String(value || '').trim();
  if (!raw || !Number.isFinite(Date.parse(raw))) throw new Error(`${seriesId}: searchPolicy.${field} must be an ISO date-time`);
  return raw;
}

function canonicalPolicy(declaration) {
  return {
    indexPolicy: 'index',
    pagefindPolicy: 'include',
    searchManifestPolicy: 'include',
    sitemapPolicy: 'include',
    rssPolicy: 'exclude',
    contentKind: 'landing',
    librarySection: declaration.librarySection,
    topicCategory: declaration.topicCategory,
  };
}

function canonicalItem({ seriesId, series, declaration, route, html }) {
  const title = metaContent(html, 'property', 'og:title') || titleText(html).replace(/\s*\|\s*Господь Бог — Сила Моя\s*$/, '');
  const description = metaContent(html, 'name', 'description') || metaContent(html, 'property', 'og:description');
  const image = normalizeImage(metaContent(html, 'property', 'og:image'));
  const readTime = Number.parseInt(pagefindMeta(html, 'readTime'), 10);
  const publishedTime = parseIso(declaration.landingPublishedTime, 'landingPublishedTime', seriesId);
  const modifiedTime = parseIso(declaration.landingModifiedTime, 'landingModifiedTime', seriesId);
  if (Date.parse(modifiedTime) < Date.parse(publishedTime)) throw new Error(`${seriesId}: landingModifiedTime precedes landingPublishedTime`);
  const missing = [];
  if (!title) missing.push('title');
  if (!description) missing.push('description');
  if (!image) missing.push('image');
  if (!Number.isInteger(readTime) || readTime < 1) missing.push('data-pagefind-meta=readTime');
  if (missing.length) throw new Error(`${route}: built series landing missing ${missing.join(', ')}`);
  return {
    id: routeId(route),
    type: 'series',
    url: route,
    title,
    description,
    section: declaration.librarySection,
    editor: 'Фёдор Милованов',
    readTime,
    image,
    tags: [...new Set(['серия', series.title, declaration.topicCategory].filter(Boolean))],
    featured: false,
    priority: 0.6,
    publishedTime,
    modifiedTime,
  };
}

function productionRoutes(ownership) {
  return new Set(Object.entries(ownership?.routes || {})
    .filter(([, owner]) => owner?.status === 'production-dist')
    .map(([route]) => normalizeRoute(route)));
}

export function applyLandingDiscovery({ seriesData, policyRegistry, manifest, ownership, distRoot }) {
  if (!policyRegistry.routes || typeof policyRegistry.routes !== 'object') policyRegistry.routes = {};
  if (!Array.isArray(manifest.items)) manifest.items = [];
  const production = productionRoutes(ownership);
  const changed = [];

  for (const [seriesId, series] of Object.entries(seriesData || {})) {
    const declaration = series?.searchPolicy;
    if (!declaration?.includeLandingInManifest) continue;
    for (const field of ['landingRoute', 'librarySection', 'topicCategory']) {
      if (!declaration[field] || typeof declaration[field] !== 'string') throw new Error(`${seriesId}: searchPolicy.${field} must be a non-empty string`);
    }
    const route = normalizeRoute(declaration.landingRoute);
    if (!production.has(route)) throw new Error(`${route}: opted-in series landing is not production-dist`);
    const file = path.join(distRoot, route.replace(/^\/+|\/+$/g, ''), 'index.html');
    if (!fs.existsSync(file)) throw new Error(`${route}: built series landing missing ${file}`);
    const html = fs.readFileSync(file, 'utf8');
    const expectedPolicy = canonicalPolicy(declaration);
    if (JSON.stringify(policyRegistry.routes[route]) !== JSON.stringify(expectedPolicy)) {
      policyRegistry.routes[route] = expectedPolicy;
      changed.push(`policy:${route}`);
    }
    const expectedItem = canonicalItem({ seriesId, series, declaration, route, html });
    const indexes = manifest.items.map((item, index) => item?.url && normalizeRoute(item.url) === route ? index : -1).filter((index) => index >= 0);
    if (indexes.length > 1) throw new Error(`${route}: duplicate search manifest landing rows`);
    if (!indexes.length) {
      if (manifest.items.some((item) => item?.id === expectedItem.id)) throw new Error(`${route}: duplicate search manifest id ${expectedItem.id}`);
      manifest.items.push(expectedItem);
      changed.push(`manifest:${route}`);
    } else if (JSON.stringify(manifest.items[indexes[0]]) !== JSON.stringify(expectedItem)) {
      manifest.items[indexes[0]] = expectedItem;
      changed.push(`manifest:${route}`);
    }
  }

  if (changed.length) {
    const dates = Object.values(seriesData || {})
      .map((series) => series?.searchPolicy?.includeLandingInManifest ? String(series.searchPolicy.landingModifiedTime || '').slice(0, 10) : '')
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
    if (dates.length) policyRegistry.reviewedAt = dates.sort().at(-1);
  }
  return changed;
}

function parseArgs(argv) {
  const options = { dist: 'dist', write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') options.write = true;
    else if (arg === '--dist') options.dist = argv[++index];
    else if (arg.startsWith('--dist=')) options.dist = arg.slice('--dist='.length);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const seriesFile = path.join(ROOT, 'data/series.json');
  const policyFile = path.join(ROOT, 'data/route-search-policy.json');
  const manifestFile = path.join(ROOT, 'data/search-manifest.json');
  const ownershipFile = path.join(ROOT, 'migration/page-ownership.json');
  const seriesData = readJson(seriesFile);
  const policyRegistry = readJson(policyFile);
  const manifest = readJson(manifestFile);
  const ownership = readJson(ownershipFile);
  const changed = applyLandingDiscovery({
    seriesData,
    policyRegistry,
    manifest,
    ownership,
    distRoot: path.resolve(ROOT, options.dist),
  });
  console.log(`Series landing discovery seeds: ${changed.length}`);
  changed.forEach((entry) => console.log(`SEED ${entry}`));
  if (!changed.length) return;
  if (!options.write) process.exitCode = 1;
  else {
    writeJson(policyFile, policyRegistry);
    writeJson(manifestFile, manifest);
    console.log('Wrote canonical opt-in series landing discovery state.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`❌ ${error.message}`); process.exit(1); }
}
