#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PAGE_REL = 'src/pages/baptisty-rossii/index.astro';
const BASE_REL = 'src/components/baptisty-rossii';
const BODY_REL = `${BASE_REL}/BaptistyRossiiBookLanding.astro`;
const OLD_BODY_REL = `${BASE_REL}/BaptistyRossiiBody.astro`;
const HEAD_REL = `${BASE_REL}/BaptistyRossiiPageHead.astro`;
const SOVIET_PAGE_REL = 'src/pages/baptisty-rossii/sovetskaya-noch/index.astro';
const SOVIET_BODY_REL = `${BASE_REL}/BaptistyRossiiSovetskayaNochBody.astro`;
const SOVIET_EVIDENCE_REL = `${BASE_REL}/BaptistyRossiiSovetskayaNochEvidence.astro`;
const SOVIET_EVIDENCE_ASSET_REL = 'images/baptisty-rossii/facsimiles/revolyutsiya-i-tserkov-1920-9-12-p100.jpg';
const BOOK_CONFIG_REL = 'src/components/article-pilots/_shared/series/baptistSeriesConfig.ts';
const FLAT_CONFIG_REL = 'src/components/article-pilots/_shared/series/baptistFlatSeriesConfig.ts';
const LANDING_PROFILE_REL = 'data/route-profiles/baptisty-rossii.json';
const ARTICLE_SLUGS = [
  'noch-na-kure', 'yuzhnaya-shtunda', 'dva-sezda-1884',
  'peterburgskaya-liniya', 'goneniya-i-sovest',
  'sovetskaya-noch', 'vsehib-1944',
  'iniciativnaya-gruppa', 'podpolnaya-pechat', 'spravochnik',
];
const FORBIDDEN = ['loadLegacyFullDocument', 'headHtml', 'bodyHtml', 'bodyAttributes', '?raw', 'set:html', '_legacy'];
const STALE_FLAT_COPY = ['9 частей + справочник', 'обзор · 10 материалов', 'Все десять частей', 'Части серии'];
const STALE_BOOK_TERMINOLOGY = ['четыре книжные части', '4 части ·', 'семнадцать глав', '17 глав'];
const problems = [];
function ok(msg){ console.log(`✅ ${msg}`); }
function bad(msg){ problems.push(msg); console.log(`❌ ${msg}`); }
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
function mustContain(label, text, needle){ String(text).includes(needle) ? ok(`${label}: contains ${needle}`) : bad(`${label}: missing ${needle}`); }
function mustNotContain(label, text, needle){ !String(text).includes(needle) ? ok(`${label}: no ${needle}`) : bad(`${label}: forbidden ${needle}`); }
function mustExist(rel, label){ exists(rel) ? ok(label || rel) : bad(`missing file: ${label || rel}`); }
function stripTags(html){ return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<svg[\s\S]*?<\/svg>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&[a-z0-9#]+;/gi,' ').replace(/\s+/g,' ').trim(); }
function wordCount(html){ return (stripTags(html).match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g)||[]).length; }

console.log('BAPTISTY-ROSSII NATIVE BOOK LANDING AUDIT');
const page = read(PAGE_REL);
const body = read(BODY_REL);
const head = read(HEAD_REL);
const sovietPage = read(SOVIET_PAGE_REL);
const sovietBody = read(SOVIET_BODY_REL);
const sovietEvidence = read(SOVIET_EVIDENCE_REL);
const bookConfig = read(BOOK_CONFIG_REL);
const flatConfig = read(FLAT_CONFIG_REL);
const landingProfile = JSON.parse(read(LANDING_PROFILE_REL));
const articleProfiles = ARTICLE_SLUGS.map((slug) => ({
  slug,
  value: JSON.parse(read(`data/route-profiles/baptisty-rossii-${slug}.json`)),
}));

mustExist(BODY_REL, 'BaptistyRossiiBookLanding.astro');
mustExist(OLD_BODY_REL, 'retained diagnostic legacy-faithful body witness');
mustExist(HEAD_REL, 'BaptistyRossiiPageHead.astro');
mustExist(BOOK_CONFIG_REL, 'Baptist public book config');
mustExist(FLAT_CONFIG_REL, 'Baptist preserved publication inventory');
if (exists(`${BASE_REL}/_legacy`)) bad('landing _legacy directory must be retired'); else ok('landing _legacy directory retired');
for (const token of FORBIDDEN) mustNotContain('landing route/body/head scope', [page,body,head].join('\n'), token);

mustContain('route imports native head', page, 'BaptistyRossiiPageHead');
mustContain('route imports config-derived book body', page, 'BaptistyRossiiBookLanding');
mustNotContain('route retires flat body from production', page, 'BaptistyRossiiBody');
mustContain('route explicit body class', page, 'class="gbs-world"');
mustContain('route explicit total minutes', page, 'data-gbs2-total-min="229"');
mustContain('route pagefind body marker', body, 'data-pagefind-body');
for (const marker of ['rel="canonical"','window.SITE_CONFIG','application/ld+json','mc.yandex.ru']) mustContain('head contract', head, marker);
for (const marker of ['gbs2-mobile-head','gbs2-rail','gbs2-hero','article-body','gbs2-bbar','gbs2-sheet']) mustContain('landing body marker', body, marker);
for (const stale of STALE_FLAT_COPY) mustNotContain('book landing rejects stale flat copy', body, stale);
for (const stale of STALE_BOOK_TERMINOLOGY) mustNotContain('book landing rejects stale hierarchy', body, stale);

console.log('\nCONFIG-DERIVED BOOK CONTRACT');
mustContain('landing imports public book config', body, 'BAPTIST_SERIES');
mustContain('landing imports canonical book metadata', body, 'BAPTIST_BOOK_META');
mustContain('landing renders canonical title metadata', body, 'BAPTIST_BOOK_META.title');
mustContain('landing imports canonical chapter registry', body, 'BAPTIST_BOOK_CHAPTERS');
mustContain('landing renders chapter registry', body, 'BAPTIST_BOOK_CHAPTERS.map');
mustContain('landing renders chapter articles', body, 'chapter.articles.map');
mustContain('landing preserves reference endpaper', body, "itemById.get('spravochnik')");
mustContain('landing states published inventory honestly', body, 'девять самостоятельных исторических статей');
mustContain('landing distinguishes editorial roadmap', body, 'это редакционный диапазон, а не заявление');
mustContain('landing states evidence-sized roadmap', body, '17–20 статей');
mustContain('landing states media verification gate', body, 'проверку прав на публикацию');

mustContain('public config uses canonical book shape', bookConfig, "shape: 'book'");
mustContain('public config has literal series identity', bookConfig, "seriesId: 'russian-baptism'");
mustContain('public config defines canonical public title', bookConfig, "title: 'Баптисты России'");
mustContain('public config defines published hierarchy', bookConfig, "publishedLabel: '4 главы · 9 статей + справочник'");
mustContain('public config defines evidence-sized roadmap', bookConfig, "roadmapLabel: 'Расширяемая редакционная архитектура · 17–20 статей'");
mustContain('public config validates through engine', bookConfig, 'defineSeriesConfig({');
mustContain('public config exports landing metadata', bookConfig, 'export const BAPTIST_BOOK_META');
mustContain('public config exports chapter registry', bookConfig, 'export const BAPTIST_BOOK_CHAPTERS');
mustContain('public config preserves flat source inventory', bookConfig, "from './baptistFlatSeriesConfig'");
mustContain('flat source preserves total minutes', flatConfig, 'readingProgressTotalMin: 229');
for (const id of [
  'origins-and-first-brotherhood',
  'awakening-unions-and-conscience',
  'soviet-night-and-one-union',
  'conscience-split-and-underground-memory',
]) mustContain('book chapter registry', bookConfig, id);
for (const slug of ARTICLE_SLUGS.slice(0, -1)) mustContain('published article retained', bookConfig, slug);
mustContain('book articles use Arabic marks', bookConfig, "mark: { kind: 'arabic'");
mustContain('reference endpaper retained', bookConfig, "requireFlatItem('spravochnik')");

if (landingProfile.routeType === 'series-landing' && landingProfile.surface === 'series' && landingProfile.seriesShape === 'book') {
  ok('landing profile resolves as series-landing/book');
} else {
  bad(`landing profile: expected series-landing/book, found ${landingProfile.routeType}/${landingProfile.seriesShape}`);
}
for (const { slug, value } of articleProfiles) {
  if (value.routeType === 'series-article' && value.surface === 'series' && value.seriesShape === 'book') {
    ok(`article profile ${slug}: seriesShape=book`);
  } else {
    bad(`article profile ${slug}: expected series-article/book`);
  }
}

console.log('\nVERIFIED MASTER EVIDENCE CONTRACT');
mustExist(SOVIET_EVIDENCE_REL, 'route-local Soviet evidence component');
mustExist(SOVIET_EVIDENCE_ASSET_REL, 'local verified journal facsimile');
mustNotContain('Soviet route has no client-side evidence relocation', sovietPage, 'document.getElementById');
mustContain('Soviet body imports evidence component', sovietBody, 'BaptistyRossiiSovetskayaNochEvidence');
mustContain('Soviet body owns evidence before target section', sovietBody, '<BaptistyRossiiSovetskayaNochEvidence />\n<h2 id="enemy-image">');
mustContain('Soviet evidence stable identity', sovietEvidence, 'revchurch-1920-9-12-p100');
mustContain('Soviet evidence uses local asset', sovietEvidence, SOVIET_EVIDENCE_ASSET_REL.replace(/^images\//, '../../images/'));
mustContain('Soviet evidence identifies issue', sovietEvidence, '№ 9–12, 1920');
mustContain('Soviet evidence identifies printed page', sovietEvidence, 'печ. с. 100');
mustContain('Soviet evidence states document title', sovietEvidence, 'Как проводится декрет об отделении церкви от государства на местах');
mustContain('Soviet evidence limits interpretation', sovietEvidence, 'не является\n    свидетельством о конкретной баптистской общине');
mustContain('Soviet evidence records rights status', sovietEvidence, 'Public domain');
mustContain('Soviet evidence records physical verification', sovietEvidence, 'SHA-256 сверены по MASTER');
mustContain('Soviet evidence links canonical source page', sovietEvidence, 'commons.wikimedia.org/wiki/File:');
mustNotContain('Soviet evidence never hotlinks image bytes', sovietEvidence, 'src="https://');
mustNotContain('Soviet evidence does not expose private Drive link', sovietEvidence, 'drive.google.com');
if (exists(SOVIET_EVIDENCE_ASSET_REL)) {
  const size = fs.statSync(path.join(ROOT, SOVIET_EVIDENCE_ASSET_REL)).size;
  if (size >= 10000 && size <= 500000) ok(`facsimile asset publication size (${size} bytes)`);
  else bad(`facsimile asset size outside publication range (${size} bytes)`);
}

const words = wordCount(body);
if (words >= 500) ok(`native book landing content floor (${words} words)`);
else bad(`native book landing is editorially thin (${words} words; expected >=500)`);

console.log('\nBAPTISTY-ROSSII BOOK LANDING AUDIT');
if (problems.length){
  console.log(`❌ ${problems.length} problem(s). /baptisty-rossii/ native book contract violated.`);
  process.exit(1);
}
console.log('✅ /baptisty-rossii/ is config-derived, book-shaped and evidence-guarded');
