export type LawsonEvidenceClass = 'primary' | 'near-primary' | 'secondary' | 'research-audit';

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
    proves: 'Официальная запись разговора МакАртура о падении Лоусона: здравость богословия не отменяет нравственной дисквалификации; отдельный вопрос — как проповедовать мимо собственной совести.',
    boundary: 'МакАртур не объявляет здесь Лоусона необращённым и не называет его прямо лжеучителем.',
  },
  {
    id: 'LAW-02', n: 2,
    label: 'Banner of Truth — “When a Christian Leader Falls” (27 Sep 2024)',
    href: 'https://banneroftruth.org/us/resources/announcements/2024/when-a-christian-leader-falls/',
    evidenceClass: 'near-primary',
    proves: 'Современный событиям носитель, сохраняющий формулировки Trinity Bible Church и OnePassion об отстранении/отставке Лоусона после раскрытия неподобающих отношений.',
    boundary: 'Это не независимое расследование обстоятельств отношений; для институциональных формулировок используется как сохранённый carrier.',
  },
  {
    id: 'LAW-03', n: 3,
    label: 'ChurchLeaders — первое публичное заявление Стивена Лоусона после падения (12 Mar 2025)',
    href: 'https://churchleaders.com/news/507673-steven-lawson-speaks-publicly-for-the-first-time.html',
    evidenceClass: 'near-primary',
    proves: 'Передаёт собственное публичное заявление Лоусона о вине, консультировании, еженедельной подотчётности двум пасторам, заботе местных старейшин и accountability team.',
    boundary: 'Первично для того, что Лоусон заявил о себе; не является независимой проверкой полноты или успешности восстановления.',
  },
  {
    id: 'LAW-04', n: 4,
    label: 'Clint Archer / The Cripplegate — “Steve Lawson Interview” (24 Jan 2025)',
    href: 'https://thecripplegate.com/steve-lawson-interview/',
    evidenceClass: 'primary',
    proves: 'Арчер публично описывает gatekeeping предполагаемого интервью: публикация должна была получить согласие семьи, консультантов, OnePassion и старейшин Trinity.',
    boundary: 'Не доказывает, что интервью было записано или впоследствии «подавлено».',
  },
  {
    id: 'LAW-05', n: 5,
    label: 'Clint Archer / The Cripplegate — “Restoring a Fallen Pastor” (30 Jan 2025)',
    href: 'https://thecripplegate.com/restoring-a-fallen-pastor/',
    evidenceClass: 'primary',
    proves: 'Пастырское различение между прощением, духовным восстановлением и возвращением к пасторской должности/публичной функции.',
  },
  {
    id: 'LAW-06', n: 6,
    label: 'Goodreads — Mercy in the Wilderness: reader transcription/reviews',
    href: 'https://www.goodreads.com/book/show/258369757-mercy-in-the-wilderness',
    evidenceClass: 'secondary',
    proves: 'Нынешний публичный locator шестичленной самодиагностики книги и читательских указателей к её содержанию.',
    boundary: 'Шесть причин хорошо локализованы несколькими читателями, но не все точные формулировки закреплены фотографиями соответствующих физических страниц.',
  },
  {
    id: 'LAW-07', n: 7,
    label: 'Protestia — “Mercy in the Wilderness: A Public Testimony That Says Too Little” (25 Sep 2026)',
    href: 'https://protestia.com/2026/09/25/mercy-in-the-wilderness-a-public-testimony-that-says-too-little/',
    evidenceClass: 'secondary',
    proves: 'Подробный читательский обзор книги, включая перегрузку служением, семейный кризис и описанную в книге попытку консультирования.',
    boundary: 'Оценочные выводы автора обзора не превращаются в установленные факты о мотивах Лоусона.',
  },
  {
    id: 'LAW-08', n: 8,
    label: 'Reformation21 — “Reflections on Steve Lawson’s Latest Book” (28 Sep 2026)',
    href: 'https://reformation21.org/reflections-on-steve-lawsons-latest-book/',
    evidenceClass: 'secondary',
    proves: 'Независимая критическая реакция на книгу и её богословско-пастырскую рамку.',
  },
  {
    id: 'LAW-09', n: 9,
    label: 'Justin Peters Ministries — Didaché: “Steve Lawson’s New Book: Should It Have Been Written?” (24 Sep 2026)',
    href: 'https://www.youtube.com/watch?v=t4eGiYDrMpI',
    evidenceClass: 'primary',
    proves: 'Публичная дискуссия Justin Peters, Jim Osman и Steve LeBlanc; в кадре показаны отдельные страницы книги и старый purity-клип.',
    boundary: 'Мнения участников о сроках, мотивах и семейном статусе остаются их оценками, если отдельно не показан источник.',
  },
  {
    id: 'LAW-10', n: 10,
    label: 'YouTube — “Dr. Steve Lawson on Purity” (uploaded 28 Nov 2019)',
    href: 'https://www.youtube.com/watch?v=bIt15eRjAHU',
    evidenceClass: 'primary',
    proves: 'Публичный ответ Лоусона о сексуальной чистоте, совести, последствиях сексуального греха и возможной служительской дисквалификации.',
    boundary: 'Дата загрузки известна; точная дата записи внутри ролика не установлена, поэтому нельзя уверенно утверждать, что ответ уже был дан во время отношений.',
  },
  {
    id: 'LAW-11', n: 11,
    label: 'Herald of Grace — Steven Lawson, “The Personal Life of the Preacher” (15 Oct 2014)',
    href: 'https://heraldofgrace.org/the-personal-life-of-the-preacher/',
    evidenceClass: 'near-primary',
    proves: 'Доскандальный принцип Лоусона: личная духовность и благочестие проповедника являются основанием публичной проповеди.',
  },
  {
    id: 'LAW-12', n: 12,
    label: 'Filmot — Ask Ligonier with Steven Lawson, auto-caption transcript (28 Jul 2020)',
    href: 'https://filmot.com/sidebyside/Fouczzg3yhg/en/auto.en/English/English%2B%28auto-generated%29/Ask%2BLigonier%2Bwith%2BSteven%2BLawson',
    evidenceClass: 'near-primary',
    proves: 'Поисковый carrier официального Ligonier Q&A: собственная оценка Лоусона о чрезмерной рабочей интенсивности, недостатке молитвы/отдыха, а также его публичные слова об Энн и необходимости быть лучшим мужем.',
    boundary: 'Событие официальное, но нынешний searchable transcript — производный auto-caption carrier; статья использует главным образом пересказ.',
  },
  {
    id: 'LAW-13', n: 13,
    label: 'Reformed Theological Seminary — Ministry & Leadership, “One Passion” (Fall 2013)',
    href: 'https://cdn.rts.edu/wp-content/uploads/2019/02/ML_Fall_2013.pdf',
    evidenceClass: 'primary',
    proves: 'Институциональная биография RTS: D.Min., формирование в Мемфисе, футбольный эпизод, длительная пасторская биография и Christ Fellowship.',
  },
  {
    id: 'LAW-14', n: 14,
    label: 'Homiletix — “Steven Lawson: How I Preach” (2016)',
    href: 'https://homiletix.com/steven-lawson-how-i-preach/',
    evidenceClass: 'primary',
    proves: 'Прямое интервью: Лоусон начал проповедовать в колледже, связывает призвание с влиянием Adrian Rogers/Bellevue и говорит о примерно 34 годах пасторского служения.',
  },
  {
    id: 'LAW-15', n: 15,
    label: 'The Cripplegate — Steven Lawson, “Three Lessons from the Example of Billy Graham” (2018)',
    href: 'https://thecripplegate.com/three-lessons-from-the-example-of-billy-graham/',
    evidenceClass: 'primary',
    proves: 'Первое лицо: Lawson описывает свою роль в Little Rock 1989 как chairman of counseling and follow-up при Billy Graham crusade.',
    boundary: 'Поздние численные воспоминания калибруются современными событиям материалами и не используются как доказательство намеренной лжи.',
  },
  {
    id: 'LAW-16', n: 16,
    label: 'AbeBooks — Men Who Win (1992) publisher biography',
    href: 'https://www.abebooks.com/9780891096641/Men-Who-Win-Pursuing-Ultimate-0891096647/plp',
    evidenceClass: 'near-primary',
    proves: 'Показывает, что уже в 1992 publisher bio называла Лоусона многолетним BCLR pastor и бывшим sportswriter для Texas Rangers/Dallas Cowboys.',
    boundary: 'Sportswriter claim исторически засвидетельствован, но прямой byline/employment record пока не получен.',
  },
  {
    id: 'LAW-17', n: 17,
    label: 'Ligonier — 2024 National Conference Schedule',
    href: 'https://www.ligonier.org/posts/2024-national-conference-schedule',
    evidenceClass: 'primary',
    proves: 'Официально фиксирует публичное служительское присутствие Лоусона в 2024 году, незадолго до раскрытия падения.',
  },
  {
    id: 'LAW-18', n: 18,
    label: 'Ligonier — Content Management Policy',
    href: 'https://www.ligonier.org/faqs/what-is-your-content-management-policy',
    evidenceClass: 'primary',
    proves: 'Официальная политика Ligonier о снятии материалов при определённых случаях тяжёлого публичного греха/дисквалификации.',
  },
  {
    id: 'LAW-19', n: 19,
    label: 'Research — six root causes vs. pre-fall self-witness evidence matrix',
    href: 'https://github.com/FedorMilovanov/Research/blob/main/STEVE_LAWSON/42_SIX_ROOT_CAUSES_PRE_FALL_SELF_WITNESS_EVIDENCE_MATRIX_2026-09-29.md',
    evidenceClass: 'research-audit',
    proves: 'Каноническая матрица сопоставления шести причин книги с доскандальными источниками и границами доказательности.',
  },
  {
    id: 'LAW-20', n: 20,
    label: 'Research — final V6 claim/source audit',
    href: 'https://github.com/FedorMilovanov/Research/blob/main/STEVE_LAWSON/75_ARTICLE_RU_V6_FINAL_CLAIM_SOURCE_AUDIT_2026-09-30.md',
    evidenceClass: 'research-audit',
    proves: 'Финальный claim/source audit статьи: PASS / publication-ready-with-guardrails.',
  },
  {
    id: 'LAW-21', n: 21,
    label: 'Research — canonical biography closure and primary-source upgrades',
    href: 'https://github.com/FedorMilovanov/Research/blob/main/STEVE_LAWSON/81_CANONICAL_BIOGRAPHY_CLOSURE_AND_PRIMARY_SOURCE_UPGRADES_2026-09-30.md',
    evidenceClass: 'research-audit',
    proves: 'Каноническая биографическая сверка: Texas Tech, RTS, early ministry, pastoral chronology, BGEA, sportswriter claim и archive-only границы.',
  },
  {
    id: 'LAW-22', n: 22,
    label: 'Research — Romans 2 conscience / stop-signs source audit',
    href: 'https://github.com/FedorMilovanov/Research/blob/main/STEVE_LAWSON/38_ROMANS_2_CONSCIENCE_STOP_SIGNS_SELF_WITNESS_2026-09-29.md',
    evidenceClass: 'research-audit',
    proves: 'Проверка происхождения доскандального материала Лоусона о совести как alarm/brakes/stop signs и границы использования производных транскриптов.',
  },
  {
    id: 'LAW-23', n: 23,
    label: 'Research — Ask Ligonier 2020 / Anne and marriage self-witness audit',
    href: 'https://github.com/FedorMilovanov/Research/blob/main/STEVE_LAWSON/37_ASK_LIGONIER_2020_ANNE_MARRIAGE_SELF_WITNESS_2026-09-29.md',
    evidenceClass: 'research-audit',
    proves: 'Полная provenance-проверка Q&A 2020 об Энн, обратной связи, служении и собственном признании необходимости расти как муж.',
  },
  {
    id: 'LAW-24', n: 24,
    label: 'Research — ministry workaholism / personal-life self-witness audit',
    href: 'https://github.com/FedorMilovanov/Research/blob/main/STEVE_LAWSON/39_PERSONAL_LIFE_OF_PREACHER_VS_MINISTRY_WORKAHOLISM_SELF_WITNESS_2026-09-29.md',
    evidenceClass: 'research-audit',
    proves: 'Многослойная проверка доскандальных принципов о личной святости и самооценки 2020 о prayer/work/rest imbalance.',
  },
  {
    id: 'LAW-25', n: 25,
    label: 'Research — July 2026 Contending invitation/decline guardrail',
    href: 'https://github.com/FedorMilovanov/Research/blob/main/STEVE_LAWSON/76_CONTENDING_2026_DECLINED_INVITATION_PLATFORM_RETURN_GUARDRAIL_2026-09-30.md',
    evidenceClass: 'research-audit',
    proves: 'Различает краткое рекламное появление Лоусона в conference listing и sourced reporting о последующем отказе; не позволяет выдать скриншот за доказанный Lawson-initiated comeback.',
  },
  {
    id: 'LAW-26', n: 26,
    label: 'Research — book distribution metadata / POD audit',
    href: 'https://github.com/FedorMilovanov/Research/blob/main/STEVE_LAWSON/77_BOOK_DISTRIBUTION_METADATA_SPLIT_AUDIT_2026-09-30.md',
    evidenceClass: 'research-audit',
    proves: 'Сверка ISBN, But God Press, 122/124-page split и подтверждённого retailer-layer POD; не устанавливает юридического registrant или backend.',
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
  'research-audit': 'исследовательская сверка',
};
