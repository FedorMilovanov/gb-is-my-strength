#!/usr/bin/env node
'use strict';

/*
 * reading:time:audit — детерминированная сверка времени чтения по единой
 * политике (см. scripts/lib/reading-time-policy.js): 180 русских слов/мин,
 * округление вверх, минимум 1 минута.
 *
 * Источники значений (SSOT), которые скрипт только СВЕРЯЕТ и по --write
 * переписывает целиком из расчёта, без ручных правок:
 *   1. src/content/articles/*.mdx — frontmatter `readingTime`;
 *   2. data/series.json — `parts[].readingTime` (SSOT для серий);
 *   3. src/components/article-pilots/_shared/series/*.ts — строчный
 *      `readingTime: 'N мин'` у записи, чей href/id равен slug (витрина серии);
 *   4. js/search.js — аварийные рекомендации `url:"/articles/…/" … readTime:N`
 *      (генератора у них нет, поэтому значение пишет этот же механизм).
 *
 * Производные поверхности (data/search-manifest.json, data/links-graph.json,
 * legacy-зеркала HTML) не переписываются здесь: у них свои нормализаторы и
 * свои стражы. Скрипт показывает их расхождение, чтобы было видно, что
 * осталось пересобрать, а не правит их в обход архитектуры.
 *
 * Использование:
 *   node scripts/reading-time-audit.js            # проверка (exit 1 при расхождении)
 *   node scripts/reading-time-audit.js --list     # печать всех расхождений
 *   node scripts/reading-time-audit.js --json     # машинный отчёт
 *   node scripts/reading-time-audit.js --write    # переписать SSOT из расчёта
 *   node scripts/reading-time-audit.js --write --only <slug[,slug]>
 *   node scripts/reading-time-audit.js --write --exclude <slug[,slug]>
 *   node scripts/reading-time-audit.js --write-literals  # минуты в разметке пилотов
 *
 * --write-literals — временный мост: он правит значения, жёстко вписанные в
 * компоненты пилота (видимую строку `⏱ N мин` и скрытую мету pagefind), из
 * того же расчёта. Источником истины они от этого не становятся; настоящее
 * решение — вынести минуты в один модуль (§8 в READING-TIME-POLICY.md).
 */

const fs = require('fs');
const path = require('path');
const { WPM, readerWordCount, minutesForWords, impliedWpm } = require('./lib/reading-time-policy');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'src/content/articles');
const SERIES_FILE = path.join(ROOT, 'data/series.json');
const MANIFEST_FILE = path.join(ROOT, 'data/search-manifest.json');
const GRAPH_FILE = path.join(ROOT, 'data/links-graph.json');
const SERIES_CONFIG_DIR = path.join(ROOT, 'src/components/article-pilots/_shared/series');
const SEARCH_JS = path.join(ROOT, 'js/search.js');
const PAGES_DIR = path.join(ROOT, 'src/pages');
const COMPONENTS_DIR = path.join(ROOT, 'src/components');

// Ниже этого числа слов в MDX считаем, что тело статьи живёт не в MDX,
// а в Astro-компоненте (`*ArticleBody.astro`): MDX там — только метаданные.
const COMPONENT_BODY_MIN_MDX_WORDS = 250;

// Файлы, которые нельзя переписывать из общей волны: они в открытых PR
// других агентов (см. docs/editorial-waves/READING-TIME-POLICY.md).
// На 13 ноября 2026 таких файлов нет: `serdce-spravochnik` выведен из-под
// пропуска после сверки — ни одна ветка и ни один PR его не правят.
const WRITE_SKIP = new Set();

const read = (f) => fs.readFileSync(f, 'utf8');
const readJson = (f) => JSON.parse(read(f));

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const WRITE_LITERALS = argv.includes('--write-literals');
const LIST = argv.includes('--list');
const JSON_OUT = argv.includes('--json');
const ONLY = valueOf('--only');
const EXCLUDE = valueOf('--exclude');

function valueOf(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;
}

