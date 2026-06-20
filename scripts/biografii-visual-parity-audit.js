#!/usr/bin/env node
/*
 * Guard /biografii/ native-shadow Astro contract.
 * РЕФАКТОРИНГ 5.0 Phase 6, AGENTS-r249/r250.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
function ok(msg){ console.log('✅ ' + msg); }
function bad(msg){ problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label){ haystack.includes(needle) ? ok(label || needle) : bad(`missing: ${label || needle}`); }
function mustNot(haystack, needle, label){ !haystack.includes(needle) ? ok(`no ${label || needle}`) : bad(`forbidden present: ${label || needle}`); }
function mustExist(rel, label){ exists(rel) ? ok(label || rel) : bad(`missing file: ${label || rel}`); }

const legacy = read('biografii/index.html');
const astro = read('src/pages/biografii/index.astro');

// Premium markers required by visual:parity:production for /biografii/.
for (const marker of ['home-v20', 'h-hero-title', 'h-article-card', 'Джон Гилл', 'bio-cover']) {
  must(legacy, marker, `legacy /biografii/ marker: ${marker}`);
}

// Native-shadow contract.
must(astro, "loadLegacyFullDocument('biografii/index.html')", 'Astro /biografii/ uses shared full-document loader for head');
must(astro, '<!DOCTYPE html>', 'Astro /biografii/ emits full document');
must(astro, '<Fragment set:html={headHtml}', 'Astro /biografii/ preserves exact legacy head inner HTML');
must(astro, 'BiografiiMain', 'Astro /biografii/ uses extracted BiografiiMain component');
must(astro, '_legacy/body-segment-0.html', 'Astro /biografii/ preserves verbatim legacy body chrome before <main>');
must(astro, '_legacy/body-segment-1.html', 'Astro /biografii/ preserves verbatim legacy body chrome after <main>');

mustExist('src/components/biografii/BiografiiMain.astro', 'BiografiiMain.astro component file');
mustExist('src/components/biografii/_legacy/main.html', 'biografii main.html legacy fragment');
mustExist('src/components/biografii/_legacy/body-segment-0.html', 'biografii body-segment-0.html frame fragment');
mustExist('src/components/biografii/_legacy/body-segment-1.html', 'biografii body-segment-1.html frame fragment');

// Forbid generic Astro grids and BaseLayout/Header/Footer chrome — /biografii/
// is a standalone landing without site-wide nav.
for (const marker of [
  'import BaseLayout', '<BaseLayout', 'astro-card-grid', 'astro-biografii-shadow',
  'class="astro-page"',
]) {
  mustNot(astro, marker, `old/generic biografii wrapper marker: ${marker}`);
}

// Dist must still carry the premium DOM markers.
const distBio = exists('dist/biografii/index.html') ? read('dist/biografii/index.html') : '';
if (distBio) {
  for (const marker of ['home-v20', 'h-hero-title', 'h-article-card', 'Джон Гилл', 'bio-cover']) {
    must(distBio, marker, `dist /biografii/ marker: ${marker}`);
  }
  mustNot(distBio, 'astro-card-grid', 'dist /biografii/ generic regression marker absent');
}

console.log('\nBIOGRAFII VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s).`);
  process.exit(1);
}
ok('/biografii/ Astro migration is visual-parity guarded (Phase 6 native-shadow)');
