/**
 * g3SourceBibliography — читательская библиография досье G3.
 *
 * GBS-JOURNAL-READER-SOURCE-LOCATORS-MISSING: читатель досье видел только
 * служебные ID (`G3-S…`) без библиографической проекции. Записи ниже —
 * ручная транспозиция строк SOURCE_LEDGER.md из Research-репозитория на
 * immutable publication seal 298d00ddc4db46522c8ad904016e98a4426c9fcf:
 * название/объект, датировка, tier, locator (номер filings, return IDs,
 * wayback-timestamp, SHA) и публикационный статус. Публичные ссылки даны
 * только там, где объект заведомо публичен (официальные порталы штата и
 * IRS); остальные записи остаются REFERENCE без внешнего URL — это не
 * снимает HOLD и не авторизует републикацию тел источников.
 */

export const G3_SOURCE_LEDGER_URL =
  'https://github.com/FedorMilovanov/Research/blob/298d00ddc4db46522c8ad904016e98a4426c9fcf/G3_HISTORY/SOURCE_LEDGER.md';

export interface G3SourceBibliographyEntry {
  id: string;
  title: string;
  period: string;
  tier: string;
  eligibility: string;
  locator: string;
  publicUrl?: string;
}

export const G3_SOURCE_BIBLIOGRAPHY: G3SourceBibliographyEntry[] = [
  {
    id: 'G3-S001',
    title: 'Georgia Secretary of State — корпоративное семейство записей G3 Ministries for the Church, Inc. (control no. 19085916)',
    period: '2019–2026',
    tier: 'A1',
    eligibility: 'PUBLICATION_ELIGIBLE',
    locator: 'Incorporation 2019-06-06, filing 17370469; annual registrations 17449198 (2019-07-16) и 18903966 (2020-03-30); Business Search 2026-09-08: businessId 2751672, status Active/Compliance.',
    publicUrl: 'https://ecorp.sos.ga.gov/BusinessSearch',
  },
  {
    id: 'G3-S002',
    title: 'IRS Form 990 e-file family для EIN 84-2403597, официальный IRS TEOS bulk XML',
    period: 'FY2019–FY2025',
    tier: 'A1',
    eligibility: 'PUBLICATION_ELIGIBLE',
    locator: 'Return IDs: FY2023 202411429349300611, FY2024 202541359349304489, FY2025 202641339349303874; amended FY2022 comparator; Schedule L FY2024/FY2025; raw SHA зафиксированы в ledger.',
    publicUrl: 'https://www.irs.gov/charities-non-profits/form-990-series-downloads',
  },
  {
    id: 'G3-S008',
    title: 'Официальное заявление G3 о Josh Buice',
    period: '2025-05-12',
    tier: 'A3',
    eligibility: 'REFERENCE',
    locator: 'Датированное официальное заявление; объект и формулировки зафиксированы в Research-досье.',
  },
  {
    id: 'G3-S009',
    title: 'Официальное сообщение G3 «Renewed Vision and New Logo»',
    period: '2025-06-16',
    tier: 'A3',
    eligibility: 'REFERENCE',
    locator: 'Датированная официальная публикация бренда.',
  },
  {
    id: 'G3-S010',
    title: 'Официальное назначение Scott Aniol президентом G3',
    period: '2025-07',
    tier: 'A3',
    eligibility: 'REFERENCE',
    locator: 'Официальный анонс назначения; дата и роль зафиксированы.',
  },
  {
    id: 'G3-S011',
    title: 'G3 / event backend — отмена конференции «Faithful in the Ordinary» 2027',
    period: '2026',
    tier: 'A3',
    eligibility: 'REFERENCE',
    locator: 'Служебная событийная маршрутизация официального сайта; снимок состояния 2026 года.',
  },
  {
    id: 'G3-S012',
    title: 'Phil Johnson, «Haman’s Gallows», Pyromaniacs',
    period: '2026-08-19',
    tier: 'A1',
    eligibility: 'REFERENCE',
    locator: 'Независимый разбор; датировка публикации 2026-08-19, атрибуция процесса Buck.',
  },
  {
    id: 'G3-S015',
    title: 'Заявление о раскаянии и отставках Pray’s Mill / G3 (Aniol, Norton, Joyner и четвёртый пастор)',
    period: '2026-08-25',
    tier: 'A3',
    eligibility: 'REFERENCE',
    locator: 'Attributed paraphrase only: тело письма не републикуется, используется атрибуция и датировка.',
  },
  {
    id: 'G3-S017',
    title: 'MinistryWatch — сообщение о закрытии / завершении операций G3',
    period: '2026-09-04',
    tier: 'B1',
    eligibility: 'REFERENCE',
    locator: 'Вторичная журналистская фиксация даты объявления.',
  },
  {
    id: 'G3-S023',
    title: 'Официальный анонс G3 о переходе Virgil Walker',
    period: '2025-06-30',
    tier: 'A3',
    eligibility: 'REFERENCE',
    locator: 'Официальное сообщение о кадровом переходе.',
  },
  {
    id: 'G3-S024',
    title: 'Официальная инициатива G3 Pastor-Theologian',
    period: '2025-07-18',
    tier: 'A3',
    eligibility: 'REFERENCE',
    locator: 'Официальная программная страница инициативы.',
  },
  {
    id: 'G3-S028',
    title: 'IRS Form 990 Series Downloads — официальный TEOS bulk e-file XML archive + exact-head acquisition',
    period: 'current acquisition route',
    tier: 'A1',
    eligibility: 'PUBLICATION_ELIGIBLE',
    locator: 'Маршрут приобретения raw XML; exact-head run 34233453690 по 401 листу FY2025; Living-Heritage leaf в IRS990/Desc.',
    publicUrl: 'https://www.irs.gov/charities-non-profits/form-990-series-downloads',
  },
  {
    id: 'G3-S033',
    title: 'Apple App Store — листинги G3+ / G3 Plus',
    period: 'crawled Sep. 2026',
    tier: 'A1',
    eligibility: 'REFERENCE',
    locator: 'Снимок листинга магазина приложений (сентябрь 2026).',
  },
  {
    id: 'G3-S035',
    title: 'Protestia — независимый review источников / проповеди Buck + заявление FBC Lindale',
    period: '2026-08-17',
    tier: 'B1',
    eligibility: 'REFERENCE',
    locator: 'Независимая проверка атрибуции; датировка 2026-08-17.',
  },
  {
    id: 'G3-S042',
    title: 'ChurchLeaders и Christian Post — фактически идентичные репродукции письма четырёх пасторов',
    period: '2026-08-25/26',
    tier: 'B1',
    eligibility: 'REFERENCE',
    locator: 'Репродукции не считаются независимыми свидетелями; фиксируется линия републикации.',
  },
  {
    id: 'G3-S046',
    title: 'Официальная страница G3 «Men Who Lead» / сетевое лидерское событие',
    period: '2026 pre-shutdown',
    tier: 'A3',
    eligibility: 'REFERENCE',
    locator: 'Снимок официальной страницы до закрытия сайта.',
  },
  {
    id: 'G3-S047',
    title: 'Официальные авторские / Pastor-Theologian страницы Matt Sikes',
    period: 'late 2025–2026',
    tier: 'A2',
    eligibility: 'REFERENCE',
    locator: 'Снимки официальных авторских страниц.',
  },
  {
    id: 'G3-S050',
    title: 'Google Play — developer/support метаданные G3+',
    period: 'observed Sep. 2026',
    tier: 'A1',
    eligibility: 'REFERENCE',
    locator: 'Наблюдение метаданных магазина (сентябрь 2026).',
  },
  {
    id: 'G3-S053',
    title: 'Официальный commerce-витрина G3 Press / коллекция G3 Press Books',
    period: 'observed 2026-09-07',
    tier: 'A2',
    eligibility: 'REFERENCE',
    locator: 'Снимок витрины от 2026-09-07.',
  },
  {
    id: 'G3-S054',
    title: 'Servants of Grace / Theology for Life Publishing — текущие авторские и магазинные поверхности Dave Jenkins',
    period: 'observed 2026-09-07',
    tier: 'A2',
    eligibility: 'REFERENCE',
    locator: 'Снимок сторонних издательских поверхностей от 2026-09-07.',
  },
  {
    id: 'G3-S096',
    title: 'Wayback-снимок официальной страницы G3 «Who We Are», timestamp 20260721102641',
    period: '2026-07-21',
    tier: 'A2',
    eligibility: 'REFERENCE',
    locator: 'Raw archived payload SHA a946cafd…, decoded HTML SHA 30908b37…; roster из шести имён датирован снимком.',
  },
];
