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
});
function count(text, pattern) { return (text.match(pattern) || []).length; }
function boundedJobs(workflow) {
  const readinessMatch = workflow.match(/\n  readiness:\n([\s\S]*?)\n  deploy:\n/);
  const deployMatch = workflow.match(/\n  deploy:\n([\s\S]*)$/);
  return { readiness: readinessMatch ? readinessMatch[1] : '', deploy: deployMatch ? deployMatch[1] : '' };
}
function before(text, first, second) {
  const a = text.indexOf(first);
  const b = text.indexOf(second);
  return a >= 0 && b >= 0 && a < b;
}

export function validate({ workflow, diagnostics, toolchain, library, writer, verifier, live, tts, ttsWorkflow }) {
  const problems = [];
  const jobs = boundedJobs(workflow);
  const checks = [
    ['release owns direct main push', workflow, /push:\s*\n\s*branches:\s*\[main\][\s\S]{0,100}- '\*\*'/],
    ['release keeps manual rollback entry', workflow, /workflow_dispatch:/],
    ['release top-level remains contents read only', workflow, /^permissions:\s*\n\s*contents:\s*read\s*$/m],
    ['release keeps global non-overlapping Pages concurrency', workflow, /concurrency:\s*\n\s*group:\s*pages\s*\n\s*cancel-in-progress:\s*true/],
    ['candidate artifact is run and attempt addressed', workflow, /pages-release-candidate-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/],
    ['readiness job is present', jobs.readiness, /name:\s*Build and validate immutable release candidate/],
    ['readiness is explicitly read only', jobs.readiness, /permissions:\s*\n\s*contents:\s*read/],
    ['readiness drops checkout credentials', jobs.readiness, /persist-credentials:\s*false/],
    ['readiness pins Node 22.12.0', jobs.readiness, /node-version:\s*'22\.12\.0'/],
    ['readiness asserts exact npm', jobs.readiness, /npm --version[\s\S]{0,80}RELEASE_NPM_VERSION/],
    ['readiness runs source revision check', jobs.readiness, /name:\s*Check source asset revisions without writing[\s\S]{0,120}node scripts\/cache-bust\.js/],
    ['readiness runs full source gates', jobs.readiness, /npm run validate:static-publication\s*$/m],
    ['readiness builds Pagefind after candidate build', jobs.readiness, /npm run pagefind:build:dist/],
    ['readiness requires production publication audit', jobs.readiness, /dist-publication-audit\.js --require-pagefind --forbid-dev/],
    ['readiness runs route/browser/SW gates', jobs.readiness, /visual:parity:production[\s\S]*gill:mobile-layout:audit[\s\S]*dist-smoke-audit\.js --no-build --production-like[\s\S]*sw:dist:audit:deploy-switch/],
    ['readiness writes generic provenance', jobs.readiness, /name:\s*Write generic immutable release provenance[\s\S]{0,180}write-deployment-provenance\.mjs/],
    ['readiness verifies prepared candidate', jobs.readiness, /run:\s*node scripts\/verify-release-candidate\.mjs/],
    ['readiness candidate digest comes from provenance output', jobs.readiness, /EXPECTED_CANDIDATE_DIGEST:\s*\$\{\{ steps\.provenance\.outputs\.candidate_digest \}\}/],
    ['candidate upload retains hidden dist files', jobs.readiness, /include-hidden-files:\s*true/],
    ['candidate upload is fail closed and uncompressed', jobs.readiness, /if-no-files-found:\s*error[\s\S]{0,120}compression-level:\s*0/],
    ['candidate upload contains dist and release tools', jobs.readiness, /path:\s*\|[\s\S]{0,100}\n\s*dist\s*\n\s*release-tools/],
    ['deploy job depends on readiness', jobs.deploy, /needs:\s*readiness/],
    ['deploy job owns only required release permissions', jobs.deploy, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*pages:\s*write\s*\n\s*id-token:\s*write/],
    ['deploy downloads exact candidate name', jobs.deploy, /actions\/download-artifact@[a-f0-9]{40}[\s\S]{0,180}name:\s*\$\{\{ env\.RELEASE_ARTIFACT_NAME \}\}/],
    ['deploy verifies candidate before Pages upload', jobs.deploy, /name:\s*Verify downloaded candidate identity[\s\S]{0,500}run:\s*node release-tools\/verify-release-candidate\.mjs[\s\S]*name:\s*Upload exact candidate as Pages artifact/],
    ['deploy candidate digest comes from readiness output', jobs.deploy, /EXPECTED_CANDIDATE_DIGEST:\s*\$\{\{ needs\.readiness\.outputs\.candidate_digest \}\}/],
    ['deploy uploads dist only to Pages', jobs.deploy, /actions\/upload-pages-artifact@v3[\s\S]{0,100}path:\s*dist/],
    ['deploy performs generic live verification before TTS', jobs.deploy, /name:\s*Verify generic live release contract[\s\S]{0,500}run:\s*node release-tools\/live-release-contract\.mjs[\s\S]*name:\s*Verify live TTS capability extension[\s\S]{0,500}run:\s*node release-tools\/tts-live-deployment-contract\.mjs/],
    ['deploy publishes generic and capability evidence separately', jobs.deploy, /release-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]*tts-live-deployment-\$\{\{ github\.run_id \}\}/],
    ['diagnostics never owns Pages publication', diagnostics, /workflow_dispatch:/],
    ['toolchain schema is exact', toolchain, /"schemaVersion":\s*1[\s\S]*"node":\s*"22\.12\.0"[\s\S]*"npm":\s*"10\.9\.0"/],
    ['tree library rejects symlinks', library, /assert\.equal\(stat\.isSymbolicLink\(\), false/],
    ['tree library owns canonical whole-tree digest', library, /sha256-canonical-pages-tree-v1[\s\S]*canonicalTreeStats/],
    ['tree library neutralizes only self digest', library, /artifact\.digest self-reference is missing[\s\S]*ZERO_DIGEST/],
    ['manifest schema is feature neutral', library, /schemaVersion:\s*3[\s\S]*artifact:[\s\S]*build:[\s\S]*criticalAssets,[\s\S]*extensions:/],
    ['TTS lives under extension', library, /extensions:\s*\{[\s\S]*tts:\s*\{/],
    ['writer emits candidate digest output', writer, /candidate_digest=\$\{report\.digest\}/],
    ['download verifier recomputes candidate', verifier, /verifyReleaseCandidate/],
    ['generic live verifier follows pointer and immutable path', live, /\/deployments\/current\.json[\s\S]*pointer\.immutablePath/],
    ['generic live verifier invokes pointer assertion', live, /assertPointer\(pointer\);/],
    ['generic live verifier invokes manifest assertion', live, /assertManifest\(manifest\);/],
    ['generic live verifier checks candidate digest', live, /live pointer candidate digest mismatch[\s\S]*live release artifact identity mismatch/],
    ['TTS live verifier requires candidate digest first', tts, /const local = verifyReleaseCandidate\(\{[\s\S]*local TTS candidate digest mismatch/],
    ['TTS live verifier reads extensions.tts', tts, /manifest\.extensions\?\.tts|manifest\.extensions\.tts/],
    ['TTS source workflow owns release contract', ttsWorkflow, /scripts\/release-pipeline-contract-test\.mjs/],
    ['TTS source workflow executes release contract', ttsWorkflow, /node scripts\/release-pipeline-contract-test\.mjs/],
  ];
  for (const [label, source, pattern] of checks) if (!pattern.test(source)) problems.push(label);

  if (count(workflow, /\bnpm ci\b/g) !== 1) problems.push(`release npm ci count drift (${count(workflow, /\bnpm ci\b/g)}/1)`);
  if (count(workflow, /npm run strangler:build:production-like/g) !== 1) problems.push(`release production build count drift (${count(workflow, /npm run strangler:build:production-like/g)}/1)`);
  if (count(workflow, /node scripts\/write-deployment-provenance\.mjs/g) !== 1) problems.push('release provenance writer count drift');
  if (count(workflow, /actions\/checkout@/g) !== 1) problems.push('release checkout count drift');
  if (count(workflow, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/g) !== 3) problems.push('release upload-artifact pin/count drift');
  if (count(workflow, /actions\/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093/g) !== 1) problems.push('release download-artifact pin/count drift');
  if (!workflow.includes(PINS.checkout) || !workflow.includes(PINS.setupNode) || !workflow.includes(PINS.uploadArtifact) || !workflow.includes(PINS.downloadArtifact)) problems.push('release action pin drift');

  for (const forbidden of [/actions\/checkout@/, /\bnpm ci\b/, /strangler:build/, /cache-bust\.js/, /validate:static-publication/, /pagefind:build/]) {
    if (forbidden.test(jobs.deploy)) problems.push(`privileged deploy job contains forbidden build/source command: ${forbidden}`);
  }
  if (/pages:\s*write|id-token:\s*write|actions\/deploy-pages|actions\/upload-pages-artifact/.test(diagnostics)) problems.push('diagnostic workflow owns Pages publication capability');
  if (/workflow_run:/.test(workflow)) problems.push('release workflow still depends on a second workflow build');
  if (!before(jobs.readiness, 'node scripts/cache-bust.js', 'npm run strangler:build:production-like')) problems.push('revision check does not precede candidate build');
  if (!before(jobs.readiness, 'node scripts/write-deployment-provenance.mjs', 'name: Upload immutable release candidate')) problems.push('provenance is not written before candidate upload');
  if (!before(jobs.deploy, 'release-tools/verify-release-candidate.mjs', 'actions/upload-pages-artifact@v3')) problems.push('candidate is not verified before Pages packaging');
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
  ['release direct push removed', { ...sources, workflow: sources.workflow.replace('  push:\n', '  push-disabled:\n') }],
  ['release catch-all narrowed', { ...sources, workflow: sources.workflow.replace("      - '**'", "      - 'src/**'") }],
  ['manual rollback removed', { ...sources, workflow: sources.workflow.replace('  workflow_dispatch:\n', '') }],
  ['readiness write permission added', { ...sources, workflow: sources.workflow.replace('      contents: read\n    outputs:', '      contents: write\n    outputs:') }],
  ['checkout credentials persisted', { ...sources, workflow: sources.workflow.replace('persist-credentials: false', 'persist-credentials: true') }],
  ['floating Node introduced', { ...sources, workflow: sources.workflow.replace("node-version: '22.12.0'", "node-version: '22'") }],
  ['npm pin assertion removed', { ...sources, workflow: sources.workflow.replace('test "$(npm --version)" = "$RELEASE_NPM_VERSION"', 'npm --version') }],
  ['second npm install introduced', { ...sources, workflow: sources.workflow.replace('name: Promote exact readiness candidate', 'run: npm ci\n\n    name: Promote exact readiness candidate') }],
  ['second production build introduced', { ...sources, workflow: sources.workflow.replace('name: Promote exact readiness candidate', 'run: npm run strangler:build:production-like\n\n    name: Promote exact readiness candidate') }],
  ['revision check removed', { ...sources, workflow: sources.workflow.replace('node scripts/cache-bust.js', 'node scripts/cache-bust-disabled.js') }],
  ['revision check moved after build', { ...sources, workflow: sources.workflow.replace('node scripts/cache-bust.js', '__REV__').replace('npm run strangler:build:production-like', 'node scripts/cache-bust.js').replace('__REV__', 'npm run strangler:build:production-like') }],
  ['full source gates removed', { ...sources, workflow: sources.workflow.replace('npm run validate:static-publication', 'echo source gates skipped') }],
  ['Pagefind candidate build removed', { ...sources, workflow: sources.workflow.replace('npm run pagefind:build:dist', 'echo Pagefind skipped') }],
  ['publication audit weakened', { ...sources, workflow: sources.workflow.replace('--require-pagefind --forbid-dev', '--warn-only') }],
  ['SW gate removed', { ...sources, workflow: sources.workflow.replace('npm run sw:dist:audit:deploy-switch', 'echo sw skipped') }],
  ['provenance writer removed', { ...sources, workflow: sources.workflow.replace('node scripts/write-deployment-provenance.mjs', 'echo provenance skipped') }],
  ['candidate verification removed', { ...sources, workflow: sources.workflow.replaceAll('node scripts/verify-release-candidate.mjs', 'echo candidate unchecked') }],
  ['candidate upload allows missing files', { ...sources, workflow: sources.workflow.replace('if-no-files-found: error', 'if-no-files-found: warn') }],
  ['candidate hidden files dropped', { ...sources, workflow: sources.workflow.replace('include-hidden-files: true', 'include-hidden-files: false') }],
  ['candidate upload recompresses tree', { ...sources, workflow: sources.workflow.replace('compression-level: 0', 'compression-level: 9') }],
  ['deploy loses readiness dependency', { ...sources, workflow: sources.workflow.replace('needs: readiness', 'needs: []') }],
  ['deploy rebuilds source', { ...sources, workflow: sources.workflow.replace('name: Download exact same-run release candidate', 'run: npm run strangler:build:production-like\n\n      - name: Download exact same-run release candidate') }],
  ['deploy checks out source', { ...sources, workflow: sources.workflow.replace('name: Download exact same-run release candidate', `uses: ${PINS.checkout}\n\n      - name: Download exact same-run release candidate`) }],
  ['deploy candidate identity detached', { ...sources, workflow: sources.workflow.replaceAll('EXPECTED_CANDIDATE_DIGEST: ${{ needs.readiness.outputs.candidate_digest }}', 'EXPECTED_CANDIDATE_DIGEST: sha256:deadbeef') }],
  ['Pages upload moved before verification', { ...sources, workflow: sources.workflow.replace(/(      - name: Verify downloaded candidate identity[\s\S]*?run: node release-tools\/verify-release-candidate\.mjs\n\n)(      - name: Upload exact candidate as Pages artifact[\s\S]*?path: dist\n)/, '$2\n$1') }],
  ['generic live verification removed', { ...sources, workflow: sources.workflow.replace('node release-tools/live-release-contract.mjs', 'echo generic live skipped') }],
  ['TTS runs before generic live', { ...sources, workflow: sources.workflow.replace('node release-tools/live-release-contract.mjs', '__GENERIC_LIVE__').replace('node release-tools/tts-live-deployment-contract.mjs', 'node release-tools/live-release-contract.mjs').replace('__GENERIC_LIVE__', 'node release-tools/tts-live-deployment-contract.mjs') }],
  ['diagnostics gains Pages write', { ...sources, diagnostics: sources.diagnostics.replace('contents: read', 'contents: read\n  pages: write') }],
  ['toolchain Node floats', { ...sources, toolchain: sources.toolchain.replace('22.12.0', '>=22') }],
  ['tree symlink rejection removed', { ...sources, library: sources.library.replace('assert.equal(stat.isSymbolicLink(), false', 'assert.equal(false, false') }],
  ['tree digest algorithm renamed', { ...sources, library: sources.library.replace('sha256-canonical-pages-tree-v1', 'sha256-selected-files-v1') }],
  ['TTS returned to top level', { ...sources, library: sources.library.replace('extensions: {\n      tts:', 'tts:') }],
  ['pointer live check removed', { ...sources, live: sources.live.replace('assertPointer(pointer);', 'void pointer;') }],
  ['live candidate digest check removed', { ...sources, live: sources.live.replace("assert.equal(pointer.artifact?.digest, expectedDigest, 'live pointer candidate digest mismatch');", '') }],
  ['TTS candidate verification removed', { ...sources, tts: sources.tts.replace('const local = verifyReleaseCandidate({', 'const local = { manifest: { artifact: { digest: EXPECTED_CANDIDATE_DIGEST }, extensions: {} } }; void ({') }],
  ['release contract execution removed', { ...sources, ttsWorkflow: sources.ttsWorkflow.replace('node scripts/release-pipeline-contract-test.mjs', 'echo release contract skipped') }],
];
for (const [name, mutated] of mutations) assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
console.log(`Release pipeline contract: PASS (${mutations.length} named build-once/promotion mutations rejected).`);
