/**
 * apostasySeriesConfig — конфиг серии «Отступники» (5 частей, flat).
 * Источник истины по порядку/минутам; data/series.json и хаб обязаны совпадать.
 */
import { SERIES_CONFIGS, type SeriesConfig, type SeriesPartTocItem, type SeriesQuizItem, defineSeriesConfig } from './seriesConfig';
import { APOSTASY_LEARNING_QUIZ } from '../../apostasy-series/apostasyLearningData';
import { apostasySeriesMediaFor } from './apostasySeriesMedia';

const TOTAL_MIN = 79;
const toc = (...items: SeriesPartTocItem[]): SeriesPartTocItem[] => items;

const part1Toc = toc(
  { href: '#odno-slovo', label: 'Одно слово не рассказывает весь порядок спасения', level: 2, current: true, summary: 'Лексема — доказательство внутри контекста, а не готовая система спасения.' },
  { href: '#desyat-form', label: 'Библия различает как минимум десять форм ухода', level: 2, summary: 'Временная вера, падение, ожесточение, отречение и окончательное отпадение — не одна категория.' },
  { href: '#do-razryva', label: 'Отступничество начинается задолго до открытого разрыва', level: 2, summary: 'Траектория видна раньше публичного конца: сердце меняется до того, как меняются слова.' },
  { href: '#religioznost', label: 'Религиозная активность может обслуживать кризис', level: 2, summary: 'Активность не только скрывает кризис — иногда она его кормит и защищает.' },
  { href: '#ozhestochenie', label: 'Повторное сопротивление свету не оставляет сердце неизменным', level: 2, summary: 'Грех становится устойчивым, когда его перестают называть грехом.' },
  { href: '#vozvrat', label: 'Тот же канон, который предупреждает, постоянно зовёт вернуться', level: 2, summary: 'Предупреждение и призыв к возвращению говорит один и тот же Бог.' },
  { href: '#hard-texts', label: 'Три трудных текста, которые нельзя обезвредить', level: 2, summary: 'Евр. 6, Евр. 10 и 2 Пет. 2 читаются в полную силу — без смягчения и без паники.' },
  { href: '#ioann-i-iakov', label: '1 Ин. 2:19 и Иак. 5 нужны друг другу', level: 2, summary: '«Не были из нас» и «среди вас» — два свидетельства, которые нельзя отменять друг другом.' },
  { href: '#jude', label: 'Иуда соединяет хранение Бога и ответственность церкви', level: 2, summary: '«Могущему сохранить» — и «вырывайте из огня»: суверенность не отменяет действия.' },
  { href: '#revelation', label: 'Откровение сохраняет и предупреждение, и обещание', level: 2, summary: 'Церквам одновременно говорится «покайся» и «побеждающему дам».' },
  { href: '#models', label: 'Можно ли истинно спасённому окончательно отпасть? Основные модели', level: 2, summary: 'Честная карта позиций: где согласие канона, а где расходятся системы.' },
  { href: '#perseverance-not', label: 'Что стойкость святых НЕ означает', level: 2, summary: 'Не отсутствие падений и не бесполезность предупреждений.' },
  { href: '#prosperity', label: 'Процветание и долгий стаж тоже опасны', level: 2, summary: 'Благополучие и стаж могут усыплять не хуже гонений.' },
  { href: '#joshua-22', label: 'Нав. 22: обвинение в отступничестве тоже может быть неточным', level: 2, summary: 'Чем серьёзнее обвинение, тем выше обязанность проверить его правдивость.' },
  { href: '#purpose', label: 'Для чего дана эта доктрина', level: 2, summary: 'Не для ярлыков, а для сохранения: предупреждение всерьёз, кающийся не объявлен погибшим.' },
);

