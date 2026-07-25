'use strict';

const assert = require('node:assert/strict');

const FAILURE_CONCLUSIONS = new Set([
  'failure',
  'timed_out',
  'action_required',
  'startup_failure',
]);
const RECOVERY_CONCLUSION = 'success';

function normalize(value) {
  return String(value ?? '').trim();
}

function workflowIdentity(run) {
  const pullNumbers = Array.isArray(run.pull_requests)
    ? run.pull_requests
        .map((pull) => Number(pull && pull.number))
        .filter((number) => Number.isSafeInteger(number) && number > 0)
        .sort((a, b) => a - b)
    : [];
  if (pullNumbers.length > 0) return `pr:${pullNumbers.join(',')}`;
  return `branch:${normalize(run.head_branch) || 'unknown'}`;
}

function stateMarker(run) {
  const key = `${run.workflow_id}:${workflowIdentity(run)}`;
  return `<!-- ci-state:v1:${Buffer.from(key).toString('base64url')} -->`;
}

function eventMarker(run) {
  return `<!-- ci-state-event:${run.id}:${run.run_attempt}:${normalize(run.conclusion)} -->`;
}

function isNewerRun(candidate, current) {
  const candidateNumber = Number(candidate.run_number);
  const currentNumber = Number(current.run_number);
  const candidateAttempt = Number(candidate.run_attempt || 1);
  const currentAttempt = Number(current.run_attempt || 1);
  return candidateNumber > currentNumber || (
    candidateNumber === currentNumber && candidateAttempt > currentAttempt
  );
}

function compactJobEvidence(jobs) {
  return jobs
    .filter((job) => !['success', 'skipped', 'neutral'].includes(normalize(job.conclusion)))
    .map((job) => ({
      id: job.id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      url: job.html_url || null,
      failedSteps: Array.isArray(job.steps)
        ? job.steps
            .filter((step) => !['success', 'skipped', 'neutral'].includes(normalize(step.conclusion)))
            .map((step) => ({
              number: step.number,
              name: step.name,
              status: step.status,
              conclusion: step.conclusion,
            }))
        : [],
    }));
}

function compactArtifactEvidence(artifacts) {
  return artifacts.map((artifact) => ({
    id: artifact.id,
    name: artifact.name,
    bytes: artifact.size_in_bytes,
    digest: artifact.digest || null,
    expired: artifact.expired === true,
    expiresAt: artifact.expires_at || null,
  }));
}

async function hasEventMarker({ github, owner, repo, issue, marker }) {
  if (normalize(issue.body).includes(marker)) return true;
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issue.number,
    per_page: 100,
  });
  return comments.some((comment) => normalize(comment.body).includes(marker));
}

