#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://gospod-bog.ru';
const RELEASE_DATE = '2026-09-10T00:00:00+03:00';
const LANDING = '/podrostok-za-kadrom/';
const SERIES_KEY = 'teen-double-life';
const ITEMS = [
  ['I', 'teen-double-life', 'podrostok-za-kadrom-dvoynaya-zhizn', 32, 0],
  ['II', 'teen-parents-after-disclosure', 'podrostok-za-kadrom-roditelyam-posle-razoblacheniya', 43, 32],
  ['III', 'teen-church-response', 'podrostok-za-kadrom-chto-delat-tserkvi', 39, 75],
  ['A', 'adult-child-left-home', 'vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie', 37, 114],
  ['B', 'adult-child-home-money', 'vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya', 36, 151],
  ['C', 'adult-child-authority', 'sovershennoletie-roditelskaya-vlast-chto-menyaetsya', 35, 187],
  ['D', 'adult-daughter-marriage', 'vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti', 42, 222],
];

const errors = [];
const fail = (message) => errors.push(message);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const routeFile = (route) => path.join(DIST, route.replace(/^\//, ''), 'index.html');
const meta = (html, key) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = html.match(new RegExp(`<meta\\b([^>]*\\b(?:name|property)=["']${escaped}["'][^>]*)>`, 'i'))?.[1] || '';
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim() || '';
};
const canonical = (html) => {
  for (const match of html.matchAll(/<link\b([^>]+)>/gi)) {
    if (!/\brel=["']canonical["']/i.test(match[1])) continue;
    return match[1].match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim() || '';
  }
  return '';
};

const ownership = readJson('migration/page-ownership.json');
const series = readJson('data/series.json');
const config = read('src/components/article-pilots/_shared/series/teenSeriesConfig.ts');
const wrapper = read('src/components/article-pilots/teen-series/TeenSeriesArticlePage.astro');
const asset = read('public/images/teen-series/series-hero.svg');

if (!exists('src/pages/podrostok-za-kadrom/index.astro')) fail('series landing source missing');
if (!/width="1200" height="630"/.test(asset)) fail('series hero must remain intrinsic 1200x630');
if (!config.includes("seriesId: 'teen-double-life'")) fail('teen config seriesId drift');
if (!config.includes("railBackHref: '/podrostok-za-kadrom/'")) fail('teen config landing href drift');
if (!config.includes("const TEEN_SERIES_RAIL_COVER = '/images/teen-series/series-hero.svg'")) fail('final rail cover missing');
if (/PREPUBLICATION_RAIL_COVER|icons\/icon-512\.png/.test(config)) fail('prepublication rail cover leaked into release config');
if (!wrapper.includes('data-gbs2-series="teen-double-life"')) fail('teen wrapper series identity missing');
if (wrapper.includes('PASTOR_SERIES') || wrapper.includes('pastor-series/og-hero')) fail('pastor-series metadata leaked into teen wrapper');

const registered = series[SERIES_KEY];
if (!registered) fail('data/series.json missing teen-double-life');
else {
  if (registered.baseUrl !== '/articles/') fail(`series baseUrl=${registered.baseUrl}`);
  if (registered.searchPolicy?.landingRoute !== LANDING) fail('series landingRoute policy drift');
  if ((registered.parts || []).length !== ITEMS.length) fail(`series parts=${registered.parts?.length || 0}, expected 7`);
  ITEMS.forEach(([mark, , slug, minutes], index) => {
    const part = registered.parts?.[index];
    if (!part || String(part.n) !== mark || part.slug !== slug || part.readingTime !== minutes || part.status !== 'published') {
      fail(`series part ${index + 1} parity mismatch`);
    }
  });
}

const requiredOwnership = [
  [LANDING, 'src/pages/podrostok-za-kadrom/index.astro'],
  ...ITEMS.map(([, , slug]) => [`/articles/${slug}/`, `src/pages/articles/${slug}/index.astro`]),
];
for (const [route, source] of requiredOwnership) {
  const owner = ownership.routes?.[route];
  if (!owner) fail(`${route}: missing page ownership`);
  else if (owner.owner !== 'astro' || owner.status !== 'production-dist' || owner.source !== source) {
    fail(`${route}: ownership mismatch`);
  }
  if (!exists(source)) fail(`${route}: source missing ${source}`);
  const profileName = route === LANDING
    ? 'data/route-profiles/podrostok-za-kadrom.json'
    : `data/route-profiles/articles-${route.split('/').filter(Boolean).at(-1)}.json`;
  if (!exists(profileName)) fail(`${route}: route profile missing`);
  else {
    const profile = readJson(profileName);
    if (profile.route !== route || profile.currentStatus !== 'production-dist' || profile.source !== source || profile.surface !== 'series') {
      fail(`${route}: route profile mismatch`);
    }
  }
}

for (const [mark, pageId, slug, minutes, done] of ITEMS) {
  const routeRel = `src/pages/articles/${slug}/index.astro`;
  const source = read(routeRel);
  if (!source.includes(`pageId="${pageId}"`)) fail(`${slug}: pageId mismatch`);
  if (!source.includes('draft: false') || !source.includes('noindex: false')) fail(`${slug}: release override must be indexable`);
  if (!source.includes(`publishedAt: '${RELEASE_DATE}'`) || !source.includes(`updatedAt: '${RELEASE_DATE}'`)) fail(`${slug}: release date drift`);
  if (!config.includes(`readingProgressDoneMin: ${done}`)) fail(`${slug}: cumulative progress ${done} missing`);
  if (!config.includes(`readingProgressPartMin: ${minutes}`)) fail(`${slug}: reading time ${minutes} missing`);
  if (['A','B','C','D'].includes(mark) && !config.includes(`mark: { kind: 'label', value: '${mark}' }`)) fail(`${slug}: ${mark} must remain core label`);
}

if (exists('data/route-search-policy.json')) {
  const policy = readJson('data/route-search-policy.json');
  for (const [route] of requiredOwnership) {
    const row = policy.routes?.[route];
    if (!row) continue;
    if (row.indexPolicy !== 'index' || row.pagefindPolicy !== 'include' || row.searchManifestPolicy !== 'include' || row.sitemapPolicy !== 'include') {
      fail(`${route}: discovery policy is not fully public`);
    }
    const expectedRss = route === LANDING ? 'exclude' : 'include';
    if (row.rssPolicy !== expectedRss) fail(`${route}: rssPolicy=${row.rssPolicy}, expected ${expectedRss}`);
  }
}

if (fs.existsSync(DIST)) {
  for (const [route] of requiredOwnership) {
    const file = routeFile(route);
    if (!fs.existsSync(file)) { fail(`${route}: missing production-like dist HTML`); continue; }
    const html = fs.readFileSync(file, 'utf8');
    const expectedCanonical = `${SITE}${route}`;
    if (canonical(html) !== expectedCanonical) fail(`${route}: canonical mismatch`);
    if (/\bnoindex\b/i.test(meta(html, 'robots'))) fail(`${route}: live candidate remains noindex`);
    if (!html.includes('data-pagefind-body')) fail(`${route}: data-pagefind-body missing`);
    if (route !== LANDING) {
      if (!html.includes('data-gbs2-series="teen-double-life"')) fail(`${route}: reader series identity missing`);
      if (!html.includes('/images/teen-series/series-hero.svg')) fail(`${route}: final teen media missing`);
    }
  }
}

if (errors.length) {
  console.error(`❌ Teen series release contract failed (${errors.length})`);
  errors.forEach((error) => console.error(`  ❌ ${error}`));
  process.exit(1);
}
console.log('✅ Teen series release contract PASS');
console.log(`  routes: ${requiredOwnership.length} (landing + 7 articles)`);
console.log('  order: I -> II -> III -> A -> B -> C -> D');
console.log('  publication date: 2026-09-10');
console.log('  media: original 1200x630 SVG');
console.log('  production ownership: astro/production-dist');
