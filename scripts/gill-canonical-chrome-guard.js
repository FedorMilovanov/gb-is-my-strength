#!/usr/bin/env node
/*
 * Guard: Gill mobile chrome must stay on the CANONICAL controls
 * (reference: auditrepo/references/gill-mobile/gill-mobile-bars-v2.9.html).
 *
 * История регрессии: канон-фикс 8f5b87a («canonical theme SVG», сверка по
 * v2.9) жил только на ветке lane/system-mobile-chrome-rollout-v1 и не попал
 * в main — сайт собрался из до-канонной версии Гилла с самодельным text-glyph
 * ☀ (data-gill-theme-cycle) и sliders-иконкой настроек. Восстановлено
 * коммитом b37b061. Этот guard не даёт откатиться снова.
 *
 * Проверяет РАЗМЕТКУ компонента (источник истины). Запускать в любой момент,
 * сборка не нужна.
 *
 * Канон (обязано быть):
 *   • .gb-theme-toggle + data-fc-action="theme" — 2-состояние день/ночь через
 *     sitewide toggleTheme;
 *   • .theme-icon-sun (circle r=4.5 + лучи) и .theme-icon-moon (полумесяц);
 *   • gear/шестерёнка у кнопки «Настройки чтения» (path M19.4 15a1.65…);
 *   • один native interaction owner: ReaderActionsRuntime.
 * Запрещено (откат):
 *   • data-gill-theme-cycle / class="theme-glyph" (самодельный text-glyph);
 *   • sliders-иконка настроек (path "M4 7h10M18 7h2");
 *   • legacy enhancements.js рядом с native article interactions;
 *   • DOM-observer/удаление .reader-setting-btn после рендера.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function ok(msg) { console.log('✅ ' + msg); }
function bad(msg) { problems.push(msg); console.log('❌ ' + msg); }
function must(hay, needle, label) { hay.includes(needle) ? ok(label) : bad(`missing: ${label}`); }
function mustNot(hay, needle, label) { !hay.includes(needle) ? ok(`no ${label}`) : bad(`REGRESSION — forbidden present: ${label}`); }

console.log('\n═══ Gill canonical mobile-chrome guard (ref v2.9) ═══\n');

const bar = read('src/components/article-pilots/gill-series/GillSeriesMobileBar.astro');
const chrome = read('src/components/article-pilots/gill-series/GillSeriesChrome.astro');

// ── Canonical theme toggle (day/night SVG icon-swap) ──────────────────────────
must(bar, 'gb-theme-toggle', 'канонический .gb-theme-toggle присутствует');
must(bar, 'data-fc-action="theme"', 'кнопка темы на sitewide data-fc-action="theme"');
must(bar, 'theme-icon-sun', 'SVG-солнце (.theme-icon-sun)');
must(bar, 'theme-icon-moon', 'SVG-луна (.theme-icon-moon)');
must(bar, 'r="4.5"', 'солнце — канонический circle r=4.5');
must(bar, 'M21 12.8A9 9 0 1 1 11.2 3', 'луна — канонический полумесяц path');

// ── Canonical settings gear (not sliders) ─────────────────────────────────────
must(bar, 'M19.4 15a1.65', 'иконка «Настройки» — gear/шестерёнка (канон v2.9)');

// ── Forbidden pre-canonical fallbacks (the regression itself) ─────────────────
mustNot(bar, 'data-gill-theme-cycle', 'самодельный theme-cycle (text-glyph)');
mustNot(bar, 'class="theme-glyph"', 'text-glyph ☀/◐/☾ в разметке');
mustNot(bar, 'M4 7h10M18 7h2', 'sliders-иконка настроек (до-канон)');

// ── Theme sync must exist (regression I introduced on the canon swap) ─────────
must(bar, 'syncGillThemeSegment', 'синхронизация сегмента «Тема» листа настроек');

// ── Native ownership: never load and then delete legacy controls ───────────────
must(chrome, '<ReaderActionsRuntime />', 'native ReaderActionsRuntime является владельцем interactions');
mustNot(chrome, 'enhancements.js', 'legacy enhancements bundle на Gill routes');
mustNot(chrome, 'MutationObserver', 'observer-патч удаления reader controls');
mustNot(chrome, "matches('.reader-setting-btn')", 'runtime-удаление .reader-setting-btn');
mustNot(chrome, 'gbLegacyReaderSettingsRetired', 'переходный legacy-retired marker');

console.log('');
if (problems.length) {
  console.log(`❌ GILL CHROME GUARD FAILED — ${problems.length} проблем(ы). Откат к до-канонному хрому запрещён (референс v2.9).`);
  process.exit(1);
}
console.log('✅ Gill mobile chrome = канон v2.9. Регрессии нет.');
