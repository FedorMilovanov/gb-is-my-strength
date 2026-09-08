'use strict';

const fs = require('fs');
const path = require('path');

const REVIEW_DECISION_FIELDS = Object.freeze([
  'editorialPublishedAt',
  'editorialModifiedAt',
  'reviewStatus',
  'provenance',
]);

function sortedJsonFiles(directory) {
  if (!directory || !fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .map((name) => path.join(directory, name));
}

function assertDecisionSnapshot(snapshot, label, rel, route) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error(`${route}: ${label} snapshot in ${rel} must be an object`);
  }

  const keys = Object.keys(snapshot).sort();
  const expected = [...REVIEW_DECISION_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error(`${route}: ${label} snapshot in ${rel} must declare exactly ${REVIEW_DECISION_FIELDS.join(', ')}`);
  }

  if (typeof snapshot.editorialPublishedAt !== 'string' || !snapshot.editorialPublishedAt) {
    throw new Error(`${route}: ${label}.editorialPublishedAt in ${rel} must be a non-empty string`);
  }
  if (typeof snapshot.editorialModifiedAt !== 'string' || !snapshot.editorialModifiedAt) {
    throw new Error(`${route}: ${label}.editorialModifiedAt in ${rel} must be a non-empty string`);
  }
  if (typeof snapshot.reviewStatus !== 'string' || !snapshot.reviewStatus) {
    throw new Error(`${route}: ${label}.reviewStatus in ${rel} must be a non-empty string`);
  }
  if (typeof snapshot.provenance !== 'string' || !snapshot.provenance) {
    throw new Error(`${route}: ${label}.provenance in ${rel} must be a non-empty string`);
  }
}

function assertRecordMatchesSnapshot(record, snapshot, rel, route, phase) {
  for (const field of REVIEW_DECISION_FIELDS) {
    if (record?.[field] !== snapshot[field]) {
      throw new Error(
        `${route}: ${phase} ${field} mismatch in ${rel}: expected ${JSON.stringify(snapshot[field])}, found ${JSON.stringify(record?.[field])}`
      );
    }
  }
}

function applyReviewDecisions(records, { directory, root }) {
  const decisions = [];
  const claimed = new Set();

  for (const file of sortedJsonFiles(directory)) {
    const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
    const rel = root ? path.relative(root, file).replace(/\\/g, '/') : file;
    if (!ledger || ledger.version !== 1 || !ledger.changes || typeof ledger.changes !== 'object' || Array.isArray(ledger.changes)) {
      throw new Error(`${rel}: invalid editorial metadata review decision ledger`);
    }

    for (const [route, change] of Object.entries(ledger.changes).sort(([a], [b]) => a.localeCompare(b, 'ru'))) {
      if (claimed.has(route)) throw new Error(`${route}: duplicate review decision ownership in ${rel}`);
      claimed.add(route);

      const record = records[route];
      if (!record) throw new Error(`${route}: review decision in ${rel} has no registry record`);
      if (!change || typeof change !== 'object' || Array.isArray(change) || !change.from || !change.to) {
        throw new Error(`${route}: review decision in ${rel} must declare from and to snapshots`);
      }

      assertDecisionSnapshot(change.from, 'from', rel, route);
      assertDecisionSnapshot(change.to, 'to', rel, route);

      if (change.from.reviewStatus === 'approved') {
        throw new Error(`${route}: review decision in ${rel} cannot replace an already-approved source state`);
      }
      if (change.to.reviewStatus !== 'approved') {
        throw new Error(`${route}: review decision in ${rel} must end in reviewStatus=approved`);
      }

      assertRecordMatchesSnapshot(record, change.from, rel, route, 'source');

      records[route] = {
        ...record,
        ...change.to,
      };
      decisions.push({
        file,
        route,
        from: { ...change.from },
        to: { ...change.to },
      });
    }
  }

  return decisions;
}

function reverseReviewDecisions(records, decisions) {
  for (const decision of [...(decisions || [])].reverse()) {
    const rel = decision.file || '<review-decision-ledger>';
    const record = records[decision.route];
    if (!record) throw new Error(`${decision.route}: reviewed record missing during registry write`);
    assertRecordMatchesSnapshot(record, decision.to, rel, decision.route, 'write');
    records[decision.route] = {
      ...record,
      ...decision.from,
    };
  }
}

module.exports = {
  REVIEW_DECISION_FIELDS,
  applyReviewDecisions,
  reverseReviewDecisions,
};
