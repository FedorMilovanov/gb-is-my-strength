'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const recordWitness = require('./record-deployment-witness.cjs');

const SHA = 'dab31616ca77b7833e9d12ad9c80d63a751ed19e';
const RUN_ID = 30170000001;
const RUN_ATTEMPT = 2;
const ARTIFACT_ID = 8622000001;
const ARTIFACT_NAME = `tts-live-deployment-${RUN_ID}`;
const ARTIFACT_DIGEST = `sha256:${'a'.repeat(64)}`;
const TARGET_MARKER = `<!-- deployment-witness-target:tts:${SHA} -->`;
const COMMENT_MARKER = `<!-- deployment-capability-witness:tts:${SHA}:${RUN_ID}:${RUN_ATTEMPT}:${ARTIFACT_ID} -->`;

function endpoint(kind) {
  const fn = async () => {};
  fn.kind = kind;
  return fn;
}

function workflowRun(overrides = {}) {
  return {
    id: RUN_ID,
    run_attempt: RUN_ATTEMPT,
    name: 'Deploy to GitHub Pages',
    conclusion: 'success',
    head_branch: 'main',
    head_sha: SHA,
    event: 'workflow_run',
    head_repository: { full_name: 'FedorMilovanov/gb-is-my-strength' },
    ...overrides,
  };
}

function artifact(overrides = {}) {
  return {
    id: ARTIFACT_ID,
    name: ARTIFACT_NAME,
    size_in_bytes: 4096,
    digest: ARTIFACT_DIGEST,
    expired: false,
    expires_at: '2026-08-08T00:00:00Z',
    workflow_run: { id: RUN_ID, head_sha: SHA },
    ...overrides,
  };
}

function report(overrides = {}) {
  const provenancePath = `/deployments/${SHA}/${RUN_ID}-${RUN_ATTEMPT}.json`;
  const base = {
    liveBaseUrl: 'https://gospod-bog.ru',
    deployedSha: SHA,
    expectedRepository: 'FedorMilovanov/gb-is-my-strength',
    workflowRunId: RUN_ID,
    workflowRunAttempt: RUN_ATTEMPT,
    expected: {
      currentPointerPath: '/deployments/current.json',
      provenancePath,
    },
    result: 'PASS',
    attempts: [{
      attempt: 1,
      result: 'PASS',
      evidence: {
        discovery: {
          path: '/deployments/current.json',
          immutablePath: provenancePath,
          workflowRunId: RUN_ID,
          workflowRunAttempt: RUN_ATTEMPT,
        },
        provenance: {
          path: provenancePath,
          commitSha: SHA,
          workflowRunId: RUN_ID,
          workflowRunAttempt: RUN_ATTEMPT,
          sourceReadinessRunId: 30169999999,
        },
        routeEvidence: [
          { route: '/articles/dzhon-gill-chast-1-chelovek/' },
          { route: '/articles/20-antisovetov-pastoru/' },
        ],
        assets: {
          controller: { path: '/js/floating-cluster-controller.js?v=11111111', sha256: '1'.repeat(64) },
          engine: { path: '/js/vosk-tts-engine.js?v=22222222', sha256: '2'.repeat(64) },
          noticeCss: { path: '/css/tts-download-notice.css?v=33333333', sha256: '3'.repeat(64) },
          serviceWorker: { revision: '44444444', sha256: '4'.repeat(64), lazyTtsPrecache: false },
        },
      },
    }],
  };
  return { ...base, ...overrides };
}

function createWitnessDirectory(reportValue = report()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployment-witness-'));
  const nested = path.join(root, 'reports');
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(nested, 'tts-live-deployment-contract.json'), `${JSON.stringify(reportValue, null, 2)}\n`);
  return root;
}

function createHarness({ artifacts = [artifact()], pulls = [], issues = [], comments = {} } = {}) {
  const calls = {
    comments: [],
    updates: [],
    warnings: [],
    infos: [],
    summaries: [],
  };

  const listWorkflowRunArtifacts = endpoint('listWorkflowRunArtifacts');
  const listPullRequestsAssociatedWithCommit = endpoint('listPullRequestsAssociatedWithCommit');
  const listForRepo = endpoint('listForRepo');
  const listComments = endpoint('listComments');

  const github = {
    paginate: async (fn, params) => {
      if (fn.kind === 'listWorkflowRunArtifacts') return artifacts;
      if (fn.kind === 'listPullRequestsAssociatedWithCommit') return pulls;
      if (fn.kind === 'listForRepo') return issues;
      if (fn.kind === 'listComments') return comments[params.issue_number] || [];
      throw new Error(`unexpected paginate endpoint: ${fn.kind}`);
    },
    rest: {
      actions: { listWorkflowRunArtifacts },
      repos: { listPullRequestsAssociatedWithCommit },
      issues: {
        listForRepo,
        listComments,
        createComment: async (payload) => {
          calls.comments.push(payload);
          return { data: { id: calls.comments.length } };
        },
        update: async (payload) => {
          calls.updates.push(payload);
          return { data: payload };
        },
      },
    },
  };

  const summary = {
    addHeading(value) { calls.summaries.push(['heading', value]); return this; },
    addRaw(value) { calls.summaries.push(['raw', value]); return this; },
    addLink(label, href) { calls.summaries.push(['link', label, href]); return this; },
    async write() { calls.summaries.push(['write']); return this; },
  };

  return {
    github,
    context: { repo: { owner: 'FedorMilovanov', repo: 'gb-is-my-strength' } },
    core: {
      summary,
      warning(message) { calls.warnings.push(message); },
      info(message) { calls.infos.push(message); },
    },
    calls,
  };
}

