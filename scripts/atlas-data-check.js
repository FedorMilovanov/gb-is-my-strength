#!/usr/bin/env node
/**
 * atlas-data-check.js — валидатор канонического реестра мест (ATLAS-CONTRACT §7, гейт данных).
 *
 * Проверяет data/atlas/places/*.json без внешних зависимостей (Ajv появится
 * системным лейном; ключевые правила схемы place.schema.json продублированы здесь
 * механически, а enum-словари читаются ПРЯМО из схемы — единый источник истины):
 *
 *   1. имя файла == id; id соответствует паттерну схемы (латиница kebab-case);
 *   2. names.ru непусто; type ∈ enum схемы;
 *   3. identifications[].status ∈ словарю уверенности; score в диапазоне схемы (отрицательный = rejected); lat/lng в диапазонах;
 *   4. geo.lat/lng в диапазонах;
 *   5. parentId указывает на существующее место;
 *   6. placements ссылаются только на семейства из coordinate-spaces.json;
 *   7. maps[]: slug — существующая карта, localId — реальное место её route.json;
 *   8. (map, localId) закреплены ровно за ОДНИМ каноническим местом;
 *   9. ПОЛНОЕ ПОКРЫТИЕ: каждое место каждого route.json учтено в реестре
 *      (карты и реестр не могут разъехаться молча).
 *
 * Запуск: node scripts/atlas-data-check.js   (exit 1 при любой ошибке)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PLACES_DIR = path.join(ROOT, 'data', 'atlas', 'places');
const SCHEMA = path.join(ROOT, 'data', 'atlas', 'schemas', 'place.schema.json');
const SPACES = path.join(ROOT, 'data', 'atlas', 'coordinate-spaces.json');
const KARTY = path.join(ROOT, 'karty');

const errors = [];
function fail(msg) { errors.push(msg); }

function main() {
  if (!fs.existsSync(PLACES_DIR)) {
    console.error('[atlas-data-check] каталога data/atlas/places нет — сначала node scripts/atlas-promote-places.js');
    process.exit(1);
  }
  const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
  const ID_RE = new RegExp(schema.properties.id.pattern);
  const TYPES = new Set(schema.properties.type.enum);
  const STATUSES = new Set(schema.properties.identifications.items.properties.status.enum);
  const scoreSchema = schema.properties.identifications.items.properties.score;
  const SCORE_MIN = scoreSchema.minimum, SCORE_MAX = scoreSchema.maximum;
  const LEVELS = new Set(['A', 'B', 'C', 'HOLD']);
  const spaces = new Set(Object.keys(JSON.parse(fs.readFileSync(SPACES, 'utf8')).spaces));

  // Вхождения из route.json — эталон покрытия.
  const routeOcc = new Set();
  const mapSlugs = fs.readdirSync(KARTY).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(KARTY, d, 'route.json')));
  for (const slug of mapSlugs) {
    const route = JSON.parse(fs.readFileSync(path.join(KARTY, slug, 'route.json'), 'utf8'));
    for (const p of route.places || []) routeOcc.add(`${slug}:${p.id}`);
  }

  const files = fs.readdirSync(PLACES_DIR).filter((f) => f.endsWith('.json') && f !== '_index.json');
  const ids = new Set();
  const claimed = new Map(); // occurrence -> canonical id
  const parents = [];

  for (const f of files) {
    const p = JSON.parse(fs.readFileSync(path.join(PLACES_DIR, f), 'utf8'));
    const ctx = `places/${f}`;

    if (p.id !== path.basename(f, '.json')) fail(`${ctx}: id "${p.id}" != имя файла`);
    if (!ID_RE.test(p.id)) fail(`${ctx}: id "${p.id}" не соответствует паттерну схемы`);
    if (ids.has(p.id)) fail(`${ctx}: дубль id`);
    ids.add(p.id);

    if (!p.names || !p.names.ru || !String(p.names.ru).trim()) fail(`${ctx}: names.ru пуст`);
    if (!TYPES.has(p.type)) fail(`${ctx}: type "${p.type}" вне enum схемы`);

    if (p.geo) {
      if (!(p.geo.lat >= -90 && p.geo.lat <= 90)) fail(`${ctx}: geo.lat вне диапазона`);
      if (!(p.geo.lng >= -180 && p.geo.lng <= 180)) fail(`${ctx}: geo.lng вне диапазона`);
    }
    for (const ident of p.identifications || []) {
      if (!STATUSES.has(ident.status)) fail(`${ctx}: identification status "${ident.status}" вне словаря`);
      if (ident.score != null && !(ident.score >= SCORE_MIN && ident.score <= SCORE_MAX)) fail(`${ctx}: score ${ident.score} вне ${SCORE_MIN}..${SCORE_MAX}`);
      if (ident.lat != null && !(ident.lat >= -90 && ident.lat <= 90)) fail(`${ctx}: ident.lat вне диапазона`);
      if (ident.lng != null && !(ident.lng >= -180 && ident.lng <= 180)) fail(`${ctx}: ident.lng вне диапазона`);
      for (const s of ident.sources || []) {
        if (s.level && !LEVELS.has(s.level)) fail(`${ctx}: source level "${s.level}" вне A/B/C/HOLD`);
      }
    }
    if (p.parentId) parents.push([ctx, p.parentId]);

    for (const space of Object.keys(p.placements || {})) {
      if (!spaces.has(space)) fail(`${ctx}: placement в необъявленном семействе "${space}"`);
    }
    for (const m of p.maps || []) {
      const key = `${m.slug}:${m.localId}`;
      if (!routeOcc.has(key)) fail(`${ctx}: maps ссылается на несуществующее вхождение ${key}`);
      if (claimed.has(key)) fail(`${ctx}: вхождение ${key} уже закреплено за "${claimed.get(key)}"`);
      claimed.set(key, p.id);
    }
  }

  for (const [ctx, pid] of parents) {
    if (!ids.has(pid)) fail(`${ctx}: parentId "${pid}" не существует в реестре`);
  }

  // Реестр эпох (data/atlas/periods/*.json) — если существует.
  const PERIODS_DIR = path.join(ROOT, 'data', 'atlas', 'periods');
  const PERIOD_SCHEMA = path.join(ROOT, 'data', 'atlas', 'schemas', 'period.schema.json');
  if (fs.existsSync(PERIODS_DIR)) {
    const ps = JSON.parse(fs.readFileSync(PERIOD_SCHEMA, 'utf8'));
    const P_ID = new RegExp(ps.properties.id.pattern);
    const ERAS = new Set(ps.properties.engineEra.enum);
    const knownMaps = new Set(mapSlugs);
    let prev = null;
    const periodFiles = fs.readdirSync(PERIODS_DIR).filter((f) => f.endsWith('.json'));
    const periods = periodFiles.map((f) => ({ f, d: JSON.parse(fs.readFileSync(path.join(PERIODS_DIR, f), 'utf8')) }));
    periods.sort((a, b) => a.d.start - b.d.start);
    for (const { f, d } of periods) {
      const ctx = `periods/${f}`;
      if (d.id !== path.basename(f, '.json')) fail(`${ctx}: id != имя файла`);
      if (!P_ID.test(d.id)) fail(`${ctx}: id вне паттерна`);
      if (!d.title || !d.title.ru) fail(`${ctx}: title.ru пуст`);
      if (!(Number.isInteger(d.start) && Number.isInteger(d.end) && d.start < d.end)) fail(`${ctx}: start/end некорректны`);
      if (d.engineEra && !ERAS.has(d.engineEra)) fail(`${ctx}: engineEra вне enum`);
      if (d.colorToken && !/^#[0-9a-f]{6}$/.test(d.colorToken)) fail(`${ctx}: colorToken не hex`);
      for (const m of d.maps || []) if (!knownMaps.has(m)) fail(`${ctx}: карта "${m}" не существует`);
      if (prev && d.start > prev.d.end) fail(`${ctx}: разрыв оси времени после ${prev.f} (${prev.d.end} → ${d.start})`);
      prev = { f, d };
    }
  }

  // Полное покрытие route.json → реестр.
  for (const key of routeOcc) {
    if (!claimed.has(key)) fail(`покрытие: место карты ${key} не учтено в реестре places/`);
  }

  if (errors.length) {
    console.error(`❌ ATLAS DATA CHECK: ${errors.length} ошибок:`);
    for (const e of errors) console.error('   - ' + e);
    process.exit(1);
  }
  console.log(`✅ ATLAS DATA CHECK: ${files.length} мест валидны; покрытие карт полное (${routeOcc.size} вхождений в ${mapSlugs.length} картах)`);
}

main();
