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
