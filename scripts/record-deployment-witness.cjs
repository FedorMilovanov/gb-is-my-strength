'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FULL_SHA_RE = /^[a-f0-9]{40}$/;
const DIGEST_RE = /^sha256:[a-f0-9]{64}$/;
const REPORT_BASENAME = 'tts-live-deployment-contract.json';
const CURRENT_POINTER_URL = 'https://gospod-bog.ru/deployments/current.json';

function normalize(value) {
  return String(value ?? '').trim();
}

function findFiles(root, basename) {
  const matches = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name === basename) matches.push(absolute);
    }
  };
  visit(root);
  return matches;
}

function readVerifiedReport({ witnessDirectory, repository, sha, runId, runAttempt }) {
  assert.ok(fs.existsSync(witnessDirectory) && fs.statSync(witnessDirectory).isDirectory(), 'downloaded witness directory is missing');
  const reportFiles = findFiles(witnessDirectory, REPORT_BASENAME);
  assert.equal(reportFiles.length, 1, `expected exactly one ${REPORT_BASENAME}, found ${reportFiles.length}`);

  const report = JSON.parse(fs.readFileSync(reportFiles[0], 'utf8'));
  const runIdentity = `${runId}-${runAttempt}`;
  const expectedProvenancePath = `/deployments/${sha}/${runIdentity}.json`;
  const passAttempts = Array.isArray(report.attempts)
    ? report.attempts.filter((attempt) => attempt && attempt.result === 'PASS')
    : [];

  assert.equal(report.result, 'PASS', 'downloaded TTS witness report did not finish with PASS');
  assert.equal(report.expectedRepository, repository, 'TTS witness repository mismatch');
  assert.equal(report.deployedSha, sha, 'TTS witness deployed SHA mismatch');
  assert.equal(report.workflowRunId, runId, 'TTS witness workflow run ID mismatch');
  assert.equal(report.workflowRunAttempt, runAttempt, 'TTS witness workflow run attempt mismatch');
  assert.equal(report.liveBaseUrl, 'https://gospod-bog.ru', 'TTS witness live base URL mismatch');
  assert.equal(report.expected && report.expected.currentPointerPath, '/deployments/current.json', 'TTS witness current pointer path mismatch');
  assert.equal(report.expected && report.expected.provenancePath, expectedProvenancePath, 'TTS witness provenance path mismatch');
  assert.equal(passAttempts.length, 1, `expected exactly one PASS attempt, found ${passAttempts.length}`);

  const evidence = passAttempts[0].evidence;
  assert.ok(evidence, 'TTS witness PASS attempt lacks evidence');
  assert.equal(evidence.discovery && evidence.discovery.path, '/deployments/current.json', 'TTS witness discovery path mismatch');
  assert.equal(evidence.discovery && evidence.discovery.immutablePath, expectedProvenancePath, 'TTS witness discovery immutable path mismatch');
  assert.equal(evidence.discovery && evidence.discovery.workflowRunId, runId, 'TTS witness discovery run ID mismatch');
  assert.equal(evidence.discovery && evidence.discovery.workflowRunAttempt, runAttempt, 'TTS witness discovery run attempt mismatch');
  assert.equal(evidence.provenance && evidence.provenance.path, expectedProvenancePath, 'TTS witness evidence provenance path mismatch');
  assert.equal(evidence.provenance && evidence.provenance.commitSha, sha, 'TTS witness evidence commit SHA mismatch');
  assert.equal(evidence.provenance && evidence.provenance.workflowRunId, runId, 'TTS witness evidence run ID mismatch');
  assert.equal(evidence.provenance && evidence.provenance.workflowRunAttempt, runAttempt, 'TTS witness evidence run attempt mismatch');
  assert.ok(Array.isArray(evidence.routeEvidence) && evidence.routeEvidence.length >= 2, 'TTS witness route evidence is incomplete');
  assert.ok(evidence.assets && evidence.assets.controller && evidence.assets.engine && evidence.assets.noticeCss && evidence.assets.serviceWorker, 'TTS witness asset evidence is incomplete');
  assert.equal(evidence.assets.serviceWorker.lazyTtsPrecache, false, 'TTS witness reports lazy TTS precache');

  return { report, evidence, reportPath: reportFiles[0], expectedProvenancePath };
}

