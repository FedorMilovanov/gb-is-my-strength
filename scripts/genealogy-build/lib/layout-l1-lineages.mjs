/**
 * layout-l1-lineages.mjs — колоночная развёртка «Матфей 1 / Лука 3» (L1, архетип 2).
 *
 * Две родословные Христа рядом (референс 07 «сравнение линий»): Давид сверху (общий
 * предок) → колонка Матфея (царская, юридическая линия Иосифа) слева и колонка Луки
 * (кровная, через Нафана к Марии) справа → сходятся ко Христу снизу. Отражены реальные
 * узлы из данных: обе линии проходят через Салафиила→Зоровавеля (схождение после
 * плена); Иехония (проклятие Иер 22:30, снятое в Зоровавеле Агг 2:23) — спорный узел.
 *
 * Ряды — курируемое представительное подмножество (длинные участки сжаты «…»), имена
 * сверены с трассировкой отцовской линии в data/genealogy/v2. Детерминированная геометрия.
 */

// Ряды сверху вниз. center — общий узел на оси; mt/lk — колонки; shared — общий узел
// обеих линий (Салафиил/Зоровавель); null в колонке — этого ряда в линии нет.
const ROWS = [
  { center: { name: 'Давид', ref: 'Руф 4:17', icon: 'crown', sub: 'общий предок' } },
  { mt: { name: 'Соломон', ref: '2Цар 5:14', icon: 'temple' }, lk: { name: 'Нафан', ref: '2Цар 5:14' } },
  { mt: { name: 'Ровоам', ref: '3Цар 11:43' }, lk: { name: 'Маттафа', ref: 'Лк 3:31' } },
  { mt: { name: 'цари Иудеи', ellipsis: true }, lk: { name: '…', ellipsis: true } },
  { mt: { name: 'Иехония', ref: 'Иер 22:30', disputed: true, note: 'проклятие' }, lk: null },
  { shared: { name: 'Салафиил', ref: '1Пар 3:17' } },
  { shared: { name: 'Зоровавель', ref: 'Агг 2:23', note: 'проклятие снято' } },
  { mt: { name: '…', ellipsis: true }, lk: { name: '…', ellipsis: true } },
  { mt: { name: 'Иаков', ref: 'Мф 1:15' }, lk: { name: 'Илий', ref: 'Лк 3:23' } },
  { mt: { name: 'Иосиф', ref: 'Мф 1:16', icon: 'person', sub: 'муж Марии' }, lk: { name: 'Мария', ref: 'Мф 1:16', icon: 'person', sub: 'Богородица' } },
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
    subtitle: 'Матфей — царская линия · Лука — кровная линия',
    nodes, bbox,
    notes: [
      'Матфей: Давид → Соломон → цари → Иосиф (юридическая).',
      'Лука: Давид → Нафан → … → Мария (кровная линия).',
      'Обе линии сходятся на Салафииле и Зоровавеле.',
      'Иехония: проклятие (Иер 22:30) снято в Зоровавеле (Агг 2:23).',
    ],
  };
}
