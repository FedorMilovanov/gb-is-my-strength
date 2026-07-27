/**
 * Canonical configuration owner for the Genesis 6 reading series.
 *
 * Route activation is staged fail-closed: the shared configuration is registered,
 * while MDX publication flags and all index/search/feed surfaces remain disabled
 * until final exact-head acceptance.
 */
import {
  SERIES_CONFIGS,
  defineSeriesConfig,
  type SeriesConfig,
  type SeriesPageChromeData,
  type SeriesPartTocItem,
} from './seriesConfig';
import { GENESIS6_SERIES_ITEMS, GENESIS6_TOTAL_MIN, type Genesis6SeriesItem } from './genesis6SeriesData';

type Genesis6PageId = Genesis6SeriesItem['id'];

const toc = (rows: Array<[href: string, label: string]>): SeriesPartTocItem[] =>
  rows.map(([href, label], index) => ({ href, label, level: 2, ...(index === 0 ? { current: true } : {}) }));

const GENESIS6_PART_TOC: Record<Genesis6PageId, SeriesPartTocItem[]> = {
  enoch: toc([
    ['#коротко', 'Коротко'],
    ['#что-иуда-утверждает-прямо', 'Что Иуда утверждает прямо'],
    ['#связь-с-1-енох-19', 'Связь с 1 Енох 1:9'],
    ['#пользовался-ли-иуда-письменной-книгой', 'Пользовался ли Иуда письменной книгой'],
    ['#что-такое-4q204', 'Что такое 4Q204'],
    ['#чернила-и-реконструкция', 'Чернила и реконструкция'],
    ['#что-4q204-действительно-доказывает', 'Что 4Q204 действительно доказывает'],
    ['#как-показывать-4q204-на-сайте', 'Как показывать 4Q204 на сайте'],
    ['#могло-ли-пророчество-восходить-к-самому-еноху', 'Могло ли пророчество восходить к самому Еноху'],
    ['#канонизирует-ли-иуда-весь-1-енох', 'Канонизирует ли Иуда весь 1 Енох'],
    ['#почему-это-пророчество-важно-для-иуды', 'Почему это пророчество важно для Иуды'],
    ['#итог', 'Итог'],
  ]),
  angels: toc([
    ['#коротко', 'Коротко'],
    ['#что-иуда-говорит-прямо', 'Что Иуда говорит прямо'],
    ['#почему-иуд-7-является-решающим-контекстом', 'Почему Иуд. 7 является решающим контекстом'],
    ['#кто-предался-сексуальному-нечестию', 'Кто предался сексуальному нечестию'],
    ['#что-означает-иная-плоть', 'Что означает «иная плоть»'],
    ['#как-иуда-использует-енохову-традицию', 'Как Иуда использует Енохову традицию'],
    ['#что-говорит-2-петра-24', 'Что говорит 2 Петра 2:4'],
    ['#ангелы-древний-мир-и-потоп', 'Ангелы, древний мир и Потоп'],
    ['#что-значит-низвергнув-в-тартар', 'Что значит «низвергнув в Тартар»'],
    ['#цепями-или-ямами-мрака', '«Цепями» или «ямами» мрака'],
    ['#почему-ангельское-толкование-быт-6-остаётся-лучшим', 'Почему ангельское толкование Быт. 6 остаётся лучшим'],
    ['#альтернативы', 'Альтернативы'],
    ['#богословская-цель', 'Богословская цель'],
    ['#итог', 'Итог'],
  ]),
  spirits: toc([
    ['#коротко', 'Коротко'],
    ['#христос-пострадал-один-раз-за-грехи', 'Христос пострадал один раз за грехи'],
    ['#кто-такие-духи-в-темнице', 'Кто такие «духи в темнице»'],
    ['#ангелы-и-духи-погибших-исполинов', 'Ангелы и духи погибших исполинов'],
    ['#что-христос-им-провозгласил', 'Что Христос им провозгласил'],
    ['#когда-произошло-провозглашение', 'Когда произошло провозглашение'],
    ['#проповедь-через-ноя-серьёзная-альтернатива', 'Проповедь через Ноя: серьёзная альтернатива'],
    ['#почему-упомянуты-дни-ноя', 'Почему упомянуты дни Ноя'],
    ['#вода-суда-и-ковчег', 'Вода суда и ковчег'],
    ['#крещение-теперь-спасает-вас', '«Крещение теперь спасает вас»'],
    ['#что-исключает-фраза-о-телесной-грязи', 'Что исключает фраза о телесной грязи'],
    ['#крещение-духом-и-союз-со-христом', 'Крещение Духом и союз со Христом'],
    ['#роль-воскресения', 'Роль воскресения'],
    ['#христос-одесную-бога', 'Христос одесную Бога'],
    ['#итог', 'Итог'],
  ]),
  dead: toc([
    ['#коротко', 'Коротко'],
    ['#непосредственный-контекст', 'Непосредственный контекст'],
    ['#кто-такие-мёртвые', 'Кто такие «мёртвые»'],
    ['#в-оригинале-нет-слова-теперь', 'В оригинале нет слова «теперь»'],
    ['#основное-чтение-услышали-при-жизни-и-позднее-умерли', 'Основное чтение: услышали при жизни и позднее умерли'],
    ['#серьёзная-альтернатива-благовестие-уже-умершим', 'Серьёзная альтернатива: благовестие уже умершим'],
    ['#почему-1-пет-319-и-46-нельзя-автоматически-объединить', 'Почему 1 Пет. 3:19 и 4:6 нельзя автоматически объединить'],
    ['#подверглись-суду-по-человеку-плотью', '«Подверглись суду по человеку плотью»'],
    ['#жили-по-богу-духом', '«Жили по Богу духом»'],
    ['#почему-стих-не-учит-крещению-за-умерших', 'Почему стих не учит крещению за умерших'],
    ['#пастырская-цель', 'Пастырская цель'],
    ['#итог', 'Итог'],
  ]),
};

