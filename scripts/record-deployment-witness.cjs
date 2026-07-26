'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FULL_SHA_RE = /^[a-f0-9]{40}$/;
const DIGEST_RE = /^sha256:[a-f0-9]{64}$/;
const GENERIC_REPORT_BASENAME = 'release-live-deployment-contract.json';
const TTS_REPORT_BASENAME = 'tts-live-deployment-contract.json';
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

function readOneReport(witnessDirectory, basename) {
  assert.ok(fs.existsSync(witnessDirectory) && fs.statSync(witnessDirectory).isDirectory(), 'downloaded witness directory is missing');
  const matches = findFiles(witnessDirectory, basename);
  assert.equal(matches.length, 1, `expected exactly one ${basename}, found ${matches.length}`);
  return { path: matches[0], value: JSON.parse(fs.readFileSync(matches[0], 'utf8')) };
}

function validateArtifact(artifact, label, runId, controlPlaneSha) {
  assert.equal(artifact.expired, false, `${label} artifact is expired`);
  assert.ok(Number.isSafeInteger(artifact.id) && artifact.id > 0, `${label} artifact ID is missing`);
  assert.ok(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0, `${label} artifact is empty`);
  assert.match(normalize(artifact.digest), DIGEST_RE, `${label} artifact digest is missing or invalid`);
  if (artifact.workflow_run) {
    assert.equal(artifact.workflow_run.id, runId, `${label} artifact run ID mismatch`);
    assert.equal(normalize(artifact.workflow_run.head_sha).toLowerCase(), controlPlaneSha, `${label} artifact control-plane SHA mismatch`);
  }
}

function requireOneArtifact(artifacts, name, label, runId, controlPlaneSha) {
  const matching = artifacts.filter((artifact) => artifact.name === name);
  assert.equal(matching.length, 1, `expected exactly one ${name}, found ${matching.length}`);
  validateArtifact(matching[0], label, runId, controlPlaneSha);
  return matching[0];
}

