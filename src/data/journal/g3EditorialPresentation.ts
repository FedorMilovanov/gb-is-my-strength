/** Presentation projections only. No claims, evidence states or publication authority. */
import type { JournalCover } from '@/components/journal/JournalArticleOpening.astro';
import type { SeriesEntry } from '@/components/journal/JournalSeriesNav.astro';

// Reuse the prepared Product assets; never substitute an invented historical photograph.
export const G3_EDITORIAL_COVER = {
  src: '/images/journal/g3-ministries-cover-1200.webp',
  avifSrcset: '/images/journal/g3-ministries-cover-640.avif 640w, /images/journal/g3-ministries-cover-1200.avif 1200w',
  webpSrcset: '/images/journal/g3-ministries-cover-640.webp 640w, /images/journal/g3-ministries-cover-1200.webp 1200w',
  width: 1200,
  height: 675,
  alt: 'Иллюстративная обложка G3 Ministries: раскрытая книга и слова Gospel, Grace, Glory.',
  caption: 'Иллюстративная обложка. Не архивная фотография.',
} as const satisfies JournalCover;

export const G3_EDITORIAL_SERIES = {
  label: 'Серия о G3 Ministries',
  title: 'G3 Ministries / Два самостоятельных материала',
  entries: [
    {
      id: 'history',
      number: 'I',
      title: 'История движения и конференций',
      meta: '2013–2024 · Готовится к публикации',
      currentMeta: '2013–2024 · Редакционная рукопись',
      // Deliberately no href: PUBLICATION_HOLD, no public history route exists.
    },
    {
      id: 'crisis',
      number: 'II',
      title: 'Кризисы и завершение работы',
      meta: '2025–2026 · Документальное досье',
      href: '/journal/dossiers/g3/',
    },
  ] satisfies readonly SeriesEntry[],
} as const;
