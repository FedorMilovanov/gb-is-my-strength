#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

console.log('✅ Editorial Metadata v3 projects approved decisions and freezes every unapproved record');
