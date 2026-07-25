#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const sitePath = 'css/site.css';
const floatingPath = 'css/floating-cluster.css';
const marker = '/* GB PRINT CONTRACT v2.9 — progress chrome isolation and reversible-card flow. */';
const bridgeMarker = '/* GB PRINT PRIORITY BRIDGE v1 — only declarations that must beat legacy !important screen faces. */';

let site = fs.readFileSync(sitePath, 'utf8');
const markerIndex = site.indexOf(marker);
if (markerIndex < 0 || site.indexOf(marker, markerIndex + marker.length) >= 0) {
  throw new Error('v2.9 print contract marker must occur exactly once');
}
const prefix = site.slice(0, markerIndex);
let tail = site.slice(markerIndex);
const priorityCount = (tail.match(/ !important/g) || []).length;
if (priorityCount !== 59) {
  throw new Error(`expected 59 temporary priorities in v2.9, found ${priorityCount}`);
}
tail = tail.replace(/ !important/g, '');
site = prefix + tail;
if ((site.match(/!important/g) || []).length !== 200) {
  throw new Error(`site.css priority ratchet expected 200, found ${(site.match(/!important/g) || []).length}`);
}
fs.writeFileSync(sitePath, site, 'utf8');

let floating = fs.readFileSync(floatingPath, 'utf8').trimEnd();
if (floating.includes(bridgeMarker)) {
  throw new Error('print priority bridge already exists');
}
floating += `\n\n${bridgeMarker}\n@media print {\n  html body::before {\n    content: "ГОСПОДЬ БОГ — СИЛА МОЯ (gospod-bog.ru)" !important;\n    display: block !important;\n    position: static !important;\n    inset: auto !important;\n    width: auto !important;\n    height: auto !important;\n    min-height: 0 !important;\n    background: transparent !important;\n    transform: none !important;\n    opacity: 1 !important;\n  }\n\n  html body .flip-card-front,\n  html body .heart-flip-front,\n  html body .error-flip-front,\n  html body .flip-card-back,\n  html body .heart-flip-back,\n  html body .error-flip-back {\n    position: static !important;\n    transform: none !important;\n  }\n  html body .flip-card-front,\n  html body .heart-flip-front,\n  html body .error-flip-front {\n    display: flex !important;\n  }\n  html body .flip-card-back,\n  html body .heart-flip-back,\n  html body .error-flip-back {\n    display: none !important;\n  }\n  html body .flip-card.flipped > .flip-card-inner > .flip-card-front,\n  html body .heart-flip-card.flipped > .heart-flip-inner > .heart-flip-front,\n  html body .error-flip-card.flipped > .error-flip-inner > .error-flip-front {\n    display: none !important;\n  }\n  html body .flip-card.flipped > .flip-card-inner > .flip-card-back,\n  html body .heart-flip-card.flipped > .heart-flip-inner > .heart-flip-back,\n  html body .error-flip-card.flipped > .error-flip-inner > .error-flip-back {\n    display: flex !important;\n  }\n}\n`;
const floatingPriorities = (floating.match(/!important/g) || []).length;
if (floatingPriorities > 524) {
  throw new Error(`floating-cluster priority ratchet exceeded: ${floatingPriorities}`);
}
fs.writeFileSync(floatingPath, floating, 'utf8');

execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
console.log(JSON.stringify({
  siteImportant: (site.match(/!important/g) || []).length,
  floatingImportant: floatingPriorities,
  bridge: bridgeMarker
}, null, 2));
