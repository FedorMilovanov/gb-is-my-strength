#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint for the historical Baptist-series shadow audit.
 *
 * The routes are strict-native Astro routes. Legacy HTML is a reference and
 * immutable content-floor witness, not production truth. This command delegates
 * to the effective production-like native route audit for series articles.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATE_SURFACES = [
  'BaptistyRossiiNochNaKure',
  'BaptistyRossiiYuzhnayaShtunda',
  'BaptistyRossiiDvaSezda1884',
  'BaptistyRossiiPeterburgskayaLiniya',
  'BaptistyRossiiGoneniyaISovest',
  'BaptistyRossiiSovetskayaNoch',
  'BaptistyRossiiVsehib1944',
  'BaptistyRossiiIniciativnayaGruppa',
  'BaptistyRossiiPodpolnayaPechat',
  'BaptistyRossiiSpravochnik',
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function auditVisibleDates() {
  const errors = [];
  for (const stem of DATE_SURFACES) {
    const body = read(`src/components/baptisty-rossii/${stem}Body.astro`);
    const head = read(`src/components/baptisty-rossii/${stem}PageHead.astro`);
    const published = head.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})T/);
    const modified = head.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})T/);
    const byline = body.match(/<(?:p|div) class="article-byline reveal">([\s\S]*?)(?:<\/p>|<\/div>)/);

    if (!published || !modified || !byline) {
      errors.push(`${stem}: missing datePublished/dateModified/article-byline authority`);
      continue;
    }

    const visibleDates = [...byline[1].matchAll(/<time\b[^>]*datetime="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
    if (visibleDates[0] !== published[1]) {
      errors.push(`${stem}: visible published date ${visibleDates[0] || 'MISSING'} != JSON-LD ${published[1]}`);
    }

    if (modified[1] !== published[1]) {
      if (!byline[1].includes('article-updated article-byline__updated')) {
        errors.push(`${stem}: dateModified differs from datePublished but visible “Обновлено” block is missing`);
      }
      if (visibleDates[1] !== modified[1]) {
        errors.push(`${stem}: visible modified date ${visibleDates[1] || 'MISSING'} != JSON-LD ${modified[1]}`);
      }
    }
  }

  if (errors.length) {
    console.error('❌ Baptist visible-date contract failed:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`✅ Baptist visible-date contract: ${DATE_SURFACES.length} surfaces match PageHead publication/update authority`);
}

// Baptist visible-date contract: reader-facing dates must not drift from JSON-LD.
auditVisibleDates();

if (!process.argv.includes('--series-only')) process.argv.push('--series-only');
console.log('ℹ️ astro:audit:baptisty-series now runs the effective strict-native series article contract audit.');
require('./article-native-effective-contract-audit');
