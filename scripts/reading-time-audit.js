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
// Во сколько раз текст компонентов должен превышать MDX, чтобы считать MDX
// заглушкой. 1.5 отсекает обычные расхождения: у статей с реальным телом
// в MDX отношение близко к единице.
const COMPONENT_BODY_OVERRIDE_RATIO = 1.5;
// Для оболочек вне `/articles/` достаточно, чтобы компоненты покрывали
// половину MDX: там сериям свойственно дублировать текст в компоненте.
const COMPONENT_BODY_SHELL_RATIO = 0.5;

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
/**
 * Страница статьи может жить не под `/articles/`: серия «Баптисты России»
 * собрана как `/baptisty-rossii/<slug>/`, а MDX хранит только метаданные
 * (≈900 слов-заглушки). Такую страницу ищем по последнему сегменту маршрута.
 */
function pageShellFor(slug) {
  const direct = path.join(PAGES_DIR, 'articles', slug, 'index.astro');
  if (fs.existsSync(direct)) return direct;
  let found = null;
  const walk = (dir) => {
    if (found) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name === 'index.astro' && path.basename(dir) === slug) found = abs;
    }
  };
  if (fs.existsSync(PAGES_DIR)) walk(PAGES_DIR);
  return found;
}

/**
 * Оболочка вне `/articles/` может быть и тонкой нативной обёрткой вокруг
 * `<Content />`: тогда компоненты содержат только хром (десятки слов) и
 * считать по ним нельзя — иначе статья из 2500 слов превращается в минуту.
 */
function isComponentBackedPage(slug, comp, mdxWords) {
  if (!Number.isFinite(comp) || comp < COMPONENT_BODY_MIN_MDX_WORDS) return false;
  if (comp > mdxWords * COMPONENT_BODY_OVERRIDE_RATIO) return true;
  return shellOutsideArticles(slug) && comp >= mdxWords * COMPONENT_BODY_SHELL_RATIO;
}

function shellOutsideArticles(slug) {
  const page = pageShellFor(slug);
  if (!page) return false;
  return path.relative(PAGES_DIR, page).split(path.sep)[0] !== 'articles';
}

