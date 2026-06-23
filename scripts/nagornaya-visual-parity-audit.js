#!/usr/bin/env node
/*
 * nagornaya-visual-parity-audit.js — guard /nagornaya/* native-shadow Astro contract.
 *
 * Refactoring 6.0 update: Nagornaya pages are in transition from the shared
 * NagornayaPageMain loader to named per-page components. This guard accepts
 * either pattern, as long as the page uses Nagornaya-specific components and
 * preserves the Tailwind sidebar world.
 *
 * Pixel parity proof (CI):
 *   npm run visual:parity:screenshots -- --routes /nagornaya/,/nagornaya/chast-N/ --threshold 0.5
 *
 * Source-only guard (no dist build required).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];
const warnings = [];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function ok(msg) { console.log('✅ ' + msg); }
function warn(msg) { warnings.push(msg); console.log('ℹ️ ' + msg); }
function bad(msg) { problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label) {
  haystack.includes(needle) ? ok(label || needle) : bad(`missing: ${label || needle}`);
}
function mustNot(haystack, needle, label) {
  !haystack.includes(needle) ? ok(`no ${label || needle}`) : bad(`forbidden present: ${label || needle}`);
}
function mustExist(rel, label) {
  exists(rel) ? ok(label || rel) : bad(`missing file: ${label || rel}`);
}

// --- Legacy /nagornaya/ premium markers (landing) ---
const legacy = read('nagornaya/index.html');
for (const marker of [
  'class="nagornaya-page', 'lg:pl-64', 'data-pagefind-body',
  'hidden lg:flex flex-col w-64',  // desktop sidebar
  'Нагорная проповедь', 'Исследование · 5 частей',
]) {
  must(legacy, marker, `legacy /nagornaya/ marker: ${marker}`);
}

// --- All 9 Nagornaya Astro pages use Nagornaya-specific components ---
const NAGORNAYA_PAGES = [
  { slug: 'index', page: 'src/pages/nagornaya/index.astro', file: 'nagornaya/index.html', components: ['NagornayaIndex'] },
  { slug: 'chast-1', page: 'src/pages/nagornaya/chast-1/index.astro', file: 'nagornaya/chast-1/index.html', components: ['NagornayaChast1'] },
  { slug: 'chast-2', page: 'src/pages/nagornaya/chast-2/index.astro', file: 'nagornaya/chast-2/index.html', components: ['NagornayaChast2'] },
  { slug: 'chast-3', page: 'src/pages/nagornaya/chast-3/index.astro', file: 'nagornaya/chast-3/index.html', components: ['NagornayaChast3'] },
  { slug: 'chast-4', page: 'src/pages/nagornaya/chast-4/index.astro', file: 'nagornaya/chast-4/index.html', components: ['NagornayaChast4'] },
  { slug: 'chast-5', page: 'src/pages/nagornaya/chast-5/index.astro', file: 'nagornaya/chast-5/index.html', components: ['NagornayaChast5'] },
  { slug: 'seriya', page: 'src/pages/nagornaya/seriya/index.astro', file: 'nagornaya/seriya/index.html', components: ['NagornayaSeriya'] },
  { slug: 'istochniki', page: 'src/pages/nagornaya/istochniki/index.astro', file: 'nagornaya/istochniki/index.html', components: ['NagornayaIstochniki'] },
  { slug: 'nakhodki', page: 'src/pages/nagornaya/nakhodki/index.astro', file: 'nagornaya/nakhodki/index.html', components: ['NagornayaNakhodki'] },
];

for (const p of NAGORNAYA_PAGES) {
  if (!exists(p.page)) {
    bad(`Nagornaya Astro page missing: ${p.page}`);
    continue;
  }
  const src = read(p.page);

  // Accept either the legacy NagornayaPageMain loader or named per-page components.
  const hasNagornayaMain = src.includes('NagornayaPageMain');
  const hasNamedComponents = p.components.some((prefix) => src.includes(`<${prefix}`));
  if (!hasNagornayaMain && !hasNamedComponents) {
    bad(`${p.slug}: must use NagornayaPageMain or named Nagornaya components (${p.components.join(', ')})`);
    continue;
  }

  // If using the legacy loader, ensure it points to the correct legacy file.
  if (hasNagornayaMain) {
    const usesLoader = src.includes("loadLegacyFullDocument('" + p.file + "')") ||
                       src.includes('loadLegacyFullDocument("' + p.file + '")');
    if (!usesLoader) {
      bad(`${p.slug}: NagornayaPageMain must use loadLegacyFullDocument('${p.file}')`);
      continue;
    }
  }

  if (!src.includes('<!DOCTYPE html>')) {
    bad(`${p.slug}: must emit full document`);
    continue;
  }
  ok(`${p.slug}: Nagornaya-specific Astro shell (${hasNagornayaMain ? 'NagornayaPageMain' : 'named components'})`);
}

// --- Shared NagornayaPageMain component must still exist for pages that use it ---
if (exists('src/components/nagornaya/NagornayaPageMain.astro')) {
  mustExist('src/components/nagornaya/NagornayaPageMain.astro',
            'NagornayaPageMain.astro shared component file');
  const nagComponent = read('src/components/nagornaya/NagornayaPageMain.astro');
  must(nagComponent, 'import.meta.glob',
       'NagornayaPageMain uses Vite import.meta.glob for per-page _legacy resolution');
  must(nagComponent, "?raw",
       'NagornayaPageMain loads fragments via Vite ?raw');
  must(nagComponent, '_legacy/main.html',
       'NagornayaPageMain loads main.html via Vite ?raw glob');
  must(nagComponent, '_legacy/body-segment-0.html',
       'NagornayaPageMain loads body-segment-0.html via Vite ?raw glob');
  must(nagComponent, '_legacy/body-segment-1.html',
       'NagornayaPageMain loads body-segment-1.html via Vite ?raw glob');
}

// --- _legacy/ fragment dirs for pages that still use NagornayaPageMain ---
for (const p of NAGORNAYA_PAGES) {
  const src = read(p.page);
  if (!src.includes('NagornayaPageMain')) continue;
  for (const file of ['main.html', 'body-segment-0.html', 'body-segment-1.html']) {
    mustExist(`src/components/nagornaya/${p.slug}/_legacy/${file}`,
              `nagornaya ${p.slug} _legacy/${file}`);
  }
}

// --- Spot-check: landing main.html + chrome must have key markers ---
const mainFragment = read('src/components/nagornaya/index/_legacy/main.html');
must(mainFragment, 'id="main-content" class="lg:pl-64"',
     'landing main.html preserves main-content with lg:pl-64');
const segBefore = read('src/components/nagornaya/index/_legacy/body-segment-0.html');
for (const marker of ['skip-link', 'hidden lg:flex flex-col w-64']) {
  must(segBefore, marker, `landing body-segment-0.html preserves ${marker}`);
}
const segAfter = read('src/components/nagornaya/index/_legacy/body-segment-1.html');
must(segAfter, 'nagornaya-mobile-toc.js',
     'landing body-segment-1.html preserves nagornaya-mobile-toc.js script');

// --- Anti-regression: forbid generic Astro card grid + BaseLayout ---
for (const p of NAGORNAYA_PAGES) {
  const src = read(p.page);
  for (const marker of [
    'import BaseLayout', '<BaseLayout', 'astro-card-grid',
    'class="astro-nagornaya-shadow"', 'class="astro-page"',
  ]) {
    mustNot(src, marker, `${p.slug}: old/generic nagornaya wrapper marker ${marker}`);
  }
}

// --- Dist (if available) — premium DOM markers ---
for (const p of NAGORNAYA_PAGES) {
  const distFile = `dist/${p.file}`;
  if (exists(distFile)) {
    const dist = read(distFile);
    if (!dist.includes('nagornaya-page')) {
      bad(`dist ${distFile}: missing nagornaya-page class`);
    }
    if (!dist.includes('main-content')) {
      bad(`dist ${distFile}: missing main-content`);
    }
  } else {
    warn(`dist/${p.file} not found — run npm run strangler:build before push`);
  }
}

console.log('\nNAGORNAYA VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). /nagornaya/ native-shadow contract violated.`);
  process.exit(1);
}
console.log(`✅ /nagornaya/* Astro migration is native-shadow guarded — all 9 pages`);
if (warnings.length) console.log(`ℹ️ ${warnings.length} advisory warning(s) remain.`);