const part2Toc = toc(
  { href: '#judas', label: 'Иуда Искариот: близость ко Христу без спасительной веры', level: 2, current: true, summary: 'Служение, дары и близость не равны спасительному единению со Христом.' },
  { href: '#saul', label: 'Саул: помазание, сила Духа и дорога ожесточения', level: 2, summary: 'Реальные дары — и реальный конец без восстановления: траектория, а не момент.' },
  { href: '#jeroboam', label: 'Иеровоам: когда личный страх превращается в систему', level: 2, summary: 'Страх за власть перестраивает культ и богословие под нового господина.' },
  { href: '#kings-17', label: '4 Цар. 17: синкретизм может сохранять религиозный язык', level: 2, summary: 'Формальное признание Бога не всегда означает, что Он — единственный Господь.' },
  { href: '#solomon', label: 'Соломон: позднее падение после мудрости и славы', level: 2, summary: 'Мудрость и благословение не страхуют от позднего отпадения сердца.' },
  { href: '#demas', label: 'Димас: «возлюбив нынешний век»', level: 2, summary: 'Уход без открытого отречения: канон фиксирует мотив, но не финал.' },
  { href: '#hymenaeus-alexander', label: 'Именей и Александр: кораблекрушение в вере и дисциплина', level: 2, summary: '«Предал сатане» — дисциплина с целью научения, а не приговор о вечности.' },
  { href: '#hymenaeus-philetus', label: 'Именей и Филит: ложное учение как гангрена', level: 2, summary: 'Доктринальное отступничество разрушает веру других и распространяется.' },
  { href: '#first-timothy', label: '1 Тим. 4: «некоторые отступят от веры»', level: 2, summary: 'Отступление предсказано как реальность последних времён, а не как гипотеза.' },
  { href: '#titus', label: 'Тит. 1:16: исповедовать Бога и отрицать Его жизнью', level: 2, summary: 'Правильное исповедание не щит против нравственного диагноза.' },
  { href: '#balaam', label: 'Валаам: дар, знание и корысть могут сосуществовать', level: 2, summary: 'Истинные слова по принуждению не равны верному сердцу.' },
  { href: '#second-peter', label: 'Лжеучители 2 Петра: сильный язык нельзя сделать слабым', level: 2, summary: '«Отрекшиеся искупившего их Господа» — язык берётся в полную силу.' },
  { href: '#jude', label: 'Иуда: ложные учители внутри, но «Духа не имеют»', level: 2, summary: 'Присутствие внутри собрания не равно принадлежности Христу.' },
  { href: '#two-errors', label: 'Две ошибки при чтении библейских кейсов', level: 2, summary: 'Всех под одну гребёнку — или никого и никогда: обе крайности против текстов.' },
  { href: '#mechanisms', label: 'Семь повторяющихся механизмов', level: 2, summary: 'Как те же механизмы работают во мне и в церкви задолго до отречения.' },
  { href: '#conclusion', label: 'Личное, доктринальное и институциональное отступничество', level: 2, summary: 'Три уровня одной темы: человек, учение, система.' },
);

