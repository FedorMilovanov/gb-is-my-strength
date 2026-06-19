#!/usr/bin/env node
/* Guard /articles/ against generic Astro catalog regressions. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function ok(msg){ console.log('✅ ' + msg); }
function bad(msg){ problems.push(msg); console.log('❌ ' + msg); }
function must(h, n, label){ h.includes(n) ? ok(label || n) : bad(`missing: ${label || n}`); }
function mustNot(h, n, label){ !h.includes(n) ? ok(`no ${label || n}`) : bad(`forbidden present: ${label || n}`); }

const legacy = read('articles/index.html');
const astro = read('src/pages/articles/index.astro');

for (const marker of ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card', 'h-article-list']) {
  must(legacy, marker, `legacy /articles/ marker: ${marker}`);
}
must(astro, "loadLegacyShadowPage('articles/index.html')", 'Astro /articles/ uses legacy shadow source');
must(astro, 'astro-articles-index-shadow', 'Astro /articles/ explicit shadow wrapper marker');
must(astro, 'hideHeader={true}', 'Astro /articles/ does not add generic Astro header');
must(astro, 'hideFooter={true}', 'Astro /articles/ does not add generic Astro footer');
must(astro, 'headHtml={legacy.headHtml}', 'Astro /articles/ preserves legacy head runtime/styles');
for (const marker of ['class="astro-page', 'astro-card-grid', 'class="astro-card', 'const cards = [']) {
  mustNot(astro, marker, `old generic articles catalog marker: ${marker}`);
}

console.log('\nARTICLES INDEX VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). /articles/ is not visual-parity guarded.`);
  process.exit(1);
}
ok('/articles/ Astro migration is shadow-visual-parity guarded');
