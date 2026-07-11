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

  // L0 — КОМПАКТНЫЙ обзор: равномерный шаг по индексу якоря (референсы владельца
  // именно такие). AM показывается на карточке как атрибут, но НЕ управляет Y —
  // AM-пропорциональная ось это отдельный режим/слой (engine-contract §9), не обзор.
  const nodes = [];
  const anchorY = new Map();
  L0_SPINE_ANCHORS.forEach((key, i) => {
    const y = GEO.topY + i * GEO.rowH + GEO.rowH / 2;
    anchorY.set(key, y);
    const p = byKey.get(key);
    nodes.push({
      id: p.id, key, kind: 'spine',
      x: GEO.centerX - GEO.spineNodeW / 2, y: y - GEO.spineNodeH / 2,
      w: GEO.spineNodeW, h: GEO.spineNodeH,
      label: p.ru?.name ?? p.en,
      refRu: p.firstRef?.ru ?? null,
      am: p?.skeleton?.chronology?.mt?.birthAM ?? null,
      era: p?.skeleton?.era ?? null,
      golden: true,
      messiah: p?.skeleton?.role === 'messiah' || key === 'Jesus@Isa.7.14',
    });
  });

  // Мега-узлы кластеров
  const sideCount = {};   // сколько кластеров уже на (anchor|side) — для вертикального разнесения
  for (const [cid, place] of Object.entries(L0_CLUSTER_PLACEMENT)) {
    const c = clusterById.get(cid);
    if (!c) continue;
    const ay = anchorY.get(place.anchor);
    if (ay == null) continue;
    const stackKey = `${place.anchor}|${place.side}`;
    const idx = sideCount[stackKey] ?? 0;
    sideCount[stackKey] = idx + 1;

    let x, y = ay - GEO.megaH / 2 + idx * (GEO.megaH + 24);
    if (place.side === 'left')  x = GEO.centerX - GEO.sideGap - GEO.megaW;
    else if (place.side === 'right') x = GEO.centerX + (place.tier === 2 ? GEO.sideGap2 : GEO.sideGap);
    else { x = GEO.centerX - GEO.megaW / 2; y = ay + GEO.belowGap; } // center/below

    nodes.push({
      id: `cluster--${cid}`, clusterId: cid, kind: 'mega',
      x, y, w: GEO.megaW, h: GEO.megaH,
      label: c.titleRu, count: c.count,
      anchorKey: place.anchor, side: place.side,
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
