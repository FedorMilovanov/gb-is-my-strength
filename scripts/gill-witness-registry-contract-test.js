#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data', 'gill-witness-registry.json');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'gill-witness-registry');

const CLEARED_RIGHTS = new Set(['PUBLIC_DOMAIN', 'RIGHTS_CLEARED', 'OWNER_APPROVED']);
const ALLOWED_DISPOSITIONS = new Set([
  'PROMOTE',
  'REFERENCE',
  'SUPERSEDED',
  'BLOCKED_PROVENANCE',
]);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${path.relative(ROOT, file)} is not valid JSON: ${error.message}`);
  }
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateRecord(record) {
  const errors = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return ['record must be an object'];
  }
  if (!nonEmpty(record.id)) errors.push('record requires id');
  if (!ALLOWED_DISPOSITIONS.has(record.disposition)) {
    errors.push(`unsupported disposition: ${String(record.disposition)}`);
  }

  const projection = Array.isArray(record.publicProjection) ? record.publicProjection : [];
  if (projection.length > 0 && record.disposition !== 'PROMOTE') {
    errors.push('publicProjection requires disposition PROMOTE');
  }

  if (record.disposition === 'PROMOTE') {
    const required = [
      ['quote.original', record.quote?.original],
      ['quote.translation', record.quote?.translation],
      ['attribution', record.attribution],
      ['work', record.work],
      ['edition', record.edition],
      ['locator', record.locator],
      ['context', record.context],
    ];
    for (const [label, value] of required) {
      if (!nonEmpty(value)) errors.push(`PROMOTE requires ${label}`);
    }
    if (!CLEARED_RIGHTS.has(record.rights?.status)) {
      errors.push('PROMOTE requires cleared rights');
    }
    if (record.verification?.visualPageVerified !== true) {
      errors.push('PROMOTE requires source-page verification');
    }
    if (projection.length === 0) {
      errors.push('PROMOTE requires at least one publicProjection');
    }
  }

  return errors;
}

function validateRegistry(registry) {
  const errors = [];

  if (registry?.version !== 1) errors.push('registry version must be 1');
  if (!Array.isArray(registry?.records)) errors.push('registry records must be an array');

  const ids = new Set();
  for (const record of registry?.records || []) {
    for (const error of validateRecord(record)) {
      errors.push(`${record?.id || '<missing-id>'}: ${error}`);
    }
    if (ids.has(record?.id)) errors.push(`duplicate id: ${record.id}`);
    ids.add(record?.id);
  }

  if (registry?.storyMap?.disposition !== 'DELETE_DEAD_RUNTIME') {
    errors.push('StoryMap disposition must remain DELETE_DEAD_RUNTIME');
  }
  if (registry?.storyMap?.action !== 'NO_OP_NO_CURRENT_RUNTIME') {
    errors.push('StoryMap action must remain NO_OP_NO_CURRENT_RUNTIME');
  }
  if (!Array.isArray(registry?.storyMap?.currentRuntimePaths)
      || registry.storyMap.currentRuntimePaths.length !== 0) {
    errors.push('StoryMap currentRuntimePaths must remain empty');
  }

  return errors;
}

function validateFixtures() {
  const files = fs.readdirSync(FIXTURE_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort();
  const errors = [];

  for (const file of files) {
    const fixture = readJson(path.join(FIXTURE_DIR, file));
    const actual = validateRecord(fixture.mutation);
    const actualValid = actual.length === 0;

    if (actualValid !== fixture.expected?.valid) {
      errors.push(`${file}: expected valid=${fixture.expected?.valid}, got ${actualValid}`);
    }
    for (const expectedError of fixture.expected?.errors || []) {
      if (!actual.includes(expectedError)) {
        errors.push(`${file}: missing expected error "${expectedError}" (actual: ${actual.join('; ')})`);
      }
    }
  }

  return { files, errors };
}

function main() {
  const registry = readJson(REGISTRY_PATH);
  const registryErrors = validateRegistry(registry);
  const fixtures = validateFixtures();
  const errors = [...registryErrors, ...fixtures.errors];

  if (errors.length > 0) {
    console.error('GILL WITNESS REGISTRY CONTRACT: FAIL');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const dispositions = registry.records.reduce((acc, record) => {
    acc[record.disposition] = (acc[record.disposition] || 0) + 1;
    return acc;
  }, {});

  console.log(
    `GILL WITNESS REGISTRY CONTRACT: PASS `
    + `(${registry.records.length} records; ${fixtures.files.length} negative fixtures; `
    + `${JSON.stringify(dispositions)}; 0 public projections)`,
  );
}

main();
