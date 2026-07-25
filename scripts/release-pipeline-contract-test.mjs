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
    ['release keeps manual recovery', workflow, /workflow_dispatch:/],
    ['release top-level is read only', workflow, /^permissions:\s*\n\s*contents:\s*read\s*$/m],
    ['release serializes Pages', workflow, /concurrency:\s*\n\s*group:\s*pages\s*\n\s*cancel-in-progress:\s*true/],
    ['candidate artifact is run-attempt addressed', workflow, /pages-release-candidate-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/],
    ['readiness job exists', jobs.readiness, /name:\s*Build and validate immutable release candidate/],
    ['readiness is read only', jobs.readiness, /permissions:\s*\n\s*contents:\s*read/],
    ['readiness drops credentials', jobs.readiness, /persist-credentials:\s*false/],
    ['readiness pins Node', jobs.readiness, /node-version:\s*'22\.12\.0'/],
    ['readiness asserts npm', jobs.readiness, /npm --version[\s\S]{0,80}RELEASE_NPM_VERSION/],
    ['readiness checks revisions', jobs.readiness, /Check source asset revisions without writing[\s\S]{0,120}node scripts\/cache-bust\.js/],
    ['readiness runs full source gates', jobs.readiness, /npm run validate:static-publication\s*$/m],
    ['readiness builds Pagefind', jobs.readiness, /npm run pagefind:build:dist/],
    ['readiness runs strict publication audit', jobs.readiness, /dist-publication-audit\.js --require-pagefind --forbid-dev/],
    ['readiness runs route browser and SW gates', jobs.readiness, /visual:parity:production[\s\S]*gill:mobile-layout:audit[\s\S]*dist-smoke-audit\.js --no-build --production-like[\s\S]*sw:dist:audit:deploy-switch/],
    ['readiness writes provenance', jobs.readiness, /Write generic immutable release provenance[\s\S]{0,180}write-deployment-provenance\.mjs/],
    ['readiness verifies candidate', jobs.readiness, /run:\s*node scripts\/verify-release-candidate\.mjs/],
    ['readiness binds digest output', jobs.readiness, /EXPECTED_CANDIDATE_DIGEST:\s*\$\{\{ steps\.provenance\.outputs\.candidate_digest \}\}/],
    ['candidate upload keeps hidden files', jobs.readiness, /include-hidden-files:\s*true/],
    ['candidate upload is fail closed and uncompressed', jobs.readiness, /if-no-files-found:\s*error[\s\S]{0,120}compression-level:\s*0/],
    ['candidate upload contains dist and tools', jobs.readiness, /path:\s*\|[\s\S]{0,100}\n\s*dist\s*\n\s*release-tools/],
    ['deploy depends on readiness', jobs.deploy, /needs:\s*readiness/],
    ['deploy permissions exact', jobs.deploy, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*pages:\s*write\s*\n\s*id-token:\s*write/],
    ['deploy downloads exact candidate', jobs.deploy, /actions\/download-artifact@[a-f0-9]{40}[\s\S]{0,180}name:\s*\$\{\{ env\.RELEASE_ARTIFACT_NAME \}\}/],
    ['deploy verifies before Pages packaging', jobs.deploy, /Verify downloaded candidate identity[\s\S]{0,500}verify-release-candidate\.mjs[\s\S]*Upload exact candidate as Pages artifact/],
    ['deploy binds candidate digest', jobs.deploy, /EXPECTED_CANDIDATE_DIGEST:\s*\$\{\{ needs\.readiness\.outputs\.candidate_digest \}\}/],
    ['deploy uploads dist with pinned Pages action', jobs.deploy, /actions\/upload-pages-artifact@[a-f0-9]{40}[\s\S]{0,100}path:\s*dist/],
    ['generic live precedes TTS', jobs.deploy, /Verify generic live release contract[\s\S]{0,500}live-release-contract\.mjs[\s\S]*Verify live TTS capability extension[\s\S]{0,500}tts-live-deployment-contract\.mjs/],
    ['generic and TTS artifacts separate', jobs.deploy, /release-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]*tts-live-deployment-\$\{\{ github\.run_id \}\}/],
    ['diagnostics remains manually inspectable', diagnostics, /workflow_dispatch:/],
    ['diagnostics is build-free', diagnostics, /Validate source metadata without building dist/],
    ['toolchain exact', toolchain, /"schemaVersion":\s*1[\s\S]*"node":\s*"22\.12\.0"[\s\S]*"npm":\s*"10\.9\.0"/],
    ['tree rejects symlinks', library, /assert\.equal\(stat\.isSymbolicLink\(\), false/],
    ['tree digest canonical', library, /sha256-canonical-pages-tree-v1[\s\S]*canonicalTreeStats/],
    ['tree self-normalization bounded', library, /artifact\.digest self-reference is missing[\s\S]*ZERO_DIGEST/],
    ['manifest feature neutral', library, /schemaVersion:\s*3[\s\S]*artifact:[\s\S]*build:[\s\S]*criticalAssets,[\s\S]*extensions:/],
    ['TTS is extension', library, /extensions:\s*\{[\s\S]*tts:\s*\{/],
    ['writer invokes manual-main guard', writer, /assertManualReleaseMainAncestry\(\{ root, eventName, commitSha, gitRunner \}\)/],
    ['writer checks origin main ref', writer, /refs\/remotes\/origin\/main\^\{commit\}/],
    ['writer checks ancestry', writer, /merge-base', '--is-ancestor'[\s\S]*must already belong to the history of origin\/main/],
    ['writer emits candidate digest', writer, /candidate_digest=\$\{report\.digest\}/],
    ['download verifier recomputes candidate', verifier, /verifyReleaseCandidate/],
    ['generic live follows pointer', live, /\/deployments\/current\.json[\s\S]*pointer\.immutablePath/],
    ['generic live invokes pointer assertion', live, /assertPointer\(pointer\);/],
    ['generic live invokes manifest assertion', live, /assertManifest\(manifest\);/],
    ['generic live checks candidate digest', live, /live pointer candidate digest mismatch[\s\S]*live release artifact identity mismatch/],
    ['TTS requires candidate first', tts, /const local = verifyReleaseCandidate\(\{[\s\S]*local TTS candidate digest mismatch/],
    ['TTS reads extension', tts, /manifest\.extensions\?\.tts|manifest\.extensions\.tts/],
    ['source workflow owns release contract', ttsWorkflow, /scripts\/release-pipeline-contract-test\.mjs/],
    ['source workflow executes release contract', ttsWorkflow, /node scripts\/release-pipeline-contract-test\.mjs/],
  ];
  for (const [label, source, pattern] of checks) if (!pattern.test(source)) problems.push(label);

  if (count(workflow, /\bnpm ci\b/g) !== 1) problems.push('release npm ci count drift');
  if (count(workflow, /npm run strangler:build:production-like/g) !== 1) problems.push('release production build count drift');
  if (count(workflow, /node scripts\/write-deployment-provenance\.mjs/g) !== 1) problems.push('release provenance writer count drift');
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
  if (!before(jobs.readiness, 'node scripts/cache-bust.js', 'npm run strangler:build:production-like')) problems.push('revision check does not precede candidate build');
  if (!before(jobs.readiness, 'node scripts/write-deployment-provenance.mjs', 'name: Upload immutable release candidate')) problems.push('provenance does not precede candidate upload');
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
  ['manual recovery removed', { ...sources, workflow: sources.workflow.replace('  workflow_dispatch:\n', '') }],
  ['readiness write added', { ...sources, workflow: sources.workflow.replace('      contents: read\n    outputs:', '      contents: write\n    outputs:') }],
  ['credentials persisted', { ...sources, workflow: sources.workflow.replace('persist-credentials: false', 'persist-credentials: true') }],
  ['Node floated', { ...sources, workflow: sources.workflow.replace("node-version: '22.12.0'", "node-version: '22'") }],
  ['npm assertion removed', { ...sources, workflow: sources.workflow.replace('test "$(npm --version)" = "$RELEASE_NPM_VERSION"', 'npm --version') }],
  ['second npm install', { ...sources, workflow: sources.workflow.replace('name: Promote exact readiness candidate', 'run: npm ci\n\n    name: Promote exact readiness candidate') }],
  ['second production build', { ...sources, workflow: sources.workflow.replace('name: Promote exact readiness candidate', 'run: npm run strangler:build:production-like\n\n    name: Promote exact readiness candidate') }],
  ['revision check removed', { ...sources, workflow: sources.workflow.replace('node scripts/cache-bust.js', 'node scripts/cache-bust-disabled.js') }],
  ['full source gates removed', { ...sources, workflow: sources.workflow.replace('npm run validate:static-publication', 'echo gates skipped') }],
  ['Pagefind removed', { ...sources, workflow: sources.workflow.replace('npm run pagefind:build:dist', 'echo Pagefind skipped') }],
  ['publication audit weakened', { ...sources, workflow: sources.workflow.replace('--require-pagefind --forbid-dev', '--warn-only') }],
  ['SW gate removed', { ...sources, workflow: sources.workflow.replace('npm run sw:dist:audit:deploy-switch', 'echo sw skipped') }],
  ['provenance writer removed', { ...sources, workflow: sources.workflow.replace('node scripts/write-deployment-provenance.mjs', 'echo provenance skipped') }],
  ['candidate verification removed', { ...sources, workflow: sources.workflow.replaceAll('node scripts/verify-release-candidate.mjs', 'echo unchecked') }],
  ['candidate missing downgraded', { ...sources, workflow: sources.workflow.replace('if-no-files-found: error', 'if-no-files-found: warn') }],
  ['hidden files dropped', { ...sources, workflow: sources.workflow.replace('include-hidden-files: true', 'include-hidden-files: false') }],
  ['candidate recompressed', { ...sources, workflow: sources.workflow.replace('compression-level: 0', 'compression-level: 9') }],
  ['deploy loses readiness', { ...sources, workflow: sources.workflow.replace('needs: readiness', 'needs: []') }],
  ['deploy rebuilds', { ...sources, workflow: sources.workflow.replace('name: Download exact same-run release candidate', 'run: npm run strangler:build:production-like\n\n      - name: Download exact same-run release candidate') }],
  ['deploy checks out', { ...sources, workflow: sources.workflow.replace('name: Download exact same-run release candidate', `uses: ${PINS.checkout}\n\n      - name: Download exact same-run release candidate`) }],
  ['candidate digest detached', { ...sources, workflow: sources.workflow.replaceAll('EXPECTED_CANDIDATE_DIGEST: ${{ needs.readiness.outputs.candidate_digest }}', 'EXPECTED_CANDIDATE_DIGEST: sha256:deadbeef') }],
  ['Pages package moved before verify', { ...sources, workflow: sources.workflow.replace(/(      - name: Verify downloaded candidate identity[\s\S]*?run: node release-tools\/verify-release-candidate\.mjs\n\n)(      - name: Upload exact candidate as Pages artifact[\s\S]*?path: dist\n)/, '$2\n$1') }],
  ['generic live removed', { ...sources, workflow: sources.workflow.replace('node release-tools/live-release-contract.mjs', 'echo skipped') }],
  ['TTS before generic live', { ...sources, workflow: sources.workflow.replace('node release-tools/live-release-contract.mjs', '__GENERIC__').replace('node release-tools/tts-live-deployment-contract.mjs', 'node release-tools/live-release-contract.mjs').replace('__GENERIC__', 'node release-tools/tts-live-deployment-contract.mjs') }],
  ['diagnostics gains Pages', { ...sources, diagnostics: sources.diagnostics.replace('contents: read', 'contents: read\n  pages: write') }],
  ['diagnostics adds build', { ...sources, diagnostics: sources.diagnostics.replace('name: Ensure diagnostics left tracked sources clean', 'run: npm run strangler:build:production-like\n\n      - name: Ensure diagnostics left tracked sources clean') }],
  ['toolchain floats', { ...sources, toolchain: sources.toolchain.replace('22.12.0', '>=22') }],
  ['symlink rejection removed', { ...sources, library: sources.library.replace('assert.equal(stat.isSymbolicLink(), false', 'assert.equal(false, false') }],
  ['tree algorithm renamed', { ...sources, library: sources.library.replace('sha256-canonical-pages-tree-v1', 'sha256-selected-files-v1') }],
  ['TTS top-level restored', { ...sources, library: sources.library.replace('extensions: {\n      tts:', 'tts:') }],
  ['manual ancestry call removed', { ...sources, writer: sources.writer.replace('const ancestry = assertManualReleaseMainAncestry({ root, eventName, commitSha, gitRunner });', 'const ancestry = { checked: false, mainSha: null };') }],
  ['manual ancestry command weakened', { ...sources, writer: sources.writer.replace("['merge-base', '--is-ancestor', commitSha, mainSha]", "['rev-parse', commitSha]") }],
  ['pointer live check removed', { ...sources, live: sources.live.replace('assertPointer(pointer);', 'void pointer;') }],
  ['live digest check removed', { ...sources, live: sources.live.replace("assert.equal(pointer.artifact?.digest, expectedDigest, 'live pointer candidate digest mismatch');", '') }],
  ['TTS candidate verification removed', { ...sources, tts: sources.tts.replace('const local = verifyReleaseCandidate({', 'const local = { manifest: { artifact: { digest: EXPECTED_CANDIDATE_DIGEST }, extensions: {} } }; void ({') }],
  ['release source execution removed', { ...sources, ttsWorkflow: sources.ttsWorkflow.replace('node scripts/release-pipeline-contract-test.mjs', 'echo skipped') }],
  ['upload-pages action mutable', { ...sources, workflow: sources.workflow.replace(PINS.uploadPages, 'actions/upload-pages-artifact@v3') }],
  ['deploy-pages action mutable', { ...sources, workflow: sources.workflow.replace(PINS.deployPages, 'actions/deploy-pages@v4') }],
];
for (const [name, mutated] of mutations) assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
console.log(`Release pipeline contract: PASS (${mutations.length} named build-once/promotion mutations rejected).`);
