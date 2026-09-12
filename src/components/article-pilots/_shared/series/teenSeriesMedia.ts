export interface TeenSeriesMediaAsset {
  hero: string;
  rail: string;
  alt: string;
}

export const TEEN_SERIES_MEDIA = {
  series: {
    hero: '/images/teen-series/series-cover.webp',
    rail: '/images/teen-series/series-cover-600w.webp',
    alt: 'Синий свет телефона в тёмном помещении и тёплая открытая дверь вдали — образ скрытой жизни и возвращения к свету',
  },
  pages: {
    'teen-double-life': {
      hero: '/images/teen-series/01-double-life.webp',
      rail: '/images/teen-series/01-double-life-600w.webp',
      alt: 'Одинокий светящийся телефон в тёмном зале и далёкая открытая дверь — образ двойной жизни',
    },
    'teen-parents-after-disclosure': {
      hero: '/images/teen-series/02-after-disclosure.webp',
      rail: '/images/teen-series/02-after-disclosure-600w.webp',
      alt: 'Открытая Библия, выключенный телефон и две чашки на ночном столе — образ трудного разговора и восстановления',
    },
    'teen-church-response': {
      hero: '/images/teen-series/03-church-response.webp',
      rail: '/images/teen-series/03-church-response-600w.webp',
      alt: 'Молодой человек и служитель сидят на задних скамьях пустого баптистского молитвенного дома; впереди кафедра с Библией',
    },    'adult-child-left-home': {
      hero: '/images/teen-series/04-left-home.webp',
      rail: '/images/teen-series/04-left-home-600w.webp',
      alt: 'Ночная дорога ведёт к освещённому дому; рюкзак оставлен у ворот — образ ухода и надежды на возвращение',
    },
    'adult-child-home-money': {
      hero: '/images/teen-series/05-home-money.webp',
      rail: '/images/teen-series/05-home-money-600w.webp',
      alt: 'Ключи, монеты, блокнот, банковская карта и телефон на домашнем столе — образ правил, денег и ответственности',
    },
    'adult-child-authority': {
      hero: '/images/teen-series/06-adult-authority.webp',
      rail: '/images/teen-series/06-adult-authority-600w.webp',
      alt: 'Отец передаёт взрослому сыну ключ от дома у порога — образ изменившейся ответственности',
    },
    'adult-daughter-marriage': {
      hero: '/images/teen-series/07-daughter-marriage.webp',
      rail: '/images/teen-series/07-daughter-marriage-600w.webp',
      alt: 'Библия с обручальными кольцами, письмо, белые цветы и две чашки — образ брака, совета и завета',
    },
  },
} as const satisfies {
  series: TeenSeriesMediaAsset;
  pages: Record<string, TeenSeriesMediaAsset>;
};

export type TeenSeriesMediaPageId = keyof typeof TEEN_SERIES_MEDIA.pages;

export function teenSeriesMediaFor(pageId: string): TeenSeriesMediaAsset {
  const media = TEEN_SERIES_MEDIA.pages[pageId as TeenSeriesMediaPageId];
  if (!media) throw new Error(`Unknown teen-series media page: ${pageId}`);
  return media;
}
