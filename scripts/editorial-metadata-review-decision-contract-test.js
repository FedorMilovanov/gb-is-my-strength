'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  applyReviewDecisions,
  reverseReviewDecisions,
} = require('./lib/editorial-metadata-review-decisions');

const ROUTE = '/articles/review-decision-contract-fixture/';
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'editorial-review-decisions-'));
const DIRECTORY = path.join(ROOT, 'data/editorial-metadata-review-decisions');
fs.mkdirSync(DIRECTORY, { recursive: true });

const baseRecord = {
  route: ROUTE,
  canonical: `https://gospod-bog.ru${ROUTE}`,
  title: 'Review decision contract fixture',
  metadataSource: 'fixture.mdx',
  contentType: 'article',
  editorialPublishedAt: '2026-07-10T21:00:00.000Z',
  editorialModifiedAt: '2026-07-10T21:00:00.000Z',
  originalWorkPublishedAt: null,
  reviewStatus: 'inconsistent-needs-review',
  provenance: 'production-like-dist-migration-freeze',
  observations: {
    metaPublishedAt: '2026-07-10T21:00:00.000Z',
  },
};

const from = {
  editorialPublishedAt: baseRecord.editorialPublishedAt,
  editorialModifiedAt: baseRecord.editorialModifiedAt,
  reviewStatus: baseRecord.reviewStatus,
  provenance: baseRecord.provenance,
};
const to = {
  editorialPublishedAt: '2026-07-10T21:00:00.000Z',
  editorialModifiedAt: '2026-07-29T21:00:00.000Z',
  reviewStatus: 'approved',
  provenance: 'verified-release-contract-fixture',
};

function writeLedger(name, change) {
  fs.writeFileSync(path.join(DIRECTORY, name), `${JSON.stringify({
    version: 1,
    changes: {
      [ROUTE]: change,
    },
  }, null, 2)}\n`, 'utf8');
}

function resetLedgers() {
  for (const name of fs.readdirSync(DIRECTORY)) fs.rmSync(path.join(DIRECTORY, name));
}

function records() {
  return { [ROUTE]: JSON.parse(JSON.stringify(baseRecord)) };
}

try {
  writeLedger('valid.json', { from, to });
  const effective = records();
  const decisions = applyReviewDecisions(effective, { directory: DIRECTORY, root: ROOT });
  assert.strictEqual(decisions.length, 1);
  assert.strictEqual(effective[ROUTE].editorialModifiedAt, to.editorialModifiedAt);
  assert.strictEqual(effective[ROUTE].reviewStatus, 'approved');
  assert.strictEqual(effective[ROUTE].provenance, to.provenance);
  assert.deepStrictEqual(effective[ROUTE].observations, baseRecord.observations, 'review decision must not rewrite observations');

  reverseReviewDecisions(effective, decisions);
  assert.deepStrictEqual(effective[ROUTE], baseRecord, 'write reversal must restore the exact owner storage state');

  resetLedgers();
  writeLedger('stale.json', {
    from: { ...from, editorialModifiedAt: '1970-01-01T00:00:00.000Z' },
    to,
  });
  assert.throws(
    () => applyReviewDecisions(records(), { directory: DIRECTORY, root: ROOT }),
    /source editorialModifiedAt mismatch/,
    'stale source state must fail closed'
  );

  resetLedgers();
  writeLedger('a.json', { from, to });
  writeLedger('b.json', { from, to });
  assert.throws(
    () => applyReviewDecisions(records(), { directory: DIRECTORY, root: ROOT }),
    /duplicate review decision ownership/,
    'duplicate route claims must fail closed'
  );

  resetLedgers();
  writeLedger('extra-field.json', {
    from,
    to: { ...to, accidentalField: 'forbidden' },
  });
  assert.throws(
    () => applyReviewDecisions(records(), { directory: DIRECTORY, root: ROOT }),
    /must declare exactly/,
    'decision snapshots must not smuggle unrelated fields'
  );

  resetLedgers();
  writeLedger('not-approved.json', {
    from,
    to: { ...to, reviewStatus: 'inconsistent-needs-review' },
  });
  assert.throws(
    () => applyReviewDecisions(records(), { directory: DIRECTORY, root: ROOT }),
    /must end in reviewStatus=approved/,
    'decision overlay is approval-only'
  );

  resetLedgers();
  const approvedFrom = { ...from, reviewStatus: 'approved' };
  writeLedger('replace-approved.json', { from: approvedFrom, to });
  const alreadyApproved = records();
  alreadyApproved[ROUTE].reviewStatus = 'approved';
  assert.throws(
    () => applyReviewDecisions(alreadyApproved, { directory: DIRECTORY, root: ROOT }),
    /cannot replace an already-approved source state/,
    'approved decisions are immutable through this overlay'
  );

  console.log('Editorial metadata review decision contract passed.');
} finally {
  fs.rmSync(ROOT, { recursive: true, force: true });
}
