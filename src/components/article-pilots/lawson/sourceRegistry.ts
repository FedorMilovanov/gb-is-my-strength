export type LawsonEvidenceClass = 'primary' | 'near-primary' | 'secondary';

export interface LawsonSource {
  id: string;
  n: number;
  label: string;
  href: string;
  evidenceClass: LawsonEvidenceClass;
  proves: string;
  boundary?: string;
}

export const LAWSON_SOURCES: LawsonSource[] = [
  {
    id: 'LAW-01', n: 1,
    label: 'Grace to You — John MacArthur, “Thinking Biblically About Current Events” (20 Oct 2024)',
    href: 'https://www.gty.org/sermons/70-58/thinking-biblically-about-current-events-a-conversation-with-john-macarthur',
    evidenceClass: 'primary',
    proves: 'Официальная запись разговора МакАртура о падении Лоусона: здравость богословия не отменяет требований к нравственной квалификации служителя; отдельно поднимается вопрос о совести проповедника.',
    boundary: 'МакАртур не объявляет здесь Лоусона необращённым и не называет его прямо лжеучителем.',
  },
  {
    id: 'LAW-02', n: 2,
    label: 'Banner of Truth — Warren Peel, “When a Christian Leader Falls” (14 Oct 2024)',
    href: 'https://banneroftruth.org/us/resources/announcements/2024/when-a-christian-leader-falls/',
    evidenceClass: 'near-primary',
    proves: 'Современный событиям источник, сохраняющий формулировки Trinity Bible Church и OnePassion об отстранении и отставке Лоусона после раскрытия неподобающих отношений.',
    boundary: 'Это не независимое расследование обстоятельств отношений; источник используется для институциональных формулировок.',
  },
  {
    id: 'LAW-03', n: 3,
    label: 'ChurchLeaders — первое публичное заявление Стивена Лоусона после падения (12 Mar 2025)',
    href: 'https://churchleaders.com/news/507673-steven-lawson-speaks-publicly-for-the-first-time.html',
    evidenceClass: 'near-primary',
    proves: 'Передаёт собственное публичное заявление Лоусона о вине, консультировании, еженедельной подотчётности двум пасторам, заботе местных старейшин и группе подотчётности.',
    boundary: 'Первично для того, что Лоусон заявил о себе; не является независимой проверкой полноты или успешности восстановления.',
  },
  {
    id: 'LAW-26', n: 4,
    label: 'Стивен Лоусон — собственный текст публичного заявления от 12 марта 2025 года',
    href: 'https://thechristianworldview.org/wp-content/uploads/2025/03/Steven-Lawson-statement.pdf',
    evidenceClass: 'near-primary',
    proves: 'Полный текст собственного заявления Лоусона: признание в тяжком грехе, единоличная ответственность, исповедь Господу, жене и семье, пять месяцев интенсивного консультирования, еженедельная подотчётность двум пасторам и старейшинам поместной церкви, надзор группы подотчётности, участие в жизни церкви и намерение не выступать публично в обозримом будущем.',
    boundary: 'По существу это собственные слова Лоусона, то есть первоисточник; но наша копия — сторонняя PDF-фиксация его публикации от 12 марта 2025 года, 12:56, а не страница, которую он контролирует. Заявление первично для того, что он сообщил о себе, и не является независимой проверкой полноты или успешности восстановления.',
  },
  {
    id: 'LAW-04', n: 5,
    label: 'Clint Archer / The Cripplegate — “Steve Lawson Interview” (24 Jan 2025)',
    href: 'https://thecripplegate.com/steve-lawson-interview/',
    evidenceClass: 'near-primary',
    proves: 'Арчер публично описывает предполагаемый порядок допуска интервью: публикация должна была получить согласие семьи, консультантов, OnePassion и старейшин Trinity. Там же — его пересказ слов Лоусона о том, что тот считает себя навсегда дисквалифицированным, вернул авансы за книжные контракты и рассматривал светскую работу.',
    boundary: 'Первично для самого факта публичного заявления Арчера. Факты о Лоусоне переданы со слов телефонного разговора с ним и бесед с членами правления OnePassion; это свидетельство очевидца, расположенного к Лоусону, а не документ церкви, служения или самого Лоусона. Не доказывает, что интервью было записано или впоследствии кем-то подавлено.',
  },
  {
    id: 'LAW-05', n: 6,
    label: 'Clint Archer / The Cripplegate — “Restoring a Fallen Pastor?” (30 Jan 2025)',
    href: 'https://thecripplegate.com/restoring-a-fallen-pastor/',
    evidenceClass: 'primary',
    proves: 'Пастырское различение между прощением, духовным восстановлением и возвращением к пасторской должности или публичной функции.',
  },
  {
    id: 'LAW-06', n: 7,
    label: 'Goodreads — Mercy in the Wilderness: reader transcription/reviews',
    href: 'https://www.goodreads.com/book/show/258369757-mercy-in-the-wilderness',
    evidenceClass: 'secondary',
    proves: 'Публичная библиографическая карточка книги: название и подзаголовок, автор, 122 страницы, дата публикации 1 сентября 2026 года, читательский приём. Носитель проверен прямой загрузкой 2 октября 2026 года.',
    boundary: 'Отзывы на Goodreads подгружаются скриптом и напрямую не читались; шестичленную самодиагностику статья берёт из читательских обзоров (LAW-07), а Goodreads приводит как библиографическое подтверждение самой книги и её читательского приёма.',
  },
  {
    id: 'LAW-07', n: 8,
    label: 'Protestia — “Mercy in the Wilderness: A Public Testimony That Says Too Little” (25 Sep 2026)',
    href: 'https://protestia.com/2026/09/25/mercy-in-the-wilderness-a-public-testimony-that-says-too-little/',
    evidenceClass: 'secondary',
    proves: 'Подробный читательский обзор книги, включая перегрузку служением, семейный кризис и описанную в книге попытку консультирования.',
    boundary: 'Оценки автора обзора не превращаются в установленные факты о мотивах Лоусона.',
  },
  {
    id: 'LAW-08', n: 9,
    label: 'Reformation21 — Mark Jones, “Reflections on Steve Lawson’s Latest Book” (28 Sep 2026)',
    href: 'https://reformation21.org/reflections-on-steve-lawsons-latest-book/',
    evidenceClass: 'secondary',
    proves: 'Независимая критическая реакция на книгу и её богословско-пастырскую рамку.',
  },
  {
    id: 'LAW-09', n: 10,
    label: 'Justin Peters Ministries — Didaché: “Steve Lawson’s New Book: Should It Have Been Written?” (24 Sep 2026)',
    href: 'https://www.youtube.com/watch?v=t4eGiYDrMpI',
    evidenceClass: 'primary',
    proves: 'Публичная дискуссия Джастина Питерса, Джима Османа и Стива Леблана; в кадре показаны отдельные страницы книги и прежний ответ Лоусона о сексуальной чистоте.',
    boundary: 'Мнения участников о сроках, мотивах и семейном статусе остаются их оценками, если отдельно не показан источник. Носитель проверен прямой загрузкой 2 октября 2026 года: публичный выпуск Justin Peters Ministries от 24 сентября 2026 года; описание подтверждает состав участников и показ страниц книги.',
  },
  {
    id: 'LAW-10', n: 11,
    label: 'YouTube — “Dr. Steve Lawson on Purity” (uploaded 28 Nov 2019)',
    href: 'https://www.youtube.com/watch?v=bIt15eRjAHU',
    evidenceClass: 'primary',
    proves: 'Публичный ответ Лоусона о сексуальной чистоте, совести, последствиях сексуального греха и возможной служительской дисквалификации.',
    boundary: 'Известна дата публикации ролика, но не точная дата записи; поэтому статья не утверждает, что ответ был дан уже во время неподобающих отношений. Носитель и авторасшифровка проверены прямой загрузкой 2 октября 2026 года: ролик от 28 ноября 2019 года; содержание — чистота, совесть, радикальные меры и служительская дисквалификация — соответствует описанию в реестре.',
  },
  {
    id: 'LAW-11', n: 12,
    label: 'Herald of Grace — Steven Lawson, “The Personal Life of the Preacher” (15 Oct 2014)',
    href: 'https://heraldofgrace.org/the-personal-life-of-the-preacher/',
    evidenceClass: 'near-primary',
    proves: 'Доскандальный принцип Лоусона: личная духовность и благочестие проповедника лежат под его публичным служением.',
  },
  {
    id: 'LAW-12', n: 13,
    label: 'Filmot — Ask Ligonier with Steven Lawson, auto-caption transcript (28 Jul 2020)',
    href: 'https://filmot.com/sidebyside/Fouczzg3yhg/en/auto.en/English/English%2B%28auto-generated%29/Ask%2BLigonier%2Bwith%2BSteven%2BLawson',
    evidenceClass: 'near-primary',
    proves: 'Поисковый носитель официального Ligonier Q&A: собственная оценка Лоусона о чрезмерной рабочей интенсивности, недостатке молитвы и отдыха, а также его слова об Энн и необходимости быть лучшим мужем.',
    boundary: 'Событие официальное, но доступная поисковая расшифровка создана автоматически; статья использует главным образом пересказ, а не точные цитаты. Носитель — сторонний сервис Filmot, и при проверке 2 октября 2026 года он отдавал страницу проверки человека («Verify You’re Human»), поэтому читатель может не пройти по ссылке без верификации. Первоисточник — сам официальный выпуск Ask Ligonier от 28 июля 2020 года, а не его расшифровка.',
  },
  {
    id: 'LAW-13', n: 14,
    label: 'Reformed Theological Seminary — Ministry & Leadership, “One Passion” (Fall 2013)',
    href: 'https://cdn.rts.edu/wp-content/uploads/2019/02/ML_Fall_2013.pdf',
    evidenceClass: 'primary',
    proves: 'Институциональная биография RTS: образование, раннее формирование, футбольный эпизод, длительная пасторская биография и Christ Fellowship.',
  },
  {
    id: 'LAW-14', n: 15,
    label: 'Homiletix — “Steven Lawson: How I Preach” (19 Sep 2016)',
    href: 'https://homiletix.com/steven-lawson-how-i-preach/',
    evidenceClass: 'primary',
    proves: 'Прямое интервью: Лоусон говорит о начале проповеди в колледже, влиянии Адриана Роджерса и примерно тридцати четырёх годах пасторского служения.',
  },
  {
    id: 'LAW-15', n: 16,
    label: 'The Cripplegate — Steven Lawson, “Three Lessons from the Extraordinary Life of Billy Graham” (2018)',
    href: 'https://thecripplegate.com/three-lessons-from-the-example-of-billy-graham/',
    evidenceClass: 'primary',
    proves: 'Лоусон от первого лица описывает свою роль в евангелизационной кампании Билли Грэма в Литл-Роке в 1989 году.',
    boundary: 'Поздние численные воспоминания требуют калибровки современными событиям материалами и не используются как доказательство намеренной лжи.',
  },
  {
    id: 'LAW-17', n: 17,
    label: 'Ligonier — 2024 National Conference Schedule',
    href: 'https://www.ligonier.org/posts/2024-national-conference-schedule',
    evidenceClass: 'primary',
    proves: 'Официально фиксирует заметное публичное служительское присутствие Лоусона в 2024 году, незадолго до раскрытия падения.',
  },
  {
    id: 'LAW-18', n: 18,
    label: 'Ligonier — Content Management Policy',
    href: 'https://www.ligonier.org/faqs/what-is-your-content-management-policy',
    evidenceClass: 'primary',
    proves: 'Официальная политика Ligonier по управлению материалами авторов после тяжёлого публичного греха или дисквалификации.',
    boundary: 'Политика объясняет решение организации о собственном каталоге, а не выносит универсальный приговор истинности каждой прежней проповеди автора.',
  },
  {
    id: 'LAW-19', n: 19,
    label: 'Shepherd’s Conference 2017 — Session 14, Steve Lawson, “Jesus, the Good Shepherd” (public transcript carrier)',
    href: 'https://lilys.ai/en/notes/913688',
    evidenceClass: 'secondary',
    proves: 'Публичная расшифровка с временными отметками финального обращения, где Лоусон различает проповедь о Христе и собственную духовную реальность и допускает возможность необращённого пастыря.',
    boundary: 'Используется как публично доступный носитель расшифровки; статья не превращает общий призыв Лоусона к пасторам в скрытую автобиографическую исповедь. Расшифровка проверена прямой загрузкой 2 октября 2026 года; допущение о возможности необращённого пастыря присутствует дословно (отметка около 01:11:35).',
  },
  {
    id: 'LAW-22', n: 20,
    label: 'Barrhead Gospel Hall — transcript, Steven Lawson, “Those Who Have Never Heard — Romans 2:12–16”',
    href: 'https://barrhead-gospel-hall.org/downLoadFile.php?file=&path=library%2Fsermons%2FbibleStudies%2FRomans%2F_transcripts_%2F013_Romans_2.12-16.pdf',
    evidenceClass: 'secondary',
    proves: 'Сохранившаяся полная расшифровка учения Лоусона о совести как предупреждающей системе, нравственных стоп-знаках и тормозах, которые можно притупить повторяющимся непослушанием.',
    boundary: 'Это производный носитель текста, а не действующая страница OnePassion; статья использует смысловой пересказ и не выдаёт материал за автобиографию. PDF проверен прямой загрузкой 2 октября 2026 года; ключевые образы — совесть как сигнал тревоги, нравственные стоп-знаки и выжженная совесть — присутствуют дословно.',
  },
  {
    id: 'LAW-23', n: 21,
    label: 'Ligonier — Best of 2016: индекс “The Blessing of an Excellent Wife” by Steven Lawson',
    href: 'https://www.ligonier.org/posts/best-2016-ligonier-blog',
    evidenceClass: 'primary',
    proves: 'Официальный Ligonier индекс подтверждает публикацию Лоусона о духовной ценности, мудрости и надёжности благочестивой жены.',
    boundary: 'Для конкретных слов Лоусона об Энн в 2020 году статья отдельно использует источник LAW-12.',
  },
  {
    id: 'LAW-24', n: 22,
    label: 'Pathway to Victory — Robert Jeffress, “When Are We Most Vulnerable To Temptation?” (9 Sep 2021)',
    href: 'https://ptv.org/devotional/when-are-we-most-vulnerable-to-temptation/',
    evidenceClass: 'near-primary',
    proves: 'Джеффресс публично приписывает своему другу Стиву Лоусону предупреждение о четырёх периодах особой уязвимости к искушению: после успеха, при усталости, в одиночестве и во время ожидания Бога.',
    boundary: 'Первично для атрибуции Джеффресса, но не для точной исходной формулировки самого Лоусона. Страница прямо указывает, что это отрывок из книги Джеффресса «Blueprint For Your Destruction» 2010 года, то есть сама атрибуция старше даты публикации девотиона на ptv.org.',
  },
  {
    id: 'LAW-25', n: 23,
    label: 'Protestia — “Steve Lawson Not Speaking at Upcoming Preaching Conference” (20 Jul 2026)',
    href: 'https://protestia.com/2026/07/20/exclusive-steve-lawson-not-speaking-at-upcoming-preaching-conference/',
    evidenceClass: 'secondary',
    proves: 'Сообщает, что организаторы конференции преждевременно указали Лоусона среди спикеров, а он отказался от приглашения и был удалён из программы.',
    boundary: 'Это сообщение со ссылкой на источники, а не прямое заявление Лоусона или организаторов; оно не доказывает иной мотив или скрытый план возвращения.',
  },
];

const byId = new Map(LAWSON_SOURCES.map((source) => [source.id, source]));

export function lawsonSource(id: string): LawsonSource {
  const source = byId.get(id);
  if (!source) throw new Error(`Unknown Lawson source id: ${id}`);
  return source;
}

export const LAWSON_EVIDENCE_LABEL: Record<LawsonEvidenceClass, string> = {
  primary: 'первичный',
  'near-primary': 'близкий к первичному',
  secondary: 'вторичный',
};
