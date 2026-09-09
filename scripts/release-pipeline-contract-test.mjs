#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PINS = Object.freeze({
  checkout: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1',
  setupNode: 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0',
  uploadArtifact: 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1',
  downloadArtifact: 'actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1',
  uploadPages: 'actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0',
  deployPages: 'actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1',
});
const count = (s, re) => (s.match(re) || []).length;
const before = (s, a, b) => s.indexOf(a) >= 0 && s.indexOf(b) >= 0 && s.indexOf(a) < s.indexOf(b);

function jobs(yaml) {
  return {
    readiness: yaml.match(/\n  readiness:\n([\s\S]*?)\n  deploy:\n/)?.[1] || '',
    deploy: yaml.match(/\n  deploy:\n([\s\S]*)$/)?.[1] || '',
  };
}
function step(job, name) {
  const mark = `      - name: ${name}\n`;
  const start = job.indexOf(mark);
  if (start < 0) return '';
  const end = job.indexOf('\n      - name: ', start + mark.length);
  return job.slice(start, end < 0 ? job.length : end);
}
function mutateStep(yaml, name, from, to) {
  const j = jobs(yaml);
  const block = step(j.readiness, name) || step(j.deploy, name);
  assert.ok(block, `${name}: fixture missing`);
  assert.ok(block.includes(from), `${name}: mutation source missing`);
  return yaml.replace(block, block.replace(from, to));
}

