#!/usr/bin/env node
/**
 * atlas-label-audit.js — количественный аудит коллизий подписей карт (KA-3 prep, гейт G2).
 *
 * Чип хаба «label collision» до сих пор проверялся глазами. Этот скрипт даёт числа:
 * он ВОСПРОИЗВОДИТ фактическую модель размещения подписей движка v0.52
 * (map-engine.js, renderMarkers, ~строки 1550–1585):
 *   - шрифт 10 SVG-единиц; ширина ≈ len(name)*6 + 6; высота 14;
 *   - смещение от маркера x=±14 по side ('r' по умолчанию, 'l' из place.side);
 *   - встроенная мини-коллизия движка: если сосед ближе |dx|<100, |dy|<16 на той же
 *     стороне — подпись сдвигается на 12 вниз (воспроизведено);
 * и считает пересечения прямоугольников подпись↔подпись и подпись↔чужой маркер (r=8).
 *
 * Подписи заданы в SVG-координатах и масштабируются ВМЕСТЕ с картой, поэтому один
 * расчёт описывает все зумы (семантического LOD в движке пока нет — это и есть KA-3).
 *
 * Выход: reports/atlas-label-audit.md (локальный) + сводка в stdout.
 * Режим --gate: exit 1, если у карты есть пересечения (для будущего atlas:gate).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KARTY = path.join(ROOT, 'karty');
const OUT_MD = path.join(ROOT, 'reports', 'atlas-label-audit.md');
const GATE = process.argv.includes('--gate');

const FONT = 10, PAD_H = 6, H = 14, MARKER_R = 8;

// Модель v2 (движок v0.53, §11 P-8): 8 якорей labelAnchor + выноска leader{dx,dy};
// legacy side 'l'→'w', 'r'/умолчание→'e'; авто-сдвиг только у legacy-мест.
const ANCHOR_POS = {
  e:  { x: 14,  y: 4,   ta: 'start'  }, w:  { x: -14, y: 4,   ta: 'end'    },
  n:  { x: 0,   y: -12, ta: 'middle' }, s:  { x: 0,   y: 20,  ta: 'middle' },
  ne: { x: 10,  y: -8,  ta: 'start'  }, nw: { x: -10, y: -8,  ta: 'end'    },
  se: { x: 10,  y: 16,  ta: 'start'  }, sw: { x: -10, y: 16,  ta: 'end'    },
};

function labelBox(place, all) {
  const side = place.side || 'r';
  const ap = ANCHOR_POS[place.labelAnchor || (side === 'l' ? 'w' : 'e')] || ANCHOR_POS.e;
  let lx = place.x + ap.x, ly = place.y + ap.y;
  let shifted = false;
  if (!place.labelAnchor) {
    const nearby = all.filter((op) =>
      op.id !== place.id && !op.labelAnchor &&
      Math.abs(op.x - place.x) < 100 &&
      Math.abs(op.y - place.y) < 16 &&
      (op.side || 'r') === side
    );
    if (nearby.length > 0) { ly += 12; shifted = true; }
  }
  if (place.leader && typeof place.leader.dx === 'number') {
    lx += place.leader.dx; ly += place.leader.dy;
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

function auditMap(slug) {
  const route = JSON.parse(fs.readFileSync(path.join(KARTY, slug, 'route.json'), 'utf8'));
  const places = route.places || [];
  const boxes = places.map((p) => labelBox(p, places));
  const pairs = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlap(boxes[i], boxes[j])) {
        pairs.push({ a: boxes[i].id, b: boxes[j].id, area: Math.round(overlapArea(boxes[i], boxes[j])) });
      }
    }
  }
  // Подпись поверх ЧУЖОГО маркера.
  const markerHits = [];
  for (const b of boxes) {
    for (const p of places) {
      if (p.id === b.id) continue;
      const mx = { x: p.x - MARKER_R, y: p.y - MARKER_R, w: MARKER_R * 2, h: MARKER_R * 2 };
      if (overlap(b, mx)) markerHits.push({ label: b.id, marker: p.id });
    }
  }
  pairs.sort((x, y) => y.area - x.area);
  return { slug, places: places.length, shifted: boxes.filter((b) => b.shifted).length, pairs, markerHits };
}

function main() {
  const slugs = fs.readdirSync(KARTY).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(KARTY, d, 'route.json'))).sort();
  const results = slugs.map(auditMap);
  const lines = [];
  lines.push('# Atlas label audit — коллизии подписей по модели движка v0.52 (KA-3 prep, гейт G2)');
  lines.push('');
  lines.push('Источник: `node scripts/atlas-label-audit.js`. Модель размещения воспроизведена из map-engine.js renderMarkers.');
  lines.push('');
  lines.push('| Карта | Мест | Сдвигов движка | Пересечений подпись↔подпись | Подпись↔чужой маркер |');
  lines.push('|---|---|---|---|---|');
  let total = 0;
  for (const r of results) {
    total += r.pairs.length;
    lines.push(`| ${r.slug} | ${r.places} | ${r.shifted} | **${r.pairs.length}** | ${r.markerHits.length} |`);
  }
  lines.push('');
  lines.push('## Конфликтные пары (по убыванию площади пересечения, SVG-ед.²)');
  lines.push('');
  for (const r of results) {
    if (!r.pairs.length && !r.markerHits.length) continue;
    lines.push(`### ${r.slug}`);
    for (const p of r.pairs) lines.push(`- \`${p.a}\` ⟂ \`${p.b}\` (площадь ${p.area})`);
    for (const m of r.markerHits) lines.push(`- подпись \`${m.label}\` накрывает маркер \`${m.marker}\``);
    lines.push('');
  }
  lines.push('## Как чинится (KA-3)');
  lines.push('');
  lines.push('1. Быстрые ручные фиксы: поле `side: "l"` у одного из пары (движок уже умеет) — для пар с большой площадью.');
  lines.push('2. Системно: build-time label pipeline (кандидатные позиции + жадное размещение + приоритеты) по аудит-плану §5.3; этот скрипт становится гейтом `--gate` после его внедрения.');
  lines.push('3. Известный баг движка для системного лейна: при коллизионном сдвиге подписи фоновая плашка НЕ сдвигается (labelBg y=-7 затирает offset, map-engine.js ~1565) — текст и фон расходятся на 12px.');
  lines.push('');
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, lines.join('\n'));
  console.log(`[atlas-label-audit] карт: ${results.length}; всего пересечений подписей: ${total}`);
  for (const r of results) {
    const mark = r.pairs.length ? '⚠️ ' : '✅ ';
    console.log(`  ${mark}${r.slug}: ${r.pairs.length} пересечений, ${r.markerHits.length} наездов на маркеры${r.shifted ? ` (движок сдвинул ${r.shifted})` : ''}`);
    if (process.argv.includes('--pairs')) {
      for (const pr of r.pairs) console.log(`       ✂ ${pr.a} × ${pr.b} (area ${pr.area})`);
      for (const mh of r.markerHits) console.log(`       ⊙ «${mh.label}» наезжает на маркер «${mh.marker}»`);
    }
  }
  if (GATE && total > 0) process.exit(1);
}

main();
