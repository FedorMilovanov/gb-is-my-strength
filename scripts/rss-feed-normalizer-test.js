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
      publishedTime: '2026-07-20T12:00:00+03:00',
      modifiedTime: '2026-07-20T13:00:00+03:00',
    },
    {
      id: 'newer',
      type: 'article',
      url: '/articles/newer/',
      title: 'Новый <материал>',
      description: 'Описание ]]> с безопасным CDATA',
      section: 'Богословие',
      editor: 'Редактор',
      publishedTime: '2026-07-21T12:00:00+03:00',
      modifiedTime: '2026-07-22T12:00:00+03:00',
    },
    {
      id: 'excluded',
      type: 'landing',
      url: '/excluded/',
      title: 'Исключённый маршрут',
      description: 'Не должен попасть в RSS',
      section: 'Служебное',
      editor: 'Редактор',
      publishedTime: '2026-07-23T12:00:00+03:00',
    },
  ],
};

const entries = canonicalRssEntries({
  policyRegistry,
  manifest,
  productionRecords: records,
});
assert.deepEqual(entries.map((item) => item.route), ['/articles/newer/', '/articles/older/']);
assert.equal(entries[1].creator, 'Автор', 'author must take precedence over editor');

const rendered = renderFeed({
  policyRegistry,
  manifest,
  productionRecords: records,
});
const parsed = parseRss(rendered);
assert.equal(parsed.items.length, 2);
assert.equal(parsed.items[0].link, 'https://gospod-bog.ru/articles/newer/');
assert.equal(parsed.items[1].title, 'Старый & проверенный');
assert.ok(rendered.includes('Новый &lt;материал&gt;'));
assert.ok(rendered.includes(']]]]><![CDATA[>'));
assert.ok(!rendered.includes('/excluded/'));
assert.equal(rendered, renderFeed({ policyRegistry, manifest, productionRecords: records }), 'render must be deterministic');

assert.throws(
  () => manifestRouteMap({ items: [manifest.items[0], { ...manifest.items[0], id: 'duplicate' }] }),
  /duplicate search-manifest route/
);
assert.throws(
  () => canonicalRssEntries({
    policyRegistry,
    manifest: { ...manifest, items: manifest.items.filter((item) => item.id !== 'newer') },
    productionRecords: records,
  }),
  /RSS policy requires a search-manifest item/
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
  }),
  /non-production route/
);

console.log('✅ deterministic RSS normalizer contract');
