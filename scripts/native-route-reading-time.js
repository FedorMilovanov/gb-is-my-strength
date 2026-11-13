#!/usr/bin/env node
/**
 * native-route-reading-time.js
 *
 * Минуты для частей серий, у которых нет MDX и нет статьи в `/articles/`:
 * «Нагорная проповедь» (`/nagornaya/chast-1…5/`), и всё, что появится с той
 * же архитектурой.
 *
 * Почему отдельный скрипт, а не общий аудит. У статьи есть один файл с телом:
 * MDX либо компонент, который импортирует страница. У нативного маршрута
 * такого файла нет — текст рассыпан по десятку компонентов, и подсчёт по
 * импортам расходится с тем, что читатель видит на странице, на 2–4 минуты
 * (сравнение-таблицы, диаграммы, скрытые подписи). Политика требует совпадения
 * с собранной страницей, поэтому здесь источником считается `dist`: тот же
 * подсчёт `<main>`, что и в `reading-time-dist-crosscheck.js`.
 *
 * Что переписывается в `--write`:
 *   1. `data/series.json` — `parts[].readingTime`;
 *   2. `"readingTime": N` в JSON-LD PageHead маршрута;
 *   3. `data-pagefind-meta="readTime" hidden>N<`, если он есть;
 *   4. видимая строка `⏱ N мин` и `readingTime: 'N мин'` в компонентах
 *      маршрута и в файле страницы.
 *
 * Запуск:
 *   node scripts/native-route-reading-time.js            — отчёт (exit 1 при дрейфе)
 *   node scripts/native-route-reading-time.js --check     — то же
 *   node scripts/native-route-reading-time.js --write     — записать
 *   node scripts/native-route-reading-time.js --json      — машинный вывод
 *   node scripts/native-route-reading-time.js --dist <dir>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { visibleMainWords } = require('./lib/reader-main-words.cjs');

const ROOT = path.resolve(__dirname, '..');
const DIST_ARG = process.argv.indexOf('--dist');
const DIST = DIST_ARG !== -1 ? path.resolve(process.argv[DIST_ARG + 1]) : path.join(ROOT, 'dist');
const WRITE = process.argv.includes('--write');
const JSON_OUT = process.argv.includes('--json');
const WPM = 180;

const SERIES_FILE = path.join(ROOT, 'data/series.json');
const PAGES_DIR = path.join(ROOT, 'src/pages');
const COMPONENTS_DIR = path.join(ROOT, 'src/components');
const MDX_DIR = path.join(ROOT, 'src/content/articles');
const SEARCH_JS = path.join(ROOT, 'js/search.js');

// Хабы серий, у которых есть запись в fallback-индексе `js/search.js`:
// их `readTime` равен сумме частей, поэтому меняется вместе с ними.
const SERIES_LANDING = { nagornaya: '/nagornaya/seriya/' };

const read = (file) => fs.readFileSync(file, 'utf8');
const minutesFor = (words) => Math.max(1, Math.ceil(words / WPM));

function mdxSlugs() {
  if (!fs.existsSync(MDX_DIR)) return new Set();
  return new Set(
    fs.readdirSync(MDX_DIR).filter((n) => n.endsWith('.mdx')).map((n) => path.basename(n, '.mdx'))
  );
}

/** Маршруты-кандидаты: части серий без MDX и без статьи в `/articles/`. */
function nativeRoutes(series) {
  const withMdx = mdxSlugs();
  const routes = [];
  for (const [id, info] of Object.entries(series)) {
    const base = String(info.baseUrl || '/').replace(/\/?$/, '/');
    for (const part of info.parts || []) {
      const slug = part.slug;
      if (!slug || withMdx.has(slug)) continue;
      if (fs.existsSync(path.join(PAGES_DIR, 'articles', slug, 'index.astro'))) continue;
      const page = path.join(PAGES_DIR, ...base.split('/').filter(Boolean), slug, 'index.astro');
      if (!fs.existsSync(page)) continue;
      routes.push({ series: id, slug, base, page, part });
    }
  }
  return routes;
}

/** Каталоги исходников маршрута: страница, компоненты маршрута, общие компоненты серии. */
function routeFiles({ base, slug, page }) {
  const files = [page];
  const segments = base.split('/').filter(Boolean);
  const dirs = [
    path.join(COMPONENTS_DIR, ...segments, slug),
    path.join(COMPONENTS_DIR, ...segments),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith('.astro')) files.push(path.join(dir, name));
    }
  }
  return [...new Set(files)].filter((f) => fs.existsSync(f));
}

