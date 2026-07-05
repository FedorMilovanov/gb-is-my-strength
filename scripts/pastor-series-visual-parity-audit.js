#!/usr/bin/env node
/*
 * Guard /pastor-series/ full-native Astro contract.
 *
 * This lane promotes /pastor-series/ from native-main-with-legacy-chrome to
 * explicit native Astro markup:
 *   - no loadLegacyFullDocument();
 *   - no `_legacy/*.html?raw` body fragment transport;
 *   - head/chrome/runtime are named Astro components;
 *   - semantic <main id="main-content"> is composed from named Astro sections.
 *
 * The root legacy HTML (`pastor-series/index.html`) remains the canonical
 * visual/text baseline for screenshot and marker parity.
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
function mustNotExist(rel, label){ !exists(rel) ? ok(`removed ${label || rel}`) : bad(`legacy file still present: ${label || rel}`); }

const page = read('src/pages/pastor-series/index.astro');
const head = read('src/components/pastor-series/PastorSeriesPageHead.astro');
const chrome = read('src/components/pastor-series/PastorSeriesPageChrome.astro');
const main = read('src/components/pastor-series/PastorSeriesMain.astro');
const cards = read('src/components/pastor-series/PastorSeriesCardsSection.astro');
const stats = read('src/components/pastor-series/PastorSeriesStatsSection.astro');
const end = read('src/components/pastor-series/PastorSeriesArticleEndBlock.astro');
const nativeText = [head, chrome, main, cards, stats, end].join('\n');
const legacy = read('pastor-series/index.html');

must(page, 'PastorSeriesPageHead', 'Astro /pastor-series/ uses native head component');
must(page, 'PastorSeriesPageChrome', 'Astro /pastor-series/ uses native chrome component');
must(page, 'PastorSeriesMain', 'Astro /pastor-series/ uses extracted PastorSeriesMain component');
mustNot(page, 'loadLegacyFullDocument', 'loadLegacyFullDocument in page');
mustNot(page, '?raw', 'raw imports in page');
mustNot(page, '_legacy/', 'legacy fragment imports in page');

mustExist('src/components/pastor-series/PastorSeriesPageHead.astro', 'PastorSeriesPageHead.astro');
mustExist('src/components/pastor-series/PastorSeriesPageChrome.astro', 'PastorSeriesPageChrome.astro');
mustExist('src/components/pastor-series/PastorSeriesMain.astro', 'PastorSeriesMain.astro');
mustExist('src/components/pastor-series/PastorSeriesCardsSection.astro', 'PastorSeriesCardsSection.astro');
mustExist('src/components/pastor-series/PastorSeriesStatsSection.astro', 'PastorSeriesStatsSection.astro');
mustExist('src/components/pastor-series/PastorSeriesArticleEndBlock.astro', 'PastorSeriesArticleEndBlock.astro');
mustNotExist('src/components/pastor-series/_legacy/body-segment-0.html', 'body-segment-0.html');
mustNotExist('src/components/pastor-series/_legacy/body-segment-1.html', 'body-segment-1.html');
mustNotExist('src/components/pastor-series/_legacy/main.html', 'main.html component fragment');

must(head, '<title>Тёмная сторона кафедры', 'native head keeps title');
must(head, 'canonical', 'native head keeps canonical');
must(head, 'application/ld+json', 'native head keeps JSON-LD');
must(head, 'SITE_CONFIG', 'native head keeps SITE_CONFIG');
must(chrome, '<nav class="h-navbar"', 'native chrome keeps navbar');
must(chrome, '<section class="h-hero"', 'native chrome keeps hero');
must(chrome, '<slot />', 'native chrome has slot for PastorSeriesMain');
must(chrome, '<footer class="h-footer"', 'native chrome keeps footer');
must(chrome, 'src="../js/site.js', 'native chrome keeps site runtime');

must(main, '<main id="main-content">', 'PastorSeriesMain preserves semantic main wrapper');
must(main, 'PastorSeriesCardsSection', 'PastorSeriesMain uses cards component');
must(main, 'PastorSeriesStatsSection', 'PastorSeriesMain uses stats component');
must(main, 'PastorSeriesArticleEndBlock', 'PastorSeriesMain uses terminal SDG block component');
mustNot(main, "import legacyHtml from './_legacy/main.html?raw'", 'raw monolithic main import removed');

for (const marker of [
  'Материалы серии',
  '20 антисоветов, как пастору разрушить своё служение',
  'Блок 2. Распознавание',
  'Блок 3. Здоровый образец',
  'Soli Deo Gloria',
]) {
  must(legacy, marker, `legacy baseline marker: ${marker}`);
  must(nativeText, marker, `native marker: ${marker}`);
}

for (const marker of ['import BaseLayout', '<BaseLayout', 'astro-card-grid']) {
  mustNot(page, marker, `forbidden page marker: ${marker}`);
  mustNot(main, marker, `forbidden main marker: ${marker}`);
}

console.log('\nPASTOR-SERIES VISUAL PARITY AUDIT');
if (problems.length) { console.log(`❌ ${problems.length} problem(s).`); process.exit(1); }
ok('/pastor-series/ is full-native Astro guarded (no legacy loader/fragments)');
