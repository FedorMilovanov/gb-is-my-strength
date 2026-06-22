#!/usr/bin/env node
/*
 * karty-visual-parity-audit.js — guard /karty/ native-shadow Astro contract.
 *
 * Refactoring 5.0 promoted /karty/ to a native-shadow route. Refactoring 6.0
 * parallel pilot now replaces the monolithic `_legacy/hub.html?raw` hub block
 * with named Astro leaf components while preserving the standalone premium DOM.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];
const warnings = [];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function ok(msg) { console.log('✅ ' + msg); }
function warn(msg) { warnings.push(msg); console.log('ℹ️ ' + msg); }
function bad(msg) { problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label) {
  haystack.includes(needle) ? ok(label || needle) : bad(`missing: ${label || needle}`);
}
function mustNot(haystack, needle, label) {
  !haystack.includes(needle) ? ok(`no ${label || needle}`) : bad(`forbidden present: ${label || needle}`);
}
function mustExist(rel, label) {
  exists(rel) ? ok(label || rel) : bad(`missing file: ${label || rel}`);
}

const legacy = read('karty/index.html');
for (const marker of [
  'karty-hub', 'karty-hero', 'karty-feature', 'karty-body', 'karty-note',
  'mapsTitle', 'Премиальная витрина карт', 'Принцип раздела',
]) {
  must(legacy, marker, `legacy /karty/ marker: ${marker}`);
}

const page = read('src/pages/karty/index.astro');
must(page, "loadLegacyFullDocument('karty/index.html')",
     'Astro /karty/ uses shared full-document loader for head');
must(page, '<!DOCTYPE html>', 'Astro /karty/ emits full document');
must(page, '<Fragment set:html={headHtml}',
     'Astro /karty/ preserves exact legacy head inner HTML');
must(page, 'KartyMain', 'Astro /karty/ uses extracted KartyMain component');
must(page, '_legacy/body-segment-0.html',
     'Astro /karty/ preserves verbatim legacy body chrome before <div class="karty-hub">');
must(page, '_legacy/body-segment-1.html',
     'Astro /karty/ preserves verbatim legacy body chrome after <div class="karty-hub">');

mustExist('src/components/karty/KartyMain.astro', 'KartyMain.astro component file');
mustExist('src/components/karty/KartyBackLink.astro', 'KartyBackLink.astro');
mustExist('src/components/karty/KartyHeroSection.astro', 'KartyHeroSection.astro');
mustExist('src/components/karty/KartyBodySection.astro', 'KartyBodySection.astro');
mustExist('src/components/karty/KartyNote.astro', 'KartyNote.astro');
mustExist('src/components/karty/_legacy/hub.html', 'karty hub.html legacy baseline');
mustExist('src/components/karty/_legacy/body-segment-0.html', 'karty body-segment-0.html frame fragment');
mustExist('src/components/karty/_legacy/body-segment-1.html', 'karty body-segment-1.html frame fragment');

const main = read('src/components/karty/KartyMain.astro');
must(main, '<div class="karty-hub" data-pagefind-body>', 'KartyMain preserves karty-hub root marker');
must(main, 'KartyBackLink', 'KartyMain uses backlink component');
must(main, 'KartyHeroSection', 'KartyMain uses hero component');
must(main, 'KartyBodySection', 'KartyMain uses body component');
must(main, 'KartyNote', 'KartyMain uses note component');
mustNot(main, "import legacyHtml from './_legacy/hub.html?raw'", 'raw monolithic hub import removed');

const hub = read('src/components/karty/_legacy/hub.html');
for (const marker of [
  'class="karty-hub" data-pagefind-body',
  'mapsTitle',
  'class="karty-note"',
  'Открыть карту →',
]) {
  must(hub, marker, `legacy hub baseline marker: ${marker}`);
}

for (const marker of [
  'import BaseLayout', '<BaseLayout', 'astro-card-grid',
  'class="astro-page"', 'class="astro-karty-shadow"',
]) {
  mustNot(page, marker, `old/generic karty wrapper marker: ${marker}`);
  mustNot(main, marker, `old/generic karty main marker: ${marker}`);
}

const distKarty = exists('dist/karty/index.html') ? read('dist/karty/index.html') : '';
if (distKarty) {
  for (const marker of ['karty-hub', 'mapsTitle', 'Премиальная витрина карт']) {
    must(distKarty, marker, `dist /karty/ marker: ${marker}`);
  }
  mustNot(distKarty, 'class="astro-shell"',
          'dist /karty/ has no astro-shell chrome (native-shadow)');
} else {
  warn('dist/karty/index.html not found — run npm run strangler:build before push');
}

console.log('\nKARTY VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). /karty/ native-shadow contract violated.`);
  process.exit(1);
}
console.log('✅ /karty/ Astro migration is native-shadow guarded (componentized standalone hub)');
if (warnings.length) console.log(`ℹ️ ${warnings.length} advisory warning(s) remain.`);
