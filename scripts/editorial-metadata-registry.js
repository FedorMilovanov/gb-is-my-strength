#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  ROOT,
  eligibleRecords,
  sharedProjectionData,
  observeRoute,
  mergeObservedRecord,
  readRegistry,
  writeRegistry,
  validateRecordShape,
} = require('./lib/editorial-metadata');
const {
  validateRegistryV3,
  projectRegistryToDist,
} = require('./lib/editorial-metadata-v3');

const WRITE = process.argv.includes('--write');
const PROJECT_DIST = process.argv.includes('--project-dist');
const DRY_RUN = process.argv.includes('--dry-run');
const CHECK = process.argv.includes('--check') || (!WRITE && !PROJECT_DIST);
const BUILD = process.argv.includes('--build');
const DIST_ARG = process.argv.find((arg) => arg.startsWith('--dist='));
const DIST = path.resolve(ROOT, DIST_ARG ? DIST_ARG.slice('--dist='.length) : 'dist');

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (_) {
    return process.env.GITHUB_SHA || 'unknown';
  }
}

function buildDist() {
  if (!BUILD) return;
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFileSync(npm, ['run', 'strangler:build:production-like'], { cwd: ROOT, stdio: 'inherit' });
}

function stableRegistry(records, sourceCommit) {
  const sorted = Object.fromEntries([...records.entries()].sort(([a], [b]) => a.localeCompare(b, 'ru')));
  return {
    version: 1,
    policy: {
      model: 'editorial-time-is-not-build-time',
      freezeMode: 'observed-projections-with-review-status',
      approvedRecordsRequireProjectionConvergence: true,
      technicalCommitsMayChangeEditorialDates: false,
    },
    sourceCommit,
    records: sorted,
  };
}

function validateRegistry(registry) {
  const errors = [];
  if (!registry || registry.version !== 1) errors.push('registry version must be 1');
  if (!registry?.records || typeof registry.records !== 'object') errors.push('registry.records missing');

  const eligible = eligibleRecords();
  const eligibleRoutes = new Set(eligible.map((record) => record.route));
  for (const route of eligibleRoutes) {
    if (!registry?.records?.[route]) errors.push(`${route}: metadata record missing`);
  }
  for (const route of Object.keys(registry?.records || {})) {
    if (!eligibleRoutes.has(route)) errors.push(`${route}: registry record has no eligible production route`);
    for (const problem of validateRecordShape(registry.records[route], route)) errors.push(`${route}: ${problem}`);
  }
  return [...errors, ...validateRegistryV3(registry)];
}

function materializeRegistry() {
  buildDist();
  if (!fs.existsSync(DIST)) throw new Error('dist/ missing; run with --build or build production-like dist first');

  const existing = readRegistry();
  const shared = sharedProjectionData();
  const records = new Map();

  for (const routeRecord of eligibleRecords()) {
    const observed = observeRoute(routeRecord, DIST, shared);
    const previous = existing?.records?.[routeRecord.route];

    // Observation refreshes may update projection snapshots and technical
    // descriptors, but must never replace an existing editorial decision.
    records.set(routeRecord.route, mergeObservedRecord(previous, observed));
  }

  const registry = stableRegistry(records, gitHead());
  writeRegistry(registry);
  console.log(`✅ Wrote editorial metadata registry (${records.size} records)`);
}

function checkRegistry() {
  const registry = readRegistry();
  const errors = validateRegistry(registry);
  console.log('=== Editorial Metadata Registry Check ===');
  console.log(`Eligible routes: ${eligibleRecords().length}`);
  console.log(`Registry records: ${Object.keys(registry?.records || {}).length}`);
  if (errors.length) {
    console.error(`❌ Registry check failed (${errors.length} error(s)):`);
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }
  console.log('✅ Editorial metadata registry is structurally and semantically complete');
}

function projectDist() {
  const registry = readRegistry();
  const errors = validateRegistryV3(registry);
  if (errors.length) throw new Error(`Editorial Metadata v3 invalid:\n- ${errors.join('\n- ')}`);

  const approvedRecords = Object.fromEntries(
    Object.entries(registry.records || {}).filter(([, record]) => record.reviewStatus === 'approved')
  );
  const totalRecords = Object.keys(registry.records || {}).length;
  const blockedRecords = totalRecords - Object.keys(approvedRecords).length;
  const report = projectRegistryToDist({
    distRoot: DIST,
    dryRun: DRY_RUN,
    registry: { ...registry, records: approvedRecords },
  });
  report.totalRegistryRecords = totalRecords;
  report.approvedRecords = Object.keys(approvedRecords).length;
  report.blockedEditorialReview = blockedRecords;
  if (!DRY_RUN) {
    const reportFile = path.join(ROOT, 'reports', 'editorial-metadata-v3-projection.json');
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  console.log('=== Editorial Metadata v3 Projection ===');
  console.log(`Registry records: ${report.totalRegistryRecords}`);
  console.log(`Approved/blocked: ${report.approvedRecords}/${report.blockedEditorialReview}`);
  console.log(`HTML matched/changed: ${report.htmlMatched}/${report.htmlChanged}`);
  console.log(`Search manifest matched: ${report.searchManifestMatched}`);
  console.log(`Sitemap files/routes: ${report.sitemapFiles}/${report.sitemapMatched}`);
  console.log(`RSS matched: ${report.rssMatched}`);
  console.log(`Unknown publication/modification dates: ${report.unknownPublished}/${report.unknownModified}`);
  console.log(`Technical build instant: ${report.technicalBuildInstant}`);
  console.log(DRY_RUN ? '✅ Editorial Metadata v3 dry-run passed' : '✅ Editorial Metadata v3 projected approved decisions to final dist');
}

try {
  if (WRITE) materializeRegistry();
  if (CHECK) checkRegistry();
  if (PROJECT_DIST) projectDist();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