let doneMin = 0;
const pages: Record<string, SeriesPageChromeData> = {};
for (const item of GENESIS6_SERIES_ITEMS) {
  pages[item.id] = {
    id: item.id,
    label: item.shortTitle,
    title: item.title,
    mobileSection: GENESIS6_PART_TOC[item.id][0].label,
    partLabel: `Часть ${item.roman} · Содержание`,
    readingProgressDoneMin: doneMin,
    readingProgressPartMin: item.minutes,
    readingProgressTotalMin: GENESIS6_TOTAL_MIN,
    railNowTitle: item.shortTitle,
    railCover: item.cover,
    partDialogLabel: `Часть ${item.roman} · ${item.shortTitle}`,
    partToc: GENESIS6_PART_TOC[item.id],
  };
  doneMin += item.minutes;
}

export const GENESIS6_SERIES: SeriesConfig = defineSeriesConfig({
  seriesId: 'genesis-6',
  seriesTitle: 'Бытие 6, Енох, Иуда и Пётр',
  seriesTitleFull: 'Бытие 6, Енох, Иуда и Первое послание Петра',
  railBackHref: '../../hard-texts/genesis-6/',
  theme: 'manuscript',
  quiz: [],
  breadcrumbParent: { label: 'Трудные тексты', href: '../../hard-texts/' },
  items: GENESIS6_SERIES_ITEMS.map((item) => ({
    id: item.id,
    mark: { kind: 'roman' as const, value: item.roman },
    title: item.title,
    shortTitle: item.shortTitle,
    href: `/hard-texts/${item.slug}/`,
    readingTime: `${item.minutes} мин`,
  })),
  pages,
});

// Register the instance in the shared series lookup. Public routes still obey
// their independent draft/noindex and search-policy publication barriers.
SERIES_CONFIGS[GENESIS6_SERIES.seriesId] = GENESIS6_SERIES;
