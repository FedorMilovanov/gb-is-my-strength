'use strict';

const assert = require('node:assert/strict');

const FULL_SHA_RE = /^[a-f0-9]{40}$/;
const RUN_ID_RE = /^\d+$/;

function normalize(value) {
  return String(value ?? '').trim();
}

function exactAcceptanceTitle(shortSha) {
  return `P1(tts): accept live deployment provenance for main@${shortSha}`;
}

async function ensureComment({ github, owner, repo, issueNumber, marker, body }) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  if (comments.some((comment) => normalize(comment.body).includes(marker))) {
    return false;
  }

  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
  return true;
}

module.exports = async function recordLiveDeploymentAcceptance({
  github,
  context,
  core,
  deployedSha,
  deployRunId,
  deployRunAttempt,
  sourceReadinessRunId,
  currentPointerUrl,
  provenanceUrl,
  artifactName,
}) {
  assert.ok(github?.rest?.issues, 'github issues client is required');
  assert.ok(github?.rest?.repos, 'github repos client is required');
  assert.ok(context?.repo?.owner && context?.repo?.repo, 'repository context is required');

  const sha = normalize(deployedSha).toLowerCase();
  const runId = normalize(deployRunId);
  const runAttempt = normalize(deployRunAttempt);
  const readinessRunId = normalize(sourceReadinessRunId);
  const currentPointer = normalize(currentPointerUrl);
  const provenance = normalize(provenanceUrl);
  const artifact = normalize(artifactName);
  const runIdentity = `${runId}-${runAttempt}`;

  assert.match(sha, FULL_SHA_RE, 'deployedSha must be an exact 40-character SHA');
  assert.match(runId, RUN_ID_RE, 'deployRunId must be numeric');
  assert.match(runAttempt, RUN_ID_RE, 'deployRunAttempt must be numeric');
  if (readinessRunId) assert.match(readinessRunId, RUN_ID_RE, 'sourceReadinessRunId must be numeric when present');
  assert.equal(currentPointer, 'https://gospod-bog.ru/deployments/current.json', 'current pointer URL must use the canonical custom-domain discovery path');
  assert.equal(provenance, `https://gospod-bog.ru/deployments/${sha}/${runIdentity}.json`, 'provenance URL must be run-addressed under the exact SHA');
  assert.equal(artifact, `tts-live-deployment-${runId}`, 'artifact name must identify the deploy run');

  const { owner, repo } = context.repo;
  const repository = `${owner}/${repo}`;
  const shortSha = sha.slice(0, 7);
  const runUrl = `https://github.com/${repository}/actions/runs/${runId}`;
  const marker = `<!-- deployment-acceptance:${sha}:${runId}:${runAttempt} -->`;
  const body = [
    marker,
    '## Production deployment accepted',
    '',
    `- **Commit:** \`${sha}\``,
    `- **Deploy run:** [${runId} · attempt ${runAttempt}](${runUrl})`,
    readinessRunId ? `- **Readiness run:** \`${readinessRunId}\`` : '- **Readiness run:** manual operator recovery',
    `- **Current pointer:** ${currentPointer}`,
    `- **Run-addressed provenance:** ${provenance}`,
    `- **Evidence artifact:** \`${artifact}\``,
    '- **Verifier:** `scripts/tts-live-deployment-contract.mjs` returned PASS after GitHub Pages deployment.',
    '',
    'The current pointer, exact run object, live Gill and standalone routes, CSP, controller → engine → notice CSS hash chain, Service Worker bytes and lazy no-precache policy were verified against the published deployment evidence.',
  ].join('\n');

  const associatedPulls = await github.paginate(
    github.rest.repos.listPullRequestsAssociatedWithCommit,
    { owner, repo, commit_sha: sha, per_page: 100 },
  );
  const exactMergedPulls = associatedPulls.filter(
    (pull) => pull.merged_at && normalize(pull.merge_commit_sha).toLowerCase() === sha,
  );
  if (exactMergedPulls.length > 1) {
    throw new Error(`multiple merged pull requests claim exact deployment SHA ${sha}`);
  }

  const allIssues = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'all',
    per_page: 100,
  });
  const expectedTitle = exactAcceptanceTitle(shortSha);
  const acceptanceIssues = allIssues.filter(
    (issue) => !issue.pull_request && issue.title === expectedTitle,
  );
  if (acceptanceIssues.length > 1) {
    throw new Error(`multiple acceptance issues match exact title: ${expectedTitle}`);
  }

  const touched = [];
  if (exactMergedPulls.length === 1) {
    const pull = exactMergedPulls[0];
    const created = await ensureComment({
      github,
      owner,
      repo,
      issueNumber: pull.number,
      marker,
      body,
    });
    touched.push(`PR #${pull.number}${created ? ' commented' : ' already recorded'}`);
  }

  if (acceptanceIssues.length === 1) {
    const issue = acceptanceIssues[0];
    const created = await ensureComment({
      github,
      owner,
      repo,
      issueNumber: issue.number,
      marker,
      body,
    });
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
    core.warning(`No exact merged PR or acceptance issue was found for deployed SHA ${sha}; current pointer, run-addressed provenance and artifact remain authoritative.`);
  }

  await core.summary
    .addHeading('Live deployment acceptance')
    .addRaw(`Commit: ${sha}\n\n`)
    .addLink(`Deploy run ${runId} · attempt ${runAttempt}`, runUrl)
    .addRaw(`\n\nCurrent pointer: ${currentPointer}\n\nRun provenance: ${provenance}\n\nArtifact: ${artifact}\n\n`)
    .addRaw(touched.length ? touched.join('\n') : 'No repository conversation target matched the exact SHA.')
    .write();

  core.info(`Live deployment acceptance recorded for ${sha}: ${touched.join('; ') || 'no exact conversation target'}`);
  return { sha, runId: Number(runId), runAttempt: Number(runAttempt), touched };
};
