#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ENGINE_PATH = path.join(ROOT, 'js/vosk-tts-engine.js');
const CSS_PATH = path.join(ROOT, 'css/tts-download-notice.css');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function validate(engine, css) {
  const problems = [];
  const requireEngine = [
    ['persistent opt-out key', /MODEL_DOWNLOAD_OPTOUT_KEY\s*=\s*['"]gbx-vosk-warmup['"]/],
    ['opt-out checked before network', /if\s*\(modelDownloadOptedOut\(\)\)\s*\{[\s\S]{0,240}throw createDownloadCancelledError/],
    ['abort controller', /new AbortController\(\)/],
    ['fetch signal', /fetchOptions[\s\S]{0,180}signal:\s*modelDownloadController\.signal/],
    ['real cancel API', /function cancelLoading\(options\)[\s\S]{0,700}modelDownloadController\.abort\(\)/],
    ['cancel persisted', /localStorage\.setItem\(MODEL_DOWNLOAD_OPTOUT_KEY,\s*['"]off['"]\)/],
    ['cancel exported', /cancelLoading:\s*cancelLoading/],
    ['cache-miss notice', /showModelDownloadNotice\(\)/],
    ['legacy toast suppressed', /function suppressLegacyDownloadToast\(\)/],
    ['compact action label', /actionLabel = 'Не загружать'/],
    ['ordinary voice reassurance', /Системный голос уже работает/],
    ['success lifecycle', /gb:vosk-model-download-complete/],
    ['cancel lifecycle', /gb:vosk-model-download-cancelled/],
    ['error lifecycle', /gb:vosk-model-download-error/],
    ['user cancellation distinguished', /userCancelled\s*=\s*true/],
  ];
  for (const [label, pattern] of requireEngine) {
    if (!pattern.test(engine)) problems.push(`engine: ${label}`);
  }

  const requireCss = [
    ['fixed compact card', /\.gb-tts-download-notice\{[\s\S]{0,500}position:fixed/],
    ['bounded mobile width', /width:min\(430px,calc\(100vw - 24px\)\)/],
    ['visible state', /\.gb-tts-download-notice\.is-visible/],
    ['dark theme', /html\.dark \.gb-tts-download-notice/],
    ['coarse pointer target', /@media \(pointer:coarse\)[\s\S]{0,120}min-height:44px/],
    ['mobile layout', /@media \(max-width:480px\)/],
    ['reduced motion', /@media \(prefers-reduced-motion:reduce\)/],
    ['keyboard focus', /\.gb-tts-download-notice__action:focus-visible/],
    ['loading pulse animation wired', /\.gb-tts-download-notice__icon::before\{[\s\S]{0,320}animation:gb-tts-download-pulse[\s\S]*?@keyframes gb-tts-download-pulse\{/],
  ];
  for (const [label, pattern] of requireCss) {
    if (!pattern.test(css)) problems.push(`css: ${label}`);
  }

  if (/\b(?:alert|confirm|prompt)\s*\(/.test(engine)) {
    problems.push('engine: blocking browser dialog is forbidden');
  }

  const match = engine.match(/DOWNLOAD_NOTICE_CSS_URL\s*=\s*['"][^'"]+\?v=([a-f0-9]{8})['"]/);
  if (!match) {
    problems.push('engine: versioned notice stylesheet URL missing');
  } else {
    const actual = crypto.createHash('md5').update(css).digest('hex').slice(0, 8);
    if (match[1] !== actual) {
      problems.push(`engine: stylesheet revision ${match[1]} != ${actual}`);
    }
  }

  return problems;
}

const engine = read(ENGINE_PATH);
const css = read(CSS_PATH);
assert.deepEqual(validate(engine, css), [], 'baseline TTS download consent contract must pass');

const mutations = [
  {
    name: 'network request loses AbortSignal',
    engine: engine.replace('{ signal: modelDownloadController.signal }', '{}'),
    css,
  },
  {
    name: 'persistent refusal is removed',
    engine: engine.replace("localStorage.setItem(MODEL_DOWNLOAD_OPTOUT_KEY, 'off')", "void 0"),
    css,
  },
  {
    name: 'cancel button is removed',
    engine: engine.replace("actionLabel = 'Не загружать'", "actionLabel = 'Скрыть'"),
    css,
  },
  {
    name: 'mobile touch target shrinks',
    engine,
    css: css.replace('min-height:44px', 'min-height:32px'),
  },
  {
    name: 'stylesheet revision drifts',
    engine: engine.replace(/\?v=[a-f0-9]{8}/, '?v=00000000'),
    css,
  },
  {
    name: 'loading pulse keyframe disconnects',
    engine,
    css: css.replace('animation:gb-tts-download-pulse', 'animation:missing-tts-download-pulse'),
  },
];

for (const mutation of mutations) {
  const problems = validate(mutation.engine, mutation.css);
  assert.ok(problems.length > 0, `${mutation.name}: mutation must be rejected`);
}

console.log(`TTS download consent contract: PASS (${mutations.length} adversarial mutations rejected).`);
