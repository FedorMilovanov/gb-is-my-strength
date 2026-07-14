/**
 * heartSeriesData.ts — single source of truth for the «Тайны человеческого
 * сердца» (hard-texts) pilot series rail, mobile sheet and neighbour cards.
 *
 * Motivation (owner directive): stop hand-drawing every GBS pilot. The rail
 * order, roman numerals, series-progress minutes, «Часть N из M» meta, and the
 * prev/next neighbour cards are all a pure function of this one ordered array.
 * Reordering the series (e.g. moving «Новое сердце» after «Римлянам 7») is a
 * single swap of two entries here — the numerals, progress math and neighbour
 * links all follow automatically. No per-pilot markup edits.
 *
 * Two entry kinds:
 *   - kind:'roman'  → numbered part (I, II, III, IV). The numeral is DERIVED
 *     from the entry's position among roman entries, never stored, so a
 *     reorder renumbers everything for free.
 *   - kind:'label'  → un-numbered book-end (Пролог / Справочник), rendered with
 *     a leather ribbon bookmark instead of a numeral. Labels never count as a
 *     «часть» (Гиллов приём: «Часть N из M» counts only roman entries).
 */

export type HeartPageId =
  | 'prolog'
  | 'krajne'
  | 'novoe'
  | 'rimlyanam'
  | 'serdce-duh'
  | 'spravochnik';

export interface HeartSeriesItem {
  id: HeartPageId;
  /** Directory under /articles/ — used to build ../<slug>/ hrefs. */
  slug: string;
  kind: 'label' | 'roman';
  /** Reading time in minutes (integer). Series progress is the running sum. */
  minutes: number;
  /** Rail row (.gbs2-pt / .gbs2-ps). */
  railTitle: string;
  railSub: string;
  /** Mobile sheet row (.gbs2-sheet-part b/small). sheetTitle gets a roman
   *  prefix for roman entries; labels carry the full string verbatim. */
  sheetTitle: string;
  sheetSub: string;
  /** Rail/sheet thumbnail image (…-600w.webp basename) or null → the roman
   *  placeholder tile (labels ignore this — they render a ribbon). */
  thumbImg: string | null;
  /** Leather ribbon bookmark for label entries. */
  ribbon?: { word: string; ornament: 'lily' | 'book'; variant?: 'default' | 'reference' };
  /** Short mark shown in the rail .gbs2-pn prefix for labels («Пролог», «Справ.»). */
  labelMark?: string;
  /** #gbs2Meta text for a label page («Пролог» / «Справочник»). */
  metaLabel?: string;
  /** Neighbour card copy — only roman entries are ever rendered as a card. */
  cardTitle?: string;
  cardDesc?: string;
}

/**
 * ORDERED series. Reorder = move entries here; nothing else changes.
 * Current published order: Пролог → I Крайне → II Римлянам 7 → III Новое →
 * IV Закон духа → Справочник. («Новое сердце» стоит после «Римлянам 7»:
 * Рим 7 ставит диагноз (верующий/неверующий), новое сердце — Божий ответ,
 * затем его жизнь по Духу.)
 */
