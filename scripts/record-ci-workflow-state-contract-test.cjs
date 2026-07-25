'use strict';

const assert = require('node:assert/strict');
const recordState = require('./record-ci-workflow-state.cjs');
const { workflowIdentity, stateMarker, eventMarker } = recordState;

const SHA = 'e8c41d54512a9c5090dd9d8761a5ee912505c8fc';

function endpoint(kind) {
  const fn = async () => {};
  fn.kind = kind;
  return fn;
}

function run(overrides = {}) {
  return {
    id: 30170000001,
    workflow_id: 319000001,
    run_number: 42,
    run_attempt: 1,
    name: 'Metadata & IndexNow Readiness',
    conclusion: 'failure',
    event: 'push',
    head_sha: SHA,
    head_branch: 'main',
    html_url: 'https://github.com/FedorMilovanov/gb-is-my-strength/actions/runs/30170000001',
    actor: { login: 'FedorMilovanov' },
    head_commit: { message: 'ci: exact failure fixture\n\nbody' },
    pull_requests: [],
    ...overrides,
  };
}

function createHarness({ recentRuns = [], issues = [], comments = {}, jobs = [], artifacts = [] } = {}) {
  const calls = {
    createdIssues: [],
    updatedIssues: [],
    comments: [],
    infos: [],
  };

  const listWorkflowRuns = endpoint('listWorkflowRuns');
  const listForRepo = endpoint('listForRepo');
  const listComments = endpoint('listComments');
  const listJobsForWorkflowRun = endpoint('listJobsForWorkflowRun');
  const listWorkflowRunArtifacts = endpoint('listWorkflowRunArtifacts');

  const github = {
    paginate: async (fn, params) => {
      if (fn.kind === 'listWorkflowRuns') return recentRuns;
      if (fn.kind === 'listForRepo') return issues;
      if (fn.kind === 'listComments') return comments[params.issue_number] || [];
      if (fn.kind === 'listJobsForWorkflowRun') return jobs;
      if (fn.kind === 'listWorkflowRunArtifacts') return artifacts;
      throw new Error(`unexpected paginate endpoint: ${fn.kind}`);
    },
    rest: {
      actions: {
        listWorkflowRuns,
        listJobsForWorkflowRun,
        listWorkflowRunArtifacts,
      },
      issues: {
        listForRepo,
        listComments,
        create: async (payload) => {
          calls.createdIssues.push(payload);
          return { data: { number: 900 + calls.createdIssues.length } };
        },
        update: async (payload) => {
          calls.updatedIssues.push(payload);
          return { data: payload };
        },
        createComment: async (payload) => {
          calls.comments.push(payload);
          return { data: { id: calls.comments.length } };
        },
      },
    },
  };

  return {
    github,
    context: { repo: { owner: 'FedorMilovanov', repo: 'gb-is-my-strength' } },
    core: { info(message) { calls.infos.push(message); } },
    calls,
  };
}

async function invoke(harness, workflowRun = run()) {
  return recordState({
    github: harness.github,
    context: harness.context,
    core: harness.core,
    workflowRun,
  });
}

