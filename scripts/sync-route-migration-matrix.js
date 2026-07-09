#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  ROOT,
  findProfileFile,
} = require('./lib/route-source-contract');

const MATRIX_FILE = path.join(ROOT, 'migration/route-migration-matrix.json');
const OWNERSHIP_FILE = path.join(ROOT, 'migration/page-ownership.json');
const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check') || !WRITE;
const CHANGELOG_TEXT = 'Native Source Contract v1: runtime matrix now covers all production routes; semantic edit exclusions moved to semanticEditExclusions; missing Astro production entries are derived from ownership + route profiles.';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeRouteForPattern(route) {
  return route.replace(/^\/+|\/+$/g, '');
}

function matchesGlob(value, pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§DOUBLESTAR§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§DOUBLESTAR§§/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`).test(value);
}

function matchesAny(route, patterns) {
  const value = normalizeRouteForPattern(route);
  return patterns.some((pattern) => matchesGlob(value, pattern));
}

function isProductionAstro(owner) {
  return owner?.owner === 'astro' && owner?.status === 'production-dist';
}

function sourceHasPagefindBody(sourceRel) {
  if (!sourceRel) return false;
  const file = path.join(ROOT, sourceRel);
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('data-pagefind-body');
}

function createMissingContract(route, owner, profile, semanticEditExclusions, matrixModes) {
  const mode = profile?.migrationMode;
  if (!mode) throw new Error(`${route}: route profile has no migrationMode`);
  if (!matrixModes.has(mode)) throw new Error(`${route}: profile migrationMode ${mode} is not declared in matrix.modes`);
  if (!owner.source) throw new Error(`${route}: page ownership has no source`);

  const contract = {
    mode,
    source: owner.source,
  };

  const semanticProtected = profile?.scope === 'excluded-semantic-lane' || matchesAny(route, semanticEditExclusions);
  if (semanticProtected) contract.scope = 'excluded-semantic-lane';

  contract.requiredMarkers = sourceHasPagefindBody(owner.source) ? ['data-pagefind-body'] : [];
  contract.audits = ['native-source-contract', 'native-runtime-taxonomy'];
  contract.reason = 'Runtime ownership registered from page-ownership + route profile. Semantic editing protection, when present, does not exempt runtime checks.';
  return contract;
}

function normalizeMatrix(matrix, ownership) {
  const next = JSON.parse(JSON.stringify(matrix));
  const legacyExclusions = Array.isArray(next.semanticEditExclusions)
    ? next.semanticEditExclusions
    : Array.isArray(next.exclude)
      ? next.exclude
      : [];

  next.version = '2026-07-09.native-source-contract-v1';
  next.scope = 'all-production-routes-runtime-contract';
  next.source = 'Native Source Contract v1; semantic edit exclusions do not exempt production routes from runtime ownership checks';
  next.semanticEditExclusions = legacyExclusions;
  next.exclude = [];
  next.routes ||= {};
  next.changelog ||= [];

  const matrixModes = new Set(Object.keys(next.modes || {}));
  const added = [];

  for (const [route, owner] of Object.entries(ownership.routes || {})) {
    if (!isProductionAstro(owner)) continue;
    const profileFile = findProfileFile(route);
    if (!profileFile) throw new Error(`${route}: production Astro route has no route profile`);
    const profile = readJson(profileFile);

    if (!next.routes[route]) {
      next.routes[route] = createMissingContract(route, owner, profile, legacyExclusions, matrixModes);
      added.push(route);
      continue;
    }

    const contract = next.routes[route];
    if (contract.source !== owner.source) {
      throw new Error(`${route}: matrix source ${contract.source} != ownership source ${owner.source}`);
    }
    if (profile.migrationMode && contract.mode !== profile.migrationMode) {
      throw new Error(`${route}: matrix mode ${contract.mode} != profile migrationMode ${profile.migrationMode}`);
    }
    if (profile.scope === 'excluded-semantic-lane' || matchesAny(route, legacyExclusions)) {
      contract.scope = 'excluded-semantic-lane';
    }
  }

  if (!next.changelog.some((entry) => entry?.date === '2026-07-09' && entry?.change === CHANGELOG_TEXT)) {
    next.changelog.push({ date: '2026-07-09', change: CHANGELOG_TEXT });
  }

  return { next, added };
}

function main() {
  const matrix = readJson(MATRIX_FILE);
  const ownership = readJson(OWNERSHIP_FILE);
  const original = fs.readFileSync(MATRIX_FILE, 'utf8');
  const { next, added } = normalizeMatrix(matrix, ownership);
  const serialized = `${JSON.stringify(next, null, 2)}\n`;

  console.log('=== Route Migration Matrix Synchronizer ===');
  console.log(`Mode: ${WRITE ? 'WRITE' : 'CHECK'}`);
  console.log(`Production routes: ${Object.values(ownership.routes || {}).filter(isProductionAstro).length}`);
  console.log(`Matrix routes after normalization: ${Object.keys(next.routes || {}).length}`);
  console.log(`Missing contracts derived: ${added.length}`);
  added.forEach((route) => console.log(`  + ${route}`));

  if (WRITE) {
    if (serialized === original) {
      console.log('✅ Matrix already normalized; no write needed');
      return;
    }
    fs.writeFileSync(MATRIX_FILE, serialized, 'utf8');
    console.log(`✅ Wrote ${path.relative(ROOT, MATRIX_FILE).replace(/\\/g, '/')}`);
    return;
  }

  if (CHECK && serialized !== original) {
    console.error('❌ Route migration matrix is not synchronized.');
    console.error('Run: node scripts/sync-route-migration-matrix.js --write');
    process.exit(1);
  }

  console.log('✅ Route migration matrix is synchronized');
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
