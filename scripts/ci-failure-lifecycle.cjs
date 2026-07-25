'use strict';

const crypto = require('node:crypto');

const FAILURE_CONCLUSIONS = new Set([
  'failure',
  'timed_out',
  'action_required',
  'startup_failure',
]);

const FAILED_STEP_CONCLUSIONS = new Set([
  'failure',
  'timed_out',
  'action_required',
  'startup_failure',
]);

function asPositiveInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function runVersion(run) {
  return {
    id: asPositiveInteger(run && run.id),
    attempt: asPositiveInteger(run && run.run_attempt, 1),
  };
}

function compareRunVersion(left, right) {
  const a = left || { id: 0, attempt: 0 };
  const b = right || { id: 0, attempt: 0 };
  if (a.id !== b.id) return a.id - b.id;
  return a.attempt - b.attempt;
}

function repositoryName(context) {
  return `${context.repo.owner}/${context.repo.repo}`;
}

function workflowIdentity(run) {
  const sourceRepository = run && run.head_repository && run.head_repository.full_name
    ? String(run.head_repository.full_name)
    : 'unknown-repository';
  const pullRequests = Array.isArray(run && run.pull_requests)
    ? run.pull_requests
      .map((pull) => asPositiveInteger(pull && pull.number))
      .filter(Boolean)
      .sort((a, b) => a - b)
    : [];

  if (pullRequests.length === 1) {
    return {
      key: `pr:${sourceRepository}#${pullRequests[0]}`,
      label: `PR #${pullRequests[0]}`,
    };
  }

  if (pullRequests.length > 1) {
    return {
      key: `prs:${sourceRepository}#${pullRequests.join(',')}`,
      label: `PRs #${pullRequests.join(', #')}`,
    };
  }

  const branch = String((run && run.head_branch) || 'unknown-branch');
  return {
    key: `branch:${sourceRepository}:${branch}`,
    label: `branch ${branch}`,
  };
}

function lifecycleDescriptor(run) {
  const identity = workflowIdentity(run);
  const canonical = JSON.stringify({
    version: 1,
    workflow: String((run && run.name) || 'unknown-workflow'),
    identity: identity.key,
  });
  const digest = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24);
  return {
    digest,
    identity,
    marker: `<!-- ci-failure-lifecycle:v1:${digest} -->`,
  };
}

function encodeState(state) {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}

