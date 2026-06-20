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

// Two acceptable native-shadow contracts for catalog routes:
//   - "full-shadow"   — body wrapped via <Fragment set:html={bodyHtml}> from
//     loadLegacyFullDocument. Still used by routes that haven't started their
//     shadow→native pilot (e.g. /articles/).
//   - "native-shadow" — Phase 6 pilot: head still from loadLegacyFullDocument,
//     body composed from body-segment-*.html chrome + named main component
//     (e.g. /biografii/ → BiografiiMain).
// Both must keep the legacy premium DOM markers, both must avoid the generic
// astro-card / BaseLayout class.
const routes = [
  {
    name: '/articles/',
    legacy: 'articles/index.html',
    astro: 'src/pages/articles/index.astro',
    sourceCall: "loadLegacyFullDocument('articles/index.html')",
    requiredLegacy: ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card', 'h-article-list'],
    bodyContract: 'full-shadow',
  },
  {
    name: '/biografii/',
    legacy: 'biografii/index.html',
    astro: 'src/pages/biografii/index.astro',
    sourceCall: "loadLegacyFullDocument('biografii/index.html')",
    requiredLegacy: ['home-v20', 'h-hero-title', 'h-article-card', 'Биографии служителей', 'Джон Гилл'],
    bodyContract: 'native-shadow',
    nativeMainComponent: 'BiografiiMain',
  },
];

must(read('src/utils/legacyFullDocument.ts'), 'loadLegacyFullDocument', 'shared full-document loader exists');
for (const route of routes) {
  const legacy = read(route.legacy);
  const astro = read(route.astro);
  console.log(`\n${route.name}`);
  for (const marker of route.requiredLegacy) must(legacy, marker, `legacy marker: ${marker}`);
  must(astro, route.sourceCall, `${route.name} Astro uses legacy full-document source`);
  must(astro, '<!DOCTYPE html>', `${route.name} emits full document`);
  must(astro, '<Fragment set:html={headHtml}', `${route.name} preserves legacy head`);
  if (route.bodyContract === 'native-shadow') {
    must(astro, route.nativeMainComponent, `${route.name} uses extracted ${route.nativeMainComponent} component`);
    must(astro, 'body-segment-0.html', `${route.name} preserves verbatim body chrome before <main>`);
    must(astro, 'body-segment-1.html', `${route.name} preserves verbatim body chrome after <main>`);
  } else {
    must(astro, '<Fragment set:html={bodyHtml}', `${route.name} preserves legacy body`);
  }
  for (const marker of [
    'import BaseLayout', '<BaseLayout', 'astro-shell', 'mainClass=', 'hideHeader=', 'hideFooter=',
    'class="astro-page', 'astro-card-grid', 'class="astro-card', 'const cards = [', 'const eras = [', 'const gillCards = [',
  ]) {
    mustNot(astro, marker, `${route.name} old/generic catalog marker: ${marker}`);
  }
}

console.log('\nCATALOGS VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). Catalog routes are not visual-parity guarded.`);
  process.exit(1);
}
ok('Catalog Astro migrations are full-document visual-parity guarded');
