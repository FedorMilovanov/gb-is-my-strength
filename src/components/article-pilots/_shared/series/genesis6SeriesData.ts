export interface Genesis6SeriesItem {
  id: 'enoch' | 'angels' | 'spirits' | 'dead';
  roman: 'VI' | 'VII' | 'VIII' | 'IX';
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  minutes: number;
  cover: string;
  coverAvif: string;
  coverAlt: string;
}

export const GENESIS6_SERIES_ITEMS: readonly Genesis6SeriesItem[] = [
  {
    id: 'enoch',
    roman: 'VI',
    slug: 'enoh-prorochestvoval-iuda-14-15-4q204',
    title: 'Енох пророчествовал: Иуд. 14–15, 1 Енох 1:9 и 4Q204',
    shortTitle: 'Енох пророчествовал',
    description: 'Что именно утверждает Иуда, что физически сохранил 4Q204 и где заканчивается историческое доказательство.',
    minutes: 18,
    cover: '../../images/articles/genesis6/06-enoch-prophesied-and-apostolic-witness.webp',
    coverAvif: '../../images/articles/genesis6/06-enoch-prophesied-and-apostolic-witness.avif',
    coverAlt: 'Открытые древние книги и весы у арочного окна с солнечным пейзажем — пророчество Еноха и апостольское свидетельство.',
  },
  {
    id: 'angels',
    roman: 'VII',
    slug: 'angely-pod-mrakom-iuda-6-7-2-petra-2',
    title: 'Ангелы под мраком: Иуд. 6–7, 2 Петра 2 и Бытие 6',
    shortTitle: 'Ангелы под мраком',
    description: 'Почему Иуда и Пётр связывают падших ангелов, древний мир, потоп и окончательный суд.',
    minutes: 22,
    cover: '../../images/articles/genesis6/07-angels-kept-under-darkness.webp',
    coverAvif: '../../images/articles/genesis6/07-angels-kept-under-darkness.avif',
    coverAlt: 'Закованные ангелы в глубокой тьме под каменными сводами — ангелы, не сохранившие своего достоинства.',
  },
  {
    id: 'spirits',
    roman: 'VIII',
    slug: 'duhi-v-temnice-noi-kreshchenie-pobeda',
    title: 'Духи в темнице, Ной и крещение: 1 Петра 3:18–22',
    shortTitle: 'Духи в темнице',
    description: 'Кому Христос провозгласил победу, почему упомянут Ной и в каком смысле крещение спасает.',
    minutes: 25,
    cover: '../../images/articles/genesis6/08-spirits-in-prison.webp',
    coverAvif: '../../images/articles/genesis6/08-spirits-in-prison.avif',
    coverAlt: 'Сияющий Христос возвещает победу заключённым духам в мрачной темнице.',
  },
  {
    id: 'dead',
    roman: 'IX',
    slug: 'blagovestie-mertvym-1-petra-4-5-6',
    title: 'Благовестие мёртвым: что означает 1 Петра 4:5–6',
    shortTitle: 'Благовестие мёртвым',
    description: 'Кто такие «мёртвые», когда они услышали Евангелие и почему текст не учит посмертному обращению.',
    minutes: 17,
    cover: '../../images/articles/genesis6/09-gospel-preached-to-the-dead.webp',
    coverAvif: '../../images/articles/genesis6/09-gospel-preached-to-the-dead.avif',
    coverAlt: 'Проповедник возвещает Евангелие собранию людей, часть которых показана в тени — благовестие мёртвым.',
  },
] as const;

export const GENESIS6_TOTAL_MIN = GENESIS6_SERIES_ITEMS.reduce((sum, item) => sum + item.minutes, 0);
