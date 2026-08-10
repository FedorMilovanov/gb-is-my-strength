#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const LEASE_START = '<!-- GB_WRITER_LEASE_V1';
export const LEASE_END = 'GB_WRITER_LEASE_V1 -->';
const SHA_RE = /^[0-9a-f]{40}$/;
const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{11,159}$/;
const LANE_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/;
const RETIRE_DISPOSITIONS = new Set([
  'FULLY_REPRESENTED_BY_ANCESTRY',
  'SQUASH_OR_PATCH_EQUIVALENT',
  'DIAGNOSTIC_DISPOSABLE',
  'SUPERSEDED_VERIFIED',
  'UNIQUE_EVIDENCE',
  'SELECTIVE_RECOVERY',
]);

function fail(message) {
  throw new Error(`WRITER LEASE FAIL CLOSED: ${message}`);
}
function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value || {}).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${label} keys must be exactly ${expected.join(', ')}`);
  }
}
function requireString(value, label, pattern = null) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`);
  if (pattern && !pattern.test(value)) fail(`${label} has invalid format`);
  return value;
}
function requireInteger(value, label, min = 1) {
  if (!Number.isSafeInteger(value) || value < min) fail(`${label} must be an integer >= ${min}`);
  return value;
}
function normalizedLease(lease) {
  return JSON.parse(JSON.stringify(lease));
}

export function extractWriterLease(body) {
  const text = String(body || '');
  const starts = [...text.matchAll(/<!-- GB_WRITER_LEASE_V1/g)];
  const ends = [...text.matchAll(/GB_WRITER_LEASE_V1 -->/g)];
  if (starts.length !== 1 || ends.length !== 1) fail(`PR body must contain exactly one writer lease marker (found ${starts.length}/${ends.length})`);
  const start = starts[0].index + LEASE_START.length;
  const end = ends[0].index;
  if (end <= start) fail('writer lease marker order is invalid');
  const payload = text.slice(start, end).trim();
  let parsed;
  try { parsed = JSON.parse(payload); }
  catch (error) { fail(`writer lease JSON is invalid: ${error.message}`); }
  return parsed;
}

export function validateWriterLease(raw, expected = {}) {
  const lease = normalizedLease(raw);
  requireExactKeys(lease, [
    'version', 'laneId', 'pr', 'branch', 'ownerToken', 'generation',
    'acquisitionSha', 'status', 'handoff', 'retirement',
  ], 'lease');
  if (lease.version !== 1) fail('lease.version must be 1');
  requireString(lease.laneId, 'lease.laneId', LANE_RE);
  requireInteger(lease.pr, 'lease.pr');
  requireString(lease.branch, 'lease.branch');
  requireString(lease.ownerToken, 'lease.ownerToken', TOKEN_RE);
  requireInteger(lease.generation, 'lease.generation');
  requireString(lease.acquisitionSha, 'lease.acquisitionSha', SHA_RE);
  if (!['active', 'retired'].includes(lease.status)) fail('lease.status must be active or retired');
  if (expected.pr != null && lease.pr !== Number(expected.pr)) fail(`lease PR ${lease.pr} != expected PR ${expected.pr}`);
  if (expected.branch != null && lease.branch !== expected.branch) fail(`lease branch ${lease.branch} != expected branch ${expected.branch}`);

  if (lease.handoff != null) {
    requireExactKeys(lease.handoff, [
      'fromOwnerToken', 'fromGeneration', 'toOwnerToken', 'toGeneration', 'atHead',
    ], 'lease.handoff');
    requireString(lease.handoff.fromOwnerToken, 'lease.handoff.fromOwnerToken', TOKEN_RE);
    requireInteger(lease.handoff.fromGeneration, 'lease.handoff.fromGeneration');
    requireString(lease.handoff.toOwnerToken, 'lease.handoff.toOwnerToken', TOKEN_RE);
    requireInteger(lease.handoff.toGeneration, 'lease.handoff.toGeneration');
    requireString(lease.handoff.atHead, 'lease.handoff.atHead', SHA_RE);
    if (lease.handoff.toOwnerToken !== lease.ownerToken) fail('handoff successor owner must equal current ownerToken');
    if (lease.handoff.toGeneration !== lease.generation) fail('handoff successor generation must equal current generation');
    if (lease.handoff.fromGeneration !== lease.generation - 1) fail('handoff predecessor generation must be current generation - 1');
    if (lease.handoff.fromOwnerToken === lease.handoff.toOwnerToken) fail('handoff must rotate to a different owner token');
    if (lease.handoff.atHead !== lease.acquisitionSha) fail('handoff atHead must equal successor acquisitionSha');
  } else if (lease.generation !== 1) {
    fail('active generation > 1 requires an explicit handoff record');
  }

  if (lease.status === 'active') {
    if (lease.retirement != null) fail('active lease cannot contain retirement');
  } else {
    if (lease.retirement == null) fail('retired lease requires retirement record');
    requireExactKeys(lease.retirement, ['atHead', 'reason', 'disposition'], 'lease.retirement');
    requireString(lease.retirement.atHead, 'lease.retirement.atHead', SHA_RE);
    requireString(lease.retirement.reason, 'lease.retirement.reason');
    requireString(lease.retirement.disposition, 'lease.retirement.disposition');
    if (!RETIRE_DISPOSITIONS.has(lease.retirement.disposition)) {
      fail(`retirement disposition ${lease.retirement.disposition} is not a final Branch Lifecycle v4 class`);
    }
  }
  return lease;
}