(async () => {
  assert.equal(workflowIdentity(run()), 'branch:main');
  assert.equal(workflowIdentity(run({ pull_requests: [{ number: 11 }, { number: 7 }] })), 'pr:7,11');
  assert.match(stateMarker(run()), /^<!-- ci-state:v1:[A-Za-z0-9_-]+ -->$/);
  assert.equal(eventMarker(run()), '<!-- ci-state-event:30170000001:1:failure -->');

  {
    const harness = createHarness({
      recentRuns: [run()],
      jobs: [{
        id: 1,
        name: 'readiness',
        status: 'completed',
        conclusion: 'failure',
        html_url: 'https://github.com/example/job/1',
        steps: [
          { number: 1, name: 'Checkout', status: 'completed', conclusion: 'success' },
          { number: 2, name: 'Build production-like dist', status: 'completed', conclusion: 'failure' },
        ],
      }],
      artifacts: [{
        id: 77,
        name: 'editorial-metadata-30170000001',
        size_in_bytes: 1234,
        digest: `sha256:${'a'.repeat(64)}`,
        expired: false,
        expires_at: '2026-08-01T00:00:00Z',
      }],
    });
    const result = await invoke(harness);
    assert.equal(result.action, 'created-failure-issue');
    assert.equal(harness.calls.createdIssues.length, 1);
    const created = harness.calls.createdIssues[0];
    assert.ok(created.body.includes(stateMarker(run())));
    assert.ok(created.body.includes(eventMarker(run())));
    assert.ok(created.body.includes('`Build production-like dist`=failure'));
    assert.ok(created.body.includes('editorial-metadata-30170000001'));
    assert.ok(created.body.includes('does not guess a root cause or affected route'));
    assert.ok(!created.body.includes('Вероятно'));
    assert.deepEqual(created.labels, ['ci-failure', 'bug']);
  }

  {
    const workflowRun = run();
    const issue = {
      number: 901,
      state: 'open',
      body: `${stateMarker(workflowRun)}\n${eventMarker(workflowRun)}\nalready recorded`,
    };
    const harness = createHarness({ recentRuns: [workflowRun], issues: [issue] });
    const result = await invoke(harness, workflowRun);
    assert.equal(result.action, 'already-recorded');
    assert.equal(harness.calls.comments.length, 0);
    assert.equal(harness.calls.updatedIssues.length, 0);
  }

  {
    const failedRun = run();
    const successRun = run({
      id: 30170000002,
      run_number: 43,
      conclusion: 'success',
      html_url: 'https://github.com/FedorMilovanov/gb-is-my-strength/actions/runs/30170000002',
    });
    const issue = { number: 902, state: 'open', body: stateMarker(failedRun) };
    const harness = createHarness({ recentRuns: [successRun, failedRun], issues: [issue] });
    const result = await invoke(harness, successRun);
    assert.equal(result.action, 'closed-recovered-issue');
    assert.equal(harness.calls.comments.length, 1);
    assert.ok(harness.calls.comments[0].body.includes('CI state: recovered'));
    assert.deepEqual(harness.calls.updatedIssues, [{
      owner: 'FedorMilovanov',
      repo: 'gb-is-my-strength',
      issue_number: 902,
      state: 'closed',
      state_reason: 'completed',
    }]);
  }

  {
    const current = run();
    const newer = run({ id: 30170000003, run_number: 44, conclusion: 'success' });
    const harness = createHarness({ recentRuns: [newer, current] });
    const result = await invoke(harness, current);
    assert.equal(result.action, 'ignored-stale-event');
    assert.equal(result.newerRunId, newer.id);
    assert.equal(harness.calls.createdIssues.length, 0);
  }

  {
    const cancelled = run({ conclusion: 'cancelled' });
    const harness = createHarness();
    const result = await invoke(harness, cancelled);
    assert.equal(result.action, 'ignored-conclusion');
    assert.equal(harness.calls.createdIssues.length, 0);
  }

  {
    const workflowRun = run();
    const marker = stateMarker(workflowRun);
    const harness = createHarness({
      recentRuns: [workflowRun],
      issues: [
        { number: 903, state: 'open', body: marker },
        { number: 904, state: 'closed', body: marker },
      ],
    });
    await assert.rejects(invoke(harness, workflowRun), /multiple CI state issues contain marker/);
  }

  {
    const workflowRun = run({ id: 30170000004, run_number: 45 });
    const issue = { number: 905, state: 'closed', body: stateMarker(workflowRun) };
    const harness = createHarness({ recentRuns: [workflowRun], issues: [issue] });
    const result = await invoke(harness, workflowRun);
    assert.equal(result.action, 'reopened-failure-issue');
    assert.deepEqual(harness.calls.updatedIssues, [{
      owner: 'FedorMilovanov',
      repo: 'gb-is-my-strength',
      issue_number: 905,
      state: 'open',
    }]);
    assert.equal(harness.calls.comments.length, 1);
  }

  {
    const successRun = run({ conclusion: 'success' });
    const harness = createHarness({ recentRuns: [successRun] });
    const result = await invoke(harness, successRun);
    assert.equal(result.action, 'success-without-open-issue');
  }

  console.log('CI workflow state recorder contract: PASS (failure, evidence, idempotency, recovery, stale suppression, reopen, PR identity and ignored conclusions).');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
