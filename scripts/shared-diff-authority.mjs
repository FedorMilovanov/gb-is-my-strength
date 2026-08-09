#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA_RE = /^[0-9a-f]{40}$/i;

function git(args, cwd = ROOT) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function requireSha(value, label) {
  const sha = String(value || '').trim();
  if (!SHA_RE.test(sha)) throw new Error(`${label} must be a full 40-character commit SHA`);
  return sha.toLowerCase();
}

function requireBaseRef(value) {
  const baseRef = String(value || '').trim();
  if (!baseRef) throw new Error('PR base ref is required');
  if (baseRef.startsWith('-') || baseRef.includes('..') || /[\s~^:?*[\\]/.test(baseRef)) {
    throw new Error(`Unsafe PR base ref: ${baseRef}`);
  }
  return baseRef;
}

function verifyCommit(ref, label, cwd = ROOT) {
  try {
    git(['rev-parse', '--verify', `${ref}^{commit}`], cwd);
  } catch {
    throw new Error(`${label} is not a locally available commit: ${ref}`);
  }
}

function assertAncestor(ancestor, descendant, label, cwd = ROOT) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd,
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error(`${label}: ${ancestor} is not an ancestor of ${descendant}`);
  }
}

export function derivePullRequestDiffAuthority({
  liveBaseSha,
  headSha,
  mergeParents,
  mergeBaseSha,
  payloadBaseSha = '',
}) {
  const liveBase = requireSha(liveBaseSha, 'Live base SHA');
  const head = requireSha(headSha, 'PR head SHA');
  const effectiveBase = requireSha(mergeBaseSha, 'Merge-base SHA');
  const parents = Array.isArray(mergeParents)
    ? mergeParents.map((sha, index) => requireSha(sha, `Merge parent ${index + 1}`))
    : [];

  if (parents.length !== 2) {
    throw new Error(`Checked PR merge ref must have exactly two parents; got ${parents.length}`);
  }
  if (parents[0] !== liveBase) {
    throw new Error(`Checked PR merge ref base parent ${parents[0]} does not match live target ${liveBase}`);
  }
  if (parents[1] !== head) {
    throw new Error(`Checked PR merge ref head parent ${parents[1]} does not match current PR head ${head}`);
  }

  const payload = String(payloadBaseSha || '').trim();
  const normalizedPayload = payload ? requireSha(payload, 'Payload base SHA') : '';

  return Object.freeze({
    liveBaseSha: liveBase,
    headSha: head,
    effectiveBaseSha: effectiveBase,
    payloadBaseSha: normalizedPayload,
    payloadBaseStale: Boolean(normalizedPayload && normalizedPayload !== liveBase),
  });
}

export function listRangeFiles(base, head, cwd = ROOT) {
  verifyCommit(base, 'Effective base', cwd);
  verifyCommit(head, 'Effective head', cwd);
  const output = git([
    'diff',
    '--name-only',
    '--diff-filter=ACMRD',
    base,
    head,
    '--',
  ], cwd);
  return output ? output.split('\n').filter(Boolean).sort() : [];
}

export function mergeBase(base, head, cwd = ROOT) {
  verifyCommit(base, 'Live base', cwd);
  verifyCommit(head, 'PR head', cwd);
  const resolved = git(['merge-base', base, head], cwd);
  return requireSha(resolved, 'Computed merge-base');
}

export function resolvePullRequestDiffAuthority({
  prNumber,
  baseRef,
  headSha,
  payloadBaseSha = '',
  cwd = ROOT,
  fetchRemote = true,
}) {
  const number = Number(prNumber);
  if (!Number.isInteger(number) || number <= 0) throw new Error('PR number must be a positive integer');
  const target = requireBaseRef(baseRef);
  const head = requireSha(headSha, 'PR head SHA');

  const liveBaseRef = `refs/remotes/origin/${target}`;
  const mergeRef = `refs/remotes/pull/${number}/merge`;

  if (fetchRemote) {
    git([
      'fetch',
      '--no-tags',
      '--force',
      'origin',
      `+refs/heads/${target}:${liveBaseRef}`,
      `+refs/pull/${number}/merge:${mergeRef}`,
    ], cwd);
  }

  verifyCommit(liveBaseRef, 'Live target ref', cwd);
  verifyCommit(mergeRef, 'Checked PR merge ref', cwd);
  verifyCommit(head, 'Current PR head', cwd);

  const liveBaseSha = requireSha(git(['rev-parse', liveBaseRef], cwd), 'Live base SHA');
  const mergeRefSha = requireSha(git(['rev-parse', mergeRef], cwd), 'PR merge ref SHA');
  const parentLine = git(['rev-list', '--parents', '-n', '1', mergeRefSha], cwd).split(/\s+/);
  const mergeParents = parentLine.slice(1);
  const mergeBaseSha = mergeBase(liveBaseSha, head, cwd);

  assertAncestor(mergeBaseSha, liveBaseSha, 'Merge-base proof against live target', cwd);
  assertAncestor(mergeBaseSha, head, 'Merge-base proof against PR head', cwd);

  const authority = derivePullRequestDiffAuthority({
    liveBaseSha,
    headSha: head,
    mergeParents,
    mergeBaseSha,
    payloadBaseSha,
  });
  const changedFiles = listRangeFiles(authority.effectiveBaseSha, authority.headSha, cwd);

  return Object.freeze({
    ...authority,
    baseRef: target,
    prNumber: number,
    mergeRefSha,
    changedFiles,
  });
}

function appendOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, 'utf8');
}

function runCli(env = process.env) {
  const authority = resolvePullRequestDiffAuthority({
    prNumber: env.PR_NUMBER,
    baseRef: env.PR_BASE_REF,
    headSha: env.PR_HEAD_SHA,
    payloadBaseSha: env.PR_PAYLOAD_BASE_SHA || '',
  });

  fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'reports', 'shared-pr-diff-authority.json'),
    `${JSON.stringify(authority, null, 2)}\n`,
    'utf8',
  );

  appendOutput('effective_base', authority.effectiveBaseSha);
  appendOutput('effective_head', authority.headSha);
  appendOutput('live_base', authority.liveBaseSha);
  appendOutput('merge_ref', authority.mergeRefSha);
  appendOutput('payload_base_stale', authority.payloadBaseStale ? 'true' : 'false');

  console.log(`Shared PR diff authority: PR #${authority.prNumber} -> ${authority.baseRef}`);
  console.log(`  live target:    ${authority.liveBaseSha}`);
  console.log(`  current head:   ${authority.headSha}`);
  console.log(`  checked merge:  ${authority.mergeRefSha}`);
  console.log(`  effective base: ${authority.effectiveBaseSha}`);
  console.log(`  payload stale:  ${authority.payloadBaseStale ? 'yes (ignored for ownership)' : 'no'}`);
  console.log(`  feature files:  ${authority.changedFiles.length}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runCli();
  } catch (error) {
    console.error(`Shared PR diff authority failed closed: ${error.message}`);
    process.exitCode = 1;
  }
}
