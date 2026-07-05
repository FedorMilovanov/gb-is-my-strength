export type GillSeriesPageId =
  | "context"
  | "part1"
  | "part2"
  | "part3"
  | "spravochnik"

export interface GillSeriesMark {
  kind: 'label' | 'roman';
  value: string;
}

export interface GillSeriesItem {
  id: GillSeriesPageId;
  mark: GillSeriesMark;
  title: string;
  shortTitle: string;
  href: string;
  readingTime: string;
}

export interface GillPartTocItem {
  /** Pre-v16 GBS submenu target. Must exist in the current rendered article. */
  href: string;
  /** Exact historical pre-v16 GBS submenu label. Roman prefix appears only on real top-level rows. */
  label: string;
  /** Historical hierarchy: H2/top-level = 2, H3/submenu row = 3. */
  level: 2 | 3;
  current?: boolean;
}

export interface GillPageChromeData {
  id: GillSeriesPageId;
  label: string;
  title: string;
  mobileSection: string;
  partLabel: string;
  readingProgressDoneMin: number;
  readingProgressPartMin: number;
  readingProgressTotalMin: number;
  /** «Сейчас читаете» card title — the PART name (historical witness bcf6389f
   *  showed «Часть II. Учёный», not the series title). */
  railNowTitle: string;
  /** Cover image of the expanded current-part card (gbs2-current), relative
   *  to the article page (../../images/...). Historical flow-rail contract. */
  railCover: string;
  partDialogLabel: string;
  partToc: GillPartTocItem[];
}

export const GILL_SERIES_ITEMS: GillSeriesItem[] = [
  {
    id: "context",
    mark: { kind: "label", value: "Введение" },
    title: "Исторический контекст",
    shortTitle: "Контекст",
    href: "/articles/dzhon-gill-istoricheskiy-kontekst/",
    readingTime: "16 мин",
  },
  {
    id: "part1",
    mark: { kind: "roman", value: "I" },
    title: "Часть I. Человек",
    shortTitle: "Человек",
    href: "/articles/dzhon-gill-chast-1-chelovek/",
    readingTime: "32 мин",
  },
  {
    id: "part2",
    mark: { kind: "roman", value: "II" },
    title: "Часть II. Учёный",
    shortTitle: "Учёный",
    href: "/articles/dzhon-gill-chast-2-uchenyi/",
    readingTime: "39 мин",
  },
  {
    id: "part3",
    mark: { kind: "roman", value: "III" },
    title: "Часть III. Наследие",
    shortTitle: "Наследие",
    href: "/articles/dzhon-gill-chast-3-nasledie/",
    readingTime: "54 мин",
  },
  {
    id: "spravochnik",
    mark: { kind: "label", value: "Справ." },
    title: "Справочник по Гиллу",
    shortTitle: "Справочник",
    href: "/articles/dzhon-gill-spravochnik/",
    readingTime: "8 мин",
  }
]

