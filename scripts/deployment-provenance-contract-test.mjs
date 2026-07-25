#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ZERO_DIGEST,
  TREE_ALGORITHM,
  canonicalTreeStats,
  prepareReleaseCandidate,
  verifyReleaseCandidate,
} from './release-candidate-lib.mjs';
import {
  assertManualReleaseMainAncestry,
  writeDeploymentProvenance,
} from './write-deployment-provenance.mjs';

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}
function writeJson(filePath, value) { write(filePath, `${JSON.stringify(value, null, 2)}\n`); }
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-provenance-'));
  const dist = path.join(root, 'dist');
  writeJson(path.join(root, 'data/release-toolchain.json'), { schemaVersion: 1, node: '22.12.0', npm: '10.9.0' });
  writeJson(path.join(root, 'data/route-profiles/home.json'), { route: '/', currentStatus: 'production-dist' });
  writeJson(path.join(root, 'data/route-profiles/about.json'), { route: '/about/', currentStatus: 'production-dist' });
  writeJson(path.join(root, 'package-lock.json'), { name: 'fixture', lockfileVersion: 3 });
  write(path.join(dist, 'index.html'), '<!doctype html><title>Home</title>');
  write(path.join(dist, 'about/index.html'), '<!doctype html><title>About</title>');
  write(path.join(dist, 'sitemap.xml'), '<urlset><url><loc>https://example.test/</loc></url><url><loc>https://example.test/about/</loc></url></urlset>');
  write(path.join(dist, 'feed.xml'), '<feed><title>Fixture</title></feed>');
  write(path.join(dist, 'pagefind/pagefind.js'), 'export const pagefind = true;');
  write(path.join(dist, 'pagefind/pagefind-entry.json'), '{}');
  write(path.join(dist, 'sw.js'), 'const CACHE = "fixture";');
  write(path.join(dist, 'js/floating-cluster-controller.js'), 'const engine="/js/vosk-tts-engine.js?v=11111111";');
  write(path.join(dist, 'js/vosk-tts-engine.js'), 'const css="/css/tts-download-notice.css?v=22222222";');
  write(path.join(dist, 'css/tts-download-notice.css'), '.notice{display:block}');
  return { root, dist };
}

const identity = {
  repository: 'FedorMilovanov/gb-is-my-strength',
  commitSha: 'a'.repeat(40),
  runId: 123456789,
  runAttempt: 2,
  eventName: 'push',
  actualNodeVersion: 'v22.12.0',
  actualNpmVersion: '10.9.0',
  generatedAt: '2026-07-26T00:00:00.000Z',
};

