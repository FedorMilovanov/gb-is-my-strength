#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const MAIN_SHA = '998cd60759c535af0f542c31d5fc8e2948440c02';
const REPORT = path.join(ROOT, 'reports', 'terminal-branch-cleanup', 'result.json');

const ancestryTargets = [
  'agent/krajne-schema-image-dimensions-20260810',
  'agent/krajne-schema-image-dimensions-v2-20260810',
  'lane/system-search-scope-overlay-2026-08-11-final',
  'lane/system-search-scope-semantics-2026-08-11-byteclean',
  'lane/system-search-scope-semantics-clean-20260811',
];

const supersededTargets = [
  {
    branch: 'agent/reader-linear-meta-content-20260810',
    expectedHead: 'a796f135a88a9c1a6cbddf03bc5a2c15007c0c6c',
    successor: 'ccfa22a47297b552aa1e934a7f63df524c110c2b',
    evidence: 'closed predecessor #1568 -> merged successor #1610',
  },
  {
    branch: 'agent/search-scope-semantics-fresh-20260811',
    expectedHead: null,
    successor: 'd18ce559e166837380550c5cfd91db5687a3628f',
    evidence: 'single Search-only transplant base superseded by terminal #1637',
    specialSearchBase: true,
  },
  {
    branch: 'agent/sw-toast-a11y-20260811',
    expectedHead: 'bd87b06468a6367a7e2db303136cb4be58c0a2db',
    successor: '8a9520e776cd607c4ac287517be2c71ffdc70301',
    evidence: 'closed predecessor #1614 -> merged successor #1627',
  },
  {
    branch: 'chore/cache-bust-normalizer-frontend-assets-20260811',
    expectedHead: '646ab4413d22d05af3bbc5c8974f65317d6bfce6',
    successor: 'ff06fa92837fb10a62d1f589c4a35d45cdff73ff',
    evidence: 'closed predecessor #1618 -> merged successor #1621',
  },
  {
    branch: 'lane/system-search-scope-semantics-2026-08-11',
    expectedHead: '9c39e7e0d5f223323ab7fd79b1aad0939624a26f',
    successor: 'd18ce559e166837380550c5cfd91db5687a3628f',
    evidence: 'closed transplant #1633 -> terminal merged #1637',
  },
  {
    branch: 'lane/system-search-scope-semantics-final-20260811',
    expectedHead: 'aa99304f9e6ece163e344a7c818205ffd7759127',
    successor: 'd18ce559e166837380550c5cfd91db5687a3628f',
    evidence: 'closed invalid candidate #1645 -> terminal clean #1637',
  },
  {
    branch: 'lane/system-site-menu-failsafe-2026-08-10',
    expectedHead: '9a8d71a5cbd546b8880072132f1d869d0ae2cf55',
    successor: '9aba01c60b4c680c2121f8ef78db816138caa004',
    evidence: 'closed predecessor #1584 -> terminal successor #1613',
  },
  {
    branch: 'lane/system-site-menu-failsafe-2026-08-11',
    expectedHead: '66108b271de576f83f5157355efae64b99653166',
    successor: '9aba01c60b4c680c2121f8ef78db816138caa004',
    evidence: 'closed predecessor #1608 -> terminal successor #1613',
  },
];

const targets = [
  ...ancestryTargets.map((branch) => ({ branch, disposition: 'FULLY_REPRESENTED_BY_ANCESTRY' })),
  ...supersededTargets.map((entry) => ({ ...entry, disposition: entry.branch.includes('semantics-final') ? 'DIAGNOSTIC_DISPOSABLE' : 'SUPERSEDED_VERIFIED' })),
];

assert.equal(targets.length, 13, 'terminal branch set must remain exactly 13 refs');
assert.equal(new Set(targets.map((target) => target.branch)).size, targets.length, 'duplicate cleanup target');
assert.ok(!targets.some((target) => target.branch === 'main'), 'main must never be a cleanup target');

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    maxBuffer: 8 * 1024 * 1024,
    env: process.env,
  }).trim();
}