function mdxFiles() {
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((n) => n.endsWith('.mdx'))
    .sort()
    .map((n) => ({ slug: n.replace(/\.mdx$/, ''), file: path.join(ARTICLES_DIR, n) }));
}

function frontmatterTime(source) {
  const m = source.match(/^readingTime:\s*(\d+)\s*$/m);
  return m ? Number(m[1]) : null;
}

/** Читательские слова тела статьи из Astro-компонента (резолв через импорты страницы). */
function componentBodyWords(slug) {
  const page = path.join(PAGES_DIR, 'articles', slug, 'index.astro');
  if (!fs.existsSync(page) || !fs.existsSync(COMPONENTS_DIR)) return null;
  const dirs = new Set();
  for (const m of read(page).matchAll(/@\/components\/([^'"]+)\.astro/g)) {
    dirs.add(path.dirname(path.join(COMPONENTS_DIR, m[1])));
  }
  // Текст разнесён по секционным компонентам (`*Section*.astro`), поэтому
  // считаем весь каталог пилота, кроме PageHead (метаданные) и PageChrome (хром).
  const bodies = new Set();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.astro')) continue;
      if (/(PageHead|PageChrome)\.astro$/.test(name)) continue;
      bodies.add(path.join(dir, name));
    }
  }
  if (!bodies.size) return null;
  let words = 0;
  for (const file of bodies) {
    const source = read(file)
      .replace(/^---[\s\S]*?---/, ' ') // Astro frontmatter — не читательский текст
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
    words += readerWordCount(source);
  }
  return words;
}

/**
 * Жёстко вписанные значения времени чтения в компонентах пилота.
 *
 * Часть «строго нативных» страниц (`src/pages/articles/<slug>/index.astro` →
 * `article-pilots/<pilot>/*.astro`) не читает frontmatter MDX вовсе: минуты
 * стоят в разметке дважды — видимой строкой `⏱ N мин` и скрытой мета-строкой
 * pagefind `data-pagefind-meta="readTime"`. Такие значения не имеют
 * генератора, поэтому --write их не переписывает: скрипт только показывает
 * их как архитектурный долг (см. §8 в docs/editorial-waves/READING-TIME-POLICY.md).
 */
function lineAt(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i += 1) if (source[i] === '\n') line += 1;
  return line;
}

const CARD_START = /<li class="related-articles__item"|<div class="related-articles__body"|<a class="gbs2-next-card"|<div class="gbs2-next-card"/g;

