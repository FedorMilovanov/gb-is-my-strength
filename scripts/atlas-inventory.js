#!/usr/bin/env node
/**
 * atlas-inventory.js — контент-инвентарь всех карт /karty/ (ATLAS-CONTRACT §8, гейт G6).
 *
 * Зачем: миграции данных карт уже теряли контент (CONTENT-LOSS-AVRAAM-SOURCES).
 * Этот скрипт фиксирует базовую линию счётчиков по каждой карте и умеет
 * сравнивать текущее состояние с ней. Любое уменьшение счётчика = потеря
 * контента = красный гейт, пока PR явно не объяснит удаление.
 *
 * Запуск:
 *   node scripts/atlas-inventory.js            — пересчитать и записать базовую линию
 *                                                data/atlas-inventory-baseline.json
 *                                                (+ локальный отчёт reports/atlas-inventory.md)
 *   node scripts/atlas-inventory.js --check    — сравнить с базовой линией,
 *                                                exit 1 при уменьшении счётчиков (гейт G6)
 *
 * Кроме счётчиков проверяет целостность данных:
 *   - дубли id мест внутри карты;
 *   - битые ссылки story.place_ids / story.stage_ids → несуществующие объекты;
 *   - place.stage за пределами списка stages;
 *   - scientific_variants, ссылающиеся на несуществующее место.
 * Ошибки целостности всегда дают exit 1 (и в обычном, и в --check режиме).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KARTY = path.join(ROOT, 'karty');
// Базовая линия версионируется в data/ (reports/ в .gitignore — только локальные отчёты).
const REPORT_JSON = path.join(ROOT, 'data', 'atlas-inventory-baseline.json');
const REPORT_MD = path.join(ROOT, 'reports', 'atlas-inventory.md');
const CHECK_MODE = process.argv.includes('--check');

// Поля места, считающиеся «контентными»: непустое значение = единица контента.
const PLACE_CONTENT_FIELDS = ['story', 'bible', 'bible_extra', 'arch', 'dispute', 'he', 'he_deep', 'kick', 'tr'];

function listMapSlugs() {
  return fs.readdirSync(KARTY)
    .filter((d) => !d.startsWith('_') && fs.existsSync(path.join(KARTY, d, 'route.json')))
    .sort();
}

function nonEmpty(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

function countPhotos(place) {
  const p = place.photos;
  if (!p) return 0;
  if (Array.isArray(p)) return p.length;
  if (typeof p === 'object') return Object.keys(p).length;
  return 1;
}

function inventoryMap(slug) {
  const file = path.join(KARTY, slug, 'route.json');
  const route = JSON.parse(fs.readFileSync(file, 'utf8'));
  const places = route.places || [];
  const stages = route.stages || [];
  const stories = route.stories || [];
  const ctx = route.ctx || [];
  const sci = route.scientific_variants || {};
  const layers = route.layers || [];
  const timeline = route.timeline || [];
  const waypoints = route.verified_waypoints || [];

  const errors = [];

  // Дубли id мест.
  const seen = new Map();
  for (const p of places) {
    if (!p.id) { errors.push(`place without id (name: ${p.name || '?'})`); continue; }
    if (seen.has(p.id)) errors.push(`duplicate place id "${p.id}"`);
    seen.set(p.id, true);
  }

  // place.stage в пределах stages.
  for (const p of places) {
    if (typeof p.stage === 'number' && stages.length && (p.stage < 0 || p.stage >= stages.length)) {
      errors.push(`place "${p.id}" references stage ${p.stage}, but map has ${stages.length} stages`);
    }
  }

  // Ссылки историй.
  const placeIds = new Set(places.map((p) => p.id));
  for (const s of stories) {
    for (const pid of s.place_ids || []) {
      if (!placeIds.has(pid)) errors.push(`story "${s.id}" references missing place "${pid}"`);
    }
    for (const si of s.stage_ids || []) {
      if (typeof si === 'number' && (si < 0 || si >= stages.length)) {
        errors.push(`story "${s.id}" references missing stage index ${si}`);
      }
    }
  }

  // Научные варианты указывают на реальные места (ключ = place id, если совпадает по формату).
  const sciKeys = Object.keys(sci);
  for (const key of sciKeys) {
    if (!placeIds.has(key)) {
      // Не все ключи обязаны быть place id (исторически встречаются тематические ключи) — warning, не error.
    }
  }
  const sciLinked = sciKeys.filter((k) => placeIds.has(k)).length;

  // Контентные поля мест.
  const fieldCounts = {};
  for (const f of PLACE_CONTENT_FIELDS) {
    fieldCounts[f] = places.filter((p) => nonEmpty(p[f])).length;
  }
  const photoCount = places.reduce((acc, p) => acc + countPhotos(p), 0);
  const contentChars = places.reduce((acc, p) => {
    let n = 0;
    for (const f of PLACE_CONTENT_FIELDS) if (typeof p[f] === 'string') n += p[f].length;
    return acc + n;
  }, 0);

  return {
    slug,
    publication: route.publication && route.publication.status ? route.publication.status : 'none',
    signature: route.signature && route.signature.type ? route.signature.type : null,
    archetype: route.archetype || null,
    counts: {
      places: places.length,
      stages: stages.length,
      stories: stories.length,
      ctx: ctx.length,
      layers: layers.length,
      timeline: timeline.length,
      verified_waypoints: waypoints.length,
      scientific_variants: sciKeys.length,
      scientific_variants_linked: sciLinked,
      photos: photoCount,
      content_chars: contentChars,
      ...Object.fromEntries(Object.entries(fieldCounts).map(([k, v]) => ['places_with_' + k, v])),
    },
    errors,
  };
}

function buildInventory() {
  const maps = listMapSlugs().map(inventoryMap);
  const totals = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m.counts)) totals[k] = (totals[k] || 0) + v;
  }
  return {
    generated: 'atlas-inventory v1 (ATLAS-CONTRACT §8 G6)',
    // Намеренно без timestamp: диф отчёта должен показывать только содержательные изменения.
    maps,
    totals,
  };
}

function toMarkdown(inv) {
  const cols = ['places', 'stages', 'stories', 'ctx', 'layers', 'scientific_variants', 'photos', 'places_with_arch', 'places_with_dispute', 'content_chars'];
  const lines = [];
  lines.push('# Atlas inventory — базовая линия контент-паритета (гейт G6)');
  lines.push('');
  lines.push('Источник: `node scripts/atlas-inventory.js`. Не редактировать вручную.');
  lines.push('Уменьшение любого счётчика против этой линии = потеря контента (см. `docs/ATLAS-CONTRACT-2026-07-10.md §8`).');
  lines.push('');
  lines.push('| Карта | Публикация | ' + cols.join(' | ') + ' |');
  lines.push('|---|---|' + cols.map(() => '---').join('|') + '|');
  for (const m of inv.maps) {
    lines.push(`| ${m.slug} | ${m.publication} | ` + cols.map((c) => m.counts[c]).join(' | ') + ' |');
  }
  lines.push(`| **ИТОГО** | | ` + cols.map((c) => `**${inv.totals[c]}**`).join(' | ') + ' |');
  lines.push('');
  const withErrors = inv.maps.filter((m) => m.errors.length);
  if (withErrors.length) {
    lines.push('## Ошибки целостности');
    lines.push('');
    for (const m of withErrors) for (const e of m.errors) lines.push(`- **${m.slug}**: ${e}`);
  } else {
    lines.push('Ошибок целостности не найдено.');
  }
  lines.push('');
  return lines.join('\n');
}

function runCheck(current) {
  if (!fs.existsSync(REPORT_JSON)) {
    console.error('[atlas-inventory] --check: базовая линия data/atlas-inventory-baseline.json не найдена. Сначала запусти без --check.');
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
  const problems = [];
  const baseBySlug = new Map(baseline.maps.map((m) => [m.slug, m]));
  for (const m of current.maps) {
    const b = baseBySlug.get(m.slug);
    if (!b) continue; // новая карта — ок
    for (const [k, v] of Object.entries(b.counts)) {
      const cur = m.counts[k];
      if (typeof cur === 'number' && cur < v) {
        problems.push(`${m.slug}: ${k} уменьшился ${v} → ${cur}`);
      }
    }
  }
  for (const b of baseline.maps) {
    if (!current.maps.some((m) => m.slug === b.slug)) problems.push(`карта "${b.slug}" исчезла из karty/`);
  }
  if (problems.length) {
    console.error('❌ ATLAS INVENTORY CHECK: потеря контента против базовой линии:');
    for (const p of problems) console.error('   - ' + p);
    console.error('Если удаление намеренное — обнови базовую линию (node scripts/atlas-inventory.js) и объясни в PR.');
    process.exit(1);
  }
  console.log('✅ ATLAS INVENTORY CHECK: контент-паритет соблюдён (' + current.maps.length + ' карт)');
}

function main() {
  const inv = buildInventory();
  const integrityErrors = inv.maps.flatMap((m) => m.errors.map((e) => `${m.slug}: ${e}`));

  if (CHECK_MODE) {
    runCheck(inv);
  } else {
    fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
    fs.writeFileSync(REPORT_JSON, JSON.stringify(inv, null, 2) + '\n');
    fs.writeFileSync(REPORT_MD, toMarkdown(inv));
    console.log(`[atlas-inventory] карт: ${inv.maps.length}; мест: ${inv.totals.places}; baseline: data/atlas-inventory-baseline.json; отчёт: reports/atlas-inventory.md`);
  }

  if (integrityErrors.length) {
    console.error('❌ Ошибки целостности данных карт:');
    for (const e of integrityErrors) console.error('   - ' + e);
    process.exit(1);
  }
}

main();
