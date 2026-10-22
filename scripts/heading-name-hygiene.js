#!/usr/bin/env node
'use strict';
/**
 * GBS-SECTION-HEADING-NAME-POLLUTION (остаток): статическая гигиена доступных
 * имён заголовков в собранных dist-страницах.
 *
 * Зачем это нужно. Канонический ремонт живёт в src/runtime/article-heading-anchors.js:
 * installArticleHeadingAnchors() оборачивает собственный текст заголовка в
 * <span class="heading-anchor__name"> и ставит заголовку aria-labelledby, чтобы
 * подпись вложенного контрола («Скопировать ссылку на раздел») не становилась
 * хвостом доступного имени. Но на части маршрутов (лендинги, каталоги, nagornaya,
 * legacy-обёртки) якоря ставит минифицированный js/site.js на ЛЮБЫЕ h2[id]/h3[id]/
 * h4[id] без исключений, а читаемый рантайм туда не подключается — имена оставались
 * загрязнёнными (замер AX-деревом на 41f7975: 39 имён на 11 маршрутах). Править
 * минифицированный runtime — костыль; два установщика якорей на одних заголовках —
 * тем более.
 *
 * Что делает этот шаг. Даёт каждому h2/h3/h4 c id статический aria-label, равный
 * его собственному тексту (схлопнутые пробелы, trim — та же нормализация, что у
 * построителей оглавлений и у AX-вычисления имени из содержимого). Доступное имя
 * заголовка тогда равно его тексту независимо от того, какой установщик и когда
 * вставит внутрь контрол: aria-label вычисляется на сборке, а не из содержимого.
 *
 * Почему aria-label, а не рантайм-обёртка span+aria-labelledby. Обёртка меняет
 * структуру потомков заголовка. Замер в браузере (base/after, dist 4322/4321)
 * нашёл заголовки с inline display:flex и несколькими потомками — например
 * h2#biografiiRecentTitle (flex, gap 8px, потомки: dot-span 6×6 + текст + якорь):
 * обёртка превратила [dot][текст][якорь] в [span(dot+текст)][якорь] и сдвинула
 * текст на 14px — реальная пиксельная регрессия (~900 px на полосу). Статический
 * парсер не может надёжно узнать computed display (классовый flex живёт в CSS),
 * поэтому структурная обёртка на всей поверхности небезопасна. aria-label —
 * атрибутивная операция: 0 байтов потока, 0 пикселей (подтверждено диффом
 * 27 пар скриншотов light/dark/390 против control-замера шума среды).
 *
 * Совместимость:
 *  - на нативных маршрутах читаемый рантайм ставит aria-labelledby на span —
 *    по spec accname aria-labelledby имеет приоритет над aria-label, а значение
 *    то же (собственный текст), поэтому два механизма не конфликтуют;
 *  - textContent заголовков не меняется: построители оглавлений
 *    (js/enhancements.js, js/floating-cluster-controller.js, js/nagornaya-mobile-toc.js)
 *    читают те же подписи и href;
 *  - js/site.js не тронут: его per-node слушатели, копирование и тост работают
 *    как раньше (парный поведенческий замер: clipboard path+hash, тост, hit-test,
 *    Tab — совпали на всех маршрутах);
 *  - заголовки, которым id присваивает рантайм (js/nagornaya-mobile-toc.js),
 *    получают статические id в источнике (NagornayaIndexMain.astro: пять-частей-серии,
 *    нашли-неточность — слаггер уважает существующий id, URL byte-identичны);
 *  - шаг идемпотентен: повторный пропуск не меняет файлы.
 *
 * Границы: заголовки с пустым текстом не получают пустой aria-label (имя из
 * содержимого всё равно пустое); заголовки со статическим aria-labelledby не
 * трогает (явная ссылка уважаема); содержимое <template> не обходится.
 *
 * Механика: parse5 c sourceCodeLocationInfo, точечные вставки в исходную строку
 * (сериализация не используется — файл меняется только в месте атрибута, всё
 * остальное байт-в-байт). После записи каждый изменённый файл перечитывается и
 * проверяется заново (fail-closed): aria-label равен ожидаемому тексту, текст
 * заголовка не изменился.
 *
 * Подключение: postbuild-шаг цепочки strangler:build* после
 * pastor-series-heading-id-hygiene.js (сначала снимаются авто-id, затем именуются
 * оставшиеся заголовки с id) и до pastor-series-guards-dist.js.
 */
const fs = require('fs');
const path = require('path');
const parse5 = require('parse5');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HEADING_RE = /^h[234]$/;

function fail(message) {
  console.error(`❌ heading-name hygiene: ${message}`);
  process.exit(1);
}

function walkHtmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'pagefind') continue; // поисковый индекс, не страницы
      out.push(...walkHtmlFiles(full));
    } else if (entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function attrsOf(node) {
  const map = new Map();
  for (const attr of node.attrs || []) map.set(attr.name, attr.value);
  return map;
}

function textOf(node) {
  if (node.nodeName === '#text') return node.value;
  if (node.nodeName === 'template') return '';
  let text = '';
  for (const child of node.childNodes || []) text += textOf(child);
  return text;
}

function collect(node, visitor) {
  if (node.tagName) visitor(node);
  if (node.nodeName === 'template') return; // содержимое template рантайм не видит
  for (const child of node.childNodes || []) collect(child, visitor);
}

function escapeAttr(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function processFile(file) {
  const html = fs.readFileSync(file, 'utf8');
  const document = parse5.parse(html, { sourceCodeLocationInfo: true });

  const headings = [];
  collect(document, (node) => {
    const attrs = attrsOf(node);
    if (node.tagName && HEADING_RE.test(node.tagName) && attrs.has('id')) headings.push(node);
  });

  const edits = [];
  const plan = [];
  let skippedEmpty = 0;
  let skippedLabelledby = 0;
  let alreadyLabeled = 0;
  let skippedNoLoc = 0;

  for (const heading of headings) {
    const attrs = attrsOf(heading);
    if (attrs.has('aria-labelledby')) { skippedLabelledby += 1; continue; }
    const text = textOf(heading).replace(/\s+/g, ' ').trim();
    if (!text) { skippedEmpty += 1; continue; }
    if (attrs.get('aria-label') === text) { alreadyLabeled += 1; continue; }
    const loc = heading.sourceCodeLocation;
    if (!loc || !loc.startTag) { skippedNoLoc += 1; continue; }

    const attrLocs = loc.startTag.attrs || {};
    if (attrLocs['aria-label']) {
      const attrLoc = attrLocs['aria-label'];
      edits.push({ offset: attrLoc.startOffset, replaceEnd: attrLoc.endOffset, text: `aria-label="${escapeAttr(text)}"` });
    } else {
      edits.push({ offset: loc.startTag.endOffset - 1, text: ` aria-label="${escapeAttr(text)}"` });
    }
    plan.push({ headingId: attrs.get('id'), text });
  }

  if (!edits.length) {
    return { changed: false, labeled: 0, skippedEmpty, skippedLabelledby, alreadyLabeled, skippedNoLoc };
  }

  // Вставки/замены применяем от конца к началу, чтобы офсеты не съезжали.
  edits.sort((a, b) => (b.replaceEnd ?? b.offset) - (a.replaceEnd ?? a.offset) || b.offset - a.offset);
  let next = html;
  for (const edit of edits) {
    const end = edit.replaceEnd ?? edit.offset;
    next = next.slice(0, edit.offset) + edit.text + next.slice(end);
  }

  // Fail-closed постпроверка: перечитываем результат и сверяем каждый заголовок.
  const reparsed = parse5.parse(next, { sourceCodeLocationInfo: false });
  const byId = new Map();
  collect(reparsed, (node) => {
    const attrs = attrsOf(node);
    if (node.tagName && HEADING_RE.test(node.tagName) && attrs.has('id') && !byId.has(attrs.get('id'))) {
      byId.set(attrs.get('id'), node);
    }
  });
  for (const { headingId, text } of plan) {
    const heading = byId.get(headingId);
    if (!heading) fail(`${path.relative(ROOT, file)}: заголовок #${headingId} пропал после вставки`);
    if (attrsOf(heading).get('aria-label') !== text) fail(`${path.relative(ROOT, file)}: aria-label заголовка #${headingId} не совпал с текстом`);
    const textAfter = textOf(heading).replace(/\s+/g, ' ').trim();
    if (textAfter !== text) fail(`${path.relative(ROOT, file)}: текст заголовка #${headingId} изменился`);
  }

  fs.writeFileSync(file, next);
  return { changed: true, labeled: plan.length, skippedEmpty, skippedLabelledby, alreadyLabeled, skippedNoLoc };
}

function main() {
  if (!fs.existsSync(DIST)) fail('dist/ не найден — сначала соберите публикацию');
  const files = walkHtmlFiles(DIST).sort();
  let filesChanged = 0;
  let labeled = 0;
  let skippedEmpty = 0;
  let skippedLabelledby = 0;
  let alreadyLabeled = 0;
  let skippedNoLoc = 0;
  for (const file of files) {
    const result = processFile(file);
    if (result.changed) filesChanged += 1;
    labeled += result.labeled;
    skippedEmpty += result.skippedEmpty;
    skippedLabelledby += result.skippedLabelledby;
    alreadyLabeled += result.alreadyLabeled;
    skippedNoLoc += result.skippedNoLoc;
  }
  console.log(
    `✅ heading-name hygiene: ${files.length} файлов, ${filesChanged} изменено, `
    + `${labeled} заголовков получили статический aria-label (пустых ${skippedEmpty}, `
    + `с aria-labelledby ${skippedLabelledby}, уже помечено ${alreadyLabeled}, без локации ${skippedNoLoc}); постпроверка прошла`,
  );
}

main();
