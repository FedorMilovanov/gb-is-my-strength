#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = path.join(ROOT, 'scripts', 'bible-reference-contract.mjs');
const LEGACY_FILE = path.join(ROOT, 'data', 'verses.json');

function runContract() {
  return spawnSync(process.execPath, [CONTRACT, '--strict'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

assert(!fs.existsSync(LEGACY_FILE), 'legacy verse authority must be absent before the regression test');

const baseline = runContract();
assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);

try {
  fs.writeFileSync(LEGACY_FILE, '{"Быт 1:1":"legacy fixture"}\n', 'utf8');
  const mutation = runContract();
  const output = `${mutation.stdout || ''}\n${mutation.stderr || ''}`;
  assert.notEqual(mutation.status, 0, 'reintroduced legacy verse authority must fail the strict contract');
  assert(output.includes('legacy verse authority must remain absent'), `missing fail-closed diagnostic:\n${output}`);
} finally {
  fs.rmSync(LEGACY_FILE, { force: true });
}

const restored = runContract();
assert.equal(restored.status, 0, restored.stderr || restored.stdout);
assert(!fs.existsSync(LEGACY_FILE), 'regression test must restore the repository tree');

console.log('Bible legacy authority regression passed: removed file is blocking if reintroduced and the tree is restored.');
