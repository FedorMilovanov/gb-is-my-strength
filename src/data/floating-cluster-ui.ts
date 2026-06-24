import seriesData from '../../data/series.json';

export type FloatingClusterMode = 'single' | 'series-rich' | 'series-lite' | 'catalog-utility' | 'app-controls' | 'prep-only';

export interface FloatingClusterUiConfig {
  mode: FloatingClusterMode;
  variant: string;
  tone: string;
  seriesKey?: keyof typeof seriesData;
  hubHref?: string;
}

export const floatingClusterUi = {
  hermeneutics: {
    mode: 'single',
    variant: 'hermeneutics',
    tone: 'quiet-gold',
  },
  apologetics: {
    mode: 'single',
    variant: 'apologetics',
    tone: 'ink-stone',
  },
  gill: {
    mode: 'series-rich',
    variant: 'gill',
    tone: 'antique-brass',
    seriesKey: 'dzhon-gill',
    hubHref: '/biografii/',
  },
  pastor: {
    mode: 'series-lite',
    variant: 'pastor',
    tone: 'dark-copper',
    seriesKey: 'pastor-series',
    hubHref: '/pastor-series/',
  },
  heart: {
    mode: 'series-lite',
    variant: 'heart',
    tone: 'deep-red',
    seriesKey: 'hard-texts',
    hubHref: '/hard-texts/',
  },
  baptisty: {
    mode: 'prep-only',
    variant: 'baptisty',
    tone: 'archive-blue-grey',
    seriesKey: 'russian-baptism',
    hubHref: '/baptisty-rossii/',
  },
} as const satisfies Record<string, FloatingClusterUiConfig>;

export const floatingClusterRoutes = {
  '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/': floatingClusterUi.hermeneutics,
  '/articles/kod-da-vinchi/': floatingClusterUi.apologetics,
  '/articles/20-antisovetov-pastoru/': floatingClusterUi.pastor,
  '/articles/dzhon-gill-istoricheskiy-kontekst/': floatingClusterUi.gill,
  '/articles/dzhon-gill-chast-1-chelovek/': floatingClusterUi.gill,
  '/articles/dzhon-gill-chast-2-uchenyi/': floatingClusterUi.gill,
  '/articles/dzhon-gill-chast-3-nasledie/': floatingClusterUi.gill,
  '/articles/dzhon-gill-spravochnik/': floatingClusterUi.gill,
  '/articles/krajne-li-isporcheno-serdce/': floatingClusterUi.heart,
  '/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/': floatingClusterUi.heart,
} as const;

export type SeriesKey = keyof typeof seriesData;

export function getSeriesParts(seriesKey: SeriesKey) {
  return seriesData[seriesKey]?.parts ?? [];
}

export function getSeriesLiteMeta(seriesKey: SeriesKey, currentSlug: string) {
  const series = seriesData[seriesKey];
  const parts = series?.parts ?? [];
  const index = parts.findIndex((part) => part.slug === currentSlug);
  const current = index >= 0 ? parts[index] : null;
  return {
    title: series?.title ?? '',
    baseUrl: series?.baseUrl ?? '/',
    parts,
    index,
    current,
    currentNumber: current?.n ?? null,
  };
}
