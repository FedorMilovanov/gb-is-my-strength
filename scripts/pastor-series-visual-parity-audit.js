#!/usr/bin/env node
/*
 * Guard /pastor-series/ native-shadow Astro contract.
 *
 * Refactoring 5.0 created the native-shadow route; Refactoring 6.0 parallel
 * pilot now replaces the monolithic `_legacy/main.html?raw` main block with
 * named Astro leaf components. The visual contract stays the same:
 *   - head still comes from loadLegacyFullDocument;
 *   - body chrome before/after <main> stays verbatim in body-segment fragments;
 *   - <main id="main-content"> is composed from legacy-faithful components,
 *     not a generic BaseLayout/card-grid shell.
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

const page = read('src/pages/pastor-series/index.astro');
const main = read('src/components/pastor-series/PastorSeriesMain.astro');
const legacyMain = read('src/components/pastor-series/_legacy/main.html');

must(page, "loadLegacyFullDocument('pastor-series/index.html')", 'Astro /pastor-series/ uses shared loader');
must(page, 'PastorSeriesMain', 'Astro /pastor-series/ uses extracted PastorSeriesMain component');
must(page, '_legacy/body-segment-0.html', 'preserves verbatim body chrome before <main>');
must(page, '_legacy/body-segment-1.html', 'preserves verbatim body chrome after <main>');

mustExist('src/components/pastor-series/PastorSeriesMain.astro', 'PastorSeriesMain.astro');
mustExist('src/components/pastor-series/PastorSeriesCardsSection.astro', 'PastorSeriesCardsSection.astro');
mustExist('src/components/pastor-series/PastorSeriesStatsSection.astro', 'PastorSeriesStatsSection.astro');
mustExist('src/components/pastor-series/PastorSeriesArticleEndBlock.astro', 'PastorSeriesArticleEndBlock.astro');
mustExist('src/components/pastor-series/_legacy/main.html', 'main.html legacy baseline fragment');
mustExist('src/components/pastor-series/_legacy/body-segment-0.html', 'body-segment-0.html');
mustExist('src/components/pastor-series/_legacy/body-segment-1.html', 'body-segment-1.html');

must(main, '<main id="main-content">', 'PastorSeriesMain preserves semantic main wrapper');
must(main, 'PastorSeriesCardsSection', 'PastorSeriesMain uses cards component');
must(main, 'PastorSeriesStatsSection', 'PastorSeriesMain uses stats component');
must(main, 'PastorSeriesArticleEndBlock', 'PastorSeriesMain uses terminal SDG block component');
mustNot(main, "import legacyHtml from './_legacy/main.html?raw'", 'raw monolithic main import removed');

for (const marker of [
  'Материалы серии',
  '20 антисоветов: как пастору разрушить своё служение',
  'Блок 2. Распознавание',
  'Блок 3. Здоровый образец',
  'Soli Deo Gloria',
]) {
  must(legacyMain, marker, `legacy main baseline marker: ${marker}`);
}

for (const marker of ['import BaseLayout', '<BaseLayout', 'astro-card-grid']) {
  mustNot(page, marker, `forbidden page marker: ${marker}`);
  mustNot(main, marker, `forbidden main marker: ${marker}`);
}

console.log('\nPASTOR-SERIES VISUAL PARITY AUDIT');
if (problems.length) { console.log(`❌ ${problems.length} problem(s).`); process.exit(1); }
ok('/pastor-series/ Astro migration is visual-parity guarded (native-shadow + componentized main)');
