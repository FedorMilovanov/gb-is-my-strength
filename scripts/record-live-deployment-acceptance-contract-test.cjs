'use strict';

const assert = require('node:assert/strict');
const recordAcceptance = require('./record-live-deployment-acceptance.cjs');

const SHA = '7fe46572e84003f703952ab15a6a82102652a98e';
const RUN_ID = '30165325292';
const RUN_ATTEMPT = '2';
const READINESS_RUN_ID = '30165200001';
const TITLE = 'P1(tts): accept live deployment provenance for main@7fe4657';
const MARKER = `<!-- deployment-acceptance:${SHA}:${RUN_ID}:${RUN_ATTEMPT} -->`;

function endpoint(kind) {
  const fn = async () => {};
  fn.kind = kind;
  return fn;
}

function createHarness({ pulls = [], issues = [], comments = {} } = {}) {
  const calls = {
    comments: [],
    updates: [],
    warnings: [],
    infos: [],
    summaries: [],
  };

  const listComments = endpoint('listComments');
  const listForRepo = endpoint('listForRepo');
  const listPullRequestsAssociatedWithCommit = endpoint('listPullRequestsAssociatedWithCommit');

  const github = {
    paginate: async (fn, params) => {
      if (fn.kind === 'listComments') return comments[params.issue_number] || [];
      if (fn.kind === 'listForRepo') return issues;
      if (fn.kind === 'listPullRequestsAssociatedWithCommit') return pulls;
      throw new Error(`unexpected paginate endpoint: ${fn.kind}`);
    },
    rest: {
      issues: {
        listComments,
        listForRepo,
        createComment: async (payload) => {
          calls.comments.push(payload);
          return { data: { id: calls.comments.length } };
        },
        update: async (payload) => {
          calls.updates.push(payload);
          return { data: payload };
        },
      },
      repos: {
        listPullRequestsAssociatedWithCommit,
      },
    },
  };

  const summary = {
    addHeading(value) { calls.summaries.push(['heading', value]); return this; },
    addRaw(value) { calls.summaries.push(['raw', value]); return this; },
    addLink(label, href) { calls.summaries.push(['link', label, href]); return this; },
    async write() { calls.summaries.push(['write']); return this; },
  };

  const core = {
    summary,
    warning(message) { calls.warnings.push(message); },
    info(message) { calls.infos.push(message); },
  };

  return {
    github,
    context: { repo: { owner: 'FedorMilovanov', repo: 'gb-is-my-strength' } },
    core,
    calls,
  };
}

function invocation(harness, overrides = {}) {
  return recordAcceptance({
    github: harness.github,
    context: harness.context,
    core: harness.core,
    deployedSha: SHA,
    deployRunId: RUN_ID,
    deployRunAttempt: RUN_ATTEMPT,
    sourceReadinessRunId: READINESS_RUN_ID,
    currentPointerUrl: 'https://gospod-bog.ru/deployments/current.json',
    provenanceUrl: `https://gospod-bog.ru/deployments/${SHA}/${RUN_ID}-${RUN_ATTEMPT}.json`,
    artifactName: `tts-live-deployment-${RUN_ID}`,
    ...overrides,
  });
}

(async () => {
  {
    const harness = createHarness({
      pulls: [{ number: 290, merged_at: '2026-07-25T16:40:00Z', merge_commit_sha: SHA }],
      issues: [{ number: 291, title: TITLE, state: 'open' }],
    });
    const result = await invocation(harness);
    assert.equal(result.sha, SHA);
    assert.equal(result.runId, Number(RUN_ID));
    assert.deepEqual(result.touched, ['PR #290 commented', 'issue #291 commented and closed']);
    assert.deepEqual(harness.calls.comments.map((call) => call.issue_number), [290, 291]);
    assert.ok(harness.calls.comments.every((call) => call.body.includes(MARKER)));
    assert.ok(harness.calls.comments.every((call) => call.body.includes(`/deployments/${SHA}/${RUN_ID}-${RUN_ATTEMPT}.json`)));
    assert.deepEqual(harness.calls.updates, [{
      owner: 'FedorMilovanov',
      repo: 'gb-is-my-strength',
      issue_number: 291,
      state: 'closed',
      state_reason: 'completed',
    }]);
    assert.equal(harness.calls.warnings.length, 0);
    assert.ok(harness.calls.summaries.some((entry) => entry[0] === 'write'));
  }

  {
    const harness = createHarness({
      pulls: [{ number: 290, merged_at: '2026-07-25T16:40:00Z', merge_commit_sha: SHA }],
      issues: [{ number: 291, title: TITLE, state: 'closed' }],
      comments: {
        290: [{ body: `${MARKER}\nalready recorded` }],
        291: [{ body: `${MARKER}\nalready recorded` }],
      },
    });
    const result = await invocation(harness);
    assert.deepEqual(result.touched, ['PR #290 already recorded', 'issue #291 already recorded and closed']);
    assert.equal(harness.calls.comments.length, 0);
    assert.equal(harness.calls.updates.length, 0);
  }

  {
    const harness = createHarness({
      issues: [
        { number: 291, title: TITLE, state: 'open' },
        { number: 292, title: TITLE, state: 'open' },
      ],
    });
    await assert.rejects(invocation(harness), /multiple acceptance issues match exact title/);
  }

  {
    const harness = createHarness({
      pulls: [{ number: 100, merged_at: '2026-07-25T16:40:00Z', merge_commit_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }],
      issues: [{ number: 101, title: 'P1(tts): accept live deployment provenance for main@7fe4658', state: 'open' }],
    });
    const result = await invocation(harness);
    assert.deepEqual(result.touched, []);
    assert.equal(harness.calls.comments.length, 0);
    assert.equal(harness.calls.updates.length, 0);
    assert.equal(harness.calls.warnings.length, 1);
  }

  {
    const harness = createHarness();
    await assert.rejects(
      invocation(harness, { provenanceUrl: `https://gospod-bog.ru/deployments/${SHA}.json` }),
      /provenance URL must be run-addressed/,
    );
  }

  {
    const harness = createHarness();
    await assert.rejects(
      invocation(harness, { currentPointerUrl: 'https://gospod-bog.ru/deployments/latest.json' }),
      /current pointer URL must use the canonical/,
    );
  }

  console.log('Live deployment acceptance recorder contract: PASS (happy path, idempotency, ambiguity, exact targeting, current pointer and run-addressed provenance validation).');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
