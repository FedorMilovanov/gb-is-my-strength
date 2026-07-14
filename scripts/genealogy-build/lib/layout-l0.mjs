/**
 * layout-l0.mjs — детерминированный build-time layout уровня L0 «Обзор».
 *
 * Реализует архитектурное решение «layout считается на билде» (REPORT §S5,
 * engine-contract §2): в рантайме движок только позиционирует по готовым
 * координатам и морфит, но НЕ пересчитывает раскладку 3k узлов.
 *
 * L0 = мессианский хребет (крупные якоря) на центральной оси, позиционированный
 * по AM-хронологии (MT), + мега-узлы кластеров по бокам у своей эпохи. Ровно тот
 * визуальный язык, что на референсах владельца (золотой центральный столб, боковые
 * кластеры «+N имён», эпохи слева).
 *
 * Чистая геометрия, детерминированная (без Math.random/Date) → воспроизводимо в CI.
 */

// Крупные якоря хребта (визуально ~12 узлов из 76 — persistent на всех уровнях).
export const L0_SPINE_ANCHORS = [
  'Adam@Gen.2.19', 'Noah@Gen.5.29', 'Shem@Gen.5.32', 'Abraham@Gen.11.26',
  'Isaac@Gen.17.19', 'Israel@Gen.25.26', 'Judah@Gen.29.35', 'David@Rut.4.17',
  'Solomon@2Sa.5.14', 'Jesus@Isa.7.14',
];

// Привязка кластеров к якорю хребта и стороне (по референсам). anchorKey — рядом
// с каким якорем висит мега-узел; side — слева/справа от центральной оси.
export const L0_CLUSTER_PLACEMENT = {
  'antediluvian-patriarchs': { anchor: 'Adam@Gen.2.19',    side: 'left'  },
  'nations-of-noah':         { anchor: 'Noah@Gen.5.29',    side: 'right' },
  'abraham-descendants':     { anchor: 'Abraham@Gen.11.26', side: 'left' },
  'ishmaelites':             { anchor: 'Abraham@Gen.11.26', side: 'right' },
  'esau-edom':               { anchor: 'Isaac@Gen.17.19',  side: 'right' },
  'tribes-12':               { anchor: 'Israel@Gen.25.26', side: 'left'  },
  'levites':                 { anchor: 'Israel@Gen.25.26', side: 'right' },
  'priests':                 { anchor: 'David@Rut.4.17',   side: 'left'  },
  'house-of-david':          { anchor: 'David@Rut.4.17',   side: 'right' },
  'return-from-exile':       { anchor: 'Solomon@2Sa.5.14', side: 'left'  },
  'matthew-1':               { anchor: 'Jesus@Isa.7.14',   side: 'left'  },
  'luke-3':                  { anchor: 'Jesus@Isa.7.14',   side: 'right' },
  'lords-relatives':         { anchor: 'Jesus@Isa.7.14',   side: 'right', tier: 2 },
  'disciples-apostles':      { anchor: 'Jesus@Isa.7.14',   side: 'center', below: true },
};

const GEO = {
  centerX: 0,
  topY: 0,
  rowH: 150,              // компактный шаг между якорями хребта (обзор L0, НЕ AM-ось)
  spineNodeW: 168, spineNodeH: 64,
  megaW: 210, megaH: 76,
  sideGap: 300,           // отступ мега-узла от оси
  sideGap2: 560,          // второй ярус (lords-relatives)
  belowGap: 120,
  marginX: 640,           // половина ширины поля под боковые кластеры
};

/**
 * @param persons — эмитнутые персоны
 * @param clusters — из computeClusters()
 * @param eras — eras.json (v1: {id,name,amStart,amEnd})
 * @returns layout-l0 объект (nodes, edges, eras-полосы, bbox)
 */
