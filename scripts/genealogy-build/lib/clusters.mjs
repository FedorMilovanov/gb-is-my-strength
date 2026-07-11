/**
 * clusters.mjs — курируемые кластеры генеалогии (мега-узлы уровня L0) и правила членства.
 *
 * Каждый кластер задан ВОСПРОИЗВОДИМЫМ правилом (не ручным списком) — правило
 * сохраняется в groups.json рядом с членством, чтобы редактор видел, ОТКУДА
 * взялось членство, и правил осознанно. Персона может входить в несколько
 * кластеров: кластеры — это «виды» генеалогии, не разбиение множества.
 *
 * Статус Phase 1: правила — эвристики-черновик; сверка редактором обязательна.
 */
import { parseRef } from './refs.mjs';

export const CLUSTER_DEFS = [
  { id: 'antediluvian-patriarchs', titleRu: 'Допотопные патриархи',
    rule: { type: 'refRange', books: ['Gen'], chapters: [4, 5, 6] } },
  { id: 'nations-of-noah', titleRu: 'Народы от Ноя',
    rule: { type: 'refRange', books: ['Gen'], chapters: [10, 11] } },
  { id: 'abraham-descendants', titleRu: 'Потомки Авраама',
    rule: { type: 'descendants', rootKey: 'Abraham@Gen.11.26' } },
  { id: 'ishmaelites', titleRu: 'Измаильтяне',
    rule: { type: 'descendants', rootKey: 'Ishmael@Gen.16.11', includeRoot: true } },
  { id: 'esau-edom', titleRu: 'Исав / Едом',
    rule: { type: 'descendants', rootKey: 'Esau@Gen.25.25', includeRoot: true } },
  { id: 'tribes-12', titleRu: '12 колен Израиля',
    rule: { type: 'childrenOf', rootKey: 'Israel@Gen.25.26', gender: 'm' } },
  { id: 'levites', titleRu: 'Левиты',
    rule: { type: 'tribe', equals: 'Tribe of Levi' } },
  { id: 'priests', titleRu: 'Священники',
    rule: { type: 'description', re: '\\bpriest\\b' } },
  { id: 'house-of-david', titleRu: 'Дом Давида',
    rule: { type: 'descendants', rootKey: 'David@Rut.4.17', includeRoot: true } },
  { id: 'return-from-exile', titleRu: 'Возвращение из плена',
    rule: { type: 'refBooks', books: ['Ezr', 'Neh'] } },
  { id: 'matthew-1', titleRu: 'Родословие по Матфею',
    rule: { type: 'ancestorsVia', rootKey: 'Joseph@Mat.1.16', role: 'father', includeRoot: true } },
  { id: 'luke-3', titleRu: 'Родословие по Луке',
    rule: { type: 'ancestorsVia', rootKey: 'Mary@Mat.1.16', role: 'father', includeRoot: true } },
  { id: 'lords-relatives', titleRu: 'Родственники Господа',
    rule: { type: 'siblingsOf', rootKey: 'Jesus@Isa.7.14' } },
  { id: 'disciples-apostles', titleRu: 'Ученики и апостолы',
    rule: { type: 'description', re: 'apostle|disciple' } },
];

/**
 * Вычислить членство кластеров.
 * @param personsArr — эмитнутые персоны ({id, key, en, gender, firstRef, tribe, description})
 * @param edges — эмитнутые рёбра ({kind, from, to, role})
 */
export function computeClusters(personsArr, edges) {
  const byKey = new Map(personsArr.map(p => [p.key, p]));
  const byId = new Map(personsArr.map(p => [p.id, p]));

  const childrenOf = new Map();  // parentId → [childId]
  const fatherOf = new Map();    // childId → fatherId
  for (const e of edges) {
    if (e.kind !== 'parent' && e.kind !== 'ancestor') continue;
    if (!childrenOf.has(e.from)) childrenOf.set(e.from, []);
    childrenOf.get(e.from).push(e.to);
    if (e.role === 'father') fatherOf.set(e.to, e.from);
  }

  const descendants = (rootId, includeRoot) => {
    const out = new Set(includeRoot ? [rootId] : []);
    const q = [rootId];
    while (q.length) {
      for (const c of childrenOf.get(q.pop()) ?? []) {
        if (!out.has(c)) { out.add(c); q.push(c); }
      }
    }
    if (!includeRoot) out.delete(rootId);
    return out;
  };

  const ancestorsVia = (rootId, includeRoot) => {
    const out = new Set(includeRoot ? [rootId] : []);
    let cur = rootId;
    const guard = new Set();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      const f = fatherOf.get(cur);
      if (f) out.add(f);
      cur = f;
    }
    return out;
  };

  const clusters = [];
  for (const def of CLUSTER_DEFS) {
    const r = def.rule;
    let members = [];
    if (r.type === 'refRange') {
      members = personsArr
        .filter(p => {
          const ref = parseRef(p.firstRef.osis);
          return ref && r.books.includes(ref.osis) && (!r.chapters || r.chapters.includes(ref.chapter));
        })
        .map(p => p.id);
    } else if (r.type === 'refBooks') {
      members = personsArr
        .filter(p => { const ref = parseRef(p.firstRef.osis); return ref && r.books.includes(ref.osis); })
        .map(p => p.id);
    } else if (r.type === 'descendants') {
      const root = byKey.get(r.rootKey);
      members = root ? [...descendants(root.id, Boolean(r.includeRoot))] : [];
    } else if (r.type === 'ancestorsVia') {
      const root = byKey.get(r.rootKey);
      members = root ? [...ancestorsVia(root.id, Boolean(r.includeRoot))] : [];
    } else if (r.type === 'childrenOf') {
      const root = byKey.get(r.rootKey);
      members = root
        ? (childrenOf.get(root.id) ?? []).filter(id => !r.gender || byId.get(id)?.gender === r.gender)
        : [];
    } else if (r.type === 'tribe') {
      members = personsArr.filter(p => p.tribe === r.equals).map(p => p.id);
    } else if (r.type === 'description') {
      const re = new RegExp(r.re, 'i');
      members = personsArr.filter(p => re.test(p.description ?? '')).map(p => p.id);
    } else if (r.type === 'siblingsOf') {
      const root = byKey.get(r.rootKey);
      // сиблинги — через общего резолвнутого родителя
      if (root) {
        const parents = edges.filter(e => e.kind === 'parent' && e.to === root.id).map(e => e.from);
        const sibs = new Set();
        for (const par of parents) for (const c of childrenOf.get(par) ?? []) if (c !== root.id) sibs.add(c);
        members = [...sibs];
      }
    }
    clusters.push({
      id: def.id,
      titleRu: def.titleRu,
      kind: 'cluster',
      rule: r,
      count: members.length,
      members: members.sort(),
    });
  }
  return clusters;
}

/**
 * Сырой слой народов из TIPNR Group-записей: народ → прародитель-персона
 * ((d)-маркер в Parents). Основа для рёбер «персона → народ» в L0/L1.
 */
export function nationsLayer(groupsMap, byKey) {
  const nations = [];
  for (const g of groupsMap.values()) {
    const progenitor = g.parents.find(p => p.refKey && byKey.has(p.refKey));
    nations.push({
      id: 'nation--' + g.key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      key: g.key,
      en: g.name,
      firstRef: g.ref,
      progenitorId: progenitor ? byKey.get(progenitor.refKey).id : null,
      progenitorIsAncestor: progenitor?.markers.descendedGroup || progenitor?.markers.ancestor || false,
      description: g.description || null,
    });
  }
  return nations.sort((a, b) => a.id.localeCompare(b.id));
}
