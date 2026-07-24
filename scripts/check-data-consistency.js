#!/usr/bin/env node
/**
 * Data consistency audit: read time drift between HTML, Pagefind metadata,
 * search-manifest.json and series.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { legacyIsAuthoritative, loadRouteProfile } = require('./lib/legacy-source-authority');
const ROOT = path.resolve(__dirname, '..');
const issues = [];
function fail(kind, detail) { issues.push({ kind, detail }); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

function routePathForHtmlFile(file) {
  const clean = String(file || '').replace(/\\/g, '/').replace(/\/index\.html$/, '/');
  return clean === 'index.html' ? '/' : '/' + clean;
}
function normalizeInternalHref(baseRoute, href) {
  if (!href || /^(https?:|mailto:|tel:|#)/i.test(href)) return '';
  if (href.startsWith('/')) return href.endsWith('/') || /\.[a-z0-9]+$/i.test(href) ? href : href + '/';
  const joined = path.posix.normalize(path.posix.join(baseRoute, href));
  const out = joined.startsWith('/') ? joined : '/' + joined;
  return out.endsWith('/') || /\.[a-z0-9]+$/i.test(out) ? out : out + '/';
}

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
function canonicalForRoute(url, file, fallback) {
  const { profile } = loadRouteProfile(url);
  if (!legacyIsAuthoritative(profile)) {
    return Number.isFinite(fallback) ? fallback : null;
  }
  return canonicalFromHtml(file, fallback);
}
function assertEqual(label, values) {
  const present = Object.entries(values).filter(([,v]) => Number.isFinite(v));
  if (present.length < 2) return;
  const first = present[0][1];
  const bad = present.filter(([,v]) => v !== first);
  if (bad.length) fail('read-time-drift', `${label}: ${present.map(([k,v]) => `${k}=${v}`).join(', ')}`);
}

function textOfFirstH1(file) {
  if (!exists(file)) return '';
  const html = read(file);
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return '';
  return m[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'.,:;!?()\[\]{}]/g, ' ')
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function isLocalImage(img) {
  return typeof img === 'string' && /^\/images\//.test(img);
}
function dateValue(s) {
  const t = Date.parse(String(s || ''));
  return Number.isFinite(t) ? t : null;
}

const searchRaw = JSON.parse(read('data/search-manifest.json'));
const searchItems = Array.isArray(searchRaw) ? searchRaw : (searchRaw.items || []);
const searchByUrl = new Map(searchItems.map(i => [i.url, i]));
const series = JSON.parse(read('data/series.json'));

// 0. Basic manifest integrity: stable unique IDs/URLs, no stale generatedAt.
{
  const seenIds = new Set();
  const seenUrls = new Set();
  let maxModified = null;
  for (const item of searchItems) {
    if (!item.id) fail('search-item-missing-id', JSON.stringify(item).slice(0, 160));
    if (!item.url) fail('search-item-missing-url', item.id || '(no id)');
    if (seenIds.has(item.id)) fail('search-item-duplicate-id', item.id);
    if (seenUrls.has(item.url)) fail('search-item-duplicate-url', item.url);
    seenIds.add(item.id);
    seenUrls.add(item.url);
    for (const key of ['title', 'description', 'section']) {
      if (typeof item[key] === 'string' && /[\r\n\t]/.test(item[key])) {
        fail('search-item-control-char', `${item.url} ${key}`);
      }
    }
    if (item.image && isLocalImage(item.image) && !exists(item.image.replace(/^\//, ''))) {
      fail('search-item-image-missing', `${item.url}: ${item.image}`);
    }
    const mv = dateValue(item.modifiedTime);
    if (mv !== null && (maxModified === null || mv > maxModified)) maxModified = mv;
  }
  if (!Array.isArray(searchRaw) && searchRaw.generatedAt && maxModified !== null) {
    const gv = dateValue(searchRaw.generatedAt);
    if (gv !== null && gv < maxModified) {
      fail('search-manifest-generatedAt-stale', `generatedAt=${searchRaw.generatedAt}, max modifiedTime=${new Date(maxModified).toISOString()}`);
    }
  }
}

// 0b. Series data must be reviewable and free of embedded newlines in labels.
for (const [key, info] of Object.entries(series)) {
// 0c. Guard against readTime vs readingTime alias conflict in search-manifest.
// Both field names exist in codebase. Different values = publication defect.
{
  for (const item of searchItems) {
    if (Number.isFinite(item.readTime) && Number.isFinite(item.readingTime) && item.readTime !== item.readingTime) {
      fail('search-item-readtime-alias-drift', `${item.id || item.url}: readTime=${item.readTime}, readingTime=${item.readingTime}`);
    }
  }
}
  if (!info.title) fail('series-missing-title', key);
  if (/[\r\n\t]/.test(info.title || '')) fail('series-title-control-char', key);
  for (const part of info.parts || []) {
    if (!part.slug) fail('series-part-missing-slug', key);
    if (!part.title) fail('series-part-missing-title', `${key}/${part.slug || '(no slug)'}`);
    if (/[\r\n\t]/.test(part.title || '')) fail('series-part-title-control-char', `${key}/${part.slug}`);
  }
}

// 1. HTML internal consistency + search-manifest consistency for every manifest URL with local HTML.
for (const item of searchItems) {
  const url = item.url;
  if (!url || !url.startsWith('/')) continue;
  const file = routeToFile(url);
  if (!exists(file)) continue;
  const h1 = textOfFirstH1(file);
  if (item.type === 'article' && h1) {
    const nt = norm(item.title);
    const nh = norm(h1);
    // Titles may add category/subtitle, but should at least contain the H1 core or vice versa.
    if (nh.length > 12 && nt.length > 12 && !nt.includes(nh) && !nh.includes(nt)) {
      const hCore = nh.split(' ').filter(w => w.length > 3).slice(0, 3);
      if (!hCore.every(w => nt.includes(w))) fail('search-title-h1-drift', `${item.url}: h1="${h1}", manifest="${item.title}"`);
    }
  }
  const { profile } = loadRouteProfile(url);
  const authoritativeLegacy = legacyIsAuthoritative(profile);
  const htmlTimes = extractHtmlReadTimes(file) || {};
  const canonical = canonicalForRoute(url, file, item.readTime);
  if (authoritativeLegacy) {
    assertEqual(`${file}`, { ...htmlTimes, search: item.readTime });
    if (Number.isFinite(canonical) && Number.isFinite(item.readTime) && item.readTime !== canonical) {
      fail('search-manifest-read-time-drift', `${url}: search=${item.readTime}, html=${canonical}`);
    }
  }
}



// 1b. Command-palette hardcoded fallback recommendations must not drift from
// search-manifest. They are used only when manifest loading fails, but stale
// values still leak into UI during outages/offline states.
{
  const searchJs = exists('js/search.js') ? read('js/search.js') : '';
  const fallbackRe = /url:"([^"]+)"[\s\S]{0,700}?readTime:(\d+)/g;
  let m;
  while ((m = fallbackRe.exec(searchJs)) !== null) {
    const url = m[1];
    const readTime = Number(m[2]);
    const item = searchByUrl.get(url);
    if (!item) continue;
    if (Number.isFinite(item.readTime) && readTime !== item.readTime) {
      fail('search-js-fallback-read-time-drift', `${url}: js=${readTime}, manifest=${item.readTime}`);
    }
  }
}



// 1c. Related-article cards must not display stale read times when the linked
// target has a canonical search-manifest readTime. These cards are visible UI,
// unlike command-palette fallbacks, so drift is a publication defect.
{
  const htmlFiles = [];
  function walkHtml(dir) {
    for (const ent of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (ent.name.startsWith('.') || ['node_modules','dist','reports','audit','pagefind'].includes(ent.name)) continue;
      const rel = path.posix.join(dir, ent.name);
      const abs = path.join(ROOT, rel);
      if (ent.isDirectory()) walkHtml(rel);
      else if (ent.isFile() && rel.endsWith('.html')) htmlFiles.push(rel);
    }
  }
  for (const top of ['articles', 'nagornaya', 'src/components']) if (exists(top)) walkHtml(top);
  const itemRe = /<li\b[^>]*class=["'][^"']*related-articles__item[^"']*["'][^>]*>[\s\S]*?<\/li>/gi;
  for (const file of htmlFiles) {
    const html = read(file);
    const baseRoute = routePathForHtmlFile(file.startsWith('src/components/') ? file.replace(/^src\/components\//, '') : file);
    let m;
    while ((m = itemRe.exec(html)) !== null) {
      const block = m[0];
      const href = block.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1] || '';
      const shown = block.match(/related-articles__tag[^>]*>[^<]*?(\d+)\s*мин/i)?.[1];
      const url = normalizeInternalHref(baseRoute, href);
      const target = searchByUrl.get(url);
      if (target && Number.isFinite(target.readTime) && shown && Number(shown) !== target.readTime) {
        fail('related-card-read-time-drift', `${file} → ${url}: card=${shown}, manifest=${target.readTime}`);
      }
    }
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
    const { profile } = loadRouteProfile(url);
    const projectionFallback = !legacyIsAuthoritative(profile) && Number.isFinite(part.readingTime)
      ? part.readingTime
      : (search && search.readTime);
    const canonical = canonicalForRoute(url, file, projectionFallback);
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

// 2b. Links graph consistency.
{
  const graphRaw = JSON.parse(read('data/links-graph.json'));
  const graphNodes = graphRaw.nodes || [];
  for (const node of graphNodes) {
    if (node.url && searchByUrl.has(node.url)) {
      const searchItem = searchByUrl.get(node.url);
      const graphTime = node.readingTime;
      const searchTime = searchItem.readTime;
      if (Number.isFinite(graphTime) && Number.isFinite(searchTime) && graphTime !== searchTime) {
        fail('links-graph-read-time-drift', `${node.url}: graph=${graphTime}, manifest=${searchTime}`);
      }
    }
  }
}

console.log('\nGB DATA CONSISTENCY AUDIT');

// DATA-SERIES-DRIFT guard (2026-07-05): series.json keys and SERIES_ORDER
// (src/data/site.ts) must stay in sync. Known intentional exceptions are
// listed below with reasons; any NEW asymmetry fails.
{
  const seriesJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'series.json'), 'utf8'));
  const siteTs = fs.readFileSync(path.join(ROOT, 'src', 'data', 'site.ts'), 'utf8');
  const om = siteTs.match(/SERIES_ORDER[^=]*=\s*\{([\s\S]*?)\n\};/);
  const orderKeys = om ? [...om[1].matchAll(/^  '([^']+)':/gm)].map(m => m[1]) : [];
  if (!orderKeys.length) fail('series-order-parse', 'could not parse SERIES_ORDER keys from src/data/site.ts');
  // nagornaya: navigation is owned by the dedicated Nagornaya chrome (native
  // pages, not ArticleLayout). pastor-series: single-article series — no
  // prev/next to render. Both documented in MASTER_BUG_MATRIX DATA-SERIES-DRIFT.
  const KNOWN_ORDER_GAPS = new Set(['nagornaya', 'pastor-series']);
  for (const k of Object.keys(seriesJson)) {
    if (!orderKeys.includes(k) && !KNOWN_ORDER_GAPS.has(k)) {
      fail('series-order-drift', `series.json key "${k}" missing from SERIES_ORDER (site.ts) — articles in it get no prev/next nav`);
    }
  }
  for (const k of orderKeys) {
    if (!(k in seriesJson)) fail('series-order-drift', `SERIES_ORDER key "${k}" missing from data/series.json`);
  }
}


// SEARCH-SCRIPTURE guard (2026-07-05): scripture-scope search depends on the
// manifest scripture field for its offline/manifest fallback path. These
// scripture-anchored routes must never lose the field again.
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'search-manifest.json'), 'utf8'));
  const mitems = manifest.items || manifest;
  const REQUIRED_SCRIPTURE = [
    '/articles/krajne-li-isporcheno-serdce/',
    '/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/',
    '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
    '/nagornaya/chast-1/', '/nagornaya/chast-2/', '/nagornaya/chast-3/',
    '/nagornaya/chast-4/', '/nagornaya/chast-5/',
    '/hard-texts/', '/rodosloviye/',
  ];
  const byUrl = new Map(mitems.map(i => [i.url, i]));
  for (const url of REQUIRED_SCRIPTURE) {
    const it = byUrl.get(url);
    if (!it) { fail('search-scripture-missing-item', url + ' absent from search-manifest'); continue; }
    if (!it.scripture || !String(it.scripture).trim()) {
      fail('search-scripture-field-lost', url + ' lost its manifest "scripture" field (scripture-scope fallback depends on it)');
    }
  }
}

if (issues.length) {
  const by = issues.reduce((a,i)=>(a[i.kind]=(a[i.kind]||0)+1,a),{});
  console.log(`❌ ${issues.length} issue(s)`, by);
  issues.forEach(i => console.log(`- ${i.kind}: ${i.detail}`));
  process.exit(1);
}
console.log('✅ Data consistency passed');
