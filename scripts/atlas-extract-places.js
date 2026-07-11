#!/usr/bin/env node
/**
 * atlas-extract-places.js — генератор ЧЕРНОВОГО канонического реестра мест Атласа (KA-2a).
 *
 * Что делает: собирает все места из karty/(x)/route.json и группирует их в канонические
 * сущности (одно историческое место = одна запись), фиксируя кросс-картные коллизии,
 * которые уже начались: «Иерусалим» живёт под 5 локальными id (jerusalem, jerusalem_kings,
 * jerusalem_meet, jerusalem_upper, jerusalem_passion), «Асор» — под 3, «Самария» — под 3.
 *
 * Правила канонизации (консервативные, всё авто-слитое помечается needsReview):
 *   1. Локальный id нормализуется: срезаются картографические суффиксы
 *      (_kings, _conquest, _hasm, _rev, _church, _meet, _philip и т.п.).
 *   2. Группы дополнительно склеиваются по нормализованному русскому имени
 *      (нижний регистр, ё→е, без суффиксов вида « · уточнение»).
 *   3. Суб-локации («Иерусалим · Горница») НЕ сливаются с родителем —
 *      получают parentId-кандидата и needsReview.
 *   4. Ничего не удаляется и не меняется в route.json — только чтение.
 *
 * Выход:
 *   data/atlas/places-draft.json  — черновой реестр (schema: place.schema.json, все needsReview:true)
 *   reports/atlas-places-extract.md — человекочитаемый отчёт (локальный, reports/ в .gitignore)
 *
 * ⚠️ ПОРЯДОК КОНВЕЙЕРА: extract ПЕРЕЗАПИСЫВАЕТ places-draft.json с нуля. После него
 * обязательно повторить обогащение: node scripts/atlas-enrich-places.js (KA-2b).
 *
 * Draft-реестр становится каноническим (data/atlas/places/*.json) только после ручной
 * проверки в волне KA-2: заполнение geo/identifications/sameAs из OpenBible/Pleiades
 * и подтверждение слияний. См. docs/ATLAS-CONTRACT-2026-07-10.md §7.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KARTY = path.join(ROOT, 'karty');
const OUT_JSON = path.join(ROOT, 'data', 'atlas', 'places-draft.json');
const OUT_MD = path.join(ROOT, 'reports', 'atlas-places-extract.md');

// Координатное семейство каждой карты (ATLAS-CONTRACT §6): x/y карты валидны ТОЛЬКО
// в своём семействе. Писать их под чужим ключом — дефект (Рим не живёт в levant-фрейме).
const SPACES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'atlas', 'coordinate-spaces.json'), 'utf8')).spaces;
const MAP_FAMILY = {};
for (const [fam, sp] of Object.entries(SPACES)) for (const slug of sp.maps || []) MAP_FAMILY[slug] = fam;
function familyOf(mapSlug) {
  if (!MAP_FAMILY[mapSlug]) throw new Error(`карта "${mapSlug}" не приписана ни к одному координатному семейству в coordinate-spaces.json`);
  return MAP_FAMILY[mapSlug];
}

// Суффиксы локальных id, добавлявшиеся ради уникальности внутри карты.
const ID_SUFFIXES = /_(kings|conquest|hasm|rev|church|meet|philip|passion|upper|kadesh|exodus|judges|paul|acts)$/;

// Разделитель суб-локации в имени: «Иерусалим · Горница».
const SUB_SEPARATOR = /\s*[·•]\s*/;

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

function baseLocalId(id) {
  return String(id).replace(ID_SUFFIXES, '');
}

function slugifyCanonical(id) {
  return baseLocalId(id).replace(/_/g, '-');
}

function listMapSlugs() {
  return fs.readdirSync(KARTY)
    .filter((d) => !d.startsWith('_') && fs.existsSync(path.join(KARTY, d, 'route.json')))
    .sort();
}

