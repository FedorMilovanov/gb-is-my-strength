/**
 * hardTextsSeriesConfig.ts — серия «Тайны человеческого сердца» на общем
 * series-движке (второй инстанс после Гилла).
 *
 * Всё серия-специфичное ДЕРИВИРУЕТСЯ из heartSeriesData (единый источник
 * порядка/минут/лент) — руками здесь живут только оглавления частей
 * (partToc), снятые с собранных статей (dist), и обложки карточки
 * «Сейчас читаете». Quiz пуст → вкладка «Тест» в «Обучении» скрыта движком.
 */
import { SERIES_CONFIGS, type SeriesConfig, type SeriesPageChromeData, type SeriesPartTocItem, defineSeriesConfig } from './seriesConfig';
import {
  HEART_SERIES_ITEMS,
  heartRoman,
  heartProgress,
  type HeartPageId,
} from '../heartSeriesData';

/** Оглавления частей (H2 из собранных статей; карточка «Коротко» не входит —
 *  это резюме, а не раздел). Первый ряд каждой части помечен current для
 *  стартового состояния аккордеона. */
const HARD_TEXTS_PART_TOC: Record<HeartPageId, SeriesPartTocItem[]> = {
  prolog: [
    { href: '#nepravilno-slyshim', label: 'Почему мы неправильно слышим слово «сердце»', level: 2, current: true },
    { href: '#vnutrenniy-chelovek', label: 'Сердце — весь внутренний человек перед Богом', level: 2 },
    { href: '#serdce-dusha-duh', label: 'Сердце, душа, дух и ум: один человек с разных сторон', level: 2 },
    { href: '#bog-trebuet-vsyo', label: 'Бог требует всё сердце', level: 2 },
    { href: '#bog-vidit-serdce', label: 'Бог видит и испытывает сердце', level: 2 },
    { href: '#serdce-myslit', label: 'Сердце мыслит, помнит, рассуждает', level: 2 },
    { href: '#serdce-reshaet', label: 'Сердце решает: воля, намерение, направление', level: 2 },
    { href: '#serdce-lyubit', label: 'Сердце любит, доверяет и ищет сокровище', level: 2 },
    { href: '#serdce-chuvstvuet', label: 'Да, сердце чувствует — но чувство не одно', level: 2 },
    { href: '#serdce-govorit', label: 'Сердце говорит и действует: источник', level: 2 },
    { href: '#serdce-sovest', label: 'Сердце как совесть: внутренний свидетель', level: 2 },
    { href: '#padshee-serdce', label: 'Падшее сердце: обман, ожесточение, нечистота', level: 2 },
    { href: '#novoe-serdce', label: 'Новое сердце: обетование и Дух', level: 2 },
    { href: '#serdce-veruet', label: 'Сердцем веруют', level: 2 },
    { href: '#hranit-serdce', label: 'Сердце верующего: хранить и освящать', level: 2 },
    { href: '#serdce-boga', label: 'У Бога тоже есть сердце', level: 2 },
    { href: '#karta-pisaniya', label: 'Карта Писания: сердце по граням', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#vyhod', label: 'Выход: не «слушай сердце», а неси сердце к Богу', level: 2 },
  ],
  krajne: [
    { href: '#istoricheskiy-fon', label: 'I. Исторический фон: почему Иеремия говорит так резко', level: 2, current: true },
    { href: '#greh-vyrezannyy', label: 'II. Иеремия 17:1–4 — грех, вырезанный в человеке', level: 2 },
    { href: '#dva-obraza-doveriya', label: 'III. Иеремия 17:5–8 — два образа доверия', level: 2 },
    { href: '#serdce-istochnik-samoobmana', label: 'IV. Иеремия 17:9–10 — сердце как источник самообмана', level: 2 },
    { href: '#otnositsya-li-k-veruyushchemu', label: 'V. Относится ли Иеремия 17:9 к верующему?', level: 2 },
    { href: '#chto-izmenilos', label: 'VI. Что изменилось у верующего — и что ещё не исчезло', level: 2 },
    { href: '#kak-greh-stanovitsya-strukturoy', label: 'VII. Как грех становится структурой', level: 2 },
    { href: '#kak-nelzya-primenyat', label: 'VIII. Как нельзя применять эти тексты к христианину', level: 2 },
    { href: '#praktika', label: 'IX. Практика: как жить с этим диагнозом', level: 2 },
    { href: '#velikaya-nadezhda', label: 'X. Великая надежда: Бог пишет поверх того, что не смогли стереть мы', level: 2 },
    { href: '#sec-quiz', label: 'Проверь себя', level: 2 },
    { href: '#zaklyuchenie', label: 'Заключение', level: 2 },
    { href: '#istochniki', label: 'Использованные источники', level: 2 },
    { href: '#spravka', label: 'Часто задаваемые вопросы', level: 2 },
  ],
  rimlyanam: [
    { href: '#vopros', label: 'I. В чём именно вопрос', level: 2, current: true },
    { href: '#struktura', label: 'II. Римлянам 6–8: три звена одной цепи', level: 2 },
    { href: '#tekst', label: 'III. Что именно повторяется в Рим. 7:14–25', level: 2 },
    { href: '#pozitsiya-veruyushchiy', label: 'IV. Позиция 1: Павел описывает верующего', level: 2 },
    { href: '#pozitsiya-neveruyushchiy', label: 'V. Позиция 2: Павел описывает человека под законом до освобождения Духом', level: 2 },
    { href: '#lloyd-jones', label: 'VI. Ллойд-Джонс: не зрелый христианин и не обычный невозрождённый', level: 2 },
    { href: '#tmsj', label: 'VII. TMSJ / Джей Стрит: старозаветная борьба глазами Нового Завета', level: 2 },
    { href: '#vyvod', label: 'VIII. Почему я считаю, что Рим. 7 применим к верующему', level: 2 },
    { href: '#pastyrskoe', label: 'IX. Пастырский вывод: кому Рим. 7 утешение, а кому предупреждение', level: 2 },
  ],
  novoe: [
    { href: '#dam-serdce-novoe', label: '«Дам вам сердце новое»', level: 2, current: true },
    { href: '#ne-remont-a-rozhdenie', label: 'Не ремонт, а новое рождение', level: 2 },
    { href: '#chto-novo-chto-net', label: 'Что именно ново — и что ещё нет', level: 2 },
    { href: '#fundament', label: 'Почему это фундамент всего', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-uznat', label: 'Как узнать новое сердце в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: Бог пишет поверх того, что мы не стёрли', level: 2 },
  ],
  'serdce-duh': [
    { href: '#net-osuzhdeniya', label: 'Начало — не усилие, а «нет осуждения»', level: 2, current: true },
    { href: '#pomyshleniya', label: 'Новый строй мыслей', level: 2 },
    { href: '#duh-zhivet', label: 'Дух живёт в вас', level: 2 },
    { href: '#duh-usynovleniya', label: 'Дух усыновления, а не рабства', level: 2 },
    { href: '#sila-i-nemoshch', label: 'И сила, и помощь в немощи', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-uznat', label: 'Как узнать жизнь по Духу в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: Бог в сердце как залог', level: 2 },
  ],
  spravochnik: [
    { href: '#formula', label: 'I. Формула: что Библия называет сердцем', level: 2, current: true },
    { href: '#indeks', label: 'II. Полный библейский индекс сердца', level: 2 },
    { href: '#slovar', label: 'III. Словарь оригинала', level: 2 },
    { href: '#sostoyaniya', label: 'IV. Четыре состояния сердца и четыре свободы воли', level: 2 },
    { href: '#setki', label: 'V. Диагностические сетки', level: 2 },
    { href: '#citaty', label: 'VI. Основоположные цитаты', level: 2 },
    { href: '#ispovedanie', label: 'VII. Исповедный слой', level: 2 },
    { href: '#vyvody', label: 'VIII. Выводы без воды', level: 2 },
    { href: '#seriya', label: 'IX. Вся серия по порядку', level: 2 },
  ],
};

/** Обложка карточки «Сейчас читаете» (относительно /articles/<slug>/). */
const RAIL_COVERS: Record<HeartPageId, string> = {
  prolog: '../../images/og-chto-bibliya-nazyvaet-serdcem-600w.webp',
  krajne: '../../images/og-krajne-isporcheno-600w.webp',
  rimlyanam: '../../images/og-rimlyanam-7-600w.webp',
  novoe: '../../images/ieremia-new-heart-600w.webp',
  'serdce-duh': '../../images/og-series-heart-600w.webp',
  spravochnik: '../../images/og-serdce-spravochnik-600w.webp',
};

const pages: Record<string, SeriesPageChromeData> = {};
for (const item of HEART_SERIES_ITEMS) {
  const roman = heartRoman(item.id);
  const isRoman = item.kind === 'roman';
  const partWord = isRoman ? `Часть ${roman}` : (item.labelMark === 'Справ.' ? 'Справочник' : item.labelMark ?? '');
  const prog = heartProgress(item.id);
  const toc = HARD_TEXTS_PART_TOC[item.id];
  pages[item.id] = {
    id: item.id,
    label: item.railTitle,
    title: item.railTitle,
    mobileSection: toc[0]?.label ?? item.railTitle,
    partLabel: `${partWord} · Содержание`,
    readingProgressDoneMin: prog.doneMin,
    readingProgressPartMin: prog.partMin,
    readingProgressTotalMin: prog.totalMin,
    railNowTitle: isRoman ? `Часть ${roman}. ${item.railTitle}` : item.railTitle,
    railCover: RAIL_COVERS[item.id],
    partDialogLabel: `${partWord} · ${item.railTitle}`,
    partToc: toc,
  };
}

export const HARD_TEXTS_SERIES: SeriesConfig = defineSeriesConfig({
  seriesId: 'hard-texts',
  seriesTitle: 'Тайны человеческого сердца',
  seriesTitleFull: 'Тайны человеческого сердца',
  railBackHref: '../../hard-texts/',
  quiz: [],
  breadcrumbParent: { label: 'Публикации', href: '../../articles/' },
  items: HEART_SERIES_ITEMS.map((item) => ({
    id: item.id,
    mark: item.kind === 'roman'
      ? { kind: 'roman' as const, value: heartRoman(item.id) }
      : { kind: 'label' as const, value: item.labelMark ?? '' },
    title: item.kind === 'roman' ? `Часть ${heartRoman(item.id)}. ${item.railTitle}` : item.railTitle,
    shortTitle: item.railSub,
    href: `/articles/${item.slug}/`,
    readingTime: `${item.minutes} мин`,
    ribbon: item.ribbon,
  })),
  pages,
});

// Регистрируем инстанс в общем реестре движка (lookup по seriesId).
SERIES_CONFIGS[HARD_TEXTS_SERIES.seriesId] = HARD_TEXTS_SERIES;
