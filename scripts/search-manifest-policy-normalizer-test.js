#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildManifestItem,
  manifestMaxModifiedAt,
  refreshGeneratedAt,
  seriesReadingTimes,
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
<meta name="author" content="Автор, не редактор">
<meta property="article:section" content="Тематический раздел">
<meta property="article:published_time" content="2026-07-20T00:00:00+03:00">
<meta property="article:modified_time" content="2026-07-21T00:00:00+03:00">
<meta property="article:tag" content="сердце">
<meta property="article:tag" content="богословие">
<meta property="og:image" content="https://gospod-bog.ru/images/fixture.webp">
<script>window.SITE_CONFIG={page:{readingTime: 17}}</script>
</head><body></body></html>`;
const htmlWithoutRuntimeReadTime = html.replace('<script>window.SITE_CONFIG={page:{readingTime: 17}}</script>', '');

const staleGeneratedAtManifest = {
  generatedAt: '2026-07-29T00:12:25Z',
  items: [
    { modifiedTime: '2026-07-20T00:00:00+03:00' },
    { modifiedTime: '2026-07-30T00:00:00+03:00' },
    { modifiedTime: 'not-a-date' },
  ],
};
assert.equal(manifestMaxModifiedAt(staleGeneratedAtManifest), '2026-07-29T21:00:00Z');
assert.equal(refreshGeneratedAt(staleGeneratedAtManifest), true);
assert.equal(staleGeneratedAtManifest.generatedAt, '2026-07-29T21:00:00Z');
assert.equal(refreshGeneratedAt(staleGeneratedAtManifest), false);
const newerGeneratedAtManifest = {
  generatedAt: '2026-07-30T01:00:00Z',
  items: [{ modifiedTime: '2026-07-30T00:00:00+03:00' }],
};
assert.equal(refreshGeneratedAt(newerGeneratedAtManifest), false);
assert.equal(newerGeneratedAtManifest.generatedAt, '2026-07-30T01:00:00Z');
assert.equal(manifestMaxModifiedAt({ items: [] }), null);
assert.equal(refreshGeneratedAt({ items: [] }), false);

const item = buildManifestItem(route, policy, html);
assert.equal(item.id, 'fixture');
assert.equal(item.type, 'article');
assert.equal(item.title, 'Нативный заголовок');
assert.equal(item.description, 'Нативное описание');
assert.equal(item.section, 'Богословие');
assert.equal(item.image, '/images/fixture.webp');
assert.deepEqual(item.tags, ['сердце', 'богословие']);
assert.equal(item.readTime, 17);
assert.equal(buildManifestItem(route, policy, html, 23).readTime, 23);
assert.equal(buildManifestItem(route, policy, htmlWithoutRuntimeReadTime, 23).readTime, 23);

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

const existingPolicy = { ...policy, searchManifestPolicy: 'include' };
const existingRegistry = { version: 1, routes: { [route]: existingPolicy } };
const existingManifest = {
  version: 1,
  generatedAt: '2026-01-01T00:00:00Z',
  items: [{
    id: 'fixture',
    type: 'article',
    url: route,
    title: 'Старый заголовок',
    description: 'Старое описание',
    section: 'Старый раздел',
    editor: 'Старый редактор',
    tags: ['редакционный-тег'],
    publishedTime: '2025-01-01T00:00:00+03:00',
    modifiedTime: '2025-01-02T00:00:00+03:00',
    readTime: 99,
    featured: true,
    priority: 88,
    scripture: 'Ин 3:16',
    seriesId: 'manual-series',
    seriesPosition: 7,
    author: 'Редакционный автор',
    wordCount: 4321,
    customFuture: { keep: true },
  }],
};
const existingResult = applyMigration({
  policyRegistry: existingRegistry,
  manifest: existingManifest,
  seriesData: {},
  productionRecords: records,
  distRoot: root,
  promoteRssArticles: false,
});
assert.deepEqual(existingResult.seeded, []);
assert.deepEqual(existingResult.promoted, []);
assert.deepEqual(existingResult.added, []);
assert.equal(existingResult.reconciled.length, 1);
assert.equal(existingResult.reconciled[0].route, route);
assert.deepEqual(
  existingResult.reconciled[0].fields.map((entry) => entry.field).sort(),
  ['description', 'image', 'readTime', 'section', 'title'].sort()
);
const existingKinds = Object.fromEntries(existingResult.reconciled[0].fields.map((entry) => [entry.field, entry.kind]));
assert.equal(existingKinds.image, 'missing');
for (const field of ['description', 'readTime', 'section', 'title']) {
  assert.equal(existingKinds[field], 'mismatch');
}
const reconciledItem = existingManifest.items[0];
assert.equal(reconciledItem.title, 'Нативный заголовок');
assert.equal(reconciledItem.description, 'Нативное описание');
assert.equal(reconciledItem.section, 'Богословие');
assert.equal(reconciledItem.image, '/images/fixture.webp');
assert.equal(reconciledItem.readTime, 17);
assert.equal(reconciledItem.editor, 'Старый редактор');
assert.deepEqual(reconciledItem.tags, ['редакционный-тег']);
assert.equal(reconciledItem.publishedTime, '2025-01-01T00:00:00+03:00');
assert.equal(reconciledItem.modifiedTime, '2025-01-02T00:00:00+03:00');
assert.equal(reconciledItem.featured, true);
assert.equal(reconciledItem.priority, 88);
assert.equal(reconciledItem.scripture, 'Ин 3:16');
assert.equal(reconciledItem.seriesId, 'manual-series');
assert.equal(reconciledItem.seriesPosition, 7);
assert.equal(reconciledItem.author, 'Редакционный автор');
assert.equal(reconciledItem.wordCount, 4321);
assert.deepEqual(reconciledItem.customFuture, { keep: true });
assert.equal(refreshGeneratedAt(existingManifest), false);
assert.equal(existingManifest.generatedAt, '2026-01-01T00:00:00Z');
const existingSecond = applyMigration({
  policyRegistry: existingRegistry,
  manifest: existingManifest,
  seriesData: {},
  productionRecords: records,
  distRoot: root,
  promoteRssArticles: false,
});
assert.deepEqual(existingSecond.reconciled, []);
assert.equal(refreshGeneratedAt(existingManifest), false);

const landingRoute = '/';
const landingPolicy = {
  ...policy,
  searchManifestPolicy: 'include',
  rssPolicy: 'exclude',
  contentKind: 'landing',
  librarySection: 'Главная',
  topicCategory: 'Библиотека',
};
const landingHtml = `<!doctype html><html><head>
<title>Главная | Господь Бог — Сила Моя</title>
<meta property="og:title" content="Новая главная">
<meta name="description" content="Новое публичное описание">
<meta name="author" content="Автор страницы">
<meta property="article:section" content="SEO-раздел">
<meta property="og:image" content="https://gospod-bog.ru/images/new-home.webp">
</head><body></body></html>`;
fs.writeFileSync(path.join(root, 'index.html'), landingHtml);
const landingManifest = {
  version: 1,
  items: [{
    id: 'home',
    type: 'landing',
    url: landingRoute,
    title: 'Старая главная',
    description: 'Старое публичное описание',
    section: 'Старый раздел',
    editor: 'Ручной редактор',
    image: '/images/old-home.webp',
    tags: ['manual-landing-tag'],
    publishedTime: '2026-06-18T00:00:00+03:00',
    modifiedTime: '2026-06-18T21:00:00+03:00',
    readTime: 2,
    featured: true,
  }],
};
const landingResult = applyMigration({
  policyRegistry: { version: 1, routes: { [landingRoute]: landingPolicy } },
  manifest: landingManifest,
  seriesData: {},
  productionRecords: [{ route: landingRoute, owner: { status: 'production-dist' } }],
  distRoot: root,
  promoteRssArticles: false,
});
assert.deepEqual(
  landingResult.reconciled[0].fields.map((entry) => entry.field).sort(),
  ['description', 'image', 'section', 'title'].sort()
);
const landingItem = landingManifest.items[0];
assert.equal(landingItem.title, 'Новая главная');
assert.equal(landingItem.description, 'Новое публичное описание');
assert.equal(landingItem.section, 'Главная');
assert.equal(landingItem.image, '/images/new-home.webp');
assert.equal(landingItem.editor, 'Ручной редактор');
assert.deepEqual(landingItem.tags, ['manual-landing-tag']);
assert.equal(landingItem.publishedTime, '2026-06-18T00:00:00+03:00');
assert.equal(landingItem.modifiedTime, '2026-06-18T21:00:00+03:00');
assert.equal(landingItem.readTime, 2);
assert.equal(landingItem.featured, true);

const seriesData = {
  'fixture-series': {
    baseUrl: '/hard-texts/',
    searchPolicy: {
      landingRoute: '/hard-texts/fixture-series/',
      librarySection: 'Богословие',
      topicCategory: 'Тестовая серия',
    },
    parts: [
      { slug: 'fixture-part', status: 'published', readingTime: 31 },
      { slug: 'planned-part', status: 'draft', readingTime: 12 },
    ],
  },
};
assert.deepEqual(
  seriesPolicySeeds(seriesData).map((seed) => seed.route),
  ['/hard-texts/fixture-part/', '/hard-texts/fixture-series/']
);
assert.equal(seriesReadingTimes(seriesData).get('/hard-texts/fixture-part/'), 31);
assert.equal(seriesReadingTimes(seriesData).has('/hard-texts/planned-part/'), false);

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
assert.equal(seriesManifest.items[0].readTime, 31);

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
  /missing description/
);
assert.throws(
  () => buildManifestItem(route, policy, '<html><head><title>Broken</title><meta name="description" content="Есть описание"></head></html>'),
  /missing publishedTime, modifiedTime, readTime/
);
assert.throws(
  () => seriesPolicySeeds({ broken: { searchPolicy: {}, baseUrl: '/', parts: [] } }),
  /searchPolicy.librarySection/
);
assert.throws(
  () => seriesReadingTimes({ broken: { baseUrl: '/', parts: [{ slug: 'part', status: 'published' }] } }),
  /missing positive readingTime/
);

fs.rmSync(root, { recursive: true, force: true });
console.log('✅ search manifest policy normalizer');
