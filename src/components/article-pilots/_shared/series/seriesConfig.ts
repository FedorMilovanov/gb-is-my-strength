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
//
// МОДЕЛЬ МАРОК (все ярусы НЕОБЯЗАТЕЛЬНЫ кроме roman):
//  - 'roman'  — нумерованная часть серии (I, II, III…) ИЛИ, в книжной серии,
//               ГЛАВА (tier: 'chapter'). Входит в счёт «Часть/Глава N из M».
//  - 'label'  — форзац с вертикальным словом (Введение/Справочник/Пролог/
//               что угодно — value свободный текст). Серия может иметь 0, 1
//               или несколько форзацев, в любых позициях.
//  - 'letter' — СПУТНИК: дополнительный материал яруса ниже части (Движение А,
//               Экскурс Б…). Не входит в счёт частей и в prev/next; в рельсе
//               десктопа не показывается; живёт в аккордеоне «Оглавление
//               части» под своей родительской частью (item.parent).
//  - 'arabic' — СТАТЬЯ ГЛАВЫ (книжная серия): обычная цифра 1, 2, 3… внутри
//               своей главы (parent = id главы). Полноценная статья.
//
// КНИЖНАЯ СЕРИЯ (владелец 2026-07-15): «римские цифры — просто названия глав,
// а не статьи; внутри они раскрываются, как submenu, и там уже 1, 2, 3, 4
// обычными цифрами статьи. Как в книге». Кодируется так:
//   { id:'ch1', tier:'chapter', mark:{kind:'roman',value:'I'}, title:'Глава…',
//     href: <ссылка на первую статью главы>, readingTime:'6 статей' }
//   { id:'art', mark:{kind:'arabic',value:'1'}, parent:'ch1', … }  ← статья
// Глава — НЕ страница (для неё нет pages[id]); плоские серии (Гилл: просто
// римские статьи) не меняются вовсе — рендер ветвится по наличию глав.
export type SeriesMark = { kind: 'label' | 'roman' | 'letter' | 'arabic'; value: string };
export type SeriesPartTocItem = GillPartTocItem;
// Совместимость: узкий GillSeriesMark ('label'|'roman') присваивается SeriesMark.
const _gillMarkCompat: SeriesMark = { kind: 'roman', value: 'I' } satisfies GillSeriesMark as SeriesMark;
void _gillMarkCompat;

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
  /** Ярус материала. 'satellite' — спутник части (mark.kind: 'letter',
   *  обязателен parent). 'chapter' — ГЛАВА книжной серии: заголовок-группа,
   *  не статья (mark.kind: 'roman', href → первая статья главы, pages[id]
   *  для неё не создаётся). По умолчанию 'core'. */
  tier?: 'core' | 'satellite' | 'chapter';
  /** Для спутников: id родительской части (roman/label). Для статей главы
   *  (mark.kind: 'arabic'): id своей главы (tier: 'chapter'). */
  parent?: string;
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
  /** Форма серии (референс GBS_ENGINE_RESEARCH_2026-07-15: «книга — не
   *  четвёртый engine, это series.shape='book'»). 'book' — главы (tier
   *  'chapter') со статьями (mark 'arabic'); 'flat' (дефолт) — обычные части.
   *  Поле не дублирует данные — делает ветвление декларативным и проверяемым:
   *  валидатор не даст объявить главы в плоской серии и наоборот. */
  shape?: 'flat' | 'book';
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

/**
 * defineSeriesConfig — ЕДИНСТВЕННЫЙ правильный способ объявить конфиг серии.
 *
 * Валидирует инварианты движка НА СБОРКЕ: невалидный конфиг = красный
 * `astro build` с русским сообщением, что именно поправить. Это страховка
 * для будущих агентов и для смен дизайна: движок не может «тихо натупить»
 * на одной из серий — он честно падает с адресной ошибкой.
 *
 * Полный гид по добавлению статей/серий/спутников: docs/SERIES-ENGINE-GUIDE.md
 */