const { root, dist } = fixture();
try {
  const prepared = prepareReleaseCandidate({ root, dist, ...identity });
  const { manifest, pointer, stats } = prepared;
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(pointer.schemaVersion, 2);
  assert.equal(manifest.artifact.algorithm, TREE_ALGORITHM);
  assert.match(manifest.artifact.digest, /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(manifest.artifact.digest, ZERO_DIGEST);
  assert.equal(pointer.artifact.digest, manifest.artifact.digest);
  assert.equal(manifest.artifact.candidateId, `${identity.commitSha}:${identity.runId}-${identity.runAttempt}`);
  assert.equal(manifest.workflow.stage, 'readiness');
  assert.deepEqual(manifest.build.routeCounts, { profiles: 2, html: 2, sitemap: 2 });
  assert.equal(manifest.build.node, '22.12.0');
  assert.equal(manifest.build.npm, '10.9.0');
  assert.ok(manifest.build.pagefindDigest.startsWith('sha256:'));
  assert.equal(Object.hasOwn(manifest, 'tts'), false, 'TTS must not remain top-level');
  assert.ok(manifest.extensions?.tts?.assets, 'TTS extension is missing');
  assert.equal(stats.digest, manifest.artifact.digest);

  const exact = verifyReleaseCandidate({
    dist,
    expectedRepository: identity.repository,
    expectedCommitSha: identity.commitSha,
    expectedRunId: identity.runId,
    expectedRunAttempt: identity.runAttempt,
  });
  assert.equal(exact.manifest.artifact.digest, manifest.artifact.digest);

  const baselineDigest = canonicalTreeStats(dist).digest;
  write(path.join(dist, 'about/index.html'), '<!doctype html><title>Changed</title>');
  assert.notEqual(canonicalTreeStats(dist).digest, baselineDigest, 'any promoted byte change must change the tree digest');
  assert.throws(() => verifyReleaseCandidate({ dist }), /tree digest mismatch/);

  write(path.join(dist, 'about/index.html'), '<!doctype html><title>About</title>');
  assert.equal(canonicalTreeStats(dist).digest, baselineDigest, 'restoring bytes must restore the canonical digest');
  verifyReleaseCandidate({ dist });

  const pointerPath = path.join(dist, 'deployments/current.json');
  const pointerJson = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
  pointerJson.artifact.digest = `sha256:${'b'.repeat(64)}`;
  writeJson(pointerPath, pointerJson);
  assert.throws(() => verifyReleaseCandidate({ dist }), /pointer\/manifest mismatch|tree digest mismatch/);

  fs.rmSync(pointerPath);
  assert.throws(() => verifyReleaseCandidate({ dist }), /current pointer is missing/);

  const second = fixture();
  try {
    if (process.platform !== 'win32') {
      fs.symlinkSync(path.join(second.dist, 'index.html'), path.join(second.dist, 'linked-index.html'));
      assert.throws(() => prepareReleaseCandidate({ root: second.root, dist: second.dist, ...identity }), /must not contain symlinks/);
    }
  } finally {
    fs.rmSync(second.root, { recursive: true, force: true });
  }

  const wrongToolchain = fixture();
  try {
    assert.throws(
      () => prepareReleaseCandidate({ root: wrongToolchain.root, dist: wrongToolchain.dist, ...identity, actualNpmVersion: '10.8.0' }),
      /runtime npm version does not match pinned toolchain/,
    );
  } finally {
    fs.rmSync(wrongToolchain.root, { recursive: true, force: true });
  }

  const manualSha = 'c'.repeat(40);
  const mainSha = 'd'.repeat(40);
  const calls = [];
  const allowRunner = (command, args, options) => {
    calls.push({ command, args, options });
    if (args[0] === 'rev-parse') return { status: 0, stdout: `${mainSha}\n`, stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  const allowed = assertManualReleaseMainAncestry({
    root,
    eventName: 'workflow_dispatch',
    commitSha: manualSha,
    gitRunner: allowRunner,
  });
  assert.deepEqual(allowed, { checked: true, mainSha });
  assert.deepEqual(calls.map((entry) => entry.args), [
    ['rev-parse', '--verify', 'refs/remotes/origin/main^{commit}'],
    ['merge-base', '--is-ancestor', manualSha, mainSha],
  ]);
  assert.ok(calls.every((entry) => entry.command === 'git' && entry.options.cwd === root));

  let pushCalls = 0;
  assert.deepEqual(
    assertManualReleaseMainAncestry({
      root,
      eventName: 'push',
      commitSha: manualSha,
      gitRunner: () => { pushCalls += 1; return { status: 1 }; },
    }),
    { checked: false, mainSha: null },
  );
  assert.equal(pushCalls, 0, 'automatic push must not invoke manual ancestry checks');

  const rejectRunner = (_command, args) => args[0] === 'rev-parse'
    ? { status: 0, stdout: `${mainSha}\n`, stderr: '' }
    : { status: 1, stdout: '', stderr: '' };
  assert.throws(
    () => assertManualReleaseMainAncestry({ root, eventName: 'workflow_dispatch', commitSha: manualSha, gitRunner: rejectRunner }),
    /must already belong to the history of origin\/main/,
  );
  assert.throws(
    () => assertManualReleaseMainAncestry({
      root,
      eventName: 'workflow_dispatch',
      commitSha: manualSha,
      gitRunner: () => ({ status: 128, stdout: '', stderr: 'unknown revision' }),
    }),
    /requires a fetched origin\/main ref/,
  );
  assert.throws(
    () => assertManualReleaseMainAncestry({ root, eventName: 'workflow_dispatch', commitSha: 'short', gitRunner: allowRunner }),
    /manual release SHA must be exact/,
  );

  const manualWriterFixture = fixture();
  try {
    const report = writeDeploymentProvenance({
      root: manualWriterFixture.root,
      env: {
        RELEASE_SHA: manualSha,
        GITHUB_REPOSITORY: identity.repository,
        GITHUB_RUN_ID: String(identity.runId),
        GITHUB_RUN_ATTEMPT: String(identity.runAttempt),
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        RELEASE_NPM_VERSION: identity.actualNpmVersion,
      },
      gitRunner: allowRunner,
    });
    assert.deepEqual(report.manualReleaseMainAncestry, { checked: true, mainSha });
  } finally {
    fs.rmSync(manualWriterFixture.root, { recursive: true, force: true });
  }

  const rejectedWriterFixture = fixture();
  try {
    assert.throws(
      () => writeDeploymentProvenance({
        root: rejectedWriterFixture.root,
        env: {
          RELEASE_SHA: manualSha,
          GITHUB_REPOSITORY: identity.repository,
          GITHUB_RUN_ID: String(identity.runId),
          GITHUB_RUN_ATTEMPT: String(identity.runAttempt),
          GITHUB_EVENT_NAME: 'workflow_dispatch',
          RELEASE_NPM_VERSION: identity.actualNpmVersion,
        },
        gitRunner: rejectRunner,
      }),
      /must already belong to the history of origin\/main/,
    );
    assert.equal(fs.existsSync(path.join(rejectedWriterFixture.root, 'deployments')), false);
    assert.equal(fs.existsSync(path.join(rejectedWriterFixture.root, 'reports', 'release-candidate.json')), false);
  } finally {
    fs.rmSync(rejectedWriterFixture.root, { recursive: true, force: true });
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('Deployment provenance schema v3 contract: PASS (whole-tree digest, tamper, toolchain and manual-main-ancestry writer fixtures).');
