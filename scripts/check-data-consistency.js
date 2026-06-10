#!/usr/bin/env node
/**
 * Data consistency audit: read time drift between HTML, Pagefind metadata,
 * search-manifest.json and series.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const issues = [];
function fail(kind, detail) { issues.push({ kind, detail }); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function routeToFile(url) {
  const clean = String(url || '').split('#')[0].replace(/^\//, '').replace(/\/$/, '');
  if (!clean) return 'index.html';
  return clean + '/index.html';
}
function extractHtmlReadTimes(file) {
  if (!exists(file)) return null;
  const html = read(file);
  const times = {};
  const config = html.match(/(?:"readingTime"|readingTime)\s*:\s*(\d+)/);
  if (config) times.config = Number(config[1]);
  const pagefind = html.match(/<span\s+data-pagefind-meta=["']readTime["']\s+hidden>(\d+)<\/span>/i);
  if (pagefind) times.pagefind = Number(pagefind[1]);
  const byline = html.match(/[⏱⏳]\s*(\d+)\s*мин/);
  if (byline) times.visible = Number(byline[1]);
  return times;
}
function canonicalFromHtml(file, fallback) {
  const t = extractHtmlReadTimes(file) || {};
  return t.config ?? t.pagefind ?? t.visible ?? fallback ?? null;
}
function assertEqual(label, values) {
  const present = Object.entries(values).filter(([,v]) => Number.isFinite(v));
  if (present.length < 2) return;
  const first = present[0][1];
  const bad = present.filter(([,v]) => v !== first);
  if (bad.length) fail('read-time-drift', `${label}: ${present.map(([k,v]) => `${k}=${v}`).join(', ')}`);
}

const searchRaw = JSON.parse(read('data/search-manifest.json'));
const searchItems = Array.isArray(searchRaw) ? searchRaw : (searchRaw.items || []);
const searchByUrl = new Map(searchItems.map(i => [i.url, i]));
const series = JSON.parse(read('data/series.json'));

// 1. HTML internal consistency + search-manifest consistency for every manifest URL with local HTML.
for (const item of searchItems) {
  const url = item.url;
  if (!url || !url.startsWith('/')) continue;
  const file = routeToFile(url);
  if (!exists(file)) continue;
  const htmlTimes = extractHtmlReadTimes(file) || {};
  const canonical = canonicalFromHtml(file, item.readTime);
  assertEqual(`${file}`, { ...htmlTimes, search: item.readTime });
  if (Number.isFinite(canonical) && Number.isFinite(item.readTime) && item.readTime !== canonical) {
    fail('search-manifest-read-time-drift', `${url}: search=${item.readTime}, html=${canonical}`);
  }
}

// 2. Series part consistency against matching HTML/search item.
for (const [key, info] of Object.entries(series)) {
  const base = info.baseUrl || '/';
  let total = 0;
  for (const part of info.parts || []) {
    if (part.status !== 'published') continue;
    const url = `${base}${part.slug}/`;
    const file = routeToFile(url);
    const search = searchByUrl.get(url);
    const canonical = canonicalFromHtml(file, search && search.readTime);
    if (Number.isFinite(canonical)) {
      total += canonical;
      if (Number.isFinite(part.readingTime) && part.readingTime !== canonical) {
        fail('series-read-time-drift', `${key}/${part.slug}: series=${part.readingTime}, html=${canonical}`);
      }
      if (!Number.isFinite(part.readingTime)) {
        fail('series-missing-reading-time', `${key}/${part.slug}`);
      }
    }
    if (search && Number.isFinite(canonical) && Number.isFinite(search.readTime) && search.readTime !== canonical) {
      fail('series-search-read-time-drift', `${url}: search=${search.readTime}, html=${canonical}`);
    }
  }
  // Known series landing search URLs.
  const landingUrl = key === 'nagornaya' ? '/nagornaya/seriya/'
    : key === 'dzhon-gill' ? '/biografii/#dzhon-gill-series'
    : key === 'pastor-series' ? '/pastor-series/'
    : null;
  if (landingUrl && searchByUrl.has(landingUrl)) {
    const st = searchByUrl.get(landingUrl).readTime;
    if (Number.isFinite(st) && total && st !== total) {
      fail('series-landing-total-drift', `${landingUrl}: manifest=${st}, sum(parts)=${total}`);
    }
  }
}

console.log('\nGB DATA CONSISTENCY AUDIT');
if (issues.length) {
  const by = issues.reduce((a,i)=>(a[i.kind]=(a[i.kind]||0)+1,a),{});
  console.log(`❌ ${issues.length} issue(s)`, by);
  issues.forEach(i => console.log(`- ${i.kind}: ${i.detail}`));
  process.exit(1);
}
console.log('✅ Data consistency passed');
