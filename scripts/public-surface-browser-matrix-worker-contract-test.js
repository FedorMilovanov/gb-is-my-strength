'use strict';

const assert = require('node:assert/strict');
const {
  parseBoundedWorkerCount,
  runBoundedWorkerPool,
} = require('./lib/bounded-worker-pool');

function mustRejectValue(value) {
  assert.throws(
    () => parseBoundedWorkerCount(value, {
      name: 'GB_MATRIX_WORKERS',
      defaultValue: 4,
      min: 1,
      max: 4,
    }),
    /GB_MATRIX_WORKERS must be an integer between 1 and 4/,
    `expected ${JSON.stringify(value)} to fail closed`,
  );
}

async function main() {
  const contract = { name: 'GB_MATRIX_WORKERS', defaultValue: 4, min: 1, max: 4 };
  assert.equal(parseBoundedWorkerCount(undefined, contract), 4);
  assert.equal(parseBoundedWorkerCount('', contract), 4);
  assert.equal(parseBoundedWorkerCount('1', contract), 1);
  assert.equal(parseBoundedWorkerCount(' 2 ', contract), 2);
  assert.equal(parseBoundedWorkerCount('4', contract), 4);

  for (const value of ['0', '-1', '5', '1.5', 'nope', 'NaN', 'Infinity', '   ']) {
    mustRejectValue(value);
  }

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
