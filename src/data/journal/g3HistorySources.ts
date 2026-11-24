/**
 * Bibliography for the public G3 2011–2024 historical article.
 * Evidence authority: Research #628, handoff commit 389de7b1.
 * Catalogs, programs, participant accounts and transcripts have distinct evidentiary weight.
 * Text and outbound links only: no acquired recordings or copied third-party media.
 */
export const G3_HISTORY_SOURCES = [
  {
    id: 'invitation-2011', title: 'G3 Conference — архивное приглашение Джоша Бьюса',
    period: '2011 · архив RSS G3', role: 'Датированный первичный анонс',
    url: 'https://web.archive.org/web/20110927042330id_/http://www.g3conference.com:80/?feed=rss2',
    boundary: 'Публичный план конференции на январь 2013 года. Не дата частного замысла и не позднейшая статистика участников.',
    returnHref: '#g3-history', researchLocator: 'HIST-01 / G3-HIST-PUB-01',
  },
  {
    id: 'ascol-2018', title: 'Том Аскол — The Statement on Social Justice and the Gospel',
    period: '4 сентября 2018', role: 'Датированное свидетельство участника',
    url: 'https://founders.org/articles/the-statement-on-social-justice-and-the-gospel/',
    boundary: 'Слова Аскола о встрече 14 человек 19 июня и публикации 4 сентября. Не независимый протокол и не позиция каждого участника G3.',
    returnHref: '#g3-year-2018', researchLocator: 'HIST-19 / G3-HIST-PUB-08',
  },
  {
    id: 'challies',
    title: 'Тим Чаллис. You, Me, and G3',
    period: '23 мая 2025', role: 'Воспоминания участника',
    url: 'https://www.challies.com/articles/you-me-and-g3/',
    boundary: 'Свидетельство об участии и личная оценка перемен. Не ведомость посещаемости и не документ о мотивах других людей.',
    returnHref: '#g3-history', researchLocator: 'HIST-02 / HIST-08 / HIST-14 / HIST-18',
  },
  {
    id: 'gnl-2013', title: 'GNL. 2013 G3 Conference',
    period: 'Записи 2013 года', role: 'Каталог видеозаписей',
    url: 'https://www.gnli.com/titles/2013-G3-Conference-or-G3-Ministries/2908',
    boundary: 'Имена и названия в каталоге. Наличие каталога не означает прослушивания аудио или полноты списка участников.',
    returnHref: '#g3-year-2013', researchLocator: 'HIST-03',
  },
  {
    id: 'sbts-2014', title: 'Southern Equip / SBTS. G3 conference on the church',
    period: 'Анонс конференции 23–25 января 2014', role: 'Современный институциональный анонс',
    url: 'https://equip.sbts.edu/article/g3-conference-on-the-church/',
    boundary: 'Заявленные даты, тема и докладчики. Афиша сама по себе не подтверждает прибытие каждого приглашённого.',
    returnHref: '#g3-year-2014', researchLocator: 'HIST-04',
  },
  {
    id: 'gnl-2014', title: 'GNL. 2014 G3 Conference',
    period: 'Записи 2014 года', role: 'Каталог видеозаписей',
    url: 'https://www.gnli.com/titles/2014-G3-Conference-or-G3-Ministries/2909',
    boundary: 'Каталожные сведения о сессиях; не проверенная стенограмма выступлений.',
    returnHref: '#g3-year-2014', researchLocator: 'HIST-05',
  },
  {
    id: 'gnl-2015', title: 'GNL. 2015 G3 Conference',
    period: 'Записи 2015 года', role: 'Каталог видеозаписей',
    url: 'https://www.gnli.com/titles/2015-G3-Conference-or-G3-Ministries/2910',
    boundary: 'Названия сессий о Писании и имена докладчиков; подробное содержание требует просмотра оригинальной записи.',
    returnHref: '#g3-year-2015', researchLocator: 'HIST-06A',
  },
  {
    id: 'gnl-2016', title: 'GNL. 2016 G3 Conference',
    period: 'Записи 2016 года', role: 'Каталог видеозаписей',
    url: 'https://www.gnli.com/titles/2016-G3-Conference-or-G3-Ministries/2912',
    boundary: 'Названия сессий о Троице. Не все фамилии из рекламного анонса автоматически считаются подтверждёнными выступающими.',
    returnHref: '#g3-year-2016', researchLocator: 'HIST-06B',
  },
  {
    id: 'gnl-2017', title: 'GNL. 2017 G3 Conference — Reformation 500',
    period: 'Записи 2017 года', role: 'Каталог видеозаписей',
    url: 'https://www.gnli.com/titles/2017-G3-Conference-or-G3-Ministries/2901',
    boundary: 'Подтверждает каталогизированные выступления, не коллективное согласие докладчиков со всеми решениями G3.',
    returnHref: '#g3-year-2017', researchLocator: 'HIST-07',
  },
  {
    id: 'statement-2018', title: 'The Statement on Social Justice and the Gospel',
    period: '2018 · History and Formation; Introduction; Affirmations & Denials', role: 'Текст заявления и рассказ составителя',
    // Previous host statementonsocialjustice.com had no A/AAAA DNS on 2026-11-23.
    // This working host retains the same primary statement and History and Formation.
    url: 'https://socialjusticestatement.com/',
    boundary: 'Содержание и собственное объяснение целей документа. Рассказ о подготовке атрибутируется составителю, не заменяет независимый протокол встречи.',
    returnHref: '#g3-year-2018', researchLocator: 'HIST-19 / G3-HIST-PUB-08',
  },
  {
    id: 'responses-2018', title: 'ChurchLeaders. The Statement on Social Justice and the Gospel Stirs Up Controversy and Conversation',
    period: 'Сентябрь 2018', role: 'Современное освещение дискуссии',
    url: 'https://churchleaders.com/news/333017-the-statement-on-social-justice-and-the-gospel-stirs-up-controversy-and-conversation.html',
    boundary: 'Реакции на заявление. Участники дискуссии не отождествляются автоматически с руководством или докладчиками G3.',
    returnHref: '#g3-year-2018', researchLocator: 'HIST-19',
  },
  {
    id: 'announcement-2019', title: 'The Mission of God — анонс на сайте Тима Чаллиса',
    period: 'Конференция 17–19 января 2019', role: 'Рекламный анонс',
    url: 'https://www.challies.com/sponsored/the-mission-of-god/',
    boundary: 'Список приглашённых, тема и план. Раздел sponsored не является независимым репортажем о состоявшемся событии.',
    returnHref: '#g3-year-2019', researchLocator: 'HIST-09',
  },
  {
    id: 'gnl-2019', title: 'GNL. 2019 G3 Conference',
    period: 'Записи 2019 года', role: 'Каталог видеозаписей',
    url: 'https://www.gnli.com/titles/2019-G3-Conference-or-G3-Ministries/2903',
    boundary: 'Дополнительный маршрут сверки записей. Не основание объявить весь рекламный список фактически выступившим.',
    returnHref: '#g3-year-2019', researchLocator: 'HIST-10',
  },
  {
    id: 'gnl-2020', title: 'GNL. 2020 G3 Conference',
    period: 'Записи 2020 года', role: 'Каталог видеозаписей',
    url: 'https://www.gnli.com/titles/2020-G3-Conference-or-G3-Ministries/2905',
    boundary: 'Имена и названия сессий о поклонении. Переводы названий не являются цитатами из проповедей.',
    returnHref: '#g3-year-2020', researchLocator: 'HIST-11',
  },
  {
    id: 'aniol-2021', title: 'Скотт Аниол. Important Announcement',
    period: '1 сентября 2021 · Religious Affections', role: 'Письменное сообщение участника',
    url: 'https://religiousaffections.org/update/important-announcement/',
    boundary: 'Должность и заявленные планы издания книг, учебных материалов, журнала и онлайн-проектов. Не доказательство завершения всех инициатив в этот день.',
    returnHref: '#g3-growth', researchLocator: 'HIST-17',
  },
  {
    id: 'context-overview', title: 'Sharper Iron. Gospel, Grace, Glory: An Examination of G3 Ministries',
    period: 'Контекст развития служения', role: 'Вторичный обзор',
    url: 'https://sharperiron.org/article/gospel-grace-glory-examination-of-g3-ministries',
    boundary: 'Контекст институционального расширения; не независимый аудит эффективности проектов и не первоначальная документация каждого запуска.',
    returnHref: '#g3-growth', researchLocator: 'HIST-12',
  },
  {
    id: 'announcement-2023', title: 'The Atlanta Journal-Constitution — анонс конференции 21–23 сентября 2023 года',
    period: 'Сентябрь 2023', role: 'Современный вторичный анонс',
    url: 'https://www.ajc.com/neighborhoods/south-fulton/answers-in-genesis-conference-is-sept-21-23/EAVGL6ABVBCUVPH5L2OWO2YDKY/',
    boundary: 'Тема, даты и заявленные участники. Не итоговая ведомость докладчиков или посещаемости.',
    returnHref: '#g3-year-2023', researchLocator: 'HIST-13',
  },
  {
    id: 'reformation-2024', title: 'G3 / Ticket Tailor. The Reformation Conference',
    period: '9–11 мая 2024 · Southlake, Texas', role: 'Страница записи на мероприятие',
    url: 'https://www.tickettailor.com/events/g3ministries/1010697',
    boundary: 'Заявленные время и площадка Countryside Bible Church. Листинг не доказывает фактическое проведение или полный состав участников.',
    returnHref: '#g3-year-2024', researchLocator: 'HIST-20 / G3-HIST-PUB-09',
  },
  {
    id: 'cessationist-2024', title: 'G3 / Ticket Tailor. 2024 Cessationist Conference Publisher',
    period: '3–5 октября 2024 · Mustang, Oklahoma', role: 'Регистрация издательств на мероприятие',
    url: 'https://www.tickettailor.com/events/g3ministries/1270768',
    boundary: 'Даты и заявленная площадка из формы регистрации издательств, а не из общего списка посетителей; документ не устанавливает фактическую программу или причину смены места.',
    returnHref: '#g3-year-2024', researchLocator: 'HIST-20 / G3-HIST-PUB-09',
  },
  {
    id: 'peters-2024', title: 'Джастин Питерс. JPM Newsletter 2024',
    period: 'Отчёт за 2024 год', role: 'Письменное свидетельство участника',
    url: 'https://justinpeters.org/jpm-newsletter-2024/',
    boundary: 'Собственное участие в октябрьской конференции. 2024 — отчётный период, не установленная здесь дата публикации; не подтверждение всей программы или численности аудитории.',
    returnHref: '#g3-year-2024', researchLocator: 'HIST-20 / G3-HIST-PUB-09',
  },
  {
    id: 'early-venue-2023', title: 'Джесси Т. Джексон / ChurchLeaders — ранний анонс Cessationist Conference',
    period: '5 октября 2023', role: 'Вторичное сообщение о первоначальном плане',
    url: 'https://churchleaders.com/news/460190-only-in-america-would-we-monetize-the-spirit-of-unbelief-sean-feucht-calls-out-g3-ministries-cessationist-conference.html',
    boundary: 'Раннее упоминание Grace Community Church в Калифорнии. Не адрес фактически проведённой октябрьской встречи 2024 года.',
    returnHref: '#g3-year-2024', researchLocator: 'HIST-20',
  },
  {
    id: 'buice-transcript-2025', title: 'The Christian Worldview — интервью Джоша Бьюса, текстовая расшифровка выпуска',
    period: '18 января 2025', role: 'Расшифровка ретроспективного интервью',
    url: 'https://www.buzzsprout.com/1939792/episodes/16458733-why-jimmy-carter-s-faith-is-lauded-while-the-faith-of-others-is-loathed',
    boundary: 'Аудио в этой редакционной волне не прослушано. Точный фрагмент о переезде требует сверки со звуком; дословные цитаты не приводятся.',
    returnHref: '#g3-evidence', researchLocator: 'HIST-15 / HIST-16',
  },
  {
    id: 'piper-2019', title: 'Джон Пайпер. The Invincible Power of Joy for World Missions',
    period: '17 января 2019', role: 'Авторский текст проповеди',
    url: 'https://www.desiringgod.org/messages/the-invincible-power-of-joy-for-world-missions',
    boundary: 'Письменный текст проповеди по Флп. 2:17–18, опубликованный автором. Приведён пересказ, а не дословная цитата из аудиозаписи.',
    returnHref: '#g3-year-2019', researchLocator: 'G3-HIST-PUB-10',
  },
  {
    id: '316-2024', title: 'Three Sixteen Publishing — отчёт за июнь 2024 года',
    period: '5 июня 2024', role: 'Свидетельство издательства — участника',
    url: 'https://316publishing.com/blogs/blog/june-2024-the-lsb-ppr-conferences-a-new-susan-heck-bible-study-more',
    boundary: 'Абзац о майской встрече в Countryside Bible Church. Участие издательства не подтверждает весь состав докладчиков или посещаемость.',
    returnHref: '#g3-year-2024', researchLocator: 'G3-HIST-PUB-11',
  },
  {
    id: 'gnl-2018', title: 'GNL. 2018 G3 Conference',
    period: 'Записи 2018 года', role: 'Каталог видеозаписей',
    url: 'https://www.gnli.com/titles/2018-G3-Conference-or-G3-Ministries/2902',
    boundary: 'Выбранные записи и имена, от Questions & Answers 1 до The Church is Ground-Zero for Discipleship. Не полный список участников и не стенограмма.',
    returnHref: '#g3-catalogue-matrix', researchLocator: 'G3-HIST-PUB-12',
  },
  {
    id: 'gnl-2021', title: 'GNL. 2021 G3 National Conference',
    period: 'Записи 2021 года', role: 'Каталог видеозаписей',
    url: 'https://www.gnli.com/titles/2021-G3-National-Conference-or-G3-Ministries/2906',
    boundary: 'Выбранные записи и имена, от Christ as Eternal Judge до The Cosmic Triumph of Christ. Каталог не устанавливает форму выступления или полный состав участников.',
    returnHref: '#g3-catalogue-matrix', researchLocator: 'G3-HIST-PUB-12',
  },
  {
    "id": "challies-2018-video",
    "title": "Тим Чаллис. From Every Tribe and Language and People and Nation",
    "period": "23 января 2018",
    "role": "Свидетельство автора выступления",
    "url": "https://www.challies.com/vlog/from-every-tribe-and-language-and-people-and-nation/",
    "boundary": "Сообщение автора о видеозаписи. Не подтверждение её просмотра редакцией.",
    "returnHref": "#g3-year-2018",
    "researchLocator": "G3-HIST-PUB-13"
  },
  {
    "id": "challies-2018-lessons",
    "title": "Тим Чаллис. Seven Key Lessons in Diversity from Grace Fellowship Church",
    "period": "2 февраля 2018",
    "role": "Авторская статья",
    "url": "https://www.challies.com/articles/seven-key-lessons-in-diversity-from-grace-fellowship-church/",
    "boundary": "Обсуждение прихожан и урок о гостеприимстве.",
    "returnHref": "#g3-year-2018",
    "researchLocator": "G3-HIST-PUB-13"
  },
  {
    "id": "firstlove-2018",
    "title": "FirstLove Missions. G3 Conference in Atlanta, Georgia",
    "period": "30 января 2018",
    "role": "Отчёт участника выставки",
    "url": "https://www.missionsfirstlove.org/united-states-blog/g3-conference-in-atlanta-georgia",
    "boundary": "Число распространённых экземпляров книг и брошюр по собственному отчёту, не число посетителей.",
    "returnHref": "#g3-year-2018",
    "researchLocator": "G3-HIST-PUB-13"
  },
  {
    "id": "crotts-2021",
    "title": "Джефф Кроттс. Gospel, Grace and Glory",
    "period": "6 октября 2021",
    "role": "Свидетельство участника",
    "url": "https://anchoragegrace.org/gospel-grace-and-glory/",
    "boundary": "Два отдельных выступления МакАртура по воспоминаниям автора; не стенограмма или подтверждение формата выступления.",
    "returnHref": "#g3-growth",
    "researchLocator": "G3-HIST-PUB-14"
  },
  {
    "id": "benson-2022",
    "title": "Рэнди Бенсон. The G3 Church Network",
    "period": "9 февраля 2022",
    "role": "Сообщение поместной церкви",
    "url": "https://gardenchurchnb.com/the-g3-church-network/",
    "boundary": "Решение общины и понимание сотрудничества пастором; не договор о членстве или общая практика сети.",
    "returnHref": "#g3-growth",
    "researchLocator": "G3-HIST-PUB-15"
  },
  {
    "id": "white-manuscripts-2022",
    "title": "Джеймс Уайт. Making Sense of Manuscripts",
    "period": "15 сентября 2022 · дата записи на сайте",
    "role": "Метаданные участника",
    "url": "https://www.aomin.org/aoblog/road-trip/road-trip-g3-regional-conference-making-sense-of-manuscripts-immanuel-bible-church-springfield-virginia-9-15-2022/",
    "boundary": "Название и площадка, не точная дата выступления или содержание записи.",
    "returnHref": "#g3-year-2022",
    "researchLocator": "G3-HIST-PUB-16"
  },
  {
    "id": "white-bible-2022",
    "title": "Джеймс Уайт. How We Got Our Bible",
    "period": "15 сентября 2022 · дата записи на сайте",
    "role": "Метаданные участника",
    "url": "https://www.aomin.org/aoblog/road-trip/road-trip-g3-regional-conference-how-we-got-our-bible-immanuel-bible-church-springfield-virginia-9-15-2022/",
    "boundary": "Название и площадка, не точная дата выступления или содержание записи.",
    "returnHref": "#g3-year-2022",
    "researchLocator": "G3-HIST-PUB-16"
  },
] as const;

export type G3HistorySourceId = (typeof G3_HISTORY_SOURCES)[number]['id'];
export const historyCitation = (id: G3HistorySourceId) => `#history-source-${id}`;
