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

const transaction = requireFirst('node scripts/editorial-metadata-workflow-contract-test.js');
const preservation = requireFirst('node scripts/editorial-metadata-registry-preservation-test.js');
const build = requireFirst('npm run strangler:build:production-like');
const frozenSnapshot = requireFirst('node scripts/editorial-metadata-snapshot.js \\\n            --out=reports/editorial-metadata-frozen.json');
const structure = requireFirst('node scripts/editorial-metadata-registry.js --check');
const freeze = requireFirst('node scripts/editorial-metadata-freeze-audit.js');
const observe = requireFirst('node scripts/editorial-metadata-registry.js --write');
const observedSnapshot = requireFirst('node scripts/editorial-metadata-snapshot.js \\\n            --out=reports/editorial-metadata-observed.json');
const restoreCall = requireFirst('restore_registry\n          trap - EXIT');
const cleanDiff = requireFirst('git diff --exit-code -- \\\n            data/editorial-metadata.json \\\n            data/editorial-metadata-supplements');
const semanticReport = requireFirst('node scripts/editorial-metadata-semantic-divergence.js');
const diffReport = requireFirst('node scripts/editorial-metadata-diff-report.js');

const ordered = [
  transaction,
  preservation,
  build,
  frozenSnapshot,
  structure,
  freeze,
  observe,
  observedSnapshot,
  restoreCall,
  cleanDiff,
  semanticReport,
  diffReport,
];
if (ordered.every((value) => value >= 0)) {
  for (let index = 1; index < ordered.length; index++) {
    if (ordered[index] <= ordered[index - 1]) {
      failures.push('workflow transaction order must be contract → preservation → build → effective frozen snapshot → structure → freeze → observe → effective observed snapshot → restore → clean diff → semantic report → machine diff');
      break;
    }
  }
}

if (/editorial-metadata-registry\.js\s+--write\s+--build/.test(text)) {
  failures.push('workflow must not refresh the registry before auditing the committed freeze');
}
if (/cp\s+data\/editorial-metadata\.json\s+reports\/editorial-metadata-(?:frozen|observed)\.json/.test(text)) {
  failures.push('workflow must snapshot the effective registry instead of copying only the base registry file');
}
if (!text.includes('restore_registry() {\n            git restore --source=HEAD --worktree -- \\\n              data/editorial-metadata.json \\\n              data/editorial-metadata-supplements\n          }')) {
  failures.push('restore function must restore both base registry and supplement ownership from exact HEAD');
}
if (!text.includes('reports/editorial-metadata-frozen.json')) failures.push('artifact must preserve the effective committed freeze snapshot');
if (!text.includes('reports/editorial-metadata-observed.json')) failures.push('artifact must preserve the effective current observed snapshot separately');
if (!text.includes('reports/editorial-metadata-semantic-divergence.json')) failures.push('artifact must preserve precision-aware semantic divergence evidence');
if (!text.includes('reports/editorial-metadata-diff.json')) failures.push('artifact must preserve the machine-readable frozen/observed diff');
if (!text.includes('--forbid-editorial-drift')) failures.push('observed refresh must fail when editorial decisions drift');
if (!text.includes('trap restore_registry EXIT')) failures.push('observation step must restore the committed registry even when capture fails');
if (!text.includes('data/editorial-metadata-supplements')) failures.push('supplement registry ownership must participate in restore and clean-diff proof');

if (failures.length) {
  console.error(`❌ Editorial metadata workflow contract failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}
console.log('✅ Editorial metadata workflow snapshots and restores the complete effective registry and forbids editorial drift');
