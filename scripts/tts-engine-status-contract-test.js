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
  for (const [label, source, pattern] of checks) {
    if (!pattern.test(source)) problems.push(label);
  }

  const requiredWorkflowPaths = [
    'js/vosk-tts-engine.js',
    'js/floating-cluster-controller.js',
    'css/tts-download-notice.css',
    'scripts/cache-bust-assets.js',
    'scripts/cache-bust.js',
    'scripts/dist-publication-audit.js',
    'src/lib/asset-version.js',
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
  if (!engine.includes('/css/tts-download-notice.css?v=' + noticeRevision)) {
    problems.push('engine notice CSS revision drift');
  }
  if (!controller.includes('/css/tts-download-notice.css?v=' + noticeRevision)) {
    problems.push('controller notice CSS revision drift');
  }
  if (!controller.includes('/js/vosk-tts-engine.js?v=' + engineRevision)) {
    problems.push('controller Vosk engine revision drift');
  }
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
    ['live contract checks media and worker blob policy', liveContract, /media-src lacks blob:[\s\S]*worker-src lacks blob:/],
    ['live contract verifies controller bytes', liveContract, /live controller bytes do not match deployed revision/],
    ['live contract verifies engine bytes', liveContract, /live Vosk engine bytes do not match deployed revision/],
    ['live contract verifies notice CSS bytes', liveContract, /live notice CSS bytes do not match deployed revision/],
    ['live contract rejects notice precache', liveContract, /live Service Worker precaches lazy TTS notice CSS/],
    ['live contract rejects engine precache', liveContract, /live Service Worker precaches lazy Vosk engine/],
    ['live contract writes evidence on every attempt', liveContract, /writeReport\(\);[\s\S]*attempt[\s\S]*writeReport\(\);/],
    ['deploy executes live contract after Pages', deployWorkflow, /- name: Deploy to GitHub Pages[\s\S]{0,900}- name: Verify live TTS deployment contract[\s\S]{0,260}node scripts\/tts-live-deployment-contract\.mjs/],
    ['deploy passes verified SHA', deployWorkflow, /DEPLOYED_SHA:[^\n]*workflow_run\.head_sha/],
    ['deploy uploads live TTS evidence', deployWorkflow, /name: tts-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]{0,220}reports\/tts-live-deployment-contract\.json/],
  ];
  for (const [label, source, pattern] of checks) {
    if (!pattern.test(source)) problems.push(label);
  }
  return problems;
}

const engine = read('js/vosk-tts-engine.js');
const controller = read('js/floating-cluster-controller.js');
const css = read('css/tts-download-notice.css');
const workflow = read('.github/workflows/tts-download-consent.yml');
const deployWorkflow = read('.github/workflows/deploy.yml');
const liveDeploymentContract = read('scripts/tts-live-deployment-contract.mjs');
const cacheAssets = read('scripts/cache-bust-assets.js');
const distPublicationAudit = read('scripts/dist-publication-audit.js');
assert.deepEqual(validate(engine, controller, css, workflow, cacheAssets), []);
assert.deepEqual(validateLiveDeploymentContract(liveDeploymentContract, deployWorkflow), []);

function validateDistPublicationAudit(source) {
  const problems = [];
  if (!/const \{ ASSETS, LAZY_NO_PRECACHE \} = require\('\.\/cache-bust-assets'\);/.test(source)) {
    problems.push('dist publication audit does not import canonical lazy policy');
  }
  if (!/const lazyNoPrecache = new Set\(LAZY_NO_PRECACHE\);/.test(source)) {
    problems.push('dist publication audit does not consume canonical lazy policy');
  }
  if (/const LAZY_NO_PRECACHE = new Set\(\[/.test(source)) {
    problems.push('dist publication audit keeps a divergent local lazy list');
  }
  return problems;
}

assert.deepEqual(validateDistPublicationAudit(distPublicationAudit), []);
for (const [name, mutation] of [
  ['dist audit lazy export removed', distPublicationAudit.replace('{ ASSETS, LAZY_NO_PRECACHE }', '{ ASSETS }')],
  ['dist audit canonical lazy set bypassed', distPublicationAudit.replace('new Set(LAZY_NO_PRECACHE)', 'new Set([])')],
]) {
  assert.ok(validateDistPublicationAudit(mutation).length > 0, `${name}: mutation must be rejected`);
}

for (const [name, liveMutation, deployMutation] of [
  ['standalone live route removed', liveDeploymentContract.replace("  '/articles/20-antisovetov-pastoru/',\n", ''), deployWorkflow],
  ['live CSP host check removed', liveDeploymentContract.replace('connect-src lacks huggingface.co', 'connect-src host unchecked'), deployWorkflow],
  ['live Service Worker check removed', liveDeploymentContract.replace('live Service Worker precaches lazy Vosk engine', 'live Service Worker ignored'), deployWorkflow],
  ['post-deploy execution removed', liveDeploymentContract, deployWorkflow.replace('node scripts/tts-live-deployment-contract.mjs', 'echo live TTS contract skipped')],
  ['live evidence upload removed', liveDeploymentContract, deployWorkflow.replace('reports/tts-live-deployment-contract.json', 'reports/missing-live-tts-evidence.json')],
]) {
  assert.ok(validateLiveDeploymentContract(liveMutation, deployMutation).length > 0, `${name}: mutation must be rejected`);
}

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
  ['live deployment script trigger removed', engine, controller, css, workflow.replace(/^      - "scripts\/tts-live-deployment-contract\.mjs"\n/gm, ''), cacheAssets],
  ['deploy workflow trigger removed', engine, controller, css, workflow.replace(/^      - "\.github\/workflows\/deploy\.yml"\n/gm, ''), cacheAssets],
  ['notice CSS cache registry entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const ASSETS = \[[\s\S]*?)  'css\/tts-download-notice\.css',\n/, '$1')],
  ['Vosk engine cache registry entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const ASSETS = \[[\s\S]*?)  'js\/vosk-tts-engine\.js',\n/, '$1')],
  ['notice CSS lazy policy entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const LAZY_NO_PRECACHE = Object\.freeze\(\[[\s\S]*?)  'css\/tts-download-notice\.css',\n/, '$1')],
  ['Vosk engine lazy policy entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const LAZY_NO_PRECACHE = Object\.freeze\(\[[\s\S]*?)  'js\/vosk-tts-engine\.js',\n/, '$1')],
];
for (const [name, ...mutation] of mutations) {
  const problems = validate(...mutation);
  assert.ok(problems.length > 0, `${name}: mutation must be rejected`);
}
console.log('TTS engine status contract: PASS (' + (mutations.length + 5) + ' named adversarial mutations rejected).');
