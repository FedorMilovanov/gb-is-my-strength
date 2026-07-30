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

function manifestMaxModifiedAt(manifest) {
  let max = null;
  for (const item of Array.isArray(manifest?.items) ? manifest.items : []) {
    const value = Date.parse(String(item?.modifiedTime || ''));
    if (Number.isFinite(value) && (max === null || value > max)) max = value;
  }
  return max === null ? null : new Date(max).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function refreshGeneratedAt(manifest) {
  const maxModifiedAt = manifestMaxModifiedAt(manifest);
  if (!maxModifiedAt) return false;
  const current = Date.parse(String(manifest?.generatedAt || ''));
  const target = Date.parse(maxModifiedAt);
  if (Number.isFinite(current) && current >= target) return false;
  manifest.generatedAt = maxModifiedAt;
  return true;
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

function joinRoute(baseUrl, slug) {
  return normalizeRoute(`${String(baseUrl || '/').replace(/\/+$/, '')}/${String(slug || '').replace(/^\/+|\/+$/g, '')}/`);
}

function seriesReadingTimes(seriesData) {
  const result = new Map();
  for (const [seriesId, series] of Object.entries(seriesData || {})) {
    if (!series?.baseUrl || !Array.isArray(series.parts)) continue;
    for (const part of series.parts) {
      if (part?.status !== 'published') continue;
      if (!part.slug) throw new Error(`${seriesId}: published series part missing slug`);
      if (!Number.isInteger(part.readingTime) || part.readingTime < 1) {
        throw new Error(`${seriesId}/${part.slug}: published series part missing positive readingTime`);
      }
      const route = joinRoute(series.baseUrl, part.slug);
      if (result.has(route) && result.get(route) !== part.readingTime) {
        throw new Error(`${route}: conflicting canonical series readingTime`);
      }
      result.set(route, part.readingTime);
    }
  }
  return result;
}

function seriesPolicySeeds(seriesData) {
  const byRoute = new Map();
  for (const [seriesId, series] of Object.entries(seriesData || {})) {
    const declaration = series?.searchPolicy;
    if (!declaration) continue;
    for (const field of ['librarySection', 'topicCategory']) {
      if (!declaration[field] || typeof declaration[field] !== 'string') {
        throw new Error(`${seriesId}: searchPolicy.${field} must be a non-empty string`);
      }
    }

    const addSeed = (route, policy) => {
      const normalized = normalizeRoute(route);
      if (byRoute.has(normalized)) throw new Error(`${normalized}: duplicate series search policy seed`);
      byRoute.set(normalized, { route: normalized, policy });
    };

    if (declaration.landingRoute) {
      addSeed(declaration.landingRoute, {
        indexPolicy: 'index',
        pagefindPolicy: 'include',
        searchManifestPolicy: 'exclude',
        sitemapPolicy: 'include',
        rssPolicy: 'exclude',
        contentKind: 'landing',
        librarySection: declaration.librarySection,
        topicCategory: declaration.topicCategory,
      });
    }

    if (!series?.baseUrl || !Array.isArray(series.parts)) {
      throw new Error(`${seriesId}: searchPolicy requires baseUrl and parts`);
    }
    for (const part of series.parts) {
      if (part?.status !== 'published') continue;
      if (!part.slug) throw new Error(`${seriesId}: published series part missing slug`);
      addSeed(joinRoute(series.baseUrl, part.slug), {
        indexPolicy: 'index',
        pagefindPolicy: 'include',
        searchManifestPolicy: 'exclude',
        sitemapPolicy: 'include',
        rssPolicy: 'include',
        contentKind: 'series-article',
        librarySection: declaration.librarySection,
        topicCategory: declaration.topicCategory,
      });
    }
  }
  return [...byRoute.values()].sort((a, b) => a.route.localeCompare(b.route, 'ru'));
}

function applyPolicySeeds({ policyRegistry, seriesData, productionRecords }) {
  if (!policyRegistry.routes || typeof policyRegistry.routes !== 'object') policyRegistry.routes = {};
  const productionRoutes = new Set(
    (productionRecords || [])
      .filter((record) => record?.owner?.status === 'production-dist')
      .map((record) => normalizeRoute(record.route))
  );
  const seeded = [];
  for (const seed of seriesPolicySeeds(seriesData)) {
    if (!productionRoutes.has(seed.route)) {
      throw new Error(`${seed.route}: series search policy seed has no production route`);
    }
    if (policyRegistry.routes[seed.route]) continue;
    policyRegistry.routes[seed.route] = seed.policy;
    seeded.push(seed.route);
  }
  return seeded;
}

function buildManifestItem(route, policy, html, fallbackReadTime = null) {
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
  const htmlReadTime = readingTime(html);
  const readTime = Number.isInteger(htmlReadTime) ? htmlReadTime : fallbackReadTime;

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

function applyMigration({ policyRegistry, manifest, seriesData, productionRecords, distRoot, promoteRssArticles }) {
  if (!Array.isArray(manifest.items)) manifest.items = [];
  const canonicalReadTimes = seriesReadingTimes(seriesData);
  const seeded = applyPolicySeeds({ policyRegistry, seriesData, productionRecords });
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
    const item = buildManifestItem(
      route,
      policy,
      fs.readFileSync(distFile, 'utf8'),
      canonicalReadTimes.get(route) || null
    );
    if (ids.has(item.id)) throw new Error(`${route}: duplicate manifest id ${item.id}`);
    if (urls.has(item.url)) throw new Error(`${route}: duplicate manifest url ${item.url}`);
    ids.add(item.id);
    urls.add(item.url);
    manifest.items.push(item);
    added.push(route);
  }

  return { seeded, candidates, promoted, added };
}

function main() {
  const options = parseArgs();
  const distRoot = path.resolve(ROOT, options.dist);
  const policyFile = path.join(ROOT, 'data/route-search-policy.json');
  const manifestFile = path.join(ROOT, 'data/search-manifest.json');
  const seriesFile = path.join(ROOT, 'data/series.json');
  const policyRegistry = readJson(policyFile);
  const manifest = readJson(manifestFile);
  const seriesData = readJson(seriesFile);
  const { loadRouteRecords } = require('./lib/effective-route-registry');
  const loaded = loadRouteRecords();
  const result = applyMigration({
    policyRegistry,
    manifest,
    seriesData,
    productionRecords: loaded.records,
    distRoot,
    promoteRssArticles: options.promoteRssArticles,
  });
  const generatedAtRefreshed = refreshGeneratedAt(manifest);

  console.log(`Search policy seeds: ${result.seeded.length}`);
  for (const route of result.seeded) console.log(`SEED ${route}`);
  console.log(`Search manifest migration candidates: ${result.candidates.length}`);
  for (const route of result.promoted) console.log(`PROMOTE ${route}`);
  for (const route of result.added) console.log(`ADD ${route}`);
  console.log(`Search manifest generatedAt refreshed: ${generatedAtRefreshed ? 'yes' : 'no'}`);

  if (!options.write) {
    if (result.seeded.length || result.promoted.length || result.added.length || generatedAtRefreshed) process.exitCode = 1;
    return;
  }

  const migrationChanged = Boolean(result.seeded.length || result.promoted.length || result.added.length);
  if (!migrationChanged && !generatedAtRefreshed) {
    console.log('No search policy or manifest migration changes required.');
    return;
  }
  if (migrationChanged) {
    policyRegistry.reviewedAt = new Date().toISOString().slice(0, 10);
    writeJson(policyFile, policyRegistry);
  }
  writeJson(manifestFile, manifest);
  console.log(`Wrote ${result.seeded.length} policy seed(s), ${result.promoted.length} promotion(s), ${result.added.length} manifest item(s) and generatedAt refresh=${generatedAtRefreshed}.`);
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
  manifestMaxModifiedAt,
  refreshGeneratedAt,
  attr,
  metaValues,
  firstMeta,
  titleText,
  normalizeImage,
  readingTime,
  contentKindToManifestType,
  routeId,
  joinRoute,
  seriesReadingTimes,
  seriesPolicySeeds,
  applyPolicySeeds,
  buildManifestItem,
  migrationCandidates,
  applyMigration,
};
