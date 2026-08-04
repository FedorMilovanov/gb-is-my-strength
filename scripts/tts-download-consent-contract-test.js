#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ENGINE_PATH = path.join(ROOT, 'js/vosk-tts-engine.js');
const WORKER_PATH = path.join(ROOT, 'js/vosk-tts-worker.js');
const CSS_PATH = path.join(ROOT, 'css/tts-download-notice.css');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function gitBlobRevision(content) {
  const prefix = Buffer.from(`blob ${Buffer.byteLength(content)}\0`);
  return crypto.createHash('sha1').update(prefix).update(content).digest('hex').slice(0, 8);
}

function validate(engine, worker, css) {
  const problems = [];
  const requireEngine = [
    ['persistent opt-out key', /MODEL_DOWNLOAD_OPTOUT_KEY\s*=\s*['"]gbx-vosk-warmup['"]/],
    ['opt-out checked before worker start', /if\s*\(modelDownloadOptedOut\(\)\)[\s\S]{0,300}Promise\.reject\(createCancelledError/],
    ['same-origin persistent worker', /new Worker\(WORKER_SRC,\s*\{\s*name:\s*['"]gb-vosk-tts['"]\s*\}\)/],
    ['worker cancellation message', /postMessage\(\{\s*type:\s*['"]cancel-load['"]\s*\}\)/],
    ['cancel terminates worker', /function cancelLoading\(options\)[\s\S]{0,700}terminateWorker\(error\)/],
    ['cancel persisted', /setModelDownloadOptOut\(true\)/],
    ['cancel exported', /cancelLoading:\s*cancelLoading/],
    ['compact action label', /actionLabel = ['"]Не загружать['"]/],
    ['ordinary voice reassurance', /Системный голос уже работает/],
    ['user cancellation distinguished', /userCancelled:\s*true/],
    ['status lifecycle event', /gb:vosk-status/],
  ];
  for (const [label, pattern] of requireEngine) {
    if (!pattern.test(engine)) problems.push(`engine: ${label}`);
  }

  const requireWorker = [
    ['abort controller lives in worker', /new AbortController\(\)/],
    ['network signal lives in worker', /fetch\(MODEL_URL,\s*state\.loadController\s*\?\s*\{\s*signal:\s*state\.loadController\.signal\s*\}/],
    ['integrity verification', /EXPECTED_MODEL_SHA256[\s\S]*crypto\.subtle\.digest\(['"]SHA-256['"]/],
    ['archive extraction', /fflate\.unzipSync/],
    ['indexeddb cache read', /function idbGet\(/],
    ['indexeddb cache write', /function idbSet\(/],
    ['onnx sessions', /InferenceSession\.create/],
    ['transferable audio result', /post\(['"]audio['"][\s\S]{0,180}\[buffer\]\)/],
  ];
  for (const [label, pattern] of requireWorker) {
    if (!pattern.test(worker)) problems.push(`worker: ${label}`);
  }

  if (/InferenceSession|unzipSync|model-quant\.zip|readerVoskFetch|installOneShotUnzip/.test(engine)) {
    problems.push('engine: heavyweight model work or interception leaked into document client');
  }
  if (/\b(?:alert|confirm|prompt)\s*\(/.test(engine)) {
    problems.push('engine: blocking browser dialog is forbidden');
  }

  const requireCss = [
    ['fixed compact card', /\.gb-tts-download-notice\{[\s\S]{0,500}position:fixed/],
    ['bounded mobile width', /width:min\(430px,calc\(100vw - 24px\)\)/],
    ['informational root is non-blocking', /\.gb-tts-download-notice\.is-visible\{[\s\S]{0,160}pointer-events:none/],
    ['action remains clickable', /\.gb-tts-download-notice__action\{[\s\S]{0,100}pointer-events:auto/],
    ['dark theme', /html\.dark \.gb-tts-download-notice/],
    ['coarse pointer target', /@media \(pointer:coarse\)[\s\S]{0,120}min-height:44px/],
    ['mobile controls clearance', /@media \(max-width:480px\)[\s\S]{0,220}bottom:max\(92px/],
    ['reduced motion', /@media \(prefers-reduced-motion:reduce\)/],
    ['keyboard focus', /\.gb-tts-download-notice__action:focus-visible/],
  ];
  for (const [label, pattern] of requireCss) {
    if (!pattern.test(css)) problems.push(`css: ${label}`);
  }

  const match = engine.match(/NOTICE_CSS_URL\s*=\s*['"][^'"]+\?v=([a-f0-9]{8})['"]/);
  if (!match) {
    problems.push('engine: versioned notice stylesheet URL missing');
  } else {
    const actual = gitBlobRevision(css);
    if (match[1] !== actual) problems.push(`engine: stylesheet revision ${match[1]} != ${actual}`);
  }

  return problems;
}

const engine = read(ENGINE_PATH);
const worker = read(WORKER_PATH);
const css = read(CSS_PATH);
assert.deepEqual(validate(engine, worker, css), [], 'baseline persistent-worker consent contract must pass');

const mutations = [
  {
    name: 'worker network request loses AbortSignal',
    engine,
    worker: worker.replace('{ signal: state.loadController.signal }', '{}'),
    css,
  },
  {
    name: 'persistent refusal is removed',
    engine: engine.replace('setModelDownloadOptOut(true)', 'void 0'),
    worker,
    css,
  },
  {
    name: 'cancel stops being terminal',
    engine: engine.replace('terminateWorker(error)', 'void 0'),
    worker,
    css,
  },
  {
    name: 'onnx returns to document client',
    engine: `${engine}\nort.InferenceSession.create(new ArrayBuffer(0));`,
    worker,
    css,
  },
  {
    name: 'mobile notice intercepts PLAY',
    engine,
    worker,
    css: css.replace('pointer-events:none;\n  transform:translate(-50%,0)', 'pointer-events:auto;\n  transform:translate(-50%,0)'),
  },
  {
    name: 'mobile controls clearance is removed',
    engine,
    worker,
    css: css.replace('bottom:max(92px,calc(env(safe-area-inset-bottom,0px) + 84px));', 'bottom:0;'),
  },
  {
    name: 'stylesheet revision drifts',
    engine: engine.replace(/\?v=[a-f0-9]{8}/, '?v=00000000'),
    worker,
    css,
  },
];

for (const mutation of mutations) {
  const problems = validate(mutation.engine, mutation.worker, mutation.css);
  assert.ok(problems.length > 0, `${mutation.name}: mutation must be rejected`);
}

console.log(`TTS persistent-worker consent contract: PASS (${mutations.length} adversarial mutations rejected).`);
