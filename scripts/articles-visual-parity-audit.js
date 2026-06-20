#!/usr/bin/env node
/* Guard /articles/ native-shadow Astro contract. Phase 6 wave 3, AGENTS-r251. */
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

const legacy = read('articles/index.html');
const astro = read('src/pages/articles/index.astro');

for (const marker of ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card', 'h-article-list']) {
  must(legacy, marker, `legacy /articles/ marker: ${marker}`);
}

must(astro, "loadLegacyFullDocument('articles/index.html')", 'Astro /articles/ uses shared loader');
must(astro, 'ArticlesMain', 'Astro /articles/ uses extracted ArticlesMain component');
must(astro, '_legacy/body-segment-0.html', 'preserves verbatim body chrome before <main>');
must(astro, '_legacy/body-segment-1.html', 'preserves verbatim body chrome after <main>');

mustExist('src/components/articles/ArticlesMain.astro', 'ArticlesMain.astro');
mustExist('src/components/articles/_legacy/main.html', 'main.html legacy fragment');
mustExist('src/components/articles/_legacy/body-segment-0.html', 'body-segment-0.html');
mustExist('src/components/articles/_legacy/body-segment-1.html', 'body-segment-1.html');

for (const marker of ['import BaseLayout', '<BaseLayout', 'astro-card-grid', 'astro-shell']) {
  mustNot(astro, marker, `forbidden: ${marker}`);
}

const dist = exists('dist/articles/index.html') ? read('dist/articles/index.html') : '';
if (dist) {
  for (const marker of ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card']) {
    must(dist, marker, `dist /articles/ marker: ${marker}`);
  }
  mustNot(dist, 'astro-card-grid', 'dist /articles/ generic regression marker absent');
}

console.log('\nARTICLES VISUAL PARITY AUDIT');
if (problems.length) { console.log(`❌ ${problems.length} problem(s).`); process.exit(1); }
ok('/articles/ Astro migration is visual-parity guarded (Phase 6 native-shadow)');
