#!/usr/bin/env node
/*
 * Guard /biografii/ native-shadow Astro contract.
 *
 * Refactoring 5.0 promoted /biografii/ to a native-shadow landing route.
 * Refactoring 6.0 parallel pilot now replaces the monolithic
 * `_legacy/main.html?raw` import with named legacy-faithful fragments for the
 * Gill shelf, editorial focus, era sections and epigraph/post block.
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
const page = read('src/pages/biografii/index.astro');
const main = read('src/components/biografii/BiografiiMain.astro');
const baseline = read('src/components/biografii/_legacy/main.html');

for (const marker of ['home-v20', 'h-hero-title', 'h-article-card', 'Джон Гилл', 'bio-cover']) {
  must(legacy, marker, `legacy /biografii/ marker: ${marker}`);
}

must(page, "loadLegacyFullDocument('biografii/index.html')", 'Astro /biografii/ uses shared full-document loader for head');
must(page, '<!DOCTYPE html>', 'Astro /biografii/ emits full document');
must(page, '<Fragment set:html={headHtml}', 'Astro /biografii/ preserves exact legacy head inner HTML');
must(page, 'BiografiiMain', 'Astro /biografii/ uses extracted BiografiiMain component');
must(page, '_legacy/body-segment-0.html', 'Astro /biografii/ preserves verbatim legacy body chrome before <main>');
must(page, '_legacy/body-segment-1.html', 'Astro /biografii/ preserves verbatim legacy body chrome after <main>');

mustExist('src/components/biografii/BiografiiMain.astro', 'BiografiiMain.astro component file');
mustExist('src/components/biografii/_legacy/main.html', 'biografii main.html legacy baseline');
for (const rel of ['recent.html','focus.html','ancient.html','medieval.html','reformation.html','awakening.html','modern.html','contemporary.html','epigraph.html','post-article.html']) {
  mustExist(`src/components/biografii/_legacy/${rel}`, rel);
}
mustExist('src/components/biografii/_legacy/body-segment-0.html', 'biografii body-segment-0.html frame fragment');
mustExist('src/components/biografii/_legacy/body-segment-1.html', 'biografii body-segment-1.html frame fragment');

must(main, '<main id="main-content">', 'BiografiiMain preserves semantic main wrapper');
for (const frag of ['recent.html?raw','focus.html?raw','ancient.html?raw','medieval.html?raw','reformation.html?raw','awakening.html?raw','modern.html?raw','contemporary.html?raw','epigraph.html?raw','post-article.html?raw']) {
  must(main, frag, `BiografiiMain uses ${frag}`);
}
mustNot(main, "import legacyHtml from './_legacy/main.html?raw'", 'raw monolithic main import removed');

for (const marker of ['dzhon-gill-series', 'Редакционный фокус', 'era-ancient', 'era-contemporary', 'Soli Deo Gloria']) {
  must(baseline, marker, `main baseline marker: ${marker}`);
}
for (const [file, marker] of [
  ['recent.html','dzhon-gill-series'],
  ['focus.html','Редакционный фокус'],
  ['ancient.html','era-ancient'],
  ['medieval.html','era-medieval'],
  ['reformation.html','era-reformation'],
  ['awakening.html','era-awakening'],
  ['modern.html','era-modern'],
  ['contemporary.html','era-contemporary'],
  ['epigraph.html','Эпиграф раздела'],
  ['post-article.html','Soli Deo Gloria'],
]) {
  must(read(`src/components/biografii/_legacy/${file}`), marker, `${file} marker: ${marker}`);
}

for (const marker of [
  'import BaseLayout', '<BaseLayout', 'astro-card-grid', 'astro-biografii-shadow',
  'class="astro-page"',
]) {
  mustNot(page, marker, `old/generic biografii wrapper marker: ${marker}`);
  mustNot(main, marker, `old/generic biografii main marker: ${marker}`);
}

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
ok('/biografii/ Astro migration is visual-parity guarded (componentized landing main)');
