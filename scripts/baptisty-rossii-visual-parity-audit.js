#!/usr/bin/env node
/*
 * baptisty-rossii-visual-parity-audit.js — guard /baptisty-rossii/ native-shadow
 * Astro contract.
 *
 * РЕФАКТОРИНГ 5.0 Phase 6 wave 5 (AGENTS-r253). /baptisty-rossii/ is the series
 * overview landing for "Баптисты России" — premium GBS2 world with mobile head,
 * rail (10 parts nav), bottom bar, and mobile sheet. The semantic block is
 * <main id="main-content">; everything else is chrome preserved verbatim.
 *
 * Native-shadow contract:
 *   - <head> via loadLegacyFullDocument => SEO byte-identical;
 *   - body-segment-{0,1}.html contain the full GBS2 chrome;
 *   - <main id="main-content"> promoted to BaptistyRossiiMain.astro component,
 *     main HTML byte-identical via Vite ?raw.
 *
 * Pixel parity proof (CI):
 *   npm run visual:parity:screenshots -- --routes /baptisty-rossii/ --threshold 0.5
 *
 * Source-only guard (no dist build required): runs on Astro source files
 * and the legacy HTML. Fails fast if a future agent accidentally reverts
 * /baptisty-rossii/ to a generic astro-card grid or to full-document shadow.
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

// --- Legacy /baptisty-rossii/ premium markers ---
// Note: gbs2-timeline, gbs2-next, author-card are in SeriesArticleLayout.astro
// for INDIVIDUAL articles (baptisty-rossii/noch-na-kure/, etc.), not the
// /baptisty-rossii/ series index landing.
const legacy = read('baptisty-rossii/index.html');
for (const marker of [
  'class="gbs-world"', 'data-gbs2-series="russian-baptism"',
  'gbs2-mobile-head', 'gbs2-rail', 'gbs2-rtitle', 'gbs2-parts', 'gbs2-bbar',
  'gbs2-sheet', 'gbs2-hero', 'h-article-list', 'main-content',
  'Баптисты России',
]) {
  must(legacy, marker, `legacy /baptisty-rossii/ marker: ${marker}`);
}

// --- Astro native-shadow contract ---
const astro = read('src/pages/baptisty-rossii/index.astro');
must(astro, "loadLegacyFullDocument('baptisty-rossii/index.html')",
     'Astro /baptisty-rossii/ uses shared full-document loader for head');
must(astro, '<!DOCTYPE html>', 'Astro /baptisty-rossii/ emits full document');
must(astro, '<Fragment set:html={headHtml}',
     'Astro /baptisty-rossii/ preserves exact legacy head inner HTML');
must(astro, 'BaptistyRossiiMain',
     'Astro /baptisty-rossii/ uses extracted BaptistyRossiiMain component');
must(astro, '_legacy/body-segment-0.html',
     'Astro /baptisty-rossii/ preserves verbatim legacy body chrome before <main>');
must(astro, '_legacy/body-segment-1.html',
     'Astro /baptisty-rossii/ preserves verbatim legacy body chrome after <main>');

// --- BaptistyRossiiMain.astro + _legacy/ contract ---
mustExist('src/components/baptisty-rossii/BaptistyRossiiMain.astro',
          'BaptistyRossiiMain.astro component file');
mustExist('src/components/baptisty-rossii/_legacy/main.html',
          'baptisty-rossii main.html legacy fragment');
mustExist('src/components/baptisty-rossii/_legacy/body-segment-0.html',
          'baptisty-rossii body-segment-0.html frame fragment');
mustExist('src/components/baptisty-rossii/_legacy/body-segment-1.html',
          'baptisty-rossii body-segment-1.html frame fragment');

const brMain = read('src/components/baptisty-rossii/BaptistyRossiiMain.astro');
must(brMain, "_legacy/main.html?raw",
     'BaptistyRossiiMain imports main.html verbatim via Vite ?raw');

// main.html should contain the gbs2-hero + article-header + article-body + h-article-list + research link + article-end-block
// (Note: gbs2-timeline and author-card are in SeriesArticleLayout.astro for
// INDIVIDUAL articles — /baptisty-rossii/ index is the series landing, not
// an article, so those markers are absent by design.)
const mainFragment = read('src/components/baptisty-rossii/_legacy/main.html');
for (const marker of ['main-content', 'gbs2-hero', 'article-header', 'article-body',
                      'h-article-list', 'h-article-card', 'article-end-block']) {
  must(mainFragment, marker, `main.html preserves ${marker}`);
}

// body-segment-0 should contain GBS2 chrome BEFORE main (mobile-head, rail, page-wrap open)
const segBefore = read('src/components/baptisty-rossii/_legacy/body-segment-0.html');
for (const marker of ['gbs2-mobile-head', 'gbs2-rail', 'gbs2-rtitle', 'breadcrumb']) {
  must(segBefore, marker, `body-segment-0.html preserves ${marker}`);
}

// body-segment-1 should contain GBS2 chrome AFTER main (bbar, sheet, scripts)
const segAfter = read('src/components/baptisty-rossii/_legacy/body-segment-1.html');
for (const marker of ['gbs2-bbar', 'gbs2-sheet', 'site.js']) {
  must(segAfter, marker, `body-segment-1.html preserves ${marker}`);
}

// --- Anti-regression: forbid generic Astro card grid + BaseLayout ---
for (const marker of [
  'import BaseLayout', '<BaseLayout', 'astro-card-grid',
  'class="astro-page"', 'class="astro-baptisty-shadow"',
  'astro-shell', 'astro-baptisty-rail',
]) {
  mustNot(astro, marker, `old/generic baptisty-rossii wrapper marker: ${marker}`);
}

// --- Dist (if available) — premium DOM markers ---
const dist = exists('dist/baptisty-rossii/index.html') ? read('dist/baptisty-rossii/index.html') : '';
if (dist) {
  for (const marker of ['gbs-world', 'gbs2-rail', 'gbs2-bbar', 'gbs2-sheet', 'main-content']) {
    must(dist, marker, `dist /baptisty-rossii/ marker: ${marker}`);
  }
  mustNot(dist, 'class="astro-shell"',
          'dist /baptisty-rossii/ has no astro-shell chrome (native-shadow)');
} else {
  warn('dist/baptisty-rossii/index.html not found — run npm run strangler:build before push');
}

console.log('\nBAPTISTY-ROSSII VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). /baptisty-rossii/ native-shadow contract violated.`);
  process.exit(1);
}
console.log(`✅ /baptisty-rossii/ Astro migration is native-shadow guarded (Phase 6 wave 5)`);
if (warnings.length) console.log(`ℹ️ ${warnings.length} advisory warning(s) remain.`);
