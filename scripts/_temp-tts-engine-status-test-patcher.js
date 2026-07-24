#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const legacyTarget = path.join(ROOT, 'scripts/tts-download-consent-contract-test.js');
let source = fs.readFileSync(legacyTarget, 'utf8');

function replaceOnceIn(value, pattern, replacement, label) {
  let count = 0;
  const next = value.replace(pattern, (...args) => {
    count += 1;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  if (count !== 1) throw new Error(`${label}: expected one replacement, got ${count}`);
  return next;
}

source = replaceOnceIn(
  source,
  /\['compact action label',\s*\/>Не загружать<\\\/button>\/\]/,
  "['compact action label', /actionLabel = 'Не загружать'/]",
  'dynamic cancel label contract'
);
source = replaceOnceIn(
  source,
  /\['ordinary voice reassurance',\s*\/Обычный голос уже работает\/\]/,
  "['ordinary voice reassurance', /Системный голос уже работает/]",
  'system voice reassurance contract'
);
source = replaceOnceIn(
  source,
  /engine: engine\.replace\('>Не загружать<\/button>', '>Скрыть<\/button>'\)/,
  "engine: engine.replace(\"actionLabel = 'Не загружать'\", \"actionLabel = 'Скрыть'\")",
  'dynamic cancel label mutation'
);
fs.writeFileSync(legacyTarget, source, 'utf8');

const statusTarget = path.join(ROOT, 'scripts/tts-engine-status-contract-test.js');
let statusSource = fs.readFileSync(statusTarget, 'utf8');
statusSource = replaceOnceIn(
  statusSource,
  /controller\.replace\('gb:vosk-retry-request', 'gb:vosk-retry-missing'\)/,
  "controller.replace(/gb:vosk-retry-request/g, 'gb:vosk-retry-missing')",
  'global retry-event mutation'
);
fs.writeFileSync(statusTarget, statusSource, 'utf8');

try { fs.unlinkSync(path.join(ROOT, 'scripts/_temp-tts-engine-status-test-patcher.js')); } catch (_) {}
console.log('Legacy and adversarial TTS contracts reconciled.');