export function buildLayoutL0(persons, clusters, eras) {
  const byKey = new Map(persons.map(p => [p.key, p]));
  const clusterById = new Map(clusters.map(c => [c.id, c]));

  // L0 — КОМПАКТНЫЙ обзор с АДАПТИВНЫМ шагом: ряды с боковыми кластерами получают
  // высоту под их стек, пустые ряды (Сим, Иуда) сжимаются — так убираются мёртвые
  // вертикальные провалы и композиция становится плотной, как на референсах. AM —
  // атрибут карточки, НЕ управляет Y (AM-ось — отдельный слой, engine-contract §9).
  const nodes = [];
  const anchorY = new Map();
  const VGAP = GEO.megaH + 24;   // шаг вертикального стека кластеров у одного якоря

  // Проход 1 — раскладка кластеров по якорям (сторона + индекс в стеке + «ниже»)
  const placements = [];
  const sideCount = {};
  for (const [cid, place] of Object.entries(L0_CLUSTER_PLACEMENT)) {
    const c = clusterById.get(cid);
    if (!c || anchorY === undefined) { /* ключ проверяется ниже */ }
    if (!c) continue;
    const below = place.side === 'center' || place.below === true;
    const stackKey = `${place.anchor}|${place.side}`;
    const stackIdx = below ? 0 : (sideCount[stackKey] ?? 0);
    if (!below) sideCount[stackKey] = stackIdx + 1;
    placements.push({ cid, c, anchor: place.anchor, side: place.side, tier: place.tier, below, stackIdx });
  }

  // Проход 2 — вертикальные экстенты каждого якоря и последовательное позиционирование
  const halfSpine = GEO.spineNodeH / 2, halfMega = GEO.megaH / 2;
  const extent = new Map();  // key → { up, down }
  for (const key of L0_SPINE_ANCHORS) {
    const pls = placements.filter(p => p.anchor === key);
    const sideStacks = pls.filter(p => !p.below);
    const maxStack = sideStacks.reduce((m, p) => Math.max(m, p.stackIdx), -1);
    const hasIdx0 = sideStacks.some(p => p.stackIdx === 0);
    const hasBelow = pls.some(p => p.below);
    const up = hasIdx0 ? halfMega : halfSpine;
    const downStack = maxStack >= 0 ? (maxStack * VGAP + halfMega) : halfSpine;
    const downBelow = hasBelow ? (GEO.belowGap + GEO.megaH) : 0;
    extent.set(key, { up, down: Math.max(downStack, downBelow, halfSpine) });
  }
  const ROW_GAP = 46;
  let cursor = GEO.topY;
  L0_SPINE_ANCHORS.forEach((key, i) => {
    const ex = extent.get(key);
    const prev = i > 0 ? extent.get(L0_SPINE_ANCHORS[i - 1]) : null;
    if (prev) cursor += prev.down + ROW_GAP + ex.up;
    else cursor += ex.up;
    anchorY.set(key, cursor);
    const p = byKey.get(key);
    nodes.push({
      id: p.id, key, kind: 'spine',
      x: GEO.centerX - GEO.spineNodeW / 2, y: cursor - GEO.spineNodeH / 2,
      w: GEO.spineNodeW, h: GEO.spineNodeH,
      label: p.ru?.name ?? p.en,
      refRu: p.firstRef?.ru ?? null,
      am: p?.skeleton?.chronology?.mt?.birthAM ?? null,
      era: p?.skeleton?.era ?? null,
      golden: true,
      messiah: p?.skeleton?.role === 'messiah' || key === 'Jesus@Isa.7.14',
    });
  });

  // Проход 3 — эмит мега-узлов по вычисленным anchorY
  for (const pl of placements) {
    const ay = anchorY.get(pl.anchor);
    if (ay == null) continue;
    let x, y;
    if (pl.below) { x = GEO.centerX - GEO.megaW / 2; y = ay + GEO.belowGap; }
    else {
      y = ay - GEO.megaH / 2 + pl.stackIdx * VGAP;
      x = pl.side === 'left' ? GEO.centerX - GEO.sideGap - GEO.megaW
        : GEO.centerX + (pl.tier === 2 ? GEO.sideGap2 : GEO.sideGap);
    }
    nodes.push({
      id: `cluster--${pl.cid}`, clusterId: pl.cid, kind: 'mega',
      x, y, w: GEO.megaW, h: GEO.megaH,
      label: pl.c.titleRu, count: pl.c.count,
      anchorKey: pl.anchor, side: pl.side,
    });
  }

  // Рёбра: хребет (последовательные якоря) + связка кластер→якорь
  const edges = [];
  for (let i = 0; i + 1 < L0_SPINE_ANCHORS.length; i++) {
    const a = byKey.get(L0_SPINE_ANCHORS[i]), b = byKey.get(L0_SPINE_ANCHORS[i + 1]);
    edges.push({ from: a.id, to: b.id, kind: 'golden' });
  }
  for (const [cid, place] of Object.entries(L0_CLUSTER_PLACEMENT)) {
    if (!clusterById.get(cid)) continue;
    const a = byKey.get(place.anchor);
    edges.push({ from: a.id, to: `cluster--${cid}`, kind: 'cluster-link' });
  }

  // Полосы эпох — из фактических Y узлов каждой эпохи (компактный L0), с зазором,
  // чтобы подписи не налезали. Эпохи без узлов на L0 пропускаются.
  const eraOrder = ['creation', 'antediluvian', 'flood', 'postdiluvian', 'patriarchs', 'kings', 'exile', 'incarnation'];
  const eraName = new Map((eras ?? []).map(e => [e.id, e.name]));
  const eraNodeYs = new Map();
  for (const nd of nodes) {
    const era = nd.era ?? clusterEra(nd, byKey);
    if (!era) continue;
    if (!eraNodeYs.has(era)) eraNodeYs.set(era, []);
    eraNodeYs.get(era).push(nd.y, nd.y + nd.h);
  }
  const eraBands = [];
  for (const id of eraOrder) {
    const ys = eraNodeYs.get(id);
    if (!ys) continue;
    eraBands.push({ id, label: eraName.get(id) ?? id, y0: Math.min(...ys) - 12, y1: Math.max(...ys) + 12 });
  }

  // bbox
  const xs = nodes.flatMap(nd => [nd.x, nd.x + nd.w]);
  const ys = nodes.flatMap(nd => [nd.y, nd.y + nd.h]);
  const bbox = {
    x: Math.min(...xs) - 40, y: Math.min(...ys) - 40,
    w: Math.max(...xs) - Math.min(...xs) + 80,
    h: Math.max(...ys) - Math.min(...ys) + 80,
  };

  return {
    _status: 'phase1-draft: L0 build-time layout (детерминированный, компактный обзор). Вход движка Phase 3.',
    nodes, edges, eraBands, bbox,
  };
}

/** Эпоха мега-узла — по эпохе его якоря (для полос эпох на L0). */
function clusterEra(node, byKey) {
  if (node.kind !== 'mega' || !node.anchorKey) return null;
  return byKey.get(node.anchorKey)?.skeleton?.era ?? null;
}
