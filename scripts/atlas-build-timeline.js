#!/usr/bin/env node
/**
 * atlas-build-timeline.js — генератор данных синхронной шкалы «цари ↔ пророки ↔ империи»
 * (цикл KA-7, карта KP-1; хронологическая полоса макета «Царства Израиля и Иудеи»).
 *
 * Вход:  data/atlas/{persons,periods,events,books}/*.json
 * Выход: data/atlas/generated/timeline-kings-prophets.json — ГЕНЕРИРУЕМЫЙ артефакт
 *        (не править руками; правки — в реестрах, затем перегенерация).
 *
 * Структура выхода:
 *   range {start,end}                — общий диапазон шкалы
 *   periods[]                       — чипы эпох (цвет/подпись) для верхней ленты
 *   lanes: united|israel|judah|prophets-north|prophets-south|prophets-exile|empires
 *     сегменты: {id,label,start,end,color?,assessment?,dynasty?,coregency?,bookAbbrs?}
 *   events[]                        — маркеры событий с extraBiblical-флагом
 *
 * Пророки раскладываются по полосам их realm (israel → north, judah → south,
 * babylon/persia → exile). Сорегентства не считаются ошибкой (помечены).
 * Валидация: сегменты каждой из полос israel/judah не пересекаются с учётом
 * допуска 1 год на передачу власти И известных сорегентств.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const A = (d) => path.join(ROOT, 'data', 'atlas', d);
const OUT = path.join(A('generated'), 'timeline-kings-prophets.json');

function loadDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_index.json')
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

const RANGE = { start: -1075, end: -400 }; // Самуил → Малахия

function within(t) { return t && t.end >= RANGE.start && t.start <= RANGE.end; }

function main() {
  const persons = loadDir(A('persons'));
  const periods = loadDir(A('periods')).filter((p) => p.end >= RANGE.start && p.start <= RANGE.end)
    .sort((a, b) => a.start - b.start);
  const events = loadDir(A('events')).filter((e) => e.year >= RANGE.start && e.year <= RANGE.end)
    .sort((a, b) => a.year - b.year);
  const books = new Map(loadDir(A('books')).map((b) => [b.id, b]));

  const seg = (h, t) => ({
    id: h.id,
    label: h.names.short || h.names.ru, // short — компактная форма для подписи на шкале
    ...(h.names.short ? { labelFull: h.names.ru } : {}), // полное имя — для тултипа/таблицы
    start: Math.max(t.start, RANGE.start),
    end: Math.min(t.end, RANGE.end),
    ...(h.assessment ? { assessment: h.assessment } : {}),
    ...(h.relations && h.relations.dynasty ? { dynasty: h.relations.dynasty } : {}),
    ...(t.coregency ? { coregency: true } : {}),
    ...(h.bookIds ? { bookAbbrs: h.bookIds.map((b) => (books.get(b) || {}).title?.abbr).filter(Boolean) } : {}),
  });

  const lanes = {
    united: [], israel: [], judah: [],
    'prophets-north': [], 'prophets-south': [], 'prophets-exile': [],
    empires: [],
  };

  for (const h of persons) {
    const t = h.reign || h.ministry;
    if (!within(t)) continue;
    if (h.role === 'king' || h.role === 'queen') {
      if (h.realm === 'united') lanes.united.push(seg(h, t));
      else if (h.realm === 'israel') lanes.israel.push(seg(h, t));
      else if (h.realm === 'judah') lanes.judah.push(seg(h, t));
    } else if (h.role === 'emperor') {
      lanes.empires.push({ ...seg(h, t), realm: h.realm });
    } else if (h.role === 'prophet' || h.role === 'prophetess') {
      if (h.realm === 'israel') lanes['prophets-north'].push(seg(h, t));
      else if (h.realm === 'judah' || h.realm === 'united') lanes['prophets-south'].push(seg(h, t));
      else lanes['prophets-exile'].push(seg(h, t)); // babylon / persia
    }
  }
  for (const k of Object.keys(lanes)) lanes[k].sort((a, b) => a.start - b.start || a.end - b.end);

  // Валидация непересечения престолов (допуск 1 год; сорегентства — легитимны).
  const problems = [];
  for (const laneName of ['israel', 'judah', 'united']) {
    const L = lanes[laneName];
    for (let i = 1; i < L.length; i++) {
      const prev = L[i - 1], cur = L[i];
      const overlapYears = prev.end - cur.start;
      if (overlapYears > 1 && !cur.coregency && !prev.coregency) {
        problems.push(`${laneName}: "${prev.label}" (${prev.start}..${prev.end}) пересекается с "${cur.label}" (${cur.start}..${cur.end}) на ${overlapYears} лет без пометки coregency`);
      }
    }
  }
  if (problems.length) {
    console.error('❌ timeline: конфликты престолов:');
    for (const p of problems) console.error('   - ' + p);
    process.exit(1);
  }

  const payload = {
    $comment: 'ГЕНЕРИРУЕТСЯ scripts/atlas-build-timeline.js из data/atlas/{persons,periods,events,books} — не править руками. Хронология консервативная библейская (ATLAS-CONTRACT §2-бис), разделённое царство — даты Тиле.',
    range: RANGE,
    periods: periods.map((p) => ({
      id: p.id, label: p.title.short || p.title.ru,
      start: Math.max(p.start, RANGE.start), end: Math.min(p.end, RANGE.end),
      color: p.colorToken, colorStatus: p.colorStatus,
    })),
    lanes,
    events: events.map((e) => ({
      id: e.id, label: e.title.ru, year: e.year, kind: e.kind,
      ...(e.approx ? { approx: true } : {}),
      ...(e.extraBiblical ? { extraBiblical: true } : {}),
      ...(e.placeIds ? { placeIds: e.placeIds } : {}),
    })),
    stats: {
      kings: lanes.united.length + lanes.israel.length + lanes.judah.length,
      prophets: lanes['prophets-north'].length + lanes['prophets-south'].length + lanes['prophets-exile'].length,
      emperors: lanes.empires.length,
      events: events.length,
    },
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  console.log(`[atlas-build-timeline] ${payload.stats.kings} царей | ${payload.stats.prophets} пророков | ${payload.stats.emperors} императоров | ${payload.stats.events} событий → data/atlas/generated/timeline-kings-prophets.json`);
}

main();
