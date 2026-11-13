#!/usr/bin/env node
/**
 * reading-time-dist-crosscheck.js
 *
 * Независимая проверка политики времени чтения по собранному `dist`.
 *
 * Аудит (`scripts/reading-time-audit.js`) считает слова в источниках: MDX или
 * компонентах. Этот скрипт смотрит на результат — сколько слов читатель
 * действительно видит в `<main>` готовой страницы, — и сравнивает два числа.
 * Задача не заменить политику, а поймать случаи, где источник и страница
 * рассказывают разное: MDX-заглушка вместо статьи, тело в компонентах,
 * невидимая разметка, раздутая аппаратом.
 *
 * Что не считается читательским текстом: `<script>`, `<style>`, `<template>`,
 * всё с атрибутом `hidden` или `aria-hidden="true"` — иначе всплывающие
 * сноски (например, 81 попап источников у Лоусона) удваивали бы объём.
 *
 * Запуск:
 *   node scripts/reading-time-dist-crosscheck.js            — отчёт
 *   node scripts/reading-time-dist-crosscheck.js --warn      — не падать
 *   node scripts/reading-time-dist-crosscheck.js --json      — машинный вывод
 *   node scripts/reading-time-dist-crosscheck.js --dist <dir>
 *
 * Выход 0 = все страницы согласны с политикой в пределах допуска,
 * Выход 1 = есть расхождение больше допуска (по умолчанию 8 минут).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const POLICY = require('./lib/reading-time-policy');

const DIST_ARG = process.argv.indexOf('--dist');
const DIST = DIST_ARG !== -1 ? path.resolve(ROOT, process.argv[DIST_ARG + 1]) : path.join(ROOT, 'dist');
const JSON_OUT = process.argv.includes('--json');
const WARN_ONLY = process.argv.includes('--warn');
const TOLERANCE_ARG = process.argv.indexOf('--tolerance');
const TOLERANCE = TOLERANCE_ARG !== -1 ? Number(process.argv[TOLERANCE_ARG + 1]) : 8;

// Теги, содержимое которых не читают глазами.
const SKIP_TAGS = new Set(['script', 'style', 'template', 'svg', 'noscript']);

// Пустые элементы не имеют закрывающего тега: если положить их в стек,
// он никогда не очистится и всё дальнейшее содержимое пометится скрытым
// (страница `dzhon-gill-chast-3-nasledie` давала 0 слов из-за `<img hidden>`).
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Видимые слова внутри `<main>`: минимальный стекобход без зависимостей.
 * Свой парсер нужен потому, что регулярка `<[^>]+>` оставляет текст атрибутов
 * (длинные aria-label источников) и не знает про `hidden`.
 */
function visibleMainWords(html) {
  // Скрипты, стили и комментарии убираем целиком до разбора: внутри `<script>`
  // живут строки с `</`, `document` и собственные `<div>` из шаблонов, и
  // построчный стек от них ломался — страница показывала 0 слов.
  const cleaned = String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  const stack = [];
  let inMain = 0;
  let words = 0;
  let last = 0;

  // Атрибуты разбираем по токенам вне кавычек: `class="hidden md:block"`
  // — это класс, а не скрытый блок, и регулярка по всей строке ловила его
  // как `hidden`, обнуляя содержимое 30 страниц.
  const parseAttrs = (attrs) => {
    const out = new Map();
    const re = /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let m;
    while ((m = re.exec(attrs))) {
      const name = m[1].toLowerCase();
      const value = m[3] ?? m[4] ?? m[5] ?? '';
      out.set(name, value === '' && !m[2] ? true : value);
    }
    return out;
  };
  const hasFlag = (map, name) => map.get(name) === true;
  const attrValue = (map, name) => {
    const value = map.get(name);
    return typeof value === 'string' ? value : '';
  };
  const hiddenNow = () => stack.some((frame) => frame.hidden);

  const countText = (text) => {
    if (inMain <= 0 || hiddenNow()) return;
    const plain = text.replace(/&[a-z0-9#]+;/gi, ' ');
    words += (plain.match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length;
  };

  let m;
  while ((m = tagRe.exec(cleaned))) {
    if (inMain > 0) countText(cleaned.slice(last, m.index));
    last = tagRe.lastIndex;
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] || '';

    if (closing) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.splice(i, 1);
          break;
        }
      }
      if (tag === 'main' && inMain > 0) inMain -= 1;
      continue;
    }

    const selfClosing = /\/\s*$/.test(attrs);
    if (selfClosing || VOID_TAGS.has(tag)) continue;

    const map = parseAttrs(attrs);
    const hidden =
      hasFlag(map, 'hidden') ||
      attrValue(map, 'aria-hidden') === 'true' ||
      SKIP_TAGS.has(tag);

    stack.push({ tag, hidden });
    if (tag === 'main') inMain += 1;
  }
  if (inMain > 0) countText(cleaned.slice(last));
  return words;
}