const part3Toc = toc(
  { href: '#luke-22', label: 'Христос предсказал не только падение Петра, но и его возвращение', level: 2, current: true, summary: '«Ты некогда, обратившись, утверди братьев твоих» — возвращение предсказано вместе с падением.' },
  { href: '#denial', label: 'Отречение Петра нельзя смягчать ради учения о сохранении', level: 2, summary: 'Трижды «не знаю Этого Человека» — реальное отречение, а не неловкость.' },
  { href: '#tears', label: 'Слёзы Петра важны, но не являются всей причиной различия', level: 2, summary: 'Различие Петра и Иуды глубже эмоциональной реакции на последствия.' },
  { href: '#john-6', label: 'До предательства Иоанн сообщает об Иуде то, чего нельзя сказать о Петре', level: 2, summary: 'Избрание к должности и дары не доказывают спасительного единения со Христом.' },
  { href: '#hidden-trajectory', label: 'Предательство Иуды тоже не возникло из ничего', level: 2, summary: 'Воровство, ропот и постепенное ожесточение предшествуют тридцати сребренникам.' },
  { href: '#peter-control', label: 'Пётр: реальное отречение ещё не тождественно окончательному отступничеству', level: 2, summary: 'Сам факт отречения под страхом не позволяет объявить человека окончательно погибшим.' },
  { href: '#warning-real', label: 'Но предупреждения об отречении остаются настоящими', level: 2, summary: 'Возвращение Петра не обезвреживает предупреждений для остальных.' },
  { href: '#james', label: 'Иаков: человек «среди вас», которого можно вернуть', level: 2, summary: 'Уклонившийся брат — адресат обращения, а не преждевременного приговора.' },
  { href: '#second-timothy', label: 'Павел: исправлять попавших в сеть дьявола с кротостью', level: 2, summary: 'Кротость соединена с надеждой, что Бог даст покаяние.' },
  { href: '#jude-rescue', label: 'Иуда: не только обличать, но и вырывать из огня', level: 2, summary: 'Спасительная настойчивость церкви — часть богословия сохранения.' },
  { href: '#david', label: 'Давид: тяжёлое падение — ни пустяк, ни окончательное отступничество', level: 2, summary: 'Прелюбодеяние и убийство — и восстановление через покаяние Пс. 50.' },
  { href: '#manasseh', label: 'Манассия: нельзя ставить точку раньше текста', level: 2, summary: 'Крайность греха не доказывает невозможности восстановления.' },
  { href: '#consequences', label: 'Покаяние нельзя спутать с отсутствием последствий', level: 2, summary: 'Восстановленный Давид живёт с последствиями: прощение не переписывает историю.' },
  { href: '#discernment', label: 'Как отличать падение от окончательного отступничества?', level: 2, summary: 'Критерии различения: время, отношение ко Христу, ответ на увещание.' },
  { href: '#today-denied', label: 'Если человек сегодня говорит: «Я отрёкся от Христа»', level: 2, summary: 'Пастырский ответ отречению под страхом или в кризисе.' },
  { href: '#today-unbelief', label: 'Если человек говорит: «Я больше не верю и не хочу возвращаться»', level: 2, summary: 'Честный ответ сознательному отвержению без ложной надежды и без ненависти.' },
  { href: '#presumption-despair', label: 'Ложная уверенность и отчаяние — две формы неверия', level: 2, summary: 'Самонадеянность и самоубийственное отчаяние одинаково уводят от Христа.' },
  { href: '#perseverance', label: 'Сохранение святых — не обещание, что святые никогда тяжело не упадут', level: 2, summary: 'Доктрина сохранения держит и серьёзность падений, и верность Бога.' },
  { href: '#judas-warning', label: 'Почему Иуда остаётся настоящим предупреждением для церкви', level: 2, summary: 'Пример Иуды нельзя превратить в абстракцию, не касающуюся собрания.' },
  { href: '#conclusion', label: 'Не называйте Иуду Петром — и Петра Иудой', level: 2, summary: 'Окончательное отвержение реально; тяжёлое падение — ещё не приговор.' },
);

