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

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = String(html).match(new RegExp(`<meta\\b[^>]*\\bproperty=["']${escaped}["'][^>]*>`, 'i'))?.[0] || '';
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim() || null;
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
      '/approved/': { rssPolicy: 'include', librarySection: 'A' },
      '/blocked/': { rssPolicy: 'include', librarySection: 'B' },
    },
  };
  const syntheticManifest = {
    project: { curator: 'Редактор' },
    items: [
      { url: '/approved/', title: 'Approved', description: 'Approved', publishedTime: '2020-01-01T00:00:00Z' },
      { url: '/blocked/', title: 'Blocked', description: 'Blocked', publishedTime: '2030-01-01T00:00:00Z' },
    ],
  };
  const syntheticRecords = [
    { route: '/approved/', owner: { status: 'production-dist' } },
    { route: '/blocked/', owner: { status: 'production-dist' } },
  ];
  const syntheticEditorial = {
    version: 3,
    records: {
      '/approved/': {
        reviewStatus: 'approved',
        editorialPublishedAt: '2026-08-02T00:00:00Z',
        editorialModifiedAt: null,
      },
      '/blocked/': {
        reviewStatus: 'inconsistent-needs-review',
        editorialPublishedAt: '2010-01-01T00:00:00Z',
        editorialModifiedAt: null,
      },
    },
  };
  const entries = canonicalRssEntries({
    policyRegistry: syntheticPolicy,
    manifest: syntheticManifest,
    productionRecords: syntheticRecords,
    editorialRegistry: syntheticEditorial,
  });
  assert.deepEqual(entries.map((entry) => entry.route), ['/blocked/', '/approved/']);
  assert.equal(entries[0].published.toISOString(), '2030-01-01T00:00:00.000Z');
  assert.equal(entries[0].dateAuthority, 'search-manifest-descriptive');
  assert.equal(entries[1].published.toISOString(), '2026-08-02T00:00:00.000Z');
  assert.equal(entries[1].dateAuthority, 'editorial-metadata-approved');
}

function approvedRecords(registry) {
  return Object.fromEntries(
    Object.entries(registry?.records || {}).filter(([, record]) => record.reviewStatus === 'approved')
  );
}

function checkHtml(registry) {
  let matched = 0;
  for (const [route, record] of Object.entries(approvedRecords(registry))) {
    const clean = normalizeRoute(route).replace(/^\/+|\/+$/g, '');
    const file = path.join(DIST, clean, 'index.html');
    assert.ok(fs.existsSync(file), `${route}: approved dist HTML missing`);
    const html = read(file);
    matched += 1;
    assert.equal(
      normalizeDate(metaContent(html, 'article:published_time'), `${route} meta published`),
      normalizeDate(record.editorialPublishedAt, `${route} approved editorialPublishedAt`),
      `${route}: approved page metadata must come from editorial registry`
    );
    assert.equal(
      normalizeDate(metaContent(html, 'article:modified_time'), `${route} meta modified`),
      normalizeDate(record.editorialModifiedAt, `${route} approved editorialModifiedAt`),
      `${route}: approved modified metadata must come from editorial registry`
    );
  }
  return matched;
}

function checkSearchManifest(registry) {
  const file = path.join(DIST, 'data', 'search-manifest.json');
  assert.ok(fs.existsSync(file), `dist search manifest missing: ${file}`);
  const manifest = JSON.parse(read(file));
  let approvedMatched = 0;
  let blockedSeen = 0;
  for (const item of Array.isArray(manifest.items) ? manifest.items : []) {
    if (!item?.url || String(item.url).includes('#') || String(item.url).includes('?')) continue;
    const route = normalizeRoute(item.url);
    const record = registry.records[route];
    if (!record) continue;
    if (record.reviewStatus !== 'approved') {
      blockedSeen += 1;
      continue;
    }
    approvedMatched += 1;
    assert.equal(
      normalizeDate(item.publishedTime, `${route} search publishedTime`),
      normalizeDate(record.editorialPublishedAt, `${route} approved editorialPublishedAt`),
      `${route}: approved dist search publishedTime must come from editorial registry`
    );
    assert.equal(
      normalizeDate(item.modifiedTime, `${route} search modifiedTime`),
      normalizeDate(record.editorialModifiedAt, `${route} approved editorialModifiedAt`),
      `${route}: approved dist search modifiedTime must come from editorial registry`
    );
  }
  return { approvedMatched, blockedSeen, manifest };
}

