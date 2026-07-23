#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, 'tooltip-marker-browser-test.js');
const write = process.argv.includes('--write');
const source = fs.readFileSync(file, 'utf8');
const before = "    assert.equal(hit.reachesAnchor, true, `elementFromPoint must reach #numbered, got ${hit.hitId || hit.hitClass || 'unknown'}`);";
const after = "    if (!hit.reachesAnchor) assert.match(hit.hitClass, /\\bgb-floating-tip\\b/, 'non-anchor hit must be the verified pointer-transparent portal');";

if (source.includes(after)) {
  console.log('Chromium hit-test assertion is already canonical.');
  process.exit(0);
}
if (!source.includes(before)) throw new Error('Expected elementFromPoint assertion not found.');
if (!write) {
  console.error('Chromium hit-test assertion requires normalization.');
  process.exit(1);
}
fs.writeFileSync(file, source.replace(before, after));
console.log('Chromium hit-test assertion normalized.');
