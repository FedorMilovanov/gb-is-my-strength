#!/usr/bin/env node
/*
 * about-visual-parity-audit.js
 *
 * First real visual-first Astro migration guard. /about/ must not regress into
 * a generic Astro content page again. Until a hand-built Astro version passes
 * screenshot parity, it must shadow-wrap the legacy premium page.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function ok(msg){ console.log('✅ ' + msg); }
function bad(msg){ problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label){
  if (haystack.includes(needle)) ok(label || needle);
  else bad(`missing: ${label || needle}`);
}
function mustNot(haystack, needle, label){
  if (!haystack.includes(needle)) ok(`no ${label || needle}`);
  else bad(`forbidden present: ${label || needle}`);
}

const legacy = read('about/index.html');
const astro = read('src/pages/about/index.astro');
const owner = read('docs/OWNER-REQUIREMENTS.md');
const agents = read('AGENTS.md');

for (const marker of ['about-page', 'about-contacts', 'about-contact-card', 'gb-accuracy-block', 'Фёдор Милованов']) {
  must(legacy, marker, `legacy /about/ marker: ${marker}`);
}

must(astro, "loadLegacyShadowPage('about/index.html')", 'Astro /about/ uses legacy shadow source');
must(astro, 'astro-about-shadow', 'Astro /about/ has explicit shadow wrapper marker');
must(astro, 'hideHeader={true}', 'Astro /about/ does not add generic Astro header');
must(astro, 'hideFooter={true}', 'Astro /about/ does not add generic Astro footer');
must(astro, 'headHtml={legacy.headHtml}', 'Astro /about/ preserves legacy head runtime/styles');
mustNot(astro, 'class="astro-about"', 'old generic astro-about article');
mustNot(astro, 'astro-contact-grid', 'old generic contact grid');
mustNot(astro, 'astro-accuracy-block', 'old generic accuracy block');

must(owner, '95%+ визуального совпадения', 'owner visual parity doctrine');
must(agents, 'Astro migration — premium visual parity only', 'AGENTS premium Astro doctrine');

console.log('\nABOUT VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). /about/ is not ready for Astro visual parity work.`);
  process.exit(1);
}
ok('/about/ Astro migration is shadow-visual-parity guarded');
