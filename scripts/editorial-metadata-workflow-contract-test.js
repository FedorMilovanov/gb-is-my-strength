#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'editorial-metadata-v3.yml');
const text = fs.readFileSync(WORKFLOW, 'utf8');
const failures = [];

function requireFirst(marker) {
  const index = text.indexOf(marker);
  if (index < 0) failures.push(`missing marker: ${marker}`);
  return index;
}

function requireLast(marker) {
  const index = text.lastIndexOf(marker);
  if (index < 0) failures.push(`missing marker: ${marker}`);
  return index;
}

const build = requireFirst('npm run strangler:build:production-like');
const preserve = requireFirst('cp data/editorial-metadata.json reports/editorial-metadata-frozen.json');
const structure = requireFirst('node scripts/editorial-metadata-registry.js --check');
const freeze = requireFirst('node scripts/editorial-metadata-freeze-audit.js');
const observe = requireFirst('node scripts/editorial-metadata-registry.js --write');
const observedCopy = requireFirst('cp data/editorial-metadata.json reports/editorial-metadata-observed.json');
const restore = requireLast('cp reports/editorial-metadata-frozen.json data/editorial-metadata.json');
const cleanDiff = requireFirst('git diff --exit-code -- data/editorial-metadata.json');

const ordered = [build, preserve, structure, freeze, observe, observedCopy, restore, cleanDiff];
if (ordered.every((value) => value >= 0)) {
  for (let index = 1; index < ordered.length; index++) {
    if (ordered[index] <= ordered[index - 1]) {
      failures.push('workflow transaction order must be build → preserve → structure → freeze → observe → copy → restore → clean diff');
      break;
    }
  }
}

if (/editorial-metadata-registry\.js\s+--write\s+--build/.test(text)) {
  failures.push('workflow must not refresh the registry before auditing the committed freeze');
}
if (!text.includes('reports/editorial-metadata-frozen.json')) {
  failures.push('artifact must preserve the committed freeze snapshot');
}
if (!text.includes('reports/editorial-metadata-observed.json')) {
  failures.push('artifact must preserve the current observed snapshot separately');
}
if (!text.includes('trap restore_registry EXIT')) {
  failures.push('observation step must restore the committed registry even when capture fails');
}

if (failures.length) {
  console.error(`❌ Editorial metadata workflow contract failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✅ Editorial metadata workflow preserves the committed freeze before capturing observations');
