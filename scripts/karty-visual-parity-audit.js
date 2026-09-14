#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getKartyHubInventory } = require('../src/lib/karty-hub-inventory.cjs');

const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
function ok(msg){ console.log('✅ ' + msg); }
function bad(msg){ problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label){ haystack.includes(needle) ? ok(label || needle) : bad(`missing: ${label || needle}`); }
function mustNot(haystack, needle, label){ !haystack.includes(needle) ? ok(`no ${label || needle}`) : bad(`forbidden present: ${label || needle}`); }

const legacy = read('karty/index.html');
const page = read('src/pages/karty/index.astro');
const head = read('src/components/karty/KartyPageHead.astro');
const main = read('src/components/karty/KartyMain.astro');
const hero = read('src/components/karty/KartyHeroSection.astro');

for (const marker of ['karty-hub','karty-hero','karty-feature','karty-body','karty-note','mapsTitle','Премиальная витрина карт','Принцип раздела']) must(legacy, marker, `legacy /karty/ marker: ${marker}`);
must(page, 'KartyPageHead', 'Astro /karty/ uses native head');
must(page, 'KartyMain', 'Astro /karty/ uses KartyMain');
for (const token of ['loadLegacyFullDocument','headHtml','bodyHtml','bodyAttributes','set:html']) { mustNot([page,head,main].join('\n'), token, `forbidden native karty marker: ${token}`); }
must(head, 'rel="canonical"', 'KartyPageHead marker: canonical');
must(head, 'application/ld+json', 'KartyPageHead marker: JSON-LD');
for (const marker of ['<div class="karty-hub" data-pagefind-body>','KartyBackLink','KartyHeroSection','KartyBodySection','KartyNote']) must(main, marker, `KartyMain marker: ${marker}`);
if (exists('src/components/karty/_legacy')) bad('src/components/karty/_legacy must be retired'); else ok('src/components/karty/_legacy retired');

const inventory = getKartyHubInventory(ROOT);
if (inventory.publishedSlugs.length === 2 && inventory.publishedSlugs[0] === 'avraam' && inventory.publishedSlugs[1] === 'ishod') ok('Karty published inventory owns the audited Avraam and Ishod maps');
else bad(`unexpected published inventory: ${inventory.publishedSlugs.join(', ')}`);
for (const slug of inventory.publishedSlugs) {
  // Cards are projected from the governed inventory, so the hub owns the slug
  // once and renders one card per published map.
  if (hero.includes(`'./${slug}/'`)) ok(`Karty hub exposes a published card for ${slug}`);
  else bad(`Karty hub is missing a published card for ${slug}`);
}
for (const slug of inventory.auditSlugs) {
  if (hero.includes(`'./${slug}/'`)) bad(`Karty hub shows audit-pending map ${slug} as published`);
}
if (inventory.auditSlugs.every((slug) => !hero.includes(`'./${slug}/'`))) ok('Karty hub cards are limited to published maps');
if (inventory.routeCount === inventory.publishedCount + inventory.auditCount) ok('Karty inventory counts are internally consistent');
else bad('Karty inventory count equation failed');
if (inventory.auditSlugs.every((slug) => !inventory.publishedSlugs.includes(slug))) ok('Karty audit and published inventories are disjoint');
else bad('Karty audit/published inventories overlap');

for (const marker of [
  'getKartyHubInventory',
  'data-route-count={routeCount}',
  'data-published-count={publishedCount}',
  'data-audit-count={auditCount}',
  '<b>{publishedCount}</b><span>{publishedLabel}</span>',
  'карты открыты',
  '<b>{auditCount}</b><span>на аудите</span>',
]) must(hero, marker, `Karty hero governed inventory marker: ${marker}`);
mustNot(hero, '<b>9</b><span>на аудите</span>', 'hardcoded Karty audit count');

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'karty-inventory-'));
try {
  const writeRoute = (slug, route) => {
    const dir = path.join(fixtureRoot, 'karty', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'route.json'), JSON.stringify(route), 'utf8');
  };
  writeRoute('avraam', { meta: { id: 'avraam' } });
  writeRoute('ishod', { meta: { id: 'ishod' } });
  writeRoute('future-map', { meta: { id: 'future-map' } });
  writeRoute('sheet-draft', { meta: { sheet_no: 12 } });
  const fixture = getKartyHubInventory(fixtureRoot);
  if (
    fixture.routeCount === 3 &&
    fixture.publishedCount === 2 &&
    fixture.auditCount === 1 &&
    fixture.auditSlugs[0] === 'future-map'
  ) ok('Karty inventory automatically counts a new audit route and excludes sheet drafts');
  else bad(`Karty inventory fixture failed: ${JSON.stringify(fixture)}`);
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('\nKARTY VISUAL PARITY AUDIT');
if (problems.length){ console.log(`❌ ${problems.length} problem(s). /karty/ strict-native contract violated.`); process.exit(1); }
console.log('✅ /karty/ is strict-native and guarded');
