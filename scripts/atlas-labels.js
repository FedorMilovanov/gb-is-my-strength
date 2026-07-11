#!/usr/bin/env node
/**
 * atlas-labels.js — KA-3: label pipeline + LOD для мини-карты Атласа (семейство levant).
 *
 * По мастер-плану §5.3: кандидатные позиции (8 якорей вокруг маркера) → жадное
 * размещение по приоритету (rank, затем связность) с коллизиями против
 * ПРЕПЯТСТВИЙ: маркеры всех мест, коридоры маршрутов (buffer вдоль полилиний),
 * уже поставленные подписи. Подпись, не вставшая в свой зум-бакет, честно
 * опускается в следующий (far → mid → close → detail); неразрешённая коллизия
 * в detail = ФЕЙЛ гейта (exit 1), не молчаливый дефект.
 *
 * Вход:  data/atlas/places/*.json (placements.levant + rank),
 *        data/atlas/routes/*.json (waypoints: placeId | xy)
 * Выход: data/atlas/generated/labels-levant.json
 *        { labels:[{id,text,x,y,anchor,zbucket}], routes:[{id,title,pts,kind}],
 *          report:{placed,perBucket,demoted,unresolved:[]} }
 *
 * Геометрия в юнитах viewBox 0 0 1900 1430 (шрифт подписи = 12.5 юнитов,
 * как рендерит превью). Запуск: node scripts/atlas-labels.js [--gate]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const A = (d) => path.join(ROOT, 'data', 'atlas', d);
const OUT = path.join(A('generated'), 'labels-levant.json');

// Статический мультикегльный лист (печатная модель): бакет ≡ кегль подписи.
// ЗАКОН КЕГЛЯ (фаза 2): ни одна отрендеренная подпись не меньше 11px на 1280×900.
// Контейнер листа ~1152px на 1900 юнитов → 11px ≈ 18.2u. far=22u (~13.3px),
// mid=18.5u (~11.2px); close/detail НЕ рендерятся на статике (zmin — интерактив),
// их места уходят в кластеры или скрываются до зума (немых точек не существует).
const BUCKET_FONT = { far: 22, mid: 18.5, close: 18.5, detail: 18.5 };
const STATIC_BUCKETS = new Set(['far', 'mid']); // что рендерит статический лист
const CHAR_W = 0.62;               // средняя ширина кириллического знака в em
const PAD = 2;                     // зазор между прямоугольниками
const ROUTE_BUFFER = 6;            // полукоридор маршрута
const BUCKETS = ['far', 'mid', 'close', 'detail'];
const RANK_BUCKET = { 1: 'far', 2: 'mid', 3: 'close' };

const loadDir = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_index.json')
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

const places = loadDir(A('places')).filter((p) => p.placements && p.placements.levant && !p.parentId && p.type !== 'region');
const routes = loadDir(A('routes'));
const byId = new Map(places.map((p) => [p.id, p]));

// ── Маршруты: полилинии в levant-координатах ─────────────────────────────────
const routeLines = routes.map((r) => {
  const pts = r.waypoints.map((w) => {
    if (w.placeId && byId.get(w.placeId)) { const c = byId.get(w.placeId).placements.levant; return [c.x, c.y]; }
    if (w.xy) return [w.xy.x, w.xy.y];
    return null;
  }).filter(Boolean);
  return { id: r.id, title: r.title.ru, kind: r.kind || 'road', pts };
}).filter((r) => r.pts.length >= 2);

// ── Препятствия ──────────────────────────────────────────────────────────────
const rects = [];   // поставленные label-прямоугольники {x,y,w,h}
const markerR = (p) => (p.rank === 1 ? 6.5 : p.rank === 2 ? 5 : 3.8);
const markers = places.map((p) => ({ x: p.placements.levant.x, y: p.placements.levant.y, r: markerR(p) + 2 }));

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
  const qx = ax + t * dx, qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}
function rectRouteHit(rc, selfX, selfY) {
  const cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2;
  const rad = Math.hypot(rc.w, rc.h) / 2;
  for (const rl of routeLines) for (let i = 1; i < rl.pts.length; i++) {
    const [ax, ay] = rl.pts[i - 1], [bx, by] = rl.pts[i];
    // сегменты, инцидентные самому месту, подписи этого места не мешают
    if ((ax === selfX && ay === selfY) || (bx === selfX && by === selfY)) continue;
    if (segDist(cx, cy, ax, ay, bx, by) < ROUTE_BUFFER + rad * 0.45) return true;
  }
  return false;
}
function rectMarkerHit(rc, selfX, selfY) {
  for (const m of markers) {
    if (m.x === selfX && m.y === selfY) continue;
    const nx = Math.max(rc.x, Math.min(m.x, rc.x + rc.w));
    const ny = Math.max(rc.y, Math.min(m.y, rc.y + rc.h));
    if (Math.hypot(m.x - nx, m.y - ny) < m.r) return true;
  }
  return false;
}
function rectRectHit(a) {
  for (const b of rects) {
    if (a.x < b.x + b.w + PAD && a.x + a.w + PAD > b.x && a.y < b.y + b.h + PAD && a.y + a.h + PAD > b.y) return b;
  }
  return null;
}
const inFrame = (rc) => rc.x >= 4 && rc.y >= 4 && rc.x + rc.w <= 1896 && rc.y + rc.h <= 1426;

// 8 якорей: E, W, NE, NW, SE, SW, N, S (в порядке картографического предпочтения);
// второй ряд — дальние якоря с ВЫНОСКОЙ (leader line) для упрямых соседств (§5.3).
function anchors(x, y, w, h, r) {
  const g = r + 3;
  const base = [
    { a: 'e',  x: x + g,          y: y - h / 2 },
    { a: 'w',  x: x - g - w,      y: y - h / 2 },
    { a: 'ne', x: x + g * 0.8,    y: y - g * 0.8 - h },
    { a: 'nw', x: x - g * 0.8 - w, y: y - g * 0.8 - h },
    { a: 'se', x: x + g * 0.8,    y: y + g * 0.8 },
    { a: 'sw', x: x - g * 0.8 - w, y: y + g * 0.8 },
    { a: 'n',  x: x - w / 2,      y: y - g - h },
    { a: 's',  x: x - w / 2,      y: y + g },
  ];
  const far = base.map((c) => ({
    a: c.a, leader: true,
    x: x + (c.x - x) * 2.6 + (c.x < x ? -6 : c.x > x ? 6 : 0),
    y: y + (c.y - y) * 2.6 + (c.y < y ? -6 : c.y > y ? 6 : 0),
  }));
  return base.concat(far);
}

// ── Иерусалимский метрокластер: схлопывание по решению §6 VISUAL-DIRECTION ──
// (city-inset — интерактивная фаза; на статическом листе — кластер-бейдж «+N»).
const J = byId.get('jerusalem').placements.levant;
const CLUSTER_R = 26;
const clusterMembers = places.filter((p) =>
  p.id !== 'jerusalem' && p.rank >= 2 &&
  Math.hypot(p.placements.levant.x - J.x, p.placements.levant.y - J.y) < CLUSTER_R);
const clusteredIds = new Set(clusterMembers.map((p) => p.id));
const clusters = [{
  id: 'jerusalem-cluster', x: J.x, y: J.y, extra: clusterMembers.length,
  memberIds: clusterMembers.map((p) => p.id),
  members: clusterMembers.map((p) => p.names.ru),
}];

// ── Жадное размещение по приоритету ─────────────────────────────────────────
const order = [...places].filter((p) => !clusteredIds.has(p.id))
  .sort((a, b) => (a.rank - b.rank) || ((b.maps || []).length - (a.maps || []).length) || a.id.localeCompare(b.id));
const labels = [];
const report = { placed: 0, perBucket: { far: 0, mid: 0, close: 0, detail: 0 }, demoted: [], leaders: 0, clustered: clusterMembers.length, hiddenAtStatic: [], unresolved: [] };

for (const p of order) {
  const { x, y } = p.placements.levant;
  const text = p.names.ru;
  const startBucket = RANK_BUCKET[p.rank] || 'close';
  let placed = null;
  for (let bi = BUCKETS.indexOf(startBucket); bi < BUCKETS.length && !placed; bi++) {
    const fs2 = BUCKET_FONT[BUCKETS[bi]];
    const w = Math.max(text.length * fs2 * CHAR_W, 10), h = fs2 + 2;
    for (const c of anchors(x, y, w, h, markerR(p))) {
      const rc = { x: c.x, y: c.y, w, h };
      if (!inFrame(rc)) continue;
      if (rectMarkerHit(rc, x, y)) continue;
      if (rectRouteHit(rc, x, y)) continue;
      if (rectRectHit(rc)) continue;
      placed = { id: p.id, text, x: rc.x, y: rc.y + h - 2, anchor: c.a, zbucket: BUCKETS[bi], rank: p.rank, font: fs2,
        ...(c.leader ? { leader: { fromX: x, fromY: y, toX: c.x < x ? rc.x + rc.w : rc.x, toY: rc.y + h / 2 } } : {}) };
      rects.push(rc);
      if (c.leader) report.leaders++;
      if (BUCKETS[bi] !== startBucket) report.demoted.push(`${p.id}: ${startBucket}→${BUCKETS[bi]}`);
      break;
    }
  }
  if (placed) { labels.push(placed); report.placed++; report.perBucket[placed.zbucket]++; }
  else if (p.rank >= 3) { report.hiddenAtStatic.push(p.id); } // до зума: ни точки, ни подписи
  else report.unresolved.push(p.id);
}

const payload = {
  $comment: 'ГЕНЕРИРУЕТСЯ scripts/atlas-labels.js (KA-3 label pipeline) — не править руками. Коллизии решены в юнитах viewBox 1900×1430; бакеты far/mid/close/detail.',
  bucketFont: BUCKET_FONT, labels, clusters, routes: routeLines, report,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');

console.log(`[atlas-labels] мест: ${order.length} · размещено: ${report.placed} (far ${report.perBucket.far} / mid ${report.perBucket.mid} / close ${report.perBucket.close} / detail ${report.perBucket.detail}) · понижено: ${report.demoted.length} · выносок: ${report.leaders} · кластер: ${report.clustered} · скрыто до зума: ${report.hiddenAtStatic.length} · НЕРАЗРЕШЕНО(r1/r2): ${report.unresolved.length}`);
if (report.demoted.length) console.log('   demoted: ' + report.demoted.slice(0, 12).join('; ') + (report.demoted.length > 12 ? ' …' : ''));
if (report.unresolved.length) {
  console.error('❌ G2: неразрешённые коллизии: ' + report.unresolved.join(', '));
  process.exit(1);
}
console.log('✅ G2: 0 неразрешённых коллизий (гейт пройден)');
