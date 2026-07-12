#!/usr/bin/env node
/**
 * build-nations-graph.mjs — «Карта народов»: полная Таблица народов (Быт 10)
 * как аккуратное горизонтальное дерево (дендрограмма) для интерактива.
 *
 * ВСЕ 70+ народов от Ноя: видно родоначальника (слева направо), ветвь-цвет
 * (Иафет/Хам/Сим), достоверность отождествления (confidence), справку с
 * источниками и предупреждение о мифах (mythWatch). Структура (кто чей сын) —
 * прямо из Быт 10 и достоверна; отождествления — вторичны, честно размечены.
 *
 * Выход: data/genealogy/v2/build/nations-graph.json (та же схема, что у
 * genealogy-graph.json → рендерится тем же движком interactive-template.html).
 * Pure Node, без зависимостей. Детерминизм.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconSymbolDefs } from './lib/icons.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'data', 'genealogy', 'v2');

// цвета ветвей (север/море — прохладный, юг — тёплый, Ближний Восток — золото)
const BRANCH = {
  Japheth: { id: 'japheth', ru: 'Иафет', color: '#3f7f8c', icon: 'globe' },
  Ham:     { id: 'ham',     ru: 'Хам',   color: '#a8683f', icon: 'globe' },
  Shem:    { id: 'shem',    ru: 'Сим',   color: '#9a7b3c', icon: 'scroll' },
};
const NOAH_GOLD = '#c9a227';

// достоверность → на будущее из research; пока эвристика (disputed→disputed).
function deriveConfidence(n) {
  if (n.confidence) return n.confidence;             // проставлено верификацией
  if (n.disputed) return 'disputed';
  if (!n.ident) return 'obscure';
  return 'probable';
}
const stripG = s => s ? String(s).replace(/[«»]/g, '').trim() : null;
// ссылки в данных — англ. сокращения (Gen.10.7); в интерфейсе везде русский (Быт 10:7)
const toRuRef = ref => { const m = /^Gen\.(\d+)\.(\d+)$/.exec(ref); return m ? `Быт ${m[1]}:${m[2]}` : ref; };

async function main() {
  const doc = JSON.parse(await readFile(path.join(OUT, 'table-of-nations.json'), 'utf8'));

  // ── строим логическое дерево: Ной → 3 ветви → потомки ──
  let branchOf = new Map();                            // node → branch id (для цвета/облака)
  const root = { ru: 'Ной', en: 'Noah', ref: 'Быт 5:29', heb: 'נֹחַ', kind: 'root', children: [] };
  for (const br of doc.branches) {
    const b = BRANCH[br.en];
    const bn = { ru: b.ru, en: br.en, ref: br.ref, heb: br.heb, gloss: br.gloss, region: br.region,
      kind: 'branch', branch: b.id, children: [] };
    root.children.push(bn);
    const attach = (src, parent) => {
      for (const c of src.children ?? []) {
        const node = {
          ru: c.ru, en: c.en, ref: c.ref, heb: c.heb, gloss: c.gloss, region: c.region,
          ident: c.ident, identNote: c.identNote, disputed: c.disputed,
          confidence: c.confidence, spravka: c.spravka, sources: c.sources, mythWatch: c.mythWatch,
          kind: 'nation', branch: b.id, children: [],
        };
        parent.children.push(node);
        attach(c, node);
      }
    };
    attach(br, bn);
  }

  // ── аккуратная раскладка (горизонтальная дендрограмма) ──
  const LEFT = 120, DX = 205, TOP = 60, YGAP = 30;
  let leafY = 0;
  (function layout(node, depth) {
    node._depth = depth;
    if (!node.children.length) { node._y = TOP + leafY * YGAP; leafY++; return; }
    for (const c of node.children) layout(c, depth + 1);
    node._y = (node.children[0]._y + node.children[node.children.length - 1]._y) / 2;
  })(root, 0);

  // ── в узлы/рёбра графа (схема как у genealogy-graph.json) ──
  const nodes = [], edges = [];
  const foreOf = new Map();                            // node.ru chain (родоначальник)
  (function emit(node, parent, chain) {
    const id = 'nat:' + node.en + '@' + node.ref;
    const isRoot = node.kind === 'root', isBranch = node.kind === 'branch';
    const conf = node.kind === 'nation' ? deriveConfidence(node) : null;
    nodes.push({
      id, ru: node.ru, ref: toRuRef(node.ref), kind: isRoot ? 'spine' : isBranch ? 'hub' : 'leaf',
      family: isRoot ? 'spine' : node.branch,
      color: isRoot ? NOAH_GOLD : (isBranch ? BRANCH[node.en].color : branchColor(node.branch)),
      r: isRoot ? 30 : isBranch ? 20 : 8.5,
      x: LEFT + node._depth * DX, y: node._y, homeX: LEFT + node._depth * DX, homeY: node._y,
      icon: isRoot ? 'ark' : isBranch ? BRANCH[node.en].icon : undefined,
      heb: node.heb ?? null,
      meaning: stripG(node.gloss) ?? null,
      ident: node.ident ?? null,
      region: node.region ?? null,
      confidence: conf,
      spravka: node.spravka ?? node.identNote ?? null,
      sources: node.sources ?? null,
      mythWatch: node.mythWatch ?? null,
      forefather: chain.slice(),                       // ["Ной","Хам","Хуш"]
    });
    if (parent) edges.push({ a: parent, b: id, kind: node.kind === 'branch' ? 'family' : 'leaf', color: branchColor(node.branch) });
    const nextChain = isRoot ? ['Ной'] : chain.concat(node.ru);
    for (const c of node.children) emit(c, id, nextChain);
  })(root, null, []);

  function branchColor(bid) { return Object.values(BRANCH).find(b => b.id === bid)?.color ?? '#8a6d3a'; }
  function BRANCH_by(bid) { return Object.values(BRANCH).find(b => b.id === bid); }

  // счёт по достоверности (для трекера «что осталось исследовать»)
  const nats = nodes.filter(n => n.kind === 'leaf');
  const coverage = { certain: 0, probable: 0, disputed: 0, obscure: 0 };
  for (const n of nats) coverage[n.confidence] = (coverage[n.confidence] ?? 0) + 1;

  // ── «народы смешались»: документированные повторы имён / напряжения в тексте ──
  const byId = new Map(nodes.map(n => [n.id, n]));
  const overlaps = (doc._meta.nameOverlaps ?? []).map(ov => {
    const members = ov.refs.map(r => {
      const id = 'nat:' + r.en + '@' + r.ref;
      const node = byId.get(id);
      if (!node) throw new Error(`nameOverlaps[${ov.id}]: узел ${id} не найден в дереве`);
      return { id: node.id, ru: node.ru, ref: node.ref, forefather: node.forefather, color: node.color, kind: node.kind };
    });
    for (const m of members) byId.get(m.id).overlap = ov.id;
    return { id: ov.id, title: ov.title, kind: ov.kind, confidence: ov.confidence,
      note: ov.note, sources: ov.sources, mythWatch: ov.mythWatch, members };
  });

  const families = [
    { id: 'spine', ru: 'Ной', color: NOAH_GOLD, icon: 'ark' },
    ...Object.values(BRANCH).map(b => ({ id: b.id, ru: 'Народы от ' + b.ru, color: b.color, icon: b.icon,
      count: nats.filter(n => n.family === b.id).length })),
  ];

  const xs = nodes.map(n => n.homeX), ys = nodes.map(n => n.homeY);
  const graph = {
    _status: 'nations: полная Таблица народов (Быт 10) — дерево с достоверностью и справками',
    mode: 'nations',
    bbox: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), cx: LEFT },
    coverage,
    iconDefs: iconSymbolDefs(),
    families, nodes, edges, overlaps,
    counts: { nodes: nodes.length, edges: edges.length, nations: nats.length },
  };
  await writeFile(path.join(OUT, 'build', 'nations-graph.json'), JSON.stringify(graph, null, 1) + '\n');
  console.log(`[build-nations] узлов ${nodes.length}, народов ${nats.length}, рёбер ${edges.length}`);
  console.log(`  достоверность: certain ${coverage.certain} · probable ${coverage.probable} · disputed ${coverage.disputed} · obscure ${coverage.obscure}`);
  console.log(`  народы смешались: ${overlaps.length} случая (${overlaps.map(o => o.id).join(', ')})`);
}

main().catch(e => { console.error(e); process.exit(1); });
