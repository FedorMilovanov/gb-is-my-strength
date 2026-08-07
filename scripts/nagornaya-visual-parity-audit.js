#!/usr/bin/env node
/*
 * nagornaya-visual-parity-audit.js — guard /nagornaya/* 100% native Astro contract.
 *
 * V8/V9 hardening (2026-06-23): all nine Nagornaya routes are native Astro
 * documents with explicit head/chrome/main/footer or balanced body components.
 * No loadLegacyFullDocument, no ?raw imports, no _legacy fragment transport.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function ok(msg) { console.log('✅ ' + msg); }
function bad(msg) { problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label) { haystack.includes(needle) ? ok(label || needle) : bad(`missing: ${label || needle}`); }
function mustNot(haystack, needle, label) { !haystack.includes(needle) ? ok(`no ${label || needle}`) : bad(`forbidden present: ${label || needle}`); }
function mustExist(rel, label) { exists(rel) ? ok(label || rel) : bad(`missing file: ${label || rel}`); }
function mustNotExist(rel, label) { !exists(rel) ? ok(`absent: ${label || rel}`) : bad(`forbidden file/dir present: ${label || rel}`); }

const routes = [
  { slug: 'index', route: '/nagornaya/', legacy: 'nagornaya/index.html', page: 'src/pages/nagornaya/index.astro', dir: 'src/components/nagornaya/index', prefix: 'NagornayaIndex', main: 'NagornayaIndexMain' },
  { slug: 'chast-1', route: '/nagornaya/chast-1/', legacy: 'nagornaya/chast-1/index.html', page: 'src/pages/nagornaya/chast-1/index.astro', dir: 'src/components/nagornaya/chast-1', prefix: 'NagornayaChast1', main: 'NagornayaChast1MainShell' },
  { slug: 'chast-2', route: '/nagornaya/chast-2/', legacy: 'nagornaya/chast-2/index.html', page: 'src/pages/nagornaya/chast-2/index.astro', dir: 'src/components/nagornaya/chast-2', prefix: 'NagornayaChast2', main: 'NagornayaChast2MainShell' },
  { slug: 'chast-3', route: '/nagornaya/chast-3/', legacy: 'nagornaya/chast-3/index.html', page: 'src/pages/nagornaya/chast-3/index.astro', dir: 'src/components/nagornaya/chast-3', prefix: 'NagornayaChast3', main: 'NagornayaChast3MainShell' },
  { slug: 'chast-4', route: '/nagornaya/chast-4/', legacy: 'nagornaya/chast-4/index.html', page: 'src/pages/nagornaya/chast-4/index.astro', dir: 'src/components/nagornaya/chast-4', prefix: 'NagornayaChast4', main: 'NagornayaChast4MainShell' },
  { slug: 'chast-5', route: '/nagornaya/chast-5/', legacy: 'nagornaya/chast-5/index.html', page: 'src/pages/nagornaya/chast-5/index.astro', dir: 'src/components/nagornaya/chast-5', prefix: 'NagornayaChast5', main: 'NagornayaChast5MainShell' },
  { slug: 'seriya', route: '/nagornaya/seriya/', legacy: 'nagornaya/seriya/index.html', page: 'src/pages/nagornaya/seriya/index.astro', dir: 'src/components/nagornaya/seriya', prefix: 'NagornayaSeriya', main: 'NagornayaSeriyaBody' },
  { slug: 'istochniki', route: '/nagornaya/istochniki/', legacy: 'nagornaya/istochniki/index.html', page: 'src/pages/nagornaya/istochniki/index.astro', dir: 'src/components/nagornaya/istochniki', prefix: 'NagornayaIstochniki', main: 'NagornayaIstochnikiMainShell' },
  { slug: 'nakhodki', route: '/nagornaya/nakhodki/', legacy: 'nagornaya/nakhodki/index.html', page: 'src/pages/nagornaya/nakhodki/index.astro', dir: 'src/components/nagornaya/nakhodki', prefix: 'NagornayaNakhodki', main: 'NagornayaNakhodkiMainShell' },
];

mustNotExist('src/components/nagornaya/NagornayaPageMain.astro', 'old shared raw-fragment NagornayaPageMain retired');
for (const rel of ['nagornaya/chast-5/index.html']) {
  const html = read(rel);
  for (const marker of ['<<<<<<<', '=======', '>>>>>>>']) mustNot(html, marker, `${rel}: no unresolved merge marker ${marker}`);
}

for (const r of routes) {
  console.log(`\n${r.route}`);
  const legacy = read(r.legacy);
  for (const marker of ['nagornaya-page', 'main-content']) must(legacy, marker, `legacy marker: ${marker}`);

  mustExist(r.page, `${r.slug}: page exists`);
  mustExist(`${r.dir}/${r.prefix}PageHead.astro`, `${r.slug}: native PageHead`);
  mustExist(`${r.dir}/${r.prefix}PageChrome.astro`, `${r.slug}: native PageChrome`);
  mustExist(`${r.dir}/${r.main}.astro`, `${r.slug}: balanced native main/body`);
  if (r.main !== `${r.prefix}Body`) mustExist(`${r.dir}/${r.prefix}PageFooter.astro`, `${r.slug}: native PageFooter`);

  const page = read(r.page);
  const pageHead = read(`${r.dir}/${r.prefix}PageHead.astro`);
  must(page, '<!DOCTYPE html>', `${r.slug}: emits full document`);
  must(page, `${r.prefix}PageHead`, `${r.slug}: uses native PageHead`);
  must(page, r.main, `${r.slug}: uses balanced main/body component`);

  if (/^chast-[1-5]$/.test(r.slug)) {
    must(page, 'bg-stone-900', `${r.slug}: body uses dark-capable Tailwind surface`);
    mustNot(page, 'bg-stone-100', `${r.slug}: light-only body surface retired`);
    const tailwindIndex = pageHead.indexOf('/nagornaya/tw.min.css');
    const siteIndex = pageHead.indexOf('/css/site.css');
    if (tailwindIndex >= 0 && siteIndex > tailwindIndex) ok(`${r.slug}: site light-mode override loads after Tailwind`);
    else bad(`${r.slug}: expected tw.min.css before site.css for light-mode paper override`);
  }

  const files = [page, pageHead, read(`${r.dir}/${r.prefix}PageChrome.astro`), read(`${r.dir}/${r.main}.astro`)];
  if (exists(`${r.dir}/${r.prefix}PageFooter.astro`)) files.push(read(`${r.dir}/${r.prefix}PageFooter.astro`));
  for (const content of files) {
    for (const marker of ['loadLegacyFullDocument', '?raw', '_legacy/', '<Fragment set:html', 'import BaseLayout', '<BaseLayout', 'astro-card-grid', 'class="astro-page"']) {
      mustNot(content, marker, `${r.slug}: forbidden native marker ${marker}`);
    }
  }

  const distFile = `dist/${r.legacy}`;
  if (exists(distFile)) {
    const dist = read(distFile);
    must(dist, 'nagornaya-page', `${r.slug}: dist nagornaya-page marker`);
    must(dist, 'main-content', `${r.slug}: dist main-content marker`);
  }
}

const libraryThemeParts = [1, 2, 3, 5];
const libraryThemeRequired = [
  'var(--color-surface-2)',
  'var(--color-accent)',
  'var(--color-accent-strong)',
  'var(--color-accent-soft)',
  'var(--color-text)',
  'var(--color-text-muted)',
  'var(--color-border)',
  'var(--shadow-sm)',
  'color-mix(in srgb,var(--color-accent) 18%,transparent)',
  'color-mix(in srgb,var(--color-accent) 24%,var(--color-border))',
];
const libraryThemeForbidden = ['#faf8f5', '#b8882a', '#8a5c10', '#8a7968', '#1c1410', 'rgba(120,83,0,.12)', 'rgba(184,136,42,.2)', 'rgba(184,136,42,.1)'];
for (const part of libraryThemeParts) {
  const rel = `src/components/nagornaya/chast-${part}/NagornayaChast${part}MainShell.astro`;
  const source = read(rel);
  const marker = '<!-- Читайте также -->';
  const markerIndex = source.indexOf(marker);
  const sectionStart = source.indexOf('<section style="margin-top:3rem;">', markerIndex);
  const sectionEndStart = source.indexOf('</section>', sectionStart);
  if (markerIndex < 0 || sectionStart < 0 || sectionEndStart < 0) {
    bad(`chast-${part}: library section boundary missing`);
    continue;
  }
  const block = source.slice(markerIndex, sectionEndStart + '</section>'.length);
  must(block, '>Из библиотеки</span>', `chast-${part}: library heading preserved`);
  for (const token of libraryThemeRequired) must(block, token, `chast-${part}: library token ${token}`);
  for (const literal of libraryThemeForbidden) mustNot(block, literal, `chast-${part}: library light-only literal ${literal}`);
}
const part4Main = read('src/components/nagornaya/chast-4/NagornayaChast4MainShell.astro');
mustNot(part4Main, '>Из библиотеки</span>', 'chast-4: no library block introduced');

mustNotExist('src/components/nagornaya/index/_legacy', 'index _legacy deleted');
mustNotExist('src/components/nagornaya/istochniki/_legacy', 'istochniki _legacy deleted');
mustNotExist('src/components/nagornaya/nakhodki/_legacy', 'nakhodki _legacy deleted');

console.log('\nNAGORNAYA VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). /nagornaya/* native contract violated.`);
  process.exit(1);
}
ok('/nagornaya/* is 100% native Astro guarded — all 9 routes');
