#!/usr/bin/env node
/*
 * Guard /articles/ native-shadow Astro contract.
 *
 * Refactoring 6.0 parallel pilot now replaces raw catalog fragment imports with
 * hand-authored Astro components that preserve the premium legacy DOM/copy.
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

const legacy = read('articles/index.html');
const page = read('src/pages/articles/index.astro');
const main = read('src/components/articles/ArticlesMain.astro');
const baseline = read('src/components/articles/_legacy/main.html');

for (const marker of ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card', 'h-article-list']) {
  must(legacy, marker, `legacy /articles/ marker: ${marker}`);
}

must(page, "loadLegacyFullDocument('articles/index.html')", 'Astro /articles/ uses shared loader');
must(page, 'ArticlesMain', 'Astro /articles/ uses extracted ArticlesMain component');
must(page, '_legacy/body-segment-0.html', 'preserves verbatim body chrome before <main>');
must(page, '_legacy/body-segment-1.html', 'preserves verbatim body chrome after <main>');

mustExist('src/components/articles/ArticlesMain.astro', 'ArticlesMain.astro');
mustExist('src/components/articles/ArticlesHeroSection.astro', 'ArticlesHeroSection.astro');
mustExist('src/components/articles/ArticlesPublicationsSection.astro', 'ArticlesPublicationsSection.astro');
mustExist('src/components/articles/ArticlesRefutationsSection.astro', 'ArticlesRefutationsSection.astro');
mustExist('src/components/articles/ArticlesArticleEndBlock.astro', 'ArticlesArticleEndBlock.astro');
mustExist('src/components/articles/_legacy/main.html', 'main.html legacy baseline');
mustExist('src/components/articles/_legacy/body-segment-0.html', 'body-segment-0.html');
mustExist('src/components/articles/_legacy/body-segment-1.html', 'body-segment-1.html');

must(main, '<main id="main-content">', 'ArticlesMain preserves semantic main wrapper');
for (const comp of ['ArticlesHeroSection','ArticlesPublicationsSection','ArticlesRefutationsSection','ArticlesArticleEndBlock']) {
  must(main, comp, `ArticlesMain uses ${comp}`);
}
for (const banned of ['hero.html?raw','publications.html?raw','refutations.html?raw','post-article.html?raw']) {
  mustNot(main, banned, `removed raw import: ${banned}`);
}
mustNot(main, "import legacyHtml from './_legacy/main.html?raw'", 'raw monolithic main import removed');

for (const marker of ['Каталог статей', 'Публикации', 'Разбор заблуждений', 'Soli Deo Gloria']) {
  must(baseline, marker, `main baseline marker: ${marker}`);
}
for (const [file, marker] of [
  ['src/components/articles/ArticlesHeroSection.astro','h-hero-title'],
  ['src/components/articles/ArticlesPublicationsSection.astro','id="publikacii"'],
  ['src/components/articles/ArticlesPublicationsSection.astro','Нагорная проповедь — полная серия'],
  ['src/components/articles/ArticlesRefutationsSection.astro','id="razbor"'],
  ['src/components/articles/ArticlesRefutationsSection.astro','историческая подмена'],
  ['src/components/articles/ArticlesArticleEndBlock.astro','Soli Deo Gloria'],
]) {
  must(read(file), marker, `${path.basename(file)} marker: ${marker}`);
}

for (const marker of ['import BaseLayout', '<BaseLayout', 'astro-card-grid', 'astro-shell']) {
  mustNot(page, marker, `forbidden: ${marker}`);
  mustNot(main, marker, `forbidden main marker: ${marker}`);
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
ok('/articles/ Astro migration is visual-parity guarded (componentized catalog main)');
