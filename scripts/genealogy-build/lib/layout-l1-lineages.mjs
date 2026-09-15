/**
 * layout-l1-lineages.mjs — колоночная развёртка «Матфей 1 / Лука 3» (L1, архетип 2).
 *
 * Две текстовые последовательности показаны рядом для сравнения. Давид — общий
 * исторический предок обеих евангельских последовательностей. Совпадение имён
 * Салафиил/Зоровавель само по себе НЕ склеивает occurrences в одну персону, а Мария
 * не вставляется в последовательность Лк 3:23–38, где назван Иосиф.
 *
 * Ряды — курируемое представительное подмножество (длинные участки сжаты «…»).
 * Это обзор текста, а не автоматическая гармонизация родительского графа.
 */

// Ряды сверху вниз. center — общий узел на оси; mt/lk — отдельные текстовые колонки.
// null в колонке означает отсутствие representative card в этом ряду.
const ROWS = [
  { center: { name: 'Давид', ref: 'Руф 4:17', icon: 'crown', sub: 'общий предок' } },
  { mt: { name: 'Соломон', ref: '2Цар 5:14', icon: 'temple' }, lk: { name: 'Нафан', ref: '2Цар 5:14' } },
  { mt: { name: 'Ровоам', ref: '3Цар 11:43' }, lk: { name: 'Маттафа', ref: 'Лк 3:31' } },
  { mt: { name: 'цари Иудеи', ellipsis: true }, lk: { name: '…', ellipsis: true } },
  { mt: { name: 'Иехония', ref: 'Иер 22:30', disputed: true, note: 'проклятие' }, lk: null },
  {
    mt: { name: 'Салафиил', ref: 'Мф 1:12', disputed: true, note: 'тождество с Лк не предполагается' },
    lk: { name: 'Салафиил', ref: 'Лк 3:27', disputed: true, note: 'отдельное occurrence Лк' },
  },
  {
    mt: { name: 'Зоровавель', ref: 'Мф 1:12', disputed: true, note: 'тождество с Лк не предполагается' },
    lk: { name: 'Зоровавель', ref: 'Лк 3:27', disputed: true, note: 'отдельное occurrence Лк' },
  },
  { mt: { name: '…', ellipsis: true }, lk: { name: '…', ellipsis: true } },
  { mt: { name: 'Иаков', ref: 'Мф 1:15' }, lk: { name: 'Илий', ref: 'Лк 3:23' } },
  {
    mt: { name: 'Иосиф', ref: 'Мф 1:16', icon: 'person', sub: 'муж Марии' },
    lk: { name: 'Иосиф', ref: 'Лк 3:23', icon: 'person', sub: '«как думали» отец Иисуса' },
  },
  { center: { name: 'Иисус Христос', ref: 'Мф 1:1', icon: 'cross', messiah: true, sub: 'Мессия' } },
];

const G = { colGap: 300, cardW: 176, cardH: 58, rowH: 92, centerW: 210, centerH: 70 };

export function buildMatthewLuke() {
  const nodes = [];
  let y = 0;
  const mtX = -G.colGap - G.cardW / 2, lkX = G.colGap - G.cardW / 2;
  ROWS.forEach((row, i) => {
    if (row.center || row.shared) {
      const d = row.center ?? row.shared;
      const w = row.center ? G.centerW : G.cardW + 40, h = row.center ? G.centerH : G.cardH;
      nodes.push({ ...d, kind: row.center ? 'center' : 'shared', row: i,
        x: -w / 2, y: y - h / 2, w, h });
    } else {
      if (row.mt) nodes.push({ ...row.mt, kind: 'mt', row: i, x: mtX, y: y - G.cardH / 2, w: G.cardW, h: G.cardH });
      if (row.lk) nodes.push({ ...row.lk, kind: 'lk', row: i, x: lkX, y: y - G.cardH / 2, w: G.cardW, h: G.cardH });
    }
    y += row.center ? G.rowH + 24 : G.rowH;
  });

  const totalH = y;
  const bbox = { x: mtX - 60, y: -G.centerH, w: (G.colGap + G.cardW / 2 + 60) * 2, h: totalH + 20 };
  return {
    _status: 'phase1-draft: L1 колоночная развёртка «Матфей 1 / Лука 3». Вход движка Phase 3.',
    clusterId: 'matthew-luke',
    title: 'Две родословные Христа',
    subtitle: 'Матфей 1 · Лука 3 — текстовые последовательности',
    nodes, bbox,
    notes: [
      'Матфей: Давид → Соломон → цари → Иосиф → Христос.',
      'Лука: Давид → Нафан → … → Илий → Иосиф → Христос; Мария не вставляется в текст Лк 3.',
      'Салафиил и Зоровавель встречаются в обеих последовательностях, но одинаковое имя не доказывает тождество occurrences.',
      'Гармонизационные модели показываются отдельным interpretation overlay и не подменяют текстовые последовательности.',
    ],
  };
}