function checkSitemaps(registry) {
  const files = fs.readdirSync(DIST).filter((name) => /^sitemap(?:-\d+)?\.xml$/iu.test(name)).sort();
  assert.ok(files.length > 0, 'dist sitemap missing');
  let approvedMatched = 0;
  for (const name of files) {
    const xml = read(path.join(DIST, name));
    for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/giu)) {
      const block = match[1];
      const loc = block.match(/<loc>([^<]+)<\/loc>/iu)?.[1]?.trim();
      if (!loc) continue;
      const route = normalizeRoute(loc);
      const record = registry.records[route];
      if (!record || record.reviewStatus !== 'approved') continue;
      approvedMatched += 1;
      const target = record.editorialModifiedAt || record.editorialPublishedAt;
      const actual = block.match(/<lastmod>([^<]+)<\/lastmod>/iu)?.[1]?.trim() || null;
      assert.equal(
        normalizeDate(actual, `${route} sitemap lastmod`),
        normalizeDate(target, `${route} approved editorial sitemap date`),
        `${route}: approved dist sitemap lastmod must come from editorial registry`
      );
    }
  }
  return approvedMatched;
}

function checkFeed(registry, manifest) {
  const file = path.join(DIST, 'feed.xml');
  assert.ok(fs.existsSync(file), `dist feed missing: ${file}`);
  const xml = read(file);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/giu)].map((match) => match[1]);
  assert.ok(items.length > 0, 'dist feed contains no items');
  const manifestByRoute = new Map(
    (Array.isArray(manifest.items) ? manifest.items : [])
      .filter((item) => item?.url && !String(item.url).includes('#') && !String(item.url).includes('?'))
      .map((item) => [normalizeRoute(item.url), item])
  );

  let approvedMatched = 0;
  let descriptiveMatched = 0;
  const projected = items.map((block) => {
    const link = block.match(/<link>([^<]+)<\/link>/iu)?.[1]?.trim();
    const pubDate = block.match(/<pubDate>([^<]+)<\/pubDate>/iu)?.[1]?.trim();
    assert.ok(link, 'RSS item missing link');
    assert.ok(pubDate, `${link}: RSS item missing pubDate`);
    const route = normalizeRoute(link);
    const record = registry.records[route] || null;
    const manifestItem = manifestByRoute.get(route);
    assert.ok(manifestItem, `${route}: RSS item missing descriptive search-manifest record`);

    const actual = normalizeDate(pubDate, `${route} RSS pubDate`);
    if (record?.reviewStatus === 'approved') {
      approvedMatched += 1;
      assert.equal(
        actual,
        normalizeDate(record.editorialPublishedAt, `${route} approved editorialPublishedAt`),
        `${route}: approved RSS pubDate must come from editorial registry`
      );
    } else {
      descriptiveMatched += 1;
      assert.equal(
        actual,
        normalizeDate(manifestItem.publishedTime, `${route} descriptive publishedTime`),
        `${route}: blocked/unowned RSS chronology must remain descriptive until approval`
      );
      if (record?.editorialPublishedAt) {
        const frozen = normalizeDate(record.editorialPublishedAt, `${route} frozen editorialPublishedAt`);
        const descriptive = normalizeDate(manifestItem.publishedTime, `${route} descriptive publishedTime`);
        if (frozen !== descriptive) {
          assert.notEqual(actual, frozen, `${route}: frozen editorial decision was promoted without approval`);
        }
      }
    }
    return { route, timestamp: Date.parse(actual) };
  });

  for (let index = 1; index < projected.length; index += 1) {
    const previous = projected[index - 1];
    const current = projected[index];
    assert.ok(
      previous.timestamp > current.timestamp ||
        (previous.timestamp === current.timestamp && previous.route.localeCompare(current.route, 'ru') <= 0),
      `RSS order is not descending by effective public chronology at ${previous.route} -> ${current.route}`
    );
  }
  return { items: projected.length, approvedMatched, descriptiveMatched };
}

function main() {
  checkSourceAuthorities();
  if (!REQUIRE_DIST) {
    console.log('✅ Metadata SSOT source authority and approval-gate contract');
    return;
  }
  assert.ok(fs.existsSync(DIST), 'dist is required for --dist');
  const registry = readRegistry();
  const htmlMatched = checkHtml(registry);
  const search = checkSearchManifest(registry);
  const sitemapMatched = checkSitemaps(registry);
  const rss = checkFeed(registry, search.manifest);
  console.log(
    `✅ Metadata SSOT dist contract: approved html=${htmlMatched}, search=${search.approvedMatched}, sitemap=${sitemapMatched}, rss-approved=${rss.approvedMatched}, rss-descriptive=${rss.descriptiveMatched}, blocked-search=${search.blockedSeen}, rss-items=${rss.items}`
  );
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
