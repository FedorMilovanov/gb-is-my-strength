#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATUS_PATH = path.join(ROOT, 'js', 'tts-engine-status.mjs');
const HEAD_PATH = path.join(ROOT, 'src', 'components', 'reader-platform', 'ReaderPreferencesHead.astro');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function validate(status, head) {
  const problems = [];
  const requiredStatus = [
    ['single global guard', /if \(window\.GBTtsEngineStatus\) return/],
    ['persistent opt-out key', /OPT_OUT_KEY\s*=\s*['"]gbx-vosk-warmup['"]/],
    ['opt-out recovery', /localStorage\.removeItem\(OPT_OUT_KEY\)/],
    ['save-data explanation', /Автозагрузка выключена режимом экономии трафика/],
    ['browser engine disclosure', /Браузерная озвучка включена/],
    ['enhanced engine disclosure', /Улучшенный голос включён/],
    ['manual retry', /function retryEnhanced\(\)/],
    ['script-load retry', /function loadEngineScript\(\)/],
    ['model-start lifecycle', /gb:vosk-model-download-start/],
    ['model-error lifecycle', /gb:vosk-model-download-error/],
    ['resource-load failure', /target instanceof HTMLScriptElement/],
    ['readiness polling', /function watchReadiness\(\)/],
    ['touch target', /@media\(pointer:coarse\)[\s\S]{0,180}min-height:44px/],
    ['mobile layout', /@media\(max-width:600px\)/],
    ['dark theme', /html\.dark #\$\{CARD_ID\}/],
    ['reduced motion', /@media\(prefers-reduced-motion:reduce\)/],
    ['polite live region', /aria-live['"], ['"]polite/],
    ['public diagnostic API', /window\.GBTtsEngineStatus = Object\.freeze/],
  ];
  for (const [label, pattern] of requiredStatus) {
    if (!pattern.test(status)) problems.push(`status: ${label}`);
  }

  if (/\b(?:alert|confirm|prompt)\s*\(/.test(status)) {
    problems.push('status: blocking browser dialog is forbidden');
  }
  if (/https?:\/\//.test(status)) {
    problems.push('status: external network URL is forbidden');
  }

  const reference = head.match(/tts-engine-status\.mjs\?v=([a-f0-9]{8})/);
  if (!reference) {
    problems.push('head: versioned TTS status module missing');
  } else {
    const actual = crypto.createHash('md5').update(status).digest('hex').slice(0, 8);
    if (reference[1] !== actual) problems.push(`head: status revision ${reference[1]} != ${actual}`);
  }
  if (!/<script[^>]+type="module"[^>]+src=\{ttsStatusSrc\}/.test(head)) {
    problems.push('head: deferred module script contract missing');
  }

  return problems;
}

const status = read(STATUS_PATH);
const head = read(HEAD_PATH);
assert.deepEqual(validate(status, head), [], 'baseline TTS engine status contract must pass');

const mutations = [
  {
    name: 'opt-out recovery removed',
    status: status.replace('localStorage.removeItem(OPT_OUT_KEY)', 'void 0'),
    head,
  },
  {
    name: 'browser engine disclosure removed',
    status: status.replaceAll('Браузерная озвучка включена', 'Озвучка'),
    head,
  },
  {
    name: 'touch target shrinks',
    status: status.replace('min-height:44px', 'min-height:30px'),
    head,
  },
  {
    name: 'status asset revision drifts',
    status,
    head: head.replace(/tts-engine-status\.mjs\?v=[a-f0-9]{8}/, 'tts-engine-status.mjs?v=00000000'),
  },
  {
    name: 'resource failure observer removed',
    status: status.replace('target instanceof HTMLScriptElement', 'false'),
    head,
  },
];

for (const mutation of mutations) {
  assert.ok(validate(mutation.status, mutation.head).length > 0, `${mutation.name}: mutation must be rejected`);
}

console.log(`TTS engine status contract: PASS (${mutations.length} adversarial mutations rejected).`);
