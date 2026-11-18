/**
 * Source-only reader projection, NOT a Research ledger or a publication handoff.
 * Inherited candidate: Research #582 @ 93d6f08a40c7989eb1f6362fd1667094742144d2.
 * Narrow rechecks / proposed corrections are recorded in the Product lane note.
 * Catalog metadata is never represented as listened-to audio. No third-party media is copied.
 */
import type { BibliographyEntry } from '@/components/journal/JournalBibliography.astro';

const entries = [
  {
    key: 'challies', title: 'Тим Чаллис. You, Me, and G3', period: '23 мая 2025', kind: 'Воспоминания участника',
    publicUrl: 'https://www.challies.com/articles/you-me-and-g3/',
    locator: 'Первые три абзаца — участие с 2013 года и роль Pray’s Mill; следующие два — заявление 2018 года и прекращение приглашений.',
    limitation: 'Личный рассказ. Оценка атмосферы и причин расхождения принадлежит автору; это не протокол решений G3.',
    backHref: '#g3-history', backLabel: 'Истоки G3',
  },
  {
    key: '2013', title: 'GNL. 2013 G3 Conference | G3 Ministries', period: 'Конференция 2013 года', kind: 'Каталог записей',
    publicUrl: 'https://www.gnli.com/titles/2013-G3-Conference-or-G3-Ministries/2908',
    locator: 'Карточки сессий Пола Вошера, Стивена Лоусона, Водди Бокама, Джоэла Бики, Тима Чаллиса, Дэвида Миллера и Дональда Уитни.',
    limitation: 'Проверены имена и названия на странице каталога, не звук записей и не полнота программы.',
    backHref: '#g3-year-2013', backLabel: 'Конференция 2013',
  },
  {
    key: '2014-announcement', title: 'Southern Equip. G3 conference on the Church', period: 'Анонс встречи 23–25 января', kind: 'Институциональный анонс',
    publicUrl: 'https://equip.sbts.edu/article/g3-conference-on-the-church/',
    locator: 'Абзац с датами, темой The Church — From a Biblical Perspective и списком приглашённых.',
    limitation: 'В прочитанном тексте анонса год не указан; сопоставление с каталогом 2014 года не заменяет датированный оригинал. Перечень приглашённых не удостоверяет их выступления.',
    backHref: '#g3-year-2014', backLabel: 'Конференция 2014',
  },
  {
    key: '2014', title: 'GNL. 2014 G3 Conference | G3 Ministries', period: 'Конференция 2014 года', kind: 'Каталог записей',
    publicUrl: 'https://www.gnli.com/titles/2014-G3-Conference-or-G3-Ministries/2909',
    locator: 'Карточки The Church’s Call to Biblical Preaching (Lawson), The Worshipping Church (Mbewe), The Founding and Founder of the Church (Miller), A Radically Normal Life of the Christian (Challies).',
    backHref: '#g3-year-2014', backLabel: 'Конференция 2014',
  },
  {
    key: '2015', title: 'GNL. 2015 G3 Conference | G3 Ministries', period: 'Конференция 2015 года', kind: 'Каталог записей',
    publicUrl: 'https://www.gnli.com/titles/2015-G3-Conference-or-G3-Ministries/2910',
    locator: 'Годовой каталог: God-Breathed Word (Lawson), Inerrancy (Miller), Great Commission (Washer), Expository Apologetics (Baucham), Two Books (Challies).',
    limitation: 'Каталожные соответствия; не дословные слова из прослушанной записи.',
    backHref: '#g3-year-2015', backLabel: 'Конференция 2015',
  },
  {
    key: '2016', title: 'GNL. 2016 G3 Conference | G3 Ministries', period: 'Конференция 2016 года', kind: 'Каталог записей',
    publicUrl: 'https://www.gnli.com/titles/2016-G3-Conference-or-G3-Ministries/2912',
    locator: 'Beholding the Trinity in Worship (Ware), The Defining Christian Confession: The Trinity (White), The Trinity in Salvation (Lawson), The Resurrection of Christ was a Trinitarian Event (Charles).',
    limitation: 'Указаны названия карточек, а не проверенные аудиоцитаты.',
    backHref: '#g3-year-2016', backLabel: 'Конференция 2016',
  },
  {
    key: '2017', title: 'GNL. 2017 G3 Conference | G3 Ministries', period: 'Конференция 2017 года', kind: 'Каталог записей',
    publicUrl: 'https://www.gnli.com/titles/2017-G3-Conference-or-G3-Ministries/2901',
    locator: 'Reformation 500: каталог сессий Карсона, Вошера, Лоусона, Бокама, Мбеве и других о Писании, спасении и Реформации.',
    limitation: 'Каталог не удостоверяет полноту годовой программы и не заменяет прослушивание.',
    backHref: '#g3-year-2017', backLabel: 'Конференция 2017',
  },
  {
    key: 'statement', title: 'The Statement on Social Justice and the Gospel', period: '2018', kind: 'Коллективный документ',
    publicUrl: 'https://statementonsocialjustice.com/',
    locator: 'History and Formation, Introduction, Affirmations & Denials. История создания передаётся по собственному объяснению составителей.',
    limitation: 'При повторной сверке страница оказалась недоступна. Перед публикацией нужна повторная проверка полного оригинала.',
    backHref: '#g3-year-2018', backLabel: 'Дискуссия 2018',
  },
  {
    key: 'responses', title: 'ChurchLeaders. The Statement on Social Justice and the Gospel Stirs Up Controversy and Conversation', period: 'Сентябрь 2018', kind: 'Современный журналистский отклик',
    publicUrl: 'https://churchleaders.com/news/333017-the-statement-on-social-justice-and-the-gospel-stirs-up-controversy-and-conversation.html',
    locator: 'Отклики на декларацию; участники дискуссии не приравниваются ко всем выступавшим на G3.',
    backHref: '#g3-year-2018', backLabel: 'Отклики на заявление',
  },
  {
    key: '2019-announcement', title: 'The Mission of God. Спонсорский анонс на сайте Тима Чаллиса', period: 'Анонс конференции 17–19 января 2019', kind: 'Рекламная программа',
    publicUrl: 'https://www.challies.com/sponsored/the-mission-of-god/',
    locator: 'Название темы и перечень приглашённых. Рекламная публикация не является независимым репортажем.',
    backHref: '#g3-year-2019', backLabel: 'Программа 2019',
  },
  {
    key: '2019', title: 'GNL. 2019 G3 Conference | G3 Ministries', period: 'Конференция 2019 года', kind: 'Каталог записей',
    publicUrl: 'https://www.gnli.com/titles/2019-G3-Conference-or-G3-Ministries/2903',
    locator: 'Missions and the Suffering Church (David Platt); Missions: The Battle Cry of Hedonism (John Piper); The Great Commission through Church Planting (Mark Dever).',
    limitation: 'Прочитаны заголовки карточек. Дословные слова докладчиков и содержание аудио здесь не удостоверяются.',
    backHref: '#g3-year-2019', backLabel: 'Записи конференции 2019',
  },
  {
    key: '2020', title: 'GNL. 2020 G3 Conference | G3 Ministries', period: 'Конференция 2020 года', kind: 'Каталог записей',
    publicUrl: 'https://www.gnli.com/titles/2020-G3-Conference-or-G3-Ministries/2905',
    locator: 'True Worshippers (MacArthur), The Blessedness of Worship (Johnson), All Glory to God Alone (Lawson), Worshipping God Reverently (Ascol), Laying a Proper Foundation for Worship (Washer).',
    limitation: 'Сведения о заголовках каталога; подробное содержание записей здесь не удостоверяется.',
    backHref: '#g3-year-2020', backLabel: 'Конференция 2020',
  },
  {
    key: 'aniol', title: 'Скотт Аниол. Important Announcement', period: '1 сентября 2021', kind: 'Письменное заявление участника',
    publicUrl: 'https://religiousaffections.org/update/important-announcement/',
    locator: 'Первый абзац — принятая должность и планы; абзац о завершении развития Religious Affections Ministries — предполагаемый перенос части изданий.',
    limitation: 'Объявленные планы не подтверждают выпуск каждого проекта на эту дату.',
    backHref: '#g3-growth', backLabel: 'Издательское расширение',
  },
  {
    key: 'context', title: 'Sharper Iron. Gospel, Grace, Glory: An Examination of G3 Ministries', period: '2023', kind: 'Историко-богословский обзор',
    publicUrl: 'https://sharperiron.org/article/gospel-grace-glory-examination-of-g3-ministries',
    locator: 'Раздел Ministries: Church Network и книги G3 Press; следующий абзац — начало Gloria Deo Journal в 2022 году. В разделе Fundamentalism приведены слова Бьюса о разных требованиях к конференции и церковной сети.',
    limitation: 'Вторичный обзор. Не устанавливает точную дату запуска G3+ и не заменяет оригинальные документы каждого проекта.',
    backHref: '#g3-growth', backLabel: 'Проекты G3',
  },
  {
    key: '2023-announcement', title: 'Carolyn Cunningham. Answers in Genesis conference is Sept. 21-23. The Atlanta Journal-Constitution', period: '6 сентября 2023', kind: 'Современный анонс',
    publicUrl: 'https://www.ajc.com/neighborhoods/south-fulton/answers-in-genesis-conference-is-sept-21-23/EAVGL6ABVBCUVPH5L2OWO2YDKY/',
    locator: 'Первые три абзаца: G3 National Conference, 21–23 сентября, тема The Sovereignty of God; Ken Ham назван приглашённым докладчиком.',
    limitation: 'Это сообщение до события, а не репортаж о состоявшихся сессиях; оно не подтверждает весь состав выступавших.',
    backHref: '#g3-year-2023', backLabel: 'Конференция 2023',
  },
  {
    key: '2023-participant', title: 'Элизабет Прата. G3 Conference 2023: Day 2', period: '22 сентября 2023', kind: 'Рассказ участницы',
    publicUrl: 'https://the-end-time.org/2023/09/22/g3-conference-2023-day-2/',
    locator: 'Абзацы о сессиях James Coates, James White и Justin Peters; описание панели вопросов и ответов.',
    limitation: 'Именованное личное свидетельство, не независимая стенограмма; приведённые автором прямые цитаты не воспроизводятся.',
    backHref: '#g3-year-2023', backLabel: 'Свидетельство о 2023 годе',
  },
  {
    key: '2024-reformation', title: 'G3 / Ticket Tailor. 2024 G3 Regional Conference (The Reformation Conference)', period: '9–11 мая 2024', kind: 'Регистрация организатора',
    publicUrl: 'https://www.tickettailor.com/events/g3ministries/1010697',
    locator: 'Заголовок, даты и поле Location: Countryside Bible Church, 76092.',
    limitation: 'Показывает объявленное мероприятие, не удостоверяет фактическую посещаемость.',
    backHref: '#g3-year-2024', backLabel: 'Региональные встречи 2024',
  },
  {
    key: '2024-publisher', title: 'G3 / Ticket Tailor. 2024 Cessationist Conference Publisher', period: '3–5 октября 2024', kind: 'Регистрация издателей',
    publicUrl: 'https://www.tickettailor.com/events/g3ministries/1270768',
    locator: 'Заголовок с уточнением Publisher; даты; First Baptist Church of Mustang, Oklahoma. Раздел Bookstore Publisher описывает пакет для издателей.',
    limitation: 'Не общая регистрация слушателей и не отчёт об их прибытии. Используется только для объявленных дат и площадки.',
    backHref: '#g3-year-2024', backLabel: 'Октябрьская встреча 2024',
  },
  {
    key: 'peters', title: 'Джастин Питерс. JPM Newsletter 2024', period: '15 января 2025; отчёт о 2024 годе', kind: 'Свидетельство участника',
    publicUrl: 'https://justinpeters.org/jpm-newsletter-2024/',
    locator: 'Раздел Domestic Travels, абзац, начинающийся The Cessationist Conference: автор сообщает о своём выступлении.',
    limitation: 'Дата публикации не совпадает с годом описываемых поездок. Текст не является полным протоколом конференции.',
    backHref: '#g3-year-2024', backLabel: 'Участие в конференции',
  },
  {
    key: 'early-venue', title: 'Jesse T. Jackson. Сообщение ChurchLeaders о планировавшейся Cessationist Conference', period: '5 октября 2023', kind: 'Ранний вторичный анонс',
    publicUrl: 'https://churchleaders.com/news/460190-only-in-america-would-we-monetize-the-spirit-of-unbelief-sean-feucht-calls-out-g3-ministries-cessationist-conference.html',
    locator: 'Раннее объявление площадки в Sun Valley, California; сопоставляется с более поздним листингом организатора в Оклахоме.',
    limitation: 'Первоначальный план не подменяет итоговую площадку. Причина изменения не установлена.',
    backHref: '#g3-year-2024', backLabel: 'Разные анонсы площадки',
  },
  {
    key: 'corporation', title: 'Georgia Secretary of State. G3 Ministries for the Church, Inc.', period: '6 июня 2019', kind: 'Официальная корпоративная запись',
    publicUrl: 'https://ecorp.sos.ga.gov/BusinessSearch',
    locator: 'Control no. 19085916; incorporation filing 17370469. Дата оформления некоммерческой корпорации в Джорджии.',
    limitation: 'Дата оформления юридического лица не является датой первой конференции.',
    backHref: '#g3-growth', backLabel: 'Юридическое оформление',
  },
] as const;

export const G3_HISTORY_BIBLIOGRAPHY: readonly BibliographyEntry[] = entries.map(({ key, ...entry }) => ({
  ...entry,
  id: `hist-src-${key}`,
}));

export type G3HistorySourceKey = (typeof entries)[number]['key'];
export function historySourceHref(key: G3HistorySourceKey): `#hist-src-${G3HistorySourceKey}` {
  return `#hist-src-${key}`;
}
