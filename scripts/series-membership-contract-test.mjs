#!/usr/bin/env node
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = path.join(ROOT, 'scripts/series-membership-contract.mjs');

function fixture(manifest) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'series-membership-')), 'series.json');
  fs.writeFileSync(file, typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
  return file;
}

function run(manifest) {
  return cp.spawnSync(process.execPath, [CONTRACT, `--series=${fixture(manifest)}`], { encoding: 'utf8' });
}

const valid = {
  'fixture-series': {
    title: 'Тестовая серия',
    baseUrl: '/articles/',
    searchPolicy: { landingRoute: '/fixture/', librarySection: 'Раздел', topicCategory: 'Тема' },
    parts: [
      { n: 1, slug: 'alpha-one', title: 'Альфа', status: 'published', readingTime: 10 },
      { n: 2, slug: 'beta-two', title: 'Бета', status: 'planned' },
    ],
  },
};

// 1. Valid manifest → PASS
let result = run(valid);
assert.equal(result.status, 0, `valid manifest must pass: ${result.stderr}`);
assert.match(result.stdout, /series=1, parts=2/);

// 2. Slug claimed by two series → FAIL (negative witness: membership authority)
result = run({
  ...valid,
  'second-series': { title: 'Вторая', parts: [{ n: 1, slug: 'alpha-one', title: 'Клон', status: 'draft' }] },
});
assert.equal(result.status, 1, `duplicate slug must fail: ${result.stdout}`);
assert.match(result.stderr, /slug "alpha-one" already belongs to fixture-series#1/);

// 3. Duplicate n within a series → FAIL (negative witness)
result = run({
  'fixture-series': { title: 'Тест', parts: [
    { n: 1, slug: 'alpha-one', title: 'А', status: 'published' },
    { n: 1, slug: 'beta-two', title: 'Б', status: 'published' },
  ] },
});
assert.equal(result.status, 1, `duplicate n must fail: ${result.stdout}`);
assert.match(result.stderr, /duplicate n=1/);

// 4. Unknown status → FAIL (typed status enum)
result = run({ 'fixture-series': { title: 'Тест', parts: [{ n: 1, slug: 'alpha-one', title: 'А', status: 'live' }] } });
assert.equal(result.status, 1, `unknown status must fail: ${result.stdout}`);
assert.match(result.stderr, /status must be one of published\/planned\/draft/);

// 5. Unknown series key → FAIL (closed shape)
result = run({ 'fixture-series': { title: 'Тест', weights: { a: 1 }, parts: [{ n: 1, slug: 'alpha-one', title: 'А', status: 'published' }] } });
assert.equal(result.status, 1, `unknown series key must fail: ${result.stdout}`);
assert.match(result.stderr, /unknown key "weights"/);

// 6. Empty parts → FAIL
result = run({ 'fixture-series': { title: 'Тест', parts: [] } });
assert.equal(result.status, 1, `empty parts must fail: ${result.stdout}`);
assert.match(result.stderr, /parts must be a non-empty array/);

// 7. searchPolicy missing required subkey → FAIL
result = run({ 'fixture-series': { title: 'Тест', searchPolicy: { landingRoute: '/x/' }, parts: [{ n: 1, slug: 'alpha-one', title: 'А', status: 'published' }] } });
assert.equal(result.status, 1, `incomplete searchPolicy must fail: ${result.stdout}`);
assert.match(result.stderr, /searchPolicy\.librarySection/);

// 8. Malformed JSON → exit 2
result = run('{ not json');
assert.equal(result.status, 2, `malformed JSON must exit 2: ${result.stdout}`);

console.log('✅ series membership contract test passed (8 cases, incl. 6 negative witnesses)');
