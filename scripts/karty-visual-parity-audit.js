#!/usr/bin/env node
/*
 * karty-visual-parity-audit.js — guard /karty/ native-shadow Astro contract.
 *
 * РЕФАКТОРИНГ 5.0 Phase 6 wave 4 (AGENTS-r252). /karty/ is a premium
 * standalone landing whose entire body content lives inside one root
 * <div class="karty-hub" data-pagefind-body>. No chrome (skip-link, theme
 * toggle, breadcrumb, footer) wraps it.
 *
 * Native-shadow contract:
 *   - <head> via loadLegacyFullDocument => SEO byte-identical;
 *   - body-segment-0 / body-segment-1 are EMPTY (no chrome);
 *   - <div class="karty-hub" data-pagefind-body> promoted to KartyMain.astro
 *     component, hub HTML byte-identical via Vite ?raw.
 *
 * Pixel parity proof (CI):
 *   npm run visual:parity:screenshots -- --routes /karty/ --threshold 0.5
 *
 * Source-only guard (no dist build required): runs on Astro source files
 * and the legacy HTML. Fails fast if a future agent accidentally reverts
 * /karty/ to a generic astro-card grid or to full-document shadow.
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

// --- Legacy /karty/ premium markers ---
const legacy = read('karty/index.html');
for (const marker of [
  'karty-hub', 'karty-hero', 'karty-feature', 'karty-body', 'karty-note',
  'mapsTitle', 'Премиальная витрина карт', 'Принцип раздела',
]) {
  must(legacy, marker, `legacy /karty/ marker: ${marker}`);
}

// --- Astro native-shadow contract ---
const astro = read('src/pages/karty/index.astro');
must(astro, "loadLegacyFullDocument('karty/index.html')",
     'Astro /karty/ uses shared full-document loader for head');
must(astro, '<!DOCTYPE html>', 'Astro /karty/ emits full document');
must(astro, '<Fragment set:html={headHtml}',
     'Astro /karty/ preserves exact legacy head inner HTML');
must(astro, 'KartyMain', 'Astro /karty/ uses extracted KartyMain component');
must(astro, '_legacy/body-segment-0.html',
     'Astro /karty/ preserves verbatim legacy body chrome before <div class="karty-hub">');
must(astro, '_legacy/body-segment-1.html',
     'Astro /karty/ preserves verbatim legacy body chrome after <div class="karty-hub">');

// --- KartyMain.astro + _legacy/ contract ---
mustExist('src/components/karty/KartyMain.astro', 'KartyMain.astro component file');
mustExist('src/components/karty/_legacy/hub.html', 'karty hub.html legacy fragment');
mustExist('src/components/karty/_legacy/body-segment-0.html', 'karty body-segment-0.html frame fragment');
mustExist('src/components/karty/_legacy/body-segment-1.html', 'karty body-segment-1.html frame fragment');

const kartyMain = read('src/components/karty/KartyMain.astro');
must(kartyMain, "_legacy/hub.html?raw",
     'KartyMain imports hub.html verbatim via Vite ?raw');

// hub.html should contain the same karty-hub content as legacy (depth-aware
// extraction done by extract-native-pilot.js since r252).
const hub = read('src/components/karty/_legacy/hub.html');
must(hub, 'class="karty-hub" data-pagefind-body', 'hub.html preserves karty-hub root marker');
must(hub, 'mapsTitle', 'hub.html preserves mapsTitle h1 id');
must(hub, 'class="karty-note"', 'hub.html preserves karty-note footer paragraph');

// --- Anti-regression: forbid generic Astro card grid + BaseLayout ---
for (const marker of [
  'import BaseLayout', '<BaseLayout', 'astro-card-grid',
  'class="astro-page"', 'class="astro-karty-shadow"',
]) {
  mustNot(astro, marker, `old/generic karty wrapper marker: ${marker}`);
}

// --- Dist (if available) — premium DOM markers ---
const distKarty = exists('dist/karty/index.html') ? read('dist/karty/index.html') : '';
if (distKarty) {
  for (const marker of ['karty-hub', 'mapsTitle', 'Премиальная витрина карт']) {
    must(distKarty, marker, `dist /karty/ marker: ${marker}`);
  }
  // Astro BaseLayout chrome must NOT appear in dist
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
console.log(`✅ /karty/ Astro migration is native-shadow guarded (Phase 6 wave 4)`);
if (warnings.length) console.log(`ℹ️ ${warnings.length} advisory warning(s) remain.`);
