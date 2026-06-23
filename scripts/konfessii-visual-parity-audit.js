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
const legacy = read('konfessii/index.html');
const page = read('src/pages/konfessii/index.astro');
const head = read('src/components/konfessii/KonfessiiPageHead.astro');
const chrome = read('src/components/konfessii/KonfessiiPageChrome.astro');
const main = read('src/components/konfessii/KonfessiiMain.astro');
must(page, 'KonfessiiPageHead', 'Astro /konfessii/ uses native head');
must(page, 'KonfessiiPageChrome', 'Astro /konfessii/ uses native page chrome');
must(page, 'KonfessiiMain', 'Astro /konfessii/ uses native main');
for (const token of ['loadLegacyFullDocument','headHtml','bodyHtml','bodyAttributes','?raw','set:html','_legacy']) { mustNot([page,head,chrome,main].join('\n'), token, `forbidden native konfessii marker: ${token}`); }
for (const marker of ['Карта Русского Баптизма','Пятидесятничество в России','Древо протестантских течений','ОТКРЫТЬ 3D-КАРТУ','СКОРО']) must(legacy, marker, `legacy main baseline marker: ${marker}`);
for (const marker of ['rel="canonical"','application/ld+json','mc.yandex.ru']) must(head, marker, `KonfessiiPageHead marker: ${marker}`);
for (const marker of ['<slot />','class="wrap"','class="hero"','article-end-sdg-wrap','footer class="k"']) must(chrome, marker, `KonfessiiPageChrome marker: ${marker}`);
for (const marker of ['<main class="grid h-reveal">','KonfessiiRusskijBaptizmCard','KonfessiiPentecostalCard','KonfessiiOverviewCard']) must(main, marker, `KonfessiiMain marker: ${marker}`);
if (exists('src/components/konfessii/_legacy')) bad('src/components/konfessii/_legacy must be retired'); else ok('src/components/konfessii/_legacy retired');
console.log('\nKONFESSII VISUAL PARITY AUDIT');
if (problems.length){ console.log(`❌ ${problems.length} problem(s). /konfessii/ strict-native contract violated.`); process.exit(1); }
console.log('✅ /konfessii/ is strict-native and guarded');
