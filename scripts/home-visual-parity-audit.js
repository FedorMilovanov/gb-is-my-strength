#!/usr/bin/env node
/*
 * home-visual-parity-audit.js — guard / (home) native-shadow Astro contract.
 *
 * РЕФАКТОРИНГ 5.0 Phase 6 wave 6 (AGENTS-r254). / is the most critical landing
 * — premium standalone with mobile-nav, mobile-dock, h-hero, h-featured shelves,
 * h-mobile-dashboard (4 quick-start cards), h-mobile-paths (6 guided-reading
 * cards), resume-reading block, h-article-list, h-about, h-quote-section.
 *
 * Native-shadow contract:
 *   - <head> via loadLegacyFullDocument => SEO byte-identical;
 *   - body-segment-{0,1}.html contain full chrome (mobile-nav, mobile-dock,
 *     gb-accuracy, scripts);
 *   - <main id="main-content" data-pagefind-body> promoted to HomeMain.astro
 *     component, main HTML byte-identical via Vite ?raw.
 *
 * Pixel parity proof (CI):
 *   npm run visual:parity:screenshots -- --routes / --threshold 0.5
 *
 * Source-only guard (no dist build required).
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

// --- Legacy / premium markers ---
// Note: h-related-articles is on article pages (single article), not on /
// home — /home does not have a related-articles section.
const legacy = read('index.html');
for (const marker of [
  '<main id="main-content" data-pagefind-body', 'class="home-v20"',
  'h-hero', 'h-mobile-hero-hub', 'h-mobile-dashboard', 'h-mobile-rail',
  'h-mobile-paths', 'h-featured', 'h-card-glass', 'h-card-planned',
  'h-article-list', 'h-about', 'h-quote-section',
  'h-mobile-dock', 'gb-accuracy-block', 'resume-reading-block',
  'Господь Бог — Сила Моя',
]) {
  must(legacy, marker, `legacy / marker: ${marker}`);
}

// --- Astro native-shadow contract ---
const astro = read('src/pages/index.astro');
must(astro, "loadLegacyFullDocument('index.html')",
     'Astro / uses shared full-document loader for head');
must(astro, '<!DOCTYPE html>', 'Astro / emits full document');
must(astro, '<Fragment set:html={headHtml}',
     'Astro / preserves exact legacy head inner HTML');
must(astro, 'HomeMain', 'Astro / uses extracted HomeMain component');
must(astro, '_legacy/body-segment-0.html',
     'Astro / preserves verbatim legacy body chrome before <main>');
must(astro, '_legacy/body-segment-1.html',
     'Astro / preserves verbatim legacy body chrome after <main>');

// --- HomeMain.astro + _legacy/ contract ---
mustExist('src/components/home/HomeMain.astro', 'HomeMain.astro component file');
mustExist('src/components/home/_legacy/main.html', 'home main.html legacy fragment');
mustExist('src/components/home/_legacy/body-segment-0.html', 'home body-segment-0.html frame fragment');
mustExist('src/components/home/_legacy/body-segment-1.html', 'home body-segment-1.html frame fragment');

const homeMain = read('src/components/home/HomeMain.astro');
must(homeMain, "_legacy/main.html?raw",
     'HomeMain imports main.html verbatim via Vite ?raw');

// main.html should contain all home premium sections
// (gb-accuracy-block lives INSIDE <main>, not in body-segment-1)
const mainFragment = read('src/components/home/_legacy/main.html');
for (const marker of ['main-content', 'h-hero', 'h-mobile-dashboard', 'h-featured',
                      'h-article-list', 'h-about', 'h-quote-section',
                      'gb-accuracy-block']) {
  must(mainFragment, marker, `main.html preserves ${marker}`);
}

// body-segment-0 should contain chrome BEFORE main (skip-link, mobile-nav, home-v20 open)
const segBefore = read('src/components/home/_legacy/body-segment-0.html');
for (const marker of ['skip-link', 'h-mobile-nav', 'h-navbar', 'home-v20']) {
  must(segBefore, marker, `body-segment-0.html preserves ${marker}`);
}

// body-segment-1 should contain chrome AFTER main (mobile-dock, runtime scripts)
const segAfter = read('src/components/home/_legacy/body-segment-1.html');
for (const marker of ['h-mobile-dock', 'site.js', 'sw-register']) {
  must(segAfter, marker, `body-segment-1.html preserves ${marker}`);
}

// --- Anti-regression: forbid generic Astro card grid + BaseLayout ---
for (const marker of [
  'import BaseLayout', '<BaseLayout', 'astro-card-grid',
  'class="astro-home"', 'class="astro-page"',
  'astro-shell',
]) {
  mustNot(astro, marker, `old/generic home wrapper marker: ${marker}`);
}

// --- Dist (if available) — premium DOM markers ---
const dist = exists('dist/index.html') ? read('dist/index.html') : '';
if (dist) {
  for (const marker of ['home-v20', 'h-hero', 'h-mobile-dashboard', 'main-content']) {
    must(dist, marker, `dist / marker: ${marker}`);
  }
  mustNot(dist, 'class="astro-shell"',
          'dist / has no astro-shell chrome (native-shadow)');
} else {
  warn('dist/index.html not found — run npm run strangler:build before push');
}

console.log('\nHOME VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). / native-shadow contract violated.`);
  process.exit(1);
}
console.log(`✅ / Astro migration is native-shadow guarded (Phase 6 wave 6)`);
if (warnings.length) console.log(`ℹ️ ${warnings.length} advisory warning(s) remain.`);
