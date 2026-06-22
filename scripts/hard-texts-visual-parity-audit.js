#!/usr/bin/env node
/*
 * Guard /hard-texts/ native-shadow Astro contract.
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

const page = read('src/pages/hard-texts/index.astro');
const main = read('src/components/hard-texts/HardTextsMain.astro');
const legacyMain = read('src/components/hard-texts/_legacy/main.html');

must(page, "loadLegacyFullDocument('hard-texts/index.html')", 'Astro /hard-texts/ uses shared loader');
must(page, 'HardTextsMain', 'Astro /hard-texts/ uses extracted HardTextsMain component');
must(page, '_legacy/body-segment-0.html', 'preserves verbatim body chrome before <main>');
must(page, '_legacy/body-segment-1.html', 'preserves verbatim body chrome after <main>');

mustExist('src/components/hard-texts/HardTextsMain.astro', 'HardTextsMain.astro');
mustExist('src/components/hard-texts/HardTextsCardsSection.astro', 'HardTextsCardsSection.astro');
mustExist('src/components/hard-texts/HardTextsStatsSection.astro', 'HardTextsStatsSection.astro');
mustExist('src/components/hard-texts/HardTextsSeriesMapSection.astro', 'HardTextsSeriesMapSection.astro');
mustExist('src/components/hard-texts/HardTextsArticleEndBlock.astro', 'HardTextsArticleEndBlock.astro');
mustExist('src/components/hard-texts/_legacy/main.html', 'main.html legacy baseline fragment');
mustExist('src/components/hard-texts/_legacy/body-segment-0.html', 'body-segment-0.html');
mustExist('src/components/hard-texts/_legacy/body-segment-1.html', 'body-segment-1.html');

must(main, '<main id="main-content">', 'HardTextsMain preserves semantic main wrapper');
must(main, 'HardTextsCardsSection', 'HardTextsMain uses cards component');
must(main, 'HardTextsStatsSection', 'HardTextsMain uses stats component');
must(main, 'HardTextsSeriesMapSection', 'HardTextsMain uses GBS timeline component');
must(main, 'HardTextsArticleEndBlock', 'HardTextsMain uses terminal SDG block component');
mustNot(main, "import legacyHtml from './_legacy/main.html?raw'", 'raw monolithic main import removed');

for (const marker of [
  'Материалы серии',
  'Крайне ли испорчено моё сердце — если я уже верующий?',
  'Римлянам 7: верующий, неверующий или человек под законом?',
  'Карта серии',
  'Soli Deo Gloria',
]) {
  must(legacyMain, marker, `legacy main baseline marker: ${marker}`);
}

for (const marker of ['import BaseLayout', '<BaseLayout', 'astro-card-grid']) {
  mustNot(page, marker, `forbidden page marker: ${marker}`);
  mustNot(main, marker, `forbidden main marker: ${marker}`);
}

console.log('\nHARD-TEXTS VISUAL PARITY AUDIT');
if (problems.length) { console.log(`❌ ${problems.length} problem(s).`); process.exit(1); }
ok('/hard-texts/ Astro migration is visual-parity guarded (native-shadow + componentized main)');
