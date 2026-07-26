#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function validate(engine, controller, css, workflow, cacheAssets) {
  const problems = [];
  const checks = [
    ['engine status API', engine, /getStatus:\s*getStatus[\s\S]{0,180}showStatus:\s*showStatus/],
    ['engine retry API', engine, /retryLoading:\s*retryLoading/],
    ['engine post-session ready', engine, /InferenceSession\.create[\s\S]*state\.ready\s*=\s*true[\s\S]*finishModelDownloadNotice\('ready'\)/],
    ['engine cache read fallback', engine, /IndexedDB read unavailable, continuing without warm cache/],
    ['engine cache write fallback', engine, /current session can still use the model/],
    ['all visible states', engine, /'browser'[\s\S]*'preparing'[\s\S]*'loading'[\s\S]*'initializing'[\s\S]*'ready'[\s\S]*'selected'[\s\S]*'disabled'[\s\S]*'save-data'[\s\S]*'cancelled'/],
    ['versioned engine lazy URL', controller, /VOSK_ENGINE_SRC\s*=\s*'\/js\/vosk-tts-engine\.js\?v=[a-f0-9]{8}'/],
    ['versioned notice CSS URL', controller, /TTS_NOTICE_CSS_SRC\s*=\s*'\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}'/],
    ['retry event contract', controller, /gb:vosk-retry-request[\s\S]*warmVoskInBackground\(\{ manual: true, retry: true \}\)/],
    ['switch event contract', controller, /gb:vosk-switch-request[\s\S]*switchCurrentSessionToVosk/],
    ['retryable promise, no one-shot latch', controller, /var _voskWarmupPromise = null/],
    ['system voice disclosed', controller, /showVoskStatus\('browser'\)/],
    ['controller first status reveal is synchronous', controller, /function showFallbackTtsStatus\([\s\S]{0,5000}el\.classList\.add\('is-visible'\);[\s\S]{0,700}return el;/],
    ['engine first status reveal is synchronous', engine, /function showStatus\([\s\S]{0,5000}setNoticeAction\(el, actionMode, actionLabel, actionAria\);[\s\S]{0,700}el\.classList\.add\('is-visible'\);[\s\S]{0,700}dispatchEngineStatus/],
    ['browser status preserved during automatic warm-up', controller, /showVoskStatus\('browser'\);\s*warmVoskInBackground\(\{ preserveBrowserStatus: true \}\)/],
    ['warm-up supports status preservation', controller, /preserveBrowserStatus\s*=\s*options\.preserveBrowserStatus === true[\s\S]{0,360}if \(!preserveBrowserStatus\) showVoskStatus\('preparing'\)/],
    ['mobile two-row reflow', css, /@media \(max-width:480px\)[\s\S]*grid-template-columns:30px minmax\(0,1fr\)[\s\S]*grid-column:2/],
    ['mobile viewport anchoring', css, /@media \(max-width:480px\)[\s\S]*left:max\(10px,env\(safe-area-inset-left,0px\)\)[\s\S]*right:max\(10px,env\(safe-area-inset-right,0px\)\)[\s\S]*width:auto[\s\S]*translateY\(14px\)[\s\S]*is-visible\{transform:translateY\(0\) scale\(1\)\}/],
    ['copy can wrap', css, /gb-tts-download-notice__title[\s\S]{0,260}white-space:normal[\s\S]*gb-tts-download-notice__meta[\s\S]{0,260}white-space:normal/],
    ['workflow owns controller', workflow, /js\/floating-cluster-controller\.js/],
    ['workflow runs lifecycle browser test', workflow, /tts-engine-lifecycle-browser-test\.js/],
    ['workflow runs route integration', workflow, /tts-status-route-browser-test\.js/],
    ['workflow executes mobile geometry gate', workflow, /- name:\s*Run mobile notice viewport geometry[\s\S]{0,220}run:\s*\|[\s\S]{0,220}node scripts\/tts-mobile-notice-geometry-browser-test\.js/],
    ['workflow installs WebKit', workflow, /playwright install --with-deps chromium webkit/],
    ['cache registry owns notice CSS', cacheAssets, /const ASSETS = \[[\s\S]*'css\/tts-download-notice\.css'[\s\S]*?\];/],
    ['cache registry owns Vosk engine', cacheAssets, /const ASSETS = \[[\s\S]*'js\/vosk-tts-engine\.js'[\s\S]*?\];/],
    ['cache policy exports lazy no-precache set', cacheAssets, /const LAZY_NO_PRECACHE = Object\.freeze\(\[[\s\S]*?\]\);[\s\S]*module\.exports = \{ ASSETS, LAZY_NO_PRECACHE \}/],
    ['notice CSS remains lazy', cacheAssets, /const LAZY_NO_PRECACHE = Object\.freeze\(\[[\s\S]*'css\/tts-download-notice\.css'[\s\S]*?\]\);/],
    ['Vosk engine remains lazy', cacheAssets, /const LAZY_NO_PRECACHE = Object\.freeze\(\[[\s\S]*'js\/vosk-tts-engine\.js'[\s\S]*?\]\);/],
  ];
  for (const [label, source, pattern] of checks) if (!pattern.test(source)) problems.push(label);

  const requiredWorkflowPaths = [
    'data/release-toolchain.json',
    'js/vosk-tts-engine.js',
    'js/floating-cluster-controller.js',
    'css/tts-download-notice.css',
    'scripts/cache-bust-assets.js',
    'scripts/cache-bust.js',
    'scripts/dist-publication-audit.js',
    'src/lib/asset-version.js',
    'scripts/release-candidate-lib.mjs',
    'scripts/release-pipeline-contract-test.mjs',
    'scripts/deployment-provenance-contract-test.mjs',
    'scripts/write-deployment-provenance.mjs',
    'scripts/verify-release-candidate.mjs',
    'scripts/live-release-contract.mjs',
    'scripts/tts-live-deployment-contract.mjs',
    'scripts/tts-download-consent-contract-test.js',
    'scripts/tts-download-notice-browser-test.js',
    'scripts/tts-engine-status-contract-test.js',
    'scripts/tts-engine-lifecycle-browser-test.js',
    'scripts/tts-status-route-browser-test.js',
    'scripts/tts-mobile-notice-geometry-browser-test.js',
    '.github/workflows/deploy.yml',
    '.github/workflows/tts-download-consent.yml',
  ];
  for (const ownedPath of requiredWorkflowPaths) {
    const escaped = ownedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const count = (workflow.match(new RegExp(`^      - "${escaped}"$`, 'gm')) || []).length;
    if (count !== 2) problems.push(`workflow path ownership drift: ${ownedPath} (${count}/2)`);
  }

  const noticeRevision = crypto.createHash('md5').update(css).digest('hex').slice(0, 8);
  const engineRevision = crypto.createHash('md5').update(engine).digest('hex').slice(0, 8);
  if (!engine.includes('/css/tts-download-notice.css?v=' + noticeRevision)) problems.push('engine notice CSS revision drift');
  if (!controller.includes('/css/tts-download-notice.css?v=' + noticeRevision)) problems.push('controller notice CSS revision drift');
  if (!controller.includes('/js/vosk-tts-engine.js?v=' + engineRevision)) problems.push('controller Vosk engine revision drift');
  if (/_voskWarmupStarted/.test(controller)) problems.push('obsolete one-shot warm-up latch remains');
  if (/s\.src\s*=\s*'\/js\/vosk-tts-engine\.js'/.test(controller)) problems.push('unversioned lazy engine URL remains');
  const deferredReveal = /requestAnimationFrame\(function \(\) \{ el\.classList\.add\('is-visible'\); \}\);/;
  if (deferredReveal.test(controller)) problems.push('controller first status reveal still depends on RAF');
  if (deferredReveal.test(engine)) problems.push('engine first status reveal still depends on RAF');
  return problems;
}

function validateLiveDeploymentContract(liveContract, deployWorkflow) {
  const problems = [];
  const checks = [
    ['live contract checks Gill route', liveContract, /\/articles\/dzhon-gill-chast-1-chelovek\//],
    ['live contract checks standalone route', liveContract, /\/articles\/20-antisovetov-pastoru\//],
    ['live contract checks Hugging Face CSP', liveContract, /connect-src lacks huggingface\.co/],
    ['live contract checks Hugging Face CDN CSP', liveContract, /connect-src lacks \*\.aws\.cdn\.hf\.co/],
    ['live contract checks media and worker blob policy', liveContract, /media-src lacks blob[\s\S]*worker-src lacks blob/],
    ['live contract verifies current pointer', liveContract, /assertPointer\(pointer\);/],
    ['live contract verifies run-addressed provenance', liveContract, /assertProvenance\(provenance\);/],
    ['live contract verifies release SHA', liveContract, /deployment provenance release SHA mismatch/],
    ['live contract verifies control-plane SHA', liveContract, /deployment provenance control-plane SHA mismatch/],
    ['live contract verifies provenance run ID', liveContract, /deployment provenance run ID mismatch/],
    ['live contract verifies candidate digest before TTS', liveContract, /local TTS candidate digest mismatch[\s\S]*deployment provenance candidate digest mismatch/],
    ['live contract reads TTS extension', liveContract, /manifest\.extensions\?\.tts/],
    ['live contract verifies controller bytes', liveContract, /live controller SHA-256 mismatch/],
    ['live contract verifies engine bytes', liveContract, /live Vosk engine SHA-256 mismatch/],
    ['live contract verifies notice CSS bytes', liveContract, /live notice CSS SHA-256 mismatch/],
    ['live contract rejects notice precache', liveContract, /live Service Worker precaches lazy TTS notice CSS/],
    ['live contract rejects engine precache', liveContract, /live Service Worker precaches lazy Vosk engine/],
    ['live contract writes evidence on every attempt', liveContract, /writeReport\(\);[\s\S]*attempt[\s\S]*writeReport\(\);/],
    ['deploy executes generic live contract before TTS', deployWorkflow, /- name: Verify generic live release contract[\s\S]*- name: Verify live TTS capability extension/],
    ['deploy executes staged TTS verifier after Pages', deployWorkflow, /- name: Deploy exact candidate to GitHub Pages[\s\S]*node release-tools\/tts-live-deployment-contract\.mjs/],
    ['deploy passes release SHA', deployWorkflow, /RELEASE_SHA:\s*\$\{\{ needs\.readiness\.outputs\.release_sha \}\}/],
    ['deploy passes control-plane SHA', deployWorkflow, /CONTROL_PLANE_SHA:\s*\$\{\{ needs\.readiness\.outputs\.control_plane_sha \}\}/],
    ['deploy passes candidate digest', deployWorkflow, /EXPECTED_CANDIDATE_DIGEST:\s*\$\{\{ needs\.readiness\.outputs\.candidate_digest \}\}/],
    ['deploy uploads live TTS evidence', deployWorkflow, /name: tts-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]{0,260}reports\/tts-live-deployment-contract\.json/],
  ];
  for (const [label, source, pattern] of checks) if (!pattern.test(source)) problems.push(label);
  return problems;
}

function validateDeploymentProvenance(library, writer, liveContract, deployWorkflow) {
  const problems = [];
  const checks = [
    ['library owns canonical whole-tree digest', library, /sha256-canonical-pages-tree-v1[\s\S]*function canonicalTreeStats/],
    ['library rejects release symlinks', library, /release candidate must not contain symlinks/],
    ['library writes schema v4 generic manifest', library, /schemaVersion:\s*4[\s\S]*releaseSha,[\s\S]*controlPlaneSha,[\s\S]*artifact:[\s\S]*build:[\s\S]*criticalAssets,[\s\S]*extensions:/],
    ['library writes schema v3 two-SHA pointer', library, /schemaVersion:\s*3[\s\S]*releaseSha,[\s\S]*controlPlaneSha,[\s\S]*immutablePath/],
    ['library stores TTS below extensions', library, /extensions:\s*\{[\s\S]*tts:\s*\{/],
    ['writer requires exact release and control identities', writer, /RELEASE_SHA[\s\S]*CONTROL_PLANE_SHA[\s\S]*assertReleaseControlPlaneBoundary/],
    ['writer checks fetched current main', writer, /refs\/remotes\/origin\/main\^\{commit\}/],
    ['writer checks release ancestry', writer, /merge-base', '--is-ancestor', releaseSha, controlPlaneSha/],
    ['writer requires pinned npm version', writer, /RELEASE_NPM_VERSION is required/],
    ['writer emits release output', writer, /release_sha=\$\{report\.releaseSha\}/],
    ['writer emits control output', writer, /control_plane_sha=\$\{report\.controlPlaneSha\}/],
    ['writer emits candidate digest output', writer, /candidate_digest=\$\{report\.digest\}/],
    ['deploy stages trusted tools before provenance', deployWorkflow, /Stage immutable verification tools from trusted control plane[\s\S]*Write generic immutable release provenance/],
    ['deploy writes provenance before candidate upload', deployWorkflow, /- name: Write generic immutable release provenance[\s\S]*node release-tools\/write-deployment-provenance\.mjs[\s\S]*- name: Upload immutable release candidate/],
    ['deploy verifies candidate before Pages upload', deployWorkflow, /- name: Verify downloaded candidate identity[\s\S]*node release-tools\/verify-release-candidate\.mjs[\s\S]*- name: Upload exact candidate as Pages artifact/],
    ['deploy promotes without checkout or rebuild', deployWorkflow, /name:\s*Promote exact readiness candidate[\s\S]*needs:\s*readiness/],
    ['live contract fetches current pointer', liveContract, /currentPointerPath:\s*'\/deployments\/current\.json'/],
    ['live contract fetches release-addressed path', liveContract, /provenancePath:\s*`\/deployments\/\$\{RELEASE_SHA\}\/\$\{runIdentity\}\.json`/],
    ['live contract compares schema v4 TTS extension', liveContract, /deployment provenance schema drifted[\s\S]*deployment provenance TTS extension mismatch/],
  ];
  for (const [label, source, pattern] of checks) if (!pattern.test(source)) problems.push(label);
  const deploySection = deployWorkflow.split('\n  deploy:\n')[1] || '';
  if (/actions\/checkout@|\bnpm ci\b|strangler:build/.test(deploySection)) problems.push('privileged deploy rebuilds or checks out source');
  if (/\bcommitSha\b|DEPLOYED_SHA|EXPECTED_COMMIT_SHA/.test([library, writer, liveContract].join('\n'))) problems.push('legacy single-SHA deployment identity remains');
  return problems;
}

function validateDistPublicationAudit(source) {
  const problems = [];
  if (!/const \{ ASSETS, LAZY_NO_PRECACHE \} = require\('\.\/cache-bust-assets'\);/.test(source)) problems.push('dist publication audit does not import canonical lazy policy');
  if (!/const lazyNoPrecache = new Set\(LAZY_NO_PRECACHE\);/.test(source)) problems.push('dist publication audit does not consume canonical lazy policy');
  if (/const LAZY_NO_PRECACHE = new Set\(\[/.test(source)) problems.push('dist publication audit keeps a divergent local lazy list');
  return problems;
}

const engine = read('js/vosk-tts-engine.js');
const controller = read('js/floating-cluster-controller.js');
const css = read('css/tts-download-notice.css');
const workflow = read('.github/workflows/tts-download-consent.yml');
const deployWorkflow = read('.github/workflows/deploy.yml');
const releaseLibrary = read('scripts/release-candidate-lib.mjs');
const provenanceWriter = read('scripts/write-deployment-provenance.mjs');
const liveDeploymentContract = read('scripts/tts-live-deployment-contract.mjs');
const cacheAssets = read('scripts/cache-bust-assets.js');
const distPublicationAudit = read('scripts/dist-publication-audit.js');

assert.deepEqual(validate(engine, controller, css, workflow, cacheAssets), []);
assert.deepEqual(validateLiveDeploymentContract(liveDeploymentContract, deployWorkflow), []);
assert.deepEqual(validateDeploymentProvenance(releaseLibrary, provenanceWriter, liveDeploymentContract, deployWorkflow), []);
assert.deepEqual(validateDistPublicationAudit(distPublicationAudit), []);

for (const [name, mutation] of [
  ['dist audit lazy export removed', distPublicationAudit.replace('{ ASSETS, LAZY_NO_PRECACHE }', '{ ASSETS }')],
  ['dist audit canonical lazy set bypassed', distPublicationAudit.replace('new Set(LAZY_NO_PRECACHE)', 'new Set([])')],
]) assert.ok(validateDistPublicationAudit(mutation).length > 0, `${name}: mutation must be rejected`);

for (const [name, liveMutation, deployMutation] of [
  ['standalone live route removed', liveDeploymentContract.replace("  '/articles/20-antisovetov-pastoru/',\n", ''), deployWorkflow],
  ['live CSP host check removed', liveDeploymentContract.replace('connect-src lacks huggingface.co', 'connect-src host unchecked'), deployWorkflow],
  ['live Service Worker check removed', liveDeploymentContract.replace('live Service Worker precaches lazy Vosk engine', 'live Service Worker ignored'), deployWorkflow],
  ['live current pointer assertion removed', liveDeploymentContract.replace('assertPointer(pointer);', 'void pointer;'), deployWorkflow],
  ['live provenance assertion removed', liveDeploymentContract.replace('assertProvenance(provenance);', 'void provenance;'), deployWorkflow],
  ['candidate digest check removed', liveDeploymentContract.replace("assert.equal(local.manifest.artifact.digest, EXPECTED_CANDIDATE_DIGEST, 'local TTS candidate digest mismatch');", ''), deployWorkflow],
  ['release SHA check removed', liveDeploymentContract.replace('deployment provenance release SHA mismatch', 'release unchecked'), deployWorkflow],
  ['control SHA check removed', liveDeploymentContract.replace('deployment provenance control-plane SHA mismatch', 'control unchecked'), deployWorkflow],
  ['post-deploy execution removed', liveDeploymentContract, deployWorkflow.replace('node release-tools/tts-live-deployment-contract.mjs', 'echo live TTS contract skipped')],
  ['live evidence upload removed', liveDeploymentContract, deployWorkflow.replace('reports/tts-live-deployment-contract.json', 'reports/missing-live-tts-evidence.json')],
]) assert.ok(validateLiveDeploymentContract(liveMutation, deployMutation).length > 0, `${name}: mutation must be rejected`);

for (const [name, libraryMutation, writerMutation, liveMutation, deployMutation] of [
  ['whole-tree digest weakened', releaseLibrary.replace('sha256-canonical-pages-tree-v1', 'sha256-selected-files-v1'), provenanceWriter, liveDeploymentContract, deployWorkflow],
  ['symlink rejection removed', releaseLibrary.replace('release candidate must not contain symlinks', 'symlinks allowed'), provenanceWriter, liveDeploymentContract, deployWorkflow],
  ['TTS returned to top level', releaseLibrary.replace('extensions: {\n      tts:', 'tts:'), provenanceWriter, liveDeploymentContract, deployWorkflow],
  ['writer release output removed', releaseLibrary, provenanceWriter.replace('release_sha=${report.releaseSha}', 'release_sha=unchecked'), liveDeploymentContract, deployWorkflow],
  ['writer control output aliased', releaseLibrary, provenanceWriter.replace('control_plane_sha=${report.controlPlaneSha}', 'control_plane_sha=${report.releaseSha}'), liveDeploymentContract, deployWorkflow],
  ['deploy provenance step removed', releaseLibrary, provenanceWriter, liveDeploymentContract, deployWorkflow.replace('node release-tools/write-deployment-provenance.mjs', 'echo provenance skipped')],
  ['deploy candidate verification removed', releaseLibrary, provenanceWriter, liveDeploymentContract, deployWorkflow.replace('node release-tools/verify-release-candidate.mjs', 'echo candidate unchecked')],
  ['live release-addressed path removed', releaseLibrary, provenanceWriter, liveDeploymentContract.replace('provenancePath: `/deployments/${RELEASE_SHA}/${runIdentity}.json`', "provenancePath: '/deployment.json'"), deployWorkflow],
]) assert.ok(validateDeploymentProvenance(libraryMutation, writerMutation, liveMutation, deployMutation).length > 0, `${name}: mutation must be rejected`);

const mutations = [
  ['retry API removed', engine.replace('retryLoading: retryLoading', 'retryLoading: null'), controller, css, workflow, cacheAssets],
  ['engine URL unversioned', engine, controller.replace(/vosk-tts-engine\.js\?v=[a-f0-9]{8}/, 'vosk-tts-engine.js'), css, workflow, cacheAssets],
  ['retry event removed', engine, controller.replace(/gb:vosk-retry-request/g, 'gb:vosk-retry-missing'), css, workflow, cacheAssets],
  ['browser status preservation removed', engine, controller.replace('preserveBrowserStatus: true', 'preserveBrowserStatus: false'), css, workflow, cacheAssets],
  ['controller synchronous reveal deferred', engine, controller.replace("el.classList.add('is-visible');", "requestAnimationFrame(function () { el.classList.add('is-visible'); });"), css, workflow, cacheAssets],
  ['engine synchronous reveal deferred', engine.replace("el.classList.add('is-visible');", "requestAnimationFrame(function () { el.classList.add('is-visible'); });"), controller, css, workflow, cacheAssets],
  ['notice copy forced nowrap', engine, controller, css.replace('white-space:normal', 'white-space:nowrap'), workflow, cacheAssets],
  ['mobile right inset removed', engine, controller, css.replace('right:max(10px,env(safe-area-inset-right,0px));', 'right:auto;'), workflow, cacheAssets],
  ['engine CSS revision corrupted', engine.replace(/DOWNLOAD_NOTICE_CSS_URL = '\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}'/, "DOWNLOAD_NOTICE_CSS_URL = '/css/tts-download-notice.css?v=00000000'"), controller, css, workflow, cacheAssets],
  ['controller CSS revision corrupted', engine, controller.replace(/TTS_NOTICE_CSS_SRC = '\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}'/, "TTS_NOTICE_CSS_SRC = '/css/tts-download-notice.css?v=00000000'"), css, workflow, cacheAssets],
  ['controller engine revision corrupted', engine, controller.replace(/VOSK_ENGINE_SRC = '\/js\/vosk-tts-engine\.js\?v=[a-f0-9]{8}'/, "VOSK_ENGINE_SRC = '/js/vosk-tts-engine.js?v=00000000'"), css, workflow, cacheAssets],
  ['WebKit install removed', engine, controller, css, workflow.replace('chromium webkit', 'chromium'), cacheAssets],
  ['mobile geometry execution removed', engine, controller, css, workflow.replace(/\n\s*- name: Run mobile notice viewport geometry[\s\S]*?node scripts\/tts-mobile-notice-geometry-browser-test\.js[^\n]*\n/, '\n'), cacheAssets],
  ['cache registry trigger removed', engine, controller, css, workflow.replace(/^      - "scripts\/cache-bust-assets\.js"\n/gm, ''), cacheAssets],
  ['dist publication trigger removed', engine, controller, css, workflow.replace(/^      - "scripts\/dist-publication-audit\.js"\n/gm, ''), cacheAssets],
  ['asset projection trigger removed', engine, controller, css, workflow.replace(/^      - "src\/lib\/asset-version\.js"\n/gm, ''), cacheAssets],
  ['provenance writer trigger removed', engine, controller, css, workflow.replace(/^      - "scripts\/write-deployment-provenance\.mjs"\n/gm, ''), cacheAssets],
  ['live deployment script trigger removed', engine, controller, css, workflow.replace(/^      - "scripts\/tts-live-deployment-contract\.mjs"\n/gm, ''), cacheAssets],
  ['deploy workflow trigger removed', engine, controller, css, workflow.replace(/^      - "\.github\/workflows\/deploy\.yml"\n/gm, ''), cacheAssets],
  ['notice CSS cache registry entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const ASSETS = \[[\s\S]*?)  'css\/tts-download-notice\.css',\n/, '$1')],
  ['Vosk engine cache registry entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const ASSETS = \[[\s\S]*?)  'js\/vosk-tts-engine\.js',\n/, '$1')],
  ['notice CSS lazy policy entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const LAZY_NO_PRECACHE = Object\.freeze\(\[[\s\S]*?)  'css\/tts-download-notice\.css',\n/, '$1')],
  ['Vosk engine lazy policy entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const LAZY_NO_PRECACHE = Object\.freeze\(\[[\s\S]*?)  'js\/vosk-tts-engine\.js',\n/, '$1')],
];
for (const [name, ...mutation] of mutations) assert.ok(validate(...mutation).length > 0, `${name}: mutation must be rejected`);
console.log('TTS engine status contract: PASS (' + (mutations.length + 22) + ' named adversarial mutations rejected).');