function collectOccurrences() {
  const occ = [];
  for (const slug of listMapSlugs()) {
    const route = JSON.parse(fs.readFileSync(path.join(KARTY, slug, 'route.json'), 'utf8'));
    for (const p of route.places || []) {
      const fullName = String(p.name || '').trim();
      const [mainName, ...subParts] = fullName.split(SUB_SEPARATOR);
      occ.push({
        map: slug,
        localId: p.id,
        name: fullName,
        mainName: mainName.trim(),
        subName: subParts.length ? subParts.join(' · ').trim() : null,
        he: p.he || null,
        type: p.type || null,
        x: p.x, y: p.y,
        stage: p.stage,
        era: p.era || null,
      });
    }
  }
  return occ;
}

function groupOccurrences(occ) {
  // Ключ группы: суб-локации группируются отдельно от родителя.
  const groups = new Map();
  for (const o of occ) {
    const idBase = slugifyCanonical(o.localId);
    const nameKey = normalizeName(o.subName ? `${o.mainName} :: ${o.subName}` : o.mainName);
    // Сначала пытаемся найти группу по нормализованному имени, затем по базе id.
    let key = null;
    for (const [k, g] of groups) {
      if (g.nameKeys.has(nameKey) && nameKey) { key = k; break; }
    }
    if (!key) {
      for (const [k, g] of groups) {
        if (g.idBases.has(idBase) && !o.subName && !g.hasSub) { key = k; break; }
      }
    }
    if (!key) {
      key = `${idBase}${o.subName ? '--' + normalizeName(o.subName).replace(/\s/g, '-') : ''}`;
      groups.set(key, { idBases: new Set(), nameKeys: new Set(), occurrences: [], hasSub: !!o.subName });
    }
    const g = groups.get(key);
    g.idBases.add(idBase);
    if (nameKey) g.nameKeys.add(nameKey);
    g.occurrences.push(o);
  }
  return groups;
}

function pickCanonicalId(key, g) {
  // Наиболее частая база id; при равенстве — кратчайшая (jerusalem, не jerusalem-meet).
  const freq = new Map();
  for (const o of g.occurrences) {
    const b = slugifyCanonical(o.localId);
    freq.set(b, (freq.get(b) || 0) + 1);
  }
  const best = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
  const sub = g.occurrences.find((o) => o.subName);
  return sub && g.occurrences.every((o) => o.subName) ? key : best;
}

function buildDraft(groups) {
  const places = [];
  for (const [key, g] of groups) {
    const occ = g.occurrences;
    const allSub = occ.every((o) => o.subName);
    const canonicalId = pickCanonicalId(key, g);
    const ruNames = [...new Set(occ.map((o) => o.name))];
    const heNames = [...new Set(occ.map((o) => o.he).filter(Boolean))];
    const types = [...new Set(occ.map((o) => o.type).filter(Boolean))];
    const merged = new Set(occ.map((o) => `${o.map}:${o.localId}`));
    const coordVariants = new Set(occ.map((o) => `${familyOf(o.map)}:${o.x},${o.y}`));

    // Размещения ПО СЕМЕЙСТВАМ: первое вхождение внутри семейства задаёт координату,
    // расхождения внутри одного семейства (>12 units) фиксируются для ручной выверки.
    const placements = {};
    const coordConflicts = [];
    for (const o of occ) {
      const fam = familyOf(o.map);
      if (!placements[fam]) placements[fam] = { x: o.x, y: o.y };
      else if (Math.abs(placements[fam].x - o.x) + Math.abs(placements[fam].y - o.y) > 12) {
        coordConflicts.push(`${fam}: ${o.map}:${o.localId} даёт ${o.x},${o.y} против принятых ${placements[fam].x},${placements[fam].y}`);
      }
    }

    const entry = {
      id: canonicalId,
      names: {
        ru: occ[0].mainName + (allSub && occ[0].subName ? ' · ' + occ[0].subName : ''),
        ...(heNames.length ? { he: heNames[0] } : {}),
        ...(ruNames.length > 1 ? { variants: ruNames } : {}),
      },
      // Тип уточняется вручную в KA-2; черновая эвристика по type движка.
      type: 'other',
      ...(allSub ? { parentId: slugifyCanonical(occ[0].localId), notes: 'SUB-LOCATION: проверить parentId' } : {}),
      placements,
      maps: occ.map((o) => ({ slug: o.map, localId: o.localId })),
      needsReview: true,
    };
    entry._extract = {
      mergedFrom: [...merged],
      engineTypes: types,
      coordVariants: coordVariants.size,
      heVariants: heNames.length,
      crossMap: new Set(occ.map((o) => o.map)).size > 1,
      ...(coordConflicts.length ? { coordConflicts } : {}),
    };
    places.push(entry);
  }
  places.sort((a, b) => a.id.localeCompare(b.id));
  return places;
}