function componentBodyWords(slug) {
  const page = pageShellFor(slug);
  if (!page || !fs.existsSync(COMPONENTS_DIR)) return null;
  const dirs = new Set();
  for (const m of read(page).matchAll(/@\/components\/([^'"]+)\.astro/g)) {
    dirs.add(path.dirname(path.join(COMPONENTS_DIR, m[1])));
  }
  // Текст разнесён по секционным компонентам (`*Section*.astro`), поэтому
  // считаем весь каталог пилота, кроме PageHead (метаданные) и PageChrome (хром).
  // Но если оболочка лежит вне `/articles/`, каталог общий на всю серию:
  // там берём только то, что страница действительно импортирует.
  const outsideArticles = path.relative(PAGES_DIR, page).split(path.sep)[0] !== 'articles';
  const bodies = new Set();
  if (outsideArticles) {
    for (const m of read(page).matchAll(/@\/components\/([^'"]+)\.astro/g)) {
      const name = path.basename(m[1]);
      if (/(PageHead|PageChrome|PageFooter)$/.test(name)) continue;
      const abs = path.join(COMPONENTS_DIR, `${m[1]}.astro`);
      if (fs.existsSync(abs)) bodies.add(abs);
    }
  } else {
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.astro')) continue;
        if (/(PageHead|PageChrome)\.astro$/.test(name)) continue;
        bodies.add(path.join(dir, name));
      }
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

const CARD_START = /<li class="related-articles__item"|<div class="related-articles__body"|<a class="gbs2-next-card"|<div class="gbs2-next-card"|<a class="gb-series-link"|<a href="\.\.\/articles\/[a-z0-9-]+\/" class="h-article-card"/g;

function literalSurfaces(slug) {
  const page = path.join(PAGES_DIR, 'articles', slug, 'index.astro');
  if (!fs.existsSync(page) || !fs.existsSync(COMPONENTS_DIR)) return [];
  return scanComponentLiterals(page, { cardsOnly: false });
}

/**
 * Страницы вне `/articles/` — серии и справки, собранные из компонентов.
 *
 * Их карточки «Из библиотеки» ссылаются на статьи и печатают чужое время:
 * на четырёх частях «Нагорной проповеди» стояло одинаковое «Перевод · 50 мин»
 * и «Под редакцией · 41 мин» при фактических 62 и 58. Своего MDX у таких
 * страниц нет, поэтому здесь проверяются только карточки: их ожидание берётся
 * у статьи-цели, а не у самой страницы.
 */
/**
 * Атрибуты прогресса серии в оболочке страницы: `data-gbs2-part-min`,
 * `data-gbs2-done-min`, `data-gbs2-total-min`.
 *
 * Их никто не пересчитывал: у «Баптистов России» после смены политики
 * страница объявляла часть в 17 минут при фактических 15 и сумму 229 минут
 * при фактических 160, хотя витрина рядом уже показывала 15. Порядок и
 * минуты берутся из той же витрины серии, поэтому разойтись они не могут.
 */
function seriesPlans() {
  const plans = new Map();
  if (!fs.existsSync(SERIES_CONFIG_DIR)) return plans;
  for (const name of fs.readdirSync(SERIES_CONFIG_DIR).filter((n) => n.endsWith('.ts'))) {
    const entries = seriesConfigEntries(read(path.join(SERIES_CONFIG_DIR, name)));
    if (!entries.length) continue;
    const total = entries.reduce((sum, e) => sum + e.value, 0);
    let done = 0;
    for (const e of entries) {
      const plan = { part: e.value, done, total };
      plans.set(e.slug, plan);
      if (e.id) plans.set(e.id, plan);
      done += e.value;
    }
  }
  return plans;
}

function shellAttrSurfaces() {
  const plans = seriesPlans();
  if (!plans.size || !fs.existsSync(PAGES_DIR)) return [];
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, name.name);
      if (name.isDirectory()) {
        if (path.relative(PAGES_DIR, abs).split(path.sep)[0] === 'articles') continue;
        walk(abs);
      } else if (name.name === 'index.astro') {
        const source = read(abs);
        if (!source.includes('data-gbs2-part-min')) continue;
        const plan = plans.get(path.basename(dir));
        if (!plan) continue;
        const rel = path.relative(ROOT, abs);
        for (const m of source.matchAll(/data-gbs2-(part|done|total)-min="(\d+)"/g)) {
          const expected = plan[m[1]];
          if (!Number.isFinite(expected)) continue;
          out.push({
            file: rel,
            line: lineAt(source, m.index),
            offset: m.index,
            kind: 'shellattr',
            attr: m[1],
            value: Number(m[2]),
            target: null,
            expected,
            slug: `/${path.relative(PAGES_DIR, dir).split(path.sep).join('/')}/`,
            page: true,
          });
        }
      }
    }
  };
  walk(PAGES_DIR);
  return out;
}

/**
 * Прогресс серии в блоке `pages` конфига: `readingProgressPartMin` и
 * `readingProgressDoneMin`.
 *
 * Это девятая поверхность и самая незаметная: она не видна в витрине, но
 * рисует полосу «прочитано N из M минут» на каждой странице серии. Массовый
 * `--write` обновил `items[].readingTime`, а эти поля остались прежними —
 * у «Баптистов России» полоса считала 229 минут при 160 на витрине, у
 * подростковой серии 264 при 245, у «Отпадения» расходилась в трёх частях
 * из пяти. Слаги берём из витрины, поэтому расходиться они не могут.
 */
function seriesProgressSurfaces() {
  const plans = seriesPlans();
  if (!plans.size || !fs.existsSync(SERIES_CONFIG_DIR)) return [];
  const out = [];
  for (const name of fs.readdirSync(SERIES_CONFIG_DIR).filter((n) => n.endsWith('.ts'))) {
    const file = path.join(SERIES_CONFIG_DIR, name);
    const source = read(file);
    const rel = path.relative(ROOT, file);
    if (!source.includes('readingProgressPartMin')) continue;
    for (const m of source.matchAll(/readingProgress(Part|Done)Min:\s*(\d+)/g)) {
      const back = source.slice(Math.max(0, m.index - 800), m.index);
      const ids = [...back.matchAll(/id:\s*'([a-z0-9-]+)'/g)];
      if (!ids.length) continue;
      const plan = plans.get(ids[ids.length - 1][1]);
      if (!plan) continue;
      const expected = m[1] === 'Part' ? plan.part : plan.done;
      out.push({
        file: rel,
        line: lineAt(source, m.index),
        offset: m.index,
        kind: 'seriesprogress',
        attr: m[1],
        value: Number(m[2]),
        target: null,
        expected,
        slug: `${name}#${ids[ids.length - 1][1]}`,
        page: true,
      });
    }
  }
  return out;
}

/**
 * Минуты в данных серии: `slug: '...'` + `minutes: N`.
 *
 * Десятая поверхность. У серии «Сердце» и «Бытие 6» длительности живут не
 * строкой `readingTime: 'N мин'`, а числовым полем `minutes`, поэтому ни
 * витринный, ни прогрессный скан их не видели. Все 18 частей «Сердца»
 * обещали на 10–16 минут больше, чем читаются: «Свобода во Христе» — 26 при
 * фактических 11, «Сердце не в одиночку» — 27 при 11.
 */
function seriesDataSurfaces(expectedBySlug) {
  const sharedDir = path.dirname(SERIES_CONFIG_DIR);
  const dirs = [SERIES_CONFIG_DIR, sharedDir].filter((dir) => fs.existsSync(dir));
  if (!dirs.length) return [];
  const files = [];
  for (const dir of dirs) {
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      files.push(path.join(dir, name));
    }
  }
  const out = [];
  for (const file of files) {
    const source = read(file);
    if (!source.includes('minutes:')) continue;
    const rel = path.relative(ROOT, file);
    const anchors = [...source.matchAll(/slug:\s*'([a-z0-9-]+)'/g)];
    for (let i = 0; i < anchors.length; i += 1) {
      const slug = anchors[i][1];
      const expected = expectedBySlug.get(slug);
      if (!Number.isFinite(expected)) continue;
      const from = anchors[i].index;
      const to = i + 1 < anchors.length ? anchors[i + 1].index : source.length;
      const chunk = source.slice(from, to);
      const m = chunk.match(/minutes:\s*(\d+)/);
      if (!m) continue;
      out.push({
        file: rel,
        line: lineAt(source, from + m.index),
        offset: from + m.index,
        kind: 'seriesdata',
        value: Number(m[1]),
        target: slug,
        expected,
        slug: `${path.basename(file)}#${slug}`,
        page: true,
      });
    }
  }
  return out;
}

function pageLiteralSurfaces() {
  if (!fs.existsSync(PAGES_DIR) || !fs.existsSync(COMPONENTS_DIR)) return [];
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, name.name);
      if (name.isDirectory()) {
        if (path.relative(PAGES_DIR, abs).split(path.sep)[0] === 'articles') continue;
        walk(abs);
      } else if (name.name === 'index.astro') {
        const page = `/${path.relative(PAGES_DIR, dir).split(path.sep).join('/')}/`;
        for (const l of scanComponentLiterals(abs, { cardsOnly: true })) {
          out.push({ ...l, slug: page, page: true });
        }
      }
    }
  };
  walk(PAGES_DIR);
  return out;
}

