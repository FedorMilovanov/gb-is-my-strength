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
  /** Дополнительные внутритекстовые #якоря статьи, на которые вправе ссылаться
   *  quiz.sourceHref помимо разделов partToc. */
  quizSourceAnchors?: string[];
}

export interface SeriesBreadcrumb {
  label: string;
  /** Относительно страницы статьи (/articles/<slug>/ = два уровня вглубь). */
  href: string;
}

export type SeriesQuizItem<PageId extends string = string> = Omit<GillLearningQuizItem, 'relatedPageId'> & {
  relatedPageId?: PageId;
};

export type SeriesExtensionPolicy = 'open' | 'locked' | 'owner-review';

export interface SeriesLockedCounts {
  coreItems: number;
  companionItems?: number;
}

export interface SeriesQuizPolicy<PageId extends string = string> {
  /** Минимальное число локальных вопросов на страницу по умолчанию (без фоллбэка). */
  minPerPage: number;
  /** Обязан ли каждый вопрос явно указывать relatedPageId (по умолчанию true). */
  requireRelatedPageId?: boolean;
  /** Явный список страниц, где вместо локального пула показывается общий пул
   *  серии (с точным ожидаемым числом локальных вопросов этой страницы, чтобы
   *  опечатка в relatedPageId никогда не проходила тихо). */
  fullPoolFallbackPages?: Partial<Record<PageId, number>>;
}

export interface SeriesConfig<PageId extends string = string> {
  /** Идентификатор серии (совпадает с data/series.json). */
  seriesId: string;
  /** Короткое имя серии («Джон Гилл») — рельс, part-TOC. */
  seriesTitle: string;
  /** Полное имя («Джон Гилл (1697–1771)») — оверлей частей. */
  seriesTitleFull: string;
  /** Куда ведёт «Назад» рельса. */
  railBackHref: string;
  /** Политика расширения серии (по умолчанию 'owner-review'). Для 'locked'
   *  обязателен lockedCounts — попытка добавить/удалить часть упадёт на сборке. */
  extensionPolicy?: SeriesExtensionPolicy;
  /** Зафиксированный объём закрытой серии (extensionPolicy: 'locked'). */
  lockedCounts?: SeriesLockedCounts;
  /** Форма серии (референс GBS_ENGINE_RESEARCH_2026-07-15: «книга — не
   *  четвёртый engine, это series.shape='book'»). 'book' — главы (tier
   *  'chapter') со статьями (mark 'arabic'); 'flat' (дефолт) — обычные части.
   *  Поле не дублирует данные — делает ветвление декларативным и проверяемым:
   *  валидатор не даст объявить главы в плоской серии и наоборот. */
  shape?: 'flat' | 'book';
  /** Явная линейная core-последовательность. Обычно `label`-марки означают
   *  форзацы (Введение/Справочник) и не входят в счёт частей. Но серия может
   *  объявить КАЖДЫЙ верхнеуровневый материал равноправным шагом: тогда
   *  `label` остаётся буквенной маркой, а прогресс считается по всем items
   *  подряд («Шаг 4 из 7»), а не только по римским. Валидатор запрещает
   *  смешивать этот режим с книгой, спутниками и вложенными статьями. */
  coreSequence?: { stepLabel: string };
  /** Необязательный визуальный «характер» серии. Ставится как
   *  data-series-theme на .gbs2-world и body; CSS-тема (напр.
   *  css/series-samizdat.css) переопределяет токены движка и добавляет
   *  атмосферу. Отсутствует у Гилла/Сердца = дефолтный вид. */
  theme?: string;
  /** Пул CBM-теста «Обучение»; пустой массив = вкладка «Тест» скрыта. */
  quiz: SeriesQuizItem<PageId>[];
  /** Политика минимального наполнения и фоллбэка пула вопросов по страницам. */
  quizPolicy?: SeriesQuizPolicy<PageId>;
  /** Родительская крошка между «Главная» и текущей частью. */
  breadcrumbParent: SeriesBreadcrumb;
  /** Список частей серии (рельс, part-TOC, prev/next). */
  items: SeriesItem[];
  /** Данные обвязки на каждую страницу серии, ключ = pageId. */
  pages: Record<PageId, SeriesPageChromeData>;
}

const VALID_QUIZ_CATEGORIES = new Set([
  'people',
  'dates',
  'places',
  'works',
  'theology',
  'method',
  'sources',
]);