function decodeState(body) {
  const match = String(body || '').match(/<!-- ci-failure-state:v1:([A-Za-z0-9_-]+) -->/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
    return parsed && parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function stateMarker(state) {
  return `<!-- ci-failure-state:v1:${encodeState(state)} -->`;
}

function conclusionLabel(value) {
  return value ? `\`${value}\`` : '`unknown`';
}

function safeText(value, fallback = 'unknown') {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text || fallback;
}

function formatBytes(value) {
  const bytes = asPositiveInteger(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function contextForWorkflow(name) {
  const contexts = {
    'Metadata & IndexNow Readiness': 'Release-readiness gateway. A failed run prevents the automatic Pages workflow from starting.',
    'Deploy to GitHub Pages': 'Production publication workflow. The failed job/step list below is the evidence; this label is not a root-cause diagnosis.',
    'Source Link Audit': 'Reader-facing source-link validation.',
    'Runtime Interactive Audit': 'Browser/runtime interaction validation.',
    'Visual Parity Guard — pixel-diff': 'Migration-parity visual validation. Pixel differences alone do not identify their cause.',
    'Dist Strangler Dry Run': 'Manual production-like dist validation.',
    'Shared Files Guard': 'Shared/system-file and control-plane validation.',
  };
  return contexts[name] || 'Repository CI validation. Use the exact failed jobs and steps below as the factual starting point.';
}

async function paginate(github, method, parameters) {
  if (typeof github.paginate === 'function') {
    return github.paginate(method, parameters);
  }
  const response = await method(parameters);
  return Array.isArray(response && response.data) ? response.data : [];
}

async function collectEvidence({ github, context, workflowRun }) {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const errors = [];
  let jobs = [];
  let artifacts = [];

  try {
    jobs = await paginate(github, github.rest.actions.listJobsForWorkflowRun, {
      owner,
      repo,
      run_id: workflowRun.id,
      filter: 'latest',
      per_page: 100,
    });
  } catch (error) {
    errors.push(`Jobs API: ${safeText(error && error.message, 'request failed')}`);
  }

  try {
    artifacts = await paginate(github, github.rest.actions.listWorkflowRunArtifacts, {
      owner,
      repo,
      run_id: workflowRun.id,
      per_page: 100,
    });
  } catch (error) {
    errors.push(`Artifacts API: ${safeText(error && error.message, 'request failed')}`);
  }

  const failedJobs = jobs
    .filter((job) => {
      if (FAILURE_CONCLUSIONS.has(job && job.conclusion)) return true;
      return Array.isArray(job && job.steps)
        && job.steps.some((step) => FAILED_STEP_CONCLUSIONS.has(step && step.conclusion));
    })
    .map((job) => ({
      id: asPositiveInteger(job.id),
      name: safeText(job.name, 'unnamed job'),
      conclusion: safeText(job.conclusion, 'unknown'),
      htmlUrl: safeText(job.html_url, workflowRun.html_url),
      startedAt: job.started_at || null,
      completedAt: job.completed_at || null,
      failedSteps: (Array.isArray(job.steps) ? job.steps : [])
        .filter((step) => FAILED_STEP_CONCLUSIONS.has(step && step.conclusion))
        .map((step) => ({
          number: asPositiveInteger(step.number),
          name: safeText(step.name, 'unnamed step'),
          conclusion: safeText(step.conclusion, 'unknown'),
        })),
    }));

  const visibleArtifacts = artifacts
    .filter((artifact) => artifact && !artifact.expired)
    .map((artifact) => ({
      id: asPositiveInteger(artifact.id),
      name: safeText(artifact.name, 'unnamed artifact'),
      sizeInBytes: asPositiveInteger(artifact.size_in_bytes),
      createdAt: artifact.created_at || null,
      expired: Boolean(artifact.expired),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { failedJobs, artifacts: visibleArtifacts, errors };
}

function metadataLines(run) {
  const headCommit = run && run.head_commit;
  const actor = run && run.actor && run.actor.login ? `@${run.actor.login}` : 'unknown';
  return [
    `- **Workflow:** ${safeText(run && run.name)}`,
    `- **Conclusion:** ${conclusionLabel(run && run.conclusion)}`,
    `- **Run:** [${asPositiveInteger(run && run.id)} attempt ${asPositiveInteger(run && run.run_attempt, 1)}](${safeText(run && run.html_url, '#')})`,
    `- **Full SHA:** \`${safeText(run && run.head_sha)}\``,
    `- **Branch:** \`${safeText(run && run.head_branch)}\``,
    `- **Event:** \`${safeText(run && run.event)}\``,
    `- **Actor:** ${actor}`,
    `- **Created:** ${safeText(run && run.created_at)}`,
    `- **Updated:** ${safeText(run && run.updated_at)}`,
    `- **Commit:** ${safeText(headCommit && headCommit.message, '(no commit message)').split('\n')[0]}`,
  ];
}

function evidenceLines(evidence, run) {
  const lines = ['## Verified failed jobs and steps', ''];
  if (!evidence.failedJobs.length) {
    lines.push('- The workflow conclusion is failure, but the Jobs API returned no failed job/step. Inspect the exact run before assigning root cause.');
  } else {
    for (const job of evidence.failedJobs) {
      lines.push(`- [${job.name}](${job.htmlUrl}) — ${conclusionLabel(job.conclusion)}`);
      if (job.failedSteps.length) {
        for (const step of job.failedSteps) {
          lines.push(`  - Step ${step.number || '?'}: **${step.name}** — ${conclusionLabel(step.conclusion)}`);
        }
      } else {
        lines.push('  - No failed step was returned; the job-level conclusion is the available evidence.');
      }
    }
  }

  lines.push('', '## Available artifacts', '');
  if (!evidence.artifacts.length) {
    lines.push('- No unexpired artifacts were returned for this run.');
  } else {
    for (const artifact of evidence.artifacts) {
      lines.push(`- **${artifact.name}** — ID ${artifact.id}, ${formatBytes(artifact.sizeInBytes)}, created ${safeText(artifact.createdAt)}`);
    }
    lines.push(`- Open the [exact workflow run](${safeText(run && run.html_url, '#')}) to download artifacts with repository authorization.`);
  }

  if (evidence.errors.length) {
    lines.push('', '## Evidence collection warnings', '');
    for (const error of evidence.errors) lines.push(`- ${error}`);
  }

  return lines;
}

function buildFailureBody({ workflowRun, descriptor, evidence, state }) {
  return [
    descriptor.marker,
    `# CI failure lifecycle: ${safeText(workflowRun.name)}`,
    '',
    `**Identity:** ${descriptor.identity.label}`,
    '',
    '## Exact run metadata',
    '',
    ...metadataLines(workflowRun),
    '',
    '## Workflow context — not a root-cause diagnosis',
    '',
    contextForWorkflow(workflowRun.name),
    '',
    ...evidenceLines(evidence, workflowRun),
    '',
    '> Route impact is not inferred from the commit message. It is included only when a real, parsed report is available; this notifier currently lists the actual artifacts instead.',
    '',
    'This issue is managed by `notify-on-failure.yml`. A newer successful run for the same workflow and identity closes it automatically.',
    '',
    stateMarker(state),
  ].join('\n');
}

function replaceStateMarker(body, state) {
  const marker = stateMarker(state);
  const source = String(body || '');
  if (/<!-- ci-failure-state:v1:[A-Za-z0-9_-]+ -->/.test(source)) {
    return source.replace(/<!-- ci-failure-state:v1:[A-Za-z0-9_-]+ -->/, marker);
  }
  return `${source.trim()}\n\n${marker}\n`;
}

function issueTitle(run, identity) {
  return `🚨 CI failure: ${safeText(run && run.name)} [${identity.label}]`;
}

async function listLifecycleIssues({ github, context, descriptor }) {
  const issues = await paginate(github, github.rest.issues.listForRepo, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    state: 'all',
    labels: 'ci-failure',
    per_page: 100,
  });
  const matches = issues.filter((issue) => {
    if (!issue || issue.pull_request) return false;
    return String(issue.body || '').includes(descriptor.marker);
  });
  if (matches.length > 1) {
    throw new Error(`Ambiguous CI lifecycle state: ${matches.length} issues share ${descriptor.marker}`);
  }
  return matches[0] || null;
}

async function handleFailure({ github, context, core, workflowRun, descriptor }) {
  const existing = await listLifecycleIssues({ github, context, descriptor });
  const previousState = existing ? decodeState(existing.body) : null;
  const current = runVersion(workflowRun);
  const previousFailure = previousState && previousState.latestFailure;
  const latestTransition = previousState && (previousState.latestSeen || previousFailure);

  if (latestTransition && compareRunVersion(current, latestTransition) <= 0) {
    core.info(
      `Ignoring stale/duplicate failure run ${current.id}/${current.attempt}; ` +
      `latest transition is ${latestTransition.id}/${latestTransition.attempt}`,
    );
    return { action: 'ignored-stale-failure', issueNumber: existing.number };
  }

  const evidence = await collectEvidence({ github, context, workflowRun });
  const state = {
    version: 1,
    key: descriptor.digest,
    workflow: safeText(workflowRun.name),
    identity: descriptor.identity.key,
    latestFailure: {
      ...current,
      sha: safeText(workflowRun.head_sha),
      conclusion: safeText(workflowRun.conclusion),
    },
    latestSeen: {
      ...current,
      conclusion: safeText(workflowRun.conclusion),
    },
  };
  const body = buildFailureBody({ workflowRun, descriptor, evidence, state });
  const labels = Array.from(new Set([
    ...((existing && Array.isArray(existing.labels))
      ? existing.labels.map((label) => typeof label === 'string' ? label : label.name).filter(Boolean)
      : []),
    'ci-failure',
    'bug',
  ]));

  if (!existing) {
    const created = await github.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: issueTitle(workflowRun, descriptor.identity),
      body,
      labels,
    });
    core.info(`Created CI lifecycle issue #${created.data.number}`);
    return { action: 'created', issueNumber: created.data.number };
  }

  await github.rest.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: existing.number,
    title: issueTitle(workflowRun, descriptor.identity),
    body,
    labels,
    state: 'open',
  });
  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: existing.number,
    body: [
      `### Newer failure observed`,
      '',
      `- Run: [${current.id} attempt ${current.attempt}](${safeText(workflowRun.html_url, '#')})`,
      `- Full SHA: \`${safeText(workflowRun.head_sha)}\``,
      `- Conclusion: ${conclusionLabel(workflowRun.conclusion)}`,
      '',
      'The issue body now contains the current factual job/step/artifact evidence.',
    ].join('\n'),
  });
  core.info(`Updated CI lifecycle issue #${existing.number}`);
  return { action: existing.state === 'closed' ? 'reopened' : 'updated', issueNumber: existing.number };
}