const part4Toc = toc(
  { href: '#pliny', label: 'Плиний Младший: люди, которые сказали, что раньше были христианами', level: 2, current: true, summary: 'Самое раннее внешнее свидетельство публичного отступничества (нач. II века).' },
  { href: '#quintus', label: 'Квинт: самоуверенная смелость не равна стойкости', level: 2, summary: 'Добровольное мученичество, закончившееся сломом при виде зверей.' },
  { href: '#lapsi', label: 'Дециево гонение: вопрос о падших расколол церковь', level: 2, summary: 'Жертва, фимиам или купленный libellus — и спор о возвращении падших.' },
  { href: '#ninus', label: 'Нин, Клементиан и Флор: исповедали, сломались под пытками — и годами каялись', level: 2, summary: 'Киприан (Послание 52): три года покаяния и допущение к общению.' },
  { href: '#novatian', label: 'Спор с Новацианом: тяжёлый грех не должен становиться культом безнадёжности', level: 2, summary: 'Серьёзность греха не требует отрицать возможность покаяния.' },
  { href: '#julian', label: 'Юлиан: от христианского воспитания к антихристианскому проекту', level: 2, summary: 'Публичное отступничество как программа, а не слабость момента.' },
  { href: '#cranmer', label: 'Кранмер: отречения — и последнее публичное возвращение к исповеданию', level: 2, summary: 'Подписанные отречения, затем отречение от отречений и смерть за исповедание.' },
  { href: '#foxe', label: 'Почему Фокса нельзя использовать как единственный источник о Кранмере', level: 2, summary: 'Конфессиональный источник ценен, но жанр и цель должны быть названы.' },
  { href: '#spira', label: 'Франческо Спира: отречение, отчаяние и уверенность в собственной погибели', level: 2, summary: 'Отчаяние, принявшее форму богословия: «я уже погиб» как ловушка.' },
  { href: '#what-history-adds', label: 'Что история добавляет к библейской теме', level: 2, summary: 'Наблюдаемые траектории: сломы, восстановления, ригоризм и его плоды.' },
  { href: '#history-limits', label: 'Что история НЕ может решить за Библию', level: 2, summary: 'История описывает публичную профессию; возрождение — не архивная категория.' },
  { href: '#recoverable-denial', label: 'Пётр, Кранмер и lapsi: одна пастырская линия без искусственного равенства', level: 2, summary: 'Отречение под страхом и возвращение — повторяющаяся линия канона и истории.' },
  { href: '#settled-repudiation', label: 'Юлиан и Плиний: публичное отступничество нельзя растворить в психологии', level: 2, summary: 'Сознательное отвержение — реальная категория, а не только травма.' },
  { href: '#labels', label: 'Почему эта история должна сделать церковь осторожнее с ярлыками', level: 2, summary: 'Церковь III века ошибалась в обе стороны — и цена ошибок видна в архивах.' },
  { href: '#conclusion', label: 'История не даёт права судить сердца — но даёт материал для смирения', level: 2, summary: 'Не давать ложной надежды упорствующему и не закрывать дверь кающемуся.' },
);

