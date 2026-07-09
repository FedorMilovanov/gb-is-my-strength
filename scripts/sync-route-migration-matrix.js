#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  ROOT,
  isProductionAstro,
  normalizeRouteMatrix,
} = require('./lib/route-matrix-normalizer');

const MATRIX_FILE = path.join(ROOT, 'migration/route-migration-matrix.json');
const OWNERSHIP_FILE = path.join(ROOT, 'migration/page-ownership.json');
const WRITE = process.argv.includes('--write');
const REQUIRE_MATERIALIZED = process.argv.includes('--require-materialized');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function stripDerivedFlags(value) {
  const clone = JSON.parse(JSON.stringify(value));
  for (const contract of Object.values(clone.routes || {})) delete contract.derived;
  return clone;
}

function main() {
  const rawMatrix = readJson(MATRIX_FILE);
  const ownership = readJson(OWNERSHIP_FILE);
  const original = fs.readFileSync(MATRIX_FILE, 'utf8');
  const { next, derivedRoutes, removedMarkers } = normalizeRouteMatrix(rawMatrix, ownership);
  const materialized = stripDerivedFlags(next);
  const serialized = `${JSON.stringify(materialized, null, 2)}\n`;
  const productionRouteNames = Object.entries(ownership.routes || {})
    .filter(([, owner]) => isProductionAstro(owner))
    .map(([route]) => route)
    .sort();
  const effectiveRouteNames = Object.keys(next.routes || {}).sort();
  const missingProductionRoutes = productionRouteNames.filter((route) => !next.routes?.[route]);
  const additionalOwnedOverrides = effectiveRouteNames.filter((route) => !productionRouteNames.includes(route));

  console.log('=== Route Migration Matrix Contract ===');
  console.log(`Mode: ${WRITE ? 'MATERIALIZE' : REQUIRE_MATERIALIZED ? 'CHECK MATERIALIZED' : 'CHECK EFFECTIVE'}`);
  console.log(`Production Astro routes: ${productionRouteNames.length}`);
  console.log(`Explicit raw overrides: ${Object.keys(rawMatrix.routes || {}).length}`);
  console.log(`Effective runtime contracts: ${effectiveRouteNames.length}`);
  console.log(`Contracts derived in memory: ${derivedRoutes.length}`);
  console.log(`Additional owned overrides: ${additionalOwnedOverrides.length}`);
  console.log(`Source-only markers normalized in memory: ${removedMarkers.length}`);

  if (missingProductionRoutes.length) {
    throw new Error(`effective registry misses production routes: ${missingProductionRoutes.join(', ')}`);
  }

  if (WRITE) {
    if (serialized === original) {
      console.log('✅ Materialized matrix already matches the effective registry');
      return;
    }
    fs.writeFileSync(MATRIX_FILE, serialized, 'utf8');
    console.log(`✅ Materialized ${path.relative(ROOT, MATRIX_FILE).replace(/\\/g, '/')}`);
    return;
  }

  if (REQUIRE_MATERIALIZED && serialized !== original) {
    console.error('❌ Raw matrix is not a full materialization of the effective registry.');
    console.error('Run explicitly: node scripts/sync-route-migration-matrix.js --write');
    process.exit(1);
  }

  if (derivedRoutes.length) {
    console.log('ℹ️ Raw matrix intentionally stores overrides; missing production contracts are derived from ownership + profiles.');
    derivedRoutes.slice(0, 30).forEach((route) => console.log(`  + ${route}`));
    if (derivedRoutes.length > 30) console.log(`  …and ${derivedRoutes.length - 30} more`);
  }
  if (additionalOwnedOverrides.length) {
    console.log('ℹ️ Effective matrix also retains explicit contracts for owned non-production routes:');
    additionalOwnedOverrides.slice(0, 30).forEach((route) => console.log(`  · ${route}`));
  }
  if (removedMarkers.length) {
    console.log('ℹ️ Invalid source-only marker overrides are ignored by the effective registry:');
    removedMarkers.forEach(({ route, marker }) => console.log(`  - ${route}: ${marker}`));
  }

  console.log('✅ Effective route migration registry covers every production Astro route');
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
