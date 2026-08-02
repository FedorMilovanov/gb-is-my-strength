#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadRouteRecords } = require('./lib/effective-route-registry');
const { normalizeRoute } = require('./lib/rss-route-contract');
const { normalizePolicyRoutes } = require('./lib/search-index-policy-contract');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SITE_URL = 'https://gospod-bog.ru';
const NORMALIZER_VERSION = 3;
const CANONICAL_ELIGIBILITY_RULE = 'POLICY_INCLUDE_AND_PRODUCTION_AND_MANIFEST_AND_VALID_DATE';

function parseArgs(argv = process.argv.slice(2)) {
  const options = { write: false, check: false };
  for (const arg of argv) {
    if (arg === '--write') options.write = true;
    else if (arg === '--check') options.check = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (options.write && options.check) throw new Error('use either --write or --check');
  if (!options.write) options.check = true;
  return options;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function manifestRouteMap(manifest) {
  const routes = new Map();
  for (const item of Array.isArray(manifest?.items) ? manifest.items : []) {
    if (!item?.url || String(item.url).includes('#') || String(item.url).includes('?')) continue;
    const route = normalizeRoute(item.url);
    if (routes.has(route)) throw new Error(`${route}: duplicate search-manifest route`);
    routes.set(route, item);
  }
  return routes;
}

/**
 * Return only routes that are simultaneously:
 * - explicitly included by sitemap policy;
 * - owned by a production-dist route;
 * - represented by a canonical search-manifest item;
 * - backed by a valid publication/modification timestamp.
 *
 * Historical partial records remain visible through `skipped` diagnostics and
 * continue to be governed by the dedicated search-policy audit. They must not
 * prevent deterministic projection of canonically complete routes.
 */
function canonicalIncludedRoutes({ policyRegistry, manifest, productionRecords }) {
  const policies = normalizePolicyRoutes(policyRegistry);
  const manifestRoutes = manifestRouteMap(manifest);
  const productionRoutes = new Set(
    (productionRecords || [])
      .filter((record) => record?.owner?.status === 'production-dist')
      .map((record) => normalizeRoute(record.route))
  );
  const entries = [];
  const skipped = [];

  for (const [route, policy] of policies) {
    if (policy?.sitemapPolicy !== 'include') continue;
    if (!productionRoutes.has(route)) {
      skipped.push({ route, reason: 'NON_PRODUCTION_ROUTE' });
      continue;
    }
    const item = manifestRoutes.get(route);
    if (!item) {
      skipped.push({ route, reason: 'SEARCH_MANIFEST_ITEM_MISSING' });
      continue;
    }
    const dateValue = item.modifiedTime || item.publishedTime;
    const date = new Date(dateValue);
    if (!dateValue || Number.isNaN(date.getTime())) {
      skipped.push({ route, reason: 'VALID_DATE_MISSING', value: dateValue ?? null });
      continue;
    }
    entries.push({ route, item, date });
  }
  entries.sort((left, right) => left.route.localeCompare(right.route, 'ru'));
  skipped.sort((left, right) => left.route.localeCompare(right.route, 'ru'));
  return { entries, skipped };
}

function parseExistingUrls(xml, siteUrl = DEFAULT_SITE_URL) {
  const base = String(siteUrl).replace(/\/+$/, '');
  const routes = new Set();
  for (const match of String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    const value = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    if (!value.startsWith(base + '/')) continue;
    const pathname = new URL(value).pathname;
    routes.add(normalizeRoute(pathname));
  }
  return routes;
}

function priorityFor(item = {}) {
  if (item.featured) return '0.9';
  if (item.type === 'series') return '0.9';
  if (item.type === 'article') return '0.85';
  return '0.7';
}

function renderUrlBlock(entry, siteUrl = DEFAULT_SITE_URL) {
  const base = String(siteUrl).replace(/\/+$/, '');
  const item = entry.item || {};
  const lines = [
    '  <url>',
    `    <loc>${xmlEscape(base + entry.route)}</loc>`,
    `    <lastmod>${entry.date.toISOString()}</lastmod>`,
    '    <changefreq>monthly</changefreq>',
    `    <priority>${priorityFor(item)}</priority>`,
  ];
  if (item.image && String(item.image).startsWith('/')) {
    lines.push('    <image:image>');
    lines.push(`      <image:loc>${xmlEscape(base + item.image)}</image:loc>`);
    if (item.title) lines.push(`      <image:title>${xmlEscape(item.title)}</image:title>`);
    lines.push('    </image:image>');
  }
  lines.push('  </url>');
  return lines.join('\n');
}

function normalizeSitemap({ current, policyRegistry, manifest, productionRecords, siteUrl }) {
  if (!String(current).includes('</urlset>')) throw new Error('sitemap.xml missing </urlset>');
  const base = String(siteUrl || manifest?.project?.url || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const existing = parseExistingUrls(current, base);
  const { entries: required, skipped } = canonicalIncludedRoutes({ policyRegistry, manifest, productionRecords });
  const missing = required.filter((entry) => !existing.has(entry.route));
  if (!missing.length) return { xml: current, missing: [], skipped };

  const blocks = missing.map((entry) => renderUrlBlock(entry, base)).join('\n');
  const normalized = String(current).replace(/\s*<\/urlset>\s*$/, `\n\n  <!-- Canonical policy-generated additions -->\n${blocks}\n</urlset>\n`);
  return { xml: normalized, missing: missing.map((entry) => entry.route), skipped };
}

function skippedSummary(skipped = []) {
  if (!skipped.length) return 'none';
  return skipped.map((entry) => `${entry.route}:${entry.reason}`).join(', ');
}

function main() {
  const options = parseArgs();
  const policyFile = path.join(ROOT, 'data/route-search-policy.json');
  const manifestFile = path.join(ROOT, 'data/search-manifest.json');
  const sitemapFile = path.join(ROOT, 'sitemap.xml');
  const loaded = loadRouteRecords();
  const current = fs.existsSync(sitemapFile) ? fs.readFileSync(sitemapFile, 'utf8') : '';
  const result = normalizeSitemap({
    current,
    policyRegistry: readJson(policyFile),
    manifest: readJson(manifestFile),
    productionRecords: loaded.records,
  });

  if (options.write) {
    if (result.xml === current) {
      console.log(`Sitemap normalizer v${NORMALIZER_VERSION}: every canonically eligible policy route is already present.`);
      console.log(`Sitemap normalizer eligibility: ${CANONICAL_ELIGIBILITY_RULE}`);
      console.log(`Sitemap normalizer skipped diagnostics: ${skippedSummary(result.skipped)}`);
      return;
    }
    fs.writeFileSync(sitemapFile, result.xml, 'utf8');
    console.log(`Sitemap normalizer v${NORMALIZER_VERSION}: wrote policy additions: ${result.missing.join(', ')}`);
    console.log(`Sitemap normalizer eligibility: ${CANONICAL_ELIGIBILITY_RULE}`);
    console.log(`Sitemap normalizer skipped diagnostics: ${skippedSummary(result.skipped)}`);
    return;
  }

  if (result.xml !== current) {
    console.error(`❌ sitemap.xml misses canonically eligible policy routes: ${result.missing.join(', ')}`);
    console.error(`Eligibility rule: ${CANONICAL_ELIGIBILITY_RULE}`);
    console.error(`Skipped historical diagnostics: ${skippedSummary(result.skipped)}`);
    console.error('Run: node scripts/sitemap-policy-normalizer.js --write');
    process.exit(1);
  }
  console.log(`✅ Sitemap normalizer v${NORMALIZER_VERSION}: sitemap.xml contains every canonically eligible policy route`);
  console.log(`Sitemap normalizer eligibility: ${CANONICAL_ELIGIBILITY_RULE}`);
  console.log(`Sitemap normalizer skipped diagnostics: ${skippedSummary(result.skipped)}`);
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
  NORMALIZER_VERSION,
  CANONICAL_ELIGIBILITY_RULE,
  parseArgs,
  xmlEscape,
  manifestRouteMap,
  canonicalIncludedRoutes,
  parseExistingUrls,
  priorityFor,
  renderUrlBlock,
  normalizeSitemap,
  skippedSummary,
};
