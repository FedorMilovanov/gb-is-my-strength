'use strict';

function parseBoundedWorkerCount(rawValue, {
  name = 'WORKERS',
  defaultValue,
  min = 1,
  max,
} = {}) {
  if (!Number.isInteger(defaultValue) || !Number.isInteger(min) || !Number.isInteger(max) || min < 1 || defaultValue < min || defaultValue > max) {
    throw new TypeError('parseBoundedWorkerCount received an invalid parser contract');
  }

  if (rawValue === undefined || rawValue === null || rawValue === '') return defaultValue;

  const text = String(rawValue).trim();
  if (!text) throw new Error(`${name} must be an integer between ${min} and ${max}; received blank input`);

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}; received ${JSON.stringify(String(rawValue))}`);
  }
  return parsed;
}

async function runBoundedWorkerPool(items, worker, workerCount) {
  if (!Array.isArray(items)) throw new TypeError('runBoundedWorkerPool items must be an array');
  if (typeof worker !== 'function') throw new TypeError('runBoundedWorkerPool worker must be a function');
  if (!Number.isInteger(workerCount) || workerCount < 1) {
    throw new Error(`runBoundedWorkerPool requires a positive integer workerCount; received ${String(workerCount)}`);
  }
  if (items.length === 0) return 0;

  let cursor = 0;
  let completed = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index], index);
      completed += 1;
    }
  }

  const activeWorkers = Math.min(workerCount, items.length);
  if (activeWorkers < 1) throw new Error('runBoundedWorkerPool refused to schedule a non-empty work set with zero workers');
  await Promise.all(Array.from({ length: activeWorkers }, run));

  if (completed !== items.length) {
    throw new Error(`runBoundedWorkerPool coverage mismatch: completed ${completed}/${items.length}`);
  }
  return completed;
}

module.exports = { parseBoundedWorkerCount, runBoundedWorkerPool };
