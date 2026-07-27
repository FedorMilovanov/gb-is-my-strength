#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

const beforeFile = valueAfter('--before');
const afterFile = valueAfter('--after');
const outFile = valueAfter('--out');
const forbidEditorialDrift = process.argv.includes('--forbid-editorial-drift');
if (!beforeFile || !afterFile || !outFile) {
  console.error('Usage: editorial-metadata-diff-report.js --before <json> --after <json> --out <json> [--forbid-editorial-drift]');
  process.exit(2);
}

const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
const after = JSON.parse(fs.readFileSync(afterFile, 'utf8'));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const scalar = (value) => value === null || ['string', 'number', 'boolean'].includes(typeof value);

function flatten(value, prefix = '', result = new Map()) {
  if (scalar(value) || Array.isArray(value)) {
    result.set(prefix, value);
    return result;
  }
  for (const key of Object.keys(value || {}).sort()) {
    flatten(value[key], prefix ? `${prefix}.${key}` : key, result);
  }
  return result;
}

function classify(field) {
  if (field.startsWith('observations.')) return 'observed-projection';
  if (['editorialPublishedAt', 'editorialModifiedAt', 'originalWorkPublishedAt', 'reviewStatus', 'provenance'].includes(field)) {
    return 'editorial-governance';
  }
  if (['route', 'canonical', 'title', 'metadataSource', 'contentType'].includes(field)) return 'record-identity';
  return 'record-other';
}

const beforeRoutes = Object.keys(before.records || {}).sort();
const afterRoutes = Object.keys(after.records || {}).sort();
const changes = [];
for (const route of [...new Set([...beforeRoutes, ...afterRoutes])].sort()) {
  if (!before.records?.[route]) {
    changes.push({ class: 'route-added', route, field: null, before: null, after: after.records[route] });
    continue;
  }
  if (!after.records?.[route]) {
    changes.push({ class: 'route-removed', route, field: null, before: before.records[route], after: null });
    continue;
  }
  const left = flatten(before.records[route]);
  const right = flatten(after.records[route]);
  for (const field of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const oldValue = left.has(field) ? left.get(field) : undefined;
    const newValue = right.has(field) ? right.get(field) : undefined;
    if (!same(oldValue, newValue)) changes.push({ class: classify(field), route, field, before: oldValue, after: newValue });
  }
}

for (const field of ['version', 'policy', 'sourceCommit']) {
  if (!same(before[field], after[field])) {
    changes.push({ class: field === 'sourceCommit' ? 'source-boundary' : 'registry-root', route: null, field, before: before[field], after: after[field] });
  }
}

const countsByClass = {};
for (const change of changes) countsByClass[change.class] = (countsByClass[change.class] || 0) + 1;
const report = {
  schema: 1,
  before: path.normalize(beforeFile),
  after: path.normalize(afterFile),
  counts: { total: changes.length, byClass: countsByClass },
  changes,
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n');

console.log(`Editorial metadata diff: ${changes.length} field/route change(s)`);
console.log(`Classes: ${JSON.stringify(countsByClass)}`);
const editorialDrift = changes.filter((change) => change.class === 'editorial-governance');
if (forbidEditorialDrift && editorialDrift.length) {
  console.error(`❌ Observed refresh changed ${editorialDrift.length} editorial decision field(s)`);
  for (const change of editorialDrift.slice(0, 50)) {
    console.error(`  - ${change.route}: ${change.field} ${JSON.stringify(change.before)} -> ${JSON.stringify(change.after)}`);
  }
  process.exit(1);
}
console.log('✅ Editorial metadata diff report written without forbidden editorial drift');
