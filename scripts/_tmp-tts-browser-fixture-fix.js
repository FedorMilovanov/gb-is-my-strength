#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const testPath = path.join(root, 'scripts/tts-download-notice-browser-test.js');
let source = fs.readFileSync(testPath, 'utf8');
const anchor = '<meta charset="utf-8"><title>TTS notice fixture</title>';
const replacement = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TTS notice fixture</title>';

if (!source.includes(replacement)) {
  if (!source.includes(anchor)) throw new Error('TTS browser fixture head anchor is missing');
  source = source.replace(anchor, replacement);
  fs.writeFileSync(testPath, source, 'utf8');
}

fs.unlinkSync(__filename);
console.log('Applied real mobile viewport contract to TTS browser fixture.');