export function assertLeaseTransition(previousRaw, nextRaw, currentHead) {
  const previous = validateWriterLease(previousRaw);
  const next = validateWriterLease(nextRaw);
  requireString(currentHead, 'current head', SHA_RE);
  if (previous.status !== 'active') fail('a retired lease cannot transition');
  for (const field of ['laneId', 'pr', 'branch']) {
    if (previous[field] !== next[field]) fail(`handoff/retirement cannot change ${field}`);
  }
  if (next.status === 'retired') {
    if (next.ownerToken !== previous.ownerToken || next.generation !== previous.generation || next.acquisitionSha !== previous.acquisitionSha) {
      fail('retirement must preserve current owner, generation and acquisitionSha');
    }
    if (next.retirement.atHead !== currentHead) fail('retirement atHead must equal current exact head');
    return next;
  }
  if (next.generation !== previous.generation + 1) fail('handoff must increment generation by exactly one');
  if (next.ownerToken === previous.ownerToken) fail('handoff must rotate ownerToken');
  if (next.acquisitionSha !== currentHead) fail('handoff acquisitionSha must equal current exact head');
  const handoff = next.handoff;
  if (!handoff
    || handoff.fromOwnerToken !== previous.ownerToken
    || handoff.fromGeneration !== previous.generation
    || handoff.toOwnerToken !== next.ownerToken
    || handoff.toGeneration !== next.generation
    || handoff.atHead !== currentHead) {
    fail('handoff record does not match predecessor/successor ownership');
  }
  return next;
}

