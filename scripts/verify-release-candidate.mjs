#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyReleaseCandidate } from './release-candidate-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(process.env.RELEASE_CANDIDATE_DIST || path.join(ROOT, 'dist'));
const expectedRepository = String(process.env.EXPECTED_REPOSITORY || process.env.GITHUB_REPOSITORY || '').trim() || null;
const expectedReleaseSha = String(process.env.EXPECTED_RELEASE_SHA || '').trim().toLowerCase() || null;
const expectedControlPlaneSha = String(process.env.EXPECTED_CONTROL_PLANE_SHA || '').trim().toLowerCase() || null;
const expectedRunId = process.env.EXPECTED_RUN_ID ? Number(process.env.EXPECTED_RUN_ID) : null;
const expectedRunAttempt = process.env.EXPECTED_RUN_ATTEMPT ? Number(process.env.EXPECTED_RUN_ATTEMPT) : null;
const expectedDigest = String(process.env.EXPECTED_CANDIDATE_DIGEST || '').trim() || null;

const verified = verifyReleaseCandidate({
  dist: DIST,
  expectedRepository,
  expectedReleaseSha,
  expectedControlPlaneSha,
  expectedRunId,
  expectedRunAttempt,
});
if (expectedDigest) {
  assert.match(expectedDigest, /^sha256:[a-f0-9]{64}$/, 'EXPECTED_CANDIDATE_DIGEST is invalid');
  assert.equal(verified.manifest.artifact.digest, expectedDigest, 'downloaded release candidate digest mismatch');
}

const report = {
  result: 'PASS',
  repository: verified.manifest.repository,
  releaseSha: verified.manifest.releaseSha,
  controlPlaneSha: verified.manifest.controlPlaneSha,
  workflowRunId: verified.manifest.workflow.runId,
  workflowRunAttempt: verified.manifest.workflow.runAttempt,
  candidateId: verified.manifest.artifact.candidateId,
  digest: verified.manifest.artifact.digest,
  bytes: verified.manifest.artifact.bytes,
  files: verified.manifest.artifact.files,
  immutablePath: verified.manifest.immutablePath,
};
const reports = path.join(ROOT, 'reports');
fs.mkdirSync(reports, { recursive: true });
fs.writeFileSync(path.join(reports, 'release-candidate-verification.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
