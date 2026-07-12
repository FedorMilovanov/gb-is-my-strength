#!/usr/bin/env node
/**
 * build-graph.mjs — граф для ИНТЕРАКТИВНОГО прототипа (резиновый force-граф).
 *
 * Собирает НАСТОЯЩЕЕ родословное дерево (не алфавит кластера): золотой хребет
 * (якоря Адам→Христос) + семейства, РАСКРЫТЫЕ ПО РЕАЛЬНЫМ рёбрам отец→сын
 * (edges.json). Каждый лист связан со своим НАСТОЯЩИМ родителем — поэтому
 * Авраам, Измаил, колена и т.д. стоят под правильным предком, а не «висят».
 *
 * Каждый узел несёт: имя (Синодальное) · иврит · транслитерацию · ПОНЯТНОЕ
 * значение (name-etymology.json) · для народов — отождествление (таблица народов).
 * Крупные узлы (хребет, хабы) несут SVG-эмблему (icons.mjs) внутри «медальона».
 *
 * Выход: data/genealogy/v2/build/genealogy-graph.json (встраивается в HTML-прототип).
 * Pure Node, без зависимостей. Детерминизм (без Date/random).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconSymbolDefs } from './lib/icons.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'data', 'genealogy', 'v2');

// ── Якоря хребта (сверху вниз) + эмблема + датировка ──────────────────────
// bc — подпись под узлом (понятно любому: до Р.Х. / событие);
// am — в тултипе, «лет от Адама» (младоземельная шкала), словами, без жаргона «AM».
const SPINE = [
  { key: 'Adam@Gen.2.19',     ru: 'Адам',          ref: 'Быт 2:19',  bc: 'Сотворение',    am: '0 · начало',        icon: 'person' },
  { key: 'Noah@Gen.5.29',     ru: 'Ной',           ref: 'Быт 5:29',  bc: '≈2950 до Р.Х.', am: '1056 г. от Адама',  icon: 'ark' },
  { key: 'Shem@Gen.5.32',     ru: 'Сим',           ref: 'Быт 5:32',  bc: '≈2450 до Р.Х.', am: '1558 г. от Адама',  icon: 'scroll' },
  { key: 'Abraham@Gen.11.26', ru: 'Авраам',        ref: 'Быт 11:26', bc: '≈2000 до Р.Х.', am: '2008 г. от Адама',  icon: 'tent' },
  { key: 'Isaac@Gen.17.19',   ru: 'Исаак',         ref: 'Быт 17:19', bc: '≈1900 до Р.Х.', am: '2108 г. от Адама',  icon: 'ram' },
  { key: 'Israel@Gen.25.26',  ru: 'Иаков',         ref: 'Быт 25:26', bc: '≈1840 до Р.Х.', am: '2168 г. от Адама',  icon: 'ladder' },
  { key: 'Judah@Gen.29.35',   ru: 'Иуда',          ref: 'Быт 29:35', bc: '≈1750 до Р.Х.', am: '2250 г. от Адама',  icon: 'lion' },
  { key: 'David@Rut.4.17',    ru: 'Давид',         ref: 'Руф 4:17',  bc: '≈1000 до Р.Х.', am: '2949 г. от Адама',  icon: 'crown' },
  { key: 'Solomon@2Sa.5.14',  ru: 'Соломон',       ref: '2Цар 5:14', bc: '≈970 до Р.Х.',  am: '2989 г. от Адама',  icon: 'temple' },
  { key: 'Jesus@Isa.7.14',    ru: 'Иисус Христос', ref: 'Мессия',    bc: 'Рождество',     am: '≈4000 г. от Адама', icon: 'cross', messiah: true },
];

// ── Семейства: раскрываются ПО РЕАЛЬНЫМ детям якоря (edges.json) ───────────
// pick: как выбрать корни из детей якоря — {only:[...]} | {except:[...]} | 'all'
const FAMILIES = [
  { id: 'sethites',       ru: 'До потопа (линия Сифа)',   shortRu: 'Линия Сифа', anchor: 'Adam@Gen.2.19',     side: -1, color: '#6f8a4c', icon: 'tree',     cap: 13, pick: 'all' },
  { id: 'japheth',        ru: 'Народы от Иафета',         shortRu: 'От Иафета',  anchor: 'Noah@Gen.5.29',     side: +1, color: '#b5643f', icon: 'globe',    cap: 15, pick: { only: ['Иафет'] } },
  { id: 'ham',            ru: 'Народы от Хама',           shortRu: 'От Хама',    anchor: 'Noah@Gen.5.29',     side: -1, color: '#a86b46', icon: 'globe',    cap: 15, pick: { only: ['Хам'] } },
  { id: 'shem-fathers',   ru: 'Праотцы после потопа',     shortRu: 'Праотцы',    anchor: 'Shem@Gen.5.32',     side: +1, color: '#9a8b3c', icon: 'scroll',   cap: 13, pick: 'all' },
  { id: 'keturah',        ru: 'Сыны Авраама и Хеттуры',   shortRu: 'Сыны Хеттуры', anchor: 'Abraham@Gen.11.26', side: -1, color: '#8f7a3a', icon: 'tent',   cap: 11, pick: { except: ['Исаак', 'Измаил'] } },
  { id: 'ishmaelites',    ru: 'Измаильтяне (12 князей)',  shortRu: 'Измаильтяне', anchor: 'Abraham@Gen.11.26', side: +1, color: '#c08a3e', icon: 'camel',   cap: 14, pick: { only: ['Измаил'] } },
  { id: 'esau-edom',      ru: 'Исав · Едом',              shortRu: 'Исав · Едом', anchor: 'Isaac@Gen.17.19',  side: +1, color: '#a0453a', icon: 'mountain', cap: 14, pick: { only: ['Исав'] } },
  { id: 'tribes',         ru: '12 колен Израиля',         shortRu: '12 колен',   anchor: 'Israel@Gen.25.26',  side: -1, color: '#4f7a4a', icon: 'tribes',   cap: 13, pick: { except: ['Иуда', 'Левий'] } },
  { id: 'levites',        ru: 'Левиты и священство',      shortRu: 'Левиты',     anchor: 'Israel@Gen.25.26',  side: +1, color: '#8a6db0', icon: 'menorah',  cap: 18, pick: { only: ['Левий'] } },
  { id: 'judah-sons',     ru: 'Сыны Иуды (линия Фареса)', shortRu: 'Сыны Иуды',  anchor: 'Judah@Gen.29.35',   side: -1, color: '#7d6ba0', icon: 'scroll',   cap: 12, pick: 'all' },
  { id: 'house-of-david', ru: 'Дом Давида',               shortRu: 'Дом Давида', anchor: 'David@Rut.4.17',    side: +1, color: '#6d4b9a', icon: 'crown',    cap: 12, pick: { except: ['Соломон'] } },
  { id: 'kings-of-judah', ru: 'Цари Иудеи',               shortRu: 'Цари Иудеи', anchor: 'Solomon@2Sa.5.14',  side: -1, color: '#9a5ba6', icon: 'crown',    cap: 16, pick: { only: ['Ровоам'] } },
];

const SPINE_GOLD = '#c9a227';
const stripMeaning = s => s ? String(s).replace(/[«»]/g, '').trim() : null;

async function main() {
  const persons   = JSON.parse(await readFile(path.join(OUT, 'persons.json'), 'utf8'));
  const edgesRaw  = JSON.parse(await readFile(path.join(OUT, 'edges.json'), 'utf8'));
  const etymDoc   = JSON.parse(await readFile(path.join(OUT, 'name-etymology.json'), 'utf8'));
  const nationsDoc= JSON.parse(await readFile(path.join(OUT, 'table-of-nations.json'), 'utf8'));

  const byId  = new Map(persons.map(p => [p.id, p]));
  const byKey = new Map(persons.map(p => [p.key, p]));

  // реальные дети: parent.from → [child.to]
  const kids = new Map();
  for (const e of edgesRaw) {
    if (e.kind !== 'parent') continue;
    if (!kids.has(e.from)) kids.set(e.from, []);
    kids.get(e.from).push(e.to);
  }
  const childrenOf = pid => (kids.get(pid) ?? []).map(id => byId.get(id)).filter(Boolean);
  const named = p => p && p.ru?.name && !/без имени/i.test(p.ru.name);

  // словари понятных значений (ключи этимологии и таблицы народов привязаны к
  // ИНЫМ стихам, чем firstRef персоны — поэтому мэтчим ещё по англ.-имени и Синодальному)
  const etymByKey = new Map();
  const etymByEn = new Map();
  for (const e of etymDoc.entries ?? []) {
    if (!e.key) continue;
    etymByKey.set(e.key, e);
    const en = e.key.split('@')[0];
    if (en && !etymByEn.has(en)) etymByEn.set(en, e);   // exact-key имеет приоритет
  }
  const nationByKey = new Map();
  const nationByRu = new Map();
  (function walk(list) {
    for (const n of list ?? []) {
      if (n.tipnrKey) nationByKey.set(n.tipnrKey, n);
      if (n.ru && !nationByRu.has(n.ru)) nationByRu.set(n.ru, n);
      walk(n.children);
    }
  })(nationsDoc.branches);

  // Понятная карточка узла для обычного читателя (не для учёных).
  function enrich(p) {
    const et = etymByKey.get(p.key) ?? etymByEn.get(p.en);
    const na = nationByKey.get(p.key) ?? nationByRu.get(p.ru?.name);
    const heb = et?.heb ?? na?.heb ?? p.names?.find(n => n.lang === 'H')?.original ?? null;
    const meaning = stripMeaning(et?.meaningRu) ?? stripMeaning(na?.gloss) ?? null;
    return {
      heb,
      translit: et?.translit ?? null,
      meaning,                              // «что значит имя» простыми словами
      ident: na?.ident ?? null,             // для народов: «кто это» (Киммерийцы…)
      note: et?.note ?? na?.identNote ?? null,
    };
  }

  // ── холст ────────────────────────────────────────────────────────────────
  const CX = 660, TOP = 96, GAP = 182;
  const nodes = [];
  const edges = [];
  const spineY = {};
  const used = new Set();                   // глобальный дедуп персон

  // хребет
  SPINE.forEach((s, i) => {
    const p = byKey.get(s.key);
    const y = TOP + i * GAP;
    spineY[s.key] = y;
    used.add(p?.id);
    const en = enrich(p ?? {});
    nodes.push({
      id: 'spine:' + s.key, ru: s.ru, ref: s.ref, family: 'spine', color: SPINE_GOLD,
      r: s.messiah ? 34 : 27, x: CX, y, homeX: CX, homeY: y, kind: 'spine',
      icon: s.icon, am: s.am, bc: s.bc, key: s.key,
      heb: en.heb, translit: en.translit, meaning: en.meaning, note: en.note, messiah: !!s.messiah,
    });
    if (i > 0) edges.push({ a: 'spine:' + SPINE[i - 1].key, b: 'spine:' + s.key, kind: 'spine' });
  });

  // выбор корней семейства из реальных детей якоря
  function rootsFor(fam, anchorP) {
    const ch = childrenOf(anchorP.id).filter(named);
    if (fam.pick === 'all') return ch;
    if (fam.pick?.only)   return ch.filter(c => fam.pick.only.includes(c.ru.name));
    if (fam.pick?.except) return ch.filter(c => !fam.pick.except.includes(c.ru.name));
    return ch;
  }

  // ── семейства: реальное поддерево (BFS вширь, дедуп, кап) ──────────────────
  for (const fam of FAMILIES) {
    const anchorP = byKey.get(fam.anchor);
    const ay = spineY[fam.anchor] ?? TOP;
    const hubX = CX + fam.side * 236;
    const hubY = ay;
    const hubId = 'hub:' + fam.id;

    // BFS по реальным рёбрам; parentGraphId запоминает, к кому цеплять ребро
    const roots = rootsFor(fam, anchorP);
    const layerOf = new Map();               // personId → глубина (для раскладки)
    const parentGraph = new Map();           // personId → id узла-родителя в графе
    const members = [];                       // включённые персоны (по порядку BFS)
    const q = [];
    for (const r of roots) {
      if (members.length >= fam.cap) break;
      if (used.has(r.id)) continue;
      used.add(r.id); layerOf.set(r.id, 0); parentGraph.set(r.id, hubId);
      members.push(r); q.push(r);
    }
    while (q.length && members.length < fam.cap) {
      const cur = q.shift();
      const d = layerOf.get(cur.id);
      for (const c of childrenOf(cur.id)) {
        if (members.length >= fam.cap) break;
        if (used.has(c.id) || !named(c)) continue;
        used.add(c.id); layerOf.set(c.id, d + 1);
        parentGraph.set(c.id, 'leaf:' + cur.id); members.push(c); q.push(c);
      }
    }
    if (!members.length) continue;

    // хаб-медальон семейства
    nodes.push({
      id: hubId, ru: fam.shortRu || fam.ru, fullRu: fam.ru, ref: `${members.length} имён`, family: fam.id,
      color: fam.color, r: 18, x: hubX, y: hubY, homeX: hubX, homeY: hubY, kind: 'hub',
      icon: fam.icon, count: members.length,
    });
    edges.push({ a: 'spine:' + fam.anchor, b: hubId, kind: 'family', color: fam.color });

    // раскладка мини-дерева: по слоям вправо/влево от хаба, веером по вертикали
    const byLayer = new Map();
    for (const m of members) {
      const d = layerOf.get(m.id);
      if (!byLayer.has(d)) byLayer.set(d, []);
      byLayer.get(d).push(m);
    }
    for (const [d, layer] of byLayer) {
      const m = layer.length;
      // адаптивный вертикальный шаг: густой слой ужимаем, чтобы семья не залезала
      // в соседнюю по хребту (держим ~±80px от якоря); дерево растёт вширь
      const vgap = Math.min(30, 150 / Math.max(1, m - 1));
      layer.forEach((p, i) => {
        const en = enrich(p);
        const lx = hubX + fam.side * (64 + d * 86);
        const ly = hubY + (i - (m - 1) / 2) * vgap;
        const lid = 'leaf:' + p.id;
        nodes.push({
          id: lid, ru: p.ru.name, ref: p.firstRef?.ru ?? null, family: fam.id,
          color: fam.color, r: 8.5, x: lx, y: ly, homeX: lx, homeY: ly, kind: 'leaf',
          heb: en.heb, translit: en.translit, meaning: en.meaning, ident: en.ident, note: en.note,
        });
        edges.push({ a: parentGraph.get(p.id), b: lid, kind: 'leaf', color: fam.color });
      });
    }
  }

  const familiesMeta = [
    { id: 'spine', ru: 'Мессианский хребет', color: SPINE_GOLD, icon: 'cross' },
    ...FAMILIES.map(f => ({
      id: f.id, ru: f.ru, color: f.color, icon: f.icon,
      count: nodes.filter(n => n.family === f.id && n.kind === 'leaf').length,
    })).filter(f => f.count > 0),
  ];

  const xs = nodes.map(n => n.homeX), ys = nodes.map(n => n.homeY);
  const graph = {
    _status: 'phase2-proto: реальное родословное дерево (edges.json) для интерактива',
    bbox: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), cx: CX },
    iconDefs: iconSymbolDefs(),
    families: familiesMeta,
    nodes,
    edges,
    counts: { nodes: nodes.length, edges: edges.length, families: familiesMeta.length },
  };
  await writeFile(path.join(OUT, 'build', 'genealogy-graph.json'), JSON.stringify(graph, null, 1) + '\n');
  console.log(`[build-graph] узлов ${nodes.length}, рёбер ${edges.length}, семейств ${familiesMeta.length}`);
  // краткий контроль связности семейств
  for (const f of familiesMeta.filter(f => f.id !== 'spine')) {
    const leaves = nodes.filter(n => n.family === f.id && n.kind === 'leaf').map(n => n.ru);
    console.log(`  · ${f.ru}: ${leaves.slice(0, 6).join(', ')}${leaves.length > 6 ? ' …' : ''} (${leaves.length})`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
