#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const {
  canonicalRssEntries,
  manifestRouteMap,
  renderFeed,
} = require('./rss-feed-normalizer');
const { parseRss } = require('./lib/rss-route-contract');

const records = [
  { route: '/articles/newer/', owner: { status: 'production-dist' } },
  { route: '/articles/older/', owner: { status: 'production-dist' } },
  { route: '/excluded/', owner: { status: 'production-dist' } },
];
const policyRegistry = {
  version: 1,
  routes: {
    '/articles/newer/': {
      rssPolicy: 'include',
      librarySection: 'Богословие',
    },
    '/articles/older/': {
      rssPolicy: 'include',
      librarySection: 'Переводы',
    },
    '/excluded/': {
      rssPolicy: 'exclude',
      librarySection: 'Служебное',
    },
  },
};
const manifest = {
  generatedAt: '2026-07-25T10:00:00Z',
  project: {
    name: 'Тестовая библиотека',
    url: 'https://gospod-bog.ru/',
    curator: 'Редактор',
  },
  items: [
    {
      id: 'older',
      type: 'article',
      url: '/articles/older/',
      title: 'Старый & проверенный',
      description: 'Описание старого материала',
      section: 'Переводы',
      author: 'Автор',
      editor: 'Редактор',
      // Intentionally newer than /newer/ here. RSS chronology must ignore
      // descriptive-manifest date drift and follow editorial-metadata.json.
      publishedTime: '2026-07-25T12:00:00+03:00',
      modifiedTime: '2026-07-25T13:00:00+03:00',
    },
    {
      id: 'newer',
      type: 'article',
      url: '/articles/newer/',
      title: 'Новый <материал>',
      description: 'Описание ]]> с безопасным CDATA',
      section: 'Богословие',
      editor: 'Редактор',
      publishedTime: '2026-07-18T12:00:00+03:00',
      modifiedTime: '2026-07-18T13:00:00+03:00',
    },
    {
      id: 'excluded',
      type: 'landing',
      url: '/excluded/',
      title: 'Исключённый маршрут',
      description: 'Не должен попасть в RSS',
      section: 'Служебное',
      editor: 'Редактор',
      publishedTime: '2026-07-26T12:00:00+03:00',
    },
  ],
};
const editorialRegistry = {
  version: 3,
  records: {
    '/articles/newer/': {
      editorialPublishedAt: '2026-07-24T12:00:00+03:00',
      editorialModifiedAt: '2026-07-24T13:00:00+03:00',
    },
    '/articles/older/': {
      editorialPublishedAt: '2026-07-19T12:00:00+03:00',
      editorialModifiedAt: '2026-07-20T13:00:00+03:00',
    },
    '/excluded/': {
      editorialPublishedAt: '2026-07-26T12:00:00+03:00',
      editorialModifiedAt: null,
    },
  },
};

const entries = canonicalRssEntries({
  policyRegistry,
  manifest,
  productionRecords: records,
  editorialRegistry,
});
assert.deepEqual(entries.map((item) => item.route), ['/articles/newer/', '/articles/older/']);
assert.equal(entries[0].published.toISOString(), '2026-07-24T09:00:00.000Z');
assert.equal(entries[1].published.toISOString(), '2026-07-19T09:00:00.000Z');
assert.equal(entries[1].creator, 'Автор', 'author must take precedence over editor');

const rendered = renderFeed({
  policyRegistry,
  manifest,
  productionRecords: records,
  editorialRegistry,
});
const parsed = parseRss(rendered);
assert.equal(parsed.items.length, 2);
assert.equal(parsed.items[0].link, 'https://gospod-bog.ru/articles/newer/');
assert.equal(parsed.items[0].pubDate, 'Fri, 24 Jul 2026 09:00:00 GMT');
assert.equal(parsed.items[1].pubDate, 'Sun, 19 Jul 2026 09:00:00 GMT');
assert.equal(parsed.items[1].title, 'Старый & проверенный');
assert.ok(rendered.includes('Новый &lt;материал&gt;'));
assert.ok(rendered.includes(']]]]><![CDATA[>'));
assert.ok(!rendered.includes('/excluded/'));
assert.ok(rendered.includes('<lastBuildDate>Sat, 25 Jul 2026 10:00:00 GMT</lastBuildDate>'));
assert.ok(!rendered.includes('<pubDate>Sat, 25 Jul 2026 09:00:00 GMT</pubDate>'), 'manifest chronology must not own RSS');
assert.equal(
  rendered,
  renderFeed({ policyRegistry, manifest, productionRecords: records, editorialRegistry }),
  'render must be deterministic'
);

assert.throws(
  () => manifestRouteMap({ items: [manifest.items[0], { ...manifest.items[0], id: 'duplicate' }] }),
  /duplicate search-manifest route/
);
assert.throws(
  () => canonicalRssEntries({
    policyRegistry,
    manifest: { ...manifest, items: manifest.items.filter((item) => item.id !== 'newer') },
    productionRecords: records,
    editorialRegistry,
  }),
  /RSS policy requires a search-manifest item/
);
assert.throws(
  () => canonicalRssEntries({
    policyRegistry,
    manifest,
    productionRecords: records,
    editorialRegistry: {
      ...editorialRegistry,
      records: { '/articles/older/': editorialRegistry.records['/articles/older/'] },
    },
  }),
  /RSS policy requires an editorial metadata record/
);
assert.throws(
  () => canonicalRssEntries({
    policyRegistry,
    manifest,
    productionRecords: records,
    editorialRegistry: {
      ...editorialRegistry,
      records: {
        ...editorialRegistry.records,
        '/articles/newer/': {
          ...editorialRegistry.records['/articles/newer/'],
          editorialPublishedAt: null,
        },
      },
    },
  }),
  /editorial metadata missing editorialPublishedAt/
);
assert.throws(
  () => canonicalRssEntries({
    policyRegistry: {
      version: 1,
      routes: { '/ghost/': { rssPolicy: 'include', librarySection: 'Тест' } },
    },
    manifest: {
      ...manifest,
      items: [{ ...manifest.items[0], url: '/ghost/' }],
    },
    productionRecords: records,
    editorialRegistry,
  }),
  /non-production route/
);
assert.throws(
  () => renderFeed({
    policyRegistry,
    manifest: { ...manifest, generatedAt: null },
    productionRecords: records,
    editorialRegistry,
  }),
  /search manifest generatedAt: invalid date/
);

console.log('✅ deterministic RSS normalizer uses canonical editorial date authority');
