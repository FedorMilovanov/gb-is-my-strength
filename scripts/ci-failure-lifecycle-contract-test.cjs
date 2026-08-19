#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const runDiagnostics = require('./ci-failure-lifecycle.cjs');

function makeRun(overrides = {}) {
  const id = overrides.id ?? 100;
  return {
    id,
    run_attempt: overrides.run_attempt ?? 1,
    name: overrides.name ?? 'Shared Files Guard',
    conclusion: overrides.conclusion ?? 'failure',
    html_url: overrides.html_url ?? `https://github.com/example/repo/actions/runs/${id}`,
    head_sha: overrides.head_sha ?? String(id).padStart(40, 'a').slice(-40),
    head_branch: overrides.head_branch ?? 'agent/example',
    event: overrides.event ?? 'pull_request',
    head_repository: overrides.head_repository ?? { full_name: 'example/repo' },
  };
}

function createHarness() {
  const state = {
    jobsByRun: new Map(),
    artifactsByRun: new Map(),
    infos: [],
    warnings: [],
    jobsCalls: 0,
    artifactCalls: 0,
    issueWrites: 0,
  };

  const forbiddenWrite = async () => {
    state.issueWrites += 1;
    throw new Error('Issue/comment writes are forbidden by the silent diagnostics contract');
  };

  const github = {
    paginate: async (method, parameters) => {
      const response = await method(parameters);
      return response.data;
    },
    rest: {
      actions: {
        listJobsForWorkflowRun: async ({ run_id }) => {
          state.jobsCalls += 1;
          return { data: state.jobsByRun.get(run_id) || [] };
        },
        listWorkflowRunArtifacts: async ({ run_id }) => {
          state.artifactCalls += 1;
          return { data: state.artifactsByRun.get(run_id) || [] };
        },
      },
      issues: {
        create: forbiddenWrite,
        update: forbiddenWrite,
        createComment: forbiddenWrite,
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
    steps: [
      { number: 1, name: 'checkout', conclusion: 'success' },
      { number: 2, name: stepName, conclusion: 'failure' },
    ],
  }];
}

(async () => {
  // Failure records exact job/step evidence without repository writes.
  const harness = createHarness();
  const { state, github, context, core } = harness;
  state.jobsByRun.set(100, failedJob('Actual failing step from Jobs API'));
  state.artifactsByRun.set(100, [{
    id: 77,
    name: 'real-diagnostics',
    size_in_bytes: 2048,
    created_at: '2026-08-19T20:00:00Z',
    expired: false,
  }]);

  const recorded = await runDiagnostics({ github, context, core, workflowRun: makeRun({ id: 100 }) });
  assert.equal(recorded.action, 'recorded-read-only');
  assert.equal(state.jobsCalls, 1);
  assert.equal(state.artifactCalls, 1);
  assert.equal(state.issueWrites, 0);
  assert.ok(state.warnings.some((line) => /Actual failing step from Jobs API/.test(line)));
  assert.ok(state.infos.some((line) => /real-diagnostics/.test(line)));

  // Non-failure runs are ignored and do not even query evidence APIs.
  const callsBeforeSuccess = state.jobsCalls + state.artifactCalls;
  const success = await runDiagnostics({
    github,
    context,
    core,
    workflowRun: makeRun({ id: 101, conclusion: 'success' }),
  });
  assert.equal(success.action, 'ignored-non-failure');
  assert.equal(state.jobsCalls + state.artifactCalls, callsBeforeSuccess);
  assert.equal(state.issueWrites, 0);

  // External repository heads are ignored before evidence collection.
  const callsBeforeExternal = state.jobsCalls + state.artifactCalls;
  const external = await runDiagnostics({
    github,
    context,
    core,
    workflowRun: makeRun({ id: 102, head_repository: { full_name: 'fork/repo' } }),
  });
  assert.equal(external.action, 'ignored-external-repository');
  assert.equal(state.jobsCalls + state.artifactCalls, callsBeforeExternal);
  assert.equal(state.issueWrites, 0);

  // Evidence API failure is non-fatal and remains read-only.
  const degraded = createHarness();
  degraded.github.rest.actions.listJobsForWorkflowRun = async () => {
    degraded.state.jobsCalls += 1;
    throw new Error('jobs unavailable');
  };
  degraded.github.rest.actions.listWorkflowRunArtifacts = async () => {
    degraded.state.artifactCalls += 1;
    throw new Error('artifacts unavailable');
  };
  const degradedResult = await runDiagnostics({
    github: degraded.github,
    context: degraded.context,
    core: degraded.core,
    workflowRun: makeRun({ id: 103 }),
  });
  assert.equal(degradedResult.action, 'recorded-read-only');
  assert.equal(degraded.state.issueWrites, 0);
  assert.ok(degraded.state.warnings.some((line) => /Jobs API: jobs unavailable/.test(line)));
  assert.ok(degraded.state.warnings.some((line) => /Artifacts API: artifacts unavailable/.test(line)));

  // Issue API is a forbidden regression: the harness would throw if touched.
  assert.equal(state.issueWrites + degraded.state.issueWrites, 0);

  console.log('✅ Silent CI diagnostics contract passed: exact failure evidence, zero issue/comment writes');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
