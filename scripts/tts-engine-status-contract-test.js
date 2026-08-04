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

function ordered(source, values) {
  let cursor = -1;
  for (const value of values) {
    cursor = source.indexOf(value, cursor + 1);
    if (cursor < 0) return false;
  }
  return true;
}

function countWorkflowPath(workflow, value) {
  return (workflow.match(new RegExp(`^      - "${escapeRegExp(value)}"$`, 'gm')) || []).length;
}

function validate(input) {
  const {
    engine, worker, controller, canonical, css, assetVersions, cacheAssets,
    workflow, readerWorkflow, releaseLibrary, liveContract, deployWorkflow, distAudit,
  } = input;
  const problems = [];
  const requireText = (label, source, value) => { if (!source.includes(value)) problems.push(label); };
  const requireRegex = (label, source, pattern) => { if (!pattern.test(source)) problems.push(label); };
  const cssRevision = md5(css);
  const engineRevision = md5(engine);
  const workerRevision = md5(worker);
  const controllerRevision = md5(controller);

  for (const [label, value] of [
    ['engine: version 2', 'var VERSION = 2;'],
    ['engine: exact CSS revision', `/css/tts-download-notice.css?v=${cssRevision}`],
    ['engine: exact Worker revision', `/js/vosk-tts-worker.js?v=${workerRevision}`],
    ['engine: SharedWorker preferred', "new SharedWorker(WORKER_SRC, 'gb-vosk-tts')"],
    ['engine: Dedicated fallback', "new Worker(WORKER_SRC, { name: 'gb-vosk-tts' })"],
    ['engine: addressed client id', 'message.clientId = CLIENT_ID;'],
    ['engine: mode exposed', 'workerMode: state.workerMode'],
    ['engine: SharedWorker heartbeat', "type: 'ping', clientId: CLIENT_ID"],
    ['engine: status bridge', "if (type === 'status')"],
    ['engine: progress bridge', 'gb:vosk-synthesis-progress'],
    ['engine: transferable WAV playback', "new Blob([message.wav], { type: 'audio/wav' })"],
    ['engine: terminal cancellation message', "send({ type: 'cancel-load' });"],
    ['engine: terminal cancellation teardown', 'terminateWorker(error);'],
    ['engine: synchronous notice', "element.classList.add('is-visible');"],
    ['engine: persisted opt-out', 'setModelDownloadOptOut(true);'],
  ]) requireText(label, engine, value);
  if (!ordered(engine, ["new SharedWorker(WORKER_SRC, 'gb-vosk-tts')", "new Worker(WORKER_SRC, { name: 'gb-vosk-tts' })"])) {
    problems.push('engine: SharedWorker preference order drifted');
  }
  if (!ordered(engine, ['function cancelLoading(options)', "send({ type: 'cancel-load' });", 'terminateWorker(error);', "finishStatus('cancelled');"])) {
    problems.push('engine: cancellation lifecycle order drifted');
  }
  if (/InferenceSession|unzipSync|model-quant\.zip|indexedDB\.open|readerVoskFetch|installOneShotUnzip/.test(engine)) {
    problems.push('engine: heavyweight ownership leaked into document');
  }
  if (/(?:^|[;\n])\s*window\.fetch\s*=(?!=)/m.test(engine) || /\.unzipSync\s*=\s*function/.test(engine)) {
    problems.push('engine: interception or monkey patch remains');
  }

  for (const [label, value] of [
    ['worker: dependencies off main thread', 'importScripts(CORE_SRC, STRESS_LOOKUP_SRC, FFLATE_SRC, ORT_SRC);'],
    ['worker: pinned ORT path', 'self.ort.env.wasm.wasmPaths = ORT_DIST;'],
    ['worker: SharedWorker scope', "var IS_SHARED_SCOPE = 'onconnect' in self;"],
    ['worker: MessagePort registry', 'var clients = new Map();'],
    ['worker: stale-client TTL', 'var CLIENT_TTL_MS = 120000;'],
    ['worker: stale-client pruning', 'function pruneClients()'],
    ['worker: MessagePort attach', 'function attachPort(port)'],
    ['worker: addressed delivery', 'function send(port, type, detail, transfer)'],
    ['worker: cross-client job isolation', 'function messageJobKey(port, message)'],
    ['worker: load ownership', 'loadClients: new Set()'],
    ['worker: synthesis queue', 'synthQueue: Promise.resolve()'],
    ['worker: shared connect', 'self.onconnect = function (event)'],
    ['worker: dedicated adapter', 'var dedicatedPort ='],
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
    ['worker: addressed synthesis progress', "send(port, 'synth-progress'"],
    ['worker: addressed transferable audio', "send(port, 'audio', { id: id, wav: buffer }, [buffer]);"],
  ]) requireText(label, worker, value);
  if (!ordered(worker, ['state.sess = sessions[0];', 'state.bertSess = sessions[1];', 'state.ready = true;', "status('ready');"])) {
    problems.push('worker: ready published before ONNX sessions');
  }
  if (!ordered(worker, ['state.synthQueue = state.synthQueue.catch(function () {})', 'return synthesize(message, port);'])) {
    problems.push('worker: ONNX inference is not serialized');
  }

  for (const [label, value] of [
    ['canonical: asset registry', "import { assetUrl } from '../../lib/asset-version';"],
    ['canonical: engine from registry', "const voskEngineSrc = assetUrl('js/vosk-tts-engine.js');"],
    ['canonical: deferred engine', '<script is:inline defer src={voskEngineSrc}></script>'],
    ['canonical: reader FSM', "import '../../runtime/reader-tts.js';"],
    ['canonical: media session', "import '../../runtime/reader-tts-media-session.js';"],
  ]) requireText(label, canonical, value);

  requireRegex('controller: versioned engine fallback', controller, /VOSK_ENGINE_SRC\s*=\s*['"]\/js\/vosk-tts-engine\.js\?v=[a-f0-9]{8}['"]/);
  requireRegex('controller: versioned notice fallback', controller, /TTS_NOTICE_CSS_SRC\s*=\s*['"]\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}['"]/);
  for (const value of ['gb:vosk-retry-request', 'gb:vosk-switch-request', 'Сейчас системный голос']) requireText(`controller: ${value}`, controller, value);

  requireRegex('css: non-blocking notice', css, /\.gb-tts-download-notice\.is-visible\{[\s\S]{0,180}pointer-events:none/);
  requireRegex('css: action interactive', css, /\.gb-tts-download-notice__action\{[\s\S]{0,140}pointer-events:auto/);
  requireRegex('css: mobile clearance', css, /@media \(max-width:480px\)[\s\S]{0,300}bottom:max\(92px/);
  requireText('css: reduced motion', css, '@media (prefers-reduced-motion:reduce)');

  for (const [asset, rev] of [
    ['css/tts-download-notice.css', cssRevision],
    ['js/vosk-tts-engine.js', engineRevision],
    ['js/vosk-tts-worker.js', workerRevision],
    ['js/floating-cluster-controller.js', controllerRevision],
  ]) requireText(`asset-version: ${asset}`, assetVersions, `'${asset}': '${rev}'`);

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
    'js/vosk-tts-engine.js', 'js/vosk-tts-worker.js', 'js/vosk-tts-core.js',
    'js/vosk-stress-lookup.js', 'js/vosk-custom-terms.json', 'js/vosk-stress-marker.bin',
    'js/floating-cluster-controller.js', 'css/tts-download-notice.css',
    'scripts/cache-bust-assets.js', 'src/lib/asset-version.js',
    'scripts/tts-download-consent-contract-test.js', 'scripts/tts-engine-status-contract-test.js',
    'scripts/tts-stress-dictionary-contract.js', 'scripts/tts-reader-runtime-browser-test.js',
    'scripts/tts-reader-multitab-lock-browser-test.js', 'scripts/tts-reader-real-model-browser-test.js',
    'scripts/tts-route-crawl-browser-test.js',
    'scripts/tts-mobile-notice-geometry-browser-test.js', 'scripts/release-candidate-lib.mjs',
    'scripts/tts-live-deployment-contract.mjs', '.github/workflows/deploy.yml',
    '.github/workflows/tts-download-consent.yml', '.github/workflows/tts-reader-polish.yml',
  ];
  for (const value of workflowPaths) {
    const count = countWorkflowPath(workflow, value);
    if (count !== 2) problems.push(`consent workflow path: ${value} (${count}/2)`);
  }
  for (const [label, value] of [
    ['workflow: source contract', 'node scripts/tts-engine-status-contract-test.js'],
    ['workflow: SharedWorker fixture', 'node scripts/tts-reader-multitab-lock-browser-test.js'],
    ['workflow: route crawl', 'node scripts/tts-route-crawl-browser-test.js'],
    ['reader workflow: real SharedWorker', 'node scripts/tts-reader-real-model-browser-test.js'],
  ]) requireText(label, label.startsWith('reader workflow') ? readerWorkflow : workflow, value);

  requireText('release: Worker attested', releaseLibrary, "worker: fileRecord(dist, 'js/vosk-tts-worker.js')");
  requireText('release: Worker lazy', releaseLibrary, "lazyNoPrecache: ['css/tts-download-notice.css', 'js/vosk-tts-engine.js', 'js/vosk-tts-worker.js']");
  for (const value of [
    "worker: 'js/vosk-tts-worker.js'", 'workerPath: `/js/vosk-tts-worker.js?v=${md5(deployed.worker)}`',
    'worker-src lacks self', 'live Vosk engine references stale Worker',
    'live Vosk Worker SHA-256 mismatch', 'live Vosk Worker model host drifted', 'live Vosk Worker lacks ONNX ownership',
  ]) requireText(`live: ${value}`, liveContract, value);
  requireText('live: Worker not precached', liveContract, "assert.equal(swText.includes('/js/vosk-tts-worker.js'), false");
  requireRegex('deploy: live order', deployWorkflow, /Verify generic live release contract[\s\S]*Verify live TTS capability extension/);
  requireText('dist: canonical lazy policy', distAudit, "const { ASSETS, LAZY_NO_PRECACHE } = require('./cache-bust-assets');");

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
  readerWorkflow: read('.github/workflows/tts-reader-polish.yml'),
  releaseLibrary: read('scripts/release-candidate-lib.mjs'),
  liveContract: read('scripts/tts-live-deployment-contract.mjs'),
  deployWorkflow: read('.github/workflows/deploy.yml'),
  distAudit: read('scripts/dist-publication-audit.js'),
};

const baseline = validate(sources);
assert.deepEqual(baseline, [], baseline.join('\n'));

const mutations = [
  ['ONNX leaked into client', { engine: `${sources.engine}\nort.InferenceSession.create(new ArrayBuffer(0));` }],
  ['SharedWorker removed', { engine: sources.engine.replace("new SharedWorker(WORKER_SRC, 'gb-vosk-tts')", 'null') }],
  ['Dedicated fallback removed', { engine: sources.engine.replace("new Worker(WORKER_SRC, { name: 'gb-vosk-tts' })", 'null') }],
  ['client id removed', { engine: sources.engine.replace('message.clientId = CLIENT_ID;', '') }],
  ['heartbeat removed', { engine: sources.engine.replace("type: 'ping', clientId: CLIENT_ID", "type: 'noop'") }],
  ['client pruning removed', { worker: sources.worker.replace('function pruneClients()', 'function missingPruneClients()') }],
  ['job isolation removed', { worker: sources.worker.replace('function messageJobKey(port, message)', 'function missingJobKey(port, message)') }],
  ['queue removed', { worker: sources.worker.replace('synthQueue: Promise.resolve()', 'synthQueue: null') }],
  ['ready early', { worker: sources.worker.replace('state.ready = true;', "status('ready');\n      state.ready = true;") }],
  ['dictionary priority removed', { worker: sources.worker.replace('if (state.dic && state.dic.has(lower)) return word;', '') }],
  ['manual override removed', { worker: sources.worker.replace('state.dic.delete(String(word).toLowerCase());', 'void word;') }],
  ['cancel teardown removed', { engine: sources.engine.replace('terminateWorker(error);', 'void error;') }],
  ['multitab test trigger removed', { workflow: sources.workflow.replaceAll('      - "scripts/tts-reader-multitab-lock-browser-test.js"\n', '') }],
  ['real model execution removed', { readerWorkflow: sources.readerWorkflow.replace('node scripts/tts-reader-real-model-browser-test.js', 'echo skipped') }],
  ['Worker manifest removed', { releaseLibrary: sources.releaseLibrary.replace("    worker: fileRecord(dist, 'js/vosk-tts-worker.js'),\n", '') }],
  ['Worker live SHA removed', { liveContract: sources.liveContract.replace('live Vosk Worker SHA-256 mismatch', 'Worker unchecked') }],
];

for (const [name, changes] of mutations) {
  const problems = validate({ ...sources, ...changes });
  assert.ok(problems.length > 0, `${name}: mutation must be rejected`);
}

console.log(`TTS SharedWorker architecture contract: PASS (${mutations.length} adversarial mutations rejected).`);
