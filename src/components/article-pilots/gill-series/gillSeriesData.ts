export type GillSeriesPageId =
  | "context"
  | "part1"
  | "part2"
  | "part3"
  | "part4"
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
  /** One-sentence gloss for the mobile Learning → «Конспект» outline tab.
   *  Only populated on real level:2 (H2) rows — sub-items stay in the
   *  granular Part TOC sheet, the outline tab shows the coarse structure. */
  summary?: string;
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
    readingTime: "28 мин",
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
    id: "part4",
    mark: { kind: "roman", value: "III" },
    title: "Часть III. Экзегет",
    shortTitle: "Экзегет",
    href: "/articles/dzhon-gill-chast-4-ekzeget/",
    readingTime: "71 мин",
  },
  {
    id: "part3",
    mark: { kind: "roman", value: "IV" },
    title: "Часть IV. Наследие",
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
    readingTime: "15 мин",
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
    readingProgressPartMin: 28,
    readingProgressTotalMin: 239,
    railNowTitle: "Исторический контекст",
    railCover: "../../images/og-dzhon-gill-istoricheskiy-kontekst-600w.webp",
    partDialogLabel: "Введение · Исторический контекст",
    partToc: [
      { href: "#sec-from-puritans-to-baptists", label: "I. От пуритан к диссентерам: путь в полтора века", level: 2, current: true, summary: "Как английские пуритане XVII века привели к отдельной партикулярно-баптистской традиции, в которой вырос Гилл." },
      { href: "#sec-particular-vs-general", label: "II. Партикулярные и генеральные баптисты: почему это важно", level: 2, summary: "Ключевое различие между двумя баптистскими течениями — по объёму искупления — определяющее богословскую позицию Гилла." },
      { href: "#sec-great-ejection", label: "III. Тень 1662 года: Великое изгнание", level: 2, summary: "Как массовое изгнание нонконформистского духовенства в 1662 году сформировало мир диссентеров, в котором позже служил Гилл." },
      { href: "#sec-clarendon", label: "IV. Кларендонский кодекс и позднейшие религиозные тесты", level: 2, summary: "Законодательные ограничения против нонконформистов и то, как община Гилла существовала под правовым давлением." },
      { href: "#sec-academies", label: "V. Диссентерские академии: образование вне Оксфорда и Кембриджа", level: 2, summary: "Альтернативные учебные заведения, заменявшие нонконформистам закрытые для них Оксфорд и Кембридж." },
      { href: "#sec-salters-hall", label: "VI. Солтерс-Холл (1719): спор о подписке", level: 2, summary: "Спор 1719 года о подписании тринитарных формул, расколовший английских диссентеров незадолго до служения Гилла." },
      { href: "#sec-coffee-house", label: "VII. Кофейни как публичные пространства", level: 2, summary: "Роль лондонских кофеен как площадок религиозных и политических дискуссий эпохи Гилла." },
      { href: "#sec-southwark", label: "VIII. Саутварк: социальная среда служения", level: 2, summary: "Социальный портрет лондонского района, где Гилл десятилетиями возглавлял общину." },
      { href: "#sec-books", label: "IX. Кеттеринг и книжная лавка", level: 2, summary: "Ранние годы Гилла и то, как книжная лавка заменила ему формальное университетское образование." },
      { href: "#sec-conclusion", label: "X. Итог: диссентерский пастор, тринитарный полемист и самоучка", level: 2, summary: "Краткое резюме исторического контекста, из которого вырос Гилл как богослов и пастор." },
    ],
  },
  part1: {
    id: "part1",
    label: "Джон Гилл",
    title: "Часть I. Человек",
    mobileSection: "Часть I. Человек",
    partLabel: "Часть I · Содержание",
    readingProgressDoneMin: 28,
    readingProgressPartMin: 32,
    readingProgressTotalMin: 239,
    railNowTitle: "Часть I. Человек",
    railCover: "../../images/gill-study-portrait-600w.webp",
    partDialogLabel: "Часть I · Человек",
    partToc: [
      // Row order follows CURRENT document order (scrollspy invariant §9.5);
      // the article grew after the historical witness bcf6389f and several
      // sections moved. Documented in
      // data/gill-submenu-anchor-reconciliation.json → "reorders".
      { href: "#part-calling", label: "I. Становление и призвание", level: 2, current: true, summary: "Детство, обращение и первые шаги Гилла к пасторскому служению." },
      { href: "#sec-intro", label: "Самообразование вне университетской траектории", level: 3 },
      { href: "#sec-birth-prophecy", label: "Утро рождения: три пророчества", level: 3 },
      { href: "#sec-education", label: "Книжная лавка вместо грамматической школы", level: 3 },
      { href: "#sec-conversion", label: "Бытие 3:9 — вопрос, изменивший жизнь", level: 3 },
      { href: "#part-pastor", label: "II. Пасторское служение в Хорслидауне", level: 2, summary: "Пятьдесят один год служения Гилла на одном месте — Хорслидаун, Саутварк." },
      { href: "#sec-pastor", label: "Хорслидаун: пятьдесят один год на одном месте", level: 3 },
      { href: "#sec-evangelism", label: "Евангельская активность: свидетельства и границы", level: 3 },
      { href: "#sec-goatyardDecl", label: "Декларация Козьего Двора 1729 года: архитектура исповедания", level: 3 },
      { href: "#sec-daughter-sermon", label: "Проповедь отца на похоронах дочери: богословие скорби", level: 3 },
      { href: "#sec-family-deep", label: "Семья: дети, зять-издатель и богословие в деталях", level: 3 },
      { href: "#sec-ordination-1720", label: "Рукоположение 22 марта 1720 года: свидетельства Кросби и Риппона", level: 3 },
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
    readingProgressDoneMin: 60,
    readingProgressPartMin: 39,
    readingProgressTotalMin: 239,
    railNowTitle: "Часть II. Учёный",
    railCover: "../../images/og-dzhon-gill-chast-2-uchenyi-600w.webp",
    partDialogLabel: "Часть II · Учёный",
    partToc: [
      // Row order follows CURRENT document order (scrollspy invariant: submenu
      // order must be monotonic in target offsetTop). The article grew 6→29
      // sections after the historical witness bcf6389f, and «Свод богословия»
      // now sits after ordinances/eschatology in the text. Documented in
      // data/gill-submenu-anchor-reconciliation.json → "reorders".
      { href: "#sec-hebrew", label: "Раввинист — христианин с Мишной в руках", level: 2, current: true, summary: "Гилл как учёный: работа с раввинистическими источниками и главные научные труды его жизни." },
      { href: "#sec-canticles", label: "Песнь Песней: самый личный труд Гилла", level: 3 },
      { href: "#sec-ordinances", label: "Церковные установления: крещение и Вечеря", level: 3 },
      { href: "#sec-eschatology", label: "Эсхатология: духовное и личное царствование Христа", level: 3 },
      { href: "#sec-systematics", label: "Догматический и практический «Свод богословия»", level: 3 },
      { href: "#sec-quiz", label: "Проверь себя", level: 2 },
    ],
  },
  part3: {
    id: "part3",
    label: "Джон Гилл",
    title: "Часть IV. Наследие",
    mobileSection: "Часть IV. Наследие",
    partLabel: "Часть IV · Содержание",
    readingProgressDoneMin: 170,
    readingProgressPartMin: 54,
    readingProgressTotalMin: 239,
    railNowTitle: "Часть IV. Наследие",
    railCover: "../../images/og-dzhon-gill-chast-3-nasledie-600w.webp",
    partDialogLabel: "Часть IV · Наследие",
    partToc: [
      // Row order follows CURRENT document order (scrollspy invariant §9.5);
      // Part III was heavily expanded/re-arranged after the historical witness
      // bcf6389f. Documented in
      // data/gill-submenu-anchor-reconciliation.json → "reorders".
      { href: "#part-legacy", label: "V. Историческое влияние и память", level: 2, current: true, summary: "Как наследие Гилла воспринималось современниками и последующими поколениями, включая спорные и признанные стороны." },
      { href: "#sec-controversy", label: "Гиперкальвинизм — спорное наследие", level: 3 },
      { href: "#sec-church-gov", label: "Управление церковью: пасторы, дьяконы и выбор общины", level: 3 },
      { href: "#sec-church-gov-polity", label: "О вступлении в членство и права поместной общины", level: 3 },
      { href: "#sec-spurgeon-legacy", label: "Сперджен — наследник и независимый критик", level: 3 },
      { href: "#sec-sources-gil-theology", label: "Богословские источники Гилла", level: 3 },
      { href: "#sec-terms", label: "Словарь эпохи: ключевые богословские понятия", level: 3 },
      { href: "#sec-disciples", label: "Ученики и духовные наследники", level: 3 },
      { href: "#sec-america", label: "Американская рецепция и архивные границы", level: 3 },
      { href: "#sec-contemporaries", label: "Современники и поздняя биографическая память", level: 3 },
      { href: "#sec-toplady-memoir", label: "Топлэди о Гилле: Чёрный Принц и Мальборо", level: 3 },
      { href: "#sec-gill-islam-detail", label: "Гилл и ислам: Коран на пасторском столе", level: 3 },
      { href: "#sec-ordination-rippon", label: "Риппон: «Столь великого плача в мире»", level: 3 },
      { href: "#sec-gill-last-pages", label: "Последние страницы: «10 000!» и Nunc Dimittis", level: 3 },
      { href: "#sec-gill-muller-rediscovery", label: "Современная переоценка и цифровые проекты", level: 3 },
      { href: "#sec-quiz", label: "Проверь себя", level: 2 },
    ],
  },
  part4: {
    id: "part4",
    label: "Джон Гилл",
    title: "Часть III. Экзегет",
    mobileSection: "Часть III. Экзегет",
    partLabel: "Часть III · Содержание",
    readingProgressDoneMin: 99,
    readingProgressPartMin: 71,
    readingProgressTotalMin: 239,
    railNowTitle: "Часть III. Экзегет",
    railCover: "../../images/og-dzhon-gill-chast-4-ekzeget-600w.webp",
    partDialogLabel: "Часть III · Экзегет",
    partToc: [
      { href: "#sec-exegete-intro", label: "Джон Гилл: экзегет за работой", level: 2, current: true, summary: "Как Гилл читал сложные тексты Писания и разбирал спорные толкования на конкретных примерах." },
      { href: "#sec-method", label: "Герменевтический метод: пять координат", level: 3 },
      { href: "#sec-seven-texts", label: "Семь «универсальных» текстов: экзегеза Гилла", level: 3 },
      { href: "#sec-1tim-2-4", label: "1 Тимофею 2:4 — «все» разных сортов", level: 3 },
      { href: "#sec-2pet-3-9", label: "2 Петра 3:9 — ключевое местоимение «нас»", level: 3 },
      { href: "#sec-world-texts", label: "Иоанна 3:16 и 1 Иоанна 2:2 — «мир» как лексический вопрос", level: 3 },
      { href: "#sec-three-shorter-texts", label: "Три текста короче: Ин 1:29, Рим 8:29, Рим 9:11", level: 3 },
      { href: "#sec-rabbi-yohanan", label: "Поздняя раввинистическая параллель: Йоханан", level: 3 },
      { href: "#sec-proclamation", label: "Провозглашение, а не предложение", level: 3 },
      { href: "#sec-rejection", label: "Отвержение: «rejection», а не «reprobation»", level: 3 },
      { href: "#sec-duty-faith", label: "Долг веры: предмет продолжающегося спора", level: 3 },
      { href: "#sec-conclusion", label: "Заключение: точность, а не фатализм", level: 3 },
      { href: "#sec-sources", label: "Первоисточники и научная литература", level: 3 },
      { href: "#sec-quiz", label: "Проверь себя", level: 2 },
    ],
  },
  spravochnik: {
    id: "spravochnik",
    label: "Справочник по Джону Гиллу",
    title: "Справочник по Гиллу",
    mobileSection: "Справочник по Гиллу",
    partLabel: "Справочник · Содержание",
    readingProgressDoneMin: 224,
    readingProgressPartMin: 15,
    readingProgressTotalMin: 239,
    railNowTitle: "Справочник по Гиллу",
    railCover: "../../images/gill-five-volumes-shelf-600w.webp",
    partDialogLabel: "Справочник по Гиллу",
    partToc: [
      { href: "#sec-prdl", label: "I. Масштаб корпуса", level: 2, current: true, summary: "Общий объём и охват литературного наследия Гилла." },
      { href: "#sec-timeline", label: "II. Хронология жизни и служения", level: 2, summary: "Основные даты жизни и пасторского пути Гилла." },
      { href: "#sec-works", label: "III. Основные труды", level: 2, summary: "Ключевые сочинения Гилла и их значение." },
      { href: "#sec-body-structure", label: "IV. Структура «Свода богословия»", level: 2, summary: "Как устроен главный систематический труд Гилла." },
      { href: "#sec-network", label: "V. Сеть влияний и наследников", level: 2, summary: "Кто повлиял на Гилла и кто продолжил его дело." },
      { href: "#sec-disputes", label: "VI. Спорные темы и как их читать", level: 2, summary: "Обзор дискуссионных вопросов вокруг наследия Гилла и корректный подход к их оценке." },
      { href: "#sec-terms", label: "VII. Богословский словарь эпохи", level: 2, summary: "Ключевые богословские термины, необходимые для понимания текстов Гилла." },
      { href: "#sec-links", label: "VIII. Читать дальше", level: 2, summary: "Куда двигаться дальше при изучении наследия Гилла." },
      { href: "#sec-quiz", label: "Проверь себя", level: 2 },
    ],
  },
}

export function getGillSeriesItem(pageId: GillSeriesPageId): GillSeriesItem {
  const item = GILL_SERIES_ITEMS.find((entry) => entry.id === pageId);
  if (!item) throw new Error(`Unknown Gill page id: ${pageId}`);
  return item;
}
