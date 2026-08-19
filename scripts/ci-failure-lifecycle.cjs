'use strict';

const FAILURE_CONCLUSIONS = new Set([
  'failure',
  'timed_out',
  'action_required',
  'startup_failure',
]);

const FAILED_STEP_CONCLUSIONS = new Set(FAILURE_CONCLUSIONS);

function asPositiveInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
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

async function paginate(github, method, parameters) {
  if (typeof github.paginate === 'function') {
    return github.paginate(method, parameters);
  }
  const response = await method(parameters);
  return Array.isArray(response && response.data) ? response.data : [];
}

function repositoryName(context) {
  return `${context.repo.owner}/${context.repo.repo}`;
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
      if (FAILED_STEP_CONCLUSIONS.has(job && job.conclusion)) return true;
      return Array.isArray(job && job.steps)
        && job.steps.some((step) => FAILED_STEP_CONCLUSIONS.has(step && step.conclusion));
    })
    .map((job) => ({
      id: asPositiveInteger(job && job.id),
      name: safeText(job && job.name, 'unnamed job'),
      conclusion: safeText(job && job.conclusion, 'unknown'),
      htmlUrl: safeText(job && job.html_url, safeText(workflowRun && workflowRun.html_url, '#')),
      failedSteps: (Array.isArray(job && job.steps) ? job.steps : [])
        .filter((step) => FAILED_STEP_CONCLUSIONS.has(step && step.conclusion))
        .map((step) => ({
          number: asPositiveInteger(step && step.number),
          name: safeText(step && step.name, 'unnamed step'),
          conclusion: safeText(step && step.conclusion, 'unknown'),
        })),
    }));

  const visibleArtifacts = artifacts
    .filter((artifact) => artifact && !artifact.expired)
    .map((artifact) => ({
      id: asPositiveInteger(artifact.id),
      name: safeText(artifact.name, 'unnamed artifact'),
      sizeInBytes: asPositiveInteger(artifact.size_in_bytes),
      createdAt: artifact.created_at || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { failedJobs, artifacts: visibleArtifacts, errors };
}

function emitEvidence({ core, workflowRun, evidence }) {
  const runId = asPositiveInteger(workflowRun && workflowRun.id);
  const attempt = asPositiveInteger(workflowRun && workflowRun.run_attempt, 1);
  const heading = [
    `CI diagnostic: ${safeText(workflowRun && workflowRun.name)}`,
    `conclusion=${safeText(workflowRun && workflowRun.conclusion)}`,
    `run=${runId}`,
    `attempt=${attempt}`,
    `branch=${safeText(workflowRun && workflowRun.head_branch)}`,
    `sha=${safeText(workflowRun && workflowRun.head_sha)}`,
  ].join(' | ');
  core.warning(heading);

  if (!evidence.failedJobs.length) {
    core.warning('Workflow failed, but the Jobs API returned no failed job/step; inspect the exact run before assigning root cause.');
  } else {
    for (const job of evidence.failedJobs) {
      core.warning(`Failed job: ${job.name} [${job.conclusion}] ${job.htmlUrl}`);
      for (const step of job.failedSteps) {
        core.warning(`Failed step ${step.number || '?'}: ${step.name} [${step.conclusion}]`);
      }
    }
  }

  if (evidence.artifacts.length) {
    for (const artifact of evidence.artifacts) {
      core.info(`Diagnostic artifact: ${artifact.name} — ID ${artifact.id}, ${formatBytes(artifact.sizeInBytes)}, created ${safeText(artifact.createdAt)}`);
    }
  } else {
    core.info('No unexpired diagnostic artifacts were returned for this run.');
  }

  for (const error of evidence.errors) {
    core.warning(`Evidence collection warning: ${error}`);
  }
}

async function runDiagnostics({ github, context, core, workflowRun }) {
  const sourceRepository = workflowRun && workflowRun.head_repository && workflowRun.head_repository.full_name
    ? String(workflowRun.head_repository.full_name)
    : repositoryName(context);

  // workflow_run has privileged repository context. Never use it to process a
  // fork head with write-capable behavior. This observer is read-only anyway,
  // but retaining the same-repository boundary keeps the security contract explicit.
  if (sourceRepository !== repositoryName(context)) {
    core.info(`Ignoring external repository head: ${sourceRepository}`);
    return { action: 'ignored-external-repository' };
  }

  if (!FAILURE_CONCLUSIONS.has(workflowRun && workflowRun.conclusion)) {
    core.info(`No failure diagnostic required for ${safeText(workflowRun && workflowRun.conclusion)} run.`);
    return { action: 'ignored-non-failure' };
  }

  const evidence = await collectEvidence({ github, context, workflowRun });
  emitEvidence({ core, workflowRun, evidence });

  return {
    action: 'recorded-read-only',
    run: {
      id: asPositiveInteger(workflowRun && workflowRun.id),
      attempt: asPositiveInteger(workflowRun && workflowRun.run_attempt, 1),
      workflow: safeText(workflowRun && workflowRun.name),
      conclusion: safeText(workflowRun && workflowRun.conclusion),
      branch: safeText(workflowRun && workflowRun.head_branch),
      sha: safeText(workflowRun && workflowRun.head_sha),
    },
    evidence,
  };
}

module.exports = runDiagnostics;