function remoteSha(branch) {
  const output = git(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]);
  if (!output) return null;
  const lines = output.split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 1, `ambiguous remote ref for ${branch}`);
  const [sha, ref] = lines[0].split(/\s+/);
  assert.equal(ref, `refs/heads/${branch}`, `unexpected remote ref for ${branch}`);
  assert.match(sha, /^[0-9a-f]{40}$/, `invalid remote SHA for ${branch}`);
  return sha;
}

function isAncestor(ancestor, descendant) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function refreshRefs() {
  execFileSync('git', ['fetch', '--no-tags', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
}

function assertFrozenMain() {
  const main = remoteSha('main');
  assert.equal(main, MAIN_SHA, `main moved during cleanup transaction: ${main}`);
  return main;
}

function classifyAll() {
  refreshRefs();
  assertFrozenMain();
  const results = [];

  for (const target of targets) {
    const sha = remoteSha(target.branch);
    assert.ok(sha, `target branch is unexpectedly absent before transaction: ${target.branch}`);

    if (target.disposition === 'FULLY_REPRESENTED_BY_ANCESTRY') {
      assert.equal(isAncestor(sha, MAIN_SHA), true, `${target.branch} is no longer fully represented by main ancestry`);
    } else {
      if (target.expectedHead) {
        assert.equal(sha, target.expectedHead, `${target.branch} moved since audited predecessor evidence`);
      }
      assert.equal(isAncestor(target.successor, MAIN_SHA), true, `${target.branch} successor is not contained in frozen main`);

      if (target.specialSearchBase) {
        const mergeBase = git(['merge-base', sha, MAIN_SHA]);
        assert.equal(mergeBase, '8a9520e776cd607c4ac287517be2c71ffdc70301', 'Search transplant base changed');
        const ahead = Number(git(['rev-list', '--count', `${mergeBase}..${sha}`]));
        assert.equal(ahead, 1, 'Search transplant base must contain exactly one unique commit');
        const files = git(['diff', '--name-only', mergeBase, sha]).split(/\r?\n/).filter(Boolean).sort();
        assert.deepEqual(files, ['js/search.js'], 'Search transplant base must remain Search-only');
      }
    }

    results.push({
      branch: target.branch,
      sha,
      disposition: target.disposition,
      successor: target.successor || null,
      evidence: target.evidence || 'branch head is an ancestor of frozen main',
    });
  }

  return results;
}

function writeCleanup() {
  const classified = classifyAll();

  for (const target of classified) {
    assertFrozenMain();
    const live = remoteSha(target.branch);
    assert.equal(live, target.sha, `${target.branch} changed after preflight`);
    execFileSync(
      'git',
      [
        'push',
        `--force-with-lease=refs/heads/${target.branch}:${target.sha}`,
        'origin',
        `:refs/heads/${target.branch}`,
      ],
      { cwd: ROOT, stdio: 'inherit', env: process.env },
    );
    assert.equal(remoteSha(target.branch), null, `${target.branch} still exists after CAS deletion`);
  }

  assertFrozenMain();
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, `${JSON.stringify({
    schemaVersion: 1,
    mainSha: MAIN_SHA,
    targetCount: classified.length,
    targets: classified,
    result: 'ALL_TARGET_REFS_DELETED',
  }, null, 2)}\n`, 'utf8');
  console.log(`TERMINAL BRANCH CLEANUP: PASS (${classified.length} verified refs deleted)`);
}

function checkCleanup() {
  assertFrozenMain();
  assert.ok(fs.existsSync(REPORT), 'cleanup result report missing');
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.equal(report.mainSha, MAIN_SHA, 'cleanup report main SHA mismatch');
  assert.equal(report.targetCount, 13, 'cleanup report target count mismatch');
  for (const target of targets) {
    assert.equal(remoteSha(target.branch), null, `${target.branch} reappeared after cleanup`);
  }
  console.log('TERMINAL BRANCH CLEANUP CHECK: PASS (13 refs absent; main frozen)');
}

if (process.argv.includes('--write')) writeCleanup();
else if (process.argv.includes('--check')) checkCleanup();
else throw new Error('Use exactly one of --write or --check');
