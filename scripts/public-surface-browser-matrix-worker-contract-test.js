'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  parseBoundedWorkerCount,
  runBoundedWorkerPool,
} = require('./lib/bounded-worker-pool');

function mustRejectValue(value, contract) {
  assert.throws(
    () => parseBoundedWorkerCount(value, contract),
    new RegExp(`${contract.name} must be an integer between ${contract.min} and ${contract.max}`),
    `expected ${contract.name}=${JSON.stringify(value)} to fail closed`,
  );
}

function exerciseParserContract(contract, expectedDefault) {
  assert.equal(parseBoundedWorkerCount(undefined, contract), expectedDefault);
  assert.equal(parseBoundedWorkerCount('', contract), expectedDefault);
  assert.equal(parseBoundedWorkerCount('1', contract), 1);
  assert.equal(parseBoundedWorkerCount(' 2 ', contract), 2);
  assert.equal(parseBoundedWorkerCount(String(contract.max), contract), contract.max);

  for (const value of ['0', '-1', String(contract.max + 1), '1.5', 'nope', 'NaN', 'Infinity', '   ']) {
    mustRejectValue(value, contract);
  }
}

async function main() {
  const matrixContract = { name: 'GB_MATRIX_WORKERS', defaultValue: 4, min: 1, max: 4 };
  const crossBrowserContract = { name: 'GB_CROSS_BROWSER_WORKERS', defaultValue: 2, min: 1, max: 4 };
  exerciseParserContract(matrixContract, 4);
  exerciseParserContract(crossBrowserContract, 2);

  const crossBrowserSource = readFileSync(join(__dirname, 'public-surface-cross-browser-matrix.mjs'), 'utf8');
  assert.match(
    crossBrowserSource,
    /parseBoundedWorkerCount\(process\.env\.GB_CROSS_BROWSER_WORKERS,\s*\{[\s\S]*?name:\s*'GB_CROSS_BROWSER_WORKERS',[\s\S]*?defaultValue:\s*2,[\s\S]*?min:\s*1,[\s\S]*?max:\s*4,[\s\S]*?\}\)/,
    'cross-browser matrix must parse GB_CROSS_BROWSER_WORKERS through the shared fail-closed helper',
  );
  assert.match(
    crossBrowserSource,
    /runBoundedWorkerPool\(/,
    'cross-browser matrix must execute cases through the shared bounded worker pool',
  );
  assert.doesNotMatch(
    crossBrowserSource,
    /Number\(process\.env\.GB_CROSS_BROWSER_WORKERS/,
    'cross-browser matrix must not restore the NaN-to-zero-runner parser',
  );

  const visited = [];
  const completed = await runBoundedWorkerPool(
    Array.from({ length: 9 }, (_, index) => index),
    async (item) => {
      await Promise.resolve();
      visited.push(item);
    },
    3,
  );
  assert.equal(completed, 9);
  assert.deepEqual([...visited].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(await runBoundedWorkerPool([], async () => {}, 2), 0);

  await assert.rejects(
    () => runBoundedWorkerPool([1], async () => {}, 0),
    /positive integer workerCount/,
  );
  await assert.rejects(
    () => runBoundedWorkerPool([1], async () => {}, Number.NaN),
    /positive integer workerCount/,
  );

  console.log('PUBLIC SURFACE BROWSER MATRIX WORKER CONTRACT: PASS');
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
