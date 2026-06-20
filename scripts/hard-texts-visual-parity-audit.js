#!/usr/bin/env node
/* Guard /hard-texts/ native-shadow Astro contract. Phase 6, AGENTS-r250. */
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

const astro = read('src/pages/hard-texts/index.astro');

must(astro, "loadLegacyFullDocument('hard-texts/index.html')", 'Astro /hard-texts/ uses shared loader');
must(astro, 'HardTextsMain', 'Astro /hard-texts/ uses extracted HardTextsMain component');
must(astro, '_legacy/body-segment-0.html', 'preserves verbatim body chrome before <main>');
must(astro, '_legacy/body-segment-1.html', 'preserves verbatim body chrome after <main>');

mustExist('src/components/hard-texts/HardTextsMain.astro', 'HardTextsMain.astro');
mustExist('src/components/hard-texts/_legacy/main.html', 'main.html legacy fragment');
mustExist('src/components/hard-texts/_legacy/body-segment-0.html', 'body-segment-0.html');
mustExist('src/components/hard-texts/_legacy/body-segment-1.html', 'body-segment-1.html');

for (const marker of ['import BaseLayout', '<BaseLayout', 'astro-card-grid']) {
  mustNot(astro, marker, `forbidden: ${marker}`);
}

console.log('\nHARD-TEXTS VISUAL PARITY AUDIT');
if (problems.length) { console.log(`❌ ${problems.length} problem(s).`); process.exit(1); }
ok('/hard-texts/ Astro migration is visual-parity guarded (Phase 6 native-shadow)');
