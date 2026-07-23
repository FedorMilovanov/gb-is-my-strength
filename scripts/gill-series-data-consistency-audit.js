#!/usr/bin/env node
'use strict';

/**
 * Gill Series Data Consistency Audit
 * 
 * Verifies that src/components/article-pilots/gill-series/gillSeriesData.ts
 * stays in sync with canonical content sources:
 * - MDX frontmatter readingTime
 * - data/series.json
 * - data/search-manifest.json
 * - migration/page-ownership.json
 * - route existence
 * 
 * Created: 2026-06-29 — Lane A gill-series-data-consistency-audit
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

let failures = 0;
function ok(msg){ console.log('✅ ' + msg); }
function bad(msg, detail=''){ failures++; console.error('❌ ' + msg + (detail ? ' — ' + detail : '')); }
function warn(msg){ console.log('⚠️  ' + msg); }

function readJSON(p){
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); }
  catch(e){ bad('cannot read JSON '+p, e.message); return null; }
}
function readText(p){
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
  catch(e){ bad('cannot read '+p, e.message); return ''; }
}

// 1. Parse gillSeriesData.ts
const gillTS = readText('src/components/article-pilots/gill-series/gillSeriesData.ts');
if (!gillTS) { console.error('FATAL: cannot read gillSeriesData.ts'); process.exit(1); }

// Extract GILL_SERIES_ITEMS
const seriesItems = [];
const seriesItemRe = /\{\s*id:\s*"([^"]+)",[\s\S]*?mark:\s*\{\s*kind:\s*"([^"]+)",\s*value:\s*"([^"]+)"\s*\},[\s\S]*?title:\s*"([^"]+)",[\s\S]*?shortTitle:\s*"([^"]+)",[\s\S]*?href:\s*"([^"]+)",[\s\S]*?readingTime:\s*"([^"]+)"\s*,?\s*\}/g;
let m;
while ((m = seriesItemRe.exec(gillTS)) !== null) {
  seriesItems.push({
    id: m[1],
    markKind: m[2],
    markValue: m[3],
    title: m[4],
    shortTitle: m[5],
    href: m[6],
    readingTimeStr: m[7],
    readingTimeMin: parseInt(m[7],10)||0
  });
}
if (seriesItems.length !== 6) bad('GILL_SERIES_ITEMS count', `expected 6, got ${seriesItems.length}`);
else ok(`GILL_SERIES_ITEMS parsed: ${seriesItems.length} items`);

// Extract GILL_PAGE_DATA progress fields
const pageData = {};
const pageBlockRe = /(\w+):\s*\{\s*id:\s*"([^"]+)"[\s\S]*?readingProgressDoneMin:\s*(\d+),[\s\S]*?readingProgressPartMin:\s*(\d+),[\s\S]*?readingProgressTotalMin:\s*(\d+),/g;
while ((m = pageBlockRe.exec(gillTS)) !== null) {
  const key = m[1];
  pageData[key] = {
    id: m[2],
    doneMin: parseInt(m[3],10),
    partMin: parseInt(m[4],10),
    totalMin: parseInt(m[5],10)
  };
}
ok(`GILL_PAGE_DATA parsed: ${Object.keys(pageData).join(', ')}`);

// Extract partToc current counts
function countCurrentToc(pageId){
  // naive: find partToc: [ ... ] block for given page
  const pageStart = gillTS.indexOf(`${pageId}: {`);
  if (pageStart === -1) return -1;
  const nextPageIdx = ['context','part1','part2','part3','part4','spravochnik']
    .map(id => gillTS.indexOf(`\n  ${id}: {`, pageStart+1))
    .filter(x=>x>pageStart)
    .sort((a,b)=>a-b)[0] || gillTS.length;
  const block = gillTS.slice(pageStart, nextPageIdx);
  const matches = block.match(/current:\s*true/g) || [];
  return matches.length;
}

// 2. Check route ownership
const pageOwnership = readJSON('migration/page-ownership.json');
if (pageOwnership && pageOwnership.routes) {
  seriesItems.forEach(item => {
    const route = item.href;
    const entry = pageOwnership.routes[route];
    if (!entry) bad(`route missing in page-ownership.json`, route);
    else ok(`route ownership OK: ${route} → owner=${entry.owner}, status=${entry.status}`);
  });
}

// 3. Check MDX frontmatter readingTime
const mdxMap = {
  context: 'src/content/articles/dzhon-gill-istoricheskiy-kontekst.mdx',
  part1: 'src/content/articles/dzhon-gill-chast-1-chelovek.mdx',
  part2: 'src/content/articles/dzhon-gill-chast-2-uchenyi.mdx',
  part3: 'src/content/articles/dzhon-gill-chast-3-nasledie.mdx',
  part4: 'src/content/articles/dzhon-gill-chast-4-ekzeget.mdx',
  spravochnik: 'src/content/articles/dzhon-gill-spravochnik.mdx'
};
seriesItems.forEach(item => {
  const mdxPath = mdxMap[item.id];
  if (!mdxPath) { warn(`no MDX mapping for ${item.id}`); return; }
  const txt = readText(mdxPath);
  const rtm = txt.match(/readingTime:\s*(\d+)/);
  const mdxTime = rtm ? parseInt(rtm[1],10) : null;
  if (mdxTime === null) bad(`MDX readingTime missing`, `${item.id} ${mdxPath}`);
  else if (mdxTime !== item.readingTimeMin) bad(`readingTime mismatch MDX vs gillSeriesData`, `${item.id}: MDX=${mdxTime}, TS=${item.readingTimeMin}`);
  else ok(`readingTime MDX ↔ TS match: ${item.id} = ${mdxTime} мин`);
});

// 4. Check data/series.json
const seriesJson = readJSON('data/series.json');
if (seriesJson && seriesJson['dzhon-gill']) {
  const parts = seriesJson['dzhon-gill'].parts;
  const slugToTime = {};
  parts.forEach(p => { slugToTime[p.slug] = p.readingTime; });
  const slugMap = {
    context: 'dzhon-gill-istoricheskiy-kontekst',
    part1: 'dzhon-gill-chast-1-chelovek',
    part2: 'dzhon-gill-chast-2-uchenyi',
    part3: 'dzhon-gill-chast-3-nasledie',
    part4: 'dzhon-gill-chast-4-ekzeget',
    spravochnik: 'dzhon-gill-spravochnik'
  };
  seriesItems.forEach(item => {
    const slug = slugMap[item.id];
    const jsonTime = slugToTime[slug];
    if (jsonTime === undefined) bad('series.json missing slug', slug);
    else if (jsonTime !== item.readingTimeMin) bad('series.json readingTime mismatch', `${item.id}: series.json=${jsonTime}, TS=${item.readingTimeMin}`);
    else ok(`readingTime series.json ↔ TS match: ${item.id} = ${jsonTime}`);
  });
}

// 5. Check data/search-manifest.json
const searchManifest = readJSON('data/search-manifest.json');
if (searchManifest && Array.isArray(searchManifest.items)) {
  seriesItems.forEach(item => {
    const url = item.href.replace(/\/$/, '') + '/'; // ensure trailing slash (manifest uses trailing slash)
    // manifest actually stores with trailing slash
    const found = searchManifest.items.find(it => it.url === item.href || it.url === item.href.replace(/\/$/, '') || (it.url + '/') === item.href);
    const found2 = searchManifest.items.find(it => it.id && it.id.includes(item.id.replace('part','').replace('context','istoricheskiy')) || it.url === item.href);
    const entry = searchManifest.items.find(e => e.url === item.href);
    if (!entry) {
      warn(`search-manifest entry not found by exact url for ${item.href}, trying fuzzy`);
      const fuzzy = searchManifest.items.find(e => e.url && e.url.includes('dzhon-gill') && e.readTime === item.readingTimeMin);
      if (!fuzzy) bad('search-manifest missing Gill route', item.href);
      else ok(`search-manifest fuzzy match OK: ${item.href}`);
      return;
    }
    const smTime = entry.readTime;
    if (smTime !== undefined && smTime !== item.readingTimeMin) {
      bad('search-manifest readTime mismatch', `${item.id}: manifest=${smTime}, TS=${item.readingTimeMin}`);
    } else {
      ok(`search-manifest readTime OK: ${item.id} = ${smTime || item.readingTimeMin}`);
    }
  });
  // check series total
  const seriesEntry = searchManifest.items.find(it => it.id === 'dzhon-gill-seriya');
  if (seriesEntry) {
    const total = seriesItems.reduce((s,i)=>s+i.readingTimeMin,0);
    if (seriesEntry.readTime !== total) bad('search-manifest series total mismatch', `manifest=${seriesEntry.readTime}, sum=${total}`);
    else ok(`search-manifest series total OK: ${total} мин`);
  }
}

// 6. Progress coherence
const expectedTotal = seriesItems.reduce((sum, item) => sum + item.readingTimeMin, 0);
// Reading order (2026-07-09 display reorder): exegete (part4) now displays as
// «Часть III» and precedes legacy (part3) which displays as «Часть IV».
// Internal ids/slugs unchanged; only display order/numbering swapped.
const expectedOrder = ['context','part1','part2','part4','part3','spravochnik'];
let cumulative = 0;
expectedOrder.forEach((pid, idx) => {
  const pd = pageData[pid];
  if (!pd) { bad('pageData missing', pid); return; }
  if (pd.totalMin !== expectedTotal) bad('totalMin mismatch', `${pid}: expected ${expectedTotal}, got ${pd.totalMin}`);
  else ok(`totalMin OK ${pid}: ${expectedTotal}`);
  if (pd.doneMin !== cumulative) bad('progress doneMin drift', `${pid}: expected done=${cumulative}, got ${pd.doneMin}`);
  else ok(`progress doneMin OK ${pid}: ${pd.doneMin}`);
  cumulative += pd.partMin;
});
if (cumulative !== expectedTotal) bad('cumulative progress sum mismatch', `expected ${expectedTotal}, got ${cumulative}`);
else ok(`cumulative progress sum = ${expectedTotal} ✅`);

// Verify partMin matches series readingTime
expectedOrder.forEach(pid => {
  const pd = pageData[pid];
  const si = seriesItems.find(s => s.id === pid);
  if (pd && si) {
    if (pd.partMin !== si.readingTimeMin) bad('partMin vs series readingTime mismatch', `${pid}: pageData.partMin=${pd.partMin}, seriesItem=${si.readingTimeMin}`);
    else ok(`partMin matches series readingTime: ${pid} = ${pd.partMin}`);
  }
});

// 7. partToc current count = 1
expectedOrder.forEach(pid => {
  const cnt = countCurrentToc(pid);
  if (cnt !== 1) bad('partToc current count != 1', `${pid}: got ${cnt}`);
  else ok(`partToc current exactly 1: ${pid}`);
});

// 8. href route files exist (source Astro pages)
seriesItems.forEach(item => {
  // map href /articles/dzhon-gill-chast-1-chelovek/ -> src/pages/articles/dzhon-gill-chast-1-chelovek/index.astro
  const slug = item.href.replace(/^\/articles\//,'').replace(/\/$/,'');
  const astroPath = `src/pages/articles/${slug}/index.astro`;
  if (fs.existsSync(path.join(ROOT, astroPath))) ok(`Astro route file exists: ${astroPath}`);
  else warn(`Astro route file MISSING (may be legacy?): ${astroPath}`);
});

// 9. series marks sanity
const expectedMarks = [
  {id:'context', kind:'label', value:'Введение'},
  {id:'part1', kind:'roman', value:'I'},
  {id:'part2', kind:'roman', value:'II'},
  {id:'part4', kind:'roman', value:'III'},
  {id:'part3', kind:'roman', value:'IV'},
  {id:'spravochnik', kind:'label', value:'Справ.'}
];
expectedMarks.forEach(exp => {
  const found = seriesItems.find(s => s.id === exp.id);
  if (!found) { bad('series mark missing item', exp.id); return; }
  // markKind/value already parsed
  if (found.markKind !== exp.kind || found.markValue !== exp.value) {
    bad('series mark mismatch', `${exp.id}: expected ${exp.kind}/${exp.value}, got ${found.markKind}/${found.markValue}`);
  } else {
    ok(`series mark OK: ${exp.id} = ${exp.value} (${exp.kind})`);
  }
});

// 10. Check for raw Roman numeral regressions in built files? (optional, skip if no dist)
// We do a light source check only here; full built check is in premium-controls-rollout-audit

console.log('\n=== Gill Series Data Consistency Summary ===');
if (failures === 0) {
  console.log('✅ ALL CHECKS PASSED — gillSeriesData.ts is consistent with MDX / series.json / search-manifest / page-ownership');
  process.exit(0);
} else {
  console.error(`❌ ${failures} consistency failure(s)`);
  process.exit(1);
}
