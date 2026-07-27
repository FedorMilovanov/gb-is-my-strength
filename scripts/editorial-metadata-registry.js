#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  ROOT,
  REGISTRY_FILE,
  eligibleRecords,
  sharedProjectionData,
  observeRoute,
  mergeObservedRecord,
  readRegistry,
  validateRecordShape,
} = require('./lib/editorial-metadata');

const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check') || !WRITE;
const BUILD = process.argv.includes('--build');
const DIST = path.join(ROOT, 'dist');

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
  return errors;
}

function writeRegistry() {
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
  const content = `${JSON.stringify(registry, null, 2)}\n`;
  fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, content, 'utf8');
  console.log(`✅ Wrote ${path.relative(ROOT, REGISTRY_FILE).replace(/\\/g, '/')} (${records.size} records)`);
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
  console.log('✅ Editorial metadata registry is structurally complete');
}

try {
  if (WRITE) writeRegistry();
  if (CHECK) checkRegistry();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
