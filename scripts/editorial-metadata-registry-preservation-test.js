#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeObservedRecord, observeRoute } = require('./lib/editorial-metadata');

const previous = Object.freeze({
  route: '/articles/example/',
  canonical: 'https://gospod-bog.ru/articles/old/',
  title: 'Editorial title',
  metadataSource: 'old-source.astro',
  contentType: 'article',
  editorialPublishedAt: '2026-07-14T18:00:00.000Z',
  editorialModifiedAt: '2026-07-10T21:00:00.000Z',
  originalWorkPublishedAt: '1700-01-01T00:00:00.000Z',
  reviewStatus: 'inconsistent-needs-review',
  provenance: 'production-like-dist-migration-freeze',
  observations: Object.freeze({ rssPublishedAt: 'old' }),
});
const observed = Object.freeze({
  route: '/articles/example/',
  canonical: 'https://gospod-bog.ru/articles/example/',
  title: 'Observed title',
  metadataSource: 'new-source.astro',
  contentType: 'series-article',
  editorialPublishedAt: '2026-07-11T21:00:00.000Z',
  editorialModifiedAt: '2026-07-11T21:00:00.000Z',
  originalWorkPublishedAt: null,
  reviewStatus: 'migration-freeze-unverified',
  provenance: 'replacement-provenance',
  observations: Object.freeze({ rssPublishedAt: 'new' }),
});

const merged = mergeObservedRecord(previous, observed);
assert.deepEqual(merged, {
  ...previous,
  canonical: observed.canonical,
  title: observed.title,
  metadataSource: observed.metadataSource,
  observations: observed.observations,
});
assert.equal(merged.editorialPublishedAt, previous.editorialPublishedAt);
assert.equal(merged.editorialModifiedAt, previous.editorialModifiedAt);
assert.equal(merged.originalWorkPublishedAt, previous.originalWorkPublishedAt);
assert.equal(merged.reviewStatus, previous.reviewStatus);
assert.equal(merged.provenance, previous.provenance);
assert.equal(merged.contentType, previous.contentType);
assert.deepEqual(mergeObservedRecord(null, observed), observed);
assert.deepEqual(previous.observations, { rssPublishedAt: 'old' });

const approved = { ...previous, reviewStatus: 'approved' };
const approvedMerged = mergeObservedRecord(approved, observed);
assert.equal(approvedMerged.reviewStatus, 'approved');
assert.equal(approvedMerged.editorialPublishedAt, approved.editorialPublishedAt);
assert.deepEqual(approvedMerged.observations, observed.observations);

const distRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'editorial-rss-item-'));
try {
  const route = '/articles/old-entry/';
  const distFile = path.join(distRoot, 'articles/old-entry/index.html');
  fs.mkdirSync(path.dirname(distFile), { recursive: true });
  fs.writeFileSync(
    distFile,
    '<!doctype html><html><head><title>Old entry</title><link rel="canonical" href="https://gospod-bog.ru/articles/old-entry/"></head><body></body></html>',
    'utf8'
  );

  const feedXml = `<?xml version="1.0"?><rss><channel>
    <item><link>https://gospod-bog.ru/articles/new-entry/</link><pubDate>Tue, 28 Jul 2026 21:00:00 GMT</pubDate></item>
    <item><link>https://gospod-bog.ru/articles/old-entry/</link><pubDate>Sat, 11 Jul 2026 21:00:00 GMT</pubDate></item>
  </channel></rss>`;

  const routeRecord = {
    route,
    sourceRel: 'src/pages/articles/old-entry/index.astro',
    inspection: { headImports: [] },
    profile: { routeType: 'article' },
  };
  const shared = { searchItems: [], sitemapXml: '', feedXml };
  const rssObserved = observeRoute(routeRecord, distRoot, shared);
  assert.equal(rssObserved.observations.rssPublishedAt, '2026-07-11T21:00:00.000Z');

  const missingRoute = {
    ...routeRecord,
    route: '/articles/missing-entry/',
  };
  const missingFile = path.join(distRoot, 'articles/missing-entry/index.html');
  fs.mkdirSync(path.dirname(missingFile), { recursive: true });
  fs.copyFileSync(distFile, missingFile);
  const missingObserved = observeRoute(missingRoute, distRoot, shared);
  assert.equal(missingObserved.observations.rssPublishedAt, null);
} finally {
  fs.rmSync(distRoot, { recursive: true, force: true });
}

console.log('✅ Editorial metadata refresh preserves decisions and binds RSS dates to one item');
