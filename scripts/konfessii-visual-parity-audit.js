#!/usr/bin/env node
/*
 * Guard /konfessii/ native-shadow Astro contract.
 *
 * /konfessii/ is a standalone HTML page with its own inline <style> (no
 * css/site.css), so the Pagefind sr-only div MUST keep its inline visually
 * hidden style (see r247 fix). Refactoring 6.0 parallel pilot now replaces the
 * monolithic `_legacy/main.html?raw` main grid with named Astro leaf cards.
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

const page = read('src/pages/konfessii/index.astro');
const main = read('src/components/konfessii/KonfessiiMain.astro');
const legacyMain = read('src/components/konfessii/_legacy/main.html');

must(page, "loadLegacyFullDocument('konfessii/index.html')", 'Astro /konfessii/ uses shared loader');
must(page, 'KonfessiiMain', 'Astro /konfessii/ uses extracted KonfessiiMain component');
must(page, '_legacy/body-segment-0.html', 'preserves verbatim body chrome before <main>');
must(page, '_legacy/body-segment-1.html', 'preserves verbatim body chrome after <main>');
must(page, 'position:absolute;left:-9999px', 'Pagefind sr-only carries inline visually-hidden style');

mustExist('src/components/konfessii/KonfessiiMain.astro', 'KonfessiiMain.astro');
mustExist('src/components/konfessii/KonfessiiRusskijBaptizmCard.astro', 'KonfessiiRusskijBaptizmCard.astro');
mustExist('src/components/konfessii/KonfessiiPentecostalCard.astro', 'KonfessiiPentecostalCard.astro');
mustExist('src/components/konfessii/KonfessiiOverviewCard.astro', 'KonfessiiOverviewCard.astro');
mustExist('src/components/konfessii/_legacy/main.html', 'main.html legacy fragment');
mustExist('src/components/konfessii/_legacy/body-segment-0.html', 'body-segment-0.html');
mustExist('src/components/konfessii/_legacy/body-segment-1.html', 'body-segment-1.html');

must(main, '<main class="grid h-reveal">', 'KonfessiiMain preserves semantic grid wrapper');
must(main, 'KonfessiiRusskijBaptizmCard', 'KonfessiiMain uses live baptist card component');
must(main, 'KonfessiiPentecostalCard', 'KonfessiiMain uses pentecostal card component');
must(main, 'KonfessiiOverviewCard', 'KonfessiiMain uses overview card component');
mustNot(main, "import legacyHtml from './_legacy/main.html?raw'", 'raw monolithic main import removed');

for (const marker of [
  'Карта Русского Баптизма',
  'Пятидесятничество в России',
  'Древо протестантских течений',
  'ОТКРЫТЬ 3D-КАРТУ',
  'СКОРО',
]) {
  must(legacyMain, marker, `legacy main baseline marker: ${marker}`);
}

for (const marker of ['import BaseLayout', '<BaseLayout', 'astro-card-grid', 'astro-shell']) {
  mustNot(page, marker, `forbidden page marker: ${marker}`);
  mustNot(main, marker, `forbidden main marker: ${marker}`);
}

console.log('\nKONFESSII VISUAL PARITY AUDIT');
if (problems.length) { console.log(`❌ ${problems.length} problem(s).`); process.exit(1); }
ok('/konfessii/ Astro migration is visual-parity guarded (native-shadow + componentized main)');
