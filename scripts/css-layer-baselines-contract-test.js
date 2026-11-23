#!/usr/bin/env node
/*
 * css-layer-baselines-contract-test.js — ratchet contract for
 * SYS-CSS-CASCADE-GOVERNANCE: per-root layered floors are enforced, genesis
 * floors can only move up, schema errors fail closed.
 */
'use strict';
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const VALIDATOR = path.join(ROOT, 'scripts', 'css-layer-validator.js');

function writeFixture(dir, layeredChars, unlayeredChars) {
  const file = path.join(dir, 'fixture.css');
  const layered = `@layer components{${'.a{color:red}'.repeat(Math.ceil(layeredChars / 13)).slice(0, layeredChars)}}`;
  const unlayered = '.b{color:blue}'.repeat(Math.ceil(unlayeredChars / 15)).slice(0, unlayeredChars);
  fs.writeFileSync(file, `${layered}\n${unlayered}\n`);
  return file;
}

function run(cwd, args) {
  return cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'css-layer-validator.js'), ...args], {
    cwd,
    encoding: 'utf8',
  });
}

// 1. Fixture above the explicit floor → PASS
let dir = fs.mkdtempSync(path.join(os.tmpdir(), 'css-ratchet-'));
let css = writeFixture(dir, 600, 400); // 60% layered
let result = run(dir, [css, '--single', '--floor=50']);
assert.equal(result.status, 0, `above floor must pass: ${result.stdout}${result.stderr}`);
assert.match(result.stdout, /ratchet floor 50%: OK/);

// 2. Fixture below the explicit floor → FAIL (negative witness: the ratchet bites)
result = run(dir, [css, '--single', '--floor=70']);
assert.equal(result.status, 1, `below floor must fail: ${result.stdout}`);
assert.match(result.stdout, /under the ratchet floor 70%/);

// 3. Invalid floor value → exit 2
result = run(dir, [css, '--single', '--floor=abc']);
assert.equal(result.status, 2, `invalid floor must exit 2: ${result.status}`);

// 4. Malformed baselines file in a repo-like cwd → exit 2 (fail closed)
dir = fs.mkdtempSync(path.join(os.tmpdir(), 'css-ratchet-'));
fs.mkdirSync(path.join(dir, 'css'));
fs.mkdirSync(path.join(dir, 'data'));
css = writeFixture(dir, 600, 400);
fs.writeFileSync(path.join(dir, 'data', 'css-cascade-baselines.json'), '{ not json');
result = run(dir, [css, '--single']);
assert.equal(result.status, 2, `malformed baselines must exit 2: ${result.status}`);
assert.match(result.stderr, /invalid JSON/);

// 5. Baselines root unknown to the governed set → exit 2
fs.writeFileSync(path.join(dir, 'data', 'css-cascade-baselines.json'), JSON.stringify({
  schemaVersion: 1,
  roots: {
    'css/site.css': { layeredFloorPct: 18.0, importantCeiling: 200 },
    'css/home.css': { layeredFloorPct: 35.3, importantCeiling: null },
    'css/floating-cluster.css': { layeredFloorPct: 10.1, importantCeiling: 524 },
    'css/rogue.css': { layeredFloorPct: 1.0, importantCeiling: null },
  },
}));
result = run(dir, [css, '--single']);
assert.equal(result.status, 2, `rogue baseline root must exit 2: ${result.status}`);
assert.match(result.stderr, /not a governed @layer root/);

// 6. Real governed roots pass their ratchet floors (current repo state)
for (const [file, floor] of [['css/site.css', 18.0], ['css/home.css', 35.3], ['css/floating-cluster.css', 10.1]]) {
  result = run(ROOT, [file, '--single']);
  assert.equal(result.status, 0, `${file} must pass its floor ${floor}: ${result.stdout}${result.stderr}`);
  assert.match(result.stdout, new RegExp(`ratchet floor ${String(floor).replace('.', '\\.')}%: OK`));
}

// 7. A governed root below its floor fails even when the ceiling passes
// (negative witness against a synthetic regression of the real file)
dir = fs.mkdtempSync(path.join(os.tmpdir(), 'css-ratchet-'));
const regressed = path.join(dir, 'site-like.css');
const site = fs.readFileSync(path.join(ROOT, 'css', 'site.css'), 'utf8');
fs.writeFileSync(regressed, `${site}\n${'.x{color:red}'.repeat(5000)}\n`); // dilutes layered %
result = run(dir, [regressed, '--single', '--floor=18.0']);
assert.equal(result.status, 1, `diluted layering must fail the 18.0 floor: ${result.stdout.slice(-200)}`);

console.log('✅ css layer baselines contract test passed (7 groups, incl. 4 negative witnesses)');