export function defineSeriesConfig(cfg: SeriesConfig): SeriesConfig {
  // Явная аннотация типа константы обязательна: с выведённым типом TS не
  // применяет never-narrowing после вызова (microsoft/TypeScript#33622), и
  // strict-гейт astro check падал на «'p' is possibly 'undefined'» ниже.
  const fail: (msg: string) => never = (msg) => {
    throw new Error(
      `[series-engine] Конфиг серии «${cfg.seriesId || '?'}» невалиден: ${msg}\n` +
      `→ Правила и примеры: docs/SERIES-ENGINE-GUIDE.md`);
  };
  if (!cfg.seriesId) fail('пустой seriesId');
  if (!cfg.seriesTitle || !cfg.seriesTitleFull) fail('пустой seriesTitle/seriesTitleFull');
  if (!cfg.railBackHref) fail('пустой railBackHref (куда ведёт «Назад» рельса)');
  if (!cfg.breadcrumbParent?.label || !cfg.breadcrumbParent?.href) fail('breadcrumbParent без label/href');
  if (!Array.isArray(cfg.items) || cfg.items.length === 0) fail('items пуст — серия без частей');

  const ids = new Set<string>();
  const ROMAN = /^[IVXLC]+$/;
  const ARABIC = /^\d+$/;
  for (const it of cfg.items) {
    if (!it.id) fail('item без id');
    if (ids.has(it.id)) fail(`дубль item.id «${it.id}»`);
    ids.add(it.id);
    if (!it.title || !it.href || !it.readingTime) fail(`item «${it.id}»: нужен title, href и readingTime`);
    const k = it.mark?.kind;
    if (k !== 'roman' && k !== 'label' && k !== 'letter' && k !== 'arabic') fail(`item «${it.id}»: mark.kind должен быть roman|label|letter|arabic`);
    if (!it.mark.value) fail(`item «${it.id}»: пустой mark.value`);
    if (k === 'roman' && !ROMAN.test(it.mark.value)) fail(`item «${it.id}»: mark.value «${it.mark.value}» — не римская цифра`);
    const isSat = it.tier === 'satellite';
    const isChap = it.tier === 'chapter';
    if (isSat && k !== 'letter') fail(`спутник «${it.id}» обязан иметь mark.kind: 'letter' (буква А/Б/В…)`);
    if (k === 'letter' && !isSat) fail(`item «${it.id}» с mark.kind 'letter' обязан иметь tier: 'satellite'`);
    if (isSat && !it.parent) fail(`спутник «${it.id}»: нужен parent — id родительской части`);
    if (isChap && k !== 'roman') fail(`глава «${it.id}» обязана иметь mark.kind: 'roman' (номер главы I/II/III…)`);
    if (isChap && it.parent) fail(`глава «${it.id}»: главы не вкладываются (parent запрещён)`);
    if (k === 'arabic' && !ARABIC.test(it.mark.value)) fail(`статья главы «${it.id}»: mark.value «${it.mark.value}» — не арабская цифра`);
    if (k === 'arabic' && !it.parent) fail(`статья главы «${it.id}» (mark 'arabic'): нужен parent — id главы`);
    if (k === 'arabic' && (isSat || isChap)) fail(`статья главы «${it.id}»: tier должен быть 'core'`);
    if (!isSat && k !== 'arabic' && it.parent) fail(`item «${it.id}»: parent разрешён спутникам и статьям глав (mark 'arabic')`);
  }
  for (const it of cfg.items) {
    if (it.tier === 'satellite') {
      const p = cfg.items.find((x) => x.id === it.parent);
      if (!p) fail(`спутник «${it.id}»: parent «${it.parent}» не найден среди items`);
      if (p.tier === 'satellite') fail(`спутник «${it.id}»: parent «${it.parent}» сам спутник — вложенность запрещена`);
      if (p.tier === 'chapter') fail(`спутник «${it.id}»: parent «${it.parent}» — глава; спутник крепится к странице, статьи главы нумеруйте mark 'arabic'`);
    }
    if (it.mark.kind === 'arabic') {
      const p = cfg.items.find((x) => x.id === it.parent);
      if (!p) fail(`статья главы «${it.id}»: parent «${it.parent}» не найден среди items`);
      if (p.tier !== 'chapter') fail(`статья главы «${it.id}»: parent «${it.parent}» — не глава (tier: 'chapter')`);
    }
    if (it.tier === 'chapter') {
      if (!cfg.items.some((x) => x.mark.kind === 'arabic' && x.parent === it.id)) fail(`глава «${it.id}» пуста — нужна хотя бы одна статья (mark 'arabic', parent: '${it.id}')`);
      if (cfg.pages[it.id]) fail(`глава «${it.id}» — заголовок, не страница: pages["${it.id}"] быть не должно`);
      // Номера статей главы обязаны идти подряд 1, 2, 3… в объявленном порядке.
      const nums = cfg.items.filter((x) => x.mark.kind === 'arabic' && x.parent === it.id).map((x) => x.mark.value);
      nums.forEach((v, i) => { if (v !== String(i + 1)) fail(`глава «${it.id}»: номера статей должны идти подряд (ожидалась «${i + 1}», найдена «${v}»)`); });
    }
    if (it.mark.kind === 'arabic' && !cfg.pages[it.id]) fail(`статья главы «${it.id}»: нет pages["${it.id}"] (partToc обязателен)`);
  }
  // shape ↔ данные: книга обязана иметь главы, плоская — не иметь.
  const hasChapters = cfg.items.some((x) => x.tier === 'chapter');
  if (cfg.shape === 'book' && !hasChapters) fail(`shape: 'book', но глав (tier 'chapter') нет`);
  if (cfg.shape !== 'book' && hasChapters) fail(`есть главы (tier 'chapter'), но серия не объявлена книгой — добавьте shape: 'book'`);
  for (const [pageId, page] of Object.entries(cfg.pages)) {
    if (!ids.has(pageId)) fail(`pages["${pageId}"] не соответствует ни одному item.id`);
    if (!Array.isArray(page.partToc) || page.partToc.length === 0) fail(`pages["${pageId}"]: пустой partToc (H2/H3 статьи)`);
    for (const row of page.partToc) {
      if (!row.href?.startsWith('#')) fail(`pages["${pageId}"] partToc: href «${row.href}» должен быть #якорем`);
      if (!row.label) fail(`pages["${pageId}"] partToc: строка без label`);
    }
  }
  if (cfg.theme && !/^[a-z][a-z0-9-]*$/.test(cfg.theme)) fail(`theme «${cfg.theme}» — только [a-z0-9-]; CSS-файл: css/series-<theme>.css`);
  return cfg;
}

