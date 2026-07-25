'use strict';

const assert = require('node:assert/strict');
const {
  compareRuns,
  handleWorkflowLifecycle,
  markerFor,
  parseState,
} = require('./ci-failure-lifecycle.cjs');

function run(overrides = {}) {
  return {
    id: 100,
    run_attempt: 1,
    name: 'Metadata & IndexNow Readiness',
    conclusion: 'failure',
    head_sha: 'a'.repeat(40),
    head_branch: 'main',
    event: 'push',
    html_url: 'https://github.com/FedorMilovanov/gb-is-my-strength/actions/runs/100',
    created_at: '2026-07-25T18:00:00Z',
    updated_at: '2026-07-25T18:01:00Z',
    ...overrides,
  };
}

function harness() {
  const state = {
    issues: [],
    comments: [],
    jobs: new Map(),
    artifacts: new Map(),
    nextIssue: 1,
    infos: [],
    warnings: [],
  };

  const github = {
    paginate: async (method, parameters) => (await method(parameters)).data,
    rest: {
      actions: {
        listJobsForWorkflowRun: async ({ run_id }) => ({ data: state.jobs.get(run_id) || [] }),
        listWorkflowRunArtifacts: async ({ run_id }) => ({ data: state.artifacts.get(run_id) || [] }),
      },
      issues: {
        listForRepo: async ({ state: requested, labels }) => ({
          data: state.issues.filter((issue) => {
            const stateMatch = !requested || requested === 'all' || issue.state === requested;
            return stateMatch && (!labels || issue.labels.includes(labels));
          }),
        }),
        create: async ({ title, body, labels }) => {
          const issue = {
            number: state.nextIssue++,
            title,
            body,
            labels: [...labels],
            state: 'open',
          };
          state.issues.push(issue);
          return { data: issue };
        },
        update: async ({ issue_number, ...patch }) => {
          const issue = state.issues.find((item) => item.number === issue_number);
          assert.ok(issue, `issue ${issue_number} must exist`);
          Object.assign(issue, patch);
          return { data: issue };
        },
        createComment: async ({ issue_number, body }) => {
          state.comments.push({ issue_number, body });
          return { data: { id: state.comments.length, body } };
        },
      },
    },
  };

  return {
    state,
    github,
    context: { repo: { owner: 'FedorMilovanov', repo: 'gb-is-my-strength' } },
    core: {
      info: (message) => state.infos.push(String(message)),
      warning: (message) => state.warnings.push(String(message)),
    },
  };
}

