#!/usr/bin/env node
/**
 * atlas-promote-places.js — промоут draft-реестра в канонический (KA-2c).
 *
 * Вход:  data/atlas/places-draft.json      (extract + enrich)
 *        data/atlas/review-decisions.json  (экспертные решения выверки)
 *        .cache/openbible/*.jsonl          (для обогащения записей-сплитов)
 * Выход: data/atlas/places/<id>.json       (по файлу на место; _extract удаляется)
 *        + сводка в stdout
 *
 * Применяет: mergeInto (влить дубль), splits (разделить ВЗ/НЗ Иерихон),
 * типизацию (OpenBible types → enum схемы, поверх — typeOverrides),
 * parentOverrides, снятие needsReview по правилу autoConfirmRule + confirmedMerges.
 *
 * Конвейер: extract → enrich → promote. Повторный запуск полностью пересоздаёт
 * каталог places/ (генерируемые данные; ручные правки делать в review-decisions).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRAFT = path.join(ROOT, 'data', 'atlas', 'places-draft.json');
const REVIEW = path.join(ROOT, 'data', 'atlas', 'review-decisions.json');
const OUT_DIR = path.join(ROOT, 'data', 'atlas', 'places');
const CACHE = path.join(ROOT, '.cache', 'openbible');

// OpenBible types → enum place.schema.json
const TYPE_MAP = {
  'settlement': 'city',
  'region': 'region',
  'mountain': 'mountain',
  'hill': 'mountain',
  'mountain range': 'mountain',
  'river': 'river',
  'wadi': 'river',
  'body of water': 'sea',
  'pool': 'spring',
  'spring': 'spring',
  'well': 'spring',
  'valley': 'valley',
  'campsite': 'camp',
  'island': 'island',
  'road': 'road',
  'garden': 'garden',
  'structure': 'structure',
  'gate': 'structure',
  'natural area': 'region',
  'desert': 'desert',
};

function loadJsonl(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function scoreToStatus(score) {
  if (score < 0) return 'rejected';
  if (score >= 900) return 'consensus';
  if (score >= 500) return 'primary';
  if (score >= 250) return 'candidate';
  if (score >= 100) return 'alternative';
  return 'minor';
}

function parseLonlat(s) {
  if (!s) return null;
  const [lng, lat] = String(s).split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function enrichFromOpenBible(entry, slug, ancBySlug, modById) {
  const a = ancBySlug.get(slug);
  if (!a) return;
  entry.sameAs = entry.sameAs || {};
  entry.sameAs.openbible = slug;
  for (const v of Object.values(a.linked_data || {})) {
    if (v && typeof v.id === 'string' && /^Q\d+$/.test(v.id)) { entry.sameAs.wikidata = v.id; break; }
  }
  const idents = [];
  for (const [mid, assoc] of Object.entries(a.modern_associations || {})) {
    const m = modById.get(mid);
    const ll = m ? parseLonlat(m.lonlat) : null;
    idents.push({
      status: scoreToStatus(assoc.score || 0),
      label: assoc.name || mid,
      ...(ll || {}),
      score: assoc.score || 0,
      sources: [{ ref: `OpenBible.info geo: ${slug} → ${assoc.url_slug || mid}`, level: 'B' }],
    });
  }
  idents.sort((x, y) => (y.score || 0) - (x.score || 0));
  if (idents.length) {
    entry.identifications = idents;
    const best = idents[0];
    if (Number.isFinite(best.lat)) entry.geo = { lat: best.lat, lng: best.lng };
  }
  const refs = (a.verses || []).slice(0, 5).map((v) => v.readable).filter(Boolean);
  if (refs.length) entry.bibleRefs = refs;
}

function deriveType(entry, ancBySlug, overrides) {
  if (overrides[entry.id]) return overrides[entry.id];
  const slug = entry.sameAs && entry.sameAs.openbible;
  const a = slug ? ancBySlug.get(slug) : null;
  if (a) {
    for (const t of a.types || []) {
      if (TYPE_MAP[t]) return TYPE_MAP[t];
    }
  }
  return entry.type && entry.type !== 'other' ? entry.type : 'other';
}

function main() {
  const draft = JSON.parse(fs.readFileSync(DRAFT, 'utf8'));
  const review = JSON.parse(fs.readFileSync(REVIEW, 'utf8'));
  const mapping = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'atlas', 'openbible-mapping.json'), 'utf8'));
  const ancient = loadJsonl(path.join(CACHE, 'ancient.jsonl'));
  const modern = loadJsonl(path.join(CACHE, 'modern.jsonl'));
  const ancBySlug = new Map(ancient.map((a) => [a.url_slug, a]));
  const modById = new Map(modern.map((m) => [m.id, m]));

  let places = draft.places.map((p) => JSON.parse(JSON.stringify(p)));
  const byId = new Map(places.map((p) => [p.id, p]));

  // 1. mergeInto: влить дубли.
  for (const [dupId, targetId] of Object.entries(review.mergeInto || {})) {
    const dup = byId.get(dupId);
    const target = byId.get(targetId);
    if (!dup || !target) { console.error(`❌ mergeInto: ${dupId} → ${targetId} — запись не найдена`); process.exit(1); }
    target.maps.push(...dup.maps);
    if (dup.names && dup.names.ru && target.names) {
      target.names.variants = [...new Set([...(target.names.variants || []), dup.names.ru])];
    }
    byId.delete(dupId);
    places = places.filter((p) => p.id !== dupId);
  }

  // 2. splits.
  for (const sp of review.splits || []) {
    const src = byId.get(sp.from);
    if (!src) { console.error(`❌ split: "${sp.from}" не найден`); process.exit(1); }
    const moveKeys = new Set(sp.moveMaps.map((m) => `${m.slug}:${m.localId}`));
    const moved = src.maps.filter((m) => moveKeys.has(`${m.slug}:${m.localId}`));
    if (moved.length !== sp.moveMaps.length) { console.error(`❌ split "${sp.from}": не все вхождения найдены`); process.exit(1); }
    src.maps = src.maps.filter((m) => !moveKeys.has(`${m.slug}:${m.localId}`));
    const fresh = {
      id: sp.newId,
      names: { ru: sp.nameRu },
      type: src.type,
      placements: JSON.parse(JSON.stringify(src.placements)),
      maps: moved,
      notes: sp.note,
      needsReview: false,
    };
    enrichFromOpenBible(fresh, sp.sameAsOpenbible, ancBySlug, modById);
    if (sp.note) src.notes = [src.notes, `split: ${sp.newId} — ${sp.note}`].filter(Boolean).join(' | ');
    places.push(fresh);
    byId.set(sp.newId, fresh);
  }

  // 3. Типизация, parent, needsReview, чистка служебных полей.
  const confirmed = new Set(Object.keys(review.confirmedMerges || {}));
  const stats = { total: 0, reviewed: 0, byType: {} };
  for (const p of places) {
    p.type = deriveType(p, ancBySlug, review.typeOverrides || {});
    if ((review.parentOverrides || {})[p.id]) p.parentId = review.parentOverrides[p.id];

    const singleMap = p.maps.length === 1;
    const autoMatched = p.sameAs && p.sameAs.openbible === p.id;
    if (confirmed.has(p.id) || (singleMap && autoMatched)) p.needsReview = false;

    // curatedConfirm: выверенные по стихам curated-мэппинги (KA-2b) с одной картой
    // и заполненным geo — reviewed, кроме содержательных исключений.
    const cc = review.curatedConfirm || {};
    const isCurated = !!(mapping.overrides && mapping.overrides[p.id]);
    const isException = !!(cc.exceptions && cc.exceptions[p.id]);
    if (isCurated && singleMap && p.geo && !isException) p.needsReview = false;
    if (isException) p.notes = [p.notes, `review-hold: ${cc.exceptions[p.id]}`].filter(Boolean).join(' | ');
    if ((cc.noMatchConfirmedTypes || []).includes(p.id)) {
      p.needsReview = false;
      p.notes = [p.notes, cc.noMatchConfirmedNote].filter(Boolean).join(' | ');
    }
    // dossierConfirmed: needsReview снят готовым GEO-DOSSIER Research, когда решение
    // досье НЕ меняет данные записи (та же точка/статус). Содержательные развилки,
    // где owner может изменить данные, остаются в curatedConfirm.exceptions.
    const dossier = (review.dossierConfirmed || {})[p.id];
    if (typeof dossier === 'string') {
      p.needsReview = false;
      p.notes = [p.notes, `review: досье — ${dossier}`].filter(Boolean).join(' | ');
    }
    if (confirmed.has(p.id)) {
      p.notes = [p.notes, `review: ${review.confirmedMerges[p.id]}`].filter(Boolean).join(' | ');
    }
    delete p._extract;
    stats.total++;
    if (!p.needsReview) stats.reviewed++;
    stats.byType[p.type] = (stats.byType[p.type] || 0) + 1;
  }

  // 3b. Канонические переименования id (латиница по схеме).
  const renames = review.idRenames || {};
  for (const p of places) {
    if (renames[p.id]) p.id = renames[p.id];
    if (p.parentId && renames[p.parentId]) p.parentId = renames[p.parentId];
  }

  // 3b2. Ручные координаты для мест вне OpenBible (review-decisions.manualGeo).
  const mg = review.manualGeo || {};
  for (const p of places) {
    const g = mg[p.id];
    if (g && !p.geo) {
      p.geo = { lat: g.lat, lng: g.lng };
      if (g.note) p.notes = [p.notes, `geo: ${g.note} (manualGeo, уровень B)`].filter(Boolean).join(' | ');
    }
  }

  // 3c. Висячие parentId (экстрактор предлагал родителя, которого нет как записи) —
  // убрать, кандидата сохранить в notes.
  const allIds = new Set(places.map((p) => p.id));
  for (const p of places) {
    if (p.parentId && !allIds.has(p.parentId)) {
      p.notes = [p.notes, `parent-candidate: ${p.parentId} (записи нет — место самостоятельное)`].filter(Boolean).join(' | ');
      delete p.parentId;
    }
  }

  // 4. Валидация ссылочной целостности вхождений (ни одно не потеряно, нет дублей).
  const seen = new Set();
  for (const p of places) for (const m of p.maps) {
    const k = `${m.slug}:${m.localId}`;
    if (seen.has(k)) { console.error(`❌ promote: вхождение ${k} у двух мест`); process.exit(1); }
    seen.add(k);
  }
  if (seen.size !== draft.stats.occurrences) {
    console.error(`❌ promote: вхождений ${seen.size}, в draft было ${draft.stats.occurrences}`);
    process.exit(1);
  }

  // 5. Запись каталога.
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  places.sort((a, b) => a.id.localeCompare(b.id));
  for (const p of places) {
    fs.writeFileSync(path.join(OUT_DIR, p.id + '.json'), JSON.stringify(p, null, 2) + '\n');
  }
  const index = {
    $comment: 'Генерируется atlas-promote-places.js — не править руками. Атрибуция: identifications/geo частично из OpenBible.info Bible Geocoding Data (CC BY 4.0, snapshot 2021-11).',
    count: places.length,
    reviewed: stats.reviewed,
    needsReview: stats.total - stats.reviewed,
    byType: stats.byType,
    ids: places.map((p) => p.id),
  };
  fs.writeFileSync(path.join(OUT_DIR, '_index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`[atlas-promote] мест: ${places.length} (reviewed: ${stats.reviewed}, needsReview: ${stats.total - stats.reviewed})`);
  console.log('  типы:', JSON.stringify(stats.byType));
}

main();