async function invoke(harness, witnessDirectory, overrides = {}) {
  return recordWitness({
    github: harness.github,
    context: harness.context,
    core: harness.core,
    workflowRun: workflowRun(),
    witnessDirectory,
    ...overrides,
  });
}

(async () => {
  const directories = [];
  try {
    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      const harness = createHarness({
        pulls: [{ number: 293, merged_at: '2026-07-25T17:10:00Z', merge_commit_sha: SHA }],
        issues: [{ number: 300, title: 'Editable human title', body: `${TARGET_MARKER}\nOperational acceptance`, state: 'open' }],
      });
      const result = await invoke(harness, witnessDirectory);
      assert.equal(result.envelope.kind, 'deployment-capability-witness');
      assert.equal(result.envelope.commitSha, SHA);
      assert.equal(result.envelope.witnessArtifact.id, ARTIFACT_ID);
      assert.equal(result.envelope.witnessArtifact.digest, ARTIFACT_DIGEST);
      assert.equal(result.envelope.extensions.tts.result, 'PASS');
      assert.deepEqual(result.touched, ['PR #293 commented', 'issue #300 commented and closed']);
      assert.deepEqual(harness.calls.comments.map((entry) => entry.issue_number), [293, 300]);
      assert.ok(harness.calls.comments.every((entry) => entry.body.includes(COMMENT_MARKER)));
      assert.ok(harness.calls.comments.every((entry) => entry.body.includes('TTS capability witness accepted')));
      assert.ok(harness.calls.comments.every((entry) => entry.body.includes('does not claim whole-Pages release-artifact identity')));
      assert.deepEqual(harness.calls.updates, [{
        owner: 'FedorMilovanov',
        repo: 'gb-is-my-strength',
        issue_number: 300,
        state: 'closed',
        state_reason: 'completed',
      }]);
    }

    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      const harness = createHarness({
        pulls: [{ number: 293, merged_at: '2026-07-25T17:10:00Z', merge_commit_sha: SHA }],
        issues: [{ number: 300, title: 'Renamed title', body: TARGET_MARKER, state: 'closed' }],
        comments: {
          293: [{ body: `${COMMENT_MARKER}\nalready recorded` }],
          300: [{ body: `${COMMENT_MARKER}\nalready recorded` }],
        },
      });
      const result = await invoke(harness, witnessDirectory);
      assert.deepEqual(result.touched, ['PR #293 already recorded', 'issue #300 already recorded and closed']);
      assert.equal(harness.calls.comments.length, 0);
      assert.equal(harness.calls.updates.length, 0);
    }

    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      const harness = createHarness({ artifacts: [artifact(), artifact({ id: ARTIFACT_ID + 1 })] });
      await assert.rejects(invoke(harness, witnessDirectory), /expected exactly one .* artifact, found 2/);
    }

    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      const harness = createHarness({ artifacts: [artifact({ expired: true })] });
      await assert.rejects(invoke(harness, witnessDirectory), /artifact is expired/);
    }

    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      const harness = createHarness({ artifacts: [artifact({ digest: 'sha256:bad' })] });
      await assert.rejects(invoke(harness, witnessDirectory), /artifact digest is missing or invalid/);
    }

    {
      const witnessDirectory = createWitnessDirectory(report({ result: 'FAIL' }));
      directories.push(witnessDirectory);
      const harness = createHarness();
      await assert.rejects(invoke(harness, witnessDirectory), /did not finish with PASS/);
    }

    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      const harness = createHarness({
        issues: [
          { number: 301, title: 'First', body: TARGET_MARKER, state: 'open' },
          { number: 302, title: 'Second', body: TARGET_MARKER, state: 'open' },
        ],
      });
      await assert.rejects(invoke(harness, witnessDirectory), /multiple issues contain/);
    }

    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      const harness = createHarness({
        pulls: [{ number: 100, merged_at: '2026-07-25T17:10:00Z', merge_commit_sha: 'b'.repeat(40) }],
        issues: [{ number: 101, title: 'Partial', body: `deployment-witness-target:tts:${SHA.slice(0, 7)}`, state: 'open' }],
      });
      const result = await invoke(harness, witnessDirectory);
      assert.deepEqual(result.touched, []);
      assert.equal(harness.calls.comments.length, 0);
      assert.equal(harness.calls.updates.length, 0);
      assert.equal(harness.calls.warnings.length, 1);
    }

    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      const harness = createHarness();
      await assert.rejects(
        invoke(harness, witnessDirectory, { workflowRun: workflowRun({ head_repository: { full_name: 'foreign/repo' } }) }),
        /refuses a foreign head repository/,
      );
    }

    console.log('Deployment witness ledger contract: PASS (artifact identity, report PASS, exact PR/SHA, machine issue marker, idempotency, ambiguity and scope).');
  } finally {
    for (const directory of directories) fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