const part5Toc = toc(
  { href: '#not-final-judge', label: 'Не объявляйте человека за пределами покаяния раньше Писания', level: 2, current: true, summary: 'Первый пастырский запрет: приговор о вечности — не наша юрисдикция.' },
  { href: '#no-detached-assurance', label: 'Не давайте уверенность, отделённую от Христа', level: 2, summary: 'Библейская уверенность покоится во Христе, а не в сертификате прошлого опыта.' },
  { href: '#exhortation', label: 'Увещевание серьёзно, потому что Бог использует его для сохранения', level: 2, summary: '«Увещевайте каждый день» — назначенный механизм стойкости (Евр. 3).' },
  { href: '#gentleness', label: 'Кротость — не слабость истины', level: 2, summary: 'Исправление в духе кротости (Гал. 6:1) не смягчает диагноз, а меняет руку.' },
  { href: '#discipline', label: 'Церковная дисциплина не равна объявлению вечного проклятия', level: 2, summary: '«Несовместимо с общением» — да; «знаем Божий окончательный приговор» — нет.' },
  { href: '#restoration-consequences', label: 'Восстановление не означает исчезновения всех последствий', level: 2, summary: 'Принятие обратно и последствия идут вместе, как у Давида.' },
  { href: '#response-to-reproof', label: 'Реакция на обличение показывает траекторию лучше первого падения', level: 2, summary: 'Диагноз читается по ответу на свет, а не только по глубине ямы.' },
  { href: '#not-every-crisis', label: 'Не всякое сомнение или кризис — отступничество', level: 2, summary: 'Точность ярлыка защищает и слабого, и серьёзность настоящего отпадения.' },
  { href: '#false-teachers', label: 'Лжеучитель требует другой реакции, чем слабый брат', level: 2, summary: 'Разные категории — разные действия: защита стада и восстановление брата.' },
  { href: '#presumption-despair', label: 'Ложная уверенность и отчаяние — противоположные опасности', level: 2, summary: 'Обе формы неверия уводят от Христа с разных сторон.' },
  { href: '#after-grievous-sin', label: 'После тяжёлого греха нужен Христос, а не приговор о собственной погибели', level: 2, summary: 'Отчаяние Спиры — не образец честности, а ловушка.' },
  { href: '#upstream', label: 'Предотвращать падение нужно раньше публичного отречения', level: 2, summary: 'Работа церкви начинается до кризиса: внимание к ранним сдвигам.' },
  { href: '#remember', label: '«Помни» — одна из главных заповедей против отступления', level: 2, summary: 'Память о Божьих делах как противоядие охлаждению.' },
  { href: '#means', label: 'Не пренебрегайте обычными средствами сохранения', level: 2, summary: 'Слово, общение, увещание, таинства: Бог сохраняет через средства.' },
  { href: '#fear-denial', label: 'Если человек публично отрёкся под страхом', level: 2, summary: 'Линия Петра, lapsi и Кранмер: путь обратно открыт и конкретен.' },
  { href: '#settled-rejection', label: 'Если человек сознательно и долго отвергает Христа', level: 2, summary: 'Честность без ненависти: ни ложной надежды, ни закрытия сердца людей.' },
  { href: '#family', label: 'Что делать семье?', level: 2, summary: 'Любовь, границы и молитва без манипуляции и без отречения от ушедшего.' },
  { href: '#church-culture', label: 'Церковь труднее для лжеучителя и безопаснее для кающегося', level: 2, summary: 'Культура общины как часть богословия сохранения.' },
  { href: '#active-perseverance', label: 'Стойкость святых должна делать церковь активнее, а не пассивнее', level: 2, summary: 'Божье сохранение совершается через действия церкви, а не вместо них.' },
  { href: '#conclusion', label: 'Предупреждение без жестокости, милость без самообмана', level: 2, summary: 'Не давайте ложной надежды отвергающему — и не закрывайте дверь возвращающемуся.' },
);

