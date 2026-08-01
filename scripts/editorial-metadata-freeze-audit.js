#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  ROOT,
  REGISTRY_FILE,
  eligibleRecords,
  observeRoute,
  readRegistry,
  normalizeInstant,
} = require('./lib/editorial-metadata');
const { validateRegistryV3 } = require('./lib/editorial-metadata-v3');

const DIST = path.join(ROOT, 'dist');
const errors = [];
const warnings = [];

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function distSharedProjectionData() {
  const sitemapFiles = fs.existsSync(DIST)
    ? fs.readdirSync(DIST)
        .filter((name) => /^sitemap(?:-\d+)?\.xml$/i.test(name))
        .sort()
    : [];
  return {
    searchItems: readJson(path.join(DIST, 'data', 'search-manifest.json'), { items: [] }).items || [],
    sitemapXml: sitemapFiles.map((name) => fs.readFileSync(path.join(DIST, name), 'utf8')).join('\n'),
    feedXml: fs.existsSync(path.join(DIST, 'feed.xml'))
      ? fs.readFileSync(path.join(DIST, 'feed.xml'), 'utf8')
      : '',
  };
}

function compareProjection(route, label, actual, expected, required) {
  const normalizedExpected = normalizeInstant(expected);
  const normalizedActual = normalizeInstant(actual);
  if (normalizedExpected === null) {
    if (normalizedActual !== null) errors.push(`${route}: ${label} must be absent while editorial date is unknown`);
    return;
  }
  if (required && normalizedActual === null) {
    errors.push(`${route}: ${label} missing; expected ${normalizedExpected}`);
    return;
  }
  if (normalizedActual !== null && normalizedActual !== normalizedExpected) {
    errors.push(`${route}: ${label}=${normalizedActual} != ${normalizedExpected}`);
  }
}

function canonicalProjectionChecks(route, record, current) {
  const published = record.editorialPublishedAt;
  const modified = record.editorialModifiedAt;

  compareProjection(route, 'metaPublishedAt', current.observations.metaPublishedAt, published, true);
  compareProjection(route, 'jsonLdPublishedAt', current.observations.jsonLdPublishedAt, published, true);
  compareProjection(route, 'searchPublishedAt', current.observations.searchPublishedAt, published, false);
  compareProjection(route, 'rssPublishedAt', current.observations.rssPublishedAt, published, false);
  compareProjection(route, 'visiblePublishedAt', current.observations.visiblePublishedAt, published, false);

  compareProjection(route, 'metaModifiedAt', current.observations.metaModifiedAt, modified, true);
  compareProjection(route, 'jsonLdModifiedAt', current.observations.jsonLdModifiedAt, modified, true);
  compareProjection(route, 'searchModifiedAt', current.observations.searchModifiedAt, modified, false);
  compareProjection(route, 'sitemapLastmod', current.observations.sitemapLastmod, modified || published, true);
  compareProjection(route, 'visibleModifiedAt', current.observations.visibleModifiedAt, modified, false);
}

console.log('=== Editorial Metadata v3 Projection Audit ===');
console.log('Registry decisions own final dist dates; observation snapshots remain migration evidence.');
console.log('RSS channel lastBuildDate is technical and is intentionally outside editorial comparison.');
console.log('');

if (!fs.existsSync(DIST)) {
  console.error('❌ dist/ missing; build production-like dist first');
  process.exit(1);
}
if (!fs.existsSync(REGISTRY_FILE)) {
  console.error('❌ editorial metadata registry missing');
  process.exit(1);
}

const registry = readRegistry();
errors.push(...validateRegistryV3(registry));
const shared = distSharedProjectionData();
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

  const current = observeRoute(routeRecord, DIST, shared);
  if (record.canonical !== current.canonical) errors.push(`${route}: canonical changed ${record.canonical} -> ${current.canonical}`);
  if (record.metadataSource !== current.metadataSource) errors.push(`${route}: metadataSource changed ${record.metadataSource} -> ${current.metadataSource}`);

  canonicalProjectionChecks(route, record, current);

  for (const [field, historical] of Object.entries(record.observations || {})) {
    const finalValue = current.observations[field] ?? null;
    if ((historical ?? null) !== finalValue) {
      warnings.push(`${route}: historical ${field}=${historical || 'null'} converged to ${finalValue || 'null'}`);
    }
  }

  if (record.reviewStatus === 'approved') approved++;
  else if (record.reviewStatus === 'inconsistent-needs-review') inconsistent++;
  else frozen++;
}

for (const route of eligibleByRoute.keys()) {
  if (!registry.records?.[route]) errors.push(`${route}: eligible route missing from registry`);
}

console.log(`Eligible routes: ${eligible.length}`);
console.log(`Approved: ${approved}`);
console.log(`Inconsistent decisions awaiting editorial review: ${inconsistent}`);
console.log(`Migration decisions awaiting approval: ${frozen}`);
console.log(`Historical projection differences normalized by v3: ${warnings.length}`);

if (warnings.length) {
  warnings.slice(0, 20).forEach((warning) => console.log(`  - ${warning}`));
  if (warnings.length > 20) console.log(`  …and ${warnings.length - 20} more`);
}

if (errors.length) {
  console.error(`❌ Editorial Metadata v3 projection failed (${errors.length} error(s)):`);
  errors.slice(0, 100).forEach((error) => console.error(`  - ${error}`));
  if (errors.length > 100) console.error(`  …and ${errors.length - 100} more`);
  process.exit(1);
}

console.log('✅ Final metadata projections converge on the editorial registry');
