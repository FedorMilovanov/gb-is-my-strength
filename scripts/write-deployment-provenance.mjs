#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { prepareReleaseCandidate } from './release-candidate-lib.mjs';

const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FULL_SHA_RE = /^[a-f0-9]{40}$/;

function runGit(gitRunner, root, args, failure) {
  const result = gitRunner('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${failure}: ${String(result.stderr || '').trim()}`);
  return String(result.stdout || '').trim().toLowerCase();
}

export function assertReleaseControlPlaneBoundary({
  root,
  eventName,
  releaseSha,
  controlPlaneSha,
  gitRunner = spawnSync,
}) {
  assert.match(releaseSha, FULL_SHA_RE, 'release SHA must be exact');
  assert.match(controlPlaneSha, FULL_SHA_RE, 'control-plane SHA must be exact');
  assert.ok(['push', 'workflow_dispatch'].includes(eventName), `unsupported release event: ${eventName || '<empty>'}`);

  const checkedOutSha = runGit(
    gitRunner,
    root,
    ['rev-parse', '--verify', 'HEAD^{commit}'],
    'release boundary requires an exact checked-out HEAD',
  );
  assert.match(checkedOutSha, FULL_SHA_RE, 'checked-out HEAD did not resolve to an exact commit SHA');
  assert.equal(checkedOutSha, releaseSha, 'checked-out HEAD must equal the declared release SHA');

  const mainSha = runGit(
    gitRunner,
    root,
    ['rev-parse', '--verify', 'refs/remotes/origin/main^{commit}'],
    'release boundary requires a fetched origin/main ref',
  );
  assert.match(mainSha, FULL_SHA_RE, 'origin/main did not resolve to an exact commit SHA');
  assert.equal(controlPlaneSha, mainSha, 'control-plane SHA must equal the current fetched origin/main');

  const ancestry = gitRunner(
    'git',
    ['merge-base', '--is-ancestor', releaseSha, controlPlaneSha],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(ancestry.status, 0, 'release SHA must already belong to the history of the control-plane SHA');
  if (eventName === 'push') {
    assert.equal(releaseSha, controlPlaneSha, 'automatic main release must use the same release and control-plane SHA');
  }

  return {
    checked: true,
    eventName,
    releaseSha,
    controlPlaneSha,
    checkedOutSha,
    mainSha,
  };
}

export function writeDeploymentProvenance({
  root = null,
  env = process.env,
  gitRunner = spawnSync,
} = {}) {
  const releaseRoot = path.resolve(root || env.RELEASE_ROOT || MODULE_ROOT);
  const dist = path.join(releaseRoot, 'dist');
  const reports = path.join(releaseRoot, 'reports');
  const releaseSha = String(env.RELEASE_SHA || '').trim().toLowerCase();
  const controlPlaneSha = String(env.CONTROL_PLANE_SHA || env.GITHUB_SHA || '').trim().toLowerCase();
  const repository = String(env.GITHUB_REPOSITORY || 'FedorMilovanov/gb-is-my-strength').trim();
  const runId = Number(env.GITHUB_RUN_ID || 0);
  const runAttempt = Number(env.GITHUB_RUN_ATTEMPT || 0);
  const eventName = String(env.GITHUB_EVENT_NAME || '').trim();
  const npmVersion = String(env.RELEASE_NPM_VERSION || '').trim();

  assert.ok(npmVersion, 'RELEASE_NPM_VERSION is required');
  const boundary = assertReleaseControlPlaneBoundary({
    root: releaseRoot,
    eventName,
    releaseSha,
    controlPlaneSha,
    gitRunner,
  });
  const prepared = prepareReleaseCandidate({
    root: releaseRoot,
    dist,
    repository,
    releaseSha,
    controlPlaneSha,
    runId,
    runAttempt,
    eventName,
    actualNodeVersion: process.version,
    actualNpmVersion: npmVersion,
  });

  fs.mkdirSync(reports, { recursive: true });
  const reportPath = path.join(reports, 'release-candidate.json');
  const report = {
    result: 'PASS',
    repository,
    releaseSha,
    controlPlaneSha,
    workflowRunId: runId,
    workflowRunAttempt: runAttempt,
    candidateId: prepared.manifest.artifact.candidateId,
    digest: prepared.manifest.artifact.digest,
    bytes: prepared.manifest.artifact.bytes,
    files: prepared.manifest.artifact.files,
    immutablePath: prepared.manifest.immutablePath,
    currentPointer: '/deployments/current.json',
    releaseControlPlaneBoundary: boundary,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, [
      `release_sha=${report.releaseSha}`,
      `control_plane_sha=${report.controlPlaneSha}`,
      `candidate_id=${report.candidateId}`,
      `candidate_digest=${report.digest}`,
      `candidate_bytes=${report.bytes}`,
      `candidate_files=${report.files}`,
      `immutable_path=${report.immutablePath}`,
      '',
    ].join('\n'));
  }
  console.log(JSON.stringify(report, null, 2));
  return report;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) writeDeploymentProvenance();
