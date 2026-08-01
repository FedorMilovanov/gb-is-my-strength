#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'js', 'site.js');
const WRITE = process.argv.includes('--write');

const MOUNT_V1 = 'mountTip:function(e){e&&(e.parentNode!==document.body&&(o.tipPlaceholder=document.createComment("gb-tooltip-placeholder"),e.parentNode.insertBefore(o.tipPlaceholder,e),document.body.appendChild(e)),e.classList.add("gb-floating-tip","is-open"),o.activeTip=e)}';
const MOUNT_V2 = 'mountTip:function(e){if(e){if(e.parentNode!==document.body&&(o.tipPlaceholder=document.createComment("gb-tooltip-placeholder"),e.parentNode.insertBefore(o.tipPlaceholder,e),document.body.appendChild(e)),o.isMobileSheet()&&!e.querySelector("[data-tooltip-close]")){var t=document.createElement("button");t.type="button",t.className="gb-tooltip-close",t.setAttribute("data-tooltip-close",""),t.setAttribute("data-gb-generated-close","1"),t.setAttribute("aria-label","Закрыть подсказку"),t.textContent="×",e.insertBefore(t,e.firstChild)}e.classList.add("gb-floating-tip","is-open"),o.activeTip=e}}';
const START_V1 = 'document.addEventListener("touchstart",function(){i._tooltipTouchMoved=!1},{passive:!0})';
const START_V2 = 'document.addEventListener("touchstart",function(){i._tooltipTouchMoved=!1,i._tooltipPendingClickAnchor=null,i._tooltipPendingClickUntil=0},{passive:!0})';
const START_V3 = 'document.addEventListener("touchstart",function(){i._tooltipTouchMoved=!1,Date.now()>(i._tooltipPendingClickUntil||0)&&(i._tooltipPendingClickAnchor=null,i._tooltipPendingClickUntil=0)},{passive:!0})';
const START_V4 = 'document.addEventListener("touchstart",function(e){i._tooltipTouchMoved=!1;var t=e.touches&&e.touches[0];i._tooltipTouchStart=t?{x:t.clientX,y:t.clientY}:null,Date.now()>(i._tooltipPendingClickUntil||0)&&(i._tooltipPendingClickAnchor=null,i._tooltipPendingClickUntil=0)},{passive:!0})';
const MOVE_V1 = 'document.addEventListener("touchmove",function(e){i._tooltipTouchMoved=!0,d(e)},{passive:!0})';
const MOVE_V2 = 'document.addEventListener("touchmove",function(e){var t=e.touches&&e.touches[0],n=i._tooltipTouchStart;if(t&&n){var o=t.clientX-n.x,r=t.clientY-n.y;i._tooltipTouchMoved=o*o+r*r>144}else i._tooltipTouchMoved=!0;i._tooltipTouchMoved&&d(e)},{passive:!0})';
const TOUCH_V1 = 'document.addEventListener("touchend",function(e){if(i._tooltipTouchMoved)return;if(s(e)){for(var t=i._tooltipControllers||[],n=0;n<t.length;n++){var r=t[n];if(r.activeTip&&r.activeTip.contains(e.target)){if(o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])"))return;return e.preventDefault(),r.justOpened=!1,void r.close(!0)}}return}var a=l(e);if(a)return e.preventDefault(),void(a.controller.activeEl===a.anchor?(a.controller.justOpened=!1,a.controller.close(!0)):a.controller.open(a.anchor));c(!0)},{passive:!1})';
const TOUCH_V2 = 'document.addEventListener("touchend",function(e){if(i._tooltipTouchMoved)return;if(s(e)){for(var t=i._tooltipControllers||[],n=0;n<t.length;n++){var r=t[n];if(r.activeTip&&r.activeTip.contains(e.target)){if(o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])"))return;return e.preventDefault(),i._tooltipLastTouchHandledAt=Date.now(),r.justOpened=!1,void r.close(!0)}}return}var a=l(e);if(a)return e.preventDefault(),i._tooltipLastTouchHandledAt=Date.now(),void(a.controller.activeEl===a.anchor?(a.controller.justOpened=!1,a.controller.close(!0)):a.controller.open(a.anchor));c(!0)},{passive:!1})';
const TOUCH_V3 = 'document.addEventListener("touchend",function(e){if(i._tooltipTouchMoved)return;if(s(e)){for(var t=i._tooltipControllers||[],n=0;n<t.length;n++){var r=t[n];if(r.activeTip&&r.activeTip.contains(e.target)){if(o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])"))return;return e.preventDefault(),i._tooltipLastTouchHandledAt=Date.now(),i._tooltipPendingClickAnchor=r.activeEl,i._tooltipPendingClickUntil=Date.now()+1600,r.justOpened=!1,void r.close(!0)}}return}var a=l(e);if(a)return e.preventDefault(),i._tooltipLastTouchHandledAt=Date.now(),i._tooltipPendingClickAnchor=a.anchor,i._tooltipPendingClickUntil=Date.now()+1600,void(a.controller.activeEl===a.anchor?(a.controller.justOpened=!1,a.controller.close(!0)):a.controller.open(a.anchor));c(!0)},{passive:!1})';
const CLICK_V1 = 'document.addEventListener("click",function(e){if(o(e.target,"[data-tooltip-close]"))return e.preventDefault(),e.stopPropagation(),void c(!0);if(!s(e)){var t=l(e);if(t){if(!t.controller.isDesktop())return void e.preventDefault();if(e.preventDefault(),e.stopPropagation(),t.controller.activeEl===t.anchor)return;t.controller.open(t.anchor)}else s(e)||c()}})';
const CLICK_V2 = 'document.addEventListener("click",function(e){if(o(e.target,"[data-tooltip-close]"))return e.preventDefault(),e.stopPropagation(),void c(!0);if(s(e)){if(Date.now()-(i._tooltipLastTouchHandledAt||0)<700)return;for(var t=i._tooltipControllers||[],n=0;n<t.length;n++){var r=t[n];if(r.activeTip&&r.activeTip.contains(e.target)){if(o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])"))return;return e.preventDefault(),r.justOpened=!1,void r.close(!0)}}return}var a=l(e);if(a){if(!a.controller.isDesktop())return void e.preventDefault();if(e.preventDefault(),e.stopPropagation(),a.controller.activeEl===a.anchor)return;a.controller.open(a.anchor)}else c()})';
const CLICK_V3 = 'document.addEventListener("click",function(e){if(o(e.target,"[data-tooltip-close]"))return e.preventDefault(),e.stopPropagation(),void c(!0);if(s(e)){if(Date.now()-(i._tooltipLastTouchHandledAt||0)<700)return;if(document.elementsFromPoint&&"number"==typeof e.clientX&&"number"==typeof e.clientY)for(var t=document.elementsFromPoint(e.clientX,e.clientY),n=0;n<t.length;n++){var r=l({target:t[n]});if(r&&r.controller.isDesktop())return e.preventDefault(),e.stopPropagation(),void(r.controller.activeEl===r.anchor?0:r.controller.open(r.anchor))}for(var a=i._tooltipControllers||[],u=0;u<a.length;u++){var p=a[u];if(p.activeTip&&p.activeTip.contains(e.target)){if(o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])"))return;return e.preventDefault(),p.justOpened=!1,void p.close(!0)}}return}var f=l(e);if(f){if(!f.controller.isDesktop()){if(e.preventDefault(),Date.now()-(i._tooltipLastTouchHandledAt||0)<700)return;return void(f.controller.activeEl===f.anchor?(f.controller.justOpened=!1,f.controller.close(!0)):f.controller.open(f.anchor))}if(e.preventDefault(),e.stopPropagation(),f.controller.activeEl===f.anchor)return;f.controller.open(f.anchor)}else c()})';
const CLICK_V4 = 'document.addEventListener("click",function(e){if(o(e.target,"[data-tooltip-close]"))return e.preventDefault(),e.stopPropagation(),void c(!0);var h=l(e),m=i._tooltipPendingClickAnchor;if(m&&Date.now()<=(i._tooltipPendingClickUntil||0)&&h&&h.anchor===m)return e.preventDefault(),e.stopPropagation(),i._tooltipPendingClickAnchor=null,void(i._tooltipPendingClickUntil=0);Date.now()>(i._tooltipPendingClickUntil||0)&&(i._tooltipPendingClickAnchor=null,i._tooltipPendingClickUntil=0);if(s(e)){if(Date.now()-(i._tooltipLastTouchHandledAt||0)<700)return;if(document.elementsFromPoint&&"number"==typeof e.clientX&&"number"==typeof e.clientY)for(var t=document.elementsFromPoint(e.clientX,e.clientY),n=0;n<t.length;n++){var r=l({target:t[n]});if(r&&r.controller.isDesktop())return e.preventDefault(),e.stopPropagation(),void(r.controller.activeEl===r.anchor?0:r.controller.open(r.anchor))}for(var a=i._tooltipControllers||[],u=0;u<a.length;u++){var p=a[u];if(p.activeTip&&p.activeTip.contains(e.target)){if(o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])"))return;return e.preventDefault(),p.justOpened=!1,void p.close(!0)}}return}var f=h||l(e);if(f){if(!f.controller.isDesktop()){if(e.preventDefault(),Date.now()-(i._tooltipLastTouchHandledAt||0)<700)return;return void(f.controller.activeEl===f.anchor?(f.controller.justOpened=!1,f.controller.close(!0)):f.controller.open(f.anchor))}if(e.preventDefault(),e.stopPropagation(),f.controller.activeEl===f.anchor)return;f.controller.open(f.anchor)}else c()})';
const CLICK_V5 = 'document.addEventListener("click",function(e){if(o(e.target,"[data-tooltip-close]"))return e.preventDefault(),e.stopPropagation(),void c(!0);for(var h=!1,m=i._tooltipControllers||[],q=0;q<m.length;q++){var v=m[q];if(v.activeTip&&v.activeTip.contains(e.target)&&o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])")){h=!0;break}}var x=Date.now()<=(i._tooltipPendingClickUntil||0);if(h&&(i._tooltipPendingClickAnchor=null,i._tooltipPendingClickUntil=0),x&&0!==e.detail&&!h)return e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation&&e.stopImmediatePropagation(),i._tooltipPendingClickAnchor=null,void(i._tooltipPendingClickUntil=0);Date.now()>(i._tooltipPendingClickUntil||0)&&(i._tooltipPendingClickAnchor=null,i._tooltipPendingClickUntil=0);if(s(e)){if(Date.now()-(i._tooltipLastTouchHandledAt||0)<700)return;if(document.elementsFromPoint&&"number"==typeof e.clientX&&"number"==typeof e.clientY)for(var t=document.elementsFromPoint(e.clientX,e.clientY),n=0;n<t.length;n++){var r=l({target:t[n]});if(r&&r.controller.isDesktop())return e.preventDefault(),e.stopPropagation(),void(r.controller.activeEl===r.anchor?0:r.controller.open(r.anchor))}for(var a=i._tooltipControllers||[],u=0;u<a.length;u++){var p=a[u];if(p.activeTip&&p.activeTip.contains(e.target)){if(o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])"))return;return e.preventDefault(),p.justOpened=!1,void p.close(!0)}}return}var f=l(e);if(f){if(!f.controller.isDesktop()){if(e.preventDefault(),Date.now()-(i._tooltipLastTouchHandledAt||0)<700)return;return void(f.controller.activeEl===f.anchor?(f.controller.justOpened=!1,f.controller.close(!0)):f.controller.open(f.anchor))}if(e.preventDefault(),e.stopPropagation(),f.controller.activeEl===f.anchor)return;f.controller.open(f.anchor)}else c()})';
const CLICK_V6 = 'document.addEventListener("click",function(e){if(o(e.target,"[data-tooltip-close]"))return e.preventDefault(),e.stopPropagation(),void c(!0);for(var h=!1,m=i._tooltipControllers||[],q=0;q<m.length;q++){var v=m[q];if(v.activeTip&&v.activeTip.contains(e.target)&&o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])")){h=!0;break}}var x=Date.now()<=(i._tooltipPendingClickUntil||0),y=Date.now()-(i._tooltipLastTouchHandledAt||0)<700;if(h&&(i._tooltipPendingClickAnchor=null,i._tooltipPendingClickUntil=0),x&&!h&&(0!==e.detail||y))return e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation&&e.stopImmediatePropagation(),i._tooltipPendingClickAnchor=null,void(i._tooltipPendingClickUntil=0);Date.now()>(i._tooltipPendingClickUntil||0)&&(i._tooltipPendingClickAnchor=null,i._tooltipPendingClickUntil=0);if(s(e)){if(Date.now()-(i._tooltipLastTouchHandledAt||0)<700)return;if(document.elementsFromPoint&&"number"==typeof e.clientX&&"number"==typeof e.clientY)for(var t=document.elementsFromPoint(e.clientX,e.clientY),n=0;n<t.length;n++){var r=l({target:t[n]});if(r&&r.controller.isDesktop())return e.preventDefault(),e.stopPropagation(),void(r.controller.activeEl===r.anchor?0:r.controller.open(r.anchor))}for(var a=i._tooltipControllers||[],u=0;u<a.length;u++){var p=a[u];if(p.activeTip&&p.activeTip.contains(e.target)){if(o(e.target,"a,button,input,select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex=\'-1\'])"))return;return e.preventDefault(),p.justOpened=!1,void p.close(!0)}}return}var f=l(e);if(f){if(!f.controller.isDesktop()){if(e.preventDefault(),Date.now()-(i._tooltipLastTouchHandledAt||0)<700)return;return void(f.controller.activeEl===f.anchor?(f.controller.justOpened=!1,f.controller.close(!0)):f.controller.open(f.anchor))}if(e.preventDefault(),e.stopPropagation(),f.controller.activeEl===f.anchor)return;f.controller.open(f.anchor)}else c()})';
const POINTER_CORRIDOR_V1 = 'i._ptrInside=function(el){if(!el)return!1;var r=el.getBoundingClientRect(),p=i._ptrPos;return p.x>=r.left-4&&p.x<=r.right+4&&p.y>=r.top-4&&p.y<=r.bottom+4}';
const POINTER_CORRIDOR_V2 = 'i._ptrInside=function(el){if(!el)return!1;var r=el.getBoundingClientRect(),p=i._ptrPos;return p.x>=r.left-28&&p.x<=r.right+28&&p.y>=r.top-28&&p.y<=r.bottom+28}';

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
let next = source;
if (count(next, MOUNT_V2) === 1) {
  if (count(next, MOUNT_V1) !== 0) throw new Error('Site tooltip mobile close control has mixed migration stages');
} else {
  next = normalize(next, MOUNT_V1, MOUNT_V2, 'Site tooltip mobile close control');
}
if (count(next, START_V4) === 1) {
  if (count(next, START_V1) !== 0 || count(next, START_V2) !== 0 || count(next, START_V3) !== 0) throw new Error('Site tooltip touchstart contract has mixed migration stages');
} else if (count(next, START_V3) === 1) {
  next = normalize(next, START_V3, START_V4, 'Site tooltip touchstart movement origin');
} else if (count(next, START_V2) === 1) {
  next = normalize(next, START_V2, START_V3, 'Site tooltip touch sequence expiry reset');
  next = normalize(next, START_V3, START_V4, 'Site tooltip touchstart movement origin');
} else {
  next = normalize(next, START_V1, START_V3, 'Site tooltip touch sequence expiry reset');
  next = normalize(next, START_V3, START_V4, 'Site tooltip touchstart movement origin');
}
if (count(next, MOVE_V2) === 1) {
  if (count(next, MOVE_V1) !== 0) throw new Error('Site tooltip touchmove contract has mixed migration stages');
} else {
  next = normalize(next, MOVE_V1, MOVE_V2, 'Site tooltip 12px touch slop');
}
if (count(next, TOUCH_V3) === 1) {
  if (count(next, TOUCH_V1) !== 0 || count(next, TOUCH_V2) !== 0) throw new Error('Site tooltip touchend contract has mixed migration stages');
} else {
  if (count(next, TOUCH_V2) === 0) next = normalize(next, TOUCH_V1, TOUCH_V2, 'Site tooltip touchend timestamp contract');
  next = normalize(next, TOUCH_V2, TOUCH_V3, 'Site tooltip compatibility-click token');
}
if (count(next, CLICK_V6) === 1) {
  if (count(next, CLICK_V1) !== 0 || count(next, CLICK_V2) !== 0 || count(next, CLICK_V3) !== 0 || count(next, CLICK_V4) !== 0 || count(next, CLICK_V5) !== 0) {
    throw new Error('Site tooltip click contract has mixed migration stages');
  }
} else {
  if (count(next, CLICK_V5) === 0) {
    if (count(next, CLICK_V4) === 0) {
      if (count(next, CLICK_V3) === 0) {
        next = normalize(next, CLICK_V1, CLICK_V2, 'Site tooltip mobile click fallback');
        next = normalize(next, CLICK_V2, CLICK_V3, 'Site tooltip desktop portal hit-test fallback');
      }
      next = normalize(next, CLICK_V3, CLICK_V4, 'Site tooltip anchor-bound compatibility click suppression');
    }
    next = normalize(next, CLICK_V4, CLICK_V5, 'Site tooltip event-bound compatibility click suppression');
  }
  next = normalize(next, CLICK_V5, CLICK_V6, 'Site tooltip recent-touch detail-zero compatibility click suppression');
}
if (count(next, POINTER_CORRIDOR_V2) === 1) {
  if (count(next, POINTER_CORRIDOR_V1) !== 0) throw new Error('Site tooltip pointer corridor has mixed migration stages');
} else {
  next = normalize(next, POINTER_CORRIDOR_V1, POINTER_CORRIDOR_V2, 'Site tooltip desktop pointer corridor');
}

if (next === source) {
  console.log('✅ Site tooltip touch contract already normalized');
  process.exit(0);
}

fs.writeFileSync(FILE, next, 'utf8');
console.log('✅ Site tooltip touch contract normalized with a mobile close control, 12px touch slop, recent-touch WebKit click dedupe, keyboard preservation, desktop portal hit-testing and a 28px geometric pointer corridor');