/** Спутники части: для аккордеона «Оглавление части». */
export function satellitesOf(cfg: SeriesConfig, parentId: string): SeriesItem[] {
  return cfg.items.filter((it) => it.tier === 'satellite' && it.parent === parentId);
}

/** Ядро серии (без спутников): рельс, лист «Части серии», prev/next. */
export function coreItems(cfg: SeriesConfig): SeriesItem[] {
  return cfg.items.filter((it) => it.tier !== 'satellite');
}

/** Книжная ли серия (валидатор гарантирует shape ↔ наличие глав). */
export function isBookSeries(cfg: SeriesConfig): boolean {
  return cfg.shape === 'book';
}

/** Верхний уровень серии: главы + форзацы + плоские части — то, что видно
 *  строками в рельсе и листе «Части серии». Статьи глав и спутники вложены. */
export function topLevelItems(cfg: SeriesConfig): SeriesItem[] {
  return cfg.items.filter((it) => it.tier !== 'satellite' && !it.parent);
}

/** Статьи главы (mark 'arabic') в объявленном порядке. */
export function chapterArticles(cfg: SeriesConfig, chapterId: string): SeriesItem[] {
  return cfg.items.filter((it) => it.mark.kind === 'arabic' && it.parent === chapterId);
}

/** Глава, содержащая страницу (для статей глав), иначе null. */
export function chapterOf(cfg: SeriesConfig, pageId: string): SeriesItem | null {
  const it = cfg.items.find((x) => x.id === pageId);
  if (!it || it.mark.kind !== 'arabic' || !it.parent) return null;
  return cfg.items.find((x) => x.id === it.parent && x.tier === 'chapter') ?? null;
}

/** Первый инстанс: Джон Гилл — собран из существующих gillSeriesData. */
export const GILL_SERIES: SeriesConfig = defineSeriesConfig({
  seriesId: 'dzhon-gill',
  seriesTitle: 'Джон Гилл',
  seriesTitleFull: 'Джон Гилл (1697–1771)',
  railBackHref: '../../biografii/',
  quiz: GILL_LEARNING_QUIZ,
  breadcrumbParent: { label: 'Биографии служителей', href: '../../biografii/' },
  items: GILL_SERIES_ITEMS,
  pages: GILL_PAGE_DATA,
});

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