export function assertLeaseClaim({ snapshotRaw, liveRaw, expectedHead, liveHead, pr, branch }) {
  const snapshot = validateWriterLease(snapshotRaw, { pr, branch });
  const live = validateWriterLease(liveRaw, { pr, branch });
  if (snapshot.status !== 'active' || live.status !== 'active') fail('repo-writing requires an active lease');
  for (const field of ['version', 'laneId', 'pr', 'branch', 'ownerToken', 'generation', 'acquisitionSha']) {
    if (snapshot[field] !== live[field]) fail(`live lease ${field} changed after this run was queued`);
  }
  if (JSON.stringify(snapshot.handoff) !== JSON.stringify(live.handoff)) fail('live handoff record changed after this run was queued');
  requireString(expectedHead, 'expected head', SHA_RE);
  requireString(liveHead, 'live head', SHA_RE);
  if (liveHead !== expectedHead) fail(`live PR head ${liveHead} != queued expected head ${expectedHead}`);
  return { lease: live, expectedHead };
}

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
}
function snapshotPath() {
  const gitDir = git(['rev-parse', '--git-dir']);
  return path.resolve(gitDir, 'gb-writer-lease-snapshot.json');
}
function loadEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) fail('GITHUB_EVENT_PATH is missing');
  return JSON.parse(fs.readFileSync(eventPath, 'utf8'));
}
function repoFromEnv() {
  return requireString(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY');
}
function writeSnapshot() {
  const event = loadEvent();
  const pr = event.pull_request;
  if (!pr || !pr.number || !pr.head) fail('writer lease snapshot requires a pull_request event');
  const repository = repoFromEnv();
  if (pr.head.repo?.full_name !== repository) fail('writer lease is same-repository only');
  const lease = validateWriterLease(extractWriterLease(pr.body), { pr: pr.number, branch: pr.head.ref });
  if (lease.status !== 'active') fail('queued writer event does not carry an active lease');
  const expectedHead = requireString(pr.head.sha, 'event pull_request.head.sha', SHA_RE);
  const localHead = git(['rev-parse', 'HEAD']);
  if (localHead !== expectedHead) fail(`checkout ${localHead} != immutable event head ${expectedHead}`);
  try { execFileSync('git', ['merge-base', '--is-ancestor', lease.acquisitionSha, expectedHead], { stdio: 'ignore' }); }
  catch { fail(`lease acquisition SHA ${lease.acquisitionSha} is not an ancestor of event head ${expectedHead}`); }
  const snapshot = { version: 1, repository, pr: pr.number, branch: pr.head.ref, expectedHead, lease };
  fs.writeFileSync(snapshotPath(), JSON.stringify(snapshot, null, 2), { mode: 0o600 });
  console.log(`WRITER LEASE SNAPSHOT: ${lease.laneId} owner=${lease.ownerToken} generation=${lease.generation} head=${expectedHead}`);
  return snapshot;
}
function readSnapshot() {
  const file = snapshotPath();
  if (!fs.existsSync(file)) fail('writer lease snapshot is missing; run snapshot first');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
async function fetchLivePull(snapshot) {
  const token = requireString(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN');
  const api = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
  const response = await fetch(`${api}/repos/${snapshot.repository}/pulls/${snapshot.pr}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gb-writer-lease-v1',
    },
  });
  if (!response.ok) fail(`GitHub live PR lookup failed (${response.status})`);
  return response.json();
}
async function assertLive(phase) {
  if (!['pre-mutation', 'pre-commit', 'pre-push'].includes(phase)) fail(`unsupported assert-live phase ${phase}`);
  const snapshot = readSnapshot();
  const live = await fetchLivePull(snapshot);
  if (live.state !== 'open') fail(`PR #${snapshot.pr} is not open`);
  if (live.head?.repo?.full_name !== snapshot.repository || live.head?.ref !== snapshot.branch) fail('live PR branch/repository changed');
  const claim = assertLeaseClaim({
    snapshotRaw: snapshot.lease,
    liveRaw: extractWriterLease(live.body),
    expectedHead: snapshot.expectedHead,
    liveHead: live.head.sha,
    pr: snapshot.pr,
    branch: snapshot.branch,
  });
  const localHead = git(['rev-parse', 'HEAD']);
  if (phase === 'pre-push') {
    let parent;
    try { parent = git(['rev-parse', 'HEAD^']); }
    catch { fail('pre-push local commit has no parent'); }
    if (parent !== snapshot.expectedHead) fail(`pre-push parent ${parent} != expected head ${snapshot.expectedHead}`);
    const trailer = `Writer-Lease: ${claim.lease.ownerToken}@${claim.lease.generation}`;
    const message = git(['log', '-1', '--format=%B']);
    if (!message.split(/\r?\n/).includes(trailer)) fail('autofix commit is missing the exact Writer-Lease trailer');
  } else if (localHead !== snapshot.expectedHead) {
    fail(`${phase} local HEAD ${localHead} != expected head ${snapshot.expectedHead}`);
  }
  console.log(`WRITER LEASE LIVE ${phase}: PASS owner=${claim.lease.ownerToken} generation=${claim.lease.generation} head=${snapshot.expectedHead}`);
}
function printField(name) {
  const snapshot = readSnapshot();
  const fields = {
    expectedHead: snapshot.expectedHead,
    branch: snapshot.branch,
    laneId: snapshot.lease.laneId,
    ownerToken: snapshot.lease.ownerToken,
    generation: String(snapshot.lease.generation),
    acquisitionSha: snapshot.lease.acquisitionSha,
  };
  if (!(name in fields)) fail(`unknown snapshot field ${name}`);
  process.stdout.write(String(fields[name]));
}
function printTrailer() {
  const snapshot = readSnapshot();
  process.stdout.write(`Writer-Lease: ${snapshot.lease.ownerToken}@${snapshot.lease.generation}`);
}

async function main(argv) {
  const command = argv[2];
  if (command === 'snapshot') { writeSnapshot(); return; }
  if (command === 'assert-live') {
    const phaseArg = argv.find((arg) => arg.startsWith('--phase='));
    await assertLive(phaseArg ? phaseArg.slice('--phase='.length) : '');
    return;
  }
  if (command === 'field') { printField(argv[3] || ''); return; }
  if (command === 'trailer') { printTrailer(); return; }
  if (command === 'validate-body') {
    const file = argv[3];
    if (!file) fail('validate-body requires a PR body file');
    validateWriterLease(extractWriterLease(fs.readFileSync(file, 'utf8')));
    console.log('WRITER LEASE BODY: PASS');
    return;
  }
  fail('usage: writer-lease.mjs snapshot | assert-live --phase=pre-mutation|pre-commit|pre-push | field <name> | trailer | validate-body <file>');
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  main(process.argv).catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
