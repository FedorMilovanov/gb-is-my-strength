#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildManifestItem,
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
assert.deepEqual(second.promoted, []);
assert.deepEqual(second.added, []);

assert.throws(
  () => buildManifestItem(route, policy, '<html><head><title>Broken</title></head></html>'),
  /missing description, publishedTime, modifiedTime, readTime/
);

fs.rmSync(root, { recursive: true, force: true });
console.log('✅ search manifest policy normalizer');
