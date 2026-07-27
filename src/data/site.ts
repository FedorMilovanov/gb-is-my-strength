export const SITE = {
  name: 'Господь Бог — Сила Моя',
  url: 'https://gospod-bog.ru',
  locale: 'ru',
  authorName: 'Фёдор Милованов',
  orgId: 'https://gospod-bog.ru/#organization',
  websiteId: 'https://gospod-bog.ru/#website',
} as const;

export const SECTION_META = {
  articles: {
    label: 'Статьи',
    url: `${SITE.url}/articles/`,
    eyebrow: 'Библиотека проекта',
  },
  biografii: {
    label: 'Биографии',
    url: `${SITE.url}/biografii/`,
    eyebrow: 'Биографии служителей',
  },
  'hard-texts': {
    label: 'Трудные тексты',
    url: `${SITE.url}/hard-texts/`,
    eyebrow: 'Серия «Тайны человеческого сердца»',
  },
  nagornaya: {
    label: 'Нагорная проповедь',
    url: `${SITE.url}/nagornaya/`,
    eyebrow: 'Серия «Нагорная проповедь»',
  },
  'baptisty-rossii': {
    label: 'Баптисты России',
    url: `${SITE.url}/baptisty-rossii/`,
    eyebrow: 'История ЕХБ · Живая исследовательская серия',
  },
} as const;

/** Explicit ordering of articles within series (by slug). */
export const SERIES_ORDER: Record<string, string[]> = {
  'dzhon-gill': [
    'dzhon-gill-istoricheskiy-kontekst',
    'dzhon-gill-chast-1-chelovek',
    'dzhon-gill-chast-2-uchenyi',
    'dzhon-gill-chast-4-ekzeget',
    'dzhon-gill-chast-3-nasledie',
    'dzhon-gill-spravochnik',
  ],
  'russian-baptism': [
    'noch-na-kure',
    'yuzhnaya-shtunda',
    'dva-sezda-1884',
    'peterburgskaya-liniya',
    'goneniya-i-sovest',
    'sovetskaya-noch',
    'vsehib-1944',
    'iniciativnaya-gruppa',
    'podpolnaya-pechat',
    'spravochnik',
  ],
  'hard-texts': [
    'chto-bibliya-nazyvaet-serdcem',
    'krajne-li-isporcheno-serdce',
    'rimlyanam-7-veruyushchiy-ili-neveruyushchiy',
    'novoe-serdce',
    'serdce-i-duh',
    'serdce-spravochnik',
  ],
  'genesis-6': [
    'enoh-prorochestvoval-iuda-14-15-4q204',
    'angely-pod-mrakom-iuda-6-7-2-petra-2',
    'duhi-v-temnice-noi-kreshchenie-pobeda',
    'blagovestie-mertvym-1-petra-4-5-6',
  ],
};
