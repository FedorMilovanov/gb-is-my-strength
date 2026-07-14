/**
 * hardTextsSeriesConfig.ts — серия «Тайны человеческого сердца» на общем
 * series-движке (второй инстанс после Гилла).
 *
 * Всё серия-специфичное ДЕРИВИРУЕТСЯ из heartSeriesData (единый источник
 * порядка/минут/лент) — руками здесь живут только оглавления частей
 * (partToc), снятые с собранных статей, и обложки карточки «Сейчас читаете».
 * Quiz пуст → вкладка «Тест» в «Обучении» скрыта движком.
 *
 * СПУТНИКИ (SERIES-ENGINE-GUIDE §1): 18 материалов пяти Движений А–Д —
 * ярус tier:'satellite' с mark {kind:'letter'} и parent. В рельс и счёт
 * «Часть N из M» не входят; живут в аккордеоне «Оглавление части» под своей
 * родительской частью. Родители выбраны по канонической архитектуре серии
 * (docs/HEART-SERIES-ARCHITECTURE-2026-07-12.md):
 *   Движение А (где прячется сердце)      → часть I  (krajne, диагноз);
 *   Движения Б+В (выходы сердца; тьма)    → часть II (rimlyanam, война);
 *   Движение Г (война и перемена)         → часть III (novoe, перелом);
 *   Движение Д (помощь и финал)           → часть IV (serdce-duh, жизнь Духом).
 */
import { SERIES_CONFIGS, type SeriesConfig, type SeriesItem, type SeriesPageChromeData, type SeriesPartTocItem, defineSeriesConfig } from './seriesConfig';
import {
  HEART_SERIES_ITEMS,
  HEART_TOTAL_MIN,
  heartRoman,
  heartProgress,
  type HeartPageId,
} from '../heartSeriesData';

