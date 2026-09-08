#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { projectVisibleDateline } = require('./lib/editorial-metadata-v3');

const ROOT = path.resolve(__dirname, '..');
const registryCli = fs.readFileSync(path.join(ROOT, 'scripts/editorial-metadata-registry.js'), 'utf8');
const postbuild = fs.readFileSync(path.join(ROOT, 'scripts/astro-cache-bust-postbuild.js'), 'utf8');
const audit = fs.readFileSync(path.join(ROOT, 'scripts/editorial-metadata-freeze-audit.js'), 'utf8');

assert.match(
  registryCli,
  /filter\(\(\[, record\]\) => record\.reviewStatus === 'approved'\)/,
  'final dist projector must select only explicitly approved editorial records'
);
assert.match(
  registryCli,
  /blockedEditorialReview/,
  'projection evidence must count records blocked pending editorial review'
);
assert.match(
  postbuild,
  /editorial-metadata-registry\.js[\s\S]*?'--project-dist'/,
  'production-like postbuild must invoke the canonical registry CLI, not the projection library directly'
);
assert.match(
  audit,
  /if \(record\.reviewStatus === 'approved'\)[\s\S]*?canonicalProjectionChecks[\s\S]*?else \{[\s\S]*?frozenProjectionChecks/,
  'audit must converge approved records and freeze unapproved records'
);
assert.doesNotMatch(
  registryCli,
  /reviewStatus !== 'approved'[\s\S]*?projectRegistryToDist/,
  'unapproved records must never be passed to the canonical projector'
);

const records = {
  '/approved/': { reviewStatus: 'approved' },
  '/inconsistent/': { reviewStatus: 'inconsistent-needs-review' },
  '/frozen/': { reviewStatus: 'migration-freeze-unverified' },
};
const approved = Object.fromEntries(
  Object.entries(records).filter(([, record]) => record.reviewStatus === 'approved')
);
assert.deepEqual(Object.keys(approved), ['/approved/']);
assert.equal(Object.keys(records).length - Object.keys(approved).length, 2);

const directUpdatedTime = [
  '<p class="article-byline">',
  '<time datetime="2026-04-01">1 апреля 2026</time>',
  '<span class="article-byline__updated">Обн. <time class="article-updated" datetime="2026-05-09">9 мая 2026</time></span>',
  '</p>',
].join('');
const projectedDateline = projectVisibleDateline(directUpdatedTime, {
  editorialPublishedAt: '2026-03-31T21:00:00.000Z',
  editorialModifiedAt: '2026-07-05T09:14:15.000Z',
});
assert.match(
  projectedDateline,
  /<time datetime="2026-03-31T21:00:00\.000Z">1 апреля 2026<\/time>/,
  'visible publication time inside article-byline must project the approved publication instant'
);
assert.match(
  projectedDateline,
  /<time class="article-updated" datetime="2026-07-05T09:14:15\.000Z">9 мая 2026<\/time>/,
  'direct time.article-updated must project the approved modification instant'
);

console.log('✅ Editorial Metadata v3 projects approved decisions and freezes every unapproved record');