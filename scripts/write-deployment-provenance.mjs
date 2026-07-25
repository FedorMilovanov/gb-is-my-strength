#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareReleaseCandidate } from './release-candidate-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
const commitSha = String(process.env.RELEASE_SHA || process.env.DEPLOYED_SHA || process.env.GITHUB_SHA || '').trim().toLowerCase();
const repository = String(process.env.GITHUB_REPOSITORY || 'FedorMilovanov/gb-is-my-strength').trim();
const runId = Number(process.env.GITHUB_RUN_ID || 0);
const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT || 0);
const eventName = String(process.env.GITHUB_EVENT_NAME || '').trim();
const npmVersion = String(process.env.RELEASE_NPM_VERSION || '').trim();

assert.ok(npmVersion, 'RELEASE_NPM_VERSION is required');
const prepared = prepareReleaseCandidate({
  root: ROOT,
  dist: DIST,
  repository,
  commitSha,
  runId,
  runAttempt,
  eventName,
  actualNodeVersion: process.version,
  actualNpmVersion: npmVersion,
});

fs.mkdirSync(REPORTS, { recursive: true });
const reportPath = path.join(REPORTS, 'release-candidate.json');
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
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, [
    `candidate_id=${report.candidateId}`,
    `candidate_digest=${report.digest}`,
    `candidate_bytes=${report.bytes}`,
    `candidate_files=${report.files}`,
    `immutable_path=${report.immutablePath}`,
    '',
  ].join('\n'));
}

console.log(JSON.stringify(report, null, 2));
