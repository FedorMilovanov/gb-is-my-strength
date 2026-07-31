/**
 * Public book composition for «Баптисты России».
 *
 * The full page chrome data and the original flat publication inventory remain
 * in baptistFlatSeriesConfig.ts. This module is the public source of truth for
 * the reader: four book chapters group the nine already published historical
 * articles, while the source reference remains an endpaper. No route, reading
 * time or article body is duplicated here.
 */
import {
  SERIES_CONFIGS,
  type SeriesConfig,
  type SeriesItem,
  defineSeriesConfig,
} from './seriesConfig';
import { BAPTIST_SERIES as BAPTIST_FLAT_SERIES } from './baptistFlatSeriesConfig';

interface BaptistBookChapter {
  id: string;
  roman: string;
  title: string;
  shortTitle: string;
  articleIds: readonly string[];
}

const BOOK_CHAPTERS: readonly BaptistBookChapter[] = [
  {
    id: 'origins-and-first-brotherhood',
    roman: 'I',
    title: 'Почва и рождение братства',
    shortTitle: '1867–1884 · Тифлис, юг и первые союзы',
    articleIds: ['noch-na-kure', 'yuzhnaya-shtunda', 'dva-sezda-1884'],
  },
  {
    id: 'networks-unions-and-conscience',
    roman: 'II',
    title: 'Сети, союзы и совесть',
    shortTitle: '1874–1929 · Петербург, Проханов и военный вопрос',
    articleIds: ['peterburgskaya-liniya', 'goneniya-i-sovest'],
  },
  {
    id: 'soviet-night-and-one-union',
    roman: 'III',
    title: 'Советская ночь и один союз',
    shortTitle: '1929–1945 · Разгром, война и ВСЕХиБ',
    articleIds: ['sovetskaya-noch', 'vsehib-1944'],
  },
  {
    id: 'conscience-split-and-underground-memory',
    roman: 'IV',
    title: 'Разлом совести и подпольная память',
    shortTitle: '1960–1991 · Совет Церквей, узники и самиздат',
    articleIds: ['iniciativnaya-gruppa', 'podpolnaya-pechat'],
  },
];

function requireFlatItem(id: string): SeriesItem {
  const item = BAPTIST_FLAT_SERIES.items.find((entry) => entry.id === id);
  if (!item) throw new Error(`[baptists-book] Missing published item: ${id}`);
  return item;
}

function minutesOf(id: string): number {
  const minutes = Number.parseInt(requireFlatItem(id).readingTime, 10);
  if (!Number.isFinite(minutes)) throw new Error(`[baptists-book] Invalid reading time: ${id}`);
  return minutes;
}

const bookItems: SeriesItem[] = BOOK_CHAPTERS.flatMap((chapter) => {
  const firstArticle = requireFlatItem(chapter.articleIds[0]);
  const chapterMinutes = chapter.articleIds.reduce((sum, id) => sum + minutesOf(id), 0);
  const chapterItem: SeriesItem = {
    id: chapter.id,
    mark: { kind: 'roman', value: chapter.roman },
    title: chapter.title,
    shortTitle: chapter.shortTitle,
    href: firstArticle.href,
    readingTime: `${chapter.articleIds.length} статьи · ${chapterMinutes} мин`,
    tier: 'chapter',
  };

  const articleItems = chapter.articleIds.map((id, index): SeriesItem => {
    const flatItem = requireFlatItem(id);
    const page = BAPTIST_FLAT_SERIES.pages[id];
    if (!page) throw new Error(`[baptists-book] Missing page chrome data: ${id}`);
    return {
      ...flatItem,
      mark: { kind: 'arabic', value: String(index + 1) },
      title: page.title,
      tier: 'core',
      parent: chapter.id,
    };
  });

  return [chapterItem, ...articleItems];
});

bookItems.push(requireFlatItem('spravochnik'));

export const BAPTIST_SERIES: SeriesConfig = defineSeriesConfig({
  ...BAPTIST_FLAT_SERIES,
  seriesId: 'russian-baptism',
  seriesTitleFull: 'Баптисты России · История ЕХБ — книга статей',
  shape: 'book',
  items: bookItems,
});

// The base module registers its flat witness first; the public book composition
// deliberately replaces that registry entry after successful validation.
SERIES_CONFIGS[BAPTIST_SERIES.seriesId] = BAPTIST_SERIES;
