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
  assertReleaseControlPlaneBoundary,
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

function gitRunner({ releaseSha, controlPlaneSha, checkedOutSha = releaseSha, mainSha = controlPlaneSha, ancestor = true }) {
  return (_command, args) => {
    if (args[0] === 'rev-parse' && args[2] === 'HEAD^{commit}') {
      return { status: 0, stdout: `${checkedOutSha}\n`, stderr: '' };
    }
    if (args[0] === 'rev-parse' && args[2] === 'refs/remotes/origin/main^{commit}') {
      return { status: 0, stdout: `${mainSha}\n`, stderr: '' };
    }
    if (args[0] === 'merge-base') return { status: ancestor ? 0 : 1, stdout: '', stderr: ancestor ? '' : 'not ancestor' };
    return { status: 128, stdout: '', stderr: `unexpected git args: ${args.join(' ')}` };
  };
}

const automaticSha = 'a'.repeat(40);
const identity = {
  repository: 'FedorMilovanov/gb-is-my-strength',
  releaseSha: automaticSha,
  controlPlaneSha: automaticSha,
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
  assert.equal(manifest.schemaVersion, 4);
  assert.equal(pointer.schemaVersion, 3);
  assert.equal(manifest.releaseSha, identity.releaseSha);
  assert.equal(manifest.controlPlaneSha, identity.controlPlaneSha);
  assert.equal(manifest.workflow.controlPlaneSha, identity.controlPlaneSha);
  assert.equal(pointer.releaseSha, identity.releaseSha);
  assert.equal(pointer.controlPlaneSha, identity.controlPlaneSha);
  assert.equal(manifest.artifact.algorithm, TREE_ALGORITHM);
  assert.match(manifest.artifact.digest, /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(manifest.artifact.digest, ZERO_DIGEST);
  assert.equal(pointer.artifact.digest, manifest.artifact.digest);
  assert.equal(manifest.artifact.candidateId, `${identity.releaseSha}:${identity.runId}-${identity.runAttempt}`);
  assert.equal(manifest.immutablePath, `/deployments/${identity.releaseSha}/${identity.runId}-${identity.runAttempt}.json`);
  assert.equal(manifest.workflow.stage, 'readiness');
  assert.deepEqual(manifest.build.routeCounts, { profiles: 2, html: 2, sitemap: 2 });
  assert.equal(manifest.build.node, '22.12.0');
  assert.equal(manifest.build.npm, '10.9.0');
  assert.ok(manifest.build.pagefindDigest.startsWith('sha256:'));
  assert.equal(Object.hasOwn(manifest, 'commitSha'), false, 'ambiguous commitSha must not remain');
  assert.equal(Object.hasOwn(manifest, 'tts'), false, 'TTS must not remain top-level');
  assert.ok(manifest.extensions?.tts?.assets, 'TTS extension is missing');
  assert.equal(stats.digest, manifest.artifact.digest);

  const exact = verifyReleaseCandidate({
    dist,
    expectedRepository: identity.repository,
    expectedReleaseSha: identity.releaseSha,
    expectedControlPlaneSha: identity.controlPlaneSha,
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
  pointerJson.controlPlaneSha = 'b'.repeat(40);
  writeJson(pointerPath, pointerJson);
  assert.throws(
    () => verifyReleaseCandidate({ dist }),
    /release pointer workflow\/control-plane SHA mismatch|control-plane SHA pointer\/manifest mismatch|tree digest mismatch/,
  );

  fs.rmSync(pointerPath);
  assert.throws(() => verifyReleaseCandidate({ dist }), /current pointer is missing/);

  const symlinkFixture = fixture();
  try {
    if (process.platform !== 'win32') {
      fs.symlinkSync(path.join(symlinkFixture.dist, 'index.html'), path.join(symlinkFixture.dist, 'linked-index.html'));
      assert.throws(() => prepareReleaseCandidate({ root: symlinkFixture.root, dist: symlinkFixture.dist, ...identity }), /must not contain symlinks/);
    }
  } finally {
    fs.rmSync(symlinkFixture.root, { recursive: true, force: true });
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

  const manualReleaseSha = 'c'.repeat(40);
  const controlPlaneSha = 'd'.repeat(40);
  const manualRunner = gitRunner({ releaseSha: manualReleaseSha, controlPlaneSha });
  const allowed = assertReleaseControlPlaneBoundary({
    root,
    eventName: 'workflow_dispatch',
    releaseSha: manualReleaseSha,
    controlPlaneSha,
    gitRunner: manualRunner,
  });
  assert.deepEqual(allowed, {
    checked: true,
    eventName: 'workflow_dispatch',
    releaseSha: manualReleaseSha,
    controlPlaneSha,
    checkedOutSha: manualReleaseSha,
    mainSha: controlPlaneSha,
  });

  assert.throws(
    () => assertReleaseControlPlaneBoundary({
      root,
      eventName: 'workflow_dispatch',
      releaseSha: manualReleaseSha,
      controlPlaneSha,
      gitRunner: gitRunner({ releaseSha: manualReleaseSha, controlPlaneSha, checkedOutSha: 'e'.repeat(40) }),
    }),
    /checked-out HEAD must equal/,
  );
  assert.throws(
    () => assertReleaseControlPlaneBoundary({
      root,
      eventName: 'workflow_dispatch',
      releaseSha: manualReleaseSha,
      controlPlaneSha,
      gitRunner: gitRunner({ releaseSha: manualReleaseSha, controlPlaneSha, mainSha: 'e'.repeat(40) }),
    }),
    /control-plane SHA must equal/,
  );
  assert.throws(
    () => assertReleaseControlPlaneBoundary({
      root,
      eventName: 'workflow_dispatch',
      releaseSha: manualReleaseSha,
      controlPlaneSha,
      gitRunner: gitRunner({ releaseSha: manualReleaseSha, controlPlaneSha, ancestor: false }),
    }),
    /must already belong to the history/,
  );
  assert.throws(
    () => assertReleaseControlPlaneBoundary({
      root,
      eventName: 'push',
      releaseSha: manualReleaseSha,
      controlPlaneSha,
      gitRunner: manualRunner,
    }),
    /automatic main release must use the same/,
  );

  const manualWriterFixture = fixture();
  try {
    const report = writeDeploymentProvenance({
      root: manualWriterFixture.root,
      env: {
        RELEASE_SHA: manualReleaseSha,
        CONTROL_PLANE_SHA: controlPlaneSha,
        GITHUB_REPOSITORY: identity.repository,
        GITHUB_RUN_ID: String(identity.runId),
        GITHUB_RUN_ATTEMPT: String(identity.runAttempt),
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        RELEASE_NPM_VERSION: identity.actualNpmVersion,
      },
      gitRunner: manualRunner,
    });
    assert.equal(report.releaseSha, manualReleaseSha);
    assert.equal(report.controlPlaneSha, controlPlaneSha);
    assert.equal(report.candidateId, `${manualReleaseSha}:${identity.runId}-${identity.runAttempt}`);
    assert.deepEqual(report.releaseControlPlaneBoundary, allowed);
    assert.equal(Object.hasOwn(report, 'commitSha'), false);
  } finally {
    fs.rmSync(manualWriterFixture.root, { recursive: true, force: true });
  }

  const rejectedWriterFixture = fixture();
  try {
    assert.throws(
      () => writeDeploymentProvenance({
        root: rejectedWriterFixture.root,
        env: {
          RELEASE_SHA: manualReleaseSha,
          CONTROL_PLANE_SHA: controlPlaneSha,
          GITHUB_REPOSITORY: identity.repository,
          GITHUB_RUN_ID: String(identity.runId),
          GITHUB_RUN_ATTEMPT: String(identity.runAttempt),
          GITHUB_EVENT_NAME: 'workflow_dispatch',
          RELEASE_NPM_VERSION: identity.actualNpmVersion,
        },
        gitRunner: gitRunner({ releaseSha: manualReleaseSha, controlPlaneSha, ancestor: false }),
      }),
      /must already belong to the history/,
    );
    assert.equal(fs.existsSync(path.join(rejectedWriterFixture.root, 'deployments')), false);
    assert.equal(fs.existsSync(path.join(rejectedWriterFixture.root, 'reports', 'release-candidate.json')), false);
  } finally {
    fs.rmSync(rejectedWriterFixture.root, { recursive: true, force: true });
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('Deployment provenance schema v4 contract: PASS (whole-tree digest, independent release/control identities, Git boundary, tamper and toolchain fixtures).');
