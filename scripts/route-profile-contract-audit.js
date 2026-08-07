#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const {
  ROOT,
  loadRouteRecords,
  validateRecord,
} = require('./lib/route-source-contract');

const strict = process.argv.includes('--strict');
const errors = [];
const warnings = [];
const ALLOWED_SCOPES = new Set(['excluded-semantic-lane']);
const LEGACY_STATUSES = new Set(['canonical', 'reference-only', 'runtime-required', 'absent']);

function issue(message, blocking = true) {
  if (blocking || strict) errors.push(message);
  else warnings.push(message);
}

function fileExists(rel) {
  return Boolean(rel) && fs.existsSync(`${ROOT}/${rel}`);
}

function legacyAuthorityShapeIssues(profile) {
  const issues = [];
  const status = profile?.legacyStatus;
  if (!status) {
    issues.push('production profile missing explicit legacyStatus');
    return issues;
  }
  if (!LEGACY_STATUSES.has(status)) {
    issues.push(`unknown legacyStatus=${status}`);
    return issues;
  }
  if (status === 'absent' && profile.legacyPath) {
    issues.push(`legacyStatus=absent must not declare legacyPath=${profile.legacyPath}`);
  }
  if (status !== 'absent' && !profile.legacyPath) {
    issues.push(`legacyStatus=${status} requires legacyPath`);
  }
  return issues;
}

function runLegacyAuthorityContractChecks() {
  const cases = [
    [{}, 1, 'missing status is rejected'],
    [{ legacyStatus: 'unknown-state' }, 1, 'unknown status is rejected'],
    [{ legacyStatus: 'absent', legacyPath: 'old/index.html' }, 1, 'absent with a path is rejected'],
    [{ legacyStatus: 'reference-only' }, 1, 'reference-only without a path is rejected'],
    [{ legacyStatus: 'absent', legacyPath: null }, 0, 'explicit absent is valid'],
    [{ legacyStatus: 'reference-only', legacyPath: 'old/index.html' }, 0, 'explicit reference-only shape is valid'],
  ];
  for (const [profile, expectedIssues, label] of cases) {
    assert.equal(legacyAuthorityShapeIssues(profile).length, expectedIssues, label);
  }
  console.log(`Legacy authority shape contract: ${cases.length}/${cases.length} mutation cases passed`);
}

function validateLegacyAuthority(route, profile) {
  const shapeIssues = legacyAuthorityShapeIssues(profile);
  for (const message of shapeIssues) issue(`${route}: ${message}`);
  if (shapeIssues.length) return;

  if (profile.legacyStatus !== 'absent') {
    const rel = profile.legacyPath.replace(/^\//, '');
    if (!fileExists(rel)) issue(`${route}: declared legacyPath not found: ${profile.legacyPath}`);
  }
}

runLegacyAuthorityContractChecks();

console.log('=== Route Profile Contract Audit ===');
console.log(`Mode: ${strict ? 'STRICT' : 'WARN'}`);
console.log('Policy: every owned route is validated from registry data; route names never create exemptions.');
console.log('');

const { records, matrix } = loadRouteRecords();
let checked = 0;
let productionAstro = 0;
let semanticProtected = 0;

for (const record of records) {
  const { route, owner, profile, profileFile, sourceRel, matrix: matrixEntry } = record;
  if (owner.status === 'build-only' || owner.owner === 'built-app') continue;
  checked++;

  if (!profile) {
    issue(`${route}: missing route profile`);
    continue;
  }

  if (!profileFile) issue(`${route}: profile file could not be resolved`);
  if (profile.route !== route) issue(`${route}: profile.route=${profile.route || '(missing)'}`);
  if (profile.currentStatus && profile.currentStatus !== owner.status) {
    issue(`${route}: profile.currentStatus=${profile.currentStatus} != ownership.status=${owner.status}`);
  }
  if (profile.source !== owner.source) {
    issue(`${route}: profile.source=${profile.source || '(missing)'} != ownership.source=${owner.source || '(missing)'}`);
  }
  if (!sourceRel || !fileExists(sourceRel)) issue(`${route}: public source missing: ${sourceRel || '(missing)'}`);

  if (profile.scope) {
    if (!ALLOWED_SCOPES.has(profile.scope)) issue(`${route}: unknown profile.scope=${profile.scope}`);
    if (profile.scope === 'excluded-semantic-lane') semanticProtected++;
  }

  if (owner.owner === 'astro' && owner.status === 'production-dist') {
    productionAstro++;
    if (!profile.migrationMode) issue(`${route}: production Astro profile missing migrationMode`);
    if (!matrixEntry) issue(`${route}: production Astro route missing matrix entry`);
    validateLegacyAuthority(route, profile);
  }

  if (matrixEntry) {
    if (matrixEntry.source !== owner.source) {
      issue(`${route}: matrix.source=${matrixEntry.source || '(missing)'} != ownership.source=${owner.source || '(missing)'}`);
    }
    if (profile.migrationMode && matrixEntry.mode !== profile.migrationMode) {
      issue(`${route}: matrix.mode=${matrixEntry.mode || '(missing)'} != profile.migrationMode=${profile.migrationMode}`);
    }
    if (matrixEntry.scope && matrixEntry.scope !== profile.scope) {
      issue(`${route}: matrix.scope=${matrixEntry.scope} != profile.scope=${profile.scope || '(missing)'}`);
    }
    if (profile.scope && matrixEntry.scope !== profile.scope) {
      issue(`${route}: profile scope is not represented in matrix`);
    }
  }

  if (typeof profile.risk === 'number' && typeof owner.risk === 'number') {
    const diff = Math.abs(profile.risk - owner.risk);
    if (diff > 1) issue(`${route}: profile.risk=${profile.risk} vs ownership.risk=${owner.risk}`, false);
  }

  const sourceResult = validateRecord(record, { strict });
  errors.push(...sourceResult.errors);
  warnings.push(...sourceResult.warnings);
}

for (const route of Object.keys(matrix.routes || {})) {
  if (!records.some((record) => record.route === route)) issue(`${route}: matrix entry has no page-ownership route`);
}

console.log(`Routes checked: ${checked}`);
console.log(`Production Astro routes: ${productionAstro}`);
console.log(`Explicit semantic edit protections: ${semanticProtected}`);

if (warnings.length) {
  console.log('');
  console.log(`⚠️ Warnings (${warnings.length}):`);
  warnings.slice(0, 50).forEach((warning) => console.log(`  ⚠️ ${warning}`));
  if (warnings.length > 50) console.log(`  …and ${warnings.length - 50} more`);
}

if (errors.length) {
  console.log('');
  console.error(`❌ Route profile contract failed (${errors.length} error(s)):`);
  errors.slice(0, 80).forEach((error) => console.error(`  ❌ ${error}`));
  if (errors.length > 80) console.error(`  …and ${errors.length - 80} more`);
  process.exit(1);
}

console.log('');
console.log('✅ Route profiles agree with ownership, matrix, explicit legacy authority and actual source contracts');
