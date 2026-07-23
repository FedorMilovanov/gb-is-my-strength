#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeRoute } = require('./lib/rss-route-contract');

const ROOT = path.resolve(__dirname, '..');
const SEARCHABLE_ARTICLE_KINDS = new Set(['article', 'translation', 'series-article']);

function parseArgs(argv = process.argv.slice(2)) {
  const options = { dist: 'dist', write: false, promoteRssArticles: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') options.write = true;
    else if (arg === '--promote-rss-articles') options.promoteRssArticles = true;
    else if (arg === '--dist') options.dist = argv[++index];
    else if (arg.startsWith('--dist=')) options.dist = arg.slice('--dist='.length);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function routeToDistFile(route, distRoot) {
  const clean = normalizeRoute(route).replace(/^\/+|\/+$/g, '');
  return path.join(distRoot, clean, 'index.html');
}

function htmlTags(html, tagName) {
  return String(html || '').match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) || [];
}

function attr(tag, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(tag || '').match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? match[1].trim() : '';
}

function metaValues(html, keyAttr, key) {
  return htmlTags(html, 'meta')
    .filter((tag) => attr(tag, keyAttr).toLowerCase() === String(key).toLowerCase())
    .map((tag) => attr(tag, 'content'))
    .filter(Boolean);
}

function firstMeta(html, keyAttr, key) {
  return metaValues(html, keyAttr, key)[0] || '';
}

function titleText(html) {
  const match = String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function normalizeImage(value, siteUrl = 'https://gospod-bog.ru') {
  if (!value) return '';
  try {
    const url = new URL(value, siteUrl);
    if (url.origin === new URL(siteUrl).origin) return url.pathname;
    return url.toString();
  } catch {
    return value;
  }
}

function readingTime(html) {
  const match = String(html || '').match(/\breadingTime\s*:\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function contentKindToManifestType(kind) {
  if (SEARCHABLE_ARTICLE_KINDS.has(kind)) return 'article';
  if (kind === 'landing') return 'landing';
  if (kind === 'tool') return 'tool';
  if (kind === 'app') return 'tool';
  if (kind === 'personal') return 'page';
  return 'page';
}

function routeId(route) {
  const normalized = normalizeRoute(route);
  if (normalized === '/') return 'home';
  return normalized.replace(/^\/+|\/+$/g, '').split('/').pop();
}

function buildManifestItem(route, policy, html) {
  const title = firstMeta(html, 'property', 'og:title')
    || titleText(html).replace(/\s*\|\s*Господь Бог — Сила Моя\s*$/, '');
  const description = firstMeta(html, 'name', 'description')
    || firstMeta(html, 'property', 'og:description');
  const editor = firstMeta(html, 'name', 'author') || 'Фёдор Милованов';
  const section = firstMeta(html, 'property', 'article:section') || policy.librarySection;
  const image = normalizeImage(firstMeta(html, 'property', 'og:image'));
  const tags = [...new Set(metaValues(html, 'property', 'article:tag'))];
  const publishedTime = firstMeta(html, 'property', 'article:published_time');
  const modifiedTime = firstMeta(html, 'property', 'article:modified_time') || publishedTime;
  const readTime = readingTime(html);

  const missing = [];
  if (!title) missing.push('title');
  if (!description) missing.push('description');
  if (!section) missing.push('section');
  if (!publishedTime) missing.push('publishedTime');
  if (!modifiedTime) missing.push('modifiedTime');
  if (!Number.isInteger(readTime) || readTime < 1) missing.push('readTime');
  if (missing.length) {
    throw new Error(`${normalizeRoute(route)}: built PageHead missing ${missing.join(', ')}`);
  }

  return {
    id: routeId(route),
    type: contentKindToManifestType(policy.contentKind),
    url: normalizeRoute(route),
    title,
    description,
    section,
    editor,
    image,
    tags,
    featured: false,
    priority: 0.6,
    publishedTime,
    modifiedTime,
    readTime,
  };
}

function migrationCandidates({ policyRegistry, manifest, productionRecords, promoteRssArticles }) {
  const manifestRoutes = new Set(
    (manifest.items || [])
      .filter((item) => item?.url && !String(item.url).includes('#'))
      .map((item) => normalizeRoute(item.url))
  );
  const productionRoutes = new Set(
    (productionRecords || [])
      .filter((record) => record?.owner?.status === 'production-dist')
      .map((record) => normalizeRoute(record.route))
  );
  const candidates = [];

  for (const [rawRoute, policy] of Object.entries(policyRegistry.routes || {})) {
    const route = normalizeRoute(rawRoute);
    if (!productionRoutes.has(route)) continue;
    const isPublishedRssArticle = policy.indexPolicy === 'index'
      && policy.pagefindPolicy === 'include'
      && policy.rssPolicy === 'include'
      && SEARCHABLE_ARTICLE_KINDS.has(policy.contentKind);
    const shouldPromote = promoteRssArticles
      && isPublishedRssArticle
      && policy.searchManifestPolicy === 'exclude';
    const missingDeclaredInclude = policy.searchManifestPolicy === 'include'
      && !manifestRoutes.has(route);
    if (shouldPromote || missingDeclaredInclude) {
      candidates.push({ route, policy, shouldPromote, alreadyInManifest: manifestRoutes.has(route) });
    }
  }

  return candidates.sort((a, b) => a.route.localeCompare(b.route, 'ru'));
}

function applyMigration({ policyRegistry, manifest, productionRecords, distRoot, promoteRssArticles }) {
  if (!Array.isArray(manifest.items)) manifest.items = [];
  const candidates = migrationCandidates({
    policyRegistry,
    manifest,
    productionRecords,
    promoteRssArticles,
  });
  const ids = new Set((manifest.items || []).map((item) => item.id).filter(Boolean));
  const urls = new Set((manifest.items || []).map((item) => item.url).filter(Boolean));
  const added = [];
  const promoted = [];

  for (const candidate of candidates) {
    const { route, policy } = candidate;
    if (candidate.shouldPromote) {
      policy.searchManifestPolicy = 'include';
      promoted.push(route);
    }
    if (candidate.alreadyInManifest) continue;
    const distFile = routeToDistFile(route, distRoot);
    if (!fs.existsSync(distFile)) throw new Error(`${route}: missing built HTML ${distFile}`);
    const item = buildManifestItem(route, policy, fs.readFileSync(distFile, 'utf8'));
    if (ids.has(item.id)) throw new Error(`${route}: duplicate manifest id ${item.id}`);
    if (urls.has(item.url)) throw new Error(`${route}: duplicate manifest url ${item.url}`);
    ids.add(item.id);
    urls.add(item.url);
    manifest.items.push(item);
    added.push(route);
  }

  return { candidates, promoted, added };
}

function main() {
  const options = parseArgs();
  const distRoot = path.resolve(ROOT, options.dist);
  const policyFile = path.join(ROOT, 'data/route-search-policy.json');
  const manifestFile = path.join(ROOT, 'data/search-manifest.json');
  const policyRegistry = readJson(policyFile);
  const manifest = readJson(manifestFile);
  const { loadRouteRecords } = require('./lib/effective-route-registry');
  const loaded = loadRouteRecords();
  const result = applyMigration({
    policyRegistry,
    manifest,
    productionRecords: loaded.records,
    distRoot,
    promoteRssArticles: options.promoteRssArticles,
  });

  console.log(`Search manifest migration candidates: ${result.candidates.length}`);
  for (const route of result.promoted) console.log(`PROMOTE ${route}`);
  for (const route of result.added) console.log(`ADD ${route}`);

  if (!options.write) {
    if (result.promoted.length || result.added.length) process.exitCode = 1;
    return;
  }

  if (!result.promoted.length && !result.added.length) {
    console.log('No search manifest migration changes required.');
    return;
  }
  policyRegistry.reviewedAt = new Date().toISOString().slice(0, 10);
  manifest.generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  writeJson(policyFile, policyRegistry);
  writeJson(manifestFile, manifest);
  console.log(`Wrote ${result.promoted.length} policy promotion(s) and ${result.added.length} manifest item(s).`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  SEARCHABLE_ARTICLE_KINDS,
  parseArgs,
  attr,
  metaValues,
  firstMeta,
  titleText,
  normalizeImage,
  readingTime,
  contentKindToManifestType,
  routeId,
  buildManifestItem,
  migrationCandidates,
  applyMigration,
};
