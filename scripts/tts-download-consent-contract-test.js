#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const revision = (source) => crypto.createHash('md5').update(source).digest('hex').slice(0, 8);

function ordered(source, values) {
  let cursor = -1;
  for (const value of values) {
    cursor = source.indexOf(value, cursor + 1);
    if (cursor < 0) return false;
  }
  return true;
}

function validate(engine, worker, css) {
  const problems = [];
  const requireText = (label, source, value) => { if (!source.includes(value)) problems.push(label); };
  const requireRegex = (label, source, pattern) => { if (!pattern.test(source)) problems.push(label); };

  for (const [label, value] of [
    ['engine: persistent opt-out key', "MODEL_DOWNLOAD_OPTOUT_KEY = 'gbx-vosk-warmup'"],
    ['engine: persistent refusal recorded', 'setModelDownloadOptOut(true);'],
    ['engine: per-document client id', 'var CLIENT_ID ='],
    ['engine: SharedWorker preferred', "new SharedWorker(WORKER_SRC, 'gb-vosk-tts')"],
    ['engine: Dedicated Worker fallback', "new Worker(WORKER_SRC, { name: 'gb-vosk-tts' })"],
    ['engine: worker mode exposed', 'workerMode: state.workerMode'],
    ['engine: SharedWorker heartbeat', "type: 'ping', clientId: CLIENT_ID"],
    ['engine: addressed protocol', 'message.clientId = CLIENT_ID;'],
    ['engine: terminal load cancellation', "send({ type: 'cancel-load' });"],
    ['engine: terminal local teardown', 'terminateWorker(error);'],
    ['engine: compact refusal action', "actionLabel = 'Не загружать'"],
    ['engine: ordinary voice reassurance', 'Системный голос уже работает'],
    ['engine: user cancellation distinguished', 'userCancelled: true'],
    ['engine: status lifecycle event', 'gb:vosk-status'],
  ]) requireText(label, engine, value);

  if (!ordered(engine, [
    "new SharedWorker(WORKER_SRC, 'gb-vosk-tts')",
    "new Worker(WORKER_SRC, { name: 'gb-vosk-tts' })",
  ])) problems.push('engine: SharedWorker is not attempted before Dedicated Worker');
  if (!ordered(engine, [
    'function cancelLoading(options)',
    "send({ type: 'cancel-load' });",
    'terminateWorker(error);',
    "finishStatus('cancelled');",
  ])) problems.push('engine: cancellation order drifted');
  requireRegex('engine: opt-out checked before worker start', engine, /if\s*\(modelDownloadOptedOut\(\)\)[\s\S]{0,300}Promise\.reject\(createCancelledError/);

  for (const [label, value] of [
    ['worker: shared scope support', "var IS_SHARED_SCOPE = 'onconnect' in self;"],
    ['worker: MessagePort registry', 'var clients = new Map();'],
    ['worker: stale-client TTL', 'var CLIENT_TTL_MS = 120000;'],
    ['worker: stale-client pruning', 'function pruneClients()'],
    ['worker: MessagePort attach', 'function attachPort(port)'],
    ['worker: addressed send', 'function send(port, type, detail, transfer)'],
    ['worker: unique cross-client job key', 'function messageJobKey(port, message)'],
    ['worker: load-client ownership', 'loadClients: new Set()'],
    ['worker: serialized ONNX synthesis', 'synthQueue: Promise.resolve()'],
    ['worker: SharedWorker connect listener', 'self.onconnect = function (event)'],
    ['worker: Dedicated Worker adapter', 'var dedicatedPort ='],
    ['worker: abort controller', 'new AbortController()'],
    ['worker: abortable model request', "fetch(MODEL_URL, state.loadController ? { signal: state.loadController.signal } : undefined)"],
    ['worker: integrity verification', "self.crypto.subtle.digest('SHA-256', buffer)"],
    ['worker: archive extraction', 'self.fflate.unzipSync'],
    ['worker: IndexedDB cache read', 'function idbGet(key)'],
    ['worker: IndexedDB cache write', 'function idbSet(key, value)'],
    ['worker: ONNX sessions', 'self.ort.InferenceSession.create'],
    ['worker: addressed transferable WAV', "send(port, 'audio', { id: id, wav: buffer }, [buffer]);"],
  ]) requireText(label, worker, value);
  if (!ordered(worker, [
    'state.synthQueue = state.synthQueue.catch(function () {})',
    'return synthesize(message, port);',
  ])) problems.push('worker: synthesis is not serialized through the queue');

  if (/InferenceSession|unzipSync|model-quant\.zip|indexedDB\.open|readerVoskFetch|installOneShotUnzip/.test(engine)) {
    problems.push('engine: heavyweight model ownership leaked into document client');
  }
  if (/\b(?:alert|confirm|prompt)\s*\(/.test(engine)) problems.push('engine: blocking browser dialog is forbidden');

  for (const [label, pattern] of [
    ['css: fixed compact card', /\.gb-tts-download-notice\{[\s\S]{0,500}position:fixed/],
    ['css: bounded mobile width', /width:min\(430px,calc\(100vw - 24px\)\)/],
    ['css: informational root non-blocking', /\.gb-tts-download-notice\.is-visible\{[\s\S]{0,180}pointer-events:none/],
    ['css: action clickable', /\.gb-tts-download-notice__action\{[\s\S]{0,140}pointer-events:auto/],
    ['css: dark theme', /html\.dark \.gb-tts-download-notice/],
    ['css: coarse target', /@media \(pointer:coarse\)[\s\S]{0,160}min-height:44px/],
    ['css: mobile controls clearance', /@media \(max-width:480px\)[\s\S]{0,300}bottom:max\(92px/],
    ['css: reduced motion', /@media \(prefers-reduced-motion:reduce\)/],
    ['css: keyboard focus', /\.gb-tts-download-notice__action:focus-visible/],
  ]) requireRegex(label, css, pattern);

  const cssMatch = engine.match(/NOTICE_CSS_URL\s*=\s*['"][^'"]+\?v=([a-f0-9]{8})['"]/);
  if (!cssMatch || cssMatch[1] !== revision(css)) problems.push(`engine: stylesheet revision drift (${cssMatch?.[1] || 'missing'} != ${revision(css)})`);
  const workerMatch = engine.match(/WORKER_SRC\s*=\s*['"][^'"]+\?v=([a-f0-9]{8})['"]/);
  if (!workerMatch || workerMatch[1] !== revision(worker)) problems.push(`engine: Worker revision drift (${workerMatch?.[1] || 'missing'} != ${revision(worker)})`);

  return problems;
}

const sources = {
  engine: read('js/vosk-tts-engine.js'),
  worker: read('js/vosk-tts-worker.js'),
  css: read('css/tts-download-notice.css'),
};
assert.deepEqual(validate(sources.engine, sources.worker, sources.css), [], 'baseline SharedWorker consent contract must pass');

const mutations = [
  ['SharedWorker preference removed', { engine: sources.engine.replace("new SharedWorker(WORKER_SRC, 'gb-vosk-tts')", 'null') }],
  ['Dedicated fallback removed', { engine: sources.engine.replace("new Worker(WORKER_SRC, { name: 'gb-vosk-tts' })", 'null') }],
  ['client id removed', { engine: sources.engine.replace('message.clientId = CLIENT_ID;', '') }],
  ['heartbeat removed', { engine: sources.engine.replace("type: 'ping', clientId: CLIENT_ID", "type: 'noop'") }],
  ['stale-client pruning removed', { worker: sources.worker.replace('function pruneClients()', 'function missingPruneClients()') }],
  ['worker job isolation removed', { worker: sources.worker.replace('function messageJobKey(port, message)', 'function missingJobKey(port, message)') }],
  ['synthesis queue removed', { worker: sources.worker.replace('synthQueue: Promise.resolve()', 'synthQueue: null') }],
  ['worker network request loses AbortSignal', { worker: sources.worker.replace('{ signal: state.loadController.signal }', '{}') }],
  ['persistent refusal removed', { engine: sources.engine.replace('setModelDownloadOptOut(true)', 'void 0') }],
  ['cancel stops being terminal', { engine: sources.engine.replace(/(function cancelLoading\(options\)[\s\S]{0,800}?)terminateWorker\(error\);/, '$1void error;') }],
  ['ONNX returns to document client', { engine: `${sources.engine}\nort.InferenceSession.create(new ArrayBuffer(0));` }],
  ['notice intercepts PLAY', { css: sources.css.replace('pointer-events:none;\n  transform:translate(-50%,0)', 'pointer-events:auto;\n  transform:translate(-50%,0)') }],
  ['stylesheet revision drifts', { engine: sources.engine.replace(/(NOTICE_CSS_URL\s*=\s*['"][^'"]+\?v=)[a-f0-9]{8}/, '$100000000') }],
  ['Worker revision drifts', { engine: sources.engine.replace(/(WORKER_SRC\s*=\s*['"][^'"]+\?v=)[a-f0-9]{8}/, '$100000000') }],
];

for (const [name, changes] of mutations) {
  const problems = validate(changes.engine || sources.engine, changes.worker || sources.worker, changes.css || sources.css);
  assert.ok(problems.length > 0, `${name}: mutation must be rejected`);
}

console.log(`TTS SharedWorker-first consent contract: PASS (${mutations.length} adversarial mutations rejected).`);
