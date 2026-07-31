#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const LEGACY_REL = 'baptisty-rossii/index.html';
const PAGE_REL = 'src/pages/baptisty-rossii/index.astro';
const BASE_REL = 'src/components/baptisty-rossii';
const BODY_REL = `${BASE_REL}/BaptistyRossiiBody.astro`;
const HEAD_REL = `${BASE_REL}/BaptistyRossiiPageHead.astro`;
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
const MIN_RATIO = 0.95;
const MAX_RATIO = 1.10;
const problems = [];
function ok(msg){ console.log(`✅ ${msg}`); }
function bad(msg){ problems.push(msg); console.log(`❌ ${msg}`); }
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
function mustContain(label, text, needle){ String(text).includes(needle) ? ok(`${label}: contains ${needle}`) : bad(`${label}: missing ${needle}`); }
function mustNotContain(label, text, needle){ !String(text).includes(needle) ? ok(`${label}: no ${needle}`) : bad(`${label}: forbidden ${needle}`); }
function mustExist(rel, label){ exists(rel) ? ok(label || rel) : bad(`missing file: ${label || rel}`); }
function bodyInner(html){ return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || ''; }
function stripTags(html){ return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<svg[\s\S]*?<\/svg>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&[a-z0-9#]+;/gi,' ').replace(/\s+/g,' ').trim(); }
function wordCount(html){ return (stripTags(html).match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g)||[]).length; }
console.log('BAPTISTY-ROSSII STRICT-NATIVE AUDIT');
const legacy = read(LEGACY_REL);
const page = read(PAGE_REL);
const body = read(BODY_REL);
const head = read(HEAD_REL);
const bookConfig = read(BOOK_CONFIG_REL);
const flatConfig = read(FLAT_CONFIG_REL);
const landingProfile = JSON.parse(read(LANDING_PROFILE_REL));
const articleProfiles = ARTICLE_SLUGS.map((slug) => ({
  slug,
  value: JSON.parse(read(`data/route-profiles/baptisty-rossii-${slug}.json`)),
}));
mustExist(BODY_REL, 'BaptistyRossiiBody.astro');
mustExist(HEAD_REL, 'BaptistyRossiiPageHead.astro');
mustExist(BOOK_CONFIG_REL, 'Baptist public book config');
mustExist(FLAT_CONFIG_REL, 'Baptist preserved publication inventory');
if (exists(`${BASE_REL}/_legacy`)) bad('landing _legacy directory must be retired'); else ok('landing _legacy directory retired');
for (const token of FORBIDDEN) mustNotContain('landing route/body/head scope', [page,body,head].join('\n'), token);
mustContain('route imports native head', page, 'BaptistyRossiiPageHead');
mustContain('route imports native body', page, 'BaptistyRossiiBody');
mustContain('route explicit body class', page, 'class="gbs-world"');
mustContain('route explicit total minutes', page, 'data-gbs2-total-min="229"');
mustContain('route pagefind body marker', body, 'data-pagefind-body');
for (const marker of ['rel="canonical"','window.SITE_CONFIG','application/ld+json','mc.yandex.ru']) mustContain('head contract', head, marker);
for (const marker of ['gbs2-mobile-head','gbs2-rail','gbs2-hero','article-body','gbs2-bbar','gbs2-sheet','Баптисты России']) mustContain('landing body marker', body, marker);

console.log('\nBAPTISTY-ROSSII BOOK CONTRACT');
mustContain('public config uses canonical book shape', bookConfig, "shape: 'book'");
mustContain('public config has literal series identity', bookConfig, "seriesId: 'russian-baptism'");
mustContain('public config validates through engine', bookConfig, 'defineSeriesConfig({');
mustContain('public config preserves flat source inventory', bookConfig, "from './baptistFlatSeriesConfig'");
mustContain('flat source preserves total minutes', flatConfig, 'readingProgressTotalMin: 229');
for (const id of [
  'origins-and-first-brotherhood',
  'networks-unions-and-conscience',
  'soviet-night-and-one-union',
  'conscience-split-and-underground-memory',
]) mustContain('book chapter registry', bookConfig, id);
for (const slug of ARTICLE_SLUGS.slice(0, -1)) mustContain('published article retained', bookConfig, slug);
mustContain('book articles use Arabic marks', bookConfig, "mark: { kind: 'arabic'");
mustContain('reference endpaper retained', bookConfig, "requireFlatItem('spravochnik')");
if (landingProfile.seriesShape === 'flat') ok('landing profile remains flat until its dedicated native book landing migration');
else bad(`landing profile: expected current flat landing shell, found ${landingProfile.seriesShape}`);
for (const { slug, value } of articleProfiles) {
  if (value.routeType === 'series-article' && value.surface === 'series' && value.seriesShape === 'book') {
    ok(`article profile ${slug}: seriesShape=book`);
  } else {
    bad(`article profile ${slug}: expected series-article/book`);
  }
}

const lw=wordCount(bodyInner(legacy)), rw=wordCount(body), ratio=rw/Math.max(1,lw);
console.log(`landing words: legacy=${lw}; body=${rw}; ratio=${ratio.toFixed(2)}`);
if (ratio >= MIN_RATIO && ratio <= MAX_RATIO) ok(`landing word-count parity within threshold (${ratio.toFixed(2)})`); else bad(`landing word-count ratio out of threshold (${ratio.toFixed(2)})`);
console.log('\nBAPTISTY-ROSSII VISUAL PARITY AUDIT');
if (problems.length){ console.log(`❌ ${problems.length} problem(s). /baptisty-rossii/ strict-native contract violated.`); process.exit(1); }
console.log('✅ /baptisty-rossii/ articles are strict-native, book-shaped and guarded');
