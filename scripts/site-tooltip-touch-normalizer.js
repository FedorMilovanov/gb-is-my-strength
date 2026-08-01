#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'js', 'site.js');
const WRITE = process.argv.includes('--write');

const TOUCH_V1 = 'document.addEventListener("touchend",function(e){if(i._tooltipTouchMoved)return;if(s(e)){for(var t=i._tooltipControllers||[],n=0;n<t.length;n++){var r=t[n];if(r.activeTip&&r.activeTip.contains(e.target)){if(o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])"))return;return e.preventDefault(),r.justOpened=!1,void r.close(!0)}}return}var a=l(e);if(a)return e.preventDefault(),void(a.controller.activeEl===a.anchor?(a.controller.justOpened=!1,a.controller.close(!0)):a.controller.open(a.anchor));c(!0)},{passive:!1})';
const TOUCH_V2 = 'document.addEventListener("touchend",function(e){if(i._tooltipTouchMoved)return;if(s(e)){for(var t=i._tooltipControllers||[],n=0;n<t.length;n++){var r=t[n];if(r.activeTip&&r.activeTip.contains(e.target)){if(o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])"))return;return e.preventDefault(),i._tooltipLastTouchHandledAt=Date.now(),r.justOpened=!1,void r.close(!0)}}return}var a=l(e);if(a)return e.preventDefault(),i._tooltipLastTouchHandledAt=Date.now(),void(a.controller.activeEl===a.anchor?(a.controller.justOpened=!1,a.controller.close(!0)):a.controller.open(a.anchor));c(!0)},{passive:!1})';
const CLICK_V1 = 'document.addEventListener("click",function(e){if(o(e.target,"[data-tooltip-close]"))return e.preventDefault(),e.stopPropagation(),void c(!0);if(!s(e)){var t=l(e);if(t){if(!t.controller.isDesktop())return void e.preventDefault();if(e.preventDefault(),e.stopPropagation(),t.controller.activeEl===t.anchor)return;t.controller.open(t.anchor)}else s(e)||c()}})';
const CLICK_V2 = 'document.addEventListener("click",function(e){if(o(e.target,"[data-tooltip-close]"))return e.preventDefault(),e.stopPropagation(),void c(!0);if(s(e)){if(Date.now()-(i._tooltipLastTouchHandledAt||0)<700)return;for(var t=i._tooltipControllers||[],n=0;n<t.length;n++){var r=t[n];if(r.activeTip&&r.activeTip.contains(e.target)){if(o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])"))return;return e.preventDefault(),r.justOpened=!1,void r.close(!0)}}return}var a=l(e);if(a){if(!a.controller.isDesktop()){if(e.preventDefault(),Date.now()-(i._tooltipLastTouchHandledAt||0)<700)return;return void(a.controller.activeEl===a.anchor?(a.controller.justOpened=!1,a.controller.close(!0)):a.controller.open(a.anchor))}if(e.preventDefault(),e.stopPropagation(),a.controller.activeEl===a.anchor)return;a.controller.open(a.anchor)}else c()})';

function count(source, needle) {
  return source.split(needle).length - 1;
}

function normalize(source, before, after, label) {
  const beforeCount = count(source, before);
  const afterCount = count(source, after);
  if (afterCount === 1 && beforeCount === 0) return source;
  if (beforeCount !== 1 || afterCount !== 0) {
    throw new Error(`${label} normalizer refused input: before=${beforeCount}, after=${afterCount}`);
  }
  if (!WRITE) throw new Error(`${label} is stale; rerun with --write`);
  const next = source.replace(before, after);
  if (count(next, after) !== 1 || next.includes(before)) {
    throw new Error(`${label} target verification failed`);
  }
  return next;
}

const source = fs.readFileSync(FILE, 'utf8');
let next = normalize(source, TOUCH_V1, TOUCH_V2, 'Site tooltip touchend contract');
next = normalize(next, CLICK_V1, CLICK_V2, 'Site tooltip mobile click fallback');

if (next === source) {
  console.log('✅ Site tooltip touch contract already normalized');
  process.exit(0);
}

fs.writeFileSync(FILE, next, 'utf8');
console.log('✅ Site tooltip touch contract normalized with WebKit-safe event deduplication');