async function main() {
  assert.ok(compareRuns({ runId: 11, runAttempt: 1 }, { runId: 10, runAttempt: 9 }) > 0);
  assert.ok(compareRuns({ runId: 11, runAttempt: 2 }, { runId: 11, runAttempt: 1 }) > 0);

  const h = harness();
  const { state, github, context, core } = h;
  state.jobs.set(100, [{
    id: 900,
    name: 'readiness',
    conclusion: 'failure',
    steps: [
      { number: 1, name: 'Checkout exact head', conclusion: 'success' },
      { number: 2, name: 'Static publication gates', conclusion: 'failure' },
    ],
  }]);
  state.artifacts.set(100, [{
    id: 700,
    name: 'editorial-metadata-100',
    size_in_bytes: 1234,
    expired: false,
    digest: `sha256:${'b'.repeat(64)}`,
  }]);

  const created = await handleWorkflowLifecycle({ github, context, core, workflowRun: run() });
  assert.equal(created.action, 'created', 'failure creates one issue');
  assert.equal(state.issues.length, 1);
  assert.ok(state.issues[0].body.includes('Static publication gates'), 'failed step comes from job data');
  assert.ok(state.issues[0].body.includes('editorial-metadata-100'), 'actual artifact is listed');
  assert.ok(state.issues[0].body.includes(markerFor(run())), 'stable machine key is stored');
  assert.ok(parseState(state.issues[0].body), 'failure state is machine-readable');
  assert.ok(!state.issues[0].body.includes('copy-legacy'), 'workflow name does not invent a diagnosis');
  assert.ok(!state.issues[0].body.toLowerCase().includes('route-impact'), 'fake route-impact claim is absent');

  state.jobs.set(101, [{
    id: 901,
    name: 'readiness',
    conclusion: 'failure',
    steps: [{ number: 5, name: 'Verify frozen editorial projections', conclusion: 'failure' }],
  }]);
  const updated = await handleWorkflowLifecycle({
    github, context, core,
    workflowRun: run({ id: 101, html_url: 'https://github.com/FedorMilovanov/gb-is-my-strength/actions/runs/101' }),
  });
  assert.equal(updated.action, 'updated', 'newer failure updates the same machine-key issue');
  assert.equal(state.issues.length, 1);

  state.jobs.set(102, [{
    id: 902,
    name: 'shared-files',
    conclusion: 'failure',
    steps: [{ number: 4, name: 'Guard shared files', conclusion: 'failure' }],
  }]);
  const separate = await handleWorkflowLifecycle({
    github, context, core,
    workflowRun: run({
      id: 102,
      name: 'Shared Files Guard',
      head_branch: 'feature/one',
      html_url: 'https://github.com/FedorMilovanov/gb-is-my-strength/actions/runs/102',
    }),
  });
  assert.equal(separate.action, 'created');
  assert.equal(state.issues.length, 2, 'different workflow/branch identity does not collapse');

  const cancelled = await handleWorkflowLifecycle({
    github, context, core,
    workflowRun: run({
      id: 103,
      name: 'Visual Parity Guard — pixel-diff',
      head_branch: 'feature/cancelled',
      conclusion: 'cancelled',
    }),
  });
  assert.equal(cancelled.action, 'ignored-non-failure');
  assert.equal(state.issues.length, 2, 'cancelled run creates no false alert');

  state.jobs.set(200, [{
    id: 920,
    name: 'readiness',
    conclusion: 'failure',
    steps: [{ number: 6, name: 'Build production-like dist', conclusion: 'failure' }],
  }]);
  await handleWorkflowLifecycle({
    github, context, core,
    workflowRun: run({
      id: 200,
      html_url: 'https://github.com/FedorMilovanov/gb-is-my-strength/actions/runs/200',
    }),
  });

  const staleSuccess = await handleWorkflowLifecycle({
    github, context, core,
    workflowRun: run({
      id: 199,
      conclusion: 'success',
      html_url: 'https://github.com/FedorMilovanov/gb-is-my-strength/actions/runs/199',
    }),
  });
  assert.equal(staleSuccess.action, 'ignored-stale-success');
  assert.equal(state.issues[0].state, 'open', 'older success cannot close newer failure');

  const recovery = await handleWorkflowLifecycle({
    github, context, core,
    workflowRun: run({
      id: 201,
      conclusion: 'success',
      head_sha: 'c'.repeat(40),
      html_url: 'https://github.com/FedorMilovanov/gb-is-my-strength/actions/runs/201',
    }),
  });
  assert.equal(recovery.action, 'recovered', 'newer success closes alert');
  assert.equal(state.issues[0].state, 'closed');
  assert.equal(state.issues[0].state_reason, 'completed');
  assert.ok(state.comments.some((comment) => comment.body.includes('## Recovered')));

  const lateFailure = await handleWorkflowLifecycle({
    github, context, core,
    workflowRun: run({ id: 198, conclusion: 'failure' }),
  });
  assert.equal(lateFailure.action, 'ignored-stale-failure', 'older failure after recovery is ignored');
  assert.equal(state.issues.length, 2, 'late stale failure does not create a replacement alert');

  state.jobs.set(202, [{
    id: 922,
    name: 'readiness',
    conclusion: 'failure',
    steps: [{ number: 8, name: 'Static publication gates', conclusion: 'failure' }],
  }]);
  const reopened = await handleWorkflowLifecycle({
    github, context, core,
    workflowRun: run({
      id: 202,
      conclusion: 'failure',
      head_sha: 'd'.repeat(40),
      html_url: 'https://github.com/FedorMilovanov/gb-is-my-strength/actions/runs/202',
    }),
  });
  assert.equal(reopened.action, 'updated', 'newer failure reopens the same lifecycle issue');
  assert.equal(state.issues.length, 2);
  assert.equal(state.issues[0].state, 'open');

  const duplicateMarker = markerFor(run({ id: 300, head_branch: 'duplicate' }));
  state.issues.push(
    { number: 30, title: 'x', body: duplicateMarker, labels: ['ci-failure'], state: 'open' },
    { number: 31, title: 'x', body: duplicateMarker, labels: ['ci-failure'], state: 'closed' },
  );
  await assert.rejects(
    handleWorkflowLifecycle({
      github, context, core,
      workflowRun: run({ id: 300, head_branch: 'duplicate', conclusion: 'success' }),
    }),
    /multiple lifecycle issues/,
    'ambiguous machine identity fails closed',
  );

  const legacy = harness();
  legacy.state.issues.push({
    number: 41,
    title: '🚨 CI failure: Deploy to GitHub Pages',
    body: [
      'Workflow **Deploy to GitHub Pages** упал на коммите `deadbee` (ветка `main`).',
      '**Run URL:** https://github.com/FedorMilovanov/gb-is-my-strength/actions/runs/50',
    ].join('\n'),
    labels: ['ci-failure', 'bug'],
    state: 'open',
  });
  const legacyRecovery = await handleWorkflowLifecycle({
    github: legacy.github,
    context: legacy.context,
    core: legacy.core,
    workflowRun: run({
      id: 51,
      name: 'Deploy to GitHub Pages',
      conclusion: 'success',
      html_url: 'https://github.com/FedorMilovanov/gb-is-my-strength/actions/runs/51',
    }),
  });
  assert.equal(legacyRecovery.action, 'recovered', 'new state machine can reconcile an exact legacy alert');
  assert.equal(legacy.state.issues[0].state, 'closed');

  console.log('CI FAILURE LIFECYCLE CONTRACT: PASS');
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
