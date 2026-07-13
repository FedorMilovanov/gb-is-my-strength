/**
 * Series engine — обобщённый конфиг (план: «обобщить движок Гилла в конфиг»).
 *
 * Движок серий Гилла исторически хардкодил всё под Гилла (хлебные крошки
 * «Джон Гилл», римские марки, пул CBM-вопросов). Этот модуль выносит серия-
 * специфичные данные в конфиг, чтобы ОДИН движок обслуживал несколько серий.
 * Первый инстанс — Гилл, собранный из уже существующих gillSeriesData (без
 * дублирования и без изменения рендера).
 *
 * Контракт вёрстки НЕ меняется: обёртка по-прежнему несёт data-gill-v16={pageId}
 * и структуру .gbs2-* — вся CSS переиспользуется как есть (Гилл обязан остаться
 * пиксель-в-пиксель; parity проверяется на этапе миграции компонентов).
 */
import { GILL_LEARNING_QUIZ, type GillLearningQuizItem } from '../../gill-series/gillLearningData';
import {
  GILL_SERIES_ITEMS,
  GILL_PAGE_DATA,
  type GillSeriesMark,
  type GillPartTocItem,
} from '../../gill-series/gillSeriesData';

// Нейтральные типы движка: форма как у Гилла, но id — строка (id серии Гилла
// это узкий union; для новых серий (hard-texts…) нужен свободный string).
export type SeriesMark = GillSeriesMark;
export type SeriesPartTocItem = GillPartTocItem;

export interface SeriesItemRibbon {
  word: string;
  ornament: 'lily' | 'book';
  variant?: 'default' | 'reference';
}

export interface SeriesItem {
  id: string;
  mark: SeriesMark;
  title: string;
  shortTitle: string;
  href: string;
  readingTime: string;
  /** Leather-bookmark treatment for label rows (kind: 'label'). When absent,
   *  a series' own Rail component may fall back to its own hardcoded lookup
   *  (e.g. Gill's `leatherFor`) to stay byte-identical to its pre-engine render. */
  ribbon?: SeriesItemRibbon;
}

export interface SeriesPageChromeData {
  id: string;
  label: string;
  title: string;
  mobileSection: string;
  partLabel: string;
  readingProgressDoneMin: number;
  readingProgressPartMin: number;
  readingProgressTotalMin: number;
  railNowTitle: string;
  railCover: string;
  partDialogLabel: string;
  partToc: SeriesPartTocItem[];
}

export interface SeriesBreadcrumb {
  label: string;
  /** Относительно страницы статьи (/articles/<slug>/ = два уровня вглубь). */
  href: string;
}

export type SeriesQuizItem = GillLearningQuizItem;

export interface SeriesConfig {
  /** Идентификатор серии (совпадает с data/series.json). */
  seriesId: string;
  /** Короткое имя серии («Джон Гилл») — рельс, part-TOC. */
  seriesTitle: string;
  /** Полное имя («Джон Гилл (1697–1771)») — оверлей частей. */
  seriesTitleFull: string;
  /** Куда ведёт «Назад» рельса. */
  railBackHref: string;
  /** Необязательный визуальный «характер» серии. Ставится как
   *  data-series-theme на .gbs2-world и body; CSS-тема (напр.
   *  css/series-samizdat.css) переопределяет токены движка и добавляет
   *  атмосферу. Отсутствует у Гилла/Сердца = дефолтный вид. */
  theme?: string;
  /** Пул CBM-теста «Обучение»; пустой массив = вкладка «Тест» скрыта. */
  quiz: SeriesQuizItem[];
  /** Родительская крошка между «Главная» и текущей частью. */
  breadcrumbParent: SeriesBreadcrumb;
  /** Список частей серии (рельс, part-TOC, prev/next). */
  items: SeriesItem[];
  /** Данные обвязки на каждую страницу серии, ключ = pageId. */
  pages: Record<string, SeriesPageChromeData>;
}

/** Первый инстанс: Джон Гилл — собран из существующих gillSeriesData. */
export const GILL_SERIES: SeriesConfig = {
  seriesId: 'dzhon-gill',
  seriesTitle: 'Джон Гилл',
  seriesTitleFull: 'Джон Гилл (1697–1771)',
  railBackHref: '../../biografii/',
  quiz: GILL_LEARNING_QUIZ,
  breadcrumbParent: { label: 'Биографии служителей', href: '../../biografii/' },
  items: GILL_SERIES_ITEMS,
  pages: GILL_PAGE_DATA,
};

/** Реестр серий по seriesId — точка подключения новых серий движка. */
export const SERIES_CONFIGS: Record<string, SeriesConfig> = {
  [GILL_SERIES.seriesId]: GILL_SERIES,
};

export function seriesConfig(seriesId: string): SeriesConfig {
  const cfg = SERIES_CONFIGS[seriesId];
  if (!cfg) throw new Error(`Unknown series config: ${seriesId}`);
  return cfg;
}

export function seriesItem(cfg: SeriesConfig, pageId: string): SeriesItem {
  const item = cfg.items.find((entry) => entry.id === pageId);
  if (!item) throw new Error(`Unknown page id "${pageId}" in series "${cfg.seriesId}"`);
  return item;
}
