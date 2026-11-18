/**
 * Source-only bibliography projection, NOT a Research registry or publication handoff.
 * Research #582, exact read-only snapshot below. External originals were not acquired
 * in this sandbox: LINK_ONLY / COARSE_LOCATOR_ONLY refer to THIS Product receipt.
 * evidenceClass preserves the source role reported by Research, not a claim that this
 * agent read the original. No quote-safe promotion, media licence or HOLD removal.
 */
export const G3_HISTORY_RESEARCH_RECEIPT = {
  head: '93d6f08a40c7989eb1f6362fd1667094742144d2',
  path: 'G3_HISTORY/EDITORIAL_HISTORY_EXTENSION_CANDIDATE_2026-11-18.md',
  accessState: 'LINK_ONLY',
  locatorState: 'COARSE_LOCATOR_ONLY',
  rightsState: 'RIGHTS_UNKNOWN',
  publicationState: 'BLOCKED',
  holds: ['PUBLICATION_HOLD'],
  audioReviewed: false,
} as const;

export const G3_HISTORY_DRAFT_SOURCE_URLS = {
  sourceChallies: 'https://www.challies.com/articles/you-me-and-g3/',
  source2013: 'https://www.gnli.com/titles/2013-G3-Conference-or-G3-Ministries/2908',
  source2014: 'https://www.gnli.com/titles/2014-G3-Conference-or-G3-Ministries/2909',
  source2014Announcement: 'https://equip.sbts.edu/article/g3-conference-on-the-church/',
  source2015: 'https://www.gnli.com/titles/2015-G3-Conference-or-G3-Ministries/2910',
  source2016: 'https://www.gnli.com/titles/2016-G3-Conference-or-G3-Ministries/2912',
  source2017: 'https://www.gnli.com/titles/2017-G3-Conference-or-G3-Ministries/2901',
  source2018Statement: 'https://statementonsocialjustice.com/',
  source2018Responses: 'https://churchleaders.com/news/333017-the-statement-on-social-justice-and-the-gospel-stirs-up-controversy-and-conversation.html',
  source2019: 'https://www.challies.com/sponsored/the-mission-of-god/',
  source2019Recordings: 'https://www.gnli.com/titles/2019-G3-Conference-or-G3-Ministries/2903',
  source2020: 'https://www.gnli.com/titles/2020-G3-Conference-or-G3-Ministries/2905',
  sourceContext: 'https://sharperiron.org/article/gospel-grace-glory-examination-of-g3-ministries',
  sourceBuice2025: 'https://www.buzzsprout.com/1939792/episodes/16458733-why-jimmy-carter-s-faith-is-lauded-while-the-faith-of-others-is-loathed',
  sourceAniol2021: 'https://religiousaffections.org/update/important-announcement/',
  source2023: 'https://www.ajc.com/neighborhoods/south-fulton/answers-in-genesis-conference-is-sept-21-23/EAVGL6ABVBCUVPH5L2OWO2YDKY/',
  source2024Reformation: 'https://www.tickettailor.com/events/g3ministries/1010697',
  source2024Cessationist: 'https://www.tickettailor.com/events/g3ministries/1270768',
  source2024Peters: 'https://justinpeters.org/jpm-newsletter-2024/',
  source2024EarlyVenueReport: 'https://churchleaders.com/news/460190-only-in-america-would-we-monetize-the-spirit-of-unbelief-sean-feucht-calls-out-g3-ministries-cessationist-conference.html',
} as const;

type DraftSource = {
  key: keyof typeof G3_HISTORY_DRAFT_SOURCE_URLS;
  title: string;
  period: string;
  role: string;
  boundary: string;
  researchLocator: string;
  evidenceClass: 'A1' | 'A2' | 'A3' | 'B1' | 'C' | 'D';
};

