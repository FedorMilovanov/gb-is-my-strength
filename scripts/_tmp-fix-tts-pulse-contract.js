#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cssPath = path.join(root, 'css/tts-download-notice.css');
const enginePath = path.join(root, 'js/vosk-tts-engine.js');
const contractPath = path.join(root, 'scripts/tts-download-consent-contract-test.js');

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first === -1) throw new Error(`Missing anchor: ${label}`);
  if (source.indexOf(needle, first + needle.length) !== -1) {
    throw new Error(`Non-unique anchor: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

let css = fs.readFileSync(cssPath, 'utf8');
css = replaceOnce(
  css,
  'animation:wb-tts-download-pulse 1.8s ease-out infinite;',
  'animation:gb-tts-download-pulse 1.8s ease-out infinite;',
  'pulse animation name'
);
fs.writeFileSync(cssPath, css, 'utf8');

const revision = crypto.createHash('md5').update(css).digest('hex').slice(0, 8);
let engine = fs.readFileSync(enginePath, 'utf8');
const revisionPattern = /\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}/;
if (!revisionPattern.test(engine)) throw new Error('Versioned TTS notice stylesheet URL is missing');
engine = engine.replace(revisionPattern, `/css/tts-download-notice.css?v=${revision}`);
fs.writeFileSync(enginePath, engine, 'utf8');

let contract = fs.readFileSync(contractPath, 'utf8');
contract = replaceOnce(
  contract,
  "    ['keyboard focus', /\\.gb-tts-download-notice__action:focus-visible/],\n",
  "    ['keyboard focus', /\\.gb-tts-download-notice__action:focus-visible/],\n    ['loading pulse animation wired', /\\.gb-tts-download-notice__icon::before\\{[\\s\\S]{0,320}animation:gb-tts-download-pulse[\\s\\S]*?@keyframes gb-tts-download-pulse\\{/],\n",
  'pulse CSS requirement'
);
contract = replaceOnce(
  contract,
  "  {\n    name: 'stylesheet revision drifts',\n    engine: engine.replace(/\\?v=[a-f0-9]{8}/, '?v=00000000'),\n    css,\n  },\n];",
  "  {\n    name: 'stylesheet revision drifts',\n    engine: engine.replace(/\\?v=[a-f0-9]{8}/, '?v=00000000'),\n    css,\n  },\n  {\n    name: 'loading pulse keyframe disconnects',\n    engine,\n    css: css.replace('animation:gb-tts-download-pulse', 'animation:missing-tts-download-pulse'),\n  },\n];",
  'pulse mutation'
);
fs.writeFileSync(contractPath, contract, 'utf8');

fs.unlinkSync(__filename);
console.log(`Fixed TTS loading pulse and synchronized stylesheet revision ${revision}.`);
