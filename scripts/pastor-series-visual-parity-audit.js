#!/usr/bin/env node
/* Guard /pastor-series/ native-shadow Astro contract. Phase 6, AGENTS-r250. */
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

const astro = read('src/pages/pastor-series/index.astro');

must(astro, "loadLegacyFullDocument('pastor-series/index.html')", 'Astro /pastor-series/ uses shared loader');
must(astro, 'PastorSeriesMain', 'Astro /pastor-series/ uses extracted PastorSeriesMain component');
must(astro, '_legacy/body-segment-0.html', 'preserves verbatim body chrome before <main>');
must(astro, '_legacy/body-segment-1.html', 'preserves verbatim body chrome after <main>');

mustExist('src/components/pastor-series/PastorSeriesMain.astro', 'PastorSeriesMain.astro');
mustExist('src/components/pastor-series/_legacy/main.html', 'main.html legacy fragment');
mustExist('src/components/pastor-series/_legacy/body-segment-0.html', 'body-segment-0.html');
mustExist('src/components/pastor-series/_legacy/body-segment-1.html', 'body-segment-1.html');

for (const marker of ['import BaseLayout', '<BaseLayout', 'astro-card-grid']) {
  mustNot(astro, marker, `forbidden: ${marker}`);
}

console.log('\nPASTOR-SERIES VISUAL PARITY AUDIT');
if (problems.length) { console.log(`❌ ${problems.length} problem(s).`); process.exit(1); }
ok('/pastor-series/ Astro migration is visual-parity guarded (Phase 6 native-shadow)');
