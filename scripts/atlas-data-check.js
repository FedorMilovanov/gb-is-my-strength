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
 *   6. placements ссылаются только на семейства из coordinate-spaces.json; у места есть
 *      координата в семействе КАЖДОЙ его карты и нет координат-«сирот» в чужих семействах;
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
  const spacesObj = JSON.parse(fs.readFileSync(SPACES, 'utf8')).spaces;
  const spaces = new Set(Object.keys(spacesObj));
  // карта → её координатное семейство (для сверки полноты placements)
  const mapFamily = {};
  for (const [fam, sp] of Object.entries(spacesObj)) for (const slug of sp.maps || []) mapFamily[slug] = fam;

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
    const neededFams = new Set();
    for (const m of p.maps || []) {
      const key = `${m.slug}:${m.localId}`;
      if (!routeOcc.has(key)) fail(`${ctx}: maps ссылается на несуществующее вхождение ${key}`);
      if (claimed.has(key)) fail(`${ctx}: вхождение ${key} уже закреплено за "${claimed.get(key)}"`);
      claimed.set(key, p.id);
      if (mapFamily[m.slug]) neededFams.add(mapFamily[m.slug]);
      else fail(`${ctx}: карта "${m.slug}" не приписана ни к одному семейству в coordinate-spaces.json`);
    }
    // Полнота и отсутствие «сирот»: место должно иметь координату в семействе КАЖДОЙ
    // своей карты и не иметь координат в семействах, где его карт нет (защита от
    // повторения дефекта «Рим под ключом levant»).
    for (const fam of neededFams) {
      if (!(p.placements && p.placements[fam])) fail(`${ctx}: нет placement для семейства "${fam}" (карты места этого требуют)`);
    }
    for (const fam of Object.keys(p.placements || {})) {
      if (!neededFams.has(fam)) fail(`${ctx}: placement "${fam}" без единой карты этого семейства — чужая/устаревшая координата`);
    }
  }

  for (const [ctx, pid] of parents) {
    if (!ids.has(pid)) fail(`${ctx}: parentId "${pid}" не существует в реестре`);
  }

  // Дубли sameAs.openbible: два самостоятельных места с одним slug — подозрение
  // на дубль сущности (так были пойманы hebron_shoftim и kadesh/kadesh-barnea).
  // Суб-локации (с parentId) легитимно делят slug родителя — исключаются.
  const bySlugX = new Map();
  for (const f of files) {
    const p = JSON.parse(fs.readFileSync(path.join(PLACES_DIR, f), 'utf8'));
    const slug = p.sameAs && p.sameAs.openbible;
    if (!slug || p.parentId) continue;
    if (bySlugX.has(slug)) fail(`дубль сущности? "${bySlugX.get(slug)}" и "${p.id}" делят sameAs.openbible="${slug}" без parentId — слить или обосновать`);
    else bySlugX.set(slug, p.id);
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

  // Реестр дорог (data/atlas/routes/*.json) — если существует.
  const ROUTES_DIR = path.join(ROOT, 'data', 'atlas', 'routes');
  if (fs.existsSync(ROUTES_DIR)) {
    const rs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'atlas', 'schemas', 'route.schema.json'), 'utf8'));
    const KINDS = new Set(rs.properties.kind.enum);
    for (const f of fs.readdirSync(ROUTES_DIR).filter((x) => x.endsWith('.json'))) {
      const r = JSON.parse(fs.readFileSync(path.join(ROUTES_DIR, f), 'utf8'));
      const ctx = `routes/${f}`;
      if (r.id !== path.basename(f, '.json')) fail(`${ctx}: id != имя файла`);
      if (!r.title || !r.title.ru) fail(`${ctx}: title.ru пуст`);
      if (!KINDS.has(r.kind)) fail(`${ctx}: kind вне enum`);
      if (!Array.isArray(r.waypoints) || r.waypoints.length < 2) fail(`${ctx}: waypoints < 2`);
      for (const w of r.waypoints || []) {
        if (w.placeId && !ids.has(w.placeId)) fail(`${ctx}: waypoint placeId "${w.placeId}" нет в реестре мест`);
        if (!w.placeId && !w.label) fail(`${ctx}: waypoint без placeId и label`);
      }
    }
  }

  // Реестр персон (data/atlas/persons/*.json) — если существует.
  const PERSONS_DIR = path.join(ROOT, 'data', 'atlas', 'persons');
  if (fs.existsSync(PERSONS_DIR)) {
    const hs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'atlas', 'schemas', 'person.schema.json'), 'utf8'));
    const ROLES = new Set(hs.properties.role.enum);
    const REALMS = new Set(hs.properties.realm.enum);
    const periodIds = fs.existsSync(path.join(ROOT, 'data', 'atlas', 'periods'))
      ? new Set(fs.readdirSync(path.join(ROOT, 'data', 'atlas', 'periods')).map((f) => path.basename(f, '.json')))
      : new Set();
    const personFiles = fs.readdirSync(PERSONS_DIR).filter((x) => x.endsWith('.json'));
    const personIds = new Set(personFiles.map((f) => path.basename(f, '.json')));
    for (const f of personFiles) {
      const h = JSON.parse(fs.readFileSync(path.join(PERSONS_DIR, f), 'utf8'));
      const ctx = `persons/${f}`;
      if (h.id !== path.basename(f, '.json')) fail(`${ctx}: id != имя файла`);
      if (!ID_RE.test(h.id)) fail(`${ctx}: id вне паттерна`);
      if (!h.names || !h.names.ru) fail(`${ctx}: names.ru пуст`);
      if (!ROLES.has(h.role)) fail(`${ctx}: role вне enum`);
      if (h.realm && !REALMS.has(h.realm)) fail(`${ctx}: realm вне enum`);
      const t = h.reign || h.ministry;
      if ((h.role === 'king' || h.role === 'queen' || h.role === 'prophet' || h.role === 'prophetess') && !t) fail(`${ctx}: нет reign/ministry`);
      if (t && !(Number.isInteger(t.start) && Number.isInteger(t.end) && t.start <= t.end)) fail(`${ctx}: годы некорректны`);
      for (const pid of h.periodIds || []) if (!periodIds.has(pid)) fail(`${ctx}: periodId "${pid}" не существует`);
      for (const pl of h.placeIds || []) if (!ids.has(pl)) fail(`${ctx}: placeId "${pl}" нет в реестре мест`);
      const succ = h.relations && h.relations.successor;
      if (succ && !personIds.has(succ)) fail(`${ctx}: successor "${succ}" не существует`);
    }
  }

  // Реестр событий (data/atlas/events/*.json) — если существует.
  const EVENTS_DIR = path.join(ROOT, 'data', 'atlas', 'events');
  if (fs.existsSync(EVENTS_DIR)) {
    const es = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'atlas', 'schemas', 'event.schema.json'), 'utf8'));
    const EKINDS = new Set(es.properties.kind.enum);
    const periodIds2 = new Set(fs.readdirSync(path.join(ROOT, 'data', 'atlas', 'periods')).map((f) => path.basename(f, '.json')));
    const personIds2 = fs.existsSync(path.join(ROOT, 'data', 'atlas', 'persons'))
      ? new Set(fs.readdirSync(path.join(ROOT, 'data', 'atlas', 'persons')).map((f) => path.basename(f, '.json')))
      : new Set();
    const knownMaps2 = new Set(mapSlugs);
    for (const f of fs.readdirSync(EVENTS_DIR).filter((x) => x.endsWith('.json'))) {
      const e = JSON.parse(fs.readFileSync(path.join(EVENTS_DIR, f), 'utf8'));
      const ctx = `events/${f}`;
      if (e.id !== path.basename(f, '.json')) fail(`${ctx}: id != имя файла`);
      if (!e.title || !e.title.ru) fail(`${ctx}: title.ru пуст`);
      if (!EKINDS.has(e.kind)) fail(`${ctx}: kind вне enum`);
      if (!Number.isInteger(e.year)) fail(`${ctx}: year не целое`);
      if (e.periodId && !periodIds2.has(e.periodId)) fail(`${ctx}: periodId "${e.periodId}" не существует`);
      // Год события внутри диапазона своей эпохи.
      if (e.periodId) {
        const pd = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'atlas', 'periods', e.periodId + '.json'), 'utf8'));
        if (e.year < pd.start || e.year > pd.end) fail(`${ctx}: year ${e.year} вне эпохи ${e.periodId} (${pd.start}..${pd.end})`);
      }
      for (const pl of e.placeIds || []) if (!ids.has(pl)) fail(`${ctx}: placeId "${pl}" нет в реестре мест`);
      for (const pe of e.personIds || []) if (!personIds2.has(pe)) fail(`${ctx}: personId "${pe}" нет в реестре персон`);
      for (const m of e.maps || []) if (!knownMaps2.has(m)) fail(`${ctx}: карта "${m}" не существует`);
    }
  }

  // Реестр книг (data/atlas/books/*.json) — если существует.
  const BOOKS_DIR = path.join(ROOT, 'data', 'atlas', 'books');
  const bookIds = new Set();
  if (fs.existsSync(BOOKS_DIR)) {
    const bs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'atlas', 'schemas', 'book.schema.json'), 'utf8'));
    const SECTIONS = new Set(bs.properties.section.enum);
    const orders = new Set();
    const knownMaps3 = new Set(mapSlugs);
    for (const f of fs.readdirSync(BOOKS_DIR).filter((x) => x.endsWith('.json'))) {
      const b = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, f), 'utf8'));
      const ctx = `books/${f}`;
      if (b.id !== path.basename(f, '.json')) fail(`${ctx}: id != имя файла`);
      if (!b.title || !b.title.ru) fail(`${ctx}: title.ru пуст`);
      if (!SECTIONS.has(b.section)) fail(`${ctx}: section вне enum`);
      if (!(Number.isInteger(b.order) && b.order >= 1 && b.order <= 66)) fail(`${ctx}: order вне 1..66`);
      if (orders.has(b.order)) fail(`${ctx}: дубль order ${b.order}`);
      orders.add(b.order);
      for (const m of b.maps || []) if (!knownMaps3.has(m)) fail(`${ctx}: карта "${m}" не существует`);
      bookIds.add(b.id);
    }
    if (bookIds.size && bookIds.size !== 66) fail(`books: ожидалось 66 книг, найдено ${bookIds.size}`);
    // Связка пророк → книга.
    const PD = path.join(ROOT, 'data', 'atlas', 'persons');
    if (fs.existsSync(PD)) {
      for (const f of fs.readdirSync(PD).filter((x) => x.endsWith('.json'))) {
        const h = JSON.parse(fs.readFileSync(path.join(PD, f), 'utf8'));
        for (const bid of h.bookIds || []) {
          if (!bookIds.has(bid)) fail(`persons/${f}: bookId "${bid}" нет в реестре книг`);
        }
      }
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
  const cnt = (d) => { const dir = path.join(ROOT, 'data', 'atlas', d); return fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== '_index.json').length : 0; };
  console.log(`✅ ATLAS DATA CHECK: ${files.length} мест + ${cnt('periods')} эпох + ${cnt('routes')} дорог + ${cnt('persons')} персон + ${cnt('events')} событий + ${cnt('books')} книг валидны; покрытие карт полное (${routeOcc.size} вхождений в ${mapSlugs.length} картах)`);
}

main();
