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

// Catalog routes are now fully-native Astro pages. Guard them against any
// regression back to legacy head/body transport or generic astro-card shells.
const routes = [
  {
    name: '/articles/',
    legacy: 'articles/index.html',
    astro: 'src/pages/articles/index.astro',
    requiredLegacy: ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card', 'h-article-list'],
    requiredAstro: ['ArticlesPageChrome', 'ArticlesMain', 'ArticlesPageFooter'],
  },
  {
    name: '/biografii/',
    legacy: 'biografii/index.html',
    astro: 'src/pages/biografii/index.astro',
    requiredLegacy: ['home-v20', 'h-hero-title', 'h-article-card', 'Биографии служителей', 'Джон Гилл'],
    requiredAstro: ['BiografiiPageChrome', 'BiografiiMain', 'BiografiiPageFooter'],
  },
];

for (const route of routes) {
  const legacy = read(route.legacy);
  const astro = read(route.astro);
  console.log(`\n${route.name}`);
  for (const marker of route.requiredLegacy) must(legacy, marker, `legacy marker: ${marker}`);
  must(astro, '<!DOCTYPE html>', `${route.name} emits full document`);
  for (const marker of route.requiredAstro) must(astro, marker, `${route.name} uses ${marker}`);
  for (const marker of [
    'loadLegacyFullDocument', 'headHtml', 'bodyHtml', 'bodyAttributes', '?raw', '_legacy/', 'set:html',
    'import BaseLayout', '<BaseLayout', 'astro-shell', 'mainClass=', 'hideHeader=', 'hideFooter=',
    'class="astro-page', 'astro-card-grid', 'class="astro-card', 'const cards = [', 'const eras = [', 'const gillCards = [',
  ]) {
    mustNot(astro, marker, `${route.name} old/generic catalog marker: ${marker}`);
  }
}

console.log('\nCATALOGS VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). Catalog routes are not 100% native guarded.`);
  process.exit(1);
}
ok('Catalog Astro migrations are 100% native and guarded');
