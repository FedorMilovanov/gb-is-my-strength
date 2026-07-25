#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const runNotifier = require('./ci-failure-lifecycle.cjs');

function makeRun(overrides = {}) {
  const id = overrides.id ?? 100;
  const branch = overrides.head_branch ?? 'agent/example';
  return {
    id,
    run_attempt: overrides.run_attempt ?? 1,
    name: overrides.name ?? 'Shared Files Guard',
    conclusion: overrides.conclusion ?? 'failure',
    html_url: overrides.html_url ?? `https://github.com/example/repo/actions/runs/${id}`,
    head_sha: overrides.head_sha ?? String(id).padStart(40, 'a').slice(-40),
    head_branch: branch,
    event: overrides.event ?? 'pull_request',
    created_at: overrides.created_at ?? '2026-07-25T18:00:00Z',
    updated_at: overrides.updated_at ?? '2026-07-25T18:05:00Z',
    actor: overrides.actor ?? { login: 'agent' },
    head_commit: overrides.head_commit ?? { message: 'test: deterministic notifier fixture' },
    head_repository: overrides.head_repository ?? { full_name: 'example/repo' },
    pull_requests: overrides.pull_requests ?? [],
  };
}

function createHarness() {
  const state = {
    issues: [],
    comments: [],
    jobsByRun: new Map(),
    artifactsByRun: new Map(),
    nextIssueNumber: 1,
    infos: [],
    warnings: [],
  };

  const github = {
    paginate: async (method, parameters) => {
      const response = await method(parameters);
      return response.data;
    },
    rest: {
      actions: {
        listJobsForWorkflowRun: async ({ run_id }) => ({
          data: state.jobsByRun.get(run_id) || [],
        }),
        listWorkflowRunArtifacts: async ({ run_id }) => ({
          data: state.artifactsByRun.get(run_id) || [],
        }),
      },
      issues: {
        listForRepo: async ({ state: requestedState, labels }) => {
          let issues = state.issues;
          if (requestedState && requestedState !== 'all') {
            issues = issues.filter((issue) => issue.state === requestedState);
          }
          if (labels) {
            const required = String(labels).split(',').map((value) => value.trim()).filter(Boolean);
            issues = issues.filter((issue) => required.every((label) => issue.labels.some((item) => item.name === label)));
          }
          return { data: issues.map((issue) => ({ ...issue, labels: issue.labels.map((item) => ({ ...item })) })) };
        },
        create: async ({ title, body, labels }) => {
          const issue = {
            number: state.nextIssueNumber++,
            title,
            body,
            labels: labels.map((name) => ({ name })),
            state: 'open',
            state_reason: null,
          };
          state.issues.push(issue);
          return { data: { ...issue } };
        },
        update: async ({ issue_number, ...patch }) => {
          const issue = state.issues.find((item) => item.number === issue_number);
          assert.ok(issue, `issue #${issue_number} must exist`);
          if (patch.title !== undefined) issue.title = patch.title;
          if (patch.body !== undefined) issue.body = patch.body;
          if (patch.labels !== undefined) issue.labels = patch.labels.map((name) => ({ name }));
          if (patch.state !== undefined) issue.state = patch.state;
          if (patch.state_reason !== undefined) issue.state_reason = patch.state_reason;
          return { data: { ...issue } };
        },
        createComment: async ({ issue_number, body }) => {
          state.comments.push({ issue_number, body });
          return { data: { id: state.comments.length, body } };
        },
      },
    },
  };

  const context = { repo: { owner: 'example', repo: 'repo' } };
  const core = {
    info: (message) => state.infos.push(String(message)),
    warning: (message) => state.warnings.push(String(message)),
  };

  return { state, github, context, core };
}

function failedJob(stepName) {
  return [{
    id: 9001,
    name: 'deterministic-job',
    conclusion: 'failure',
    html_url: 'https://github.com/example/repo/actions/runs/100/job/9001',
    started_at: '2026-07-25T18:01:00Z',
    completed_at: '2026-07-25T18:02:00Z',
    steps: [
      { number: 1, name: 'checkout', conclusion: 'success' },
      { number: 2, name: stepName, conclusion: 'failure' },
    ],
  }];
}