function auditRows() {
  const raw = execFileSync(process.execPath, [path.join(ROOT, 'scripts/reading-time-audit.js'), '--json'], {
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
  });
  const report = JSON.parse(raw.toString());
  return report.articles.rows.filter((row) => Number.isFinite(row.expected));
}

function pageFor(slug) {
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const abs = path.join(dir, entry.name);
      if (entry.name === slug) {
        const index = path.join(abs, 'index.html');
        if (fs.existsSync(index)) return index;
      }
      const hit = walk(abs);
      if (hit) return hit;
    }
    return null;
  };
  if (!fs.existsSync(DIST)) return null;
  return walk(DIST);
}

const rows = auditRows();
const results = [];
for (const row of rows) {
  const page = pageFor(row.slug);
  if (!page) {
    results.push({ slug: row.slug, missing: true });
    continue;
  }
  const words = visibleMainWords(fs.readFileSync(page, 'utf8'));
  const rendered = POLICY.minutesForWords(words);
  results.push({
    slug: row.slug,
    mode: row.mode,
    expected: row.expected,
    rendered,
    words,
    delta: rendered - row.expected,
  });
}

const present = results.filter((r) => !r.missing);
const missing = results.filter((r) => r.missing);
const over = present.filter((r) => Math.abs(r.delta) > TOLERANCE).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
const sorted = [...present].sort((a, b) => a.delta - b.delta);
const median = (() => {
  const values = present.map((r) => r.delta).sort((a, b) => a - b);
  if (!values.length) return 0;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
})();

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        policy: { wpm: POLICY.WPM, tolerance: TOLERANCE },
        dist: path.relative(ROOT, DIST) || '.',
        pages: present.length,
        missing: missing.map((r) => r.slug),
        medianDelta: median,
        outliers: over,
        rows: present,
      },
      null,
      2
    )
  );
  process.exit(0);
}

console.log('=== чтение: сверка политики с собранными страницами ===\n');
console.log(
  `Страниц найдено: ${present.length} из ${results.length}` +
    (missing.length ? `, нет в dist: ${missing.length}` : '') +
    `; допуск ±${TOLERANCE} мин; медиана расхождения ${median > 0 ? '+' : ''}${median}.`
);

if (over.length) {
  console.log(`\nРасхождения больше допуска (${over.length}):`);
  for (const r of over) {
    const sign = r.delta > 0 ? '+' : '';
    console.log(`  ${r.slug}\tполитика ${r.expected} → страница ${r.rendered} (${sign}${r.delta})\t${r.mode}, ${r.words} слов`);
  }
} else {
  console.log('\nВсе страницы согласны с политикой в пределах допуска.');
}

if (over.length) {
  console.log('\nКрупные плюсы обычно означают аппарат: списки источников, хронологию и подписи,');
  console.log('которые видны на странице, но не входят в текст статьи. Минусы — MDX-заглушку');
  console.log('вместо тела или невидимую разметку. Разбираться по странице, а не по числу.');
}

if (missing.length) {
  console.log(`\nНе собраны: ${missing.map((r) => r.slug).join(', ')}`);
}

if (over.length && !WARN_ONLY) process.exit(1);
