#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyLandingDiscovery } from './series-landing-discovery-seed.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'series-landing-discovery-'));
const route = '/series-fixture/';
const file = path.join(root, 'series-fixture', 'index.html');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, `<!doctype html><html><head>
<title>Fallback | Господь Бог — Сила Моя</title>
<meta property="og:title" content="Тестовая серия">
<meta name="description" content="Описание тестовой серии для проверки детерминированного discovery seed.">
<meta property="og:image" content="https://gospod-bog.ru/images/fixture.webp">
</head><body><span data-pagefind-meta="readTime" hidden>42</span></body></html>`);

const seriesData = {
  fixture: {
    title: 'Тестовая серия',
    searchPolicy: {
      landingRoute: route,
      librarySection: 'Богословие',
      topicCategory: 'Тест',
      includeLandingInManifest: true,
      landingPublishedTime: '2026-09-10T00:00:00+03:00',
      landingModifiedTime: '2026-09-10T00:00:00+03:00',
    },
  },
  legacy: {
    title: 'Старая серия',
    searchPolicy: { landingRoute: '/legacy/', librarySection: 'Служение', topicCategory: 'Legacy' },
  },
};
const policyRegistry = { version: 1, reviewedAt: '2026-09-08', routes: {} };
const manifest = { version: 1, generatedAt: '2026-09-08T00:00:00Z', items: [] };
const ownership = { routes: { [route]: { owner: 'astro', status: 'production-dist' } } };

const first = applyLandingDiscovery({ seriesData, policyRegistry, manifest, ownership, distRoot: root });
assert.deepEqual(first, [`policy:${route}`, `manifest:${route}`]);
assert.deepEqual(policyRegistry.routes[route], {
  indexPolicy: 'index', pagefindPolicy: 'include', searchManifestPolicy: 'include', sitemapPolicy: 'include', rssPolicy: 'exclude',
  contentKind: 'landing', librarySection: 'Богословие', topicCategory: 'Тест',
});
assert.equal(policyRegistry.reviewedAt, '2026-09-10');
assert.equal(manifest.items.length, 1);
assert.equal(manifest.items[0].id, 'series-fixture');
assert.equal(manifest.items[0].type, 'series');
assert.equal(manifest.items[0].readTime, 42);
assert.equal(manifest.items[0].image, '/images/fixture.webp');
assert.equal(manifest.items[0].publishedTime, '2026-09-10T00:00:00+03:00');
assert.equal(manifest.items[0].modifiedTime, '2026-09-10T00:00:00+03:00');
assert.equal(manifest.items.some((item) => item.url === '/legacy/'), false);

const second = applyLandingDiscovery({ seriesData, policyRegistry, manifest, ownership, distRoot: root });
assert.deepEqual(second, []);

assert.throws(() => applyLandingDiscovery({
  seriesData,
  policyRegistry: { version: 1, routes: {} },
  manifest: { version: 1, items: [] },
  ownership: { routes: {} },
  distRoot: root,
}), /not production-dist/);

const badDates = structuredClone(seriesData);
badDates.fixture.searchPolicy.landingModifiedTime = '2026-09-09T00:00:00+03:00';
assert.throws(() => applyLandingDiscovery({
  seriesData: badDates,
  policyRegistry: { version: 1, routes: {} },
  manifest: { version: 1, items: [] },
  ownership,
  distRoot: root,
}), /precedes landingPublishedTime/);

fs.rmSync(root, { recursive: true, force: true });
console.log('✅ series landing discovery seed contract');
