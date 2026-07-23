#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadRouteRecords } = require('./lib/effective-route-registry');
const { normalizeRoute } = require('./lib/rss-route-contract');
const { normalizePolicyRoutes } = require('./lib/search-index-policy-contract');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SITE_URL = 'https://gospod-bog.ru';
const CHANNEL_DESCRIPTION = 'Богословские разборы, переводы и исследования Писания на русском языке.';

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

function cdata(value) {
  return String(value ?? '').replace(/]]>/g, ']]]]><![CDATA[>');
}

function parseDate(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`${label}: invalid date ${JSON.stringify(value)}`);
  return date;
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

function canonicalRssEntries({ policyRegistry, manifest, productionRecords }) {
  const policies = normalizePolicyRoutes(policyRegistry);
  const manifestRoutes = manifestRouteMap(manifest);
  const productionRoutes = new Set(
    (productionRecords || [])
      .filter((record) => record?.owner?.status === 'production-dist')
      .map((record) => normalizeRoute(record.route))
  );
  const entries = [];

  for (const [route, policy] of policies) {
    if (policy?.rssPolicy !== 'include') continue;
    if (!productionRoutes.has(route)) throw new Error(`${route}: RSS policy includes a non-production route`);
    const item = manifestRoutes.get(route);
    if (!item) throw new Error(`${route}: RSS policy requires a search-manifest item`);

    const missing = ['title', 'description', 'publishedTime'].filter((field) => !item[field]);
    if (missing.length) throw new Error(`${route}: search-manifest item missing ${missing.join(', ')}`);
    const published = parseDate(item.publishedTime, `${route} publishedTime`);
    const modified = parseDate(item.modifiedTime || item.publishedTime, `${route} modifiedTime`);
    const creator = String(item.author || item.editor || manifest?.project?.curator || '').trim();
    if (!creator) throw new Error(`${route}: search-manifest item missing author/editor`);

    entries.push({
      route,
      title: String(item.title).trim(),
      description: String(item.description).trim(),
      creator,
      category: String(item.section || policy.librarySection || '').trim(),
      published,
      modified,
    });
  }

  entries.sort((left, right) => {
    const byDate = right.published.getTime() - left.published.getTime();
    return byDate || left.route.localeCompare(right.route, 'ru');
  });
  if (!entries.length) throw new Error('RSS policy produced no entries');
  return entries;
}

function renderFeed({ policyRegistry, manifest, productionRecords, siteUrl }) {
  const base = String(siteUrl || manifest?.project?.url || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const entries = canonicalRssEntries({ policyRegistry, manifest, productionRecords });
  const lastBuildDate = entries.reduce(
    (latest, item) => Math.max(latest, item.published.getTime(), item.modified.getTime()),
    Number.NEGATIVE_INFINITY
  );
  const title = manifest?.project?.name || 'Господь Бог — Сила Моя';
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"',
    '  xmlns:atom="http://www.w3.org/2005/Atom"',
    '  xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '',
    '  <channel>',
    `    <title>${xmlEscape(title)}</title>`,
    `    <link>${xmlEscape(base + '/')}</link>`,
    `    <description><![CDATA[${cdata(CHANNEL_DESCRIPTION)}]]></description>`,
    '    <language>ru</language>',
    `    <lastBuildDate>${new Date(lastBuildDate).toUTCString()}</lastBuildDate>`,
    '    <ttl>1440</ttl>',
    '    <image>',
    `      <url>${xmlEscape(base + '/images/og-preview-1200x630.webp')}</url>`,
    `      <title>${xmlEscape(title)}</title>`,
    `      <link>${xmlEscape(base + '/')}</link>`,
    '    </image>',
    `    <atom:link href="${xmlEscape(base + '/feed.xml')}" rel="self" type="application/rss+xml"/>`,
  ];

  for (const item of entries) {
    const url = base + item.route;
    lines.push('', '    <item>');
    lines.push(`      <title>${xmlEscape(item.title)}</title>`);
    lines.push(`      <link>${xmlEscape(url)}</link>`);
    lines.push(`      <guid isPermaLink="true">${xmlEscape(url)}</guid>`);
    lines.push(`      <pubDate>${item.published.toUTCString()}</pubDate>`);
    lines.push(`      <dc:creator>${xmlEscape(item.creator)}</dc:creator>`);
    if (item.category) lines.push(`      <category>${xmlEscape(item.category)}</category>`);
    lines.push(`      <description><![CDATA[${cdata(item.description)}]]></description>`);
    lines.push('    </item>');
  }

  lines.push('', '  </channel>', '</rss>', '');
  return lines.join('\n');
}

function main() {
  const options = parseArgs();
  const policyFile = path.join(ROOT, 'data/route-search-policy.json');
  const manifestFile = path.join(ROOT, 'data/search-manifest.json');
  const feedFile = path.join(ROOT, 'feed.xml');
  const loaded = loadRouteRecords();
  const expected = renderFeed({
    policyRegistry: readJson(policyFile),
    manifest: readJson(manifestFile),
    productionRecords: loaded.records,
  });
  const current = fs.existsSync(feedFile) ? fs.readFileSync(feedFile, 'utf8') : '';

  if (options.write) {
    if (current === expected) {
      console.log('RSS feed already matches route policy and search manifest.');
      return;
    }
    fs.writeFileSync(feedFile, expected, 'utf8');
    console.log('Wrote deterministic feed.xml from route policy and search manifest.');
    return;
  }

  if (current !== expected) {
    console.error('❌ feed.xml differs from the deterministic policy/manifest projection');
    console.error('Run: node scripts/rss-feed-normalizer.js --write');
    process.exit(1);
  }
  console.log('✅ feed.xml exactly matches route policy and search manifest');
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
  CHANNEL_DESCRIPTION,
  parseArgs,
  xmlEscape,
  cdata,
  parseDate,
  manifestRouteMap,
  canonicalRssEntries,
  renderFeed,
};