const entries = [
  { key: 'sourceChallies', title: 'Тим Чаллис. You, Me, and G3', period: '23 мая 2025', role: 'Воспоминания участника', boundary: 'Первое лицо о ранних конференциях и разногласиях. Оценки атмосферы и мотивов не становятся независимым выводом редакции.', researchLocator: 'HIST-02, HIST-08, HIST-18', evidenceClass: 'A1' },
  { key: 'source2013', title: 'GNL. 2013 G3 Conference', period: '2013', role: 'Каталог записей', boundary: 'Имена и названия сессий; не полный реестр присутствовавших и не проверка звуковой дорожки.', researchLocator: 'HIST-03', evidenceClass: 'A2' },
  { key: 'source2014Announcement', title: 'Southern Equip. G3 Conference on the Church', period: 'Анонс конференции 23–25 января 2014', role: 'Институциональный анонс', boundary: 'Подтверждает объявленные тему, даты и докладчиков, но не прибытие каждого приглашённого.', researchLocator: 'HIST-04', evidenceClass: 'A2' },
  { key: 'source2014', title: 'GNL. 2014 G3 Conference', period: '2014', role: 'Каталог записей', boundary: 'Метаданные сессий о Церкви, проповеди и поклонении; не дословное содержание лекций.', researchLocator: 'HIST-05', evidenceClass: 'A2' },
  { key: 'source2015', title: 'GNL. 2015 G3 Conference', period: '2015', role: 'Каталог записей', boundary: 'Темы и атрибуция записей об авторитете Писания. Аудио здесь не цитируется.', researchLocator: 'HIST-06A', evidenceClass: 'A2' },
  { key: 'source2016', title: 'GNL. 2016 G3 Conference', period: '2016', role: 'Каталог записей', boundary: 'Названия сессий о Троице; каталог не заменяет анализ богословского аргумента выступающего.', researchLocator: 'HIST-06B', evidenceClass: 'A2' },
  { key: 'source2017', title: 'GNL. 2017 G3 Conference — Reformation 500', period: '2017', role: 'Каталог записей', boundary: 'Имена и темы в каталоге юбилейной конференции. Не основание для вывода об участии этих людей в каждом году.', researchLocator: 'HIST-07', evidenceClass: 'A2' },
  { key: 'source2018Statement', title: 'The Statement on Social Justice and the Gospel', period: '2018', role: 'Документ составителей', boundary: 'Текст заявления и History and Formation. История подготовки передаётся со слов составителей, а не по независимым протоколам.', researchLocator: 'HIST-19', evidenceClass: 'A1' },
  { key: 'source2018Responses', title: 'ChurchLeaders. Отклики на заявление о социальной справедливости', period: 'Сентябрь 2018', role: 'Современный журналистский обзор', boundary: 'Разные публичные оценки документа. Не доказательство принадлежности всех комментаторов к G3.', researchLocator: 'HIST-19', evidenceClass: 'B1' },
  { key: 'source2019', title: 'The Mission of God — анонс на сайте Тима Чаллиса', period: 'Конференция 17–19 января 2019', role: 'Рекламный анонс', boundary: 'Список приглашённых нельзя автоматически превращать в список реально выступивших.', researchLocator: 'HIST-09', evidenceClass: 'A3' },
  { key: 'source2019Recordings', title: 'GNL. 2019 G3 Conference', period: '2019', role: 'Каталог записей', boundary: 'Отдельная опора для метаданных сохранившихся сессий, не независимое подтверждение всего рекламного списка.', researchLocator: 'HIST-10', evidenceClass: 'A2' },
  { key: 'source2020', title: 'GNL. 2020 G3 Conference', period: '2020', role: 'Каталог записей', boundary: 'Названия выступлений о поклонении и имена докладчиков; не прослушанные редакцией цитаты.', researchLocator: 'HIST-11', evidenceClass: 'A2' },
  { key: 'sourceContext', title: 'Sharper Iron. Gospel, Grace, Glory: An Examination of G3 Ministries', period: '2023', role: 'Исторический и богословский обзор', boundary: 'Вторичная реконструкция развития проектов; оценки автора отделяются от первичных сведений.', researchLocator: 'HIST-12, HIST-14', evidenceClass: 'B1' },
  { key: 'sourceBuice2025', title: 'The Christian Worldview. Интервью Джоша Бьюса', period: '18 января 2025', role: 'Ретроспективное свидетельство', boundary: 'В Research использована текстовая расшифровка. Дата переезда — воспоминание Бьюса; звуковой фрагмент требует отдельной сверки.', researchLocator: 'HIST-15, HIST-16', evidenceClass: 'A1' },
  { key: 'sourceAniol2021', title: 'Скотт Аниол. Important Announcement', period: '1 сентября 2021', role: 'Личное письменное заявление', boundary: 'Назначение и программа будущей работы, а не доказательство завершения всех объявленных инициатив.', researchLocator: 'HIST-17', evidenceClass: 'A1' },
  { key: 'source2023', title: 'The Atlanta Journal-Constitution. Анонс сентябрьской конференции', period: 'Конференция 21–23 сентября 2023', role: 'Современный анонс', boundary: 'Не итоговый отчёт о посещаемости и не полный комплект записей докладов.', researchLocator: 'HIST-13', evidenceClass: 'B1' },
  { key: 'source2024Reformation', title: 'G3 / Ticket Tailor. The Reformation Conference', period: '9–11 мая 2024', role: 'Регистрация организатора', boundary: 'Заявленные дата, тема и площадка в Техасе. Сам листинг не подтверждает весь ход события.', researchLocator: 'HIST-20', evidenceClass: 'A2' },
  { key: 'source2024Cessationist', title: 'G3 / Ticket Tailor. Cessationist Conference', period: '3–5 октября 2024', role: 'Регистрация организатора', boundary: 'Итоговая зарегистрированная площадка — Mustang, Оклахома. Причину изменения прежнего плана листинг не устанавливает.', researchLocator: 'HIST-20', evidenceClass: 'A2' },
  { key: 'source2024Peters', title: 'Джастин Питерс. JPM Newsletter 2024', period: '2024', role: 'Отчёт участника', boundary: 'Собственное свидетельство об октябрьской конференции; не независимый аудит её программы и посещаемости.', researchLocator: 'HIST-20', evidenceClass: 'A1' },
  { key: 'source2024EarlyVenueReport', title: 'ChurchLeaders. Ранний анонс Cessationist Conference', period: '5 октября 2023', role: 'Сообщение о первоначальном плане', boundary: 'Указывал Grace Community Church в Калифорнии. Не подменяет итоговую площадку события 2024 года.', researchLocator: 'HIST-20', evidenceClass: 'B1' },
] as const satisfies readonly DraftSource[];

export const G3_HISTORY_DRAFT_SOURCES = entries.map((entry) => ({
  ...G3_HISTORY_RESEARCH_RECEIPT,
  ...entry,
  url: G3_HISTORY_DRAFT_SOURCE_URLS[entry.key],
}));
