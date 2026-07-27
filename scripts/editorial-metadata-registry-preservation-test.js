#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mergeObservedRecord } = require('./lib/editorial-metadata');

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

console.log('✅ Editorial metadata refresh preserves every existing editorial decision');
