export interface ApostasySeriesMediaAsset {
  hero: string;
  rail: string;
  alt: string;
}

export const APOSTASY_SERIES_MEDIA = {
  series: {
    hero: '/images/articles/otstuplenie-chto-govorit-bibliya.webp',
    rail: '/images/articles/otstuplenie-chto-govorit-bibliya-600w.webp',
    alt: 'Рука сеятеля роняет семя на каменистую дорогу: зерно падает на утоптанную землю при дороге, где ему не во что пустить корень',
  },
  pages: {
    'otstuplenie-chto-govorit-bibliya': {
      hero: '/images/articles/otstuplenie-chto-govorit-bibliya.webp',
      rail: '/images/articles/otstuplenie-chto-govorit-bibliya-600w.webp',
      alt: 'Рука сеятеля роняет семя на каменистую дорогу: зерно падает на утоптанную землю при дороге, где ему не во что пустить корень',
    },
    'otstupniki-biblii-iuda-saul-ierovoam-dimas': {
      hero: '/images/articles/otstupniki-biblii-iuda-saul-ierovoam-dimas.webp',
      rail: '/images/articles/otstupniki-biblii-iuda-saul-ierovoam-dimas-600w.webp',
      alt: 'Упавшая позолоченная корона и сломанное копьё на поле проигранной битвы на рассвете, позади — дымящиеся руины',
    },
    'petr-i-iuda-padenie-ili-otstuplenie': {
      hero: '/images/articles/petr-i-iuda-padenie-ili-otstuplenie.webp',
      rail: '/images/articles/petr-i-iuda-padenie-ili-otstuplenie-600w.webp',
      alt: 'Две руки одновременно обмакивают хлеб в одно глиняное блюдо за вечерним столом при свете масляной лампы',
    },
    'otreklis-ot-hrista-istoriya-cerkvi': {
      hero: '/images/articles/otreklis-ot-hrista-istoriya-cerkvi.webp',
      rail: '/images/articles/otreklis-ot-hrista-istoriya-cerkvi-600w.webp',
      alt: 'Рука сыплет зёрна фимиама на огонь бронзового жертвенника в римском храме, позади в тени — римский воин',
    },
    'kogda-chelovek-uhodit-ot-very': {
      hero: '/images/articles/kogda-chelovek-uhodit-ot-very.webp',
      rail: '/images/articles/kogda-chelovek-uhodit-ot-very-600w.webp',
      alt: 'На рассветной дороге один путник опустился на колени перед упавшим и протягивает ему открытую руку, чтобы поднять',
    },
  },
} as const satisfies {
  series: ApostasySeriesMediaAsset;
  pages: Record<string, ApostasySeriesMediaAsset>;
};

export type ApostasySeriesMediaPageId = keyof typeof APOSTASY_SERIES_MEDIA.pages;

export function apostasySeriesMediaFor(pageId: string): ApostasySeriesMediaAsset {
  const media = APOSTASY_SERIES_MEDIA.pages[pageId as ApostasySeriesMediaPageId];
  if (!media) throw new Error(`Unknown apostasy-series media page: ${pageId}`);
  return media;
}
