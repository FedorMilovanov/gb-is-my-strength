#!/usr/bin/env node
/*
 * Guard /biografii/ native-shadow Astro contract.
 *
 * Refactoring 6.0 parallel pilot now replaces raw landing fragment imports with
 * hand-authored Astro components that preserve the premium biography DOM/copy.
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
for (const rel of [
  'BiografiiRecentSection.astro','BiografiiFocusSection.astro','BiografiiEraStubSection.astro',
  'BiografiiAwakeningSection.astro','BiografiiEpigraphSection.astro','BiografiiArticleEndBlock.astro'
]) {
  mustExist(`src/components/biografii/${rel}`, rel);
}
mustExist('src/components/biografii/_legacy/main.html', 'biografii main.html legacy baseline');
mustExist('src/components/biografii/_legacy/body-segment-0.html', 'biografii body-segment-0.html frame fragment');
mustExist('src/components/biografii/_legacy/body-segment-1.html', 'biografii body-segment-1.html frame fragment');

must(main, '<main id="main-content">', 'BiografiiMain preserves semantic main wrapper');
for (const comp of ['BiografiiRecentSection','BiografiiFocusSection','BiografiiEraStubSection','BiografiiAwakeningSection','BiografiiEpigraphSection','BiografiiArticleEndBlock']) {
  must(main, comp, `BiografiiMain uses ${comp}`);
}
for (const banned of ['recent.html?raw','focus.html?raw','ancient.html?raw','medieval.html?raw','reformation.html?raw','awakening.html?raw','modern.html?raw','contemporary.html?raw','epigraph.html?raw','post-article.html?raw']) {
  mustNot(main, banned, `removed raw import: ${banned}`);
}
mustNot(main, "import legacyHtml from './_legacy/main.html?raw'", 'raw monolithic main import removed');

for (const marker of ['dzhon-gill-series', 'Редакционный фокус', 'era-ancient', 'era-contemporary', 'Soli Deo Gloria']) {
  must(baseline, marker, `main baseline marker: ${marker}`);
}
for (const [file, marker] of [
  ['src/components/biografii/BiografiiRecentSection.astro','dzhon-gill-series'],
  ['src/components/biografii/BiografiiFocusSection.astro','Редакционный фокус'],
  ['src/components/biografii/BiografiiAwakeningSection.astro','era-awakening'],
  ['src/components/biografii/BiografiiEpigraphSection.astro','Эпиграф раздела'],
  ['src/components/biografii/BiografiiArticleEndBlock.astro','Soli Deo Gloria'],
]) {
  must(read(file), marker, `${path.basename(file)} marker: ${marker}`);
}
must(read('src/components/biografii/BiografiiEraStubSection.astro'), 'Архив эпохи', 'BiografiiEraStubSection marker: Архив эпохи');
for (const marker of ['I–V вв.','VI–XIV вв.','XV–XVII вв.','XIX в.','XX–XXI вв.','Ранняя Церковь','Средние века','Реформация','XIX век','XX–XXI вв.']) {
  must(main, marker, `BiografiiMain era config marker: ${marker}`);
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
