#!/usr/bin/env node
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
const legacy = read('karty/index.html');
const page = read('src/pages/karty/index.astro');
const head = read('src/components/karty/KartyPageHead.astro');
const main = read('src/components/karty/KartyMain.astro');
for (const marker of ['karty-hub','karty-hero','karty-feature','karty-body','karty-note','mapsTitle','Премиальная витрина карт','Принцип раздела']) must(legacy, marker, `legacy /karty/ marker: ${marker}`);
must(page, 'KartyPageHead', 'Astro /karty/ uses native head');
must(page, 'KartyMain', 'Astro /karty/ uses KartyMain');
for (const token of ['loadLegacyFullDocument','headHtml','bodyHtml','bodyAttributes','set:html']) { mustNot([page,head,main].join('\n'), token, `forbidden native karty marker: ${token}`); }
must(head, 'rel="canonical"', 'KartyPageHead marker: canonical');
must(head, 'application/ld+json', 'KartyPageHead marker: JSON-LD');
for (const marker of ['<div class="karty-hub" data-pagefind-body>','KartyBackLink','KartyHeroSection','KartyBodySection','KartyNote']) must(main, marker, `KartyMain marker: ${marker}`);
if (exists('src/components/karty/_legacy')) bad('src/components/karty/_legacy must be retired'); else ok('src/components/karty/_legacy retired');
console.log('\nKARTY VISUAL PARITY AUDIT');
if (problems.length){ console.log(`❌ ${problems.length} problem(s). /karty/ strict-native contract violated.`); process.exit(1); }
console.log('✅ /karty/ is strict-native and guarded');