function scanComponentLiterals(page, { cardsOnly }) {
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

      if (!cardsOnly) for (const m of source.matchAll(/⏱\s*(\d+)\s*мин/g)) {
        out.push({ file: rel, line: lineAt(source, m.index), offset: m.index, kind: 'visible', value: Number(m[1]), target: null });
        taken.push([m.index, m.index + m[0].length]);
      }
      if (!cardsOnly) for (const m of source.matchAll(/data-pagefind-meta="readTime"[^>]*>(\d+)</g)) {
        out.push({ file: rel, line: lineAt(source, m.index), offset: m.index, kind: 'pagefind', value: Number(m[1]), target: null });
        taken.push([m.index, m.index + m[0].length]);
      }

      // Структурированные данные страницы: `readingTime: 30` в объекте `page`
      // внутри PageHead. Это не видимая строка, но именно отсюда берут число
      // JSON-LD, SITE_CONFIG и мета pagefind.
      if (!cardsOnly) for (const m of source.matchAll(/readingTime:\s*(\d+)(?=\s*[,}])/g)) {
        out.push({ file: rel, line: lineAt(source, m.index), offset: m.index, kind: 'pagemeta', value: Number(m[1]), target: null });
        taken.push([m.index, m.index + m[0].length]);
      }

      // Карточки: метка «Богословие · 41 мин» и анонс «К текущей части · ~41 мин».
      // Цель — ссылка внутри той же карточки: карточки размечаются конечными
      // маркерами, поэтому ищем href не «рядом по тексту», а в границах блока.
      const starts = [...source.matchAll(CARD_START)].map((m) => m.index);
      // Книжная полка `/hard-texts/` печатает минуты отдельным `<span>` после
      // разделителя `·`, поэтому шаблон «· N мин» их не ловит: у полки шесть
      // карточек стояли с длинами, посчитанными до пересчёта серии.
      for (const m of source.matchAll(/(\d+)\s*мин/g)) {
        if (taken.some(([a, b]) => m.index >= a && m.index < b)) continue;
        const from = starts.filter((x) => x <= m.index).pop();
        if (from === undefined) continue;
        const to = starts.find((x) => x > m.index) ?? source.length;
        const chunk = source.slice(from, to);
        if (!chunk.includes('h-article-card')) continue;
        const href = chunk.match(/href="(?:\.\.\/)+(?:articles\/)?([a-z0-9-]+)\//);
        if (!href) continue;
        out.push({
          file: rel,
          line: lineAt(source, m.index),
          offset: m.index,
          kind: 'card',
          value: Number(m[1]),
          target: href[1],
        });
      }
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

/**
 * Записи витрин серий: `readingTime: '32 мин'` в том же объекте, что и
 * `href: '/articles/<slug>/'`. Ссылка и время стоят на разных строках,
 * поэтому построчный поиск их не связывал и 15 значений в pastor- и
 * teen-витринах оставались устаревшими. Ищем время, а ссылку берём
 * последней перед ним: в объекте-элементе она всегда идёт раньше.
 */
function seriesConfigEntries(text) {
  const out = [];
  for (const m of text.matchAll(/readingTime:\s*'(\d+)\s*мин'/g)) {
    const back = text.slice(Math.max(0, m.index - 500), m.index);
    // Slug — последний сегмент маршрута: `/baptisty-rossii/yuzhnaya-shtunda/`
    // ссылается на статью `yuzhnaya-shtunda`, а не на раздел. Раньше брался
    // первый сегмент, витрина «Баптистов России» целиком выпадала из проверки.
    const hrefs = [...back.matchAll(/href:\s*'\/?((?:[a-z0-9-]+\/)*)([a-z0-9-]+)\/'/g)];
    if (!hrefs.length) continue;
    // `id` нужен для конфигов, где блок `pages` индексируется внутренним
    // ключом (`teen-double-life`), а не адресом статьи.
    const ids = [...back.matchAll(/id:\s*'([a-z0-9-]+)'/g)];
    out.push({
      slug: hrefs[hrefs.length - 1][2],
      id: ids.length ? ids[ids.length - 1][1] : null,
      offset: m.index,
      value: Number(m[1]),
    });
  }
  return out;
}

function audit() {
  const rows = [];
  for (const { slug, file } of mdxFiles()) {
    const source = read(file);
    let mode = 'mdx';
    let words = readerWordCount(source);
    const comp = componentBodyWords(slug);
    if (words < COMPONENT_BODY_MIN_MDX_WORDS) {
      if (comp !== null) {
        mode = 'component-body';
        words = comp;
      } else {
        mode = 'no-body';
      }
    } else if (comp !== null && isComponentBackedPage(slug, comp, words)) {
      // MDX — заглушка с метаданными, текст живёт в компонентах. Признак не
      // «мало слов», а «в компонентах в разы больше»: у серии «Баптисты
      // России» в MDX ~870 слов при 2600 на странице, и политика считала
      // статью пятиминутной, пока страница читается четверть часа.
      mode = 'component-body';
      words = comp;
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
  const articleLiterals = rows.flatMap((r) =>
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

  // Карточки на страницах вне /articles/: ожидание всегда у статьи-цели.
  const pageLiterals = [
    ...pageLiteralSurfaces(),
    ...shellAttrSurfaces(),
    ...seriesProgressSurfaces(),
    ...seriesDataSurfaces(expectedBySlug),
  ].map((l) => ({
    ...l,
    expected:
      l.kind === 'shellattr' || l.kind === 'seriesprogress' || l.kind === 'seriesdata'
        ? l.expected
        : l.target
          ? expectedBySlug.get(l.target) ?? null
          : null,
  }));
  const literals = [...articleLiterals, ...pageLiterals];

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
      // В графе связей поле называется `readingTime`, в манифесте — `readTime`.
      const graphValue = Number.isFinite(node.readTime) ? node.readTime : node.readingTime;
      if (graphValue !== expected) downstream.graph.push({ slug, graph: graphValue ?? null, expected });
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
      const text = read(path.join(SERIES_CONFIG_DIR, name));
      for (const entry of seriesConfigEntries(text)) {
        const expected = expectedBySlug.get(entry.slug);
        if (expected === undefined || entry.value === expected) continue;
        downstream.configs.push({ slug: entry.slug, file: rel, offset: entry.offset, value: entry.value, expected });
      }
    }
  }

  return { rows, seriesRows, downstream, literals };
}

function literalDriftOf(report) {
  return report.literals.filter((l) => Number.isFinite(l.expected) && l.value !== l.expected);
}

function writable(row) {
  // `advisory` — тело статьи живёт в компонентах, MDX хранит только метаданные.
  // Писать можно, только если ожидание посчитано по самим компонентам
  // (`mode === 'component-body'` и слова найдены): тогда это реальный текст
  // страницы, а не догадка по MDX. Иначе — только отчёт.
  const componentBacked = row && row.mode === 'component-body' && row.words > 0;
  if (!row || row.status === 'no-body' || row.status === 'missing') return false;
  if (row.status === 'advisory' && !componentBacked) return false;
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
      else if (l.kind === 'pagemeta') next = tail.replace(/^(readingTime:\s*)\d+(?=\s*[,}])/, `$1${l.expected}`);
      else if (l.kind === 'shellattr') next = tail.replace(/^(data-gbs2-(?:part|done|total)-min=")\d+(")/, `$1${l.expected}$2`);
      else if (l.kind === 'seriesprogress') next = tail.replace(/^(readingProgress(?:Part|Done)Min:\s*)\d+/, `$1${l.expected}`);
      else if (l.kind === 'seriesdata') next = tail.replace(/^(minutes:\s*)\d+/, `$1${l.expected}`);
      else if (tail.startsWith(`${l.value} мин`)) next = tail.replace(/^\d+(?=\s*мин)/, `${l.expected}`);
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
      let text = read(file);
      let changed = false;
      const entries = seriesConfigEntries(text).sort((a, b) => b.offset - a.offset);
      for (const entry of entries) {
        const row = report.rows.find((r) => r.slug === entry.slug);
        if (!row || !writable(row) || entry.value === row.expected) continue;
        const tail = text.slice(entry.offset);
        const next = tail.replace(/^(readingTime:\s*')\d+(\s*мин')/, `$1${row.expected}$2`);
        if (next !== tail) {
          text = text.slice(0, entry.offset) + next;
          changed = true;
          touched += 1;
        }
      }
      if (changed) fs.writeFileSync(file, text);
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
  `\nЖёстко вписанное время в разметке страниц: поверхностей ${report.literals.length} ` +
    `у ${literalSlugs.size} страниц; расходятся с политикой: ${literalDrift.length}. ` +
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
