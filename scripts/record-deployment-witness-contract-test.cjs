'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const recordWitness = require('./record-deployment-witness.cjs');

const RELEASE_SHA = 'dab31616ca77b7833e9d12ad9c80d63a751ed19e';
const CONTROL_PLANE_SHA = 'e'.repeat(40);
const RUN_ID = 30170000001;
const RUN_ATTEMPT = 2;
const CANDIDATE_ARTIFACT_ID = 8622000001;
const GENERIC_ARTIFACT_ID = 8622000002;
const TTS_ARTIFACT_ID = 8622000003;
const CANDIDATE_DIGEST = `sha256:${'c'.repeat(64)}`;
const GENERIC_DIGEST = `sha256:${'a'.repeat(64)}`;
const TTS_DIGEST = `sha256:${'b'.repeat(64)}`;
const TREE_DIGEST = `sha256:${'d'.repeat(64)}`;
const TARGET_MARKER = `<!-- deployment-witness-target:release:${RELEASE_SHA} -->`;
const LEGACY_TARGET_MARKER = `<!-- deployment-witness-target:tts:${RELEASE_SHA} -->`;
const COMMENT_MARKER = `<!-- deployment-release-witness:${RELEASE_SHA}:${CONTROL_PLANE_SHA}:${RUN_ID}:${RUN_ATTEMPT}:${CANDIDATE_ARTIFACT_ID}:${GENERIC_ARTIFACT_ID}:${TTS_ARTIFACT_ID} -->`;

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
    status: 'completed',
    conclusion: 'success',
    head_branch: 'main',
    head_sha: CONTROL_PLANE_SHA,
    event: 'workflow_dispatch',
    head_repository: { full_name: 'FedorMilovanov/gb-is-my-strength' },
    ...overrides,
  };
}

function artifact(name, id, digest, overrides = {}) {
  return {
    id,
    name,
    size_in_bytes: 4096,
    digest,
    expired: false,
    expires_at: '2026-08-08T00:00:00Z',
    workflow_run: { id: RUN_ID, head_sha: CONTROL_PLANE_SHA },
    ...overrides,
  };
}
function candidateArtifact(overrides = {}) {
  return artifact(`pages-release-candidate-${RUN_ID}-${RUN_ATTEMPT}`, CANDIDATE_ARTIFACT_ID, CANDIDATE_DIGEST, overrides);
}
function genericArtifact(overrides = {}) {
  return artifact(`release-live-deployment-${RUN_ID}`, GENERIC_ARTIFACT_ID, GENERIC_DIGEST, overrides);
}
function ttsArtifact(overrides = {}) {
  return artifact(`tts-live-deployment-${RUN_ID}`, TTS_ARTIFACT_ID, TTS_DIGEST, overrides);
}

function genericReport(overrides = {}) {
  const immutablePath = `/deployments/${RELEASE_SHA}/${RUN_ID}-${RUN_ATTEMPT}.json`;
  const base = {
    liveBaseUrl: 'https://gospod-bog.ru',
    repository: 'FedorMilovanov/gb-is-my-strength',
    releaseSha: RELEASE_SHA,
    controlPlaneSha: CONTROL_PLANE_SHA,
    workflowRunId: RUN_ID,
    workflowRunAttempt: RUN_ATTEMPT,
    candidate: {
      id: `${RELEASE_SHA}:${RUN_ID}-${RUN_ATTEMPT}`,
      digest: TREE_DIGEST,
      bytes: 123456,
      files: 987,
      immutablePath,
    },
    transportArtifact: {
      id: CANDIDATE_ARTIFACT_ID,
      digest: CANDIDATE_DIGEST,
    },
    result: 'PASS',
    attempts: [{
      attempt: 1,
      result: 'PASS',
      evidence: {
        currentPointer: '/deployments/current.json',
        immutablePath,
        releaseSha: RELEASE_SHA,
        controlPlaneSha: CONTROL_PLANE_SHA,
        candidateId: `${RELEASE_SHA}:${RUN_ID}-${RUN_ATTEMPT}`,
        candidateDigest: TREE_DIGEST,
        build: {
          node: '22.23.1',
          npm: '10.9.8',
          packageLockDigest: `sha256:${'1'.repeat(64)}`,
          routeRegistryDigest: `sha256:${'2'.repeat(64)}`,
          pagefindDigest: `sha256:${'3'.repeat(64)}`,
          sitemapDigest: `sha256:${'4'.repeat(64)}`,
          feedDigest: `sha256:${'5'.repeat(64)}`,
        },
        criticalAssets: {
          home: { path: '/', bytes: 100, sha256: `sha256:${'6'.repeat(64)}` },
          sitemap: { path: '/sitemap.xml', bytes: 101, sha256: `sha256:${'7'.repeat(64)}` },
        },
      },
    }],
  };
  return { ...base, ...overrides };
}