async function handleSuccess({ github, context, core, workflowRun, descriptor }) {
  const existing = await listLifecycleIssues({ github, context, descriptor });
  if (!existing || existing.state !== 'open') {
    core.info('No matching open CI lifecycle issue to recover');
    return { action: 'no-open-alert' };
  }

  const state = decodeState(existing.body);
  if (!state || !state.latestFailure) {
    core.warning(`Issue #${existing.number} has no parseable lifecycle state; refusing to close`);
    return { action: 'invalid-state', issueNumber: existing.number };
  }

  const current = runVersion(workflowRun);
  if (compareRunVersion(current, state.latestFailure) <= 0) {
    core.info(`Success ${current.id}/${current.attempt} is not newer than failure ${state.latestFailure.id}/${state.latestFailure.attempt}`);
    return { action: 'ignored-stale-success', issueNumber: existing.number };
  }

  const nextState = {
    ...state,
    latestSeen: {
      ...current,
      conclusion: 'success',
      sha: safeText(workflowRun.head_sha),
    },
    recoveredBy: {
      ...current,
      sha: safeText(workflowRun.head_sha),
    },
  };

  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: existing.number,
    body: [
      '### ✅ recovered',
      '',
      `A newer successful run recovered this workflow identity.`,
      '',
      `- Run: [${current.id} attempt ${current.attempt}](${safeText(workflowRun.html_url, '#')})`,
      `- Full SHA: \`${safeText(workflowRun.head_sha)}\``,
      `- Branch: \`${safeText(workflowRun.head_branch)}\``,
      `- Updated: ${safeText(workflowRun.updated_at)}`,
    ].join('\n'),
  });
  await github.rest.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: existing.number,
    body: replaceStateMarker(existing.body, nextState),
    state: 'closed',
    state_reason: 'completed',
  });
  core.info(`Closed recovered CI lifecycle issue #${existing.number}`);
  return { action: 'recovered', issueNumber: existing.number };
}

async function runNotifier({ github, context, core, workflowRun }) {
  if (!github || !context || !core || !workflowRun) {
    throw new Error('github, context, core and workflowRun are required');
  }

  const sourceRepository = workflowRun.head_repository && workflowRun.head_repository.full_name;
  if (sourceRepository && sourceRepository !== repositoryName(context)) {
    core.info(`Ignoring external-repository run from ${sourceRepository}`);
    return { action: 'ignored-external-repository' };
  }

  const descriptor = lifecycleDescriptor(workflowRun);
  if (FAILURE_CONCLUSIONS.has(workflowRun.conclusion)) {
    return handleFailure({ github, context, core, workflowRun, descriptor });
  }
  if (workflowRun.conclusion === 'success') {
    return handleSuccess({ github, context, core, workflowRun, descriptor });
  }

  core.info(`Ignoring non-failure conclusion ${safeText(workflowRun.conclusion)}`);
  return { action: 'ignored-non-failure' };
}

module.exports = runNotifier;
module.exports._test = {
  buildFailureBody,
  compareRunVersion,
  decodeState,
  lifecycleDescriptor,
  runVersion,
  workflowIdentity,
};
