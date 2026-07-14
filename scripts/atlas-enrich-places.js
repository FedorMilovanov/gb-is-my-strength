#!/usr/bin/env node
/**
 * atlas-enrich-places.js — обогащение draft-реестра мест данными OpenBible (KA-2b).
 *
 * Вход:
 *   data/atlas/places-draft.json      — черновой реестр (atlas-extract-places.js)
 *   data/atlas/openbible-mapping.json — курируемый мэппинг id → url_slug (+noMatch)
 *   .cache/openbible/{ancient,modern}.jsonl — снапшот OpenBible Bible Geocoding Data
 *     (github.com/openbibleinfo/Bible-Geocoding-Data, CC BY 4.0, snapshot 2021-11).
 *     Если кэша нет — скрипт сообщает команду для скачивания (сеть намеренно
 *     не используется автоматически: build должен быть детерминирован).
 *
 * Что добавляет каждому заматченному месту:
 *   geo{lat,lng}          — координата лучшей современной идентификации (max score)
 *   identifications[]     — ВСЕ кандидаты OpenBible со статусами по словарю ATLAS-CONTRACT §3
 *                           (score→status: ≥900 consensus, ≥500 primary, ≥250 candidate,
 *                            ≥100 alternative, <100 minor) + accuracyMeters из precision
 *   sameAs.openbible      — url_slug; sameAs.wikidata — Q-id из linked_data (если есть)
 *   bibleRefs             — до 5 ключевых ссылок Писания
 *
 * Никакие route.json и рантайм не затрагиваются. Все записи остаются needsReview.
 * Выход: data/atlas/places-draft.json (in place) + reports/atlas-enrich.md (локальный).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRAFT = path.join(ROOT, 'data', 'atlas', 'places-draft.json');
const MAPPING = path.join(ROOT, 'data', 'atlas', 'openbible-mapping.json');
const CACHE = path.join(ROOT, '.cache', 'openbible');
const OUT_MD = path.join(ROOT, 'reports', 'atlas-enrich.md');

const OPENBIBLE_RAW = 'https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data';

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

function precisionToMeters(precision) {
  // OpenBible precision.type → грубая оценка точности в метрах.
  const t = precision && precision.type;
  const map = { exact: 100, close: 1000, terrain: 5000, region: 25000, unlocated: null };
  return t && Object.prototype.hasOwnProperty.call(map, t) ? map[t] : null;
}

function extractWikidata(linked) {
  for (const v of Object.values(linked || {})) {
    if (v && typeof v.id === 'string' && /^Q\d+$/.test(v.id)) return v.id;
  }
  return null;
}

function parseLonlat(s) {
  if (!s) return null;
  const [lng, lat] = String(s).split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function main() {
  for (const f of ['ancient.jsonl', 'modern.jsonl']) {
    if (!fs.existsSync(path.join(CACHE, f))) {
      console.error(`[atlas-enrich] нет кэша ${path.join('.cache/openbible', f)}.`);
      console.error(`Скачай снапшот:\n  mkdir -p .cache/openbible && curl -sSL -o .cache/openbible/${f} ${OPENBIBLE_RAW}/${f}`);
      process.exit(1);
    }
  }

  const ancient = loadJsonl(path.join(CACHE, 'ancient.jsonl'));
  const modern = loadJsonl(path.join(CACHE, 'modern.jsonl'));
  const ancBySlug = new Map(ancient.map((a) => [a.url_slug, a]));
  const modById = new Map(modern.map((m) => [m.id, m]));

  const mapping = JSON.parse(fs.readFileSync(MAPPING, 'utf8'));
  const draft = JSON.parse(fs.readFileSync(DRAFT, 'utf8'));

  // Валидация мэппинга: каждый override указывает на существующий slug и существующее место draft.
  const draftIds = new Set(draft.places.map((p) => p.id));
  let fail = false;
  for (const [pid, slug] of Object.entries(mapping.overrides)) {
    if (!draftIds.has(pid)) { console.error(`❌ mapping: "${pid}" нет в draft-реестре`); fail = true; }
    if (!ancBySlug.has(slug)) { console.error(`❌ mapping: slug "${slug}" (для "${pid}") нет в OpenBible`); fail = true; }
  }
  for (const pid of Object.keys(mapping.noMatch)) {
    if (!draftIds.has(pid)) { console.error(`❌ mapping.noMatch: "${pid}" нет в draft-реестре`); fail = true; }
  }
  if (fail) process.exit(1);

  const stats = { auto: 0, curated: 0, noMatch: 0, unmapped: [], enriched: 0, withWikidata: 0 };
  for (const p of draft.places) {
    let slug = null;
    let how = null;
    if (mapping.overrides[p.id]) { slug = mapping.overrides[p.id]; how = 'curated'; }
    else if (mapping.noMatch[p.id]) { how = 'noMatch'; }
    else if (ancBySlug.has(p.id)) { slug = p.id; how = 'auto'; }

    if (how === 'auto') stats.auto++;
    else if (how === 'curated') stats.curated++;
    else if (how === 'noMatch') { stats.noMatch++; p.notes = [p.notes, `no-match: ${mapping.noMatch[p.id]}`].filter(Boolean).join(' | '); continue; }
    else { stats.unmapped.push(p.id); continue; }

    const a = ancBySlug.get(slug);

    // sameAs
    p.sameAs = p.sameAs || {};
    p.sameAs.openbible = slug;
    const q = extractWikidata(a.linked_data);
    if (q) { p.sameAs.wikidata = q; stats.withWikidata++; }

    // identifications из modern_associations
    const idents = [];
    for (const [mid, assoc] of Object.entries(a.modern_associations || {})) {
      const m = modById.get(mid);
      const ll = m ? parseLonlat(m.lonlat) : null;
      idents.push({
        status: scoreToStatus(assoc.score || 0),
        label: assoc.name || (m && m.friendly_id) || mid,
        ...(ll || {}),
        ...(m && precisionToMeters(m.precision) ? { accuracyMeters: precisionToMeters(m.precision) } : {}),
        score: assoc.score || 0,
        sources: [{ ref: `OpenBible.info geo: ${slug} → ${assoc.url_slug || mid}`, level: 'B' }],
      });
    }
    idents.sort((x, y) => (y.score || 0) - (x.score || 0));
    if (idents.length) {
      p.identifications = idents;
      const best = idents[0];
      if (Number.isFinite(best.lat) && Number.isFinite(best.lng)) {
        p.geo = { lat: best.lat, lng: best.lng, ...(best.accuracyMeters ? { accuracyMeters: best.accuracyMeters } : {}) };
      }
      stats.enriched++;
    }

    // bibleRefs — до 5 ключевых ссылок
    const refs = (a.verses || []).slice(0, 5).map((v) => v.readable).filter(Boolean);
    if (refs.length && !p.bibleRefs) p.bibleRefs = refs;
  }

  draft.$comment = draft.$comment.replace(/\.$/, '') +
    '. Обогащено atlas-enrich-places.js из OpenBible Bible Geocoding Data (CC BY 4.0, snapshot 2021-11) — атрибуция обязательна: openbible.info.';
  draft.attribution = 'Place identifications, confidence scores and coordinates partially derived from OpenBible.info Bible Geocoding Data (https://github.com/openbibleinfo/Bible-Geocoding-Data), CC BY 4.0, snapshot 2021-11.';
  draft.stats.enrichment = {
    matchedAuto: stats.auto,
    matchedCurated: stats.curated,
    noMatchDocumented: stats.noMatch,
    unmapped: stats.unmapped.length,
    withGeo: stats.enriched,
    withWikidata: stats.withWikidata,
  };

  fs.writeFileSync(DRAFT, JSON.stringify(draft, null, 2) + '\n');

  const lines = [];
  lines.push('# Atlas enrich — обогащение реестра из OpenBible (KA-2b)');
  lines.push('');
  lines.push(`| метрика | значение |`);
  lines.push(`|---|---|`);
  lines.push(`| авто-мэппинг (id == url_slug) | ${stats.auto} |`);
  lines.push(`| курируемый мэппинг | ${stats.curated} |`);
  lines.push(`| документированный no-match | ${stats.noMatch} |`);
  lines.push(`| БЕЗ мэппинга (требует решения!) | ${stats.unmapped.length} |`);
  lines.push(`| мест с координатами (geo) | ${stats.enriched} |`);
  lines.push(`| мест с Wikidata Q-id | ${stats.withWikidata} |`);
  lines.push('');
  if (stats.unmapped.length) {
    lines.push('## Без мэппинга (добавить в openbible-mapping.json overrides или noMatch):');
    for (const id of stats.unmapped) lines.push(`- ${id}`);
    lines.push('');
  }
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, lines.join('\n') + '\n');

  console.log(`[atlas-enrich] auto=${stats.auto} curated=${stats.curated} noMatch=${stats.noMatch} unmapped=${stats.unmapped.length} withGeo=${stats.enriched} wikidata=${stats.withWikidata}`);
  if (stats.unmapped.length) {
    console.error('❌ есть места без мэппинга — дополни data/atlas/openbible-mapping.json:');
    for (const id of stats.unmapped) console.error('   - ' + id);
    process.exit(1);
  }
  console.log('✅ все места реестра либо обогащены, либо документированно no-match');
}

main();
