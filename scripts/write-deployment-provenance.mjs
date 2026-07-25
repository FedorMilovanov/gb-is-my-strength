#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { prepareReleaseCandidate } from './release-candidate-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function assertManualReleaseMainAncestry({
  root,
  eventName,
  commitSha,
  gitRunner = spawnSync,
}) {
  if (eventName !== 'workflow_dispatch') return { checked: false, mainSha: null };
  assert.match(commitSha, /^[a-f0-9]{40}$/, 'manual release SHA must be exact');

  const options = { cwd: root, encoding: 'utf8' };
  const resolveMain = gitRunner('git', ['rev-parse', '--verify', 'refs/remotes/origin/main^{commit}'], options);
  assert.equal(
    resolveMain.status,
    0,
    `manual release requires a fetched origin/main ref: ${String(resolveMain.stderr || '').trim()}`,
  );
  const mainSha = String(resolveMain.stdout || '').trim().toLowerCase();
  assert.match(mainSha, /^[a-f0-9]{40}$/, 'origin/main did not resolve to an exact commit SHA');

  const ancestry = gitRunner('git', ['merge-base', '--is-ancestor', commitSha, mainSha], options);
  assert.equal(ancestry.status, 0, 'manual release SHA must already belong to the history of origin/main');
  return { checked: true, mainSha };
}

export function writeDeploymentProvenance({
  root = ROOT,
  env = process.env,
  gitRunner = spawnSync,
} = {}) {
  const dist = path.join(root, 'dist');
  const reports = path.join(root, 'reports');
  const commitSha = String(env.RELEASE_SHA || env.DEPLOYED_SHA || env.GITHUB_SHA || '').trim().toLowerCase();
  const repository = String(env.GITHUB_REPOSITORY || 'FedorMilovanov/gb-is-my-strength').trim();
  const runId = Number(env.GITHUB_RUN_ID || 0);
  const runAttempt = Number(env.GITHUB_RUN_ATTEMPT || 0);
  const eventName = String(env.GITHUB_EVENT_NAME || '').trim();
  const npmVersion = String(env.RELEASE_NPM_VERSION || '').trim();

  assert.ok(npmVersion, 'RELEASE_NPM_VERSION is required');
  const ancestry = assertManualReleaseMainAncestry({ root, eventName, commitSha, gitRunner });
  const prepared = prepareReleaseCandidate({
    root,
    dist,
    repository,
    commitSha,
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
    commitSha,
    workflowRunId: runId,
    workflowRunAttempt: runAttempt,
    candidateId: prepared.manifest.artifact.candidateId,
    digest: prepared.manifest.artifact.digest,
    bytes: prepared.manifest.artifact.bytes,
    files: prepared.manifest.artifact.files,
    immutablePath: prepared.manifest.immutablePath,
    currentPointer: '/deployments/current.json',
    manualReleaseMainAncestry: ancestry,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, [
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
