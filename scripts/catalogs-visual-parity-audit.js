#!/usr/bin/env node
/* Guard catalog/landing routes against generic Astro card regressions. */
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

const routes = [
  {
    name: '/articles/',
    legacy: 'articles/index.html',
    astro: 'src/pages/articles/index.astro',
    sourceCall: "loadLegacyShadowPage('articles/index.html')",
    wrapper: 'astro-articles-index-shadow',
    requiredLegacy: ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card', 'h-article-list'],
  },
  {
    name: '/biografii/',
    legacy: 'biografii/index.html',
    astro: 'src/pages/biografii/index.astro',
    sourceCall: "loadLegacyShadowPage('biografii/index.html')",
    wrapper: 'astro-biografii-index-shadow',
    requiredLegacy: ['home-v20', 'h-hero-title', 'h-article-card', 'Биографии служителей', 'Джон Гилл'],
  },
];

for (const route of routes) {
  const legacy = read(route.legacy);
  const astro = read(route.astro);
  console.log(`\n${route.name}`);
  for (const marker of route.requiredLegacy) must(legacy, marker, `legacy marker: ${marker}`);
  must(astro, route.sourceCall, `${route.name} Astro uses legacy shadow source`);
  must(astro, route.wrapper, `${route.name} explicit shadow wrapper marker`);
  must(astro, 'hideHeader={true}', `${route.name} no generic Astro header`);
  must(astro, 'hideFooter={true}', `${route.name} no generic Astro footer`);
  must(astro, 'headHtml={legacy.headHtml}', `${route.name} preserves legacy head runtime/styles`);
  for (const marker of ['class="astro-page', 'astro-card-grid', 'class="astro-card', 'const cards = [', 'const eras = [', 'const gillCards = [']) {
    mustNot(astro, marker, `${route.name} old generic catalog marker: ${marker}`);
  }
}

console.log('\nCATALOGS VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). Catalog routes are not visual-parity guarded.`);
  process.exit(1);
}
ok('Catalog Astro migrations are shadow-visual-parity guarded');