module.exports = async function recordCiWorkflowState({ github, context, core, workflowRun }) {
  assert.ok(github?.rest?.actions, 'github actions client is required');
  assert.ok(github?.rest?.issues, 'github issues client is required');
  assert.ok(context?.repo?.owner && context?.repo?.repo, 'repository context is required');
  assert.ok(workflowRun, 'workflow_run payload is required');

  const { owner, repo } = context.repo;
  const repository = `${owner}/${repo}`;
  const conclusion = normalize(workflowRun.conclusion);
  const identity = workflowIdentity(workflowRun);
  const marker = stateMarker(workflowRun);
  const runEventMarker = eventMarker(workflowRun);

  assert.ok(Number.isSafeInteger(Number(workflowRun.id)) && Number(workflowRun.id) > 0, 'workflow run ID must be positive');
  assert.ok(Number.isSafeInteger(Number(workflowRun.workflow_id)) && Number(workflowRun.workflow_id) > 0, 'workflow ID must be positive');
  assert.ok(Number.isSafeInteger(Number(workflowRun.run_number)) && Number(workflowRun.run_number) > 0, 'workflow run number must be positive');
  assert.ok(Number.isSafeInteger(Number(workflowRun.run_attempt || 1)) && Number(workflowRun.run_attempt || 1) > 0, 'workflow run attempt must be positive');
  assert.ok(normalize(workflowRun.name), 'workflow name is required');
  assert.ok(normalize(workflowRun.html_url), 'workflow run URL is required');
  assert.ok(normalize(workflowRun.head_sha), 'workflow head SHA is required');

  const relevantConclusion = conclusion === RECOVERY_CONCLUSION || FAILURE_CONCLUSIONS.has(conclusion);
  if (!relevantConclusion) {
    core.info(`No issue transition for ${workflowRun.name} conclusion ${conclusion || 'unknown'}.`);
    return { action: 'ignored-conclusion', conclusion, identity };
  }

  const recentRuns = await github.paginate(github.rest.actions.listWorkflowRuns, {
    owner,
    repo,
    workflow_id: workflowRun.workflow_id,
    status: 'completed',
    per_page: 100,
  });
  const newerSameIdentity = recentRuns
    .filter((candidate) => workflowIdentity(candidate) === identity && isNewerRun(candidate, workflowRun))
    .sort((a, b) => Number(b.run_number) - Number(a.run_number) || Number(b.run_attempt || 1) - Number(a.run_attempt || 1));
  if (newerSameIdentity.length > 0) {
    const newest = newerSameIdentity[0];
    core.info(`Ignoring stale ${workflowRun.name} event; newer ${identity} run ${newest.id} already completed with ${newest.conclusion}.`);
    return { action: 'ignored-stale-event', identity, newerRunId: newest.id };
  }

  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'all',
    per_page: 100,
  });
  const matchingIssues = issues.filter((issue) => !issue.pull_request && normalize(issue.body).includes(marker));
  if (matchingIssues.length > 1) {
    throw new Error(`multiple CI state issues contain marker ${marker}`);
  }
  const issue = matchingIssues[0] || null;

  const runAttempt = Number(workflowRun.run_attempt || 1);
  const runUrl = workflowRun.html_url;
  const sha = normalize(workflowRun.head_sha).toLowerCase();
  const shortSha = sha.slice(0, 7);
  const actor = normalize(workflowRun.actor && workflowRun.actor.login) || 'unknown';
  const commitMessage = normalize(workflowRun.head_commit && workflowRun.head_commit.message).split('\n')[0] || '(no commit message)';

  if (FAILURE_CONCLUSIONS.has(conclusion)) {
    const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
      owner,
      repo,
      run_id: workflowRun.id,
      filter: 'latest',
      per_page: 100,
    });
    const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
      owner,
      repo,
      run_id: workflowRun.id,
      per_page: 100,
    });
    const failedJobs = compactJobEvidence(jobs);
    const artifactEvidence = compactArtifactEvidence(artifacts);
    const machineEvidence = {
      schemaVersion: 1,
      repository,
      workflow: {
        id: Number(workflowRun.workflow_id),
        name: workflowRun.name,
        identity,
      },
      run: {
        id: Number(workflowRun.id),
        number: Number(workflowRun.run_number),
        attempt: runAttempt,
        conclusion,
        event: normalize(workflowRun.event) || null,
        headBranch: normalize(workflowRun.head_branch) || null,
        headSha: sha,
        url: runUrl,
        actor,
      },
      failedJobs,
      artifacts: artifactEvidence,
    };

    const body = [
      marker,
      runEventMarker,
      `## CI state: ${conclusion}`,
      '',
      `- **Workflow:** \`${workflowRun.name}\``,
      `- **Identity:** \`${identity}\``,
      `- **Run:** [${workflowRun.id} · #${workflowRun.run_number} · attempt ${runAttempt}](${runUrl})`,
      `- **Commit:** \`${shortSha}\` — ${commitMessage}`,
      `- **Actor:** @${actor}`,
      `- **Failed jobs:** ${failedJobs.length}`,
      `- **Artifacts listed by Actions API:** ${artifactEvidence.length}`,
      '',
      failedJobs.length > 0
        ? failedJobs.map((job) => `- \`${job.name}\`: ${job.conclusion || job.status}${job.failedSteps.length ? `; steps: ${job.failedSteps.map((step) => `\`${step.name}\`=${step.conclusion || step.status}`).join(', ')}` : ''}`).join('\n')
        : '_No failed job/step payload was returned. This can happen for `action_required` or startup failures; inspect the linked run._',
      '',
      '> This alert reports GitHub run/job/artifact metadata only. It does not guess a root cause or affected route.',
      '',
      '<details><summary>Machine evidence</summary>',
      '',
      '```json',
      JSON.stringify(machineEvidence, null, 2),
      '```',
      '</details>',
    ].join('\n');

    if (!issue) {
      const created = await github.rest.issues.create({
        owner,
        repo,
        title: `🚨 CI state: ${workflowRun.name} · ${identity}`,
        body,
        labels: ['ci-failure', 'bug'],
      });
      core.info(`Created CI state issue #${created.data.number}.`);
      return { action: 'created-failure-issue', issueNumber: created.data.number, identity, conclusion };
    }

    if (await hasEventMarker({ github, owner, repo, issue, marker: runEventMarker })) {
      core.info(`Run event ${runEventMarker} already recorded in issue #${issue.number}.`);
      return { action: 'already-recorded', issueNumber: issue.number, identity, conclusion };
    }

    if (issue.state !== 'open') {
      await github.rest.issues.update({ owner, repo, issue_number: issue.number, state: 'open' });
    }
    await github.rest.issues.createComment({ owner, repo, issue_number: issue.number, body });
    core.info(`${issue.state === 'open' ? 'Updated' : 'Reopened'} CI state issue #${issue.number}.`);
    return { action: issue.state === 'open' ? 'updated-failure-issue' : 'reopened-failure-issue', issueNumber: issue.number, identity, conclusion };
  }

  if (!issue || issue.state !== 'open') {
    core.info(`No open CI state issue requires recovery for ${workflowRun.name} ${identity}.`);
    return { action: 'success-without-open-issue', identity, conclusion };
  }
  if (await hasEventMarker({ github, owner, repo, issue, marker: runEventMarker })) {
    core.info(`Recovery run ${workflowRun.id} already recorded in issue #${issue.number}.`);
    return { action: 'already-recorded', issueNumber: issue.number, identity, conclusion };
  }

  const recoveryBody = [
    runEventMarker,
    '## CI state: recovered',
    '',
    `- **Workflow:** \`${workflowRun.name}\``,
    `- **Identity:** \`${identity}\``,
    `- **Successful run:** [${workflowRun.id} · #${workflowRun.run_number} · attempt ${runAttempt}](${runUrl})`,
    `- **Commit:** \`${shortSha}\` — ${commitMessage}`,
    '',
    'This exact workflow/identity state is green again. The issue is closed automatically as completed.',
  ].join('\n');
  await github.rest.issues.createComment({ owner, repo, issue_number: issue.number, body: recoveryBody });
  await github.rest.issues.update({
    owner,
    repo,
    issue_number: issue.number,
    state: 'closed',
    state_reason: 'completed',
  });
  core.info(`Closed recovered CI state issue #${issue.number}.`);
  return { action: 'closed-recovered-issue', issueNumber: issue.number, identity, conclusion };
};

module.exports.workflowIdentity = workflowIdentity;
module.exports.stateMarker = stateMarker;
module.exports.eventMarker = eventMarker;
