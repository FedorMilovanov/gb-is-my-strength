#!/usr/bin/env node
/**
 * build-graph.mjs — граф для ИНТЕРАКТИВНОГО прототипа (резиновый force-граф).
 *
 * Собирает представительный (не все 3056) граф из реальных данных: золотой хребет
 * (якоря Адам→Христос) + семейства-кластеры (хабы) + до N листьев каждого семейства
 * с настоящими именами/ссылками/ивритом. Каждый узел несёт семью (цвет), размер
 * (хребет > хаб > лист) и «дом» (позицию покоя для пружины возврата).
 *
 * Выход: data/genealogy/v2/build/genealogy-graph.json (встраивается в HTML-прототип).
 * Pure Node, без зависимостей. Детерминизм (без Date/random).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'data', 'genealogy', 'v2');

// Якоря хребта (порядок сверху вниз) и их «дом» по вертикали.
const SPINE = [
  { key: 'Adam@Gen.2.19', ru: 'Адам', ref: 'Быт 2:19', am: '0 AM' },
  { key: 'Noah@Gen.5.29', ru: 'Ной', ref: 'Быт 5:29', am: '1056 AM' },
  { key: 'Shem@Gen.5.32', ru: 'Сим', ref: 'Быт 5:32', am: '1558 AM' },
  { key: 'Abraham@Gen.11.26', ru: 'Авраам', ref: 'Быт 11:26', am: '2008 AM' },
  { key: 'Isaac@Gen.17.19', ru: 'Исаак', ref: 'Быт 17:19', am: '2108 AM' },
  { key: 'Israel@Gen.25.26', ru: 'Иаков', ref: 'Быт 25:26', am: '2168 AM' },
  { key: 'Judah@Gen.29.35', ru: 'Иуда', ref: 'Быт 29:35', am: '2250 AM' },
  { key: 'David@Rut.4.17', ru: 'Давид', ref: 'Руф 4:17', am: '2949 AM' },
  { key: 'Solomon@2Sa.5.14', ru: 'Соломон', ref: '2Цар 5:14', am: '2989 AM' },
  { key: 'Jesus@Isa.7.14', ru: 'Иисус Христос', ref: 'Мессия', am: '~4000 AM', messiah: true },
];

// Семейства: id кластера → { анкер хребта (к кому тяготеет), цвет, сторона, сколько листьев }
const FAMILIES = [
  { cluster: 'antediluvian-patriarchs', ru: 'Допотопные патриархи', anchor: 'Adam@Gen.2.19', color: '#6f8a4c', side: -1, leaves: 8 },
  { cluster: 'nations-of-noah', ru: 'Народы от Ноя', anchor: 'Noah@Gen.5.29', color: '#b5643f', side: 1, leaves: 9 },
  { cluster: 'abraham-descendants', ru: 'Потомки Авраама', anchor: 'Abraham@Gen.11.26', color: '#9a8b3c', side: -1, leaves: 7 },
  { cluster: 'ishmaelites', ru: 'Измаильтяне', anchor: 'Abraham@Gen.11.26', color: '#c08a3e', side: 1, leaves: 6 },
  { cluster: 'esau-edom', ru: 'Исав / Едом', anchor: 'Isaac@Gen.17.19', color: '#a0453a', side: 1, leaves: 6 },
  { cluster: 'tribes-12', ru: '12 колен Израиля', anchor: 'Israel@Gen.25.26', color: '#4f7a4a', side: -1, leaves: 12 },
  { cluster: 'levites', ru: 'Левиты', anchor: 'Israel@Gen.25.26', color: '#8a6db0', side: 1, leaves: 7 },
  { cluster: 'priests', ru: 'Священники', anchor: 'Judah@Gen.29.35', color: '#7d6ba0', side: -1, leaves: 6 },
  { cluster: 'house-of-david', ru: 'Дом Давида', anchor: 'David@Rut.4.17', color: '#6d4b9a', side: 1, leaves: 9 },
  { cluster: 'return-from-exile', ru: 'Возвращение из плена', anchor: 'Solomon@2Sa.5.14', color: '#8c6a4a', side: -1, leaves: 7 },
  { cluster: 'matthew-1', ru: 'Родословие Матфея', anchor: 'Jesus@Isa.7.14', color: '#9a5ba6', side: -1, leaves: 7 },
  { cluster: 'luke-3', ru: 'Родословие Луки', anchor: 'Jesus@Isa.7.14', color: '#3f8a9a', side: 1, leaves: 7 },
  { cluster: 'disciples-apostles', ru: 'Ученики и апостолы', anchor: 'Jesus@Isa.7.14', color: '#2f9fae', side: 1, leaves: 8 },
];

async function main() {
  const persons = JSON.parse(await readFile(path.join(OUT, 'persons.json'), 'utf8'));
  const groups = JSON.parse(await readFile(path.join(OUT, 'groups.json'), 'utf8'));
  const byId = new Map(persons.map(p => [p.id, p]));
  const byKey = new Map(persons.map(p => [p.key, p]));
  const clusterById = new Map(groups.clusters.map(c => [c.id, c]));

  // холст-раскладка
  const CX = 620, TOP = 90, GAP = 150;
  const nodes = [];
  const edges = [];
  const spineY = {};

  // хребет
  SPINE.forEach((s, i) => {
    const p = byKey.get(s.key);
    const y = TOP + i * GAP;
    spineY[s.key] = y;
    nodes.push({
      id: 'spine:' + s.key, ru: s.ru, ref: s.ref, family: 'spine', color: '#c9a227',
      r: s.messiah ? 30 : 26, x: CX, y, homeX: CX, homeY: y, kind: 'spine',
      heb: p?.names?.find(n => n.lang === 'H')?.original ?? null,
      am: s.am, key: s.key,
    });
    if (i > 0) edges.push({ a: 'spine:' + SPINE[i - 1].key, b: 'spine:' + s.key, kind: 'spine' });
  });

  // семейства
  for (const fam of FAMILIES) {
    const cl = clusterById.get(fam.cluster);
    const ay = spineY[fam.anchor] ?? TOP;
    const hubX = CX + fam.side * 300;
    const hubY = ay;
    const hubId = 'hub:' + fam.cluster;
    nodes.push({
      id: hubId, ru: fam.ru, ref: `+${cl?.count ?? '?'} имён`, family: fam.cluster,
      color: fam.color, r: 17, x: hubX, y: hubY, homeX: hubX, homeY: hubY, kind: 'hub',
      count: cl?.count ?? 0,
    });
    edges.push({ a: 'spine:' + fam.anchor, b: hubId, kind: 'family', color: fam.color });

    // листья: реальные члены кластера
    const members = (cl?.members ?? []).slice(0, fam.leaves);
    const n = members.length;
    const spread = Math.min(2.1, 0.5 + n * 0.14);
    members.forEach((mid, j) => {
      const p = byId.get(mid);
      if (!p) return;
      const ang = (fam.side > 0 ? 0 : Math.PI) + ((n === 1 ? 0 : j / (n - 1)) - 0.5) * spread;
      const rad = 120 + (j % 2) * 26;
      const lx = hubX + Math.cos(ang) * rad;
      const ly = hubY + Math.sin(ang) * rad;
      const lid = 'leaf:' + mid;
      nodes.push({
        id: lid, ru: p.ru?.name ?? p.en, ref: p.firstRef?.ru ?? null, family: fam.cluster,
        color: fam.color, r: 8, x: lx, y: ly, homeX: lx, homeY: ly, kind: 'leaf',
        heb: p.names?.find(nm => nm.lang === 'H')?.original ?? null,
        theophoric: !!p.theophoric,
      });
      edges.push({ a: hubId, b: lid, kind: 'leaf', color: fam.color });
    });
  }

  const familiesMeta = [
    { id: 'spine', ru: 'Мессианский хребет', color: '#c9a227' },
    ...FAMILIES.map(f => ({ id: f.cluster, ru: f.ru, color: f.color, count: clusterById.get(f.cluster)?.count ?? 0 })),
  ];

  const graph = {
    _status: 'phase2-proto: представительный граф для интерактивного резинового прототипа',
    bbox: { cx: CX, top: TOP, bottom: TOP + (SPINE.length - 1) * GAP },
    families: familiesMeta,
    nodes,
    edges,
    counts: { nodes: nodes.length, edges: edges.length, families: familiesMeta.length },
  };
  await writeFile(path.join(OUT, 'build', 'genealogy-graph.json'), JSON.stringify(graph, null, 1) + '\n');
  console.log(`[build-graph] узлов ${nodes.length}, рёбер ${edges.length}, семейств ${familiesMeta.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
