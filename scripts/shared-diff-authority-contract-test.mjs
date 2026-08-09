#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  derivePullRequestDiffAuthority,
  listRangeFiles,
  mergeBase,
} from './shared-diff-authority.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 10_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-diff-authority-'));
try {
  git(['init', '--initial-branch=main', '.'], fixture);
  git(['config', 'user.name', 'Shared Diff Contract'], fixture);
  git(['config', 'user.email', 'shared-diff@example.invalid'], fixture);

  write(path.join(fixture, 'README.md'), 'base\n');
  git(['add', 'README.md'], fixture);
  git(['commit', '-m', 'base'], fixture);
  const originalPayloadBase = git(['rev-parse', 'HEAD'], fixture);

  git(['switch', '-c', 'feature'], fixture);
  write(path.join(fixture, 'feature.txt'), 'feature-owned\n');
  git(['add', 'feature.txt'], fixture);
  git(['commit', '-m', 'feature work'], fixture);
  const headBeforeRefresh = git(['rev-parse', 'HEAD'], fixture);

  git(['switch', 'main'], fixture);
  write(path.join(fixture, '.github/workflows/base-only-protected.yml'), 'name: base-only\n');
  git(['add', '.github/workflows/base-only-protected.yml'], fixture);
  git(['commit', '-m', 'main adds protected file'], fixture);
  const liveBaseAfterMove = git(['rev-parse', 'HEAD'], fixture);

  // 1. Base moved after PR creation: effective ownership starts at the real common ancestor.
  const movedMergeBase = mergeBase(liveBaseAfterMove, headBeforeRefresh, fixture);
  assert.equal(movedMergeBase, originalPayloadBase);
  const moved = derivePullRequestDiffAuthority({
    liveBaseSha: liveBaseAfterMove,
    headSha: headBeforeRefresh,
    mergeParents: [liveBaseAfterMove, headBeforeRefresh],
    mergeBaseSha: movedMergeBase,
    payloadBaseSha: originalPayloadBase,
  });
  assert.equal(moved.effectiveBaseSha, originalPayloadBase);

  // 3. A stale payload SHA is recorded but does not become diff authority.
  assert.equal(moved.payloadBaseStale, true);
  assert.notEqual(moved.liveBaseSha, moved.payloadBaseSha);

  // 4. A protected file already merged only on the target side disappears from feature ownership.
  assert.deepEqual(listRangeFiles(moved.effectiveBaseSha, moved.headSha, fixture), ['feature.txt']);
  assert.equal(
    listRangeFiles(moved.effectiveBaseSha, moved.headSha, fixture)
      .includes('.github/workflows/base-only-protected.yml'),
    false,
  );

  // 2. After the feature absorbs current main, the live target itself becomes the merge-base.
  git(['switch', 'feature'], fixture);
  git(['merge', '--no-edit', 'main'], fixture);
  write(path.join(fixture, 'feature-after-refresh.txt'), 'post-refresh feature work\n');
  git(['add', 'feature-after-refresh.txt'], fixture);
  git(['commit', '-m', 'feature after main refresh'], fixture);
  const headAfterRefresh = git(['rev-parse', 'HEAD'], fixture);
  const refreshedMergeBase = mergeBase(liveBaseAfterMove, headAfterRefresh, fixture);
  assert.equal(refreshedMergeBase, liveBaseAfterMove);
  const refreshed = derivePullRequestDiffAuthority({
    liveBaseSha: liveBaseAfterMove,
    headSha: headAfterRefresh,
    mergeParents: [liveBaseAfterMove, headAfterRefresh],
    mergeBaseSha: refreshedMergeBase,
    payloadBaseSha: originalPayloadBase,
  });
  assert.equal(refreshed.effectiveBaseSha, liveBaseAfterMove);
  assert.equal(refreshed.payloadBaseStale, true);
  assert.deepEqual(
    listRangeFiles(refreshed.effectiveBaseSha, refreshed.headSha, fixture),
    ['feature-after-refresh.txt', 'feature.txt'],
  );

  // Fail closed when the checked PR merge ref cannot prove current base/head parentage.
  assert.throws(() => derivePullRequestDiffAuthority({
    liveBaseSha: liveBaseAfterMove,
    headSha: headAfterRefresh,
    mergeParents: [originalPayloadBase, headAfterRefresh],
    mergeBaseSha: refreshedMergeBase,
    payloadBaseSha: originalPayloadBase,
  }), /does not match live target/);
  assert.throws(() => derivePullRequestDiffAuthority({
    liveBaseSha: liveBaseAfterMove,
    headSha: headAfterRefresh,
    mergeParents: [liveBaseAfterMove, originalPayloadBase],
    mergeBaseSha: refreshedMergeBase,
    payloadBaseSha: originalPayloadBase,
  }), /does not match current PR head/);
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}

const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/shared-files-guard.yml'), 'utf8');
assert.match(workflow, /id: pr-authority/, 'Shared Files workflow must resolve one PR diff authority');
assert.ok(
  (workflow.match(/steps\.pr-authority\.outputs\.effective_base/g) || []).length >= 2,
  'Collision accounting and protected diff must consume the same effective base output',
);
assert.ok(
  (workflow.match(/steps\.pr-authority\.outputs\.effective_head/g) || []).length >= 2,
  'Collision accounting and protected diff must consume the same effective head output',
);
assert.equal(
  workflow.includes('BASE_SHA: ${{ github.event.pull_request.base.sha || github.event.before }}'),
  false,
  'Historical PR payload base SHA must not directly drive protected diff',
);

const collisionSource = fs.readFileSync(path.join(ROOT, 'scripts/lane-collision-guard.mjs'), 'utf8');
assert.match(collisionSource, /listRangeFiles\(effectiveBaseSha, effectiveHeadSha\)/);
assert.equal(
  collisionSource.includes('/pulls/${prNumber}/files'),
  false,
  'Current PR ownership must not come from an independently based PR-files payload',
);

console.log('Shared PR diff authority contract: PASS (base move, absorbed main, stale payload, merged protected-file retirement + fail-closed parent proof)');
