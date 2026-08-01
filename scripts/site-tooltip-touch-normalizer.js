#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'js', 'site.js');
const WRITE = process.argv.includes('--write');

const BEFORE = 'document.addEventListener("touchend",function(e){if(!s(e)){var t=l(e);if(t){if(i._tooltipTouchMoved)return;return e.preventDefault(),void(t.controller.activeEl===t.anchor?(t.controller.justOpened=!1,t.controller.close(!0)):t.controller.open(t.anchor))}s(e)||c(!0)}},{passive:!1})';
const AFTER = 'document.addEventListener("touchend",function(e){if(i._tooltipTouchMoved)return;if(s(e)){for(var t=i._tooltipControllers||[],n=0;n<t.length;n++){var r=t[n];if(r.activeTip&&r.activeTip.contains(e.target)){if(o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])"))return;return e.preventDefault(),r.justOpened=!1,void r.close(!0)}}return}var a=l(e);if(a)return e.preventDefault(),void(a.controller.activeEl===a.anchor?(a.controller.justOpened=!1,a.controller.close(!0)):a.controller.open(a.anchor));c(!0)},{passive:!1})';

const source = fs.readFileSync(FILE, 'utf8');
const beforeCount = source.split(BEFORE).length - 1;
const afterCount = source.split(AFTER).length - 1;

if (afterCount === 1 && beforeCount === 0) {
  console.log('✅ Site tooltip touch contract already normalized');
  process.exit(0);
}

if (beforeCount !== 1 || afterCount !== 0) {
  throw new Error(`site tooltip touch normalizer refused input: before=${beforeCount}, after=${afterCount}`);
}

if (!WRITE) {
  throw new Error('site tooltip touch contract is stale; rerun with --write');
}

const next = source.replace(BEFORE, AFTER);
if (next.split(AFTER).length - 1 !== 1 || next.includes(BEFORE)) {
  throw new Error('site tooltip touch normalizer failed target verification');
}
fs.writeFileSync(FILE, next, 'utf8');
console.log('✅ Site tooltip touch contract normalized for body-mounted WebKit taps');
