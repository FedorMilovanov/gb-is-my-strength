#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  analyzeCollisions,
  isDerivedProjectionPath,
  normalizeRepoPath,
  predecessorSupersededByCurrent,
} from './lane-collision-guard.mjs';

const repo = 'FedorMilovanov/gb-is-my-strength';
const current = { number: 1057, repo, baseRef: 'main' };

{
  const result = analyzeCollisions({
    current,
    currentFiles: ['src/components/home/HomeSections/Quote.astro', 'scripts/home-browser-contract.mjs'],
    candidates: [{
      number: 1056,
      title: 'fix(home): make quote mirror static',
      body: '',
      baseRef: 'main',
      headRepo: repo,
      files: ['src/components/home/HomeSections/Quote.astro', 'data/scripture-search-index.json'],
    }],
  });
  assert.deepEqual(result.blockers.map((entry) => entry.number), [1056]);
  assert.deepEqual(result.blockers[0].files, ['src/components/home/HomeSections/Quote.astro']);
}

{
  const result = analyzeCollisions({
    current: { number: 1152, repo, baseRef: 'main' },
    currentFiles: ['scripts/live-release-contract.mjs'],
    candidates: [{
      number: 1150,
      title: 'independent Home change',
      body: '',
      baseRef: 'main',
      headRepo: repo,
      files: ['src/components/home/HomeMarginalia.astro'],
    }],
  });
  assert.equal(result.blockers.length, 0);
  assert.equal(result.warnings.length, 0);
}

{
  const result = analyzeCollisions({
    current,
    currentFiles: ['data/scripture-search-index.json', 'src/lib/asset-version.js'],
    candidates: [{
      number: 1055,
      title: 'independent generated projection',
      body: '',
      baseRef: 'main',
      headRepo: repo,
      files: ['data/scripture-search-index.json', 'src/lib/asset-version.js'],
    }],
  });
  assert.equal(result.blockers.length, 0);
  assert.deepEqual(result.warnings[0].files, ['data/scripture-search-index.json', 'src/lib/asset-version.js']);
}

{
  const candidate = {
    number: 1056,
    title: '[SUPERSEDED BY #1057 — DO NOT MERGE] old lane',
    body: '',
    baseRef: 'main',
    headRepo: repo,
    files: ['src/components/home/HomeSections/Quote.astro'],
  };
  assert.equal(predecessorSupersededByCurrent(candidate, 1057), true);
  const result = analyzeCollisions({
    current,
    currentFiles: ['src/components/home/HomeSections/Quote.astro'],
    candidates: [candidate],
  });
  assert.equal(result.blockers.length, 0);
  assert.deepEqual(result.ignored, [{ number: 1056, reason: 'explicitly-superseded-by-current' }]);
}

{
  const result = analyzeCollisions({
    current,
    currentFiles: ['js/site-utils.js'],
    candidates: [{
      number: 1060,
      title: 'newer duplicate',
      body: '',
      baseRef: 'main',
      headRepo: repo,
      files: ['js/site-utils.js'],
    }],
  });
  assert.equal(result.blockers.length, 0);
  assert.deepEqual(result.ignored, [{ number: 1060, reason: 'newer-pr-does-not-own-precedence' }]);
}

{
  const result = analyzeCollisions({
    current,
    currentFiles: ['js/site-utils.js'],
    candidates: [{
      number: 1050,
      title: 'fork contribution',
      body: '',
      baseRef: 'main',
      headRepo: 'someone/fork',
      files: ['js/site-utils.js'],
    }],
  });
  assert.equal(result.blockers.length, 0);
  assert.deepEqual(result.ignored, [{ number: 1050, reason: 'different-head-repository' }]);
}

assert.equal(normalizeRepoPath('./src/lib/asset-version.js'), 'src/lib/asset-version.js');
assert.equal(isDerivedProjectionPath('data/legacy-reference-ledger/references-3.json'), true);
assert.throws(() => normalizeRepoPath('../escape'), /Unsafe repository path/);
assert.throws(() => normalizeRepoPath('/absolute'), /Unsafe repository path/);

console.log('Lane collision guard contract: PASS (6 collision scenarios + path boundary checks)');