export const GILL_PAGE_DATA: Record<GillSeriesPageId, GillPageChromeData> = {
  context: {
    id: "context",
    label: "Исторический контекст",
    title: "Исторический контекст",
    mobileSection: "Введение",
    partLabel: "Введение · Содержание",
    readingProgressDoneMin: 0,
    readingProgressPartMin: 16,
    readingProgressTotalMin: 149,
    railNowTitle: "Исторический контекст",
    railCover: "../../images/og-dzhon-gill-istoricheskiy-kontekst-600w.webp",
    partDialogLabel: "Введение · Исторический контекст",
    partToc: [
      { href: "#sec-from-puritans-to-baptists", label: "I. От пуритан к диссентерам: путь в полтора века", level: 2, current: true },
      { href: "#sec-particular-vs-general", label: "II. Партикулярные и генеральные баптисты: почему это важно", level: 2 },
      { href: "#sec-great-ejection", label: "III. Тень 1662 года: Великое изгнание", level: 2 },
      { href: "#sec-clarendon", label: "IV. Кларендонский кодекс и позднейшие религиозные тесты", level: 2 },
      { href: "#sec-academies", label: "V. Диссентерские академии: университеты для изгнанных", level: 2 },
      { href: "#sec-salters-hall", label: "VI. Солтерс-Холл (1719): доктринальный разлом", level: 2 },
      { href: "#sec-coffee-house", label: "VII. Кофейная политика", level: 2 },
      { href: "#sec-southwark", label: "VIII. Саутварк: джин, дым и Евангелие", level: 2 },
      { href: "#sec-books", label: "IX. Кеттеринг и книжная лавка", level: 2 },
      { href: "#sec-conclusion", label: "X. Итог: пастор изгнанников, защитник Троицы, учёный с улицы", level: 2 },
    ],
  },
  part1: {
    id: "part1",
    label: "Джон Гилл",
    title: "Часть I. Человек",
    mobileSection: "Часть I. Человек",
    partLabel: "Часть I · Содержание",
    readingProgressDoneMin: 16,
    readingProgressPartMin: 32,
    readingProgressTotalMin: 149,
    railNowTitle: "Часть I. Человек",
    railCover: "../../images/gill-study-portrait-600w.webp",
    partDialogLabel: "Часть I · Человек",
    partToc: [
      // Row order follows CURRENT document order (scrollspy invariant §9.5);
      // the article grew after the historical witness bcf6389f and several
      // sections moved. Documented in
      // data/gill-submenu-anchor-reconciliation.json → "reorders".
      { href: "#part-calling", label: "I. Становление и призвание", level: 2, current: true },
      { href: "#sec-intro", label: "Откуда рождаются гении без университетов", level: 3 },
      { href: "#sec-birth-prophecy", label: "Утро рождения: три пророчества", level: 3 },
      { href: "#sec-education", label: "Книжная лавка вместо грамматической школы", level: 3 },
      { href: "#sec-conversion", label: "Бытие 3:9 — вопрос, изменивший жизнь", level: 3 },
      { href: "#part-pastor", label: "II. Пасторское служение в Хорслидауне", level: 2 },
      { href: "#sec-pastor", label: "Хорслидаун: пятьдесят один год на одном месте", level: 3 },
      { href: "#sec-evangelism", label: "Систематическая евангелизация Саутварка", level: 3 },
      { href: "#sec-goatyardDecl", label: "Декларация Козьего Двора 1729 года: архитектура исповедания", level: 3 },
      { href: "#sec-daughter-sermon", label: "Проповедь отца на похоронах дочери: богословие скорби", level: 3 },
      { href: "#sec-family-deep", label: "Семья: дети, зять-издатель и богословие в деталях", level: 3 },
      { href: "#sec-ordination-1720", label: "Рукоположение 22 марта 1720 года: полный протокол события", level: 3 },
      { href: "#sec-personal-credo", label: "Три личных высказывания: человек за богословом", level: 3 },
      { href: "#sec-context-southwark", label: "Исторический контекст: Саутварк, джиновая лихорадка, правовое бесправие", level: 3 },
      { href: "#sec-quiz", label: "Проверь себя", level: 2 },
    ],
  },
  part2: {
    id: "part2",
    label: "Джон Гилл",
    title: "Часть II. Учёный",
    mobileSection: "Часть II. Учёный",
    partLabel: "Часть II · Содержание",
    readingProgressDoneMin: 48,
    readingProgressPartMin: 39,
    readingProgressTotalMin: 149,
    railNowTitle: "Часть II. Учёный",
    railCover: "../../images/og-dzhon-gill-chast-2-uchenyi-600w.webp",
    partDialogLabel: "Часть II · Учёный",
    partToc: [
      // Row order follows CURRENT document order (scrollspy invariant: submenu
      // order must be monotonic in target offsetTop). The article grew 6→29
      // sections after the historical witness bcf6389f, and «Свод богословия»
      // now sits after ordinances/eschatology in the text. Documented in
      // data/gill-submenu-anchor-reconciliation.json → "reorders".
      { href: "#sec-hebrew", label: "Раввинист — христианин с Мишной в руках", level: 2, current: true },
      { href: "#sec-canticles", label: "Песнь Песней: самый личный труд Гилла", level: 3 },
      { href: "#sec-ordinances", label: "Таинства и церковные установления: крещение и Вечеря", level: 3 },
      { href: "#sec-eschatology", label: "Эсхатология: духовное и личное царствование Христа", level: 3 },
      { href: "#sec-systematics", label: "«Полный свод богословия» — первая баптистская сумма", level: 3 },
      { href: "#sec-quiz", label: "Проверь себя", level: 2 },
    ],
  },
  part3: {
    id: "part3",
    label: "Джон Гилл",
    title: "Часть III. Наследие",
    mobileSection: "Часть III. Наследие",
    partLabel: "Часть III · Содержание",
    readingProgressDoneMin: 87,
    readingProgressPartMin: 54,
    readingProgressTotalMin: 149,
    railNowTitle: "Часть III. Наследие",
    railCover: "../../images/og-dzhon-gill-chast-3-nasledie-600w.webp",
    partDialogLabel: "Часть III · Наследие",
    partToc: [
      // Row order follows CURRENT document order (scrollspy invariant §9.5);
      // Part III was heavily expanded/re-arranged after the historical witness
      // bcf6389f. Documented in
      // data/gill-submenu-anchor-reconciliation.json → "reorders".
      { href: "#part-legacy", label: "V. Историческое влияние и память", level: 2, current: true },
      { href: "#sec-controversy", label: "Гиперкальвинизм — спорное наследие", level: 3 },
      { href: "#sec-church-gov", label: "Управление церковью: единственный пастор, никаких степеней", level: 3 },
      { href: "#sec-church-gov-polity", label: "О вступлении в членство и права поместной общины", level: 3 },
      { href: "#sec-spurgeon-legacy", label: "Сперджен — наследник и независимый критик", level: 3 },
      { href: "#sec-sources-gil-theology", label: "Богословские источники Гилла", level: 3 },
      { href: "#sec-terms", label: "Словарь эпохи: ключевые богословские понятия", level: 3 },
      { href: "#sec-disciples", label: "Ученики и духовные наследники", level: 3 },
      { href: "#sec-america", label: "Влияние на Америку и Фонд партикулярных баптистов", level: 3 },
      { href: "#sec-contemporaries", label: "Как современники видели Гилла: портрет из первых уст", level: 3 },
      { href: "#sec-toplady-memoir", label: "Топлэди о Гилле: Чёрный Принц и Мальборо", level: 3 },
      { href: "#sec-gill-islam-detail", label: "Гилл и ислам: Коран на пасторском столе", level: 3 },
      { href: "#sec-ordination-rippon", label: "Риппон: «Столь великого плача в мире»", level: 3 },
      { href: "#sec-gill-last-pages", label: "Последние страницы: «10 000!» и Nunc Dimittis", level: 3 },
      { href: "#sec-gill-muller-rediscovery", label: "Современная реабилитация: «Проект Джона Гилла» (2023–2025)", level: 3 },
      { href: "#sec-quiz", label: "Проверь себя", level: 2 },
    ],
  },
  spravochnik: {
    id: "spravochnik",
    label: "Справочник по Джону Гиллу",
    title: "Справочник по Гиллу",
    mobileSection: "Справочник по Гиллу",
    partLabel: "Справочник · Содержание",
    readingProgressDoneMin: 141,
    readingProgressPartMin: 8,
    readingProgressTotalMin: 149,
    railNowTitle: "Справочник по Гиллу",
    railCover: "../../images/gill-five-volumes-shelf-600w.webp",
    partDialogLabel: "Справочник по Гиллу",
    partToc: [
      { href: "#sec-prdl", label: "I. Масштаб корпуса", level: 2, current: true },
      { href: "#sec-timeline", label: "II. Хронология жизни и служения", level: 2 },
      { href: "#sec-works", label: "III. Основные труды", level: 2 },
      { href: "#sec-body-structure", label: "IV. Структура «Свода богословия»", level: 2 },
      { href: "#sec-network", label: "V. Сеть влияний и наследников", level: 2 },
      { href: "#sec-disputes", label: "VI. Спорные темы и как их читать", level: 2 },
      { href: "#sec-terms", label: "VII. Богословский словарь эпохи", level: 2 },
      { href: "#sec-links", label: "VIII. Читать дальше", level: 2 },
      { href: "#sec-quiz", label: "Проверь себя", level: 2 },
    ],
  },
}

export function getGillSeriesItem(pageId: GillSeriesPageId): GillSeriesItem {
  const item = GILL_SERIES_ITEMS.find((entry) => entry.id === pageId);
  if (!item) throw new Error(`Unknown Gill page id: ${pageId}`);
  return item;
}