function toMarkdown(places, occCount) {
  const lines = [];
  const cross = places.filter((p) => p._extract.crossMap);
  lines.push('# Atlas places extract — черновая канонизация мест (KA-2a)');
  lines.push('');
  lines.push(`Источник: \`node scripts/atlas-extract-places.js\`. Вход: ${occCount} вхождений мест в 10 картах.`);
  lines.push(`Выход: **${places.length} канонических кандидатов**, из них **${cross.length} кросс-картных** (живут в 2+ картах).`);
  lines.push('');
  lines.push('## Кросс-картные сущности (главные кандидаты канонического реестра)');
  lines.push('');
  lines.push('| Канонический id | Имя | Карты и локальные id | Коорд. вариантов | Замечания |');
  lines.push('|---|---|---|---|---|');
  for (const p of cross) {
    const occs = p.maps.map((m) => `${m.slug}:\`${m.localId}\``).join(', ');
    const notes = [];
    if (p._extract.coordVariants > 1) notes.push(`⚠️ ${p._extract.coordVariants} разных x/y — выверить`);
    if (p.parentId) notes.push(`суб-локация (parent: ${p.parentId})`);
    if (p._extract.heVariants > 1) notes.push('иврит-варианты расходятся');
    lines.push(`| \`${p.id}\` | ${p.names.ru} | ${occs} | ${p._extract.coordVariants} | ${notes.join('; ') || '—'} |`);
  }
  lines.push('');
  lines.push('## Что дальше (KA-2)');
  lines.push('');
  lines.push('1. Ручная проверка слияний (все записи `needsReview: true`).');
  lines.push('2. Заполнение `geo` (lat/lng) и `identifications[]` из OpenBible Bible-Geocoding-Data (CC BY 4.0) + `sameAs` (Pleiades/Wikidata/TIPNR).');
  lines.push('3. Разнесение по файлам `data/atlas/places/*.json` + валидация Ajv по `place.schema.json`.');
  lines.push('4. route.json карт получают `placeId`-ссылки (движок — резолвер, обратная совместимость).');
  lines.push('');
  return lines.join('\n');
}

function main() {
  const occ = collectOccurrences();
  const groups = groupOccurrences(occ);
  const places = buildDraft(groups);

  // Валидация: ни одно вхождение не потеряно и не задвоено.
  const seen = new Set();
  for (const p of places) for (const m of p.maps) {
    const k = `${m.slug}:${m.localId}`;
    if (seen.has(k)) { console.error(`❌ extract: вхождение ${k} попало в две группы`); process.exit(1); }
    seen.add(k);
  }
  if (seen.size !== occ.length) {
    console.error(`❌ extract: потеряны вхождения (${seen.size} из ${occ.length})`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  const payload = {
    $comment: 'ЧЕРНОВИК канонического реестра мест (KA-2a). Все записи needsReview. Не подключать к рантайму до ручной проверки. Схема цели: data/atlas/schemas/place.schema.json (поле _extract — служебное, в финальный реестр не переносится).',
    stats: {
      occurrences: occ.length,
      canonical: places.length,
      crossMap: places.filter((p) => p._extract.crossMap).length,
    },
    places,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + '\n');
  fs.writeFileSync(OUT_MD, toMarkdown(places, occ.length));
  console.log(`[atlas-extract-places] вхождений: ${occ.length} → канонических кандидатов: ${places.length} (кросс-картных: ${payload.stats.crossMap})`);
  console.log('  draft:  data/atlas/places-draft.json');
  console.log('  отчёт:  reports/atlas-places-extract.md');
}

main();
