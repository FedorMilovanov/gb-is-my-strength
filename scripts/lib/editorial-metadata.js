'use strict';

const fs = require('fs');
const path = require('path');
const {
  ROOT,
  ARTICLE_ROUTE_TYPES,
  loadRouteRecords,
} = require('./route-source-contract');

const SITE = 'https://gospod-bog.ru';
const REGISTRY_FILE = path.join(ROOT, 'data/editorial-metadata.json');
const SEARCH_MANIFEST_FILE = path.join(ROOT, 'data/search-manifest.json');
const SITEMAP_FILE = path.join(ROOT, 'sitemap.xml');
const FEED_FILE = path.join(ROOT, 'feed.xml');
const ALLOWED_REVIEW_STATUS = new Set(['migration-freeze-unverified', 'inconsistent-needs-review', 'approved']);

function stripTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeInstant(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toISOString() : null;
}

function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = String(html).match(new RegExp(`<meta\\b([^>]*\\b(?:name|property)=["']${escaped}["'][^>]*)>`, 'i'))?.[1] || '';
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim() || null;
}

function canonical(html) {
  for (const match of String(html).matchAll(/<link\b([^>]+)>/gi)) {
    if (!/\brel=["']canonical["']/i.test(match[1])) continue;
    return match[1].match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim() || null;
  }
  return null;
}

function jsonLdNodes(html) {
  const nodes = [];
  for (const block of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(block[1].trim());
      if (Array.isArray(parsed)) nodes.push(...parsed);
      else if (Array.isArray(parsed?.['@graph'])) nodes.push(...parsed['@graph']);
      else if (parsed) nodes.push(parsed);
    } catch (_) {
      // JSON-LD syntax is enforced by dedicated schema audits. Observation keeps
      // this library non-destructive and records null when parsing is impossible.
    }
  }
  return nodes;
}

function nodeHasType(node, type) {
  const value = node?.['@type'];
  return Array.isArray(value) ? value.includes(type) : value === type;
}

function mainArticleNode(nodes, routeUrl) {
  return nodes.find((node) => {
    if (!nodeHasType(node, 'Article') && !nodeHasType(node, 'ScholarlyArticle')) return false;
    const url = node.url || node.mainEntityOfPage?.['@id'] || '';
    return !url || url === routeUrl;
  }) || null;
}

function originalWorkDate(article) {
  const candidates = [article?.translationOfWork, article?.isBasedOn].flat().filter(Boolean);
  for (const candidate of candidates) {
    const date = normalizeInstant(candidate?.datePublished);
    if (date) return date;
  }
  return null;
}

function firstVisibleTime(html, classPattern) {
  const re = new RegExp(`<time\\b([^>]*\\bclass=["'][^"']*${classPattern}[^"']*["'][^>]*)>`, 'i');
  const attrs = String(html).match(re)?.[1] || '';
  return normalizeInstant(attrs.match(/\bdatetime=["']([^"']+)["']/i)?.[1]);
}

function visibleBylineTimes(html) {
  const byline = String(html).match(/<(?:p|div)\b[^>]*class=["'][^"']*article-byline[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div)>/i)?.[1] || '';
  const times = [...byline.matchAll(/<time\b([^>]*)>/gi)]
    .map((match) => normalizeInstant(match[1].match(/\bdatetime=["']([^"']+)["']/i)?.[1]))
    .filter(Boolean);
  return {
    publishedAt: times[0] || null,
    modifiedAt: firstVisibleTime(byline, 'article-updated') || times[1] || null,
  };
}

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function routeToDistFile(distRoot, route) {
  const clean = route.replace(/^\/+|\/+$/g, '');
  return path.join(distRoot, clean || '', 'index.html');
}

function sitemapObservation(routeUrl, sitemapXml) {
  const escaped = routeUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = sitemapXml.match(new RegExp(`<url>\\s*<loc>${escaped}<\\/loc>([\\s\\S]*?)<\\/url>`, 'i'))?.[1] || '';
  return normalizeInstant(block.match(/<lastmod>([^<]+)<\/lastmod>/i)?.[1]);
}

function feedObservation(routeUrl, feedXml) {
  const escaped = routeUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const item = feedXml.match(new RegExp(`<item>(?=[\\s\\S]*?<link>${escaped}<\\/link>)([\\s\\S]*?)<\\/item>`, 'i'))?.[1] || '';
  return normalizeInstant(item.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1]);
}

function observeRoute(record, distRoot, shared) {
  const route = record.route;
  const routeUrl = `${SITE}${route}`;
  const distFile = routeToDistFile(distRoot, route);
  if (!fs.existsSync(distFile)) throw new Error(`${route}: dist file missing: ${path.relative(ROOT, distFile)}`);
  const html = fs.readFileSync(distFile, 'utf8');
  const nodes = jsonLdNodes(html);
  const article = mainArticleNode(nodes, routeUrl);
  const visible = visibleBylineTimes(html);
  const searchItem = shared.searchItems.find((item) => item.url === route) || null;

  const observations = {
    visiblePublishedAt: visible.publishedAt,
    visibleModifiedAt: visible.modifiedAt,
    metaPublishedAt: normalizeInstant(meta(html, 'article:published_time')),
    metaModifiedAt: normalizeInstant(meta(html, 'article:modified_time')),
    jsonLdPublishedAt: normalizeInstant(article?.datePublished),
    jsonLdModifiedAt: normalizeInstant(article?.dateModified),
    searchPublishedAt: normalizeInstant(searchItem?.publishedTime),
    searchModifiedAt: normalizeInstant(searchItem?.modifiedTime),
    sitemapLastmod: sitemapObservation(routeUrl, shared.sitemapXml),
    rssPublishedAt: feedObservation(routeUrl, shared.feedXml),
  };

  const publishedValues = [
    observations.visiblePublishedAt,
    observations.metaPublishedAt,
    observations.jsonLdPublishedAt,
    observations.searchPublishedAt,
    observations.rssPublishedAt,
  ].filter(Boolean);
  const modifiedValues = [
    observations.visibleModifiedAt,
    observations.metaModifiedAt,
    observations.jsonLdModifiedAt,
    observations.searchModifiedAt,
    observations.sitemapLastmod,
  ].filter(Boolean);
  const inconsistent = new Set(publishedValues).size > 1 || new Set(modifiedValues).size > 1;

  return {
    route,
    canonical: canonical(html),
    title: stripTags(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''),
    metadataSource: record.inspection.headImports[0]?.resolved || record.sourceRel,
    contentType: record.profile?.routeType || 'article',
    editorialPublishedAt: observations.visiblePublishedAt || observations.rssPublishedAt || observations.metaPublishedAt || observations.jsonLdPublishedAt,
    editorialModifiedAt: observations.visibleModifiedAt || observations.metaModifiedAt || observations.jsonLdModifiedAt || observations.searchModifiedAt || observations.sitemapLastmod,
    originalWorkPublishedAt: originalWorkDate(article),
    reviewStatus: inconsistent ? 'inconsistent-needs-review' : 'migration-freeze-unverified',
    provenance: 'production-like-dist-migration-freeze',
    observations,
  };
}

function mergeObservedRecord(previous, observed) {
  if (!previous) return observed;
  return {
    ...previous,
    canonical: observed.canonical,
    title: observed.title,
    metadataSource: observed.metadataSource,
    observations: observed.observations,
  };
}

function eligibleRecords() {
  const { records } = loadRouteRecords();
  return records.filter((record) =>
    record.owner.owner === 'astro' &&
    record.owner.status === 'production-dist' &&
    ARTICLE_ROUTE_TYPES.has(record.profile?.routeType) &&
    record.profile?.migrationMode === 'strict-native'
  );
}

function sharedProjectionData() {
  const searchManifest = readJson(SEARCH_MANIFEST_FILE, { items: [] });
  return {
    searchItems: searchManifest.items || [],
    sitemapXml: fs.existsSync(SITEMAP_FILE) ? fs.readFileSync(SITEMAP_FILE, 'utf8') : '',
    feedXml: fs.existsSync(FEED_FILE) ? fs.readFileSync(FEED_FILE, 'utf8') : '',
  };
}

function readRegistry() {
  return readJson(REGISTRY_FILE, null);
}

function validateRecordShape(record, route) {
  const problems = [];
  if (!record || record.route !== route) problems.push('route key/record.route mismatch');
  if (!record?.editorialPublishedAt) problems.push('editorialPublishedAt missing');
  if (!record?.editorialModifiedAt) problems.push('editorialModifiedAt missing');
  if (!ALLOWED_REVIEW_STATUS.has(record?.reviewStatus)) problems.push(`invalid reviewStatus=${record?.reviewStatus}`);
  if (!record?.metadataSource) problems.push('metadataSource missing');
  if (!record?.observations || typeof record.observations !== 'object') problems.push('observations missing');
  return problems;
}

module.exports = {
  ROOT,
  SITE,
  REGISTRY_FILE,
  ALLOWED_REVIEW_STATUS,
  normalizeInstant,
  eligibleRecords,
  sharedProjectionData,
  observeRoute,
  mergeObservedRecord,
  readRegistry,
  validateRecordShape,
};