export function validate({ workflow, diagnostics, toolchain, library, writer, verifier, live, tts, ttsWorkflow }) {
  const p = [];
  const j = jobs(workflow);
  const has = (label, src, token) => { if (!src.includes(token)) p.push(label); };
  const matches = (label, src, re) => { if (!re.test(src)) p.push(label); };

  matches('release owns every main push', workflow, /push:\s*\n\s*branches:\s*\[main\][\s\S]{0,100}- '\*\*'/);
  has('control SHA from workflow', workflow, 'CONTROL_PLANE_SHA: ${{ github.sha }}');
  has('release SHA recovery selector', workflow, "RELEASE_SHA: ${{ github.event_name == 'workflow_dispatch' && inputs.release_sha || github.sha }}");
  has('candidate run-attempt name', workflow, 'RELEASE_ARTIFACT_NAME: pages-release-candidate-${{ github.run_id }}-${{ github.run_attempt }}');
  has('Pages run-attempt name', workflow, 'PAGES_ARTIFACT_NAME: github-pages-${{ github.run_id }}-${{ github.run_attempt }}');
  matches('Pages serialized', workflow, /concurrency:\s*\n\s*group:\s*pages\s*\n\s*cancel-in-progress:\s*true/);

  has('exact release checkout', j.readiness, 'ref: ${{ env.RELEASE_SHA }}');
  has('full checkout', j.readiness, 'fetch-depth: 0');
  has('checkout credentials disabled', j.readiness, 'persist-credentials: false');
  has('current main fetched', j.readiness, 'git fetch --no-tags origin "+main:refs/remotes/origin/main"');
  has('release ancestry proved', j.readiness, 'git merge-base --is-ancestor "$RELEASE_SHA" "$CONTROL_PLANE_SHA"');
  has('automatic identities equal', j.readiness, 'test "$RELEASE_SHA" = "$CONTROL_PLANE_SHA"');
  has('pinned Node', j.readiness, "node-version: '22.23.1'");
  has('pinned npm asserted', j.readiness, 'test "$(npm --version)" = "$RELEASE_NPM_VERSION"');
  has('source revisions checked', j.readiness, 'node scripts/cache-bust.js');
  has('static publication gates', j.readiness, 'npm run validate:static-publication');
  has('production-like build', j.readiness, 'npm run strangler:build:production-like');
  has('Pagefind build', j.readiness, 'npm run pagefind:build:dist');
  has('strict publication audit', j.readiness, 'node scripts/dist-publication-audit.js --require-pagefind --forbid-dev');
  has('SW deploy switch gate', j.readiness, 'npm run sw:dist:audit:deploy-switch');
  has('clean tracked source', j.readiness, 'git diff --exit-code');
  has('trusted tools from control plane', j.readiness, 'git show "${CONTROL_PLANE_SHA}:scripts/${file}" > "release-tools/${file}"');
  has('readiness release identity bound', j.readiness, 'EXPECTED_RELEASE_SHA: ${{ env.RELEASE_SHA }}');
  has('readiness control identity bound', j.readiness, 'EXPECTED_CONTROL_PLANE_SHA: ${{ env.CONTROL_PLANE_SHA }}');
  has('readiness attempt bound', j.readiness, 'EXPECTED_RUN_ATTEMPT: ${{ github.run_attempt }}');
  has('artifact ID output', j.readiness, 'transport_artifact_id: ${{ steps.candidate_upload.outputs.artifact-id }}');
  has('artifact digest output', j.readiness, 'transport_artifact_digest: ${{ steps.candidate_upload.outputs.artifact-digest }}');

  const candidate = step(j.readiness, 'Upload immutable release candidate');
  has('candidate hidden files retained', candidate, 'include-hidden-files: true');
  has('candidate missing files fail', candidate, 'if-no-files-found: error');
  has('candidate transport uncompressed', candidate, 'compression-level: 0');

  matches('deploy permissions exact', j.deploy, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*pages:\s*write\s*\n\s*id-token:\s*write/);
  const download = step(j.deploy, 'Download exact readiness candidate by artifact ID');
  has('deploy downloads exact artifact ID', download, 'artifact-ids: ${{ needs.readiness.outputs.transport_artifact_id }}');
  has('deploy merges exact artifact into workspace', download, 'merge-multiple: true');
  const verify = step(j.deploy, 'Verify downloaded candidate identity');
  has('deploy release identity bound', verify, 'EXPECTED_RELEASE_SHA: ${{ needs.readiness.outputs.release_sha }}');
  has('deploy control identity bound', verify, 'EXPECTED_CONTROL_PLANE_SHA: ${{ needs.readiness.outputs.control_plane_sha }}');
  has('deploy run ID bound', verify, 'EXPECTED_RUN_ID: ${{ github.run_id }}');
  has('deploy digest bound', verify, 'EXPECTED_CANDIDATE_DIGEST: ${{ needs.readiness.outputs.candidate_digest }}');
  if (verify.includes('EXPECTED_RUN_ATTEMPT:')) p.push('deploy incorrectly binds rerun attempt');

  const pagesUpload = step(j.deploy, 'Upload exact candidate as Pages artifact');
  has('Pages upload attempt-specific', pagesUpload, 'name: ${{ env.PAGES_ARTIFACT_NAME }}');
  has('Pages upload exact dist', pagesUpload, 'path: dist');
  const pagesDeploy = step(j.deploy, 'Deploy exact candidate to GitHub Pages');
  has('Pages deploy consumes exact artifact', pagesDeploy, 'artifact_name: ${{ env.PAGES_ARTIFACT_NAME }}');

  if (/CLOUDFLARE_(?:API_TOKEN|ZONE_ID)|cloudflare-release-purge|Purge Cloudflare release cache/.test(workflow)) {
    p.push('release unexpectedly depends on Cloudflare HTTP edge');
  }

  const liveStep = step(j.deploy, 'Verify generic live release contract');
  has('live release SHA bound', liveStep, 'RELEASE_SHA: ${{ needs.readiness.outputs.release_sha }}');
  has('live control SHA bound', liveStep, 'CONTROL_PLANE_SHA: ${{ needs.readiness.outputs.control_plane_sha }}');
  has('live candidate digest bound', liveStep, 'EXPECTED_CANDIDATE_DIGEST: ${{ needs.readiness.outputs.candidate_digest }}');
  const liveEvidence = step(j.deploy, 'Upload generic live release evidence');
  has('live evidence deployment-bound', liveEvidence, "steps.deploy_pages.outcome == 'success'");
  has('live evidence terminal-bound', liveEvidence, "steps.live_release.outcome == 'success' || steps.live_release.outcome == 'failure'");
  has('live evidence rerun overwrite', liveEvidence, 'overwrite: true');
  has('live evidence canonical name', liveEvidence, 'name: release-live-deployment-${{ github.run_id }}');

  const ttsStep = step(j.deploy, 'Verify live TTS capability extension');
  has('TTS deployment-bound', ttsStep, "steps.deploy_pages.outcome == 'success'");
  has('TTS live-bound', ttsStep, "steps.live_release.outcome == 'success'");
  const ttsEvidence = step(j.deploy, 'Upload live TTS capability evidence');
  has('TTS evidence terminal-bound', ttsEvidence, "steps.tts_live.outcome == 'success' || steps.tts_live.outcome == 'failure'");
  has('TTS evidence rerun overwrite', ttsEvidence, 'overwrite: true');
  has('TTS evidence canonical name', ttsEvidence, 'name: tts-live-deployment-${{ github.run_id }}');

  if (!before(j.deploy, 'release-tools/verify-release-candidate.mjs', 'Upload exact candidate as Pages artifact')) p.push('Pages packaging precedes candidate verification');
  if (!before(j.deploy, 'Deploy exact candidate to GitHub Pages', 'Verify generic live release contract')) p.push('live verifier precedes Pages deploy');
  if (!before(j.deploy, 'Verify generic live release contract', 'Verify live TTS capability extension')) p.push('TTS precedes generic live verifier');
  if (/actions\/checkout@|\bnpm ci\b|strangler:build|cache-bust\.js|pagefind:build/.test(j.deploy)) p.push('privileged deploy rebuilds source');
  if (count(workflow, /\bnpm ci\b/g) !== 1) p.push('release npm ci count drift');
  if (count(workflow, /npm run strangler:build:production-like/g) !== 1) p.push('release production build count drift');
  if (count(workflow, /actions\/checkout@/g) !== 1) p.push('release checkout count drift');
  if (count(workflow, /actions\/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c/g) !== 1) p.push('download-artifact pin/count drift');
  if (count(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/g) !== 4) p.push('upload-artifact pin/count drift');
  for (const pin of Object.values(PINS)) if (!workflow.includes(pin)) p.push(`release action pin drift: ${pin.split('@')[0]}`);
  if (/uses:\s*actions\/(?:checkout|setup-node|upload-artifact|download-artifact|upload-pages-artifact|deploy-pages)@v\d+/i.test(workflow)) p.push('mutable release action tag');

  has('diagnostics manual', diagnostics, 'workflow_dispatch:');
  has('diagnostics build-free label', diagnostics, 'Validate source metadata without building dist');
  if (/\bnpm ci\b|strangler:build|pagefind:build|dist-publication-audit/.test(diagnostics)) p.push('diagnostics duplicates release build');
  if (/pages:\s*write|id-token:\s*write|actions\/deploy-pages|actions\/upload-pages-artifact/.test(diagnostics)) p.push('diagnostics owns Pages capability');
  matches('toolchain exact', toolchain, /"schemaVersion":\s*1[\s\S]*"node":\s*"22\.23\.1"[\s\S]*"npm":\s*"10\.9\.8"/);

  has('tree rejects symlinks', library, 'assert.equal(stat.isSymbolicLink(), false');
  has('canonical tree digest', library, 'sha256-canonical-pages-tree-v1');
  matches('manifest two-SHA schema', library, /schemaVersion:\s*4[\s\S]*releaseSha,[\s\S]*controlPlaneSha/);
  has('candidate addressed by release SHA', library, '`${releaseSha}:${runIdentity}`');
  matches('writer uses two-SHA boundary', writer, /assertReleaseControlPlaneBoundary\(\{[\s\S]*releaseSha,[\s\S]*controlPlaneSha/);
  has('writer checks ancestry', writer, "['merge-base', '--is-ancestor', releaseSha, controlPlaneSha]");
  has('writer emits release output', writer, 'release_sha=${report.releaseSha}');
  has('writer emits control output', writer, 'control_plane_sha=${report.controlPlaneSha}');
  matches('verifier checks both identities', verifier, /verifyReleaseCandidate\(\{[\s\S]{0,260}expectedReleaseSha,[\s\S]{0,120}expectedControlPlaneSha,/);

  matches('live follows current pointer', live, /\/deployments\/current\.json[\s\S]*pointer\.immutablePath/);
  matches('live checks two identities', live, /releaseSha[\s\S]*controlPlaneSha[\s\S]*expectedReleaseSha[\s\S]*expectedControlPlaneSha/);
  has('live local Home bytes', live, "localHomeBuffer = fs.readFileSync(localHomePath);");
  has('live Home byte equality', live, "assert.equal(homeResponse.buffer.length, localHomeBuffer.length, 'home-index: live byte count mismatch');");
  has('live Home digest equality', live, "assert.equal(homeDigest, localHomeDigest, 'home-index: live SHA-256 mismatch');");
  has('live Home semantic check', live, "assertHomeContract(homeResponse.buffer, 'live home');");
  has('live stylesheet digest equality', live, "'home-refutations-stylesheet: live SHA-256 mismatch'");
  matches('live preserves preflight evidence', live, /phase:\s*'preflight'[\s\S]*catch \(error\) \{\s*failPreflight\(error\);/);
  matches('TTS checks two identities', tts, /RELEASE_SHA[\s\S]*CONTROL_PLANE_SHA[\s\S]*expectedReleaseSha[\s\S]*expectedControlPlaneSha/);
  matches('TTS preserves preflight evidence', tts, /phase:\s*'preflight'[\s\S]*catch \(error\) \{\s*failPreflight\(error\);/);
  has('TTS workflow owns contract', ttsWorkflow, 'scripts/release-pipeline-contract-test.mjs');
  has('TTS workflow executes contract', ttsWorkflow, 'node scripts/release-pipeline-contract-test.mjs');

  const ambiguous = [library, writer, verifier, live, tts].join('\n');
  for (const legacy of [/\bcommitSha\b/, /DEPLOYED_SHA/, /EXPECTED_COMMIT_SHA/]) if (legacy.test(ambiguous)) p.push(`legacy single-SHA alias remains: ${legacy}`);
  return p;
}

const sources = {
  workflow: read('.github/workflows/deploy.yml'),
  diagnostics: read('.github/workflows/indexnow.yml'),
  toolchain: read('data/release-toolchain.json'),
  library: read('scripts/release-candidate-lib.mjs'),
  writer: read('scripts/write-deployment-provenance.mjs'),
  verifier: read('scripts/verify-release-candidate.mjs'),
  live: read('scripts/live-release-contract.mjs'),
  tts: read('scripts/tts-live-deployment-contract.mjs'),
  ttsWorkflow: read('.github/workflows/tts-download-consent.yml'),
};
assert.deepEqual(validate(sources), []);

const mutations = [
  ['push ownership removed', { ...sources, workflow: sources.workflow.replace('  push:\n', '  push-disabled:\n') }],
  ['ancestry removed', { ...sources, workflow: sources.workflow.replace('git merge-base --is-ancestor "$RELEASE_SHA" "$CONTROL_PLANE_SHA"', 'true') }],
  ['second build', { ...sources, workflow: sources.workflow.replace('name: Promote exact readiness candidate', 'run: npm run strangler:build:production-like\n\n    name: Promote exact readiness candidate') }],
  ['candidate download by name', { ...sources, workflow: mutateStep(sources.workflow, 'Download exact readiness candidate by artifact ID', 'artifact-ids: ${{ needs.readiness.outputs.transport_artifact_id }}', 'name: ${{ env.RELEASE_ARTIFACT_NAME }}') }],
  ['deploy rerun attempt rebound', { ...sources, workflow: mutateStep(sources.workflow, 'Verify downloaded candidate identity', 'EXPECTED_RUN_ID: ${{ github.run_id }}', 'EXPECTED_RUN_ID: ${{ github.run_id }}\n          EXPECTED_RUN_ATTEMPT: ${{ github.run_attempt }}') }],
  ['Pages artifact no attempt', { ...sources, workflow: sources.workflow.replace('PAGES_ARTIFACT_NAME: github-pages-${{ github.run_id }}-${{ github.run_attempt }}', 'PAGES_ARTIFACT_NAME: github-pages') }],
  ['Pages deploy detached', { ...sources, workflow: mutateStep(sources.workflow, 'Deploy exact candidate to GitHub Pages', 'artifact_name: ${{ env.PAGES_ARTIFACT_NAME }}', 'artifact_name: github-pages') }],
  ['Cloudflare dependency reintroduced', { ...sources, workflow: sources.workflow.replace('      - name: Verify generic live release contract', "      - name: Purge Cloudflare release cache\n        env:\n          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n        run: node release-tools/cloudflare-release-purge.mjs\n\n      - name: Verify generic live release contract") }],
  ['live moved before deploy', { ...sources, workflow: sources.workflow.replace('Deploy exact candidate to GitHub Pages', '__DEPLOY__').replace('Verify generic live release contract', 'Deploy exact candidate to GitHub Pages').replace('__DEPLOY__', 'Verify generic live release contract') }],
  ['live evidence overwrite removed', { ...sources, workflow: mutateStep(sources.workflow, 'Upload generic live release evidence', 'overwrite: true', 'overwrite: false') }],
  ['TTS live boundary removed', { ...sources, workflow: mutateStep(sources.workflow, 'Verify live TTS capability extension', " && steps.live_release.outcome == 'success'", '') }],
  ['TTS evidence overwrite removed', { ...sources, workflow: mutateStep(sources.workflow, 'Upload live TTS capability evidence', 'overwrite: true', 'overwrite: false') }],
  ['release/control aliased', { ...sources, workflow: sources.workflow.replace('EXPECTED_CONTROL_PLANE_SHA: ${{ needs.readiness.outputs.control_plane_sha }}', 'EXPECTED_CONTROL_PLANE_SHA: ${{ needs.readiness.outputs.release_sha }}') }],
  ['mutable deploy action', { ...sources, workflow: sources.workflow.replace(PINS.deployPages, 'actions/deploy-pages@v5') }],
  ['candidate addressed by control plane', { ...sources, library: sources.library.replace('`${releaseSha}:${runIdentity}`', '`${controlPlaneSha}:${runIdentity}`') }],
  ['writer output aliased', { ...sources, writer: sources.writer.replace('control_plane_sha=${report.controlPlaneSha}', 'control_plane_sha=${report.releaseSha}') }],
  ['verifier ignores control', { ...sources, verifier: sources.verifier.replace(/\n\s*expectedControlPlaneSha,\n/, '\n') }],
  ['live Home bytes unchecked', { ...sources, live: sources.live.replace("assert.equal(homeResponse.buffer.length, localHomeBuffer.length, 'home-index: live byte count mismatch');", '') }],
  ['live Home digest unchecked', { ...sources, live: sources.live.replace("assert.equal(homeDigest, localHomeDigest, 'home-index: live SHA-256 mismatch');", '') }],
  ['TTS control ignored', { ...sources, tts: sources.tts.replace('expectedControlPlaneSha: CONTROL_PLANE_SHA,', '') }],
  ['diagnostics rebuilds', { ...sources, diagnostics: `${sources.diagnostics}\n# npm ci\n# npm run strangler:build:production-like\n` }],
];
for (const [name, fixture] of mutations) assert.ok(validate(fixture).length > 0, `${name}: mutation must be rejected`);
console.log(`Release pipeline contract v3: PASS (${mutations.length} adversarial build-once/two-SHA/recovery/direct-Pages mutations rejected).`);