(async () => {
  const harness = createHarness();
  const { state, github, context, core } = harness;

  // 1. Failure creates exactly one lifecycle issue with factual job/step data.
  state.jobsByRun.set(100, failedJob('Actual failing step from Jobs API'));
  state.artifactsByRun.set(100, [{
    id: 77,
    name: 'real-diagnostics',
    size_in_bytes: 2048,
    created_at: '2026-07-25T18:03:00Z',
    expired: false,
  }]);
  const created = await runNotifier({ github, context, core, workflowRun: makeRun({ id: 100 }) });
  assert.equal(created.action, 'created');
  assert.equal(state.issues.length, 1);
  assert.match(state.issues[0].body, /Actual failing step from Jobs API/);
  assert.match(state.issues[0].body, /real-diagnostics/);
  assert.doesNotMatch(state.issues[0].body, /Astro or copy-legacy|DOM-structure/i);

  // 2. A newer failure updates the same issue instead of creating a duplicate.
  state.jobsByRun.set(101, failedJob('Second factual failure'));
  const updated = await runNotifier({ github, context, core, workflowRun: makeRun({ id: 101 }) });
  assert.equal(updated.action, 'updated');
  assert.equal(state.issues.length, 1);
  assert.match(state.issues[0].body, /Second factual failure/);
  assert.equal(state.comments.length, 1);

  // 3. A different branch has a different lifecycle key and issue.
  state.jobsByRun.set(102, failedJob('Other branch failure'));
  const otherBranch = await runNotifier({
    github,
    context,
    core,
    workflowRun: makeRun({ id: 102, head_branch: 'agent/other-branch' }),
  });
  assert.equal(otherBranch.action, 'created');
  assert.equal(state.issues.length, 2);

  // 4. Cancelled/superseded runs never create false failure alerts.
  const beforeCancelled = state.issues.length;
  const cancelled = await runNotifier({
    github,
    context,
    core,
    workflowRun: makeRun({ id: 103, conclusion: 'cancelled', head_branch: 'agent/cancelled' }),
  });
  assert.equal(cancelled.action, 'ignored-non-failure');
  assert.equal(state.issues.length, beforeCancelled);

  // 5. An older success cannot close a newer failure.
  const staleSuccess = await runNotifier({
    github,
    context,
    core,
    workflowRun: makeRun({ id: 100, conclusion: 'success' }),
  });
  assert.equal(staleSuccess.action, 'ignored-stale-success');
  assert.equal(state.issues[0].state, 'open');

  // 6. A newer success closes the issue with completed reason and recovered comment.
  const recovered = await runNotifier({
    github,
    context,
    core,
    workflowRun: makeRun({ id: 104, conclusion: 'success' }),
  });
  assert.equal(recovered.action, 'recovered');
  assert.equal(state.issues[0].state, 'closed');
  assert.equal(state.issues[0].state_reason, 'completed');
  assert.ok(state.comments.some((comment) => comment.issue_number === state.issues[0].number && /recovered/.test(comment.body)));

  // A delayed rerun of an older failure must not reopen after a newer recovery transition.
  const commentsAfterRecovery = state.comments.length;
  state.jobsByRun.set(101, failedJob('Delayed old failure attempt'));
  const delayedFailureAfterRecovery = await runNotifier({
    github,
    context,
    core,
    workflowRun: makeRun({ id: 101, run_attempt: 2 }),
  });
  assert.equal(delayedFailureAfterRecovery.action, 'ignored-stale-failure');
  assert.equal(state.issues[0].state, 'closed');
  assert.equal(state.comments.length, commentsAfterRecovery);

  // An event equal to the latest recovery transition is also a duplicate.
  const duplicateRecoveryVersion = await runNotifier({
    github,
    context,
    core,
    workflowRun: makeRun({ id: 104, run_attempt: 1 }),
  });
  assert.equal(duplicateRecoveryVersion.action, 'ignored-stale-failure');
  assert.equal(state.issues[0].state, 'closed');

  // A genuinely newer failure after recovery reopens the same machine-key issue.
  state.jobsByRun.set(105, failedJob('Genuinely newer post-recovery failure'));
  const reopenedAfterRecovery = await runNotifier({
    github,
    context,
    core,
    workflowRun: makeRun({ id: 105 }),
  });
  assert.equal(reopenedAfterRecovery.action, 'reopened');
  assert.equal(state.issues.length, 2);
  assert.equal(state.issues[0].state, 'open');
  assert.match(state.issues[0].body, /Genuinely newer post-recovery failure/);

  const recoveredAgain = await runNotifier({
    github,
    context,
    core,
    workflowRun: makeRun({ id: 106, conclusion: 'success' }),
  });
  assert.equal(recoveredAgain.action, 'recovered');
  assert.equal(state.issues[0].state, 'closed');

  // Same run ID with a higher successful attempt is also newer and can recover a rerun.
  state.jobsByRun.set(110, failedJob('Attempt one failed'));
  await runNotifier({
    github,
    context,
    core,
    workflowRun: makeRun({ id: 110, run_attempt: 1, head_branch: 'agent/rerun' }),
  });
  const rerunRecovery = await runNotifier({
    github,
    context,
    core,
    workflowRun: makeRun({ id: 110, run_attempt: 2, conclusion: 'success', head_branch: 'agent/rerun' }),
  });
  assert.equal(rerunRecovery.action, 'recovered');

  // External repository heads do not receive a write-capable lifecycle mutation.
  const beforeExternal = state.issues.length;
  const external = await runNotifier({
    github,
    context,
    core,
    workflowRun: makeRun({
      id: 120,
      head_branch: 'contributor-branch',
      head_repository: { full_name: 'fork/repo' },
    }),
  });
  assert.equal(external.action, 'ignored-external-repository');
  assert.equal(state.issues.length, beforeExternal);

  // 7. Evidence comes from job data, never workflow-name root-cause guesses.
  const factualIssue = state.issues.find((issue) => /agent\/other-branch/.test(issue.body));
  assert.ok(factualIssue);
  assert.match(factualIssue.body, /Other branch failure/);
  assert.doesNotMatch(factualIssue.body, /Вероятно|Как исправить|Подозреваемые route/);

  // 8. Route-impact is explicitly omitted rather than faked.
  assert.match(state.issues[0].body, /Route impact is not inferred/);
  assert.doesNotMatch(state.issues[0].body, /route_impact_data=/);

  console.log('✅ CI failure lifecycle deterministic contract passed');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
