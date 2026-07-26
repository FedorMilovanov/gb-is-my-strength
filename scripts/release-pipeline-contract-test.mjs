#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const PINS = Object.freeze({
  checkout: 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4',
  setupNode: 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4',
  uploadArtifact: 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4',
  downloadArtifact: 'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4',
  uploadPages: 'actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3',
  deployPages: 'actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4',
});
const count = (text, pattern) => (text.match(pattern) || []).length;
function boundedJobs(workflow) {
  const readiness = workflow.match(/\n  readiness:\n([\s\S]*?)\n  deploy:\n/);
  const deploy = workflow.match(/\n  deploy:\n([\s\S]*)$/);
  return { readiness: readiness?.[1] || '', deploy: deploy?.[1] || '' };
}
function before(text, first, second) {
  const left = text.indexOf(first);
  const right = text.indexOf(second);
  return left >= 0 && right >= 0 && left < right;
}

export function validate({ workflow, diagnostics, toolchain, library, writer, verifier, live, tts, ttsWorkflow }) {
  const problems = [];
  const jobs = boundedJobs(workflow);
  const checks = [
    ['release owns every main push', workflow, /push:\s*\n\s*branches:\s*\[main\][\s\S]{0,100}- '\*\*'/],
    ['manual release input exact', workflow, /workflow_dispatch:[\s\S]{0,220}release_sha:[\s\S]{0,160}required:\s*false[\s\S]{0,80}type:\s*string/],
    ['release top-level read only', workflow, /^permissions:\s*\n\s*contents:\s*read\s*$/m],
    ['release serializes Pages', workflow, /concurrency:\s*\n\s*group:\s*pages\s*\n\s*cancel-in-progress:\s*true/],
    ['control SHA comes from workflow', workflow, /CONTROL_PLANE_SHA:\s*\$\{\{ github\.sha \}\}/],
    ['release SHA selects explicit recovery or current', workflow, /RELEASE_SHA:\s*\$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.release_sha \|\| github\.sha \}\}/],
    ['candidate artifact is run-attempt addressed', workflow, /pages-release-candidate-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/],
    ['readiness job exists', jobs.readiness, /name:\s*Build and validate immutable release candidate/],
    ['readiness is read only', jobs.readiness, /permissions:\s*\n\s*contents:\s*read/],
    ['release checkout exact', jobs.readiness, /Checkout exact release source[\s\S]{0,180}ref:\s*\$\{\{ env\.RELEASE_SHA \}\}[\s\S]{0,100}fetch-depth:\s*0[\s\S]{0,100}persist-credentials:\s*false/],
    ['Git boundary fetches current main', jobs.readiness, /git fetch --no-tags origin "\+main:refs\/remotes\/origin\/main"/],
    ['Git boundary verifies checkout', jobs.readiness, /git rev-parse --verify HEAD\^\{commit\}[\s\S]{0,100}= "\$RELEASE_SHA"/],
    ['Git boundary verifies control main', jobs.readiness, /refs\/remotes\/origin\/main\^\{commit\}[\s\S]{0,100}= "\$CONTROL_PLANE_SHA"/],
    ['Git boundary verifies ancestry', jobs.readiness, /git merge-base --is-ancestor "\$RELEASE_SHA" "\$CONTROL_PLANE_SHA"/],
    ['automatic release identities equal', jobs.readiness, /GITHUB_EVENT_NAME" = "push"[\s\S]{0,100}RELEASE_SHA" = "\$CONTROL_PLANE_SHA/],
    ['readiness pins Node', jobs.readiness, /node-version:\s*'22\.12\.0'/],
    ['readiness asserts npm', jobs.readiness, /npm --version[\s\S]{0,80}RELEASE_NPM_VERSION/],
    ['readiness checks revisions', jobs.readiness, /Check source asset revisions without writing[\s\S]{0,120}node scripts\/cache-bust\.js/],
    ['readiness runs full source gates', jobs.readiness, /npm run validate:static-publication\s*$/m],
    ['readiness builds Pagefind', jobs.readiness, /npm run pagefind:build:dist/],
    ['readiness runs strict publication audit', jobs.readiness, /dist-publication-audit\.js --require-pagefind --forbid-dev/],
    ['readiness runs route browser and SW gates', jobs.readiness, /visual:parity:production[\s\S]*gill:mobile-layout:audit[\s\S]*dist-smoke-audit\.js --no-build --production-like[\s\S]*sw:dist:audit:deploy-switch/],
    ['release validation leaves tree clean', jobs.readiness, /Ensure release-source validation left tracked files clean[\s\S]{0,100}git diff --exit-code/],
    ['trusted tools staged from control plane', jobs.readiness, /Stage immutable verification tools from trusted control plane[\s\S]*git show "\$\{CONTROL_PLANE_SHA\}:scripts\/\$\{file\}"[\s\S]*release-tools\/write-deployment-provenance\.mjs/],
    ['readiness writes provenance with trusted tool', jobs.readiness, /Write generic immutable release provenance[\s\S]{0,180}release-tools\/write-deployment-provenance\.mjs/],
    ['readiness verifies candidate with two SHAs', jobs.readiness, /EXPECTED_RELEASE_SHA:\s*\$\{\{ env\.RELEASE_SHA \}\}[\s\S]*EXPECTED_CONTROL_PLANE_SHA:\s*\$\{\{ env\.CONTROL_PLANE_SHA \}\}[\s\S]*release-tools\/verify-release-candidate\.mjs/],
    ['readiness exposes two SHAs', jobs.readiness, /release_sha:\s*\$\{\{ steps\.provenance\.outputs\.release_sha \}\}[\s\S]*control_plane_sha:\s*\$\{\{ steps\.provenance\.outputs\.control_plane_sha \}\}/],
    ['readiness binds digest output', jobs.readiness, /EXPECTED_CANDIDATE_DIGEST:\s*\$\{\{ steps\.provenance\.outputs\.candidate_digest \}\}/],
    ['candidate upload keeps hidden files', jobs.readiness, /include-hidden-files:\s*true/],
    ['candidate upload is fail closed and uncompressed', jobs.readiness, /if-no-files-found:\s*error[\s\S]{0,120}compression-level:\s*0/],
    ['candidate upload contains dist and tools', jobs.readiness, /path:\s*\|[\s\S]{0,120}\n\s*dist\s*\n\s*release-tools/],
    ['deploy depends on readiness', jobs.deploy, /needs:\s*readiness/],
    ['deploy permissions exact', jobs.deploy, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*pages:\s*write\s*\n\s*id-token:\s*write/],
    ['deploy downloads exact candidate', jobs.deploy, /actions\/download-artifact@[a-f0-9]{40}[\s\S]{0,180}name:\s*\$\{\{ env\.RELEASE_ARTIFACT_NAME \}\}/],
    ['deploy verifies both identities before Pages', jobs.deploy, /Verify downloaded candidate identity[\s\S]*EXPECTED_RELEASE_SHA:\s*\$\{\{ needs\.readiness\.outputs\.release_sha \}\}[\s\S]*EXPECTED_CONTROL_PLANE_SHA:\s*\$\{\{ needs\.readiness\.outputs\.control_plane_sha \}\}[\s\S]*release-tools\/verify-release-candidate\.mjs[\s\S]*Upload exact candidate as Pages artifact/],
    ['deploy binds candidate digest', jobs.deploy, /EXPECTED_CANDIDATE_DIGEST:\s*\$\{\{ needs\.readiness\.outputs\.candidate_digest \}\}/],
    ['deploy uploads dist with pinned Pages action', jobs.deploy, /actions\/upload-pages-artifact@[a-f0-9]{40}[\s\S]{0,100}path:\s*dist/],
    ['generic live receives two SHAs', jobs.deploy, /Verify generic live release contract[\s\S]*RELEASE_SHA:\s*\$\{\{ needs\.readiness\.outputs\.release_sha \}\}[\s\S]*CONTROL_PLANE_SHA:\s*\$\{\{ needs\.readiness\.outputs\.control_plane_sha \}\}/],
    ['generic live precedes TTS', jobs.deploy, /Verify generic live release contract[\s\S]{0,700}live-release-contract\.mjs[\s\S]*Verify live TTS capability extension[\s\S]{0,700}tts-live-deployment-contract\.mjs/],
    ['generic and TTS artifacts separate', jobs.deploy, /release-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]*tts-live-deployment-\$\{\{ github\.run_id \}\}/],
    ['diagnostics remains manually inspectable', diagnostics, /workflow_dispatch:/],
    ['diagnostics is build-free', diagnostics, /Validate source metadata without building dist/],
    ['toolchain exact', toolchain, /"schemaVersion":\s*1[\s\S]*"node":\s*"22\.12\.0"[\s\S]*"npm":\s*"10\.9\.0"/],
    ['tree rejects symlinks', library, /assert\.equal\(stat\.isSymbolicLink\(\), false/],
    ['tree digest canonical', library, /sha256-canonical-pages-tree-v1[\s\S]*canonicalTreeStats/],
    ['manifest schema v4 two-SHA', library, /schemaVersion:\s*4[\s\S]*releaseSha,[\s\S]*controlPlaneSha,[\s\S]*artifact:[\s\S]*build:[\s\S]*extensions:/],
    ['pointer schema v3 two-SHA', library, /schemaVersion:\s*3[\s\S]*releaseSha,[\s\S]*controlPlaneSha,[\s\S]*immutablePath/],
    ['candidate addressed by release SHA', library, /candidateId = `\$\{releaseSha\}:\$\{runIdentity\}`[\s\S]*deployments\/\$\{releaseSha\}/],
    ['workflow identity bound to control plane', library, /workflow = \{[\s\S]*controlPlaneSha,[\s\S]*runId/],
    ['TTS is extension', library, /extensions:\s*\{[\s\S]*tts:\s*\{/],
    ['writer invokes two-SHA Git boundary', writer, /assertReleaseControlPlaneBoundary\(\{[\s\S]*releaseSha,[\s\S]*controlPlaneSha/],
    ['writer checks checkout and current main', writer, /HEAD\^\{commit\}[\s\S]*refs\/remotes\/origin\/main\^\{commit\}/],
    ['writer checks ancestry', writer, /merge-base', '--is-ancestor', releaseSha, controlPlaneSha/],
    ['writer emits both outputs', writer, /release_sha=\$\{report\.releaseSha\}[\s\S]*control_plane_sha=\$\{report\.controlPlaneSha\}/],
    ['download verifier recomputes both identities', verifier, /expectedReleaseSha[\s\S]*expectedControlPlaneSha[\s\S]*verifyReleaseCandidate/],
    ['generic live follows pointer', live, /\/deployments\/current\.json[\s\S]*pointer\.immutablePath/],
    ['generic live verifies both identities', live, /releaseSha[\s\S]*controlPlaneSha[\s\S]*expectedReleaseSha[\s\S]*expectedControlPlaneSha/],
    ['TTS verifies both identities', tts, /RELEASE_SHA[\s\S]*CONTROL_PLANE_SHA[\s\S]*expectedReleaseSha[\s\S]*expectedControlPlaneSha/],
    ['source workflow owns release contract', ttsWorkflow, /scripts\/release-pipeline-contract-test\.mjs/],
    ['source workflow executes release contract', ttsWorkflow, /node scripts\/release-pipeline-contract-test\.mjs/],
  ];
  for (const [label, source, pattern] of checks) if (!pattern.test(source)) problems.push(label);

  if (count(workflow, /\bnpm ci\b/g) !== 1) problems.push('release npm ci count drift');
  if (count(workflow, /npm run strangler:build:production-like/g) !== 1) problems.push('release production build count drift');
  if (count(workflow, /release-tools\/write-deployment-provenance\.mjs/g) !== 2) problems.push('trusted provenance tool reference count drift');
  if (count(workflow, /actions\/checkout@/g) !== 1) problems.push('release checkout count drift');
  if (count(workflow, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/g) !== 3) problems.push('release upload-artifact pin/count drift');
  if (count(workflow, /actions\/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093/g) !== 1) problems.push('release download-artifact pin/count drift');
  for (const pin of Object.values(PINS)) if (!workflow.includes(pin)) problems.push(`release action pin drift: ${pin.split('@')[0]}`);
  if (/uses:\s*actions\/(?:checkout|setup-node|upload-artifact|download-artifact|upload-pages-artifact|deploy-pages)@v\d+/i.test(workflow)) problems.push('release uses mutable action tag');
  for (const forbidden of [/actions\/checkout@/, /\bnpm ci\b/, /strangler:build/, /cache-bust\.js/, /validate:static-publication/, /pagefind:build/]) {
    if (forbidden.test(jobs.deploy)) problems.push(`privileged deploy contains forbidden source/build command: ${forbidden}`);
  }
  if (/\bnpm ci\b|strangler:build|pagefind:build|dist-publication-audit/.test(diagnostics)) problems.push('diagnostics duplicates release build');
  if (/pages:\s*write|id-token:\s*write|actions\/deploy-pages|actions\/upload-pages-artifact/.test(diagnostics)) problems.push('diagnostics owns Pages capability');
  if (/workflow_run:/.test(workflow)) problems.push('release still depends on second workflow');
  const ambiguous = [library, writer, verifier, live, tts].join('\n');
  for (const legacy of [/\bcommitSha\b/, /DEPLOYED_SHA/, /EXPECTED_COMMIT_SHA/]) if (legacy.test(ambiguous)) problems.push(`legacy single-SHA alias remains: ${legacy}`);
  if (!before(jobs.readiness, 'node scripts/cache-bust.js', 'npm run strangler:build:production-like')) problems.push('revision check does not precede candidate build');
  if (!before(jobs.readiness, 'Stage immutable verification tools from trusted control plane', 'Write generic immutable release provenance')) problems.push('trusted tool staging does not precede provenance');
  if (!before(jobs.readiness, 'release-tools/write-deployment-provenance.mjs', 'name: Upload immutable release candidate')) problems.push('provenance does not precede candidate upload');
  if (!before(jobs.deploy, 'release-tools/verify-release-candidate.mjs', PINS.uploadPages.split(' #')[0])) problems.push('candidate verification does not precede Pages packaging');
  return problems;
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
  ['direct push removed', { ...sources, workflow: sources.workflow.replace('  push:\n', '  push-disabled:\n') }],
  ['catch-all narrowed', { ...sources, workflow: sources.workflow.replace("      - '**'", "      - 'src/**'") }],
  ['manual input removed', { ...sources, workflow: sources.workflow.replace(/\n  workflow_dispatch:[\s\S]*?\n\npermissions:/, '\n  workflow_dispatch:\n\npermissions:') }],
  ['control SHA detached', { ...sources, workflow: sources.workflow.replace('CONTROL_PLANE_SHA: ${{ github.sha }}', 'CONTROL_PLANE_SHA: ${{ env.RELEASE_SHA }}') }],
  ['release SHA ignores input', { ...sources, workflow: sources.workflow.replace("github.event_name == 'workflow_dispatch' && inputs.release_sha || github.sha", 'github.sha') }],
  ['readiness write added', { ...sources, workflow: sources.workflow.replace('      contents: read\n    outputs:', '      contents: write\n    outputs:') }],
  ['credentials persisted', { ...sources, workflow: sources.workflow.replace('persist-credentials: false', 'persist-credentials: true') }],
  ['release checkout uses control', { ...sources, workflow: sources.workflow.replace('ref: ${{ env.RELEASE_SHA }}', 'ref: ${{ env.CONTROL_PLANE_SHA }}') }],
  ['shallow checkout', { ...sources, workflow: sources.workflow.replace('fetch-depth: 0', 'fetch-depth: 1') }],
  ['current main fetch removed', { ...sources, workflow: sources.workflow.replace('git fetch --no-tags origin "+main:refs/remotes/origin/main"', 'echo no-main-fetch') }],
  ['checkout assertion removed', { ...sources, workflow: sources.workflow.replace('test "$(git rev-parse --verify HEAD^{commit})" = "$RELEASE_SHA"', 'true') }],
  ['control assertion removed', { ...sources, workflow: sources.workflow.replace('test "$(git rev-parse --verify refs/remotes/origin/main^{commit})" = "$CONTROL_PLANE_SHA"', 'true') }],
  ['ancestry removed', { ...sources, workflow: sources.workflow.replace('git merge-base --is-ancestor "$RELEASE_SHA" "$CONTROL_PLANE_SHA"', 'true') }],
  ['automatic SHA equality removed', { ...sources, workflow: sources.workflow.replace('test "$RELEASE_SHA" = "$CONTROL_PLANE_SHA"', 'true') }],
  ['Node floated', { ...sources, workflow: sources.workflow.replace("node-version: '22.12.0'", "node-version: '22'") }],
  ['second npm install', { ...sources, workflow: sources.workflow.replace('name: Promote exact readiness candidate', 'run: npm ci\n\n    name: Promote exact readiness candidate') }],
  ['second production build', { ...sources, workflow: sources.workflow.replace('name: Promote exact readiness candidate', 'run: npm run strangler:build:production-like\n\n    name: Promote exact readiness candidate') }],
  ['revision check removed', { ...sources, workflow: sources.workflow.replace('node scripts/cache-bust.js', 'node scripts/cache-bust-disabled.js') }],
  ['Pagefind removed', { ...sources, workflow: sources.workflow.replace('npm run pagefind:build:dist', 'echo Pagefind skipped') }],
  ['publication audit weakened', { ...sources, workflow: sources.workflow.replace('--require-pagefind --forbid-dev', '--warn-only') }],
  ['SW gate removed', { ...sources, workflow: sources.workflow.replace('npm run sw:dist:audit:deploy-switch', 'echo sw skipped') }],
  ['clean tree removed', { ...sources, workflow: sources.workflow.replace('git diff --exit-code', 'git status --short') }],
  ['trusted tools use release SHA', { ...sources, workflow: sources.workflow.replace('${CONTROL_PLANE_SHA}:scripts/${file}', '${RELEASE_SHA}:scripts/${file}') }],
  ['trusted writer bypassed', { ...sources, workflow: sources.workflow.replaceAll('release-tools/write-deployment-provenance.mjs', 'scripts/write-deployment-provenance.mjs') }],
  ['release/control output aliased', { ...sources, workflow: sources.workflow.replace('control_plane_sha: ${{ steps.provenance.outputs.control_plane_sha }}', 'control_plane_sha: ${{ steps.provenance.outputs.release_sha }}') }],
  ['candidate missing downgraded', { ...sources, workflow: sources.workflow.replace('if-no-files-found: error', 'if-no-files-found: warn') }],
  ['hidden files dropped', { ...sources, workflow: sources.workflow.replace('include-hidden-files: true', 'include-hidden-files: false') }],
  ['candidate recompressed', { ...sources, workflow: sources.workflow.replace('compression-level: 0', 'compression-level: 9') }],
  ['deploy loses readiness', { ...sources, workflow: sources.workflow.replace('needs: readiness', 'needs: []') }],
  ['deploy rebuilds', { ...sources, workflow: sources.workflow.replace('name: Download exact same-run release candidate', 'run: npm run strangler:build:production-like\n\n      - name: Download exact same-run release candidate') }],
  ['deploy checks out', { ...sources, workflow: sources.workflow.replace('name: Download exact same-run release candidate', `uses: ${PINS.checkout}\n\n      - name: Download exact same-run release candidate`) }],
  ['deploy release SHA aliased', { ...sources, workflow: sources.workflow.replace('EXPECTED_RELEASE_SHA: ${{ needs.readiness.outputs.release_sha }}', 'EXPECTED_RELEASE_SHA: ${{ needs.readiness.outputs.control_plane_sha }}') }],
  ['deploy control SHA aliased', { ...sources, workflow: sources.workflow.replace('EXPECTED_CONTROL_PLANE_SHA: ${{ needs.readiness.outputs.control_plane_sha }}', 'EXPECTED_CONTROL_PLANE_SHA: ${{ needs.readiness.outputs.release_sha }}') }],
  ['Pages before verify', { ...sources, workflow: sources.workflow.replace('Verify downloaded candidate identity', '__VERIFY__').replace('Upload exact candidate as Pages artifact', 'Verify downloaded candidate identity').replace('__VERIFY__', 'Upload exact candidate as Pages artifact') }],
  ['generic and TTS reversed', { ...sources, workflow: sources.workflow.replace('Verify generic live release contract', '__GENERIC__').replace('Verify live TTS capability extension', 'Verify generic live release contract').replace('__GENERIC__', 'Verify live TTS capability extension') }],
  ['mutable deploy action', { ...sources, workflow: sources.workflow.replace(PINS.deployPages, 'actions/deploy-pages@v4') }],
  ['manifest release/control aliased', { ...sources, library: sources.library.replace('controlPlaneSha,\n    immutablePath', 'controlPlaneSha: releaseSha,\n    immutablePath') }],
  ['candidate addressed by control plane', { ...sources, library: sources.library.replace('`${releaseSha}:${runIdentity}`', '`${controlPlaneSha}:${runIdentity}`') }],
  ['writer boundary bypassed', { ...sources, writer: sources.writer.replace('assertReleaseControlPlaneBoundary({', '(() => ({ checked: false }))({') }],
  ['writer output aliased', { ...sources, writer: sources.writer.replace('control_plane_sha=${report.controlPlaneSha}', 'control_plane_sha=${report.releaseSha}') }],
  ['verifier ignores control', { ...sources, verifier: sources.verifier.replace('expectedControlPlaneSha,', '') }],
  ['generic live ignores release', { ...sources, live: sources.live.replace('expectedReleaseSha: releaseSha,', '') }],
  ['TTS ignores control', { ...sources, tts: sources.tts.replace('expectedControlPlaneSha: CONTROL_PLANE_SHA,', '') }],
  ['diagnostics rebuilds', { ...sources, diagnostics: `${sources.diagnostics}\n# npm ci\n# npm run strangler:build:production-like\n` }],
];
for (const [name, mutated] of mutations) assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
console.log(`Release pipeline contract: PASS (${mutations.length} adversarial two-SHA/build-once mutations rejected).`);
