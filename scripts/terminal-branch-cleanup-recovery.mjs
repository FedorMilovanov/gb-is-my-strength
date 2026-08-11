#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const MAIN_SHA = '998cd60759c535af0f542c31d5fc8e2948440c02';
const REPORT = path.join(ROOT, 'reports', 'terminal-branch-cleanup', 'result.json');
const PRIOR_RUN_ID = 31515063091;
const PRIOR_JOB_ID = 93858035085;

const targets = [
  ['agent/krajne-schema-image-dimensions-20260810', 'FULLY_REPRESENTED_BY_ANCESTRY', null],
  ['agent/krajne-schema-image-dimensions-v2-20260810', 'FULLY_REPRESENTED_BY_ANCESTRY', null],
  ['lane/system-search-scope-overlay-2026-08-11-final', 'FULLY_REPRESENTED_BY_ANCESTRY', null],
  ['lane/system-search-scope-semantics-2026-08-11-byteclean', 'FULLY_REPRESENTED_BY_ANCESTRY', null],
  ['lane/system-search-scope-semantics-clean-20260811', 'FULLY_REPRESENTED_BY_ANCESTRY', null],
  ['agent/reader-linear-meta-content-20260810', 'SUPERSEDED_VERIFIED', 'a796f135a88a9c1a6cbddf03bc5a2c15007c0c6c'],
  ['agent/search-scope-semantics-fresh-20260811', 'SUPERSEDED_VERIFIED', null],
  ['agent/sw-toast-a11y-20260811', 'SUPERSEDED_VERIFIED', 'bd87b06468a6367a7e2db303136cb4be58c0a2db'],
  ['chore/cache-bust-normalizer-frontend-assets-20260811', 'SUPERSEDED_VERIFIED', '646ab4413d22d05af3bbc5c8974f65317d6bfce6'],
  ['lane/system-search-scope-semantics-2026-08-11', 'SUPERSEDED_VERIFIED', '9c39e7e0d5f223323ab7fd79b1aad0939624a26f'],
  ['lane/system-search-scope-semantics-final-20260811', 'DIAGNOSTIC_DISPOSABLE', 'aa99304f9e6ece163e344a7c818205ffd7759127'],
  ['lane/system-site-menu-failsafe-2026-08-10', 'SUPERSEDED_VERIFIED', '9a8d71a5cbd546b8880072132f1d869d0ae2cf55'],
  ['lane/system-site-menu-failsafe-2026-08-11', 'SUPERSEDED_VERIFIED', '66108b271de576f83f5157355efae64b99653166'],
  ['terminal/branch-zero-20260811', 'DIAGNOSTIC_DISPOSABLE', '6418d777104bef718c06d6cd7b3e923576d12a54'],
].map(([branch, disposition, expectedHead]) => ({ branch, disposition, expectedHead }));

assert.equal(targets.length, 14);

function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 4 * 1024 * 1024,
  }).trim();
}

function remoteSha(branch) {
  const output = git(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]);
  if (!output) return null;
  const [line, ...rest] = output.split(/\r?\n/).filter(Boolean);
  assert.equal(rest.length, 0, `ambiguous remote ref: ${branch}`);
  const [sha, ref] = line.split(/\s+/);
  assert.equal(ref, `refs/heads/${branch}`);
  assert.match(sha, /^[0-9a-f]{40}$/);
  return sha;
}

function assertFrozenMain() {
  assert.equal(remoteSha('main'), MAIN_SHA, 'main moved after deletion transaction');
}

function state() {
  assertFrozenMain();
  const present = targets.filter((target) => remoteSha(target.branch) !== null);
  if (present.length === 0) return 'ALL_ABSENT';
  if (present.length === targets.length) return 'ALL_PRESENT';
  throw new Error(`PARTIAL_STATE:${present.map((target) => target.branch).join(',')}`);
}

function writeRecovery() {
  assert.equal(state(), 'ALL_ABSENT', 'recovery requires all 14 deletion targets to be absent');
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, `${JSON.stringify({
    schemaVersion: 1,
    mainSha: MAIN_SHA,
    targetCount: targets.length,
    result: 'ALL_TARGET_REFS_DELETED_RECOVERY_VERIFIED',
    deletionEvidence: {
      runId: PRIOR_RUN_ID,
      jobId: PRIOR_JOB_ID,
      writeStep: 'PASS',
      validationStep: 'PASS',
      tailFailure: 'receipt path was ignored by .gitignore before git add -f recovery',
    },
    targets: targets.map((target) => ({
      ...target,
      currentRemoteSha: null,
      verification: 'absent after prior exact-SHA/CAS deletion run',
    })),
  }, null, 2)}\n`, 'utf8');
  console.log(`TERMINAL BRANCH CLEANUP RECOVERY: PASS (${targets.length} refs absent; main frozen; prior run ${PRIOR_RUN_ID})`);
}

if (process.argv.includes('--state')) console.log(state());
else if (process.argv.includes('--write')) writeRecovery();
else throw new Error('Use --state or --write');