export const APOSTASY_SERIES: SeriesConfig = defineSeriesConfig({
  seriesId: 'apostasy-series',
  seriesTitle: 'Отступники',
  seriesTitleFull: 'Отступники: отступничество, падение и возвращение в Библии и истории Церкви',
  railBackHref: '/otstupniki/',
  quiz: APOSTASY_LEARNING_QUIZ as unknown as SeriesQuizItem[],
  breadcrumbParent: { label: 'Отступники', href: '/otstupniki/' },
  items: [
    { id: 'otstuplenie-chto-govorit-bibliya', mark: { kind: 'roman', value: 'I' }, title: 'Часть I. Что Библия на самом деле называет отпадением от веры', shortTitle: 'Что говорит Библия', href: '/articles/otstuplenie-chto-govorit-bibliya/', readingTime: '18 мин' },
    { id: 'otstupniki-biblii-iuda-saul-ierovoam-dimas', mark: { kind: 'roman', value: 'II' }, title: 'Часть II. Отступники Библии: Иуда, Саул, Иеровоам, Димас', shortTitle: 'Отступники Библии', href: '/articles/otstupniki-biblii-iuda-saul-ierovoam-dimas/', readingTime: '15 мин' },
    { id: 'petr-i-iuda-padenie-ili-otstuplenie', mark: { kind: 'roman', value: 'III' }, title: 'Часть III. Пётр и Иуда: падение или отступничество?', shortTitle: 'Пётр и Иуда', href: '/articles/petr-i-iuda-padenie-ili-otstuplenie/', readingTime: '17 мин' },
    { id: 'otreklis-ot-hrista-istoriya-cerkvi', mark: { kind: 'roman', value: 'IV' }, title: 'Часть IV. Отреклись от Христа: история Церкви', shortTitle: 'История Церкви', href: '/articles/otreklis-ot-hrista-istoriya-cerkvi/', readingTime: '13 мин' },
    { id: 'kogda-chelovek-uhodit-ot-very', mark: { kind: 'roman', value: 'V' }, title: 'Часть V. Когда человек уходит от веры: предупреждать, исправлять, возвращать', shortTitle: 'Когда человек уходит', href: '/articles/kogda-chelovek-uhodit-ot-very/', readingTime: '16 мин' },
  ],
  pages: {
    'otstuplenie-chto-govorit-bibliya': {
      id: 'otstuplenie-chto-govorit-bibliya', label: 'Что говорит Библия', title: 'Часть I. Что Библия на самом деле называет отпадением от веры', mobileSection: 'Что говорит Библия', partLabel: 'Часть I · Содержание', readingProgressDoneMin: 0, readingProgressPartMin: 18, readingProgressTotalMin: TOTAL_MIN, railNowTitle: 'Что Библия называет отпадением', railCover: apostasySeriesMediaFor('otstuplenie-chto-govorit-bibliya').rail, partDialogLabel: 'Часть I · Что говорит Библия', partToc: part1Toc,
    },
    'otstupniki-biblii-iuda-saul-ierovoam-dimas': {
      id: 'otstupniki-biblii-iuda-saul-ierovoam-dimas', label: 'Отступники Библии', title: 'Часть II. Отступники Библии: Иуда, Саул, Иеровоам, Димас', mobileSection: 'Отступники Библии', partLabel: 'Часть II · Содержание', readingProgressDoneMin: 18, readingProgressPartMin: 15, readingProgressTotalMin: TOTAL_MIN, railNowTitle: 'Иуда, Саул, Иеровоам, Димас', railCover: apostasySeriesMediaFor('otstupniki-biblii-iuda-saul-ierovoam-dimas').rail, partDialogLabel: 'Часть II · Отступники Библии', partToc: part2Toc,
    },
    'petr-i-iuda-padenie-ili-otstuplenie': {
      id: 'petr-i-iuda-padenie-ili-otstuplenie', label: 'Пётр и Иуда', title: 'Часть III. Пётр и Иуда: падение или отступничество?', mobileSection: 'Пётр и Иуда', partLabel: 'Часть III · Содержание', readingProgressDoneMin: 33, readingProgressPartMin: 17, readingProgressTotalMin: TOTAL_MIN, railNowTitle: 'Падение или отступничество?', railCover: apostasySeriesMediaFor('petr-i-iuda-padenie-ili-otstuplenie').rail, partDialogLabel: 'Часть III · Пётр и Иуда', partToc: part3Toc,
    },
    'otreklis-ot-hrista-istoriya-cerkvi': {
      id: 'otreklis-ot-hrista-istoriya-cerkvi', label: 'История Церкви', title: 'Часть IV. Отреклись от Христа: история Церкви', mobileSection: 'История Церкви', partLabel: 'Часть IV · Содержание', readingProgressDoneMin: 50, readingProgressPartMin: 13, readingProgressTotalMin: TOTAL_MIN, railNowTitle: 'Отречение и возвращение в истории', railCover: apostasySeriesMediaFor('otreklis-ot-hrista-istoriya-cerkvi').rail, partDialogLabel: 'Часть IV · История Церкви', partToc: part4Toc,
    },
    'kogda-chelovek-uhodit-ot-very': {
      id: 'kogda-chelovek-uhodit-ot-very', label: 'Когда человек уходит', title: 'Часть V. Когда человек уходит от веры', mobileSection: 'Когда человек уходит', partLabel: 'Часть V · Содержание', readingProgressDoneMin: 63, readingProgressPartMin: 16, readingProgressTotalMin: TOTAL_MIN, railNowTitle: 'Предупреждать, исправлять, возвращать', railCover: apostasySeriesMediaFor('kogda-chelovek-uhodit-ot-very').rail, partDialogLabel: 'Часть V · Когда человек уходит', partToc: part5Toc,
    },
  },
});

SERIES_CONFIGS[APOSTASY_SERIES.seriesId] = APOSTASY_SERIES;
