#!/usr/bin/env node
/**
 * Map publication status guard.
 *
 * Temporary map placeholders are allowed to stay reachable for users, but they
 * must not be promoted as production/search/indexable content until the visual
 * map is ready. This prevents the regression where holding pages entered
 * sitemap/llms/Pagefind/baseline/search as if they were finished maps.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://gospod-bog.ru';
const issues = [];
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function fail(kind, detail) { issues.push({ kind, detail }); }
function routeUrl(slug) { return `/karty/${slug}/`; }
function absUrl(slug) { return `${SITE}${routeUrl(slug)}`; }
function metaRobots(html) { return html.match(/<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i)?.[1] || ''; }

const sitemap = exists('sitemap.xml') ? read('sitemap.xml') : '';
const llms = exists('llms.txt') ? read('llms.txt') : '';
const searchRaw = exists('data/search-manifest.json') ? JSON.parse(read('data/search-manifest.json')) : { items: [] };
const searchItems = Array.isArray(searchRaw) ? searchRaw : (searchRaw.items || []);
const baseline = exists('data/public-content-baseline.json') ? JSON.parse(read('data/public-content-baseline.json')) : { pages: [] };

for (const routeFile of fs.readdirSync(path.join(ROOT, 'karty'), { withFileTypes: true })) {
  if (!routeFile.isDirectory() || routeFile.name.startsWith('_')) continue;
  const slug = routeFile.name;
  const routeRel = `karty/${slug}/route.json`;
  const htmlRel = `karty/${slug}/index.html`;
  if (!exists(routeRel) || !exists(htmlRel)) continue;
  const route = JSON.parse(read(routeRel));
  const publication = route.publication || {};
  const html = read(htmlRel);
  const isHoldingCopy = /Эта карта временно снята с публичного просмотра|временно снята с публикации|визуальн(?:ом|ый) аудит/i.test(html);
  const status = publication.status || (isHoldingCopy ? 'temporary-placeholder' : 'ready');

  if (isHoldingCopy && status !== 'temporary-placeholder') {
    fail('holding-status-missing', `${routeRel}: holding copy requires publication.status="temporary-placeholder"`);
  }

  if (status === 'temporary-placeholder') {
    if (!/\bnoindex\b/i.test(metaRobots(html))) fail('placeholder-indexable', `${htmlRel}: robots must include noindex`);
    if (/data-pagefind-body/i.test(html)) fail('placeholder-pagefind-body', `${htmlRel}: must not expose data-pagefind-body`);
    if (!/data-pagefind-ignore/i.test(html)) fail('placeholder-pagefind-ignore-missing', `${htmlRel}: expected data-pagefind-ignore`);
    if (sitemap.includes(absUrl(slug))) fail('placeholder-in-sitemap', absUrl(slug));
    if (llms.includes(absUrl(slug)) || llms.includes(routeUrl(slug))) fail('placeholder-in-llms', routeUrl(slug));
    if (searchItems.some((item) => item && item.url === routeUrl(slug))) fail('placeholder-in-search-manifest', routeUrl(slug));
    if ((baseline.pages || []).some((page) => page && (page.url === absUrl(slug) || page.file === htmlRel))) fail('placeholder-in-baseline', routeUrl(slug));
    for (const [key, expected] of Object.entries({ indexable: false, sitemap: false, llms: false, pagefind: false })) {
      if (publication[key] !== expected) fail('placeholder-flag-drift', `${routeRel}: publication.${key} must be ${expected}`);
    }
  } else if (status === 'ready') {
    if (/\bnoindex\b/i.test(metaRobots(html))) fail('ready-map-noindex', `${htmlRel}: ready map must be indexable`);
    if (!sitemap.includes(absUrl(slug))) fail('ready-map-missing-sitemap', absUrl(slug));
  }
}

console.log('\nGB MAP PUBLICATION STATUS AUDIT');
if (issues.length) {
  const by = issues.reduce((a, i) => (a[i.kind] = (a[i.kind] || 0) + 1, a), {});
  console.log(`❌ ${issues.length} issue(s)`, by);
  issues.forEach((i) => console.log(`- ${i.kind}: ${i.detail}`));
  process.exit(1);
}
console.log('✅ Map publication statuses are consistent');
