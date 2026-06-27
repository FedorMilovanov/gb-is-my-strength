export type GillSeriesPageId =
  | "context"
  | "part1"
  | "part2"
  | "part3"
  | "spravochnik"

export interface GillSeriesItem {
  id: GillSeriesPageId;
  roman: string;
  title: string;
  shortTitle: string;
  href: string;
  readingTime: string;
}

export interface GillPartTocItem {
  roman: string;
  title: string;
  subtitle: string;
  href?: string;
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
  railNowTitle: string;
  partDialogLabel: string;
  partToc: GillPartTocItem[];
}

export const GILL_SERIES_ITEMS: GillSeriesItem[] = [
  {
    id: "context",
    roman: "I",
    title: "Исторический контекст",
    shortTitle: "Контекст",
    href: "/articles/dzhon-gill-istoricheskiy-kontekst/",
    readingTime: "16 мин",
  },
  {
    id: "part1",
    roman: "II",
    title: "Часть I. Человек",
    shortTitle: "Человек",
    href: "/articles/dzhon-gill-chast-1-chelovek/",
    readingTime: "32 мин",
  },
  {
    id: "part2",
    roman: "III",
    title: "Часть II. Учёный",
    shortTitle: "Учёный",
    href: "/articles/dzhon-gill-chast-2-uchenyi/",
    readingTime: "39 мин",
  },
  {
    id: "part3",
    roman: "IV",
    title: "Часть III. Наследие",
    shortTitle: "Наследие",
    href: "/articles/dzhon-gill-chast-3-nasledie/",
    readingTime: "54 мин",
  },
  {
    id: "spravochnik",
    roman: "V",
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
    mobileSection: "Контекст",
    partLabel: "Часть I · Содержание",
    readingProgressDoneMin: 0,
    readingProgressPartMin: 16,
    readingProgressTotalMin: 149,
    railNowTitle: "Исторический контекст",
    partDialogLabel: "Часть I · Исторический контекст",
    partToc: [
    {
      roman: "I",
      title: "От пуритан к диссентерам",
      subtitle: "● Глава 1",
      current: true,
    },
    {
      roman: "II",
      title: "Партикулярные и генеральные",
      subtitle: "Глава 2",
      href: "#sec-particular-vs-general",
    },
    {
      roman: "III",
      title: "Тень 1662: Великое изгнание",
      subtitle: "Глава 3",
      href: "#sec-great-ejection",
    },
    {
      roman: "IV",
      title: "Кларендонский кодекс",
      subtitle: "Глава 4",
      href: "#sec-clarendon",
    },
    {
      roman: "V",
      title: "Диссентерские академии",
      subtitle: "Глава 5",
      href: "#sec-academies",
    },
    {
      roman: "VI",
      title: "Солтерс-Холл 1719",
      subtitle: "Глава 6",
      href: "#sec-salters-hall",
    },
    {
      roman: "VII",
      title: "Кофейная политика",
      subtitle: "Глава 7",
      href: "#sec-coffee-house",
    },
    {
      roman: "VIII",
      title: "Саутварк: джин, дым и Евангелие",
      subtitle: "Глава 8",
      href: "#sec-southwark",
    },
    {
      roman: "IX",
      title: "Кеттеринг и книжная лавка",
      subtitle: "Глава 9",
      href: "#sec-books",
    },
    {
      roman: "X",
      title: "Итог: пастор изгнанников",
      subtitle: "Глава 10",
      href: "#sec-conclusion",
    }
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
    railNowTitle: "Джон Гилл (1697–1771)",
    partDialogLabel: "Часть I · Человек",
    partToc: [
    {
      roman: "I",
      title: "Ранние годы, обращение и формирование характера",
      subtitle: "● Глава 1",
      href: "#part-calling",
      current: true,
    },
    {
      roman: "II",
      title: "Откуда рождаются гении без университетов",
      subtitle: "Глава 2",
      href: "#sec-intro",
    },
    {
      roman: "III",
      title: "Утро рождения: три пророчества",
      subtitle: "Глава 3",
      href: "#sec-birth-prophecy",
    },
    {
      roman: "IV",
      title: "Книжная лавка вместо грамматической школы",
      subtitle: "Глава 4",
      href: "#sec-education",
    },
    {
      roman: "V",
      title: "Бытие 3:9 — вопрос, изменивший жизнь",
      subtitle: "Глава 5",
      href: "#sec-conversion",
    },
    {
      roman: "VI",
      title: "Пасторское служение в Хорслидауне",
      subtitle: "Глава 6",
      href: "#part-pastor",
    },
    {
      roman: "VII",
      title: "Рукоположение 22 марта 1720 года",
      subtitle: "Глава 7",
      href: "#sec-ordination-1720",
    },
    {
      roman: "VIII",
      title: "Декларация Козьего Двора 1729 года",
      subtitle: "Глава 8",
      href: "#sec-goatyardDecl",
    },
    {
      roman: "IX",
      title: "Систематическая евангелизация Саутварка",
      subtitle: "Глава 9",
      href: "#sec-evangelism",
    },
    {
      roman: "X",
      title: "Проповедь отца на похоронах дочери",
      subtitle: "Глава 10",
      href: "#sec-daughter-sermon",
    },
    {
      roman: "XI",
      title: "Личная духовность и человек за богословом",
      subtitle: "Глава 11",
      href: "#sec-personal-credo",
    },
    {
      roman: "XII",
      title: "Контекст: Саутварк, джиновая лихорадка",
      subtitle: "Глава 12",
      href: "#sec-context-southwark",
    },
    {
      roman: "XIII",
      title: "Проверь себя",
      subtitle: "Глава 13",
      href: "#sec-quiz",
    }
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
    railNowTitle: "Джон Гилл (1697–1771)",
    partDialogLabel: "Часть II · Учёный",
    partToc: [
    {
      roman: "I",
      title: "Раввинист — гебраист с Мишной в руках",
      subtitle: "● Глава 1",
      href: "#sec-hebrew",
      current: true,
    },
    {
      roman: "II",
      title: "Песнь Песней (1728): аллегория Христа и Церкви",
      subtitle: "Глава 2",
      href: "#sec-canticles",
    },
    {
      roman: "III",
      title: "«Свод богословия» (1769–1770)",
      subtitle: "Глава 3",
      href: "#sec-systematics",
    },
    {
      roman: "IV",
      title: "Церковь, таинства и пасторское сердце",
      subtitle: "Глава 4",
      href: "#sec-ordinances",
    },
    {
      roman: "V",
      title: "Эсхатология: царствование Христа",
      subtitle: "Глава 5",
      href: "#sec-eschatology",
    },
    {
      roman: "VI",
      title: "Проверь себя",
      subtitle: "Глава 6",
      href: "#sec-quiz",
    }
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
    railNowTitle: "Джон Гилл (1697–1771)",
    partDialogLabel: "Часть III · Наследие",
    partToc: [
    {
      roman: "I",
      title: "Наследие, споры и память",
      subtitle: "● Глава 1",
      href: "#sec-legacy",
      current: true,
    },
    {
      roman: "II",
      title: "Полемика с Джоном Уэсли (1752–1755)",
      subtitle: "Глава 2",
      href: "#sec-toplady-memoir",
    },
    {
      roman: "III",
      title: "Гиперкальвинизм — спорное наследие",
      subtitle: "Глава 3",
      href: "#sec-controversy",
    },
    {
      roman: "IV",
      title: "Богословские источники Гилла",
      subtitle: "Глава 4",
      href: "#sec-sources-gil-theology",
    },
    {
      roman: "V",
      title: "Ученики и духовные наследники",
      subtitle: "Глава 5",
      href: "#sec-disciples",
    },
    {
      roman: "VI",
      title: "Coffee House и права поместной церкви",
      subtitle: "Глава 6",
      href: "#sec-church-gov",
    },
    {
      roman: "VII",
      title: "Влияние на Америку",
      subtitle: "Глава 7",
      href: "#sec-america",
    },
    {
      roman: "VIII",
      title: "Гилл и ислам: Коран на столе",
      subtitle: "Глава 8",
      href: "#sec-gill-islam-detail",
    },
    {
      roman: "IX",
      title: "Чарльз Сперджен — наследник и критик",
      subtitle: "Глава 9",
      href: "#sec-spurgeon-legacy",
    },
    {
      roman: "X",
      title: "Последние страницы и смерть (1771)",
      subtitle: "Глава 10",
      href: "#sec-gill-last-pages",
    },
    {
      roman: "XI",
      title: "Память и масштаб скорби",
      subtitle: "Глава 11",
      href: "#sec-ordination-rippon",
    },
    {
      roman: "XII",
      title: "Современная реабилитация (2023–2025)",
      subtitle: "Глава 12",
      href: "#sec-gill-muller-rediscovery",
    },
    {
      roman: "XIII",
      title: "Оценки Гилла: от восторга до критики",
      subtitle: "Глава 13",
      href: "#sec-contemporaries",
    },
    {
      roman: "XIV",
      title: "Словарь эпохи: ключевые понятия",
      subtitle: "Глава 14",
      href: "#sec-terms",
    },
    {
      roman: "XV",
      title: "Проверь себя",
      subtitle: "Глава 15",
      href: "#sec-quiz",
    }
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
    railNowTitle: "Джон Гилл (1697–1771)",
    partDialogLabel: "Справочник по Гиллу",
    partToc: [
    {
      roman: "I",
      title: "Масштаб корпуса",
      subtitle: "● Глава 1",
      href: "#sec-prdl",
      current: true,
    },
    {
      roman: "II",
      title: "Хронология жизни и служения",
      subtitle: "Глава 2",
      href: "#sec-timeline",
    },
    {
      roman: "III",
      title: "Основные труды",
      subtitle: "Глава 3",
      href: "#sec-works",
    },
    {
      roman: "IV",
      title: "Структура «Свода богословия»",
      subtitle: "Глава 4",
      href: "#sec-body-structure",
    },
    {
      roman: "V",
      title: "Сеть влияний и наследников",
      subtitle: "Глава 5",
      href: "#sec-network",
    },
    {
      roman: "VI",
      title: "Спорные темы и как их читать",
      subtitle: "Глава 6",
      href: "#sec-disputes",
    },
    {
      roman: "VII",
      title: "Богословский словарь эпохи",
      subtitle: "Глава 7",
      href: "#sec-terms",
    },
    {
      roman: "VIII",
      title: "Читать дальше",
      subtitle: "Глава 8",
      href: "#sec-links",
    },
    {
      roman: "IX",
      title: "Проверь себя",
      subtitle: "Глава 9",
      href: "#sec-quiz",
    }
    ],
  },
}

export function getGillSeriesItem(pageId: GillSeriesPageId): GillSeriesItem {
  const item = GILL_SERIES_ITEMS.find((entry) => entry.id === pageId);
  if (!item) throw new Error(`Unknown Gill page id: ${pageId}`);
  return item;
}