function readVerifiedReports({ witnessDirectory, repository, controlPlaneSha, runId, runAttempt, candidateArtifact }) {
  const genericEntry = readOneReport(witnessDirectory, GENERIC_REPORT_BASENAME);
  const ttsEntry = readOneReport(witnessDirectory, TTS_REPORT_BASENAME);
  const generic = genericEntry.value;
  const tts = ttsEntry.value;
  const runIdentity = `${runId}-${runAttempt}`;
  const releaseSha = normalize(generic.releaseSha).toLowerCase();
  assert.match(releaseSha, FULL_SHA_RE, 'generic release witness release SHA is missing or invalid');
  const expectedProvenancePath = `/deployments/${releaseSha}/${runIdentity}.json`;
  const genericPassAttempts = Array.isArray(generic.attempts) ? generic.attempts.filter((attempt) => attempt?.result === 'PASS') : [];
  const ttsPassAttempts = Array.isArray(tts.attempts) ? tts.attempts.filter((attempt) => attempt?.result === 'PASS') : [];

  assert.equal(generic.result, 'PASS', 'downloaded generic release witness did not finish with PASS');
  assert.equal(generic.repository, repository, 'generic release witness repository mismatch');
  assert.equal(generic.controlPlaneSha, controlPlaneSha, 'generic release witness control-plane SHA mismatch');
  assert.equal(generic.workflowRunId, runId, 'generic release witness run ID mismatch');
  assert.equal(generic.workflowRunAttempt, runAttempt, 'generic release witness run attempt mismatch');
  assert.equal(generic.liveBaseUrl, 'https://gospod-bog.ru', 'generic release witness live base URL mismatch');
  assert.equal(generic.candidate?.id, `${releaseSha}:${runIdentity}`, 'generic release candidate ID mismatch');
  assert.match(normalize(generic.candidate?.digest), DIGEST_RE, 'generic release candidate digest is missing or invalid');
  assert.equal(generic.candidate?.immutablePath, expectedProvenancePath, 'generic release immutable path mismatch');
  assert.ok(Number.isSafeInteger(generic.candidate?.bytes) && generic.candidate.bytes > 0, 'generic release candidate byte count is missing');
  assert.ok(Number.isSafeInteger(generic.candidate?.files) && generic.candidate.files > 0, 'generic release candidate file count is missing');
  assert.equal(generic.transportArtifact?.id, candidateArtifact.id, 'generic witness transport artifact ID mismatch');
  assert.equal(generic.transportArtifact?.digest, candidateArtifact.digest, 'generic witness transport artifact digest mismatch');
  assert.equal(genericPassAttempts.length, 1, `expected exactly one generic PASS attempt, found ${genericPassAttempts.length}`);
  const genericEvidence = genericPassAttempts[0].evidence;
  assert.ok(genericEvidence, 'generic release PASS attempt lacks evidence');
  assert.equal(genericEvidence.currentPointer, '/deployments/current.json', 'generic release pointer path mismatch');
  assert.equal(genericEvidence.immutablePath, expectedProvenancePath, 'generic release evidence immutable path mismatch');
  assert.equal(genericEvidence.releaseSha, releaseSha, 'generic release evidence release SHA mismatch');
  assert.equal(genericEvidence.controlPlaneSha, controlPlaneSha, 'generic release evidence control-plane SHA mismatch');
  assert.equal(genericEvidence.candidateId, generic.candidate.id, 'generic release evidence candidate ID mismatch');
  assert.equal(genericEvidence.candidateDigest, generic.candidate.digest, 'generic release evidence candidate digest mismatch');
  assert.ok(genericEvidence.build && genericEvidence.criticalAssets, 'generic release evidence is incomplete');

  assert.equal(tts.result, 'PASS', 'downloaded TTS witness report did not finish with PASS');
  assert.equal(tts.expectedRepository, repository, 'TTS witness repository mismatch');
  assert.equal(tts.releaseSha, releaseSha, 'TTS witness release SHA mismatch');
  assert.equal(tts.controlPlaneSha, controlPlaneSha, 'TTS witness control-plane SHA mismatch');
  assert.equal(tts.workflowRunId, runId, 'TTS witness workflow run ID mismatch');
  assert.equal(tts.workflowRunAttempt, runAttempt, 'TTS witness workflow run attempt mismatch');
  assert.equal(tts.liveBaseUrl, 'https://gospod-bog.ru', 'TTS witness live base URL mismatch');
  assert.equal(tts.candidateDigest, generic.candidate.digest, 'TTS witness candidate digest mismatch');
  assert.equal(tts.expected?.currentPointerPath, '/deployments/current.json', 'TTS witness current pointer path mismatch');
  assert.equal(tts.expected?.provenancePath, expectedProvenancePath, 'TTS witness provenance path mismatch');
  assert.equal(ttsPassAttempts.length, 1, `expected exactly one TTS PASS attempt, found ${ttsPassAttempts.length}`);
  const ttsEvidence = ttsPassAttempts[0].evidence;
  assert.ok(ttsEvidence, 'TTS witness PASS attempt lacks evidence');
  assert.equal(ttsEvidence.discovery?.path, '/deployments/current.json', 'TTS witness discovery path mismatch');
  assert.equal(ttsEvidence.discovery?.immutablePath, expectedProvenancePath, 'TTS witness discovery immutable path mismatch');
  assert.equal(ttsEvidence.discovery?.releaseSha, releaseSha, 'TTS discovery release SHA mismatch');
  assert.equal(ttsEvidence.discovery?.controlPlaneSha, controlPlaneSha, 'TTS discovery control-plane SHA mismatch');
  assert.equal(ttsEvidence.discovery?.workflowRunId, runId, 'TTS witness discovery run ID mismatch');
  assert.equal(ttsEvidence.discovery?.workflowRunAttempt, runAttempt, 'TTS witness discovery run attempt mismatch');
  assert.equal(ttsEvidence.discovery?.candidateDigest, generic.candidate.digest, 'TTS discovery candidate digest mismatch');
  assert.equal(ttsEvidence.provenance?.path, expectedProvenancePath, 'TTS witness evidence provenance path mismatch');
  assert.equal(ttsEvidence.provenance?.releaseSha, releaseSha, 'TTS provenance release SHA mismatch');
  assert.equal(ttsEvidence.provenance?.controlPlaneSha, controlPlaneSha, 'TTS provenance control-plane SHA mismatch');
  assert.equal(ttsEvidence.provenance?.workflowRunId, runId, 'TTS witness evidence run ID mismatch');
  assert.equal(ttsEvidence.provenance?.workflowRunAttempt, runAttempt, 'TTS witness evidence run attempt mismatch');
  assert.equal(ttsEvidence.provenance?.candidateDigest, generic.candidate.digest, 'TTS provenance candidate digest mismatch');
  assert.ok(Array.isArray(ttsEvidence.routeEvidence) && ttsEvidence.routeEvidence.length >= 2, 'TTS witness route evidence is incomplete');
  assert.ok(ttsEvidence.assets?.controller && ttsEvidence.assets?.engine && ttsEvidence.assets?.noticeCss && ttsEvidence.assets?.serviceWorker, 'TTS witness asset evidence is incomplete');
  assert.equal(ttsEvidence.assets.serviceWorker.lazyTtsPrecache, false, 'TTS witness reports lazy TTS precache');

  return {
    releaseSha,
    controlPlaneSha,
    generic,
    genericEvidence,
    genericReportPath: genericEntry.path,
    tts,
    ttsEvidence,
    ttsReportPath: ttsEntry.path,
    expectedProvenancePath,
  };
}