function ttsReport(overrides = {}) {
  const provenancePath = `/deployments/${RELEASE_SHA}/${RUN_ID}-${RUN_ATTEMPT}.json`;
  const base = {
    liveBaseUrl: 'https://gospod-bog.ru',
    releaseSha: RELEASE_SHA,
    controlPlaneSha: CONTROL_PLANE_SHA,
    expectedRepository: 'FedorMilovanov/gb-is-my-strength',
    workflowRunId: RUN_ID,
    workflowRunAttempt: RUN_ATTEMPT,
    candidateDigest: TREE_DIGEST,
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
          releaseSha: RELEASE_SHA,
          controlPlaneSha: CONTROL_PLANE_SHA,
          workflowRunId: RUN_ID,
          workflowRunAttempt: RUN_ATTEMPT,
          candidateDigest: TREE_DIGEST,
        },
        provenance: {
          path: provenancePath,
          releaseSha: RELEASE_SHA,
          controlPlaneSha: CONTROL_PLANE_SHA,
          workflowRunId: RUN_ID,
          workflowRunAttempt: RUN_ATTEMPT,
          candidateDigest: TREE_DIGEST,
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

function createWitnessDirectory({ generic = genericReport(), tts = ttsReport() } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployment-witness-'));
  fs.mkdirSync(path.join(root, 'release', 'reports'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tts', 'reports'), { recursive: true });
  fs.writeFileSync(path.join(root, 'release', 'reports', 'release-live-deployment-contract.json'), `${JSON.stringify(generic, null, 2)}\n`);
  fs.writeFileSync(path.join(root, 'tts', 'reports', 'tts-live-deployment-contract.json'), `${JSON.stringify(tts, null, 2)}\n`);
  return root;
}

function createHarness({ artifacts = [candidateArtifact(), genericArtifact(), ttsArtifact()], pulls = [], issues = [], comments = {} } = {}) {
  const calls = { comments: [], updates: [], warnings: [], infos: [], summaries: [], associatedCommitShas: [] };
  const listWorkflowRunArtifacts = endpoint('listWorkflowRunArtifacts');
  const listPullRequestsAssociatedWithCommit = endpoint('listPullRequestsAssociatedWithCommit');
  const listForRepo = endpoint('listForRepo');
  const listComments = endpoint('listComments');
  const github = {
    paginate: async (fn, params) => {
      if (fn.kind === 'listWorkflowRunArtifacts') return artifacts;
      if (fn.kind === 'listPullRequestsAssociatedWithCommit') {
        calls.associatedCommitShas.push(params.commit_sha);
        return pulls;
      }
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
        createComment: async (payload) => { calls.comments.push(payload); return { data: { id: calls.comments.length } }; },
        update: async (payload) => { calls.updates.push(payload); return { data: payload }; },
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
    core: { summary, warning(message) { calls.warnings.push(message); }, info(message) { calls.infos.push(message); } },
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
        pulls: [{ number: 293, merged_at: '2026-07-25T17:10:00Z', merge_commit_sha: RELEASE_SHA }],
        issues: [{ number: 300, title: 'Editable human title', body: `${TARGET_MARKER}\nOperational acceptance`, state: 'open' }],
      });
      const result = await invoke(harness, witnessDirectory);
      assert.equal(result.envelope.kind, 'deployment-release-witness');
      assert.equal(result.envelope.schemaVersion, 3);
      assert.equal(result.envelope.releaseSha, RELEASE_SHA);
      assert.equal(result.envelope.controlPlaneSha, CONTROL_PLANE_SHA);
      assert.equal(Object.hasOwn(result.envelope, 'commitSha'), false);
      assert.equal(result.envelope.releaseCandidate.candidateId, `${RELEASE_SHA}:${RUN_ID}-${RUN_ATTEMPT}`);
      assert.equal(result.envelope.releaseCandidate.digest, TREE_DIGEST);
      assert.equal(result.envelope.releaseCandidate.transportArtifact.id, CANDIDATE_ARTIFACT_ID);
      assert.equal(result.envelope.liveWitnessArtifact.id, GENERIC_ARTIFACT_ID);
      assert.equal(result.envelope.extensions.tts.witnessArtifact.id, TTS_ARTIFACT_ID);
      assert.equal(result.envelope.extensions.tts.result, 'PASS');
      assert.deepEqual(result.touched, ['PR #293 commented', 'issue #300 commented and closed']);
      assert.deepEqual(harness.calls.associatedCommitShas, [RELEASE_SHA]);
      assert.deepEqual(harness.calls.comments.map((entry) => entry.issue_number), [293, 300]);
      assert.ok(harness.calls.comments.every((entry) => entry.body.includes(COMMENT_MARKER)));
      assert.ok(harness.calls.comments.every((entry) => entry.body.includes(`Release SHA:** \`${RELEASE_SHA}`)));
      assert.ok(harness.calls.comments.every((entry) => entry.body.includes(`Control-plane SHA:** \`${CONTROL_PLANE_SHA}`)));
      assert.ok(harness.calls.comments.every((entry) => entry.body.includes(TREE_DIGEST)));
      assert.ok(harness.calls.comments.every((entry) => entry.body.includes('same candidate bytes')));
      assert.deepEqual(harness.calls.updates, [{ owner: 'FedorMilovanov', repo: 'gb-is-my-strength', issue_number: 300, state: 'closed', state_reason: 'completed' }]);
    }

    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      const harness = createHarness({
        pulls: [{ number: 293, merged_at: '2026-07-25T17:10:00Z', merge_commit_sha: RELEASE_SHA }],
        issues: [{ number: 300, title: 'Legacy marker target', body: LEGACY_TARGET_MARKER, state: 'closed' }],
        comments: { 293: [{ body: `${COMMENT_MARKER}\nalready recorded` }], 300: [{ body: `${COMMENT_MARKER}\nalready recorded` }] },
      });
      const result = await invoke(harness, witnessDirectory);
      assert.deepEqual(result.touched, ['PR #293 already recorded', 'issue #300 already recorded and closed']);
      assert.equal(harness.calls.comments.length, 0);
      assert.equal(harness.calls.updates.length, 0);
    }

    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      const harness = createHarness({ artifacts: [candidateArtifact(), genericArtifact(), genericArtifact({ id: GENERIC_ARTIFACT_ID + 1 }), ttsArtifact()] });
      await assert.rejects(invoke(harness, witnessDirectory), /expected exactly one release-live-deployment/);
    }
    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      await assert.rejects(invoke(createHarness({ artifacts: [candidateArtifact({ expired: true }), genericArtifact(), ttsArtifact()] }), witnessDirectory), /release candidate artifact is expired/);
    }
    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      await assert.rejects(invoke(createHarness({ artifacts: [candidateArtifact({ workflow_run: { id: RUN_ID, head_sha: RELEASE_SHA } }), genericArtifact(), ttsArtifact()] }), witnessDirectory), /control-plane SHA mismatch/);
    }
    {
      const witnessDirectory = createWitnessDirectory({ generic: genericReport({ controlPlaneSha: RELEASE_SHA }) });
      directories.push(witnessDirectory);
      await assert.rejects(invoke(createHarness(), witnessDirectory), /generic release witness control-plane SHA mismatch/);
    }
    {
      const witnessDirectory = createWitnessDirectory({ generic: genericReport({ releaseSha: CONTROL_PLANE_SHA }) });
      directories.push(witnessDirectory);
      await assert.rejects(invoke(createHarness(), witnessDirectory), /candidate ID mismatch|immutable path mismatch/);
    }
    {
      const witnessDirectory = createWitnessDirectory({ generic: genericReport({ result: 'FAIL' }) });
      directories.push(witnessDirectory);
      await assert.rejects(invoke(createHarness(), witnessDirectory), /generic release witness did not finish with PASS/);
    }
    {
      const witnessDirectory = createWitnessDirectory({ generic: genericReport({ transportArtifact: { id: CANDIDATE_ARTIFACT_ID + 9, digest: CANDIDATE_DIGEST } }) });
      directories.push(witnessDirectory);
      await assert.rejects(invoke(createHarness(), witnessDirectory), /transport artifact ID mismatch/);
    }
    {
      const witnessDirectory = createWitnessDirectory({ tts: ttsReport({ controlPlaneSha: RELEASE_SHA }) });
      directories.push(witnessDirectory);
      await assert.rejects(invoke(createHarness(), witnessDirectory), /TTS witness control-plane SHA mismatch/);
    }
    {
      const witnessDirectory = createWitnessDirectory({ tts: ttsReport({ candidateDigest: `sha256:${'f'.repeat(64)}` }) });
      directories.push(witnessDirectory);
      await assert.rejects(invoke(createHarness(), witnessDirectory), /TTS witness candidate digest mismatch/);
    }
    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      const harness = createHarness({ issues: [
        { number: 301, title: 'First', body: TARGET_MARKER, state: 'open' },
        { number: 302, title: 'Second', body: LEGACY_TARGET_MARKER, state: 'open' },
      ] });
      await assert.rejects(invoke(harness, witnessDirectory), /multiple issues contain/);
    }
    {
      const witnessDirectory = createWitnessDirectory();
      directories.push(witnessDirectory);
      const harness = createHarness({
        pulls: [{ number: 100, merged_at: '2026-07-25T17:10:00Z', merge_commit_sha: 'b'.repeat(40) }],
        issues: [{ number: 101, title: 'Partial', body: `deployment-witness-target:release:${RELEASE_SHA.slice(0, 7)}`, state: 'open' }],
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
      await assert.rejects(
        invoke(createHarness(), witnessDirectory, { workflowRun: workflowRun({ head_repository: { full_name: 'foreign/repo' } }) }),
        /refuses a foreign head repository/,
      );
    }

    console.log('Deployment release witness contract: PASS (independent release/control identities, artifact transport, generic live, TTS extension, exact release PR, idempotency, ambiguity and scope).');
  } finally {
    for (const directory of directories) fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
