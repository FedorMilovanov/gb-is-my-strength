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

// ── Forbidden generic shells ─────────────────────────────────────────────────
for (const marker of ['import BaseLayout', '<BaseLayout', 'astro-card-grid']) {
  mustNot(page, marker, `forbidden page marker: ${marker}`);
  mustNot(main, marker, `forbidden main marker: ${marker}`);
}

console.log('\nHARD-TEXTS VISUAL PARITY AUDIT');
if (problems.length) { console.log(`❌ ${problems.length} problem(s).`); process.exit(1); }
ok('/hard-texts/ is a strict-native book landing with no legacy transport or retired three-part markers');
