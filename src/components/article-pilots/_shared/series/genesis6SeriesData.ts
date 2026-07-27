export interface Genesis6SeriesItem {
  id: 'enoch' | 'angels' | 'spirits' | 'dead';
  roman: 'VI' | 'VII' | 'VIII' | 'IX';
  slug: string;
  title: string;
  shortTitle: string;
  minutes: number;
  cover: string;
}

export const GENESIS6_SERIES_ITEMS: readonly Genesis6SeriesItem[] = [
  {
    id: 'enoch',
    roman: 'VI',
    slug: 'enoh-prorochestvoval-iuda-14-15-4q204',
    title: 'Енох пророчествовал: Иуд. 14–15, 1 Енох 1:9 и 4Q204',
    shortTitle: 'Енох пророчествовал',
    minutes: 18,
    cover: '../../images/articles/genesis6/06-enoch-prophesied-and-apostolic-witness.webp',
  },
  {
    id: 'angels',
    roman: 'VII',
    slug: 'angely-pod-mrakom-iuda-6-7-2-petra-2',
    title: 'Ангелы под мраком: Иуд. 6–7, 2 Петра 2 и Бытие 6',
    shortTitle: 'Ангелы под мраком',
    minutes: 22,
    cover: '../../images/articles/genesis6/07-angels-kept-under-darkness.webp',
  },
  {
    id: 'spirits',
    roman: 'VIII',
    slug: 'duhi-v-temnice-noi-kreshchenie-pobeda',
    title: 'Духи в темнице, Ной и крещение: 1 Петра 3:18–22',
    shortTitle: 'Духи в темнице',
    minutes: 25,
    cover: '../../images/articles/genesis6/08-spirits-in-prison.webp',
  },
  {
    id: 'dead',
    roman: 'IX',
    slug: 'blagovestie-mertvym-1-petra-4-5-6',
    title: 'Благовестие мёртвым: что означает 1 Петра 4:5–6',
    shortTitle: 'Благовестие мёртвым',
    minutes: 17,
    cover: '../../images/articles/genesis6/09-gospel-preached-to-the-dead.webp',
  },
] as const;

export const GENESIS6_TOTAL_MIN = GENESIS6_SERIES_ITEMS.reduce((sum, item) => sum + item.minutes, 0);