export const HEART_SERIES_ITEMS: HeartSeriesItem[] = [
  {
    id: 'prolog',
    slug: 'chto-bibliya-nazyvaet-serdcem',
    kind: 'label',
    minutes: 39,
    railTitle: 'Библейская кардиология',
    railSub: 'Что Библия называет сердцем',
    sheetTitle: 'Пролог · Библейская кардиология',
    sheetSub: 'Что Библия называет сердцем',
    thumbImg: null,
    ribbon: { word: 'Пролог', ornament: 'lily' },
    labelMark: 'Пролог',
    metaLabel: 'Пролог',
  },
  {
    id: 'krajne',
    slug: 'krajne-li-isporcheno-serdce',
    kind: 'roman',
    minutes: 41,
    railTitle: 'Испорчено ли сердце?',
    railSub: 'Иеремия 17',
    sheetTitle: 'Испорчено ли сердце верующего?',
    sheetSub: 'Иеремия 17',
    thumbImg: null,
    cardTitle: 'Крайне ли испорчено сердце верующего?',
    cardDesc: 'Иеремия 17: исторический фон, два образа доверия и диагноз сердца, который нельзя выносить за скобки Евангелия.',
  },
  {
    id: 'rimlyanam',
    slug: 'rimlyanam-7-veruyushchiy-ili-neveruyushchiy',
    kind: 'roman',
    minutes: 45,
    railTitle: 'Римлянам 7',
    railSub: 'Верующий или нет?',
    sheetTitle: 'Римлянам 7',
    sheetSub: 'Верующий или неверующий?',
    thumbImg: null,
    cardTitle: 'Римлянам 7: верующий, неверующий или человек под законом?',
    cardDesc: 'Три главные позиции, Ллойд-Джонс, TMSJ и пастырский вывод о войне внутри христианина.',
  },
  {
    id: 'novoe',
    slug: 'novoe-serdce',
    kind: 'roman',
    minutes: 38,
    railTitle: 'Новое сердце',
    railSub: 'Иез. 36',
    sheetTitle: 'Новое сердце',
    sheetSub: 'Иезекииль 36',
    thumbImg: null,
    cardTitle: 'Новое сердце: замена, а не ремонт',
    cardDesc: 'Возрождение — не ремонт старого, а новое рождение: «дам вам сердце новое» (Иез. 36:26). Фундамент всей серии.',
  },
  {
    id: 'serdce-duh',
    slug: 'serdce-i-duh',
    kind: 'roman',
    minutes: 42,
    railTitle: 'Закон духа жизни',
    railSub: 'Римлянам 8',
    sheetTitle: 'Закон духа жизни',
    sheetSub: 'Римлянам 8',
    thumbImg: null,
    cardTitle: 'Закон духа жизни: Римлянам 8',
    cardDesc: 'Финал доктринального фундамента — освобождение от закона греха и смерти Духом жизни во Христе.',
  },
  {
    id: 'spravochnik',
    slug: 'serdce-spravochnik',
    kind: 'label',
    minutes: 23,
    railTitle: 'Справочник',
    railSub: 'Индекс, словарь, цитаты',
    sheetTitle: 'Справочник',
    sheetSub: 'Индекс, словарь, цитаты',
    thumbImg: null,
    ribbon: { word: 'Справочник', ornament: 'book', variant: 'reference' },
    labelMark: 'Справ.',
    metaLabel: 'Справочник',
  },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Roman entries in series order. */
export const HEART_ROMAN_ITEMS = HEART_SERIES_ITEMS.filter((i) => i.kind === 'roman');

export function heartItem(pageId: HeartPageId): HeartSeriesItem {
  const item = HEART_SERIES_ITEMS.find((i) => i.id === pageId);
  if (!item) throw new Error(`Unknown heart page id: ${pageId}`);
  return item;
}

export function heartIndex(pageId: HeartPageId): number {
  return HEART_SERIES_ITEMS.findIndex((i) => i.id === pageId);
}

/** Derived roman numeral for a roman entry (position among roman entries). */
export function heartRoman(pageId: HeartPageId): string {
  const r = HEART_ROMAN_ITEMS.findIndex((i) => i.id === pageId);
  return r >= 0 ? ROMAN[r] : '';
}

/** The .gbs2-pn / neighbour prefix mark: roman numeral or label short mark. */
export function heartMark(item: HeartSeriesItem): string {
  return item.kind === 'roman' ? heartRoman(item.id) : (item.labelMark ?? '');
}

/** Total series minutes (progress denominator). */
export const HEART_TOTAL_MIN = HEART_SERIES_ITEMS.reduce((s, i) => s + i.minutes, 0);

/** Series reading-progress attributes for the page wrapper. done = running sum
 *  of everything before this entry; part = this entry; total = whole series. */
export function heartProgress(pageId: HeartPageId): { doneMin: number; partMin: number; totalMin: number } {
  const idx = heartIndex(pageId);
  const doneMin = HEART_SERIES_ITEMS.slice(0, Math.max(0, idx)).reduce((s, i) => s + i.minutes, 0);
  return { doneMin, partMin: HEART_SERIES_ITEMS[idx].minutes, totalMin: HEART_TOTAL_MIN };
}

/** #gbs2Meta text: «Часть N из M» for roman pages, own label for label pages. */
export function heartSeriesMeta(pageId: HeartPageId): string {
  const item = heartItem(pageId);
  if (item.kind === 'label') return item.metaLabel ?? '';
  const r = HEART_ROMAN_ITEMS.findIndex((i) => i.id === pageId);
  return `Часть ${r + 1} из ${HEART_ROMAN_ITEMS.length}`;
}

export interface HeartNeighbor {
  dir: 'prev' | 'next';
  item: HeartSeriesItem;
  /** Eyebrow N-fragment: «N из M» when current is a roman page, «Часть R» when
   *  current is a label book-end. */
  eyebrowN: string;
}

/**
 * Neighbour cards. Roman pages chain among roman entries only (I↔II↔III↔IV);
 * the label book-ends link inward to the nearest roman («Часть I» / «Часть IV»).
 */
export function heartNeighbors(pageId: HeartPageId): HeartNeighbor[] {
  const item = heartItem(pageId);
  const R = HEART_ROMAN_ITEMS.length;
  const out: HeartNeighbor[] = [];
  if (item.kind === 'roman') {
    const r = HEART_ROMAN_ITEMS.findIndex((i) => i.id === pageId);
    if (r > 0) out.push({ dir: 'prev', item: HEART_ROMAN_ITEMS[r - 1], eyebrowN: `${r} из ${R}` });
    if (r < R - 1) out.push({ dir: 'next', item: HEART_ROMAN_ITEMS[r + 1], eyebrowN: `${r + 2} из ${R}` });
  } else {
    // Label book-end: prologue is first (links forward to roman I), spravochnik
    // is last (links back to roman IV). Determine side by series position.
    const idx = heartIndex(pageId);
    const firstRomanIdx = HEART_SERIES_ITEMS.findIndex((i) => i.kind === 'roman');
    if (idx < firstRomanIdx) {
      const nb = HEART_ROMAN_ITEMS[0];
      out.push({ dir: 'next', item: nb, eyebrowN: `Часть ${heartRoman(nb.id)}` });
    } else {
      const nb = HEART_ROMAN_ITEMS[R - 1];
      out.push({ dir: 'prev', item: nb, eyebrowN: `Часть ${heartRoman(nb.id)}` });
    }
  }
  return out;
}
