'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const FAILURES = new Set(['failure', 'timed_out', 'action_required', 'startup_failure']);
const PASSIVE = new Set(['cancelled', 'skipped', 'neutral']);
const KEY_PREFIX = 'ci-failure-key:v2:';
const STATE_PREFIX = 'ci-failure-state:v2:';

const text = (value) => String(value ?? '').trim();
const integer = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

function identity(run) {
  return {
    workflow: text(run?.name) || 'Unknown workflow',
    branch: text(run?.head_branch) || 'unknown',
  };
}

function runIdentity(run) {
  return {
    runId: integer(run?.id),
    runAttempt: integer(run?.run_attempt, 1),
  };
}

function compareRuns(left, right) {
  const leftRun = integer(left?.runId);
  const rightRun = integer(right?.runId);
  if (leftRun !== rightRun) return leftRun - rightRun;
  return integer(left?.runAttempt, 1) - integer(right?.runAttempt, 1);
}

function markerFor(run) {
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(identity(run)))
    .digest('hex');
  return `<!-- ${KEY_PREFIX}${digest} -->`;
}

function stateMarker(state) {
  const encoded = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
  return `<!-- ${STATE_PREFIX}${encoded} -->`;
}

function parseState(body) {
  const match = text(body).match(/<!-- ci-failure-state:v2:([A-Za-z0-9_-]+) -->/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function legacyRunId(issue) {
  const match = text(issue?.body).match(/\/actions\/runs\/(\d+)/);
  return match ? integer(match[1]) : 0;
}

function isLegacyMatch(issue, run) {
  const { workflow, branch } = identity(run);
  return (
    text(issue?.title) === `🚨 CI failure: ${workflow}` &&
    text(issue?.body).includes(`(ветка \`${branch}\`)`)
  );
}

async function paginate(github, method, parameters) {
  if (typeof github.paginate === 'function') return github.paginate(method, parameters);
  const response = await method(parameters);
  return Array.isArray(response?.data) ? response.data : [];
}

async function listLifecycleIssues({ github, owner, repo }) {
  return paginate(github, github.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'all',
    labels: 'ci-failure',
    per_page: 100,
  });
}

function locateIssue(issues, run) {
  const marker = markerFor(run);
  const marked = issues.filter((issue) => text(issue?.body).includes(marker));
  if (marked.length > 1) throw new Error(`multiple lifecycle issues contain ${marker}`);
  if (marked.length === 1) return { issue: marked[0], marker, legacy: false };

  const legacy = issues.filter((issue) => isLegacyMatch(issue, run));
  if (legacy.length > 1) throw new Error(`multiple legacy lifecycle issues match ${identity(run).workflow}/${identity(run).branch}`);
  return { issue: legacy[0] || null, marker, legacy: legacy.length === 1 };
}

function failureState(run) {
  const current = runIdentity(run);
  return {
    failureRunId: current.runId,
    failureRunAttempt: current.runAttempt,
    failureSha: text(run?.head_sha).toLowerCase(),
    conclusion: text(run?.conclusion),
    updatedAt: text(run?.updated_at) || null,
  };
}

function storedRun(state) {
  return {
    runId: integer(state?.failureRunId),
    runAttempt: integer(state?.failureRunAttempt, 1),
  };
}

function inline(value) {
  return text(value).replace(/\r?\n/g, ' ').replace(/`/g, '\\`').replace(/\|/g, '\\|');
}

function failedRows(jobs) {
  const rows = [];
  for (const job of jobs) {
    const steps = Array.isArray(job?.steps) ? job.steps : [];
    const failures = steps.filter((step) => FAILURES.has(text(step?.conclusion)));
    if (failures.length) {
      for (const step of failures) {
        rows.push({
          job: text(job?.name) || `job-${job?.id}`,
          step: text(step?.name) || `step-${step?.number}`,
          conclusion: text(step?.conclusion) || 'failure',
        });
      }
    } else if (FAILURES.has(text(job?.conclusion))) {
      rows.push({
        job: text(job?.name) || `job-${job?.id}`,
        step: '(failed job; no failed step record returned)',
        conclusion: text(job?.conclusion),
      });
    }
  }
  return rows;
}

async function loadEvidence({ github, owner, repo, run }) {
  const runId = integer(run?.id);
  const errors = [];
  let jobs = [];
  let artifacts = [];

  try {
    jobs = await paginate(github, github.rest.actions.listJobsForWorkflowRun, {
      owner, repo, run_id: runId, filter: 'latest', per_page: 100,
    });
  } catch (error) {
    errors.push(`jobs API: ${text(error?.message) || 'unknown error'}`);
  }

  try {
    artifacts = await paginate(github, github.rest.actions.listWorkflowRunArtifacts, {
      owner, repo, run_id: runId, per_page: 100,
    });
  } catch (error) {
    errors.push(`artifacts API: ${text(error?.message) || 'unknown error'}`);
  }

  return {
    failedSteps: failedRows(jobs),
    artifacts: artifacts.map((artifact) => ({
      id: integer(artifact?.id),
      name: text(artifact?.name) || 'unnamed-artifact',
      bytes: integer(artifact?.size_in_bytes),
      expired: Boolean(artifact?.expired),
      digest: text(artifact?.digest) || null,
    })),
    errors,
  };
}

function renderFailure({ repository, run, marker, evidence }) {
  const { workflow, branch } = identity(run);
  const state = failureState(run);
  const runUrl = text(run?.html_url) || `https://github.com/${repository}/actions/runs/${state.failureRunId}`;
  const lines = [
    marker,
    stateMarker(state),
    '## CI failure lifecycle',
    '',
    `- **Workflow:** ${inline(workflow)}`,
    `- **Branch / identity:** \`${inline(branch)}\``,
    `- **Event:** \`${inline(run?.event || 'unknown')}\``,
    `- **Conclusion:** \`${inline(run?.conclusion || 'failure')}\``,
    `- **Commit:** \`${inline(run?.head_sha || 'unknown')}\``,
    `- **Run:** [${state.failureRunId} · attempt ${state.failureRunAttempt}](${runUrl})`,
    `- **Created:** ${inline(run?.created_at || 'unknown')}`,
    `- **Updated:** ${inline(run?.updated_at || 'unknown')}`,
    '',
    '### Exact failed jobs and steps',
    '',
  ];

  if (evidence.failedSteps.length) {
    for (const row of evidence.failedSteps) {
      lines.push(`- **${inline(row.job)}** → ${inline(row.step)} (\`${inline(row.conclusion)}\`)`);
    }
  } else {
    lines.push('- Actions API returned no failed step record. No root cause is inferred.');
  }

  lines.push('', '### Artifacts published by this run', '');
  if (evidence.artifacts.length) {
    for (const artifact of evidence.artifacts) {
      const url = `https://github.com/${repository}/actions/runs/${state.failureRunId}/artifacts/${artifact.id}`;
      const digest = artifact.digest ? ` · \`${inline(artifact.digest)}\`` : '';
      const expired = artifact.expired ? ' · expired' : '';
      lines.push(`- [${inline(artifact.name)} · ID ${artifact.id}](${url}) · ${artifact.bytes} bytes${digest}${expired}`);
    }
  } else {
    lines.push('- No artifacts were returned by the Actions API.');
  }

  if (evidence.errors.length) {
    lines.push('', '### Diagnostics unavailable', '');
    for (const error of evidence.errors) lines.push(`- ${inline(error)}`);
  }

  lines.push(
    '',
    '> This alert reports exact workflow, job, step and artifact data only. It does not infer a root cause or affected route from the workflow name or commit message.',
    '',
    `Machine key: \`${workflow}\` + \`${branch}\`.`,
  );
  return lines.join('\n');
}

function recoveryComment(run) {
  const { workflow, branch } = identity(run);
  const current = runIdentity(run);
  return [
    '## Recovered',
    '',
    `A newer exact run for **${inline(workflow)}** on \`${inline(branch)}\` succeeded.`,
    '',
    `- **Commit:** \`${inline(run?.head_sha || 'unknown')}\``,
    `- **Run:** [${current.runId} · attempt ${current.runAttempt}](${text(run?.html_url)})`,
    `- **Updated:** ${inline(run?.updated_at || 'unknown')}`,
  ].join('\n');
}

function stateForMatch(match) {
  const state = match.issue ? parseState(match.issue.body) : null;
  if (state) return state;
  if (match.legacy) {
    return { failureRunId: legacyRunId(match.issue), failureRunAttempt: 1 };
  }
  return null;
}

async function onFailure({ github, context, core, run }) {
  const { owner, repo } = context.repo;
  const repository = `${owner}/${repo}`;
  const issues = await listLifecycleIssues({ github, owner, repo });
  const match = locateIssue(issues, run);
  const current = runIdentity(run);
  const prior = stateForMatch(match);

  if (prior && compareRuns(current, storedRun(prior)) <= 0) {
    core.info(`Ignoring stale failure run ${current.runId}.${current.runAttempt}`);
    return { action: 'ignored-stale-failure', issueNumber: match.issue.number };
  }

  const evidence = await loadEvidence({ github, owner, repo, run });
  const body = renderFailure({ repository, run, marker: match.marker, evidence });
  const { workflow, branch } = identity(run);
  const title = `🚨 CI failure: ${workflow} · ${branch}`;

  if (match.issue) {
    await github.rest.issues.update({
      owner, repo, issue_number: match.issue.number,
      title, body, labels: ['ci-failure', 'bug'], state: 'open',
    });
    await github.rest.issues.createComment({
      owner, repo, issue_number: match.issue.number,
      body: `Newer failure recorded: run ${current.runId}, attempt ${current.runAttempt}, commit \`${text(run?.head_sha)}\`.`,
    });
    core.info(`Updated CI lifecycle issue #${match.issue.number}`);
    return { action: 'updated', issueNumber: match.issue.number, evidence };
  }

  const created = await github.rest.issues.create({
    owner, repo, title, body, labels: ['ci-failure', 'bug'],
  });
  core.info(`Created CI lifecycle issue #${created.data.number}`);
  return { action: 'created', issueNumber: created.data.number, evidence };
}

async function onSuccess({ github, context, core, run }) {
  const { owner, repo } = context.repo;
  const issues = await listLifecycleIssues({ github, owner, repo });
  const match = locateIssue(issues, run);

  if (!match.issue || match.issue.state !== 'open') {
    core.info('No matching open CI lifecycle issue exists; success requires no mutation.');
    return { action: 'no-open-alert' };
  }

  const prior = stateForMatch(match);
  if (!prior || !integer(prior.failureRunId)) {
    core.warning(`Matching issue #${match.issue.number} has no trustworthy failure run identity; leaving it open.`);
    return { action: 'missing-failure-identity', issueNumber: match.issue.number };
  }

  const current = runIdentity(run);
  if (compareRuns(current, storedRun(prior)) <= 0) {
    core.info(`Success ${current.runId}.${current.runAttempt} is not newer than stored failure; leaving issue open.`);
    return { action: 'ignored-stale-success', issueNumber: match.issue.number };
  }

  await github.rest.issues.createComment({
    owner, repo, issue_number: match.issue.number, body: recoveryComment(run),
  });
  await github.rest.issues.update({
    owner, repo, issue_number: match.issue.number,
    state: 'closed', state_reason: 'completed',
  });
  core.info(`Closed recovered CI lifecycle issue #${match.issue.number}`);
  return { action: 'recovered', issueNumber: match.issue.number };
}

async function handleWorkflowLifecycle({ github, context, core, workflowRun }) {
  assert.ok(github?.rest?.actions && github?.rest?.issues, 'GitHub Actions and Issues clients are required');
  assert.ok(context?.repo?.owner && context?.repo?.repo, 'repository context is required');
  assert.ok(workflowRun?.name, 'workflow_run payload is required');

  const conclusion = text(workflowRun.conclusion);
  if (FAILURES.has(conclusion)) return onFailure({ github, context, core, run: workflowRun });
  if (conclusion === 'success') return onSuccess({ github, context, core, run: workflowRun });
  if (PASSIVE.has(conclusion)) {
    core.info(`Conclusion ${conclusion} does not create or close an alert.`);
    return { action: 'ignored-non-failure' };
  }
  core.info(`Unsupported conclusion ${conclusion || '(empty)'}; no mutation.`);
  return { action: 'ignored-unsupported' };
}

module.exports = {
  compareRuns,
  handleWorkflowLifecycle,
  identity,
  locateIssue,
  markerFor,
  parseState,
  renderFailure,
  runIdentity,
};
