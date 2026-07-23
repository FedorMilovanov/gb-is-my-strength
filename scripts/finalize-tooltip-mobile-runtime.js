#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, '../js/site.js');
const write = process.argv.includes('--write');
const source = fs.readFileSync(file, 'utf8');
const before = 'document.addEventListener("touchend",function(e){if(!s(e)){var t=l(e);if(t){if(i._tooltipTouchMoved)return;return e.preventDefault(),void(t.controller.activeEl===t.anchor?(t.controller.justOpened=!1,t.controller.close(!0)):t.controller.open(t.anchor))}s(e)||c()}},{passive:!1})';
const after = 'document.addEventListener("touchend",function(e){if(!s(e)){var t=l(e);if(t){if(i._tooltipTouchMoved)return;return e.preventDefault(),void(t.controller.activeEl===t.anchor?(t.controller.justOpened=!1,t.controller.close(!0)):t.controller.open(t.anchor))}s(e)||c(!0)}},{passive:!1})';

const occurrences = source.split(before).length - 1;
if (source.includes(after)) {
  if (occurrences !== 0) throw new Error('Canonical and legacy mobile touch handlers coexist.');
  console.log('Mobile tooltip outside-touch runtime is already canonical.');
  process.exit(0);
}
if (occurrences !== 1) throw new Error(`Expected exactly one legacy mobile touch handler, found ${occurrences}.`);
if (!write) {
  console.error('Mobile tooltip outside-touch runtime requires normalization.');
  process.exit(1);
}
fs.writeFileSync(file, source.replace(before, after));
console.log('Mobile tooltip outside-touch runtime normalized.');
