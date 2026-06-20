#!/usr/bin/env node
/* Guard /konfessii/ native-shadow Astro contract. Phase 6 wave 3, AGENTS-r251.
 *
 * /konfessii/ is a standalone HTML page with its own inline <style> (no
 * css/site.css), so the Pagefind sr-only div MUST keep its inline visually
 * hidden style (see r247 fix). The audit asserts this so future agents can't
 * silently regress.
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

const astro = read('src/pages/konfessii/index.astro');

must(astro, "loadLegacyFullDocument('konfessii/index.html')", 'Astro /konfessii/ uses shared loader');
must(astro, 'KonfessiiMain', 'Astro /konfessii/ uses extracted KonfessiiMain component');
must(astro, '_legacy/body-segment-0.html', 'preserves verbatim body chrome before <main>');
must(astro, '_legacy/body-segment-1.html', 'preserves verbatim body chrome after <main>');
// Phase 5 r247 fix MUST be preserved on standalone pages without css/site.css.
must(astro, 'position:absolute;left:-9999px', 'Pagefind sr-only carries inline visually-hidden style');

mustExist('src/components/konfessii/KonfessiiMain.astro', 'KonfessiiMain.astro');
mustExist('src/components/konfessii/_legacy/main.html', 'main.html legacy fragment');
mustExist('src/components/konfessii/_legacy/body-segment-0.html', 'body-segment-0.html');
mustExist('src/components/konfessii/_legacy/body-segment-1.html', 'body-segment-1.html');

for (const marker of ['import BaseLayout', '<BaseLayout', 'astro-card-grid', 'astro-shell']) {
  mustNot(astro, marker, `forbidden: ${marker}`);
}

console.log('\nKONFESSII VISUAL PARITY AUDIT');
if (problems.length) { console.log(`❌ ${problems.length} problem(s).`); process.exit(1); }
ok('/konfessii/ Astro migration is visual-parity guarded (Phase 6 native-shadow)');
