#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const md5 = (source) => crypto.createHash('md5').update(source).digest('hex').slice(0, 8);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function expectPattern(problems, label, source, pattern) {
  if (!pattern.test(source)) problems.push(label);
}

function ownedPathCount(workflow, ownedPath) {
  const escaped = escapeRegExp(ownedPath);
  return (workflow.match(new RegExp(`^      - "${escaped}"$`, 'gm')) || []).length;
}

function validateTtsStatus(input) {
  const {
    engine,
    worker,
    controller,
    canonicalRuntime,
    css,
    workflow,
    cacheAssets,
    assetVersions,
  } = input;
  const problems = [];

  const cssRevision = md5(css);
  const engineRevision = md5(engine);
  const workerRevision = md5(worker);
  const controllerRevision = md5(controller);

  const engineChecks = [
    ['engine: version 2 client', /var VERSION = 2;/],
    ['engine: status API', /getStatus:\s*getStatus[\s\S]{0,220}showStatus:\s*showStatus/],
    ['engine: retry API', /retryLoading:\s*retryLoading/],
    ['engine: same-origin persistent Worker', /new Worker\(WORKER_SRC,\s*\{\s*name:\s*'gb-vosk-tts'\s*\}\)/],
    ['engine: Worker status bridge', /type === 'status'[\s\S]{0,360}showStatus\(message\.phase/],
    ['engine: Worker progress bridge', /gb:vosk-synthesis-progress/],
    ['engine: transferable WAV playback', /type === 'audio'[\s\S]{0,800}new Blob\(\[message\.wav\]/],
    ['engine: terminal cancel', /function cancelLoading\(options\)[\s\S]{0,900}postMessage\(\{\s*type:\s*'cancel-load'\s*\}\)[\s\S]{0,260}terminateWorker\(error\)/],
    ['engine: synchronous first reveal', /function showStatus\([\s\S]{0,7000}element\.classList\.add\('is-visible'\);[\s\S]{0,900}dispatchStatus/],
    ['engine: visible lifecycle states', /name === 'browser'[\s\S]*name === 'preparing'[\s\S]*name === 'loading'[\s\S]*name === 'verifying'[\s\S]*name === 'extracting'[\s\S]*name === 'cache-hit'[\s\S]*name === 'initializing'[\s\S]*name === 'ready'[\s\S]*name === 'selected'[\s\S]*name === 'disabled'[\s\S]*name === 'save-data'[\s\S]*name === 'cancelled'/],
  ];
  for (const [label, pattern] of engineChecks) expectPattern(problems, label, engine, pattern);

  if (/InferenceSession|unzipSync|model-quant\.zip|indexedDB\.open|readerVoskFetch|installOneShotUnzip/.test(engine)) {
    problems.push('engine: heavyweight model ownership leaked into document client');
  }
  if (/window\.fetch\s*=|\.unzipSync\s*=\s*function/.test(engine)) {
    problems.push('engine: global interception or monkey patch remains');
  }

  const workerChecks = [
    ['worker: dependencies imported off-main-thread', /importScripts\(CORE_SRC, STRESS_LOOKUP_SRC, FFLATE_SRC, ORT_SRC\)/],
    ['worker: IndexedDB cache read', /function idbGet\(/],
    ['worker: IndexedDB cache write', /function idbSet\(/],
    ['worker: cache read fallback status', /cache-unavailable[\s\S]{0,220}indexeddb-read/],
    ['worker: cache write fallback status', /cache-unavailable[\s\S]{0,220}indexeddb-write/],
    ['worker: cache commit boundary', /function idbSet\([\s\S]{0,900}transaction\.oncomplete[\s\S]{0,300}resolve\(\)/],
    ['worker: abortable model request', /fetch\(MODEL_URL,\s*state\.loadController\s*\?\s*\{\s*signal:\s*state\.loadController\.signal\s*\}/],
    ['worker: model integrity verification', /EXPECTED_MODEL_SHA256[\s\S]*crypto\.subtle\.digest\('SHA-256'/],
    ['worker: archive extraction', /fflate\.unzipSync/],
    ['worker: ONNX session ownership', /ort\.InferenceSession\.create/],
    ['worker: readiness only after sessions', /Promise\.all\(\[[\s\S]*InferenceSession\.create[\s\S]*\]\.then\(function \(sessions\)[\s\S]*state\.ready = true;[\s\S]*status\('ready'\)/],
    ['worker: manual terms override dictionary', /stress\.customTerms\.forEach\(function \(_, word\) \{ state\.dic\.delete\(String\(word\)\.toLowerCase\(\)\); \}\)/],
    ['worker: model dictionary keeps priority', /function injectCustomStress\(text\)[\s\S]{0,500}state\.dic\s*&&\s*state\.dic\.has\(lower\)[\s\S]{0,120}return word/],
    ['worker: synthesis progress', /post\('synth-progress'/],
    ['worker: audio transferred once', /post\('audio'[\s\S]{0,260}\[buffer\]\)/],
    ['worker: cancellation protocol', /message\.type === 'cancel-load'[\s\S]{0,260}loadController\.abort/],
  ];
  for (const [label, pattern] of workerChecks) expectPattern(problems, label, worker, pattern);

  const canonicalChecks = [
    ['canonical: central asset registry import', /import \{ assetUrl \} from ['"]\.\.\/\.\.\/lib\/asset-version['"]/],
    ['canonical: thin client URL from registry', /const voskEngineSrc = assetUrl\(['"]js\/vosk-tts-engine\.js['"]\)/],
    ['canonical: deferred thin client', /<script is:inline defer src=\{voskEngineSrc\}><\/script>/],
    ['canonical: reader FSM composed', /import ['"]\.\.\/\.\.\/runtime\/reader-tts\.js['"]/],
    ['canonical: media session composed', /import ['"]\.\.\/\.\.\/runtime\/reader-tts-media-session\.js['"]/],
  ];
  for (const [label, pattern] of canonicalChecks) expectPattern(problems, label, canonicalRuntime, pattern);
  if (/reader-vosk-download-worker|readerVoskFetch|installOneShotUnzip/.test(canonicalRuntime)) {
    problems.push('canonical: obsolete interception layer is still composed');
  }

  const controllerChecks = [
    ['controller: versioned engine fallback', /VOSK_ENGINE_SRC\s*=\s*['"]\/js\/vosk-tts-engine\.js\?v=[a-f0-9]{8}['"]/],
    ['controller: versioned notice fallback', /TTS_NOTICE_CSS_SRC\s*=\s*['"]\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}['"]/],
    ['controller: retry event contract', /gb:vosk-retry-request[\s\S]*warmVoskInBackground\(\{ manual: true, retry: true \}\)/],
    ['controller: switch event contract', /gb:vosk-switch-request[\s\S]*switchCurrentSessionToVosk/],
    ['controller: retryable promise', /var _voskWarmupPromise = null/],
    ['controller: system voice disclosed immediately', /showVoskStatus\('browser'\);\s*warmVoskInBackground\(\{ preserveBrowserStatus: true \}\)/],
    ['controller: synchronous fallback reveal', /function showFallbackTtsStatus\([\s\S]{0,5600}el\.classList\.add\('is-visible'\);/],
  ];
  for (const [label, pattern] of controllerChecks) expectPattern(problems, label, controller, pattern);

  const cssChecks = [
    ['css: informational root does not intercept PLAY', /\.gb-tts-download-notice\.is-visible\{[\s\S]{0,180}pointer-events:none/],
    ['css: explicit action remains interactive', /\.gb-tts-download-notice__action\{[\s\S]{0,140}pointer-events:auto/],
    ['css: mobile bottom controls clearance', /@media \(max-width:480px\)[\s\S]{0,300}bottom:max\(92px/],
    ['css: mobile viewport anchoring', /left:max\(10px,env\(safe-area-inset-left,0px\)\)[\s\S]{0,180}right:max\(10px,env\(safe-area-inset-right,0px\)\)[\s\S]{0,120}width:auto/],
    ['css: coarse pointer target', /@media \(pointer:coarse\)[\s\S]{0,160}min-height:44px/],
    ['css: reduced motion', /@media \(prefers-reduced-motion:reduce\)/],
  ];
  for (const [label, pattern] of cssChecks) expectPattern(problems, label, css, pattern);

  const expectedEngineCss = `/css/tts-download-notice.css?v=${cssRevision}`;
  const expectedEngineWorker = `/js/vosk-tts-worker.js?v=${workerRevision}`;
  if (!engine.includes(expectedEngineCss)) problems.push(`revision: engine notice CSS must be ${expectedEngineCss}`);
  if (!engine.includes(expectedEngineWorker)) problems.push(`revision: engine Worker must be ${expectedEngineWorker}`);

  const versionEntries = [
    ['css/tts-download-notice.css', cssRevision],
    ['js/vosk-tts-engine.js', engineRevision],
    ['js/vosk-tts-worker.js', workerRevision],
    ['js/floating-cluster-controller.js', controllerRevision],
  ];
  for (const [asset, revision] of versionEntries) {
    const pattern = new RegExp(`'${escapeRegExp(asset)}': '${revision}'`);
    if (!pattern.test(assetVersions)) problems.push(`asset-version: ${asset} must be ${revision}`);
  }

  for (const asset of ['css/tts-download-notice.css', 'js/vosk-tts-engine.js', 'js/vosk-tts-worker.js']) {
    const assetPattern = new RegExp(`const ASSETS = \\[[\\s\\S]*'${escapeRegExp(asset)}'[\\s\\S]*?\\];`);
    const lazyPattern = new RegExp(`const LAZY_NO_PRECACHE = Object\\.freeze\\(\\[[\\s\\S]*'${escapeRegExp(asset)}'[\\s\\S]*?\\]\\);`);
    if (!assetPattern.test(cacheAssets)) problems.push(`cache registry: missing governed asset ${asset}`);
    if (!lazyPattern.test(cacheAssets)) problems.push(`cache registry: ${asset} must remain lazy`);
  }

  const requiredWorkflowPaths = [
    'src/components/reader-platform/ReaderActionsRuntime.astro',
    'src/runtime/reader-tts.js',
    'src/runtime/reader-tts-defaults.js',
    'src/runtime/reader-tts-media-session.js',
    'js/vosk-tts-engine.js',
    'js/vosk-tts-worker.js',
    'js/vosk-tts-core.js',
    'js/vosk-stress-lookup.js',
    'js/vosk-custom-terms.json',
    'js/vosk-stress-marker.bin',
    'js/floating-cluster-controller.js',
    'css/tts-download-notice.css',
    'scripts/cache-bust-assets.js',
    'src/lib/asset-version.js',
    'scripts/tts-download-consent-contract-test.js',
    'scripts/tts-engine-status-contract-test.js',
    'scripts/tts-stress-dictionary-contract.js',
    'scripts/tts-reader-runtime-browser-test.js',
    'scripts/tts-reader-multitab-lock-browser-test.js',
    'scripts/tts-route-crawl-browser-test.js',
    'scripts/tts-mobile-notice-geometry-browser-test.js',
    '.github/workflows/deploy.yml',
    '.github/workflows/tts-download-consent.yml',
    '.github/workflows/tts-reader-polish.yml',
  ];
  for (const ownedPath of requiredWorkflowPaths) {
    const count = ownedPathCount(workflow, ownedPath);
    if (count !== 2) problems.push(`workflow path ownership: ${ownedPath} (${count}/2)`);
  }
  expectPattern(problems, 'workflow: checks Worker syntax', workflow, /for file in[\s\S]*js\/vosk-tts-worker\.js/);
  expectPattern(problems, 'workflow: checks status contract syntax', workflow, /for file in[\s\S]*scripts\/tts-engine-status-contract-test\.js/);
  expectPattern(problems, 'workflow: runs status source contract', workflow, /node scripts\/tts-engine-status-contract-test\.js[\s\S]{0,160}tts-source-engine-status\.log/);
  expectPattern(problems, 'workflow: installs Chromium and WebKit', workflow, /playwright install --with-deps chromium webkit/);
  expectPattern(problems, 'workflow: runs deterministic reader and lock fixtures', workflow, /node scripts\/tts-reader-runtime-browser-test\.js[\s\S]{0,260}node scripts\/tts-reader-multitab-lock-browser-test\.js/);
  expectPattern(problems, 'workflow: runs all-route crawl', workflow, /node scripts\/tts-route-crawl-browser-test\.js/);
  expectPattern(problems, 'workflow: runs mobile geometry', workflow, /node scripts\/tts-mobile-notice-geometry-browser-test\.js/);

  return problems;
}

function validateLiveRelease(liveContract, deployWorkflow) {
  const problems = [];
  const checks = [
    ['live: Gill route', liveContract, /\/articles\/dzhon-gill-chast-1-chelovek\//],
    ['live: standalone route', liveContract, /\/articles\/20-antisovetov-pastoru\//],
    ['live: Hugging Face CSP', liveContract, /connect-src lacks huggingface\.co/],
    ['live: CDN CSP', liveContract, /connect-src lacks \*\.aws\.cdn\.hf\.co/],
    ['live: blob audio policy', liveContract, /media-src lacks blob/],
    ['live: same-origin Worker policy', liveContract, /worker-src lacks self/],
    ['live: immutable pointer', liveContract, /assertPointer\(pointer\);/],
    ['live: immutable provenance', liveContract, /assertProvenance\(provenance\);/],
    ['live: TTS extension', liveContract, /manifest\.extensions\?\.tts/],
    ['live: engine bytes', liveContract, /live Vosk engine SHA-256 mismatch/],
    ['live: notice bytes', liveContract, /live notice CSS SHA-256 mismatch/],
    ['deploy: generic verification before TTS', deployWorkflow, /Verify generic live release contract[\s\S]*Verify live TTS capability extension/],
    ['deploy: post-Pages TTS verifier', deployWorkflow, /Deploy exact candidate to GitHub Pages[\s\S]*tts-live-deployment-contract\.mjs/],
    ['deploy: live evidence upload', deployWorkflow, /tts-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]{0,360}reports\/tts-live-deployment-contract\.json/],
  ];
  for (const [label, source, pattern] of checks) expectPattern(problems, label, source, pattern);
  return problems;
}

function validateDistPublication(source) {
  const problems = [];
  expectPattern(problems, 'dist: imports canonical lazy policy', source, /const \{ ASSETS, LAZY_NO_PRECACHE \} = require\('\.\/cache-bust-assets'\);/);
  expectPattern(problems, 'dist: consumes canonical lazy policy', source, /const lazyNoPrecache = new Set\(LAZY_NO_PRECACHE\);/);
  if (/const LAZY_NO_PRECACHE = new Set\(\[/.test(source)) problems.push('dist: divergent local lazy list remains');
  return problems;
}

const sources = {
  engine: read('js/vosk-tts-engine.js'),
  worker: read('js/vosk-tts-worker.js'),
  controller: read('js/floating-cluster-controller.js'),
  canonicalRuntime: read('src/components/reader-platform/ReaderActionsRuntime.astro'),
  css: read('css/tts-download-notice.css'),
  workflow: read('.github/workflows/tts-download-consent.yml'),
  cacheAssets: read('scripts/cache-bust-assets.js'),
  assetVersions: read('src/lib/asset-version.js'),
};
const liveContract = read('scripts/tts-live-deployment-contract.mjs');
const deployWorkflow = read('.github/workflows/deploy.yml');
const distPublication = read('scripts/dist-publication-audit.js');

const baselineProblems = validateTtsStatus(sources);
assert.deepEqual(baselineProblems, [], baselineProblems.join('\n'));
assert.deepEqual(validateLiveRelease(liveContract, deployWorkflow), []);
assert.deepEqual(validateDistPublication(distPublication), []);

const mutations = [
  ['ONNX leaked into client', { ...sources, engine: `${sources.engine}\nort.InferenceSession.create(new ArrayBuffer(0));` }],
  ['Worker ONNX removed', { ...sources, worker: sources.worker.replaceAll('InferenceSession.create', 'InferenceSession.missing') }],
  ['dictionary priority removed', { ...sources, worker: sources.worker.replace('if (state.dic && state.dic.has(lower)) return word;', '') }],
  ['manual override removed', { ...sources, worker: sources.worker.replace('state.dic.delete(String(word).toLowerCase());', 'void word;') }],
  ['cancel no longer terminal', { ...sources, engine: sources.engine.replace(/function cancelLoading\(options\)([\s\S]{0,900}?)terminateWorker\(error\);/, 'function cancelLoading(options)$1void 0;') }],
  ['engine reveal deferred', { ...sources, engine: sources.engine.replace("element.classList.add('is-visible');", "requestAnimationFrame(function () { element.classList.add('is-visible'); });") }],
  ['canonical asset registry removed', { ...sources, canonicalRuntime: sources.canonicalRuntime.replace("assetUrl('js/vosk-tts-engine.js')", "'/js/vosk-tts-engine.js'") }],
  ['notice intercepts PLAY', { ...sources, css: sources.css.replace('pointer-events:none;\n  transform:translate(-50%,0)', 'pointer-events:auto;\n  transform:translate(-50%,0)') }],
  ['worker workflow trigger removed', { ...sources, workflow: sources.workflow.replaceAll('      - "js/vosk-tts-worker.js"\n', '') }],
  ['controller workflow trigger removed', { ...sources, workflow: sources.workflow.replaceAll('      - "js/floating-cluster-controller.js"\n', '') }],
  ['canonical workflow trigger removed', { ...sources, workflow: sources.workflow.replaceAll('      - "src/components/reader-platform/ReaderActionsRuntime.astro"\n', '') }],
  ['status gate execution removed', { ...sources, workflow: sources.workflow.replace('node scripts/tts-engine-status-contract-test.js', 'echo skipped-status-contract') }],
  ['worker lazy policy removed', { ...sources, cacheAssets: sources.cacheAssets.replace("  'js/vosk-tts-worker.js',\n  'manifest.json',", "  'manifest.json',") }],
  ['worker version entry removed', { ...sources, assetVersions: sources.assetVersions.replace(/^  'js\/vosk-tts-worker\.js':.*\n/m, '') }],
];
for (const [name, mutation] of mutations) {
  assert.ok(validateTtsStatus(mutation).length > 0, `${name}: mutation must be rejected`);
}

for (const [name, liveMutation, deployMutation] of [
  ['live route removed', liveContract.replace("  '/articles/20-antisovetov-pastoru/',\n", ''), deployWorkflow],
  ['live CSP host check removed', liveContract.replace('connect-src lacks huggingface.co', 'host unchecked'), deployWorkflow],
  ['post-deploy TTS execution removed', liveContract, deployWorkflow.replace('node release-tools/tts-live-deployment-contract.mjs', 'echo skipped')],
  ['live evidence upload removed', liveContract, deployWorkflow.replace('reports/tts-live-deployment-contract.json', 'reports/missing.json')],
]) {
  assert.ok(validateLiveRelease(liveMutation, deployMutation).length > 0, `${name}: mutation must be rejected`);
}

for (const mutation of [
  distPublication.replace('{ ASSETS, LAZY_NO_PRECACHE }', '{ ASSETS }'),
  distPublication.replace('new Set(LAZY_NO_PRECACHE)', 'new Set([])'),
]) {
  assert.ok(validateDistPublication(mutation).length > 0, 'dist publication mutation must be rejected');
}

console.log(`TTS engine/Worker status contract: PASS (${mutations.length + 6} adversarial mutations rejected).`);
