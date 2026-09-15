#!/usr/bin/env node
'use strict';
/**
 * Anchor policy (WU-3.3 / D-06): published pastor-series article pages expose only
 * hand-written latin heading ids. Satteri's built-in heading-ids plugin assigns an
 * auto slug (Cyrillic for Russian headings, e.g. id="коротко"; counter-suffixed for
 * repeated headings) to every heading without an explicit id. Those auto ids are
 * fragile and are not referenced by any anchor: partToc/outline cards link to the
 * hand-written latin ids only (verified: no in-MDX anchor links, no consumer reads
 * the auto slugs).
 *
 * The Satteri stack forbids markdown.rehypePlugins config overrides (see
 * astro7-satteri-contract.mjs), so this postbuild step strips non-latin id
 * attributes from h1-h6 elements on the series' MDX-rendered dist pages.
 * Explicit latin ids are untouched. The G-2 dist guard keeps this verified.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = [
  '/articles/anatomiya-padeniya-pyat-stadiy/index.html',
  '/articles/teksty-pisaniya-kotorymi-manipuliruyut/index.html',
  '/articles/sem-tipov-razlichenie-uchiteley/index.html',
  '/articles/cerkovnaya-disciplina-vlast-granicy-zashchita/index.html',
  '/articles/kogda-uhodit-kogda-ostavatsya/index.html',
  '/articles/vernye-i-neizvestnye-zdorovoe-pastyrstvo/index.html',
  '/articles/priznaki-zdorovoy-cerkvi/index.html',
  '/articles/nesovershennyy-chelovek-v-nesovershennoy-cerkvi/index.html',
];

const NON_LATIN_ID = /(<h[1-6][^>]*?)\s+id="([^"]*[^\x00-\x7F][^"]*)"/g;
const RESIDUAL = /<h[1-6][^>]*\sid="[^"]*[^\x00-\x7F][^"]*"/g;

let stripped = 0;
for (const rel of PAGES) {
  const file = path.join(ROOT, 'dist', rel);
  if (!fs.existsSync(file)) {
    console.error(`❌ pastor-series heading id hygiene: missing dist page: ${rel}`);
    process.exit(1);
  }
  const html = fs.readFileSync(file, 'utf8');
  const next = html.replace(NON_LATIN_ID, (match, pre) => {
    stripped += 1;
    return pre;
  });
  const residual = next.match(RESIDUAL);
  if (residual) {
    console.error(`❌ pastor-series heading id hygiene: residual non-latin heading ids in ${rel}:`, residual.slice(0, 5));
    process.exit(1);
  }
  if (next !== html) fs.writeFileSync(file, next);
}
console.log(`✅ pastor-series heading id hygiene: ${PAGES.length} pages, ${stripped} auto non-latin heading ids stripped`);
