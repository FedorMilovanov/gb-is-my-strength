#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  ROOT,
  REGISTRY_FILE,
  eligibleRecords,
  sharedProjectionData,
  observeRoute,
  readRegistry,
  normalizeInstant,
  validateRecordShape,
} = require('./lib/editorial-metadata');

const DIST = path.join(ROOT, 'dist');
const errors = [];
const warnings = [];

function same(a, b) {
  return (a || null) === (b || null);
}

function canonicalProjectionChecks(route, record, current) {
  const approved = record.reviewStatus === 'approved';
  const published = normalizeInstant(record.editorialPublishedAt);
  const modified = normalizeInstant(record.editorialModifiedAt);
  if (!approved) return;

  const publishedFields = ['visiblePublishedAt', 'metaPublishedAt', 'jsonLdPublishedAt', 'searchPublishedAt', 'rssPublishedAt'];
  const modifiedFields = ['visibleModifiedAt', 'metaModifiedAt', 'jsonLdModifiedAt', 'searchModifiedAt', 'sitemapLastmod'];

  for (const field of publishedFields) {
    const value = current.observations[field];
    if (value && value !== published) errors.push(`${route}: approved ${field}=${value} != editorialPublishedAt=${published}`);
  }
  for (const field of modifiedFields) {
    const value = current.observations[field];
    if (value && value !== modified) errors.push(`${route}: approved ${field}=${value} != editorialModifiedAt=${modified}`);
  }
}

console.log('=== Editorial Metadata Freeze Audit ===');
console.log('Unreviewed records freeze every observed projection separately.');
console.log('Approved records additionally require convergence to canonical editorial dates.');
console.log('');

if (!fs.existsSync(DIST)) {
  console.error('❌ dist/ missing; build production-like dist first');
  process.exit(1);
}
if (!fs.existsSync(REGISTRY_FILE)) {
  console.error('❌ editorial metadata registry missing; run editorial-metadata-registry.js --write');
  process.exit(1);
}

const registry = readRegistry();
const shared = sharedProjectionData();
const eligible = eligibleRecords();
const eligibleByRoute = new Map(eligible.map((record) => [record.route, record]));
let approved = 0;
let inconsistent = 0;
let frozen = 0;

for (const [route, record] of Object.entries(registry.records || {})) {
  const routeRecord = eligibleByRoute.get(route);
  if (!routeRecord) {
    errors.push(`${route}: registry route is no longer eligible/owned`);
    continue;
  }
  for (const problem of validateRecordShape(record, route)) errors.push(`${route}: ${problem}`);

  const current = observeRoute(routeRecord, DIST, shared);
  if (record.canonical !== current.canonical) errors.push(`${route}: canonical changed ${record.canonical} -> ${current.canonical}`);
  if (record.metadataSource !== current.metadataSource) errors.push(`${route}: metadataSource changed ${record.metadataSource} -> ${current.metadataSource}`);

  for (const [field, frozenValue] of Object.entries(record.observations || {})) {
    const currentValue = current.observations[field] ?? null;
    if (!same(frozenValue, currentValue)) {
      errors.push(`${route}: frozen projection ${field} changed ${frozenValue || 'null'} -> ${currentValue || 'null'}`);
    }
  }

  canonicalProjectionChecks(route, record, current);
  if (record.reviewStatus === 'approved') approved++;
  else if (record.reviewStatus === 'inconsistent-needs-review') inconsistent++;
  else frozen++;
}

for (const route of eligibleByRoute.keys()) {
  if (!registry.records?.[route]) errors.push(`${route}: eligible route missing from registry`);
}

console.log(`Eligible routes: ${eligible.length}`);
console.log(`Approved: ${approved}`);
console.log(`Inconsistent, needs editorial review: ${inconsistent}`);
console.log(`Consistent migration freezes awaiting approval: ${frozen}`);

if (warnings.length) {
  console.log(`⚠️ Warnings (${warnings.length}):`);
  warnings.forEach((warning) => console.log(`  - ${warning}`));
}

if (errors.length) {
  console.error(`❌ Editorial metadata freeze failed (${errors.length} error(s)):`);
  errors.slice(0, 100).forEach((error) => console.error(`  - ${error}`));
  if (errors.length > 100) console.error(`  …and ${errors.length - 100} more`);
  process.exit(1);
}

console.log('✅ Editorial metadata projections have not moved outside the registry contract');
