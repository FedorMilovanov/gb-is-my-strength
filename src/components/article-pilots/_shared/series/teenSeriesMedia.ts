export interface TeenSeriesMediaAsset {
  hero: string;
  rail: string;
  alt: string;
}

export const TEEN_SERIES_MEDIA = {
  series: {
    hero: '/images/teen-series/series-cover.webp',
    rail: '/images/teen-series/series-cover-600w.webp',
    alt: 'Телефон между холодным светом комнаты и тёплым светом семьи — образ скрытой и открытой жизни',
  },
  pages: {
    'teen-double-life': {
      hero: '/images/teen-series/01-double-life.webp',
      rail: '/images/teen-series/01-double-life-600w.webp',
      alt: 'Девушка-подросток с телефоном у дождливого окна; в стекле отражается её лицо — образ двойной жизни',
    },
    'teen-parents-after-disclosure': {
      hero: '/images/teen-series/02-after-disclosure.webp',
      rail: '/images/teen-series/02-after-disclosure-600w.webp',
      alt: 'Родители после трудного разговора на ночной кухне; на столе Библия и выключенный телефон',
    },
    'teen-church-response': {
      hero: '/images/teen-series/03-church-response.webp',
      rail: '/images/teen-series/03-church-response-600w.webp',
      alt: 'Молодой человек и служитель сидят на задних скамьях пустого баптистского молитвенного дома; впереди кафедра с Библией',
    },    'adult-child-left-home': {
      hero: '/images/teen-series/04-left-home.webp',
      rail: '/images/teen-series/04-left-home-600w.webp',
      alt: 'Молодой взрослый уходит с сумкой по мокрому двору от освещённого подъезда',
    },
    'adult-child-home-money': {
      hero: '/images/teen-series/05-home-money.webp',
      rail: '/images/teen-series/05-home-money-600w.webp',
      alt: 'Ключи, телефон и банковская карта на тумбе в прихожей; взрослый сын возвращается домой',
    },
    'adult-child-authority': {
      hero: '/images/teen-series/06-adult-authority.webp',
      rail: '/images/teen-series/06-adult-authority-600w.webp',
      alt: 'Отец передаёт взрослому сыну ключ от дома у порога — образ изменившейся ответственности',
    },
    'adult-daughter-marriage': {
      hero: '/images/teen-series/07-daughter-marriage.webp',
      rail: '/images/teen-series/07-daughter-marriage-600w.webp',
      alt: 'Молодая взрослая дочь с ключами у двери в подъезд разговаривает с отцом в прихожей',
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
