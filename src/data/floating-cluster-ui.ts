import seriesData from '../../data/series.json';

export type SeriesKey = keyof typeof seriesData;

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