function literalSurfaces(slug) {
  const page = path.join(PAGES_DIR, 'articles', slug, 'index.astro');
  if (!fs.existsSync(page) || !fs.existsSync(COMPONENTS_DIR)) return [];
  const dirs = new Set();
  for (const m of read(page).matchAll(/@\/components\/([^'"]+)\.astro/g)) {
    dirs.add(path.dirname(path.join(COMPONENTS_DIR, m[1])));
  }
  const out = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.astro')) continue;
      const file = path.join(dir, name);
      const source = read(file);
      const rel = path.relative(ROOT, file);
      const taken = [];

      for (const m of source.matchAll(/⏱\s*(\d+)\s*мин/g)) {
        out.push({ file: rel, line: lineAt(source, m.index), offset: m.index, kind: 'visible', value: Number(m[1]), target: null });
        taken.push([m.index, m.index + m[0].length]);
      }
      for (const m of source.matchAll(/data-pagefind-meta="readTime"[^>]*>(\d+)</g)) {
        out.push({ file: rel, line: lineAt(source, m.index), offset: m.index, kind: 'pagefind', value: Number(m[1]), target: null });
        taken.push([m.index, m.index + m[0].length]);
      }

      // Карточки: метка «Богословие · 41 мин» и анонс «К текущей части · ~41 мин».
      // Цель — ссылка внутри той же карточки: карточки размечаются конечными
      // маркерами, поэтому ищем href не «рядом по тексту», а в границах блока.
      const starts = [...source.matchAll(CARD_START)].map((m) => m.index);
      for (const m of source.matchAll(/(?:·\s*|~)(\d+)\s*мин/g)) {
        if (taken.some(([a, b]) => m.index >= a && m.index < b)) continue;
        const at = m.index;
        const from = starts.filter((x) => x <= at).pop() ?? -1;
        const to = starts.find((x) => x > at) ?? source.length;
        const chunk = source.slice(from, to);
        // Ссылка бывает и «../slug/», и «../../articles/slug/»: разбираем оба
        // вида, а неизвестный slug отсеет сверка с картой ожиданий.
        const href = chunk.match(/href="(?:\.\.\/)+(?:articles\/)?([a-z0-9-]+)\//);
        out.push({
          file: rel,
          line: lineAt(source, at),
          offset: at,
          kind: href ? 'card' : 'card-unresolved',
          value: Number(m[1]),
          target: href ? href[1] : null,
        });
      }
    }
  }
  return out;
}

function audit() {
  const rows = [];
  for (const { slug, file } of mdxFiles()) {
    const source = read(file);
    let mode = 'mdx';
    let words = readerWordCount(source);
    if (words < COMPONENT_BODY_MIN_MDX_WORDS) {
      const comp = componentBodyWords(slug);
      if (comp !== null) {
        mode = 'component-body';
        words = comp;
      } else {
        mode = 'no-body';
      }
    }
    const expected = mode === 'no-body' ? null : minutesForWords(words);
    const current = frontmatterTime(source);
    let status;
    if (mode === 'no-body') status = 'no-body';
    else if (current === expected) status = 'ok';
    else if (current === null) status = 'missing';
    else if (mode === 'component-body') status = 'advisory'; // считаем, но не переписываем
    else status = 'drift';
    rows.push({
      slug,
      file,
      mode,
      words,
      expected,
      current,
      implied: impliedWpm(words, current),
      delta: Number.isFinite(expected) && Number.isFinite(current) ? current - expected : null,
      draft: /^draft:\s*true\s*$/m.test(source),
      status,
      literals: literalSurfaces(slug),
    });
  }

  const expectedBySlug = new Map(
    rows.filter((r) => Number.isFinite(r.expected)).map((r) => [r.slug, r.expected])
  );

  // Ожидание для литерала: у заголовка страницы — её собственный расчёт,
  // у карточки-ссылки — расчёт той статьи, на которую она ссылается.
  const literals = rows.flatMap((r) =>
    (r.literals || []).map((l) => ({
      ...l,
      slug: r.slug,
      expected:
        l.kind === 'card-unresolved'
          ? null
          : l.target
            ? expectedBySlug.get(l.target) ?? null
            : Number.isFinite(r.expected)
              ? r.expected
              : null,
    }))
  );

  const seriesRows = [];
  if (fs.existsSync(SERIES_FILE)) {
    const series = readJson(SERIES_FILE);
    for (const [key, info] of Object.entries(series)) {
      for (const part of info.parts || []) {
        const row = rows.find((r) => r.slug === part.slug);
        if (!row || !Number.isFinite(row.expected)) {
          seriesRows.push({ series: key, slug: part.slug, expected: null, current: part.readingTime ?? null, status: 'no-mdx' });
          continue;
        }
        // Строка витрины наследует статус статьи: если её тело вне MDX
        // (`advisory`) или не найдено, «расхождением» это не считается —
        // ожидание по такому MDX недостоверно и не переписывается.
        const inherited = row.status === 'advisory' || row.status === 'no-body';
        seriesRows.push({
          series: key,
          slug: part.slug,
          expected: row.expected,
          current: Number.isFinite(part.readingTime) ? part.readingTime : null,
          status: inherited ? row.status : part.readingTime === row.expected ? 'ok' : 'drift',
        });
      }
    }
  }

  const downstream = { manifest: [], graph: [], configs: [], searchJs: [] };
  if (fs.existsSync(MANIFEST_FILE)) {
    for (const item of readJson(MANIFEST_FILE).items || []) {
      const slug = String(item.url || '').replace(/^\/articles\//, '').replace(/\/$/, '');
      const expected = expectedBySlug.get(slug);
      if (expected === undefined) continue;
      if (item.readTime !== expected) downstream.manifest.push({ slug, manifest: item.readTime, expected });
    }
  }
  if (fs.existsSync(GRAPH_FILE)) {
    for (const node of readJson(GRAPH_FILE).nodes || []) {
      const slug = String(node.url || '').replace(/^\/articles\//, '').replace(/\/$/, '');
      const expected = expectedBySlug.get(slug);
      if (expected === undefined) continue;
      if (node.readTime !== expected) downstream.graph.push({ slug, graph: node.readTime, expected });
    }
  }
  if (fs.existsSync(SEARCH_JS)) {
    for (const m of read(SEARCH_JS).matchAll(/url:"(\/articles\/[^"]+)"([\s\S]{0,700}?)readTime:(\d+)/g)) {
      const slug = m[1].replace(/^\/articles\//, '').replace(/\/$/, '');
      const expected = expectedBySlug.get(slug);
      if (expected === undefined) continue;
      if (Number(m[3]) !== expected) downstream.searchJs.push({ slug, value: Number(m[3]), expected });
    }
  }
  if (fs.existsSync(SERIES_CONFIG_DIR)) {
    for (const name of fs.readdirSync(SERIES_CONFIG_DIR).filter((n) => n.endsWith('.ts'))) {
      const rel = path.join('src/components/article-pilots/_shared/series', name);
      read(path.join(SERIES_CONFIG_DIR, name))
        .split('\n')
        .forEach((line, i) => {
          const m = line.match(/readingTime:\s*'(\d+)\s*мин'/);
          if (!m) return;
          const slugMatch = line.match(/(?:href:\s*'\/articles\/([^'/]+)\/'|id:\s*'([^']+)')/);
          const slug = slugMatch ? slugMatch[1] || slugMatch[2] : null;
          const expected = slug ? expectedBySlug.get(slug) : undefined;
          if (expected === undefined) return;
          if (Number(m[1]) !== expected) downstream.configs.push({ slug, file: rel, line: i + 1, value: Number(m[1]), expected });
        });
    }
  }

  return { rows, seriesRows, downstream, literals };
}

function literalDriftOf(report) {
  return report.literals.filter((l) => Number.isFinite(l.expected) && l.value !== l.expected);
}

function writable(row) {
  // `advisory` — тело статьи живёт в компонентах, MDX хранит только метаданные;
  // такое значение считается для отчёта, но не переписывается (см. §6 политики).
  if (!row || row.status === 'no-body' || row.status === 'missing' || row.status === 'advisory') return false;
  if (WRITE_SKIP.has(row.slug)) return false;
  if (ONLY && !ONLY.includes(row.slug)) return false;
  if (EXCLUDE && EXCLUDE.includes(row.slug)) return false;
  return true;
}

/**
 * Переписать жёстко вписанные значения в компонентах пилота из политики.
 *
 * Это точечная правка разметки (значение на месте значения), а не унификация
 * источника: структурный шаг — вынести минуты в один модуль и импортировать
 * их (см. §8 политики). Правка идемпотентна и дружелюбна к трёхстороннему
 * слиянию: строки не добавляются и не удаляются.
 */
function writeLiterals(report) {
  let touched = 0;
  // Карточку-ссылку переписываем только тогда, когда расчёт статьи-цели
  // достоверен: для статей с телом в компонентах ожидание по MDX неверно.
  const statusBySlug = new Map(report.rows.map((r) => [r.slug, r.status]));
  const targets = literalDriftOf(report).filter((l) => {
    if (WRITE_SKIP.has(l.slug)) return false;
    if (ONLY && !ONLY.includes(l.slug) && !(l.target && ONLY.includes(l.target))) return false;
    if (EXCLUDE && EXCLUDE.includes(l.slug)) return false;
    if (l.kind === 'card' && !['ok', 'drift'].includes(statusBySlug.get(l.target))) return false;
    if (!Number.isFinite(l.offset)) return false;
    return true;
  });
  const byFile = new Map();
  for (const l of targets) {
    if (!byFile.has(l.file)) byFile.set(l.file, []);
    byFile.get(l.file).push(l);
  }
  // Правка по смещениям, а не по номерам строк: несколько карточек могут
  // стоять на одной строке, и построчная замена чинила бы только первую.
  for (const [file, list] of byFile) {
    const abs = path.join(ROOT, file);
    let src = read(abs);
    for (const l of [...list].sort((a, b) => b.offset - a.offset)) {
      const head = src.slice(0, l.offset);
      const tail = src.slice(l.offset);
      let next = tail;
      if (l.kind === 'visible') next = tail.replace(/^⏱\s*\d+\s*мин/, `⏱ ${l.expected} мин`);
      else if (l.kind === 'pagefind') next = tail.replace(/^(data-pagefind-meta="readTime"[^>]*>)\d+</, `$1${l.expected}<`);
      else next = tail.replace(/^((?:·\s*|~))\d+(\s*мин)/, `$1${l.expected}$2`);
      if (next !== tail) {
        src = head + next;
        touched += 1;
      }
    }
    fs.writeFileSync(abs, src);
  }
  return touched;
}

function writeAll(report) {
  let touched = 0;

  for (const row of report.rows) {
    if (row.current === row.expected || !writable(row)) continue;
    const source = read(row.file).replace(/^readingTime:\s*\d+\s*$/m, `readingTime: ${row.expected}`);
    fs.writeFileSync(row.file, source);
    touched += 1;
  }

  if (fs.existsSync(SERIES_FILE)) {
    const raw = read(SERIES_FILE);
    const series = JSON.parse(raw);
    let changed = false;
    for (const info of Object.values(series)) {
      for (const part of info.parts || []) {
        const row = report.rows.find((r) => r.slug === part.slug);
        if (!row || !writable(row) || part.readingTime === row.expected) continue;
        part.readingTime = row.expected;
        changed = true;
        touched += 1;
      }
    }
    if (changed) fs.writeFileSync(SERIES_FILE, JSON.stringify(series, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
  }

  if (fs.existsSync(SEARCH_JS)) {
    let js = read(SEARCH_JS);
    let changed = false;
    for (const row of report.rows) {
      if (!writable(row)) continue;
      const re = new RegExp(`(url:"/articles/${row.slug}/"[\\s\\S]{0,700}?readTime:)(\\d+)`, 'g');
      js = js.replace(re, (m, head, value) => {
        if (Number(value) === row.expected) return m;
        changed = true;
        touched += 1;
        return `${head}${row.expected}`;
      });
    }
    if (changed) fs.writeFileSync(SEARCH_JS, js);
  }

  if (fs.existsSync(SERIES_CONFIG_DIR)) {
    for (const name of fs.readdirSync(SERIES_CONFIG_DIR).filter((n) => n.endsWith('.ts'))) {
      const file = path.join(SERIES_CONFIG_DIR, name);
      const lines = read(file).split('\n');
      let changed = false;
      for (let i = 0; i < lines.length; i += 1) {
        const m = lines[i].match(/readingTime:\s*'(\d+)\s*мин'/);
        if (!m) continue;
        const slugMatch = lines[i].match(/(?:href:\s*'\/articles\/([^'/]+)\/'|id:\s*'([^']+)')/);
        const slug = slugMatch ? slugMatch[1] || slugMatch[2] : null;
        const row = report.rows.find((r) => r.slug === slug);
        if (!row || !writable(row) || Number(m[1]) === row.expected) continue;
        lines[i] = lines[i].replace(/readingTime:\s*'\d+\s*мин'/, `readingTime: '${row.expected} мин'`);
        changed = true;
        touched += 1;
      }
      if (changed) fs.writeFileSync(file, lines.join('\n'));
    }
  }

  return touched;
}

const report = audit();
const drift = report.rows.filter((r) => r.status !== 'ok');
const seriesDrift = report.seriesRows.filter((r) => r.status === 'drift');
const seriesExternal = report.seriesRows.filter((r) => r.status === 'no-mdx');
const seriesAdvisory = report.seriesRows.filter((r) => r.status === 'advisory' || r.status === 'no-body');
const byStatus = report.rows.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {});
const actionable = report.rows.filter((r) => r.status === 'drift' || r.status === 'missing');

const literalDrift = literalDriftOf(report);
const literalSlugs = new Set(report.literals.map((l) => l.slug));

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        policy: { wpm: WPM, rounding: 'ceil', minimum: 1 },
        articles: { total: report.rows.length, byStatus, rows: report.rows },
        series: { total: report.seriesRows.length, drift: seriesDrift.length, rows: report.seriesRows },
        downstream: report.downstream,
        componentLiterals: { surfaces: report.literals.length, slugs: literalSlugs.size, drift: literalDrift.length, rows: literalDrift },
      },
      null,
      2
    )
  );
  process.exit(0);
}

console.log('=== reading:time:audit (политика: 180 слов/мин, ceil, минимум 1) ===');
console.log(
  `Статей MDX: ${report.rows.length}; соответствуют: ${byStatus.ok || 0}; ` +
    `требуют пересчёта: ${actionable.length}; тело вне MDX (справка): ${byStatus.advisory || 0}; ` +
    `тело не найдено: ${byStatus['no-body'] || 0}.`
);
console.log(
  `Записей data/series.json: ${report.seriesRows.length}; расходятся: ${seriesDrift.length}; ` +
    `без MDX (живут только в series.json): ${seriesExternal.length}; справка вне MDX: ${seriesAdvisory.length}.`
);

const show = LIST ? actionable : actionable.slice(0, 15);
if (show.length) {
  console.log('\nстатья\tслов\tсейчас\tдолжно\tфакт.слов/мин');
  for (const r of show) console.log(`${r.slug}\t${r.words}\t${r.current ?? '—'}\t${r.expected}\t${r.implied ?? '—'}`);
  if (!LIST && actionable.length > show.length) console.log(`… ещё ${actionable.length - show.length} (полный список: --list)`);
}

console.log(
  `\nПроизводные поверхности: search-manifest ${report.downstream.manifest.length}, ` +
    `links-graph ${report.downstream.graph.length}, витрины серий (*.ts) ${report.downstream.configs.length}, ` +
    `js/search.js ${report.downstream.searchJs.length}. Манифест и граф пересобирают их собственные ` +
    'нормализаторы после сборки; витрины серий и js/search.js пишет --write.'
);

console.log(
  `\nЖёстко вписанное время в компонентах пилота: поверхностей ${report.literals.length} ` +
    `у ${literalSlugs.size} статей; расходятся с политикой: ${literalDrift.length}. ` +
    'Это не SSOT: у таких значений нет генератора, --write их не трогает (§8 политики).'
);
if (literalDrift.length) {
  const shown = LIST ? literalDrift : literalDrift.slice(0, 6);
  for (const l of shown) console.log(`  ${l.slug}\t${l.kind} ${l.value} → ${l.expected}\t${l.file}:${l.line}`);
  if (!LIST && literalDrift.length > shown.length) console.log(`  … ещё ${literalDrift.length - shown.length} (полный список: --list)`);
}

if (WRITE_LITERALS) {
  const touched = writeLiterals(report);
  console.log(`\n✅ --write-literals: переписано значений в компонентах: ${touched}. Пересоберите HTML и манифест.`);
  process.exit(0);
}

if (WRITE) {
  const touched = writeAll(report);
  console.log(`\n✅ --write: обновлено значений: ${touched}. Пересоберите производные поверхности и HTML.`);
  process.exit(0);
}

if (actionable.length || seriesDrift.some((r) => r.status === 'drift')) {
  console.log('\n❌ Единая политика не соблюдена. Исправление: node scripts/reading-time-audit.js --write');
  process.exit(1);
}
if (literalDrift.length) {
  console.log(
    '\n❌ SSOT пересчитан, но видимое время чтения на части страниц берётся из разметки компонентов ' +
      'и расходится с политикой. Нужна унификация литералов (§8 политики), а не повторный --write.'
  );
  process.exit(1);
}
console.log('\n✅ Все значения соответствуют единой политике.');