function rewrite(file, minutes) {
  const before = read(file);
  let after = before;
  after = after.replace(/("readingTime":\s*)\d+/g, `$1${minutes}`);
  after = after.replace(/(data-pagefind-meta="readTime"[^>]*>)\d+(<)/g, `$1${minutes}$2`);
  after = after.replace(/(⏱\s*)\d+(\s*мин)/g, `$1${minutes}$2`);
  after = after.replace(/(readingTime:\s*')\d+(\s*мин')/g, `$1${minutes}$2`);
  if (after === before) return false;
  fs.writeFileSync(file, after);
  return true;
}

/**
 * Обновить сумму минут хаба в fallback-индексе поиска. `js/search.js` —
// сборочный артефакт с ручными записями: пока сумма серии меняется, её
// readTime отстаёт, и `data:consistency` ловит `search-js-fallback-read-time-drift`.
 */
function syncSearchFallback(landingUrl, minutes) {
  if (!landingUrl || !fs.existsSync(SEARCH_JS)) return false;
  const src = read(SEARCH_JS);
  const escaped = landingUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(url:"${escaped}"[\\s\\S]{0,400}?readTime:)(\\d+)`);
  const next = src.replace(re, (full, head, value) => (Number(value) === minutes ? full : `${head}${minutes}`));
  if (next === src) return false;
  fs.writeFileSync(SEARCH_JS, next);
  return true;
}

function main() {
  if (!fs.existsSync(SERIES_FILE)) {
    console.error('нет data/series.json');
    process.exit(1);
  }
  if (!fs.existsSync(DIST)) {
    console.error(`нет собранного dist: ${path.relative(ROOT, DIST)}`);
    process.exit(1);
  }
  const raw = read(SERIES_FILE);
  const series = JSON.parse(raw);
  const rows = [];
  for (const route of nativeRoutes(series)) {
    const htmlFile = path.join(DIST, ...route.base.split('/').filter(Boolean), route.slug, 'index.html');
    if (!fs.existsSync(htmlFile)) {
      rows.push({ series: route.series, slug: route.slug, status: 'missing', file: path.relative(ROOT, htmlFile) });
      continue;
    }
    const words = visibleMainWords(read(htmlFile));
    const expected = minutesFor(words);
    const current = Number.isFinite(route.part.readingTime) ? route.part.readingTime : null;
    rows.push({
      series: route.series,
      slug: route.slug,
      current,
      expected,
      words,
      delta: current === null ? null : current - expected,
      status: current === expected ? 'ok' : 'drift',
    });
  }

  if (WRITE) {
    let seriesTouched = 0;
    let filesTouched = 0;
    for (const row of rows) {
      if (row.status !== 'drift') continue;
      const info = series[row.series];
      const part = (info.parts || []).find((p) => p.slug === row.slug);
      if (!part) continue;
      part.readingTime = row.expected;
      seriesTouched += 1;
      for (const file of routeFiles(nativeRoutes(series).find((r) => r.series === row.series && r.slug === row.slug))) {
        if (rewrite(file, row.expected)) filesTouched += 1;
      }
    }
    if (seriesTouched) fs.writeFileSync(SERIES_FILE, JSON.stringify(series, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
    let landingsTouched = 0;
    for (const [id, landingUrl] of Object.entries(SERIES_LANDING)) {
      const info = series[id];
      if (!info) continue;
      const total = (info.parts || [])
        .filter((part) => part.status === 'published')
        .reduce((sum, part) => sum + (Number(part.readingTime) || 0), 0);
      if (syncSearchFallback(landingUrl, total)) landingsTouched += 1;
    }
    if (!JSON_OUT) {
      console.log(`✅ --write: обновлено записей series.json: ${seriesTouched}; файлов разметки: ${filesTouched}; хабов в поиске: ${landingsTouched}.`);
      console.log('   Пересоберите HTML и прогоните npm run reading:time:sync.');
    }
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ routes: rows }, null, 2));
    return;
  }

  const drift = rows.filter((r) => r.status === 'drift');
  const missing = rows.filter((r) => r.status === 'missing');
  console.log('=== native-route reading time (180 слов/мин, ceil, минимум 1) ===');
  console.log(`Маршрутов без MDX: ${rows.length}; расходятся: ${drift.length}; не собраны: ${missing.length}.`);
  for (const r of drift) {
    console.log(`  ${r.series}/${r.slug}\t${r.current} → ${r.expected} (${r.words} слов)`);
  }
  if (WRITE) return;
  if (drift.length) {
    console.log('\n❌ Минуты не совпадают с тем, что читатель видит на собранной странице.');
    console.log('   Починить: node scripts/native-route-reading-time.js --write && npm run strangler:build:production-like');
    process.exit(1);
  }
  console.log('\n✅ Все нативные маршруты совпадают со собранной страницей.');
}

main();
