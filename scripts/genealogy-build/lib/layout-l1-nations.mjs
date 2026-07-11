/**
 * layout-l1-nations.mjs — раскладка архетипа 3 «Народы от Ноя» (Таблица народов, Быт 10).
 *
 * Три колонки-ветви (Иафет · Хам · Сим) слева направо — в порядке Быт 10, где Сим
 * назван последним как избранная линия. Ной — золотой якорь сверху. Внутри колонки —
 * отступный список-дерево (глубина → отступ), с направляющими-«уголками» родитель→дети.
 * Линия Сима до Фалека («→ Авраам») — золотая мессианская нить (leadsToSpine).
 *
 * Детерминированная чистая функция раскладки: данные из table-of-nations.json → узлы с
 * координатами. Ничего не рисует (это render-l1-nations.mjs).
 */

const BRANCH_ORDER = ['japheth', 'ham', 'shem'];

/**
 * @param data — разобранный table-of-nations.json
 * @returns { bbox, noah, columns:[{branch,header,rows,guides}], meta }
 */
export function buildNationsTree(data) {
  const COL_W = 616, COL_GAP = 54, HEAD_H = 74, HEAD_GAP = 40;
  const ROW_H = 30, ROW_GAP = 6, INDENT = 22, GUTTER = 12;

  const branchById = new Map(data.branches.map(b => [b.id, b]));
  const columns = [];
  let maxBottom = 0;

  BRANCH_ORDER.forEach((bid, ci) => {
    const b = branchById.get(bid);
    const colX = ci * (COL_W + COL_GAP);
    const header = {
      id: b.id, ru: b.ru, en: b.en, heb: b.heb ?? '', ref: b.ref,
      gloss: b.gloss ?? '', region: b.region ?? '', messianic: !!b.messianic,
      x: colX, y: 0, w: COL_W, h: HEAD_H, count: countNodes(b.children),
    };

    // DFS pre-order: дети сразу за родителем → плоский список строк с глубиной
    const rows = [];
    const flatten = (node, depth, parentIdx) => {
      const idx = rows.length;
      const rowX = colX + depth * INDENT;
      const y = HEAD_H + HEAD_GAP + idx * (ROW_H + ROW_GAP);
      rows.push({
        id: node.id, ru: node.ru, en: node.en, ref: node.ref,
        ident: node.ident ?? null, identNote: node.identNote ?? null, disputed: !!node.disputed,
        kind: node.kind ?? 'nation', messianic: !!node.messianic,
        leadsToSpine: !!node.leadsToSpine, tipnrKey: node.tipnrKey ?? null,
        depth, parentIdx,
        x: rowX, y, w: COL_W - depth * INDENT, h: ROW_H,
        cx: rowX + (COL_W - depth * INDENT) / 2, cy: y + ROW_H / 2,
        branch: bid,
      });
      for (const c of node.children ?? []) flatten(c, depth + 1, idx);
    };
    for (const child of b.children) flatten(child, 0, -1);

    // направляющие-«уголки»: для каждого родителя — вертикаль в жёлобе + тики к детям
    const guides = [];
    const childrenOf = new Map();
    rows.forEach((r, i) => {
      if (r.parentIdx >= 0) {
        if (!childrenOf.has(r.parentIdx)) childrenOf.set(r.parentIdx, []);
        childrenOf.get(r.parentIdx).push(i);
      }
    });
    for (const [pi, kids] of childrenOf) {
      const p = rows[pi];
      const gx = p.x + GUTTER;
      const lastKid = rows[kids[kids.length - 1]];
      guides.push({ x1: gx, y1: p.y + p.h, x2: gx, y2: lastKid.cy, vertical: true, messianic: p.messianic });
      for (const ki of kids) {
        const k = rows[ki];
        guides.push({ x1: gx, y1: k.cy, x2: k.x, y2: k.cy, vertical: false, messianic: k.messianic });
      }
    }

    const bottom = rows.length ? rows[rows.length - 1].y + ROW_H : HEAD_H;
    maxBottom = Math.max(maxBottom, bottom);
    columns.push({ branch: bid, header, rows, guides });
  });

  const totalW = BRANCH_ORDER.length * COL_W + (BRANCH_ORDER.length - 1) * COL_GAP;
  // Ной — золотой якорь над центральной колонкой (Хам по центру ряда)
  const noahW = 240, noahH = 66;
  const noah = {
    ru: 'Ной', en: 'Noah', sub: 'три сына — три ветви народов',
    w: noahW, h: noahH,
    x: totalW / 2 - noahW / 2, y: -(noahH + 70),
    cx: totalW / 2, cy: -(noahH + 70) + noahH / 2,
  };

  const bbox = { x: 0, y: noah.y, w: totalW, h: maxBottom - noah.y };
  return {
    bbox, noah, columns,
    title: data._meta?.title ?? 'Таблица народов',
    subtitle: data._meta?.subtitle ?? '',
    meta: data._meta ?? {},
  };
}

function countNodes(children) {
  let n = 0;
  const walk = x => { n++; (x.children ?? []).forEach(walk); };
  (children ?? []).forEach(walk);
  return n;
}
