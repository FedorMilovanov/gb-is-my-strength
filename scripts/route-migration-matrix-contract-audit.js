#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const {
  loadRouteRecords,
} = require('./lib/route-source-contract');

const strict = process.argv.includes('--strict');
const errors = [];
const warnings = [];
const SOURCE_ONLY_MARKER = /^[A-Z][A-Za-z0-9]*(?:Shell|Component|Page|Body|Head|Footer|Chrome)$/;

function issue(message, blocking = true) {
  if (blocking || strict) errors.push(message);
  else warnings.push(message);
}

console.log('=== Route Migration Matrix Contract Audit ===');
console.log(`Mode: ${strict ? 'STRICT' : 'WARN'}`);
console.log('Policy: semantic edit protection never exempts a production route from runtime registration.');
console.log('');

const sync = spawnSync(process.execPath, ['scripts/sync-route-migration-matrix.js', '--check'], {
  encoding: 'utf8',
});
if (sync.stdout) process.stdout.write(sync.stdout);
if (sync.stderr) process.stderr.write(sync.stderr);
if (sync.status !== 0) issue('migration matrix synchronizer reports drift');

const { records, matrix } = loadRouteRecords();
const declaredModes = new Set(Object.keys(matrix.modes || {}));
const ownedRoutes = new Map(records.map((record) => [record.route, record]));
let productionRoutes = 0;
let matrixRoutes = 0;
let semanticProtected = 0;

if (Array.isArray(matrix.exclude) && matrix.exclude.length) {
  issue(`matrix.exclude must be empty; semantic edit patterns belong in semanticEditExclusions (${matrix.exclude.length} found)`);
}
if (!Array.isArray(matrix.semanticEditExclusions)) {
  issue('matrix.semanticEditExclusions must be an array');
}

for (const [route, contract] of Object.entries(matrix.routes || {})) {
  matrixRoutes++;
  const record = ownedRoutes.get(route);
  if (!record) {
    issue(`${route}: matrix route has no page-ownership record`);
    continue;
  }

  const { owner, profile } = record;
  if (owner.owner !== 'astro' || owner.status !== 'production-dist') {
    issue(`${route}: matrix route is not a production Astro route (${owner.owner}/${owner.status})`);
  }
  if (!declaredModes.has(contract.mode)) issue(`${route}: undeclared matrix mode ${contract.mode || '(missing)'}`);
  if (contract.source !== owner.source) {
    issue(`${route}: matrix.source=${contract.source || '(missing)'} != ownership.source=${owner.source || '(missing)'}`);
  }
  if (profile?.migrationMode && contract.mode !== profile.migrationMode) {
    issue(`${route}: matrix.mode=${contract.mode} != profile.migrationMode=${profile.migrationMode}`);
  }
  if (contract.scope) {
    if (contract.scope !== 'excluded-semantic-lane') issue(`${route}: unknown matrix scope ${contract.scope}`);
    else semanticProtected++;
  }
  if (profile?.scope && contract.scope !== profile.scope) {
    issue(`${route}: matrix.scope=${contract.scope || '(missing)'} != profile.scope=${profile.scope}`);
  }

  if (!Array.isArray(contract.requiredMarkers)) issue(`${route}: requiredMarkers must be an array`);
  else {
    const duplicates = contract.requiredMarkers.filter((marker, index, all) => all.indexOf(marker) !== index);
    if (duplicates.length) issue(`${route}: duplicate requiredMarkers: ${[...new Set(duplicates)].join(', ')}`);
    const sourceOnly = contract.requiredMarkers.filter((marker) => SOURCE_ONLY_MARKER.test(marker));
    if (sourceOnly.length) issue(`${route}: source-only identifiers cannot be dist markers: ${sourceOnly.join(', ')}`);
  }

  if (!Array.isArray(contract.audits) || !contract.audits.length) {
    issue(`${route}: matrix contract has no audit owners`, false);
  }
}

for (const record of records) {
  const { route, owner, profile, matrix: contract } = record;
  if (owner.owner !== 'astro' || owner.status !== 'production-dist') continue;
  productionRoutes++;
  if (!contract) issue(`${route}: production Astro route missing matrix contract`);
  if (!profile) issue(`${route}: production Astro route missing route profile`);
}

console.log(`Production Astro routes: ${productionRoutes}`);
console.log(`Matrix route contracts: ${matrixRoutes}`);
console.log(`Explicit semantic edit protections: ${semanticProtected}`);

if (warnings.length) {
  console.log('');
  console.log(`⚠️ Warnings (${warnings.length}):`);
  warnings.slice(0, 40).forEach((warning) => console.log(`  ⚠️ ${warning}`));
}

if (errors.length) {
  console.log('');
  console.error(`❌ Route migration matrix contract failed (${errors.length} error(s)):`);
  errors.slice(0, 80).forEach((error) => console.error(`  ❌ ${error}`));
  if (errors.length > 80) console.error(`  …and ${errors.length - 80} more`);
  process.exit(1);
}

console.log('');
console.log('✅ Migration matrix covers every production Astro route without name-based exemptions');