function canonicalSeriesPathname(rawHref: string): string {
  const u = new URL(rawHref, 'https://gospod-bog.ru/articles/_current_/');
  const p = u.pathname.replace(/\/{2,}/g, '/');
  return p.length > 1 && !p.endsWith('/') ? `${p}/` : p;
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
export function defineSeriesConfig<PageId extends string = string>(cfg: SeriesConfig<PageId>): SeriesConfig {
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

  const extPolicy: SeriesExtensionPolicy = cfg.extensionPolicy ?? 'owner-review';
  if (extPolicy !== 'open' && extPolicy !== 'locked' && extPolicy !== 'owner-review') {
    fail(`extensionPolicy «${String(extPolicy)}» должен быть open|locked|owner-review`);
  }
  if (extPolicy === 'locked' && !cfg.lockedCounts) {
    fail(`extensionPolicy: 'locked' требует lockedCounts`);
  }

  const pagesMap = cfg.pages as Record<string, SeriesPageChromeData | undefined>;
  const ids = new Set<string>();
  const nonChapterHrefOwners = new Map<string, string>();
  const itemByPathname = new Map<string, SeriesItem>();
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

    if (!isChap) {
      let normPath = '';
      try {
        normPath = canonicalSeriesPathname(it.href);
      } catch {
        fail(`item «${it.id}»: некорректный href «${it.href}»`);
      }
      const prevOwner = nonChapterHrefOwners.get(normPath);
      if (prevOwner) {
        fail(`item «${it.id}»: дублирующийся href «${it.href}» (уже принадлежит «${prevOwner}»)`);
      }
      nonChapterHrefOwners.set(normPath, it.id);
      itemByPathname.set(normPath, it);
    }
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
      if (pagesMap[it.id]) fail(`глава «${it.id}» — заголовок, не страница: pages["${it.id}"] быть не должно`);
      // Номера статей главы обязаны идти подряд 1, 2, 3… в объявленном порядке.
      const nums = cfg.items.filter((x) => x.mark.kind === 'arabic' && x.parent === it.id).map((x) => x.mark.value);
      nums.forEach((v, i) => { if (v !== String(i + 1)) fail(`глава «${it.id}»: номера статей должны идти подряд (ожидалась «${i + 1}», найдена «${v}»)`); });
    } else {
      const pageEntry = pagesMap[it.id];
      if (!pageEntry) fail(`материал «${it.id}»: нет pages["${it.id}"] (каждый неглавный материал обязан иметь страницу и partToc)`);
      if (pageEntry.id !== it.id) fail(`pages["${it.id}"].id «${pageEntry.id}» не совпадает с ключом «${it.id}»`);
    }
  }
  if (extPolicy === 'locked' && cfg.lockedCounts) {
    const navigable = cfg.items.filter((x) => x.tier !== 'chapter');
    const actualCore = navigable.filter((x) => x.mark.kind === 'roman' || x.mark.kind === 'arabic').length;
    const actualCompanions = navigable.filter((x) => x.mark.kind === 'label' || x.mark.kind === 'letter').length;
    if (actualCore !== cfg.lockedCounts.coreItems) {
      fail(`закрытая серия (extensionPolicy: 'locked'): ожидалось ${cfg.lockedCounts.coreItems} основных частей, найдено ${actualCore}`);
    }
    if (cfg.lockedCounts.companionItems !== undefined && actualCompanions !== cfg.lockedCounts.companionItems) {
      fail(`закрытая серия (extensionPolicy: 'locked'): ожидалось ${cfg.lockedCounts.companionItems} сопутствующих материалов, найдено ${actualCompanions}`);
    }
  }
  // Явная core-последовательность: все материалы — равноправные шаги.
  // Иначе «Шаг N из M» можно было бы получить из серии с форзацами,
  // спутниками или главами, где такой счёт был бы ложью.
  if (cfg.coreSequence) {
    if (!cfg.coreSequence.stepLabel?.trim()) fail('coreSequence.stepLabel пуст');
    if (cfg.shape === 'book') fail('coreSequence несовместим с shape: book');
    if (cfg.items.some((x) => x.parent || x.tier === 'satellite' || x.tier === 'chapter' || x.mark.kind === 'arabic')) {
      fail('coreSequence требует плоского списка самостоятельных материалов без parent/спутников/глав/статей');
    }
    for (const it of cfg.items) {
      if (!pagesMap[it.id]) fail(`coreSequence: шаг «${it.id}» не имеет pages[...] — позиция не может указывать на реальный маршрут`);
    }
  }
  // shape ↔ данные: книга обязана иметь главы, плоская — не иметь.
  const hasChapters = cfg.items.some((x) => x.tier === 'chapter');
  if (cfg.shape === 'book' && !hasChapters) fail(`shape: 'book', но глав (tier 'chapter') нет`);
  if (cfg.shape !== 'book' && hasChapters) fail(`есть главы (tier 'chapter'), но серия не объявлена книгой — добавьте shape: 'book'`);
  const pageAnchorSets = new Map<string, Set<string>>();
  for (const [pageId, rawPage] of Object.entries(pagesMap)) {
    const page = rawPage;
    if (!page) fail(`pages["${pageId}"] пуст`);
    if (!ids.has(pageId)) fail(`pages["${pageId}"] не соответствует ни одному item.id`);
    if (!Array.isArray(page.partToc) || page.partToc.length === 0) fail(`pages["${pageId}"]: пустой partToc (H2/H3 статьи)`);
    const anchors = new Set<string>();
    for (const row of page.partToc) {
      if (!row.href?.startsWith('#') || row.href.length < 2) fail(`pages["${pageId}"] partToc: href «${row.href}» должен быть непустым #якорем`);
      if (!row.label) fail(`pages["${pageId}"] partToc: строка без label`);
      anchors.add(row.href.slice(1));
    }
    for (const extra of page.quizSourceAnchors ?? []) {
      const cleaned = extra.replace(/^#/, '').trim();
      if (!cleaned) fail(`pages["${pageId}"] quizSourceAnchors содержит пустой якорь`);
      anchors.add(cleaned);
    }
    pageAnchorSets.set(pageId, anchors);
  }

  // Референциальная целостность пула вопросов (SYS-CONTENT-AUTHORING-PUBLICATION-CONTRACT).
  if (!Array.isArray(cfg.quiz)) fail('quiz должен быть массивом');
  if (cfg.quiz.length > 0) {
    const quizIds = new Set<string>();
    const requireRel = cfg.quizPolicy?.requireRelatedPageId !== false;
    const perPageCounts = new Map<string, number>();
    for (const pageId of Object.keys(pagesMap)) perPageCounts.set(pageId, 0);

    for (const q of cfg.quiz) {
      if (!q?.id?.trim()) fail('quiz: вопрос без id');
      if (quizIds.has(q.id)) fail(`quiz: дублирующийся id вопроса «${q.id}»`);
      quizIds.add(q.id);
      if (!VALID_QUIZ_CATEGORIES.has(q.category)) fail(`quiz «${q.id}»: неизвестная категория «${String(q.category)}»`);
      if (!q.question?.trim()) fail(`quiz «${q.id}»: пустой question`);
      if (!Array.isArray(q.answers) || q.answers.length !== 4 || q.answers.some((a) => typeof a !== 'string' || !a.trim())) {
        fail(`quiz «${q.id}»: answers обязан содержать 4 непустых варианта`);
      }
      if (new Set(q.answers.map((a) => a.trim())).size !== 4) {
        fail(`quiz «${q.id}»: дублирующиеся варианты в answers`);
      }
      if (q.correctIndex !== 0 && q.correctIndex !== 1 && q.correctIndex !== 2 && q.correctIndex !== 3) {
        fail(`quiz «${q.id}»: некорректный correctIndex «${String(q.correctIndex)}»`);
      }
      if (!q.explanation?.trim()) fail(`quiz «${q.id}»: пустой explanation`);
      if (!q.sourceLabel?.trim()) fail(`quiz «${q.id}»: пустой sourceLabel`);
      if (!q.sourceHref?.trim()) fail(`quiz «${q.id}»: пустой sourceHref`);

      const relId = q.relatedPageId ? String(q.relatedPageId) : '';
      if (requireRel && !relId) {
        fail(`quiz «${q.id}»: отсутствует обязательный relatedPageId`);
      }
      if (relId && !pagesMap[relId]) {
        fail(`quiz «${q.id}»: relatedPageId «${relId}» не найден среди pages серии`);
      }
      if (relId) {
        perPageCounts.set(relId, (perPageCounts.get(relId) ?? 0) + 1);
      }

      let parsedSource: URL;
      try {
        parsedSource = new URL(q.sourceHref, 'https://gospod-bog.ru/articles/_current_/');
      } catch {
        fail(`quiz «${q.id}»: некорректный sourceHref «${q.sourceHref}»`);
      }
      const frag = decodeURIComponent(parsedSource.hash.replace(/^#/, '')).trim();
      if (!frag) {
        fail(`quiz «${q.id}»: sourceHref «${q.sourceHref}» обязан содержать #якорь раздела`);
      }
      const sourcePathname = canonicalSeriesPathname(q.sourceHref);
      const targetItem = itemByPathname.get(sourcePathname);
      if (!targetItem) {
        fail(`quiz «${q.id}»: маршрут sourceHref «${q.sourceHref}» не принадлежит материалам серии`);
      }
      if (relId && targetItem.id !== relId) {
        fail(`quiz «${q.id}»: sourceHref «${q.sourceHref}» указывает на «${targetItem.id}», а relatedPageId = «${relId}»`);
      }
      const knownAnchors = pageAnchorSets.get(targetItem.id);
      if (!knownAnchors || !knownAnchors.has(frag)) {
        fail(`quiz «${q.id}»: якорь «#${frag}» из sourceHref не объявлен в partToc страницы «${targetItem.id}»`);
      }
    }

    const minPerPage = cfg.quizPolicy?.minPerPage ?? 4;
    if (!Number.isInteger(minPerPage) || minPerPage < 1) {
      fail(`quizPolicy.minPerPage должен быть целым >= 1`);
    }
    const fallbackMap = (cfg.quizPolicy?.fullPoolFallbackPages ?? {}) as Record<string, number | undefined>;
    for (const fbPageId of Object.keys(fallbackMap)) {
      if (!pagesMap[fbPageId]) {
        fail(`quizPolicy.fullPoolFallbackPages: страница «${fbPageId}» не найдена в pages серии`);
      }
    }
    for (const pageId of Object.keys(pagesMap)) {
      const localCount = perPageCounts.get(pageId) ?? 0;
      const fbExpected = fallbackMap[pageId];
      if (fbExpected !== undefined) {
        if (localCount !== fbExpected) {
          fail(`quizPolicy: страница «${pageId}» объявила fullPoolFallbackPages=${fbExpected}, но найдено ${localCount} локальных вопросов`);
        }
      } else if (localCount < minPerPage) {
        fail(`quizPolicy: на странице «${pageId}» всего ${localCount} локальных вопросов (минимум minPerPage=${minPerPage})`);
      }
    }
  }

  if (cfg.theme && !/^[a-z][a-z0-9-]*$/.test(cfg.theme)) fail(`theme «${cfg.theme}» — только [a-z0-9-]; CSS-файл: css/series-<theme>.css`);
  return cfg as unknown as SeriesConfig;
}

/** Выбор пула вопросов для страницы по явной политике серии (без тихого сброса
 *  на чужие вопросы при потере локальных связей). */
export function resolveSeriesQuizItems(cfg: SeriesConfig, pageId: string): SeriesQuizItem[] {
  const seriesPool = cfg.quiz ?? [];
  if (seriesPool.length === 0) return [];
  const fallbackMap = (cfg.quizPolicy?.fullPoolFallbackPages ?? {}) as Record<string, number | undefined>;
  if (Object.prototype.hasOwnProperty.call(fallbackMap, pageId)) {
    return seriesPool;
  }
  return seriesPool.filter((q) => !q.relatedPageId || q.relatedPageId === pageId);
}

export interface SeriesNeighborCard {
  dir: 'prev' | 'next';
  item: SeriesItem;
  eyebrow: string;
  title: string;
  desc: string;
  cover: string;
}

/** Соседние материалы серии для нижнего блока `.gbs2-next` (prev/next).
 *  В режиме `coreSequence` шагает по всем равноправным шагам подряд;
 *  в плоских сериях связывает римские части ядра, а форзацы (`label`) ведут
 *  внутрь к ближайшей римской части. */
export function seriesNeighbors(cfg: SeriesConfig, pageId: string): SeriesNeighborCard[] {
  const current = cfg.items.find((it) => it.id === pageId && it.tier !== 'chapter');
  if (!current) return [];

  const makeCard = (dir: 'prev' | 'next', target: SeriesItem, posText: string): SeriesNeighborCard => {
    const dirLabel = dir === 'prev' ? 'Назад по серии' : 'Дальше по серии';
    const page = cfg.pages[target.id];
    const firstSummary = page?.partToc?.find((row) => row.summary)?.summary ?? '';
    const desc = firstSummary || (target.shortTitle !== target.title ? target.shortTitle : '');
    return {
      dir,
      item: target,
      eyebrow: `${dirLabel} · ${posText} · ${target.readingTime}`,
      title: target.title,
      desc,
      cover: page?.railCover ?? '',
    };
  };

  if (cfg.coreSequence) {
    const steps = cfg.items.filter((it) => !it.parent && it.tier !== 'satellite' && it.tier !== 'chapter');
    const idx = steps.findIndex((it) => it.id === pageId);
    if (idx < 0) return [];
    const label = cfg.coreSequence.stepLabel;
    const out: SeriesNeighborCard[] = [];
    if (idx > 0) out.push(makeCard('prev', steps[idx - 1], `${label} ${idx} из ${steps.length}`));
    if (idx < steps.length - 1) out.push(makeCard('next', steps[idx + 1], `${label} ${idx + 2} из ${steps.length}`));
    return out;
  }

  const navigables = cfg.items.filter((it) => it.tier !== 'satellite' && it.tier !== 'chapter');
  const romans = navigables.filter((it) => it.mark.kind === 'roman' || it.mark.kind === 'arabic');
  const navIdx = navigables.findIndex((it) => it.id === current.id);
  if (navIdx < 0) return [];

  const posOf = (target: SeriesItem) => {
    const rIdx = romans.findIndex((r) => r.id === target.id);
    return rIdx >= 0 ? `${rIdx + 1} из ${romans.length}` : target.mark.value;
  };

  const out: SeriesNeighborCard[] = [];
  if (navIdx > 0) {
    out.push(makeCard('prev', navigables[navIdx - 1], posOf(navigables[navIdx - 1])));
  }
  if (navIdx < navigables.length - 1) {
    out.push(makeCard('next', navigables[navIdx + 1], posOf(navigables[navIdx + 1])));
  }
  return out;
}

/** Спутники части: для аккордеона «Оглавление части». */
export function satellitesOf(cfg: SeriesConfig, parentId: string): SeriesItem[] {
  return cfg.items.filter((it) => it.tier === 'satellite' && it.parent === parentId);
}

/** Ядро серии (без спутников): рельс, лист «Части серии», prev/next. */
export function coreItems(cfg: SeriesConfig): SeriesItem[] {
  return cfg.items.filter((it) => it.tier !== 'satellite');
}

/** Позиция материала в ЯВНО объявленной линейной core-последовательности.
 *  Возвращает null для обычных серий (там считаются только римские части).
 *  Вложенные статьи/спутники сводятся к родителю: валидатор coreSequence
 *  таких материалов не допускает, но публичный помощник остаётся безопасным. */
export function coreStepMeta(cfg: SeriesConfig, pageId: string): { position: number; total: number; label: string; text: string } | null {
  if (!cfg.coreSequence) return null;
  const item = cfg.items.find((it) => it.id === pageId);
  const anchorId = item?.parent ?? pageId;
  const steps = cfg.items.filter((it) => !it.parent && it.tier !== 'satellite');
  const index = steps.findIndex((it) => it.id === anchorId);
  if (index < 0) return null;
  const label = cfg.coreSequence.stepLabel;
  return { position: index + 1, total: steps.length, label, text: `${label} ${index + 1} из ${steps.length}` };
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

/** Вариант 1 владельца (2026-07-17): в КНИЖНОЙ серии H2-разделы статьи
 *  показываются в оглавлении/рельсе БЕЗ ведущего римского «I. » — он
 *  конфликтует с римским номером ГЛАВЫ (глаз путает «Глава I» и «раздел I»).
 *  Плоские серии (Гилл/pastor) не затрагиваются: там префикс остаётся.
 *  Тексты самих статей не меняются — префикс снимается только при выводе. */
export function sectionLabel(cfg: SeriesConfig, label: string): string {
  return cfg.shape === 'book' ? label.replace(/^[IVXLC]+\.\s+/, '') : label;
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
  quizPolicy: {
    minPerPage: 4,
    requireRelatedPageId: true,
    fullPoolFallbackPages: { part2: 3 },
  },
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