async function ensureComment({ github, owner, repo, issueNumber, marker, body }) {
  const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: issueNumber, per_page: 100 });
  if (comments.some((comment) => normalize(comment.body).includes(marker))) return false;
  await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
  return true;
}

module.exports = async function recordDeploymentWitness({ github, context, core, workflowRun, witnessDirectory }) {
  assert.ok(github?.rest?.actions, 'github actions client is required');
  assert.ok(github?.rest?.issues, 'github issues client is required');
  assert.ok(github?.rest?.repos, 'github repos client is required');
  assert.ok(context?.repo?.owner && context?.repo?.repo, 'repository context is required');
  assert.ok(workflowRun, 'triggering deployment workflow run is required');

  const { owner, repo } = context.repo;
  const repository = `${owner}/${repo}`;
  const controlPlaneSha = normalize(workflowRun.head_sha).toLowerCase();
  const runId = Number(workflowRun.id);
  const runAttempt = Number(workflowRun.run_attempt);

  assert.equal(workflowRun.name, 'Deploy to GitHub Pages', 'ledger must be triggered by Deploy to GitHub Pages');
  assert.equal(workflowRun.conclusion, 'success', 'ledger only records successful deploy runs');
  assert.equal(workflowRun.head_branch, 'main', 'ledger only records main control-plane runs');
  assert.equal(workflowRun.head_repository?.full_name, repository, 'ledger refuses a foreign head repository');
  assert.match(controlPlaneSha, FULL_SHA_RE, 'deployment control-plane SHA must be exact');
  assert.ok(Number.isSafeInteger(runId) && runId > 0, 'deployment run ID must be positive');
  assert.ok(Number.isSafeInteger(runAttempt) && runAttempt > 0, 'deployment run attempt must be positive');

  const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, { owner, repo, run_id: runId, per_page: 100 });
  const candidateArtifact = requireOneArtifact(artifacts, `pages-release-candidate-${runId}-${runAttempt}`, 'release candidate', runId, controlPlaneSha);
  const genericArtifact = requireOneArtifact(artifacts, `release-live-deployment-${runId}`, 'generic live witness', runId, controlPlaneSha);
  const ttsArtifact = requireOneArtifact(artifacts, `tts-live-deployment-${runId}`, 'TTS witness', runId, controlPlaneSha);
  const verified = readVerifiedReports({ witnessDirectory, repository, controlPlaneSha, runId, runAttempt, candidateArtifact });
  const releaseSha = verified.releaseSha;

  const runUrl = `https://github.com/${repository}/actions/runs/${runId}`;
  const artifactUrl = (artifact) => `${runUrl}/artifacts/${artifact.id}`;
  const provenanceUrl = `https://gospod-bog.ru${verified.expectedProvenancePath}`;
  const marker = `<!-- deployment-release-witness:${releaseSha}:${controlPlaneSha}:${runId}:${runAttempt}:${candidateArtifact.id}:${genericArtifact.id}:${ttsArtifact.id} -->`;
  const legacyTargetMarker = `<!-- deployment-witness-target:tts:${releaseSha} -->`;
  const releaseTargetMarker = `<!-- deployment-witness-target:release:${releaseSha} -->`;

  const envelope = {
    schemaVersion: 3,
    kind: 'deployment-release-witness',
    repository,
    releaseSha,
    controlPlaneSha,
    deploy: {
      workflow: 'Deploy to GitHub Pages',
      controlPlaneSha,
      runId,
      runAttempt,
      event: normalize(workflowRun.event) || null,
      url: runUrl,
    },
    releaseCandidate: {
      releaseSha,
      candidateId: verified.generic.candidate.id,
      digest: verified.generic.candidate.digest,
      bytes: verified.generic.candidate.bytes,
      files: verified.generic.candidate.files,
      immutablePath: verified.generic.candidate.immutablePath,
      transportArtifact: {
        id: candidateArtifact.id,
        name: candidateArtifact.name,
        digest: candidateArtifact.digest,
        bytes: candidateArtifact.size_in_bytes,
        url: artifactUrl(candidateArtifact),
        expiresAt: candidateArtifact.expires_at || null,
      },
    },
    liveWitnessArtifact: {
      id: genericArtifact.id,
      name: genericArtifact.name,
      digest: genericArtifact.digest,
      bytes: genericArtifact.size_in_bytes,
      url: artifactUrl(genericArtifact),
      expiresAt: genericArtifact.expires_at || null,
    },
    live: { currentPointer: CURRENT_POINTER_URL, runProvenance: provenanceUrl },
    build: verified.genericEvidence.build,
    criticalAssets: verified.genericEvidence.criticalAssets,
    extensions: {
      tts: {
        result: 'PASS',
        witnessArtifact: {
          id: ttsArtifact.id,
          name: ttsArtifact.name,
          digest: ttsArtifact.digest,
          bytes: ttsArtifact.size_in_bytes,
          url: artifactUrl(ttsArtifact),
          expiresAt: ttsArtifact.expires_at || null,
        },
        routes: verified.ttsEvidence.routeEvidence.map((entry) => entry.route),
        assets: verified.ttsEvidence.assets,
      },
    },
  };

  const body = [
    marker,
    '## Release candidate witness accepted',
    '',
    `- **Release SHA:** \`${releaseSha}\``,
    `- **Control-plane SHA:** \`${controlPlaneSha}\``,
    `- **Deploy run:** [${runId} · attempt ${runAttempt}](${runUrl})`,
    `- **Candidate ID:** \`${envelope.releaseCandidate.candidateId}\``,
    `- **Candidate tree digest:** \`${envelope.releaseCandidate.digest}\``,
    `- **Candidate artifact:** [${candidateArtifact.name} · ID ${candidateArtifact.id}](${artifactUrl(candidateArtifact)})`,
    `- **Candidate transport digest:** \`${candidateArtifact.digest}\``,
    `- **Generic live witness:** [${genericArtifact.name} · ID ${genericArtifact.id}](${artifactUrl(genericArtifact)})`,
    `- **TTS extension witness:** [${ttsArtifact.name} · ID ${ttsArtifact.id}](${artifactUrl(ttsArtifact)})`,
    `- **Current pointer:** ${CURRENT_POINTER_URL}`,
    `- **Run provenance:** ${provenanceUrl}`,
    '',
    'The trusted control-plane run built one exact release candidate, published the same candidate bytes, and produced generic and TTS live PASS reports bound to both the release SHA and control-plane SHA. Artifact transport identity remains bound to the control-plane workflow run.',
    '',
    '<details><summary>Machine envelope</summary>',
    '',
    '```json',
    JSON.stringify(envelope, null, 2),
    '```',
    '</details>',
  ].join('\n');

  const associatedPulls = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, { owner, repo, commit_sha: releaseSha, per_page: 100 });
  const exactMergedPulls = associatedPulls.filter((pull) => pull.merged_at && normalize(pull.merge_commit_sha).toLowerCase() === releaseSha);
  if (exactMergedPulls.length > 1) throw new Error(`multiple merged pull requests claim exact release SHA ${releaseSha}`);

  const issues = await github.paginate(github.rest.issues.listForRepo, { owner, repo, state: 'all', per_page: 100 });
  const markedIssues = issues.filter((issue) => !issue.pull_request && (normalize(issue.body).includes(releaseTargetMarker) || normalize(issue.body).includes(legacyTargetMarker)));
  if (markedIssues.length > 1) throw new Error(`multiple issues contain a deployment witness target marker for ${releaseSha}`);

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
      await github.rest.issues.update({ owner, repo, issue_number: issue.number, state: 'closed', state_reason: 'completed' });
    }
    touched.push(`issue #${issue.number}${created ? ' commented and closed' : ' already recorded and closed'}`);
  }
  if (touched.length === 0) core.warning(`No exact merged PR or machine-marked issue was found for release ${releaseSha}; candidate artifact ${candidateArtifact.id} remains durable evidence.`);

  await core.summary
    .addHeading('Release candidate witness')
    .addRaw(`Release SHA: ${releaseSha}\n\nControl-plane SHA: ${controlPlaneSha}\n\nCandidate: ${envelope.releaseCandidate.candidateId}\n\nDigest: ${envelope.releaseCandidate.digest}\n\n`)
    .addLink(`Deploy run ${runId} · attempt ${runAttempt}`, runUrl)
    .addRaw(`\n\nCandidate artifact: ${candidateArtifact.name} · ID ${candidateArtifact.id} · ${candidateArtifact.digest}\n\n`)
    .addRaw(`Generic live artifact: ${genericArtifact.name} · ID ${genericArtifact.id} · ${genericArtifact.digest}\n\n`)
    .addRaw(`TTS artifact: ${ttsArtifact.name} · ID ${ttsArtifact.id} · ${ttsArtifact.digest}\n\n`)
    .addRaw(`Current pointer: ${CURRENT_POINTER_URL}\n\nRun provenance: ${provenanceUrl}\n\n`)
    .addRaw(touched.length ? touched.join('\n') : 'No repository conversation target matched the exact release SHA/marker.')
    .write();

  core.info(`Release candidate witness recorded for release ${releaseSha} via control plane ${controlPlaneSha}: ${touched.join('; ') || `candidate artifact ${candidateArtifact.id}`}`);
  return { envelope, touched, marker, legacyTargetMarker, releaseTargetMarker };
};
