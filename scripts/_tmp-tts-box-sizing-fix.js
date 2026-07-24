#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cssPath = path.join(root, 'css/tts-download-notice.css');
const enginePath = path.join(root, 'js/vosk-tts-engine.js');

let css = fs.readFileSync(cssPath, 'utf8');
const anchor = '.gb-tts-download-notice{\n  position:fixed;';
const replacement = '.gb-tts-download-notice{\n  box-sizing:border-box;\n  position:fixed;';
if (!css.includes('box-sizing:border-box;')) {
  if (!css.includes(anchor)) throw new Error('TTS notice width anchor is missing');
  css = css.replace(anchor, replacement);
  fs.writeFileSync(cssPath, css, 'utf8');
}

const revision = crypto.createHash('md5').update(css).digest('hex').slice(0, 8);
let engine = fs.readFileSync(enginePath, 'utf8');
const revisionPattern = /\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}/;
if (!revisionPattern.test(engine)) throw new Error('TTS notice stylesheet revision URL is missing');
engine = engine.replace(revisionPattern, `/css/tts-download-notice.css?v=${revision}`);
fs.writeFileSync(enginePath, engine, 'utf8');

fs.unlinkSync(__filename);
console.log(`Applied border-box width contract; stylesheet revision ${revision}.`);
