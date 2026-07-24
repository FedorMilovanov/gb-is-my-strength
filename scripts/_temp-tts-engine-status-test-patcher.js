#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const target = path.join(ROOT, 'scripts/tts-download-consent-contract-test.js');
let source = fs.readFileSync(target, 'utf8');

function replaceOnce(pattern, replacement, label) {
  let count = 0;
  source = source.replace(pattern, (...args) => {
    count += 1;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  if (count !== 1) throw new Error(`${label}: expected one replacement, got ${count}`);
}

replaceOnce(
  /\['compact action label',\s*\/>Не загружать<\\\/button>\/\]/,
  "['compact action label', /actionLabel = 'Не загружать'/]",
  'dynamic cancel label contract'
);
replaceOnce(
  /engine: engine\.replace\('>Не загружать<\/button>', '>Скрыть<\/button>'\)/,
  "engine: engine.replace(\"actionLabel = 'Не загружать'\", \"actionLabel = 'Скрыть'\")",
  'dynamic cancel label mutation'
);

fs.writeFileSync(target, source, 'utf8');
try { fs.unlinkSync(path.join(ROOT, 'scripts/_temp-tts-engine-status-test-patcher.js')); } catch (_) {}
console.log('Legacy TTS consent contract reconciled.');
