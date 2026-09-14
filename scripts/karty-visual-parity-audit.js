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
if (JSON.stringify(inventory.readySlugs) === JSON.stringify(['avraam','ishod'])) ok('Karty technical-ready inventory owns Avraam and Ishod');
else bad(`unexpected ready inventory: ${inventory.readySlugs.join(', ')}`);
if (JSON.stringify(inventory.publishedSlugs) === JSON.stringify(['avraam'])) ok('Karty hub inventory exposes only owner-approved Avraam');
else bad(`unexpected hub-published inventory: ${inventory.publishedSlugs.join(', ')}`);
if (inventory.auditSlugs.includes('ishod')) ok('Karty hub withholds technically-ready Exodus until owner approval');
else bad('Karty hub must keep Exodus withheld until owner approval');
if (inventory.routeCount === inventory.publishedCount + inventory.auditCount) ok('Karty hub inventory counts are internally consistent');
else bad('Karty hub inventory count equation failed');
if (inventory.auditSlugs.every((slug) => !inventory.publishedSlugs.includes(slug))) ok('Karty audit and hub-published inventories are disjoint');
else bad('Karty audit/hub-published inventories overlap');

for (const marker of [
  'getKartyHubInventory',
  'publishedRecords',
  'data-route-count={routeCount}',
  'data-published-count={publishedCount}',
  'data-audit-count={auditCount}',
  '<b>{publishedCount}</b><span>{publishedLabel(publishedCount)}</span>',
  '<b>{auditCount}</b><span>на аудите</span>',
  'data-karty-published={record.slug}',
]) must(hero, marker, `Karty hero governed inventory marker: ${marker}`);
mustNot(hero, 'PUBLISHED_KARTY_SLUGS', 'hardcoded published slug allowlist');
mustNot(hero, 'PUBLISHED_CARDS', 'hardcoded published card registry');
mustNot(hero, '<b>9</b><span>на аудите</span>', 'hardcoded Karty audit count');

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'karty-inventory-'));
try {
  const writeRoute = (slug, route) => {
    const dir = path.join(fixtureRoot, 'karty', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'route.json'), JSON.stringify(route), 'utf8');
  };
  writeRoute('avraam', { meta: { id: 'avraam' }, publication: {"status":"ready","indexable":true,"sitemap":true,"llms":false,"pagefind":true,"hub":"featured"} });
  writeRoute('ishod', { meta: { id: 'ishod' }, publication: {"status":"ready","indexable":true,"sitemap":true,"llms":false,"pagefind":true,"hub":"withheld"} });
  writeRoute('future-map', { meta: { id: 'future-map' }, publication: {"status":"temporary-placeholder","indexable":false,"sitemap":false,"llms":false,"pagefind":false,"hub":"withheld"} });
  writeRoute('sheet-draft', { meta: { sheet_no: 12 }, publication: {"status":"draft","indexable":false,"sitemap":false,"llms":false,"pagefind":false,"hub":"withheld"} });
  const fixture = getKartyHubInventory(fixtureRoot);
  if (
    fixture.routeCount === 3 &&
    fixture.readyCount === 2 &&
    fixture.publishedCount === 1 &&
    fixture.auditCount === 2 &&
    JSON.stringify(fixture.publishedSlugs) === JSON.stringify(['avraam']) &&
    fixture.auditSlugs.includes('ishod') &&
    fixture.auditSlugs.includes('future-map')
  ) ok('Karty inventory separates technical readiness, owner-approved hub publication and sheet drafts');
  else bad(`Karty inventory fixture failed: ${JSON.stringify(fixture)}`);
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('\nKARTY VISUAL PARITY AUDIT');
if (problems.length){ console.log(`❌ ${problems.length} problem(s). /karty/ strict-native contract violated.`); process.exit(1); }
console.log('✅ /karty/ is strict-native and guarded');
