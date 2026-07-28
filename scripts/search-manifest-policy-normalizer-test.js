#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildManifestItem,
  seriesPolicySeeds,
  migrationCandidates,
  applyMigration,
} = require('./search-manifest-policy-normalizer');

const route = '/articles/fixture/';
const policy = {
  indexPolicy: 'index',
  pagefindPolicy: 'include',
  searchManifestPolicy: 'exclude',
  sitemapPolicy: 'include',
  rssPolicy: 'include',
  contentKind: 'series-article',
  librarySection: 'Богословие',
  topicCategory: 'Тест',
};
const html = `<!doctype html><html><head>
<title>Fallback | Господь Бог — Сила Моя</title>
<meta property="og:title" content="Нативный заголовок">
<meta name="description" content="Нативное описание">
<meta name="author" content="Фёдор Милованов">
<meta property="article:section" content="Богословие">
<meta property="article:published_time" content="2026-07-20T00:00:00+03:00">
<meta property="article:modified_time" content="2026-07-21T00:00:00+03:00">
<meta property="article:tag" content="сердце">
<meta property="article:tag" content="богословие">
<meta property="og:image" content="https://gospod-bog.ru/images/fixture.webp">
<script>window.SITE_CONFIG={page:{readingTime: 17}}</script>
</head><body></body></html>`;

const item = buildManifestItem(route, policy, html);
assert.equal(item.id, 'fixture');
assert.equal(item.type, 'article');
assert.equal(item.title, 'Нативный заголовок');
assert.equal(item.description, 'Нативное описание');
assert.equal(item.image, '/images/fixture.webp');
assert.deepEqual(item.tags, ['сердце', 'богословие']);
assert.equal(item.readTime, 17);

const registry = { version: 1, routes: { [route]: { ...policy } } };
const manifest = { version: 1, items: [] };
const records = [{ route, owner: { status: 'production-dist' } }];
assert.equal(migrationCandidates({
  policyRegistry: registry,
  manifest,
  productionRecords: records,
  promoteRssArticles: false,
}).length, 0);
assert.equal(migrationCandidates({
  policyRegistry: registry,
  manifest,
  productionRecords: records,
  promoteRssArticles: true,
}).length, 1);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'search-manifest-normalizer-'));
const htmlFile = path.join(root, 'articles/fixture/index.html');
fs.mkdirSync(path.dirname(htmlFile), { recursive: true });
fs.writeFileSync(htmlFile, html);
const result = applyMigration({
  policyRegistry: registry,
  manifest,
  productionRecords: records,
  distRoot: root,
  promoteRssArticles: true,
});
assert.deepEqual(result.seeded, []);
assert.deepEqual(result.promoted, [route]);
assert.deepEqual(result.added, [route]);
assert.equal(registry.routes[route].searchManifestPolicy, 'include');
assert.equal(manifest.items.length, 1);

const second = applyMigration({
  policyRegistry: registry,
  manifest,
  productionRecords: records,
  distRoot: root,
  promoteRssArticles: true,
});
assert.deepEqual(second.seeded, []);
assert.deepEqual(second.promoted, []);
assert.deepEqual(second.added, []);

const seriesData = {
  'fixture-series': {
    baseUrl: '/hard-texts/',
    searchPolicy: {
      landingRoute: '/hard-texts/fixture-series/',
      librarySection: 'Богословие',
      topicCategory: 'Тестовая серия',
    },
    parts: [
      { slug: 'fixture-part', status: 'published' },
      { slug: 'planned-part', status: 'draft' },
    ],
  },
};
assert.deepEqual(
  seriesPolicySeeds(seriesData).map((seed) => seed.route),
  ['/hard-texts/fixture-part/', '/hard-texts/fixture-series/']
);

const seriesRegistry = { version: 1, routes: {} };
const seriesManifest = { version: 1, items: [] };
const seriesRecords = [
  { route: '/hard-texts/fixture-series/', owner: { status: 'production-dist' } },
  { route: '/hard-texts/fixture-part/', owner: { status: 'production-dist' } },
];
const seriesHtmlFile = path.join(root, 'hard-texts/fixture-part/index.html');
fs.mkdirSync(path.dirname(seriesHtmlFile), { recursive: true });
fs.writeFileSync(seriesHtmlFile, html);
const seriesResult = applyMigration({
  policyRegistry: seriesRegistry,
  manifest: seriesManifest,
  seriesData,
  productionRecords: seriesRecords,
  distRoot: root,
  promoteRssArticles: true,
});
assert.deepEqual(seriesResult.seeded, ['/hard-texts/fixture-part/', '/hard-texts/fixture-series/']);
assert.deepEqual(seriesResult.promoted, ['/hard-texts/fixture-part/']);
assert.deepEqual(seriesResult.added, ['/hard-texts/fixture-part/']);
assert.equal(seriesRegistry.routes['/hard-texts/fixture-series/'].searchManifestPolicy, 'exclude');
assert.equal(seriesRegistry.routes['/hard-texts/fixture-series/'].rssPolicy, 'exclude');
assert.equal(seriesRegistry.routes['/hard-texts/fixture-part/'].searchManifestPolicy, 'include');
assert.equal(seriesManifest.items.length, 1);

const seriesSecond = applyMigration({
  policyRegistry: seriesRegistry,
  manifest: seriesManifest,
  seriesData,
  productionRecords: seriesRecords,
  distRoot: root,
  promoteRssArticles: true,
});
assert.deepEqual(seriesSecond.seeded, []);
assert.deepEqual(seriesSecond.promoted, []);
assert.deepEqual(seriesSecond.added, []);

assert.throws(
  () => buildManifestItem(route, policy, '<html><head><title>Broken</title></head></html>'),
  /missing description, publishedTime, modifiedTime, readTime/
);
assert.throws(
  () => seriesPolicySeeds({ broken: { searchPolicy: {}, baseUrl: '/', parts: [] } }),
  /searchPolicy.librarySection/
);

fs.rmSync(root, { recursive: true, force: true });
console.log('✅ search manifest policy normalizer');
