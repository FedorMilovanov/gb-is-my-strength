#!/usr/bin/env node
/* Guard /about/ near-100% full-document Astro visual parity. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function ok(msg){ console.log('✅ ' + msg); }
function bad(msg){ problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label){ haystack.includes(needle) ? ok(label || needle) : bad(`missing: ${label || needle}`); }
function mustNot(haystack, needle, label){ !haystack.includes(needle) ? ok(`no ${label || needle}`) : bad(`forbidden present: ${label || needle}`); }

const legacy = read('about/index.html');
const astro = read('src/pages/about/index.astro');
const owner = read('docs/OWNER-REQUIREMENTS.md');
const agents = read('AGENTS.md');

for (const marker of ['about-page', 'about-contacts', 'about-contact-card', 'gb-accuracy-block', 'Фёдор Милованов']) {
  must(legacy, marker, `legacy /about/ marker: ${marker}`);
}

must(astro, "loadLegacyFullDocument('about/index.html')", 'Astro /about/ uses shared full-document loader');
must(astro, '<!DOCTYPE html>', 'Astro /about/ emits full document');
must(astro, '<Fragment set:html={headHtml}', 'Astro /about/ preserves exact legacy head inner HTML');
must(astro, '<Fragment set:html={bodyHtml}', 'Astro /about/ preserves exact legacy body inner HTML');
must(read('src/utils/legacyFullDocument.ts'), 'loadLegacyFullDocument', 'shared full-document loader exists');

for (const marker of [
  'import BaseLayout', '<BaseLayout', 'astro-about-shadow', 'astro-shell', 'mainClass=', 'hideHeader=',
  'class="astro-about"', 'astro-contact-grid', 'astro-accuracy-block',
]) {
  mustNot(astro, marker, `old/generic about wrapper marker: ${marker}`);
}

must(owner, '95%+ визуального совпадения', 'owner visual parity doctrine');
must(agents, 'Astro migration — premium visual parity only', 'AGENTS premium Astro doctrine');
must(agents, '`/about/` — first visual-first Astro migration route', 'AGENTS about route doctrine');

console.log('\nABOUT VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). /about/ is not ready for 100% visual parity work.`);
  process.exit(1);
}
ok('/about/ Astro migration is full-document visual-parity guarded');
