#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { readRegistry } = require('./lib/editorial-metadata');
const { normalizeRoute } = require('./lib/rss-route-contract');
const { canonicalRssEntries } = require('./rss-feed-normalizer');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const REQUIRE_DIST = process.argv.includes('--dist');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function normalizeDate(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  assert.ok(!Number.isNaN(date.getTime()), `${label}: invalid date ${JSON.stringify(value)}`);
  return date.toISOString();
}

function checkSourceAuthorities() {
  const header = read(path.join(ROOT, 'src', 'components', 'ui', 'Header.astro'));
  assert.match(header, /import\s*\{[^}]*SECTION_META[^}]*\}\s*from\s*['"]@\/data\/site['"]/u);
  assert.match(header, /SECTION_META\[['"]hard-texts['"]\]\.label/u);
  assert.doesNotMatch(header, />\s*Разбор заблуждений\s*</u, 'hard-texts nav label must not be a second literal authority');

  const siteData = read(path.join(ROOT, 'src', 'data', 'site.ts'));
  assert.match(siteData, /['"]hard-texts['"]\s*:\s*\{[\s\S]*?label:\s*['"]Трудные тексты['"]/u);

  const syntheticPolicy = {
    version: 1,
    routes: {
      '/new/': { rssPolicy: 'include', librarySection: 'A' },
      '/old/': { rssPolicy: 'include', librarySection: 'B' },
    },
  };
  const syntheticManifest = {
    project: { curator: 'Редактор' },
    items: [
      { url: '/new/', title: 'New', description: 'New', publishedTime: '2020-01-01T00:00:00Z' },
      { url: '/old/', title: 'Old', description: 'Old', publishedTime: '2030-01-01T00:00:00Z' },
    ],
  };
  const syntheticRecords = [
    { route: '/new/', owner: { status: 'production-dist' } },
    { route: '/old/', owner: { status: 'production-dist' } },
  ];
  const syntheticEditorial = {
    version: 3,
    records: {
      '/new/': { editorialPublishedAt: '2026-08-02T00:00:00Z', editorialModifiedAt: null },
      '/old/': { editorialPublishedAt: '2026-08-01T00:00:00Z', editorialModifiedAt: null },
    },
  };
  const entries = canonicalRssEntries({
    policyRegistry: syntheticPolicy,
    manifest: syntheticManifest,
    productionRecords: syntheticRecords,
    editorialRegistry: syntheticEditorial,
  });
  assert.deepEqual(entries.map((entry) => entry.route), ['/new/', '/old/']);
  assert.equal(entries[0].published.toISOString(), '2026-08-02T00:00:00.000Z');
  assert.equal(entries[1].published.toISOString(), '2026-08-01T00:00:00.000Z');
}

function checkSearchManifest(registry) {
  const file = path.join(DIST, 'data', 'search-manifest.json');
  assert.ok(fs.existsSync(file), `dist search manifest missing: ${file}`);
  const manifest = JSON.parse(read(file));
  let matched = 0;
  for (const item of Array.isArray(manifest.items) ? manifest.items : []) {
    if (!item?.url || String(item.url).includes('#') || String(item.url).includes('?')) continue;
    const route = normalizeRoute(item.url);
    const record = registry.records[route];
    if (!record) continue;
    matched += 1;
    assert.equal(
      normalizeDate(item.publishedTime, `${route} search publishedTime`),
      normalizeDate(record.editorialPublishedAt, `${route} editorialPublishedAt`),
      `${route}: dist search publishedTime must come from editorial registry`
    );
    assert.equal(
      normalizeDate(item.modifiedTime, `${route} search modifiedTime`),
      normalizeDate(record.editorialModifiedAt, `${route} editorialModifiedAt`),
      `${route}: dist search modifiedTime must come from editorial registry`
    );
  }
  assert.ok(matched > 0, 'dist search manifest matched no editorial records');
  return matched;
}

function checkSitemaps(registry) {
  const files = fs.readdirSync(DIST).filter((name) => /^sitemap(?:-\d+)?\.xml$/iu.test(name)).sort();
  assert.ok(files.length > 0, 'dist sitemap missing');
  let matched = 0;
  for (const name of files) {
    const xml = read(path.join(DIST, name));
    for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/giu)) {
      const block = match[1];
      const loc = block.match(/<loc>([^<]+)<\/loc>/iu)?.[1]?.trim();
      if (!loc) continue;
      const route = normalizeRoute(loc);
      const record = registry.records[route];
      if (!record) continue;
      matched += 1;
      const target = record.editorialModifiedAt || record.editorialPublishedAt;
      const actual = block.match(/<lastmod>([^<]+)<\/lastmod>/iu)?.[1]?.trim() || null;
      assert.equal(
        normalizeDate(actual, `${route} sitemap lastmod`),
        normalizeDate(target, `${route} editorial sitemap date`),
        `${route}: dist sitemap lastmod must come from editorial registry`
      );
    }
  }
  assert.ok(matched > 0, 'dist sitemaps matched no editorial records');
  return matched;
}

function checkFeed(registry) {
  const file = path.join(DIST, 'feed.xml');
  assert.ok(fs.existsSync(file), `dist feed missing: ${file}`);
  const xml = read(file);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/giu)].map((match) => match[1]);
  assert.ok(items.length > 0, 'dist feed contains no items');

  const projected = items.map((block) => {
    const link = block.match(/<link>([^<]+)<\/link>/iu)?.[1]?.trim();
    const pubDate = block.match(/<pubDate>([^<]+)<\/pubDate>/iu)?.[1]?.trim();
    assert.ok(link, 'RSS item missing link');
    const route = normalizeRoute(link);
    const record = registry.records[route];
    assert.ok(record, `${route}: RSS item missing editorial registry record`);
    assert.ok(record.editorialPublishedAt, `${route}: RSS item missing canonical editorialPublishedAt`);
    assert.equal(
      normalizeDate(pubDate, `${route} RSS pubDate`),
      normalizeDate(record.editorialPublishedAt, `${route} editorialPublishedAt`),
      `${route}: RSS pubDate must come from editorial registry`
    );
    return { route, published: Date.parse(record.editorialPublishedAt) };
  });

  for (let index = 1; index < projected.length; index += 1) {
    const previous = projected[index - 1];
    const current = projected[index];
    assert.ok(
      previous.published > current.published ||
        (previous.published === current.published && previous.route.localeCompare(current.route, 'ru') <= 0),
      `RSS order is not canonical at ${previous.route} -> ${current.route}`
    );
  }
  return projected.length;
}

function main() {
  checkSourceAuthorities();
  if (!REQUIRE_DIST) {
    console.log('✅ Metadata SSOT source authority contract');
    return;
  }
  assert.ok(fs.existsSync(DIST), 'dist is required for --dist');
  const registry = readRegistry();
  const searchMatched = checkSearchManifest(registry);
  const sitemapMatched = checkSitemaps(registry);
  const rssMatched = checkFeed(registry);
  console.log(`✅ Metadata SSOT dist parity: search=${searchMatched}, sitemap=${sitemapMatched}, rss=${rssMatched}`);
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