/** Оглавления частей ядра (H2 из собранных статей; карточка «Коротко» не
 *  входит — это резюме, а не раздел). Первый ряд каждой части помечен current
 *  для стартового состояния аккордеона. */
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
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как отличить в себе', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  novoe: [
    { href: '#ne-radi-vas', label: '«Не ради вас» — прежде обетования', level: 2, current: true },
    { href: '#obrezanie-serdca', label: 'Обрезание сердца: обетование старше пророков', level: 2 },
    { href: '#dam-serdce-novoe', label: '«Дам вам сердце новое»', level: 2 },
    { href: '#ne-remont-a-rozhdenie', label: 'Не ремонт, а новое рождение', level: 2 },
    { href: '#zavet-na-serdce', label: 'Завет, написанный на сердце', level: 2 },
    { href: '#chto-novo-chto-net', label: 'Что именно ново — и что ещё нет', level: 2 },
    { href: '#lidiya', label: 'Как это выглядит в жизни: Лидия', level: 2 },
    { href: '#fundament', label: 'Почему это фундамент всего', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-uznat', label: 'Как узнать новое сердце в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: Бог пишет поверх того, что мы не стёрли', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  'serdce-duh': [
    { href: '#net-osuzhdeniya', label: 'Начало — не усилие, а «нет осуждения»', level: 2, current: true },
    { href: '#pomyshleniya', label: 'Новый строй мыслей', level: 2 },
    { href: '#duh-zhivet', label: 'Дух живёт в вас', level: 2 },
    { href: '#duh-usynovleniya', label: 'Дух усыновления, а не рабства', level: 2 },
    { href: '#stenanie-tvari', label: 'Стенание твари и стенание сердца', level: 2 },
    { href: '#sila-i-nemoshch', label: 'Дух ходатайствует в немощи', level: 2 },
    { href: '#zolotaya-cep', label: 'Золотая цепь спасения', level: 2 },
    { href: '#esli-bog-za-nas', label: 'Если Бог за нас', level: 2 },
    { href: '#dvoynoe-hodatajstvo', label: 'Кто осудит? Двойное ходатайство', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-uznat', label: 'Как узнать жизнь по Духу в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: ничто не отлучит', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
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

/* ============================ СПУТНИКИ (А–Д) ============================ */

interface HeartSatelliteDef {
  id: string;
  mark: string;            // «А1»…«Д3» — буква Движения + номер
  parent: HeartPageId;     // родительская часть аккордеона
  slug: string;
  minutes: number;
  railTitle: string;       // заголовок карточки «Сейчас читаете» / оверлея
  shortTitle: string;      // строка спутника в аккордеоне
}

const HEART_SATELLITES: HeartSatelliteDef[] = [
  // Движение А. Где прячется сердце → часть I (диагноз)
  { id: 'idoly', mark: 'А1', parent: 'krajne', slug: 'skrytye-idoly-serdca', minutes: 26,
    railTitle: 'Скрытые идолы сердца', shortTitle: 'Чему сердце поклоняется, не замечая' },
  { id: 'religioznoe', mark: 'А2', parent: 'krajne', slug: 'religioznoe-serdce', minutes: 26,
    railTitle: 'Религиозное сердце', shortTitle: 'Благочестие как маска' },
  { id: 'sovest', mark: 'А3', parent: 'krajne', slug: 'sovest-vnutrenniy-sud', minutes: 30,
    railTitle: 'Совесть: внутренний суд', shortTitle: 'Судья, с которым сердце торгуется' },
  { id: 'myslennaya', mark: 'А4', parent: 'krajne', slug: 'myslennaya-zhizn-serdca', minutes: 26,
    railTitle: 'Мысленная жизнь сердца', shortTitle: 'Поток мыслей и библейская медитация' },
  { id: 'dorozhki', mark: 'А5', parent: 'krajne', slug: 'starye-dorozhki-serdca', minutes: 28,
    railTitle: 'Старые дорожки сердца', shortTitle: 'Привычка, детство и стыд' },
  // Движение Б. Сердце выходит наружу → часть II (война в членах)
  { id: 'yazyk', mark: 'Б1', parent: 'rimlyanam', slug: 'serdce-i-yazyk', minutes: 25,
    railTitle: 'Сердце и язык', shortTitle: 'Из избытка сердца говорят уста' },
  { id: 'telo', mark: 'Б2', parent: 'rimlyanam', slug: 'serdce-i-telo', minutes: 23,
    railTitle: 'Сердце и тело', shortTitle: 'Члены как орудия, комфорт, аппетиты' },
  { id: 'sokrovishche', mark: 'Б3', parent: 'rimlyanam', slug: 'serdce-i-sokrovishche', minutes: 25,
    railTitle: 'Сердце и сокровище', shortTitle: 'Деньги, статус и довольство' },
  // Движение В. Сердце в темноте → часть II («бедный я человек»)
  { id: 'tma', mark: 'В1', parent: 'rimlyanam', slug: 'tma-na-serdce', minutes: 26,
    railTitle: 'Тьма на сердце', shortTitle: 'Всегда ли уныние — грех?' },
  { id: 'skorb', mark: 'В2', parent: 'rimlyanam', slug: 'serdce-pod-skorbyu', minutes: 28,
    railTitle: 'Сердце под скорбью', shortTitle: 'Страдание, провидение и плач' },
  // Движение Г. Война и перемена → часть III (перелом)
  { id: 'menyaetsya', mark: 'Г1', parent: 'novoe', slug: 'kak-menyaetsya-serdce', minutes: 27,
    railTitle: 'Как меняется сердце', shortTitle: 'Умерщвление греха и новая любовь' },
  { id: 'iskushenie', mark: 'Г2', parent: 'novoe', slug: 'serdce-i-iskushenie', minutes: 26,
    railTitle: 'Сердце и искушение', shortTitle: 'Переговоры, которых нельзя вести' },
  { id: 'hranit', mark: 'Г3', parent: 'novoe', slug: 'kak-hranit-serdce', minutes: 26,
    railTitle: 'Как хранить сердце', shortTitle: 'Притчи 4:23 и средства благодати' },
  { id: 'strah', mark: 'Г4', parent: 'novoe', slug: 'strah-bozhij-rabskij-ili-synovnij', minutes: 25,
    railTitle: 'Страх Божий', shortTitle: 'Рабский или сыновний?' },
  { id: 'svoboda', mark: 'Г5', parent: 'novoe', slug: 'svoboda-vo-hriste', minutes: 26,
    railTitle: 'Свобода во Христе', shortTitle: 'От престола греха — не от борьбы' },
  // Движение Д. Помощь и финал → часть IV (жизнь Духом)
  { id: 'odinochku', mark: 'Д1', parent: 'serdce-duh', slug: 'serdce-ne-v-odinochku', minutes: 27,
    railTitle: 'Сердце не в одиночку', shortTitle: 'Церковь, исповедь, восстановление' },
  { id: 'hrista', mark: 'Д2', parent: 'serdce-duh', slug: 'serdce-hrista-k-nemoshchnym', minutes: 44,
    railTitle: 'Сердце Христа', shortTitle: 'Образ Отца, Спаситель врагов, сила немощным' },
  { id: 'osvobozhdennoe', mark: 'Д3', parent: 'serdce-duh', slug: 'osvobozhdennoe-serdce', minutes: 27,
    railTitle: 'Освобождённое сердце', shortTitle: 'Конец войне: вечный покой' },
];

/** Оглавления спутников (H2 собранных статей). */
const HEART_SATELLITE_TOC: Record<string, SeriesPartTocItem[]> = {
  idoly: [
    { href: '#serdce-poklonyaetsya', label: 'Сердце создано поклоняться', level: 2, current: true },
    { href: '#serdce-ishchet-sokrovishche', label: 'Сердце ищет сокровище', level: 2 },
    { href: '#idol-vnutri', label: 'Идол, переселившийся внутрь', level: 2 },
    { href: '#masterskaya-idolov', label: '«Мастерская идолов» — с важной оговоркой', level: 2 },
    { href: '#mehanizm-obmena', label: 'Механизм: обмен', level: 2 },
    { href: '#tverdo-no-chestno', label: 'Твёрдо, но честно: не всякая любовь — идол', level: 2 },
    { href: '#rentgen-serdca', label: 'Рентген сердца: где искать идола', level: 2 },
    { href: '#peremena-novaya-lyubov', label: 'Перемена — не морализм, а новая любовь', level: 2 },
    { href: '#zaklyuchenie', label: 'Заключение', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  religioznoe: [
    { href: '#ustami-chtut', label: 'Устами чтут, сердцем далеко', level: 2, current: true },
    { href: '#pochti-hristianin', label: '«Почти христианин»', level: 2 },
    { href: '#farisey-mytar', label: 'Фарисей и мытарь', level: 2 },
    { href: '#prakticheskiy-ateizm', label: 'Практический атеизм в религиозной форме', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как отличить — прежде всего в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: не больше религии, а Христос', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  sovest: [
    { href: '#chto-takoe-sovest', label: 'Судья, а не бог: что такое совесть', level: 2, current: true },
    { href: '#vnutrennyaya-advokatura', label: 'Внутренняя адвокатура: как сердце договаривается с судьёй', level: 2 },
    { href: '#tipologiya-sovesti', label: 'Три голоса, которые легко перепутать', level: 2 },
    { href: '#lozhnyj-mir', label: 'Ложный мир против евангельского мира', level: 2 },
    { href: '#ozhestochenie-vs-borba', label: 'Ожесточение — не то же самое, что тяжёлая, долгая борьба', level: 2 },
    { href: '#klejmo-i-krov', label: 'Клеймо и кровь: 1 Тим. 4:2 и Евр. 9:14; 10:22', level: 2 },
    { href: '#serdce-bolshe-serdca', label: '«Бог больше сердца нашего»: утешение или предупреждение?', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как отличить в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: не заглушить совесть, а привести её ко Христу', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  myslennaya: [
    { href: '#potok-myslej-sledy-serdca', label: 'Поток мыслей — не шум, а следы сердца', level: 2, current: true },
    { href: '#voobrazhenie-fabrika-boga', label: 'Воображение: фабрика удобного Бога', level: 2 },
    { href: '#myslednye-pomysly', label: 'Мысли, которые «поселяются»: суетные помыслы', level: 2 },
    { href: '#ne-vsyakaya-mysl-eto-ty', label: 'Не всякая мысль — это ты', level: 2 },
    { href: '#bibleiskaya-meditatsiya', label: 'Библейская медитация: не пустота ума и не техника', level: 2 },
    { href: '#obekty-meditatsii', label: 'Чем на самом деле кормится сердце', level: 2 },
    { href: '#protokol', label: 'Небольшой практический шаг', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как отличить в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: сокровищница прежде, чем слово', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  dorozhki: [
    { href: '#ya-prosto-takoj', label: '«Я просто такой»: опасная фраза', level: 2, current: true },
    { href: '#skorost-ne-napravlenie', label: 'Привычка объясняет скорость, но не направление', level: 2 },
    { href: '#vtoraya-natura', label: '«Вторая натура»: когда привычка застывает', level: 2 },
    { href: '#pamyat-i-telo', label: 'Где живёт старая дорожка: память и тело', level: 2 },
    { href: '#detstvo', label: 'Детская карта мира: серьёзно, но не окончательно', level: 2 },
    { href: '#styd', label: 'Стыд: старая рана, надевшая маску личности', level: 2 },
    { href: '#strah-cheloveka', label: 'Страх человека: колея, которая ловит', level: 2 },
    { href: '#bystrota-ne-prigovor', label: 'Быстрота — мера привычки, а не приговор', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как отличить в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: не перепрошивка, а новое сердце', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  yazyk: [
    { href: '#yazyk-forma-serdca', label: 'Язык — слышимая форма сердца', level: 2, current: true },
    { href: '#dazhe-prazdnoe-slovo', label: 'Даже праздное слово', level: 2 },
    { href: '#malenkij-chlen', label: 'Маленький член, большие пожары', level: 2 },
    { href: '#blagoslovenie-i-proklyatie', label: 'Благословение и проклятие из одних уст', level: 2 },
    { href: '#ne-lechitsya-vezhlivostyu', label: 'Грех языка не лечится вежливостью', level: 2 },
    { href: '#smert-i-zhizn', label: 'Смерть и жизнь — в руке языка', level: 2 },
    { href: '#ne-zakryvat-rot-plachushchemu', label: 'Нельзя закрывать рот плачущему', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как отличить в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: новое сердце учится новому языку', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  telo: [
    { href: '#telo-ne-vrag', label: 'Тело — не враг: «плоть» не равно телу', level: 2, current: true },
    { href: '#chleny-oruzhie', label: 'Члены как орудия — а точнее, оружие', level: 2 },
    { href: '#hram-kuplennyj', label: 'Тело — храм, купленный ценою', level: 2 },
    { href: '#zhivaya-zhertva', label: 'Тело как живая жертва: телесное — это поклонение', level: 2 },
    { href: '#komfort-gospodin', label: 'Комфорт как невидимый господин', level: 2 },
    { href: '#ustalost', label: 'Усталость: милость и диагностика', level: 2 },
    { href: '#ne-hlebom-odnim', label: '«Не хлебом одним»', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как отличить в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: вернуть тело Господу', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  sokrovishche: [
    { href: '#bogatyj-bezumec', label: 'Богатый безумец: не амбары, а пустая душа', level: 2, current: true },
    { href: '#koren-ne-dengi', label: 'Корень — не деньги, а любовь к деньгам', level: 2 },
    { href: '#dovolstvo-vyuchennoe', label: 'Довольство — не природное, а выученное', level: 2 },
    { href: '#osnovanie-prisutstvie', label: 'Основание довольства — присутствие, а не сумма', level: 2 },
    { href: '#bednaya-i-bogataya-zhadnost', label: 'Бедная и богатая жадность', level: 2 },
    { href: '#hristos-obnishchal', label: 'Христос обнищал, чтобы мы обогатились', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как отличить в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: сокровище, которого не потребуют обратно', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  tma: [
    { href: '#ditya-sveta-vo-tme', label: 'Дитя света, ходящее во тьме', level: 2, current: true },
    { href: '#psalmopevec-sporit', label: 'Псалмопевец спорит с собственной душой', level: 2 },
    { href: '#ne-odin-diagnoz', label: 'Не один диагноз, а много', level: 2 },
    { href: '#kogda-tma-bolezn', label: 'Когда тьма — это болезнь тела', level: 2 },
    { href: '#iliya-pod-mozhzhevelnikom', label: 'Илия под можжевельником', level: 2 },
    { href: '#oblichenie-i-obvinenie', label: 'Обличение и обвинение — не одно и то же', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#so-svoej-tmoj', label: 'Как быть с собственной тьмой', level: 2 },
    { href: '#vyhod', label: 'Выход: не свет по требованию, а верность в темноте', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  skorb: [
    { href: '#stradanie-vskryvaet', label: 'Страдание вскрывает, а не создаёт', level: 2, current: true },
    { href: '#ne-vsyakaya-bol-nakazanie', label: 'Не всякая боль — наказание', level: 2 },
    { href: '#ispytanie-ne-iskushenie', label: 'Испытание — не искушение', level: 2 },
    { href: '#plach-forma-very', label: 'Плач — форма веры, а не её отсутствие', level: 2 },
    { href: '#providenie-ne-molotok', label: 'Провидение: утешение, но не молоток', level: 2 },
    { href: '#uteshenie-bez-deshevyh-otvetov', label: 'Утешение без дешёвых ответов', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как отличить в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: изгиб в уделе — в руке Отца', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  menyaetsya: [
    { href: '#dva-nevernyh-otveta', label: 'Два неверных ответа', level: 2, current: true },
    { href: '#ostayushchiysya-i-carstvuyushchiy', label: 'Остающийся грех и царствующий грех', level: 2 },
    { href: '#ne-zakon-a-blagodat', label: 'Не закон, а благодать', level: 2 },
    { href: '#umershchvlenie', label: 'Умерщвление: активно, но духом', level: 2 },
    { href: '#novaya-lyubov', label: 'Новая любовь, которая вытесняет старую', level: 2 },
    { href: '#gde-idyot-boj', label: 'Где на самом деле идёт бой', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#dlya-sebya', label: 'Как это проверить на себе', level: 2 },
    { href: '#vyhod', label: 'Выход: престол уже занят', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  iskushenie: [
    { href: '#iskushenie-ne-greh', label: 'Искушение — ещё не грех', level: 2, current: true },
    { href: '#anatomiya', label: 'Анатомия: где сердце входит в западню', level: 2 },
    { href: '#vojti-v-iskushenie', label: 'Войти в искушение — больше, чем быть искушаемым', level: 2 },
    { href: '#primanka-i-kryuchok', label: 'Приманка, лекарство и «разумный довод»', level: 2 },
    { href: '#znaj-svoj-sostav', label: 'Знай свой состав, разъединяй огонь и солому', level: 2 },
    { href: '#ne-tolko-strah', label: 'Не только страх, но вкус лучшей любви', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#dlya-sebya', label: 'Как проверить собственное искушение', level: 2 },
    { href: '#vyhod', label: 'Выход: искушение дважды лжёт о Христе', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  hranit: [
    { href: '#istochnik', label: 'Стража у источника: Притчи 4:23', level: 2, current: true },
    { href: '#ne-razovaya-pobeda', label: 'Хранение — не разовая победа, а постоянная стража', level: 2 },
    { href: '#sezony', label: 'Сезоны хранения', level: 2 },
    { href: '#sredstva-blagodati', label: 'Средства благодати — дороги, а не кнопки', level: 2 },
    { href: '#slovo-v-serdce', label: 'Слово, сокрытое в сердце', level: 2 },
    { href: '#pamyat-strazh', label: 'Память как страж', level: 2 },
    { href: '#bditelnost', label: 'Бдительность: бодрствуйте и молитесь', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как это выглядит в жизни', level: 2 },
    { href: '#vyhod', label: 'Выход: Бог обещает не управление Собой, а Себя', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  strah: [
    { href: '#dva-straha', label: 'Один приказ, одно обещание — и два страха', level: 2, current: true },
    { href: '#gonit-proch', label: 'Страх, который гонит прочь от Бога', level: 2 },
    { href: '#vlechet-k-bogu', label: 'Страх, который влечёт к Богу', level: 2 },
    { href: '#pochemu-putayut', label: 'Почему их так легко спутать', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как отличить в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: страх, который исцеляет страх', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  svoboda: [
    { href: '#vopros-pavla', label: 'Вопрос, который Павел задал за нас', level: 2, current: true },
    { href: '#mehanizm', label: 'Механизм свободы: не усилие, а смерть со Христом', level: 2 },
    { href: '#prestol-ne-prisutstvie', label: 'От чего свободны: от престола, не от присутствия', level: 2 },
    { href: '#net-svobody-bez-hozyaina', label: 'Свободы «без хозяина» не бывает', level: 2 },
    { href: '#slova-hrista', label: 'Слова Самого Христа: раб греха и свобода Сына', level: 2 },
    { href: '#svoboda-dlya-lyubvi', label: 'Свобода не для плоти, а для любви', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-menyaet-borbu', label: 'Как это меняет борьбу: «почитайте себя»', level: 2 },
    { href: '#vyhod', label: 'Выход: свобода начатая и свобода завершённая', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  odinochku: [
    { href: '#greh-trebuet-odinochestva', label: 'Грех требует одиночества', level: 2, current: true },
    { href: '#ezhednevnoe-slovo', label: 'Ежедневное слово друг друга', level: 2 },
    { href: '#ispoved', label: 'Исповедь — выход из внутреннего суда', level: 2 },
    { href: '#vosstanovlenie', label: 'Восстановление, а не уничтожение', level: 2 },
    { href: '#priobresti-brata', label: 'Цель обличения — приобрести брата', level: 2 },
    { href: '#dvoe-luchshe', label: 'Двое лучше одного', level: 2 },
    { href: '#kogda-cerkov-vredit', label: 'Когда церковь может навредить', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как отличить в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: не в одиночку — и не к общине как к спасителю', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  hrista: [
    { href: '#obraz-otca', label: '«Видевший Меня видел Отца»', level: 2, current: true },
    { href: '#sovershennyj-chelovek', label: 'Единственный истинно человеческий Человек', level: 2 },
    { href: '#pot-krik-borenie', label: 'Пот, крик и борение: как Он это проходил', level: 2 },
    { href: '#dva-estestva-odno-lico', label: 'Два естества, одно Лицо: как это возможно', level: 2 },
    { href: '#umer-za-vragov', label: 'Умер за врагов, а не за уставших друзей', level: 2 },
    { href: '#plot-nepobedimyj-vrag', label: 'Плоть: враг, которого нам не одолеть в одиночку', level: 2 },
    { href: '#serdce-hrista', label: 'Единственное место, где Христос описал Своё сердце', level: 2 },
    { href: '#nadlomlennaya-trost', label: 'Надломленная трость и курящийся лён', level: 2 },
    { href: '#slabaya-vera', label: 'Слабая вера — всё же вера', level: 2 },
    { href: '#slabost-vs-uverennost', label: 'Слабая благодать и ложная уверенность', level: 2 },
    { href: '#plod-ne-spektakl', label: 'Плод, а не спектакль', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-otlichit', label: 'Как отличить в себе', level: 2 },
    { href: '#vyhod', label: 'Выход: не крепость хватки, а крепость Спасателя', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
  osvobozhdennoe: [
    { href: '#chetyre-sostoyaniya', label: 'Четыре состояния сердца', level: 2, current: true },
    { href: '#vopl-i-otvet', label: 'Вопль, на который есть ответ', level: 2 },
    { href: '#ne-besplotnoe-parenie', label: 'Не бесплотное парение, а телесная слава', level: 2 },
    { href: '#ne-sposobno-greshit', label: 'Сердце, не способное грешить', level: 2 },
    { href: '#pobeda-nad-vragom', label: 'Победа над последним врагом', level: 2 },
    { href: '#tverdo-ne-dubinkoy', label: 'Твёрдо, но не дубинкой', level: 2 },
    { href: '#kak-menyaet-borbu', label: 'Как это меняет борьбу сегодня', level: 2 },
    { href: '#vyhod', label: 'Выход: сердце, наконец успокоенное', level: 2 },
    { href: '#istochniki', label: 'Источники и сверка', level: 2 },
  ],
};

/* ============================ Сборка конфига ============================ */

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

// Страницы спутников: полный chrome; прогресс серии — как у родительской
// части (спутник не входит в счёт минут ядра), partMin — свои минуты.
for (const sat of HEART_SATELLITES) {
  const prog = heartProgress(sat.parent);
  const toc = HEART_SATELLITE_TOC[sat.id];
  pages[sat.id] = {
    id: sat.id,
    label: sat.railTitle,
    title: sat.railTitle,
    mobileSection: toc[0]?.label ?? sat.railTitle,
    partLabel: `Движение ${sat.mark} · Содержание`,
    readingProgressDoneMin: prog.doneMin,
    readingProgressPartMin: sat.minutes,
    readingProgressTotalMin: HEART_TOTAL_MIN,
    railNowTitle: `Движение ${sat.mark}. ${sat.railTitle}`,
    railCover: '../../images/og-series-heart-600w.webp',
    partDialogLabel: `Движение ${sat.mark} · ${sat.railTitle}`,
    partToc: toc,
  };
}

const satelliteItems: SeriesItem[] = HEART_SATELLITES.map((sat) => ({
  id: sat.id,
  mark: { kind: 'letter' as const, value: sat.mark },
  title: `Движение ${sat.mark}. ${sat.railTitle}`,
  shortTitle: sat.shortTitle,
  href: `/articles/${sat.slug}/`,
  readingTime: `${sat.minutes} мин`,
  tier: 'satellite' as const,
  parent: sat.parent,
}));

export const HARD_TEXTS_SERIES: SeriesConfig = defineSeriesConfig({
  seriesId: 'hard-texts',
  seriesTitle: 'Тайны человеческого сердца',
  seriesTitleFull: 'Тайны человеческого сердца',
  railBackHref: '../../hard-texts/',
  quiz: [],
  breadcrumbParent: { label: 'Публикации', href: '../../articles/' },
  items: [
    ...HEART_SERIES_ITEMS.map((item) => ({
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
    ...satelliteItems,
  ],
  pages,
});

// Регистрируем инстанс в общем реестре движка (lookup по seriesId).
SERIES_CONFIGS[HARD_TEXTS_SERIES.seriesId] = HARD_TEXTS_SERIES;
