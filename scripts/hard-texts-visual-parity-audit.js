#!/usr/bin/env node
/*
 * Guard /hard-texts/ 100% native Astro book-landing contract.
 *
 * The route is a strict-native `seriesShape=book` landing:
 *   - <head> is native Astro markup (no loadLegacyFullDocument);
 *   - body chrome before/after <main> lives in HardTextsPageChrome /
 *     HardTextsPageFooter (no _legacy/body-segment-*.html?raw);
 *   - <main id="main-content"> is composed from named leaf components;
 *   - visible counters and JSON-LD inventory derive from the active
 *     HARD_TEXTS_SERIES contract;
 *   - the _legacy/*.html transport files are deleted.
 *
 * This audit forbids regression to legacy transport, generic shells or the
 * retired three-part pilot vocabulary.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
function ok(msg){ console.log('✅ ' + msg); }
function bad(msg){ problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label){ haystack.includes(needle) ? ok(label || needle) : bad(`missing: ${label || needle}`); }
function mustNot(haystack, needle, label){ !haystack.includes(needle) ? ok(`no ${label || needle}`) : bad(`forbidden present: ${label || needle}`); }
function mustExist(rel, label){ exists(rel) ? ok(label || rel) : bad(`missing file: ${label || rel}`); }
function mustNotExist(rel, label){ !exists(rel) ? ok(`no ${label || rel}`) : bad(`forbidden file present: ${label || rel}`); }

const page   = read('src/pages/hard-texts/index.astro');
const main   = read('src/components/hard-texts/HardTextsMain.astro');
const chrome = read('src/components/hard-texts/HardTextsPageChrome.astro');
const footer = read('src/components/hard-texts/HardTextsPageFooter.astro');
const cards      = read('src/components/hard-texts/HardTextsCardsSection.astro');
const stats      = read('src/components/hard-texts/HardTextsStatsSection.astro');
const seriesmap  = read('src/components/hard-texts/HardTextsSeriesMapSection.astro');
const articleend = read('src/components/hard-texts/HardTextsArticleEndBlock.astro');
const profile    = read('data/route-profiles/hard-texts.json');
const heartConfig = read('src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts');
const heartData   = read('src/components/article-pilots/_shared/heartSeriesData.ts');
const tmaBody     = read('src/components/article-pilots/tma-na-serdce/TmaNaSerdceBody.astro');
const tmaHead     = read('src/components/article-pilots/tma-na-serdce/TmaNaSerdcePageHead.astro');
const tmaRoute    = read('src/pages/articles/tma-na-serdce/index.astro');

// ── Page composition contract ────────────────────────────────────────────────
must(page, 'HardTextsPageChrome', 'Astro /hard-texts/ imports HardTextsPageChrome');
must(page, 'HardTextsMain', 'Astro /hard-texts/ imports HardTextsMain');
must(page, 'HardTextsPageFooter', 'Astro /hard-texts/ imports HardTextsPageFooter');
must(page, 'HARD_TEXTS_SERIES', 'landing imports active book config');
must(page, 'hasPart: publishedPages', 'JSON-LD inventory derives from book config');

mustNot(page, 'loadLegacyFullDocument', 'no loadLegacyFullDocument (no shadow-wrap)');
mustNot(page, '_legacy/', 'no _legacy fragment import');
mustNot(page, '?raw', 'no raw HTML ?raw import');

// ── Surface ownership contract ──────────────────────────────────────────────
must(profile, '"surface": "series"', 'route profile declares series surface');
must(profile, '"seriesShape": "book"', 'route profile declares book shape');
must(profile, '"routeType": "series-landing"', 'route profile declares series landing');

// ── Component files present ──────────────────────────────────────────────────
mustExist('src/components/hard-texts/HardTextsPageChrome.astro', 'HardTextsPageChrome.astro');
mustExist('src/components/hard-texts/HardTextsPageFooter.astro', 'HardTextsPageFooter.astro');
mustExist('src/components/hard-texts/HardTextsMain.astro', 'HardTextsMain.astro');
mustExist('src/components/hard-texts/HardTextsCardsSection.astro', 'HardTextsCardsSection.astro');
mustExist('src/components/hard-texts/HardTextsStatsSection.astro', 'HardTextsStatsSection.astro');
mustExist('src/components/hard-texts/HardTextsSeriesMapSection.astro', 'HardTextsSeriesMapSection.astro');
mustExist('src/components/hard-texts/HardTextsArticleEndBlock.astro', 'HardTextsArticleEndBlock.astro');

// ── Legacy transport must be gone ────────────────────────────────────────────
mustNotExist('src/components/hard-texts/_legacy/main.html', '_legacy/main.html removed');
mustNotExist('src/components/hard-texts/_legacy/body-segment-0.html', '_legacy/body-segment-0.html removed');
mustNotExist('src/components/hard-texts/_legacy/body-segment-1.html', '_legacy/body-segment-1.html removed');

// ── Native head contract ─────────────────────────────────────────────────────
must(page, '<title>', 'page carries native <title>');
must(page, '<meta name="description"', 'page carries native meta description');
must(page, '<link rel="canonical"', 'page carries native canonical link');
must(page, 'application/ld+json', 'page carries native JSON-LD');
must(page, "page: { type: 'series', id: 'hard-texts'", 'page carries native SITE_CONFIG');
must(page, "import { assetUrl }", 'cache-busted assets use shared assetUrl contract');

// ── Main composition contract ────────────────────────────────────────────────
must(main, '<main id="main-content">', 'HardTextsMain preserves semantic main wrapper');
must(main, 'HardTextsCardsSection', 'HardTextsMain uses cards component');
must(main, 'HardTextsStatsSection', 'HardTextsMain uses stats component');
must(main, 'HardTextsSeriesMapSection', 'HardTextsMain uses book timeline component');
must(main, 'HardTextsArticleEndBlock', 'HardTextsMain uses terminal SDG block component');
mustNot(main, "import legacyHtml from './_legacy/main.html?raw'", 'raw monolithic main import removed');

// ── Body chrome / footer markers ─────────────────────────────────────────────
must(chrome, 'class="h-navbar"', 'HardTextsPageChrome preserves navbar chrome');
must(chrome, 'class="home-v20"', 'HardTextsPageChrome owns home-v20 shell');
must(chrome, 'class="home-content"', 'HardTextsPageChrome owns home-content shell');
must(chrome, 'class="h-hero"', 'HardTextsPageChrome preserves hero section');
must(chrome, 'Тайны человеческого', 'HardTextsPageChrome preserves hero title');
must(chrome, 'Книга выстроена в четырёх главах', 'hero states four-chapter architecture');
must(chrome, '<slot', 'HardTextsPageChrome exposes default slot for Main+Footer');
must(chrome, 'class="h-scroll-top"', 'HardTextsPageChrome preserves scroll-top button');
must(chrome, 'is:inline', 'HardTextsPageChrome keeps runtime scripts is:inline');
must(footer, 'class="h-footer"', 'HardTextsPageFooter preserves footer');
must(footer, 'class="gb-accuracy-block"', 'HardTextsPageFooter preserves accuracy aside');

// ── Book content markers ─────────────────────────────────────────────────────
for (const marker of [
  'Основа книги',
  'Крайне ли испорчено моё сердце — если я уже верующий?',
  'Римлянам 7: верующий, неверующий или человек под законом?',
  'Новое сердце: как Бог меняет то, что мы не смогли исправить',
  'Сердце и Дух: как Бог живёт в том, что Сам оживил',
]) {
  must(cards, marker, `content marker (cards): ${marker}`);
}
must(stats, 'HARD_TEXTS_SERIES', 'stats derive from active series config');
must(seriesmap, 'Карта книги', 'content marker (series map): Карта книги');
must(seriesmap, 'Глава IV', 'book map includes fourth chapter');
must(articleend, 'Soli Deo Gloria', 'content marker (article end): Soli Deo Gloria');

for (const stale of ['3 части', '2 опубликованы', '53 минуты', 'Карта серии']) {
  mustNot(`${cards}\n${stats}\n${seriesmap}\n${chrome}`, stale, `retired pilot marker: ${stale}`);
}


// ── Heart book source-of-truth contract ─────────────────────────────────────
const expectedTmaToc = [
  ['#pered-bogom', 'Сначала — человек перед Богом'],
  ['#ditya-sveta-vo-tme', 'Дитя света, ходящее во тьме'],
  ['#psalmopevec-sporit', 'Псалмопевец спорит с собственной душой'],
  ['#ne-odin-diagnoz', 'Одна тьма — несколько уровней вопроса'],
  ['#kogda-tma-bolezn', 'Болезнь души — но не вне тела'],
  ['#iliya-pod-mozhzhevelnikom', 'Илия под можжевельником'],
  ['#kogda-vina-realna', 'Когда тьма связана с реальной виной: Давид'],
  ['#oblichenie-i-obvinenie', 'Обличение и обвинение — не одно и то же'],
  ['#tverdo-ne-dubinkoy', 'Твёрдо, но не дубинкой'],
  ['#so-svoej-tmoj', 'Как быть с собственной тьмой'],
  ['#vyhod', 'Выход: не свет по требованию, а верность в темноте'],
  ['#istochniki', 'Источники и сверка'],
];

const tmaTocBlock = heartConfig.match(/  tma: \[([\s\S]*?)  \],\s+skorb:/)?.[1] ?? '';
const actualTmaToc = [...tmaTocBlock.matchAll(/href: '([^']+)', label: '([^']+)'/g)]
  .map((match) => [match[1], match[2]]);
if (JSON.stringify(actualTmaToc) === JSON.stringify(expectedTmaToc)) ok('tma shared TOC matches the exact 12-section article order');
else bad(`tma shared TOC drift: ${JSON.stringify(actualTmaToc)}`);
const currentRows = [...tmaTocBlock.matchAll(/current: true/g)].length;
if (currentRows === 1 && /href: '#pered-bogom'[\s\S]*?current: true/.test(tmaTocBlock)) ok('tma TOC has exactly one current row on #pered-bogom');
else bad('tma TOC current-row contract failed');

const bodyH2 = [...tmaBody.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g)]
  .map((match) => [`#${match[1]}`, match[2]])
  .filter(([href]) => href !== '#summary-title-auto');
if (tmaBody.includes('<section class="sources-block" id="istochniki">')) bodyH2.push(['#istochniki', 'Источники и сверка']);
if (JSON.stringify(bodyH2) === JSON.stringify(expectedTmaToc)) ok('tma body H2 anchors and labels match the shared TOC');
else bad(`tma body/shared TOC mismatch: ${JSON.stringify(bodyH2)}`);

must(heartConfig, "{ id: 'tma', slug: 'tma-na-serdce', minutes: 34,", 'tma canonical series time is 34 minutes');
must(tmaBody, '<span data-pagefind-meta="readTime" hidden>34</span>', 'tma Pagefind time is 34 minutes');
must(tmaBody, '<span>⏱ 34 мин</span>', 'tma visible article time is 34 minutes');
must(tmaHead, 'readingTime: 34', 'tma SITE_CONFIG time is 34 minutes');
must(tmaRoute, "HARD_TEXTS_SERIES.pages['tma']", 'tma route reads progress from canonical series page data');
mustNot(heartConfig, 'heartProgress(ch.lead)', 'no chapter-lead progress reused for extra articles');
mustNot(heartConfig, 'readingProgressTotalMin: HEART_TOTAL_MIN', 'no core-only total for extra articles');
must(heartConfig, 'heartBookProgress(sat.id)', 'extra articles use their own cumulative progress');

function parseMinuteMap(source, entryPattern) {
  const out = new Map();
  for (const match of source.matchAll(entryPattern)) out.set(match[1], Number(match[2]));
  return out;
}
const coreMinutes = parseMinuteMap(heartData, /\{\s+id: '([^']+)',[\s\S]*?\n\s+minutes: (\d+),[\s\S]*?\n\s+\},/g);
const satelliteMinutes = parseMinuteMap(heartConfig, /\{ id: '([^']+)', slug: '[^']+', minutes: (\d+),/g);
const chapterBlock = heartConfig.match(/const HEART_CHAPTERS:[\s\S]*?= \[([\s\S]*?)\n\];/)?.[1] ?? '';
const chapters = [...chapterBlock.matchAll(/lead: '([^']+)',\s+extras: \[([^\]]*)\]/g)].map((match) => ({
  lead: match[1],
  extras: [...match[2].matchAll(/'([^']+)'/g)].map((entry) => entry[1]),
}));
const bookSequence = [{ id: 'prolog', minutes: coreMinutes.get('prolog') }];
for (const chapter of chapters) {
  bookSequence.push({ id: chapter.lead, minutes: coreMinutes.get(chapter.lead) });
  for (const id of chapter.extras) bookSequence.push({ id, minutes: satelliteMinutes.get(id) });
}
bookSequence.push({ id: 'spravochnik', minutes: coreMinutes.get('spravochnik') });
const missingMinutes = bookSequence.filter((pageDef) => !Number.isInteger(pageDef.minutes));
if (missingMinutes.length === 0) ok('all 24 heart-book pages have canonical integer minutes');
else bad(`missing book-page minutes: ${missingMinutes.map((pageDef) => pageDef.id).join(', ')}`);
const uniqueIds = new Set(bookSequence.map((pageDef) => pageDef.id));
if (bookSequence.length === 24 && uniqueIds.size === 24) ok('book sequence contains 24 unique pages and no chapter headings');
else bad(`book sequence shape drift: ${bookSequence.length} entries / ${uniqueIds.size} unique`);
let doneMin = 0;
let monotonic = true;
for (const pageDef of bookSequence) {
  if (pageDef.minutes <= 0) monotonic = false;
  const nextDone = doneMin + pageDef.minutes;
  if (nextDone <= doneMin) monotonic = false;
  doneMin = nextDone;
}
if (monotonic) ok('book progress is strictly cumulative across every article');
else bad('book progress is not strictly cumulative');
if (doneMin === 727) ok('full heart-book reading total is exactly 727 minutes');
else bad(`heart-book total drift: ${doneMin} minutes (expected 727)`);
const lastPage = bookSequence.at(-1);
if (lastPage?.id === 'spravochnik' && doneMin - lastPage.minutes === 704 && doneMin === 727) ok('last page completes progress exactly at 727 minutes');
else bad(`last-page progress contract failed: ${JSON.stringify(lastPage)} / ${doneMin}`);

// ── Rogers 1691 scan-first provenance contract ──────────────────────────────
must(tmaBody, 'горячкой или плевритом', 'Rogers Pleurisie is translated as плеврит');
mustNot(tmaBody, 'горячкой или чахоткой', 'retired mistranslation of Pleurisie');
must(tmaBody, 'https://books.google.com/books?id=yMRjAAAAcAAJ&amp;printsec=frontcover', 'Rogers 1691 Google Books scan is primary provenance');
must(tmaBody, 'совет 1, печ. с. ii, PDF с. 17', 'Rogers advice 1 has printed and PDF locator');
must(tmaBody, 'совет 5, печ. с. xii, PDF с. 27', 'Rogers advice 5 has printed and PDF locator');
must(tmaBody, 'совет 6, печ. с. xiv, PDF с. 29', 'Rogers advice 6 has printed and PDF locator');
must(tmaBody, 'транскрипция EEBO-TCP Университета Мичигана', 'Michigan EEBO-TCP is classified as a transcription aid');
must(tmaBody, 'не подменяют provenance открытого скана', 'Michigan transcription does not replace scan provenance');
mustExist('docs/ROGERS-1691-SCAN-PROVENANCE.md', 'durable Rogers scan provenance record');

// ── Forbidden generic shells ─────────────────────────────────────────────────
for (const marker of ['import BaseLayout', '<BaseLayout', 'astro-card-grid']) {
  mustNot(page, marker, `forbidden page marker: ${marker}`);
  mustNot(main, marker, `forbidden main marker: ${marker}`);
}

console.log('\nHARD-TEXTS VISUAL PARITY AUDIT');
if (problems.length) { console.log(`❌ ${problems.length} problem(s).`); process.exit(1); }
ok('/hard-texts/ is a strict-native book landing with no legacy transport or retired three-part markers');