async function ensureComment({ github, owner, repo, issueNumber, marker, body }) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });
  if (comments.some((comment) => normalize(comment.body).includes(marker))) return false;
  await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
  return true;
}

module.exports = async function recordDeploymentWitness({
  github,
  context,
  core,
  workflowRun,
  witnessDirectory,
}) {
  assert.ok(github?.rest?.actions, 'github actions client is required');
  assert.ok(github?.rest?.issues, 'github issues client is required');
  assert.ok(github?.rest?.repos, 'github repos client is required');
  assert.ok(context?.repo?.owner && context?.repo?.repo, 'repository context is required');
  assert.ok(workflowRun, 'triggering deployment workflow run is required');

  const { owner, repo } = context.repo;
  const repository = `${owner}/${repo}`;
  const sha = normalize(workflowRun.head_sha).toLowerCase();
  const runId = Number(workflowRun.id);
  const runAttempt = Number(workflowRun.run_attempt);
  const runIdentity = `${runId}-${runAttempt}`;

  assert.equal(workflowRun.name, 'Deploy to GitHub Pages', 'ledger must be triggered by Deploy to GitHub Pages');
  assert.equal(workflowRun.conclusion, 'success', 'ledger only records successful deploy runs');
  assert.equal(workflowRun.head_branch, 'main', 'ledger only records main deployments');
  assert.equal(workflowRun.head_repository && workflowRun.head_repository.full_name, repository, 'ledger refuses a foreign head repository');
  assert.match(sha, FULL_SHA_RE, 'deployment head SHA must be exact');
  assert.ok(Number.isSafeInteger(runId) && runId > 0, 'deployment run ID must be positive');
  assert.ok(Number.isSafeInteger(runAttempt) && runAttempt > 0, 'deployment run attempt must be positive');

  const expectedArtifactName = `tts-live-deployment-${runId}`;
  const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
    owner,
    repo,
    run_id: runId,
    per_page: 100,
  });
  const matchingArtifacts = artifacts.filter((artifact) => artifact.name === expectedArtifactName);
  assert.equal(matchingArtifacts.length, 1, `expected exactly one ${expectedArtifactName} artifact, found ${matchingArtifacts.length}`);
  const artifact = matchingArtifacts[0];
  assert.equal(artifact.expired, false, 'TTS witness artifact is expired');
  assert.ok(Number.isSafeInteger(artifact.id) && artifact.id > 0, 'TTS witness artifact ID is missing');
  assert.ok(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0, 'TTS witness artifact is empty');
  assert.match(normalize(artifact.digest), DIGEST_RE, 'TTS witness artifact digest is missing or invalid');
  if (artifact.workflow_run) {
    assert.equal(artifact.workflow_run.id, runId, 'TTS witness artifact run ID mismatch');
    assert.equal(normalize(artifact.workflow_run.head_sha).toLowerCase(), sha, 'TTS witness artifact head SHA mismatch');
  }

  const verified = readVerifiedReport({ witnessDirectory, repository, sha, runId, runAttempt });
  const runUrl = `https://github.com/${repository}/actions/runs/${runId}`;
  const artifactUrl = `${runUrl}/artifacts/${artifact.id}`;
  const provenanceUrl = `https://gospod-bog.ru${verified.expectedProvenancePath}`;
  const marker = `<!-- deployment-capability-witness:tts:${sha}:${runId}:${runAttempt}:${artifact.id} -->`;
  const issueTargetMarker = `<!-- deployment-witness-target:tts:${sha} -->`;

  const envelope = {
    schemaVersion: 1,
    kind: 'deployment-capability-witness',
    repository,
    commitSha: sha,
    deploy: {
      workflow: 'Deploy to GitHub Pages',
      runId,
      runAttempt,
      event: normalize(workflowRun.event) || null,
      url: runUrl,
    },
    witnessArtifact: {
      id: artifact.id,
      name: artifact.name,
      digest: artifact.digest,
      bytes: artifact.size_in_bytes,
      url: artifactUrl,
      expiresAt: artifact.expires_at || null,
    },
    live: {
      currentPointer: CURRENT_POINTER_URL,
      runProvenance: provenanceUrl,
    },
    extensions: {
      tts: {
        result: 'PASS',
        sourceReadinessRunId: verified.evidence.provenance.sourceReadinessRunId ?? null,
        routes: verified.evidence.routeEvidence.map((entry) => entry.route),
        assets: verified.evidence.assets,
      },
    },
  };

  const body = [
    marker,
    '## TTS capability witness accepted',
    '',
    `- **Commit:** \`${sha}\``,
    `- **Deploy run:** [${runId} · attempt ${runAttempt}](${runUrl})`,
    `- **Witness artifact:** [${artifact.name} · ID ${artifact.id}](${artifactUrl})`,
    `- **Witness digest:** \`${artifact.digest}\``,
    `- **Current pointer:** ${CURRENT_POINTER_URL}`,
    `- **Run provenance:** ${provenanceUrl}`,
    '',
    'The downloaded artifact contains one live report with `result: PASS`; its repository, SHA, run/attempt, pointer, run-addressed provenance, route evidence and TTS asset chain match this deployment.',
    '',
    '> Scope: this is a TTS capability witness. It does not claim whole-Pages release-artifact identity; #292 and #295 remain authoritative for that promotion chain.',
    '',
    '<details><summary>Machine envelope</summary>',
    '',
    '```json',
    JSON.stringify(envelope, null, 2),
    '```',
    '</details>',
  ].join('\n');

  const associatedPulls = await github.paginate(
    github.rest.repos.listPullRequestsAssociatedWithCommit,
    { owner, repo, commit_sha: sha, per_page: 100 },
  );
  const exactMergedPulls = associatedPulls.filter(
    (pull) => pull.merged_at && normalize(pull.merge_commit_sha).toLowerCase() === sha,
  );
  if (exactMergedPulls.length > 1) throw new Error(`multiple merged pull requests claim exact deployment SHA ${sha}`);

  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'all',
    per_page: 100,
  });
  const markedIssues = issues.filter(
    (issue) => !issue.pull_request && normalize(issue.body).includes(issueTargetMarker),
  );
  if (markedIssues.length > 1) throw new Error(`multiple issues contain ${issueTargetMarker}`);

  const touched = [];
  if (exactMergedPulls.length === 1) {
    const pull = exactMergedPulls[0];
    const created = await ensureComment({ github, owner, repo, issueNumber: pull.number, marker, body });
    touched.push(`PR #${pull.number}${created ? ' commented' : ' already recorded'}`);
  }
  if (markedIssues.length === 1) {
    const issue = markedIssues[0];
    const created = await ensureComment({ github, owner, repo, issueNumber: issue.number, marker, body });
    if (issue.state !== 'closed') {
      await github.rest.issues.update({
        owner,
        repo,
        issue_number: issue.number,
        state: 'closed',
        state_reason: 'completed',
      });
    }
    touched.push(`issue #${issue.number}${created ? ' commented and closed' : ' already recorded and closed'}`);
  }

  if (touched.length === 0) {
    core.warning(`No exact merged PR or machine-marked issue was found for ${sha}; artifact ${artifact.id} remains the durable witness.`);
  }

  await core.summary
    .addHeading('TTS capability witness')
    .addRaw(`Commit: ${sha}\n\n`)
    .addLink(`Deploy run ${runId} · attempt ${runAttempt}`, runUrl)
    .addRaw(`\n\nArtifact: ${artifact.name} · ID ${artifact.id} · ${artifact.digest}\n\n`)
    .addRaw(`Current pointer: ${CURRENT_POINTER_URL}\n\nRun provenance: ${provenanceUrl}\n\n`)
    .addRaw(touched.length ? touched.join('\n') : 'No repository conversation target matched the exact SHA/marker.')
    .write();

  core.info(`TTS capability witness recorded for ${sha}: ${touched.join('; ') || `artifact ${artifact.id}`}`);
  return { envelope, touched, marker, issueTargetMarker };
};
