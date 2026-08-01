#!/usr/bin/env node
/**
 * atlas-label-audit.js — количественный аудит геометрических коллизий карт.
 *
 * Модель воспроизводит фактическое размещение map-engine.js:
 *   - подпись: font-size 10, ширина ≈ len(name)*6 + 6, высота 14;
 *   - 8 labelAnchor-позиций + leader{dx,dy};
 *   - legacy side и встроенный auto-shift;
 *   - визуальный радиус маркера 8 SVG-единиц;
 *   - канонический canvas MapEngine 1900×1430, если route не объявляет размеры.
 *
 * Проверки:
 *   1. подпись ↔ подпись;
 *   2. подпись ↔ чужой маркер;
 *   3. маркер ↔ маркер;
 *   4. clipping подписи за canvas;
 *   5. вход подписи в 24-unit edge safe area.
 *
 * Выход: reports/atlas-label-audit.md + сводка stdout.
 * Режим --gate: exit 1 при любой геометрической коллизии.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KARTY = path.join(ROOT, 'karty');
const OUT_MD = path.join(ROOT, 'reports', 'atlas-label-audit.md');
const GATE = process.argv.includes('--gate');

const FONT = 10;
const PAD_H = 6;
const H = 14;
const MARKER_R = 8;
const DEFAULT_W = 1900;
const DEFAULT_H = 1430;
const SAFE_INSET = 24;

// Модель v2 (движок v0.53, §11 P-8): 8 якорей labelAnchor + выноска leader{dx,dy};
// legacy side 'l'→'w', 'r'/умолчание→'e'; авто-сдвиг только у legacy-мест.
const ANCHOR_POS = {
  e:  { x: 14,  y: 4,   ta: 'start'  }, w:  { x: -14, y: 4,   ta: 'end'    },
  n:  { x: 0,   y: -12, ta: 'middle' }, s:  { x: 0,   y: 20,  ta: 'middle' },
  ne: { x: 10,  y: -8,  ta: 'start'  }, nw: { x: -10, y: -8,  ta: 'end'    },
  se: { x: 10,  y: 16,  ta: 'start'  }, sw: { x: -10, y: 16,  ta: 'end'    },
};

function finitePositive(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function mapBounds(route) {
  const canvas = route.meta?.canvas || {};
  return {
    x: 0,
    y: 0,
    w: finitePositive(canvas.w ?? route.meta?.canvas_width ?? route.meta?.width, DEFAULT_W),
    h: finitePositive(canvas.h ?? route.meta?.canvas_height ?? route.meta?.height, DEFAULT_H),
  };
}

function labelBox(place, all) {
  const side = place.side || 'r';
  const ap = ANCHOR_POS[place.labelAnchor || (side === 'l' ? 'w' : 'e')] || ANCHOR_POS.e;
  let lx = place.x + ap.x;
  let ly = place.y + ap.y;
  let shifted = false;
  if (!place.labelAnchor) {
    const nearby = all.filter((op) =>
      op.id !== place.id && !op.labelAnchor &&
      Math.abs(op.x - place.x) < 100 &&
      Math.abs(op.y - place.y) < 16 &&
      (op.side || 'r') === side
    );
    if (nearby.length > 0) {
      ly += 12;
      shifted = true;
    }
  }
  if (place.leader && typeof place.leader.dx === 'number') {
    lx += place.leader.dx;
    ly += typeof place.leader.dy === 'number' ? place.leader.dy : 0;
  }
  const w = String(place.name || '').length * FONT * 0.6 + PAD_H;
  const x = ap.ta === 'end' ? lx - w + 3 : ap.ta === 'middle' ? lx - w / 2 : lx - 3;
  return { id: place.id, name: place.name, x, y: ly - 11, w, h: H, shifted };
}

function overlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return Math.max(0, w) * Math.max(0, h);
}

function outside(box, bounds) {
  return box.x < bounds.x || box.y < bounds.y || box.x + box.w > bounds.x + bounds.w || box.y + box.h > bounds.y + bounds.h;
}

function touchesEdgeSafeArea(box, bounds) {
  const safe = {
    x: bounds.x + SAFE_INSET,
    y: bounds.y + SAFE_INSET,
    w: Math.max(0, bounds.w - SAFE_INSET * 2),
    h: Math.max(0, bounds.h - SAFE_INSET * 2),
  };
  return outside(box, safe);
}

function markerPair(a, b) {
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < MARKER_R * 2 ? { a: a.id, b: b.id, distance: Math.round(distance * 10) / 10 } : null;
}

function auditGeometry(route, slug = 'fixture') {
  const places = route.places || [];
  const bounds = mapBounds(route);
  const boxes = places.map((p) => labelBox(p, places));
  const pairs = [];
  const markerPairs = [];

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (overlap(boxes[i], boxes[j])) {
        pairs.push({ a: boxes[i].id, b: boxes[j].id, area: Math.round(overlapArea(boxes[i], boxes[j])) });
      }
      const hit = markerPair(places[i], places[j]);
      if (hit) markerPairs.push(hit);
    }
  }

  const markerHits = [];
  for (const box of boxes) {
    for (const place of places) {
      if (place.id === box.id) continue;
      const marker = { x: place.x - MARKER_R, y: place.y - MARKER_R, w: MARKER_R * 2, h: MARKER_R * 2 };
      if (overlap(box, marker)) markerHits.push({ label: box.id, marker: place.id });
    }
  }

  const clippedLabels = boxes.filter((box) => outside(box, bounds)).map((box) => box.id);
  const safeAreaHits = boxes.filter((box) => !outside(box, bounds) && touchesEdgeSafeArea(box, bounds)).map((box) => box.id);
  pairs.sort((a, b) => b.area - a.area);
  markerPairs.sort((a, b) => a.distance - b.distance);

  const issueCount = pairs.length + markerHits.length + markerPairs.length + clippedLabels.length + safeAreaHits.length;
  return {
    slug,
    places: places.length,
    shifted: boxes.filter((box) => box.shifted).length,
    bounds,
    pairs,
    markerHits,
    markerPairs,
    clippedLabels,
    safeAreaHits,
    issueCount,
  };
}

function assertAuditContract() {
  const fixture = {
    meta: { canvas: { w: 200, h: 120 } },
    places: [
      { id: 'same-a', name: 'А', x: 80, y: 60, side: 'r' },
      { id: 'same-b', name: 'Б', x: 80, y: 60, side: 'l' },
      { id: 'clipped', name: 'Длинная подпись', x: 2, y: 8, side: 'l' },
      { id: 'safe-edge', name: 'Край', x: 185, y: 100, side: 'l' },
    ],
  };
  const report = auditGeometry(fixture);
  if (!report.markerPairs.some((pair) => pair.a === 'same-a' && pair.b === 'same-b' && pair.distance === 0)) {
    throw new Error('atlas-label-audit contract: exact marker overlap was not detected');
  }
  if (!report.clippedLabels.includes('clipped')) {
    throw new Error('atlas-label-audit contract: clipped label was not detected');
  }
  if (!report.safeAreaHits.includes('safe-edge')) {
    throw new Error('atlas-label-audit contract: edge safe-area intrusion was not detected');
  }
}

function auditMap(slug) {
  const route = JSON.parse(fs.readFileSync(path.join(KARTY, slug, 'route.json'), 'utf8'));
  return auditGeometry(route, slug);
}

function main() {
  assertAuditContract();
  const slugs = fs.readdirSync(KARTY)
    .filter((dir) => !dir.startsWith('_') && fs.existsSync(path.join(KARTY, dir, 'route.json')))
    .sort();
  const results = slugs.map(auditMap);
  const lines = [];
  lines.push('# Atlas geometry audit — labels, markers, clipping and safe area');
  lines.push('');
  lines.push('Источник: `node scripts/atlas-label-audit.js`. Модель воспроизведена из `karty/_engine/map-engine.js`.');
  lines.push('');
  lines.push('| Карта | Мест | Auto-shift | Label↔label | Label↔marker | Marker↔marker | Clipped | Edge safe-area |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  let total = 0;
  for (const result of results) {
    total += result.issueCount;
    lines.push(`| ${result.slug} | ${result.places} | ${result.shifted} | **${result.pairs.length}** | ${result.markerHits.length} | **${result.markerPairs.length}** | **${result.clippedLabels.length}** | ${result.safeAreaHits.length} |`);
  }
  lines.push('');
  lines.push('## Конфликты');
  lines.push('');
  for (const result of results) {
    if (!result.issueCount) continue;
    lines.push(`### ${result.slug}`);
    for (const pair of result.pairs) lines.push(`- подписи \`${pair.a}\` ⟂ \`${pair.b}\` (площадь ${pair.area})`);
    for (const hit of result.markerHits) lines.push(`- подпись \`${hit.label}\` накрывает маркер \`${hit.marker}\``);
    for (const pair of result.markerPairs) lines.push(`- маркеры \`${pair.a}\` ⟂ \`${pair.b}\` (расстояние ${pair.distance})`);
    for (const id of result.clippedLabels) lines.push(`- подпись \`${id}\` выходит за canvas ${result.bounds.w}×${result.bounds.h}`);
    for (const id of result.safeAreaHits) lines.push(`- подпись \`${id}\` входит в edge safe-area ${SAFE_INSET}`);
    lines.push('');
  }
  lines.push('## Repair policy');
  lines.push('');
  lines.push('1. Ручная геометрия исправляется в canonical `route.json` через `labelAnchor` и `leader`, не через runtime random shift.');
  lines.push('2. Exact marker overlaps должны получать разные координаты или явный cluster/stack primitive.');
  lines.push('3. `--gate` блокирует новые и оставшиеся label/marker/clipping/safe-area коллизии; обычный режим остаётся диагностическим отчётом.');
  lines.push('');

  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, lines.join('\n'));
  console.log(`[atlas-label-audit] карт: ${results.length}; геометрических дефектов: ${total}`);
  for (const result of results) {
    const mark = result.issueCount ? '⚠️ ' : '✅ ';
    console.log(
      `  ${mark}${result.slug}: labels=${result.pairs.length}, label→marker=${result.markerHits.length}, ` +
      `marker↔marker=${result.markerPairs.length}, clipped=${result.clippedLabels.length}, safe=${result.safeAreaHits.length}`
    );
    if (process.argv.includes('--pairs')) {
      for (const pair of result.pairs) console.log(`       ✂ ${pair.a} × ${pair.b} (area ${pair.area})`);
      for (const hit of result.markerHits) console.log(`       ⊙ «${hit.label}» наезжает на «${hit.marker}»`);
      for (const pair of result.markerPairs) console.log(`       ◉ ${pair.a} × ${pair.b} (distance ${pair.distance})`);
      for (const id of result.clippedLabels) console.log(`       ⛔ ${id} clipped`);
      for (const id of result.safeAreaHits) console.log(`       ◫ ${id} edge-safe-area`);
    }
  }
  if (GATE && total > 0) process.exit(1);
}

if (require.main === module) main();

module.exports = {
  auditGeometry,
  labelBox,
  mapBounds,
};
