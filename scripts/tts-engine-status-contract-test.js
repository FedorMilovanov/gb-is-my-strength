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
const has = (source, value) => source.includes(value);

function countWorkflowPath(workflow, value) {
  return (workflow.match(new RegExp(`^      - "${escapeRegExp(value)}"$`, 'gm')) || []).length;
}

function ordered(source, values) {
  let cursor = -1;
  for (const value of values) {
    cursor = source.indexOf(value, cursor + 1);
    if (cursor < 0) return false;
  }
  return true;
}

function validate(input) {
  const {
    engine,
    worker,
    controller,
    canonical,
    css,
    assetVersions,
    cacheAssets,
    workflow,
    releaseLibrary,
    liveContract,
    deployWorkflow,
    distAudit,
  } = input;
  const problems = [];
  const requireText = (label, source, value) => { if (!has(source, value)) problems.push(label); };
  const requireRegex = (label, source, pattern) => { if (!pattern.test(source)) problems.push(label); };

  const cssRevision = md5(css);
  const engineRevision = md5(engine);
  const workerRevision = md5(worker);
  const controllerRevision = md5(controller);

  requireText('engine: version 2 client', engine, 'var VERSION = 2;');
  requireText('engine: exact notice revision', engine, `/css/tts-download-notice.css?v=${cssRevision}`);
  requireText('engine: exact Worker revision', engine, `/js/vosk-tts-worker.js?v=${workerRevision}`);
  requireText('engine: persistent Worker name', engine, "new Worker(WORKER_SRC, { name: 'gb-vosk-tts' })");
  requireText('engine: status bridge', engine, "if (type === 'status')");
  requireText('engine: progress bridge', engine, 'gb:vosk-synthesis-progress');
  requireText('engine: transferable WAV playback', engine, "new Blob([message.wav], { type: 'audio/wav' })");
  requireText('engine: terminal load cancellation message', engine, "state.worker.postMessage({ type: 'cancel-load' })");
  requireText('engine: terminal load cancellation teardown', engine, 'terminateWorker(error);');
  requireText('engine: synchronous notice reveal', engine, "element.classList.add('is-visible');");
  requireText('engine: user opt-out persisted', engine, 'setModelDownloadOptOut(true);');
  requireText('engine: loading copy', engine, 'Улучшенный голос загружается');
  if (/InferenceSession|unzipSync|model-quant\.zip|indexedDB\.open|readerVoskFetch|installOneShotUnzip/.test(engine)) {
    problems.push('engine: heavyweight ownership leaked into document client');
  }
  if (/(?:^|[;\n])\s*window\.fetch\s*=(?!=)/m.test(engine) || /\.unzipSync\s*=\s*function/.test(engine)) {
    problems.push('engine: global interception or monkey patch remains');
  }
  if (!ordered(engine, [
    'function cancelLoading(options)',
    "state.worker.postMessage({ type: 'cancel-load' })",
    'terminateWorker(error);',
    "finishStatus('cancelled');",
  ])) problems.push('engine: cancellation lifecycle order drifted');

  for (const [label, value] of [
    ['worker: dependencies off main thread', 'importScripts(CORE_SRC, STRESS_LOOKUP_SRC, FFLATE_SRC, ORT_SRC);'],
    ['worker: model host', "var MODEL_URL = 'https://huggingface.co/"],
    ['worker: IndexedDB read', 'function idbGet(key)'],
    ['worker: IndexedDB write', 'function idbSet(key, value)'],
    ['worker: cache commit boundary', 'transaction.oncomplete = function ()'],
    ['worker: abortable download', "fetch(MODEL_URL, state.loadController ? { signal: state.loadController.signal } : undefined)"],
    ['worker: SHA verification', "self.crypto.subtle.digest('SHA-256', buffer)"],
    ['worker: archive extraction', 'self.fflate.unzipSync'],
    ['worker: ONNX sessions', 'self.ort.InferenceSession.create'],
    ['worker: manual terms override', 'state.dic.delete(String(word).toLowerCase());'],
    ['worker: model dictionary priority', 'if (state.dic && state.dic.has(lower)) return word;'],
    ['worker: synthesis progress', "post('synth-progress'"],
    ['worker: transferable audio', "post('audio', { id: id, wav: buffer }, [buffer]);"],
    ['worker: load cancellation protocol', "if (message.type === 'cancel-load')"],
  ]) requireText(label, worker, value);
  if (!ordered(worker, [
    'state.sess = sessions[0];',
    'state.bertSess = sessions[1];',
    'state.ready = true;',
    "status('ready');",
  ])) problems.push('worker: ready is published before both ONNX sessions are owned');

  for (const [label, value] of [
    ['canonical: asset registry import', "import { assetUrl } from '../../lib/asset-version';"],
    ['canonical: engine from registry', "const voskEngineSrc = assetUrl('js/vosk-tts-engine.js');"],
    ['canonical: deferred thin client', '<script is:inline defer src={voskEngineSrc}></script>'],
    ['canonical: reader FSM', "import '../../runtime/reader-tts.js';"],
    ['canonical: media session owner', "import '../../runtime/reader-tts-media-session.js';"],
  ]) requireText(label, canonical, value);
  if (/reader-vosk-download-worker|readerVoskFetch|installOneShotUnzip/.test(canonical)) problems.push('canonical: obsolete interception layer remains');

  requireRegex('controller: versioned engine fallback', controller, /VOSK_ENGINE_SRC\s*=\s*['"]\/js\/vosk-tts-engine\.js\?v=[a-f0-9]{8}['"]/);
  requireRegex('controller: versioned notice fallback', controller, /TTS_NOTICE_CSS_SRC\s*=\s*['"]\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}['"]/);
  for (const value of ['gb:vosk-retry-request', 'gb:vosk-switch-request', 'Сейчас системный голос']) {
    requireText(`controller: compatibility protocol ${value}`, controller, value);
  }

  requireRegex('css: notice root does not intercept PLAY', css, /\.gb-tts-download-notice\.is-visible\{[\s\S]{0,180}pointer-events:none/);
  requireRegex('css: explicit action remains interactive', css, /\.gb-tts-download-notice__action\{[\s\S]{0,140}pointer-events:auto/);
  requireRegex('css: mobile controls clearance', css, /@media \(max-width:480px\)[\s\S]{0,300}bottom:max\(92px/);
  requireRegex('css: coarse pointer target', css, /@media \(pointer:coarse\)[\s\S]{0,160}min-height:44px/);
  requireText('css: reduced motion', css, '@media (prefers-reduced-motion:reduce)');

  for (const [asset, revision] of [
    ['css/tts-download-notice.css', cssRevision],
    ['js/vosk-tts-engine.js', engineRevision],
    ['js/vosk-tts-worker.js', workerRevision],
    ['js/floating-cluster-controller.js', controllerRevision],
  ]) requireText(`asset-version: ${asset}`, assetVersions, `'${asset}': '${revision}'`);

  for (const asset of ['css/tts-download-notice.css', 'js/vosk-tts-engine.js', 'js/vosk-tts-worker.js']) {
    requireText(`cache registry: ${asset}`, cacheAssets, `'${asset}'`);
    const lazy = cacheAssets.match(/const LAZY_NO_PRECACHE = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || '';
    requireText(`lazy policy: ${asset}`, lazy, `'${asset}'`);
  }

  const workflowPaths = [
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
    'scripts/release-candidate-lib.mjs',
    'scripts/tts-live-deployment-contract.mjs',
    '.github/workflows/deploy.yml',
    '.github/workflows/tts-download-consent.yml',
    '.github/workflows/tts-reader-polish.yml',
  ];
  for (const value of workflowPaths) {
    const count = countWorkflowPath(workflow, value);
    if (count !== 2) problems.push(`workflow path ownership: ${value} (${count}/2)`);
  }
  for (const [label, value] of [
    ['workflow: status syntax', 'CHECK $file'],
    ['workflow: status execution', 'node scripts/tts-engine-status-contract-test.js'],
    ['workflow: status evidence', 'reports/tts-source-engine-status.log'],
    ['workflow: Chromium and WebKit', 'playwright install --with-deps chromium webkit'],
    ['workflow: deterministic runtime', 'node scripts/tts-reader-runtime-browser-test.js'],
    ['workflow: multi-tab lock', 'node scripts/tts-reader-multitab-lock-browser-test.js'],
    ['workflow: route crawl', 'node scripts/tts-route-crawl-browser-test.js'],
    ['workflow: mobile geometry', 'node scripts/tts-mobile-notice-geometry-browser-test.js'],
  ]) requireText(label, workflow, value);

  requireText('release: Worker is attested', releaseLibrary, "worker: fileRecord(dist, 'js/vosk-tts-worker.js')");
  requireText('release: Worker remains lazy', releaseLibrary, "lazyNoPrecache: ['css/tts-download-notice.css', 'js/vosk-tts-engine.js', 'js/vosk-tts-worker.js']");
  requireText('release: verifier requires Worker lazy policy', releaseLibrary, "assert.deepEqual(tts.lazyNoPrecache, ['css/tts-download-notice.css', 'js/vosk-tts-engine.js', 'js/vosk-tts-worker.js']);");

  for (const [label, value] of [
    ['live: Worker public asset', "worker: 'js/vosk-tts-worker.js'"],
    ['live: Worker expected path', 'workerPath: `/js/vosk-tts-worker.js?v=${md5(deployed.worker)}`'],
    ['live: same-origin Worker CSP', 'worker-src lacks self'],
    ['live: HTML canonical engine projection', 'stale canonical engine projection'],
    ['live: engine points to Worker', 'live Vosk engine references stale Worker'],
    ['live: thin client boundary', 'live thin client contains heavyweight model ownership'],
    ['live: Worker SHA', 'live Vosk Worker SHA-256 mismatch'],
    ['live: Worker model host', 'live Vosk Worker model host drifted'],
    ['live: Worker ONNX', 'live Vosk Worker lacks ONNX ownership'],
  ]) requireText(label, liveContract, value);
  requireText(
    'live: Worker not precached',
    liveContract,
    "assert.equal(swText.includes('/js/vosk-tts-worker.js'), false",
  );

  requireRegex('deploy: generic verification precedes TTS', deployWorkflow, /Verify generic live release contract[\s\S]*Verify live TTS capability extension/);
  requireText('deploy: post-Pages TTS verifier', deployWorkflow, 'release-tools/tts-live-deployment-contract.mjs');
  requireText('deploy: live TTS evidence', deployWorkflow, 'reports/tts-live-deployment-contract.json');

  requireText('dist: imports canonical lazy policy', distAudit, "const { ASSETS, LAZY_NO_PRECACHE } = require('./cache-bust-assets');");
  requireText('dist: consumes canonical lazy policy', distAudit, 'const lazyNoPrecache = new Set(LAZY_NO_PRECACHE);');
  if (/const LAZY_NO_PRECACHE = new Set\(\[/.test(distAudit)) problems.push('dist: divergent local lazy list remains');

  return problems;
}

const sources = {
  engine: read('js/vosk-tts-engine.js'),
  worker: read('js/vosk-tts-worker.js'),
  controller: read('js/floating-cluster-controller.js'),
  canonical: read('src/components/reader-platform/ReaderActionsRuntime.astro'),
  css: read('css/tts-download-notice.css'),
  assetVersions: read('src/lib/asset-version.js'),
  cacheAssets: read('scripts/cache-bust-assets.js'),
  workflow: read('.github/workflows/tts-download-consent.yml'),
  releaseLibrary: read('scripts/release-candidate-lib.mjs'),
  liveContract: read('scripts/tts-live-deployment-contract.mjs'),
  deployWorkflow: read('.github/workflows/deploy.yml'),
  distAudit: read('scripts/dist-publication-audit.js'),
};

const baseline = validate(sources);
assert.deepEqual(baseline, [], baseline.join('\n'));

const mutations = [
  ['ONNX leaked into client', { engine: `${sources.engine}\nort.InferenceSession.create(new ArrayBuffer(0));` }],
  ['global fetch intercepted', { engine: `${sources.engine}\nwindow.fetch = function () {};` }],
  ['Worker ONNX removed', { worker: sources.worker.replaceAll('InferenceSession.create', 'InferenceSession.missing') }],
  ['ready published early', { worker: sources.worker.replace('state.ready = true;', "status('ready');\n      state.ready = true;") }],
  ['dictionary priority removed', { worker: sources.worker.replace('if (state.dic && state.dic.has(lower)) return word;', '') }],
  ['manual override removed', { worker: sources.worker.replace('state.dic.delete(String(word).toLowerCase());', 'void word;') }],
  ['cancel teardown removed', { engine: sources.engine.replace('terminateWorker(error);', 'void error;') }],
  ['canonical registry removed', { canonical: sources.canonical.replace("assetUrl('js/vosk-tts-engine.js')", "'/js/vosk-tts-engine.js'") }],
  ['notice intercepts PLAY', { css: sources.css.replace('pointer-events:none;\n  transform:translate(-50%,0)', 'pointer-events:auto;\n  transform:translate(-50%,0)') }],
  ['Worker workflow trigger removed', { workflow: sources.workflow.replaceAll('      - "js/vosk-tts-worker.js"\n', '') }],
  ['controller workflow trigger removed', { workflow: sources.workflow.replaceAll('      - "js/floating-cluster-controller.js"\n', '') }],
  ['status execution removed', { workflow: sources.workflow.replace('node scripts/tts-engine-status-contract-test.js', 'echo skipped') }],
  ['Worker manifest removed', { releaseLibrary: sources.releaseLibrary.replace("    worker: fileRecord(dist, 'js/vosk-tts-worker.js'),\n", '') }],
  ['Worker lazy policy removed', { releaseLibrary: sources.releaseLibrary.replace(", 'js/vosk-tts-worker.js'", '') }],
  ['Worker live SHA removed', { liveContract: sources.liveContract.replace('live Vosk Worker SHA-256 mismatch', 'Worker unchecked') }],
  ['Worker SW policy removed', { liveContract: sources.liveContract.replace("assert.equal(swText.includes('/js/vosk-tts-worker.js'), false", 'assert.equal(true, false') }],
];

for (const [name, changes] of mutations) {
  const problems = validate({ ...sources, ...changes });
  assert.ok(problems.length > 0, `${name}: mutation must be rejected`);
}

console.log(`TTS persistent Worker architecture contract: PASS (${mutations.length} adversarial mutations rejected).`);
