import { G3_PRODUCT_METADATA } from './g3ProductMetadata';
import { G3_HISTORY_DRAFT_METADATA } from './g3HistoryDraftMetadata';

/**
 * G3 editorial series registry: one visual series, separate routes, SEO and bibliographies.
 * A part is linkable ONLY when it is published. Held manuscripts never become public links;
 * flip `publicationStatus` in the owning metadata after a signed Research handoff.
 */
export type JournalSeriesPart = {
  id: 'history' | 'crises';
  numeral: string;
  title: string;
  years: string;
  summary: string;
  href: string;
  published: boolean;
};

export const G3_SERIES = {
  title: 'Серия «G3 Ministries»',
  parts: [
    {
      id: 'history',
      numeral: 'I',
      title: 'История конференций, проповедников и служения',
      years: '2013–2024',
      summary: 'Церковь Pray’s Mill, темы конференций, записи выступлений, заявление 2018 года и рост служения.',
      href: new URL(G3_HISTORY_DRAFT_METADATA.proposedCanonical).pathname,
      published: (G3_HISTORY_DRAFT_METADATA.publicationStatus as string) === 'PUBLISHED',
    },
    {
      id: 'crises',
      numeral: 'II',
      title: 'Два кризиса и завершение работы',
      years: '2025–2026',
      summary: 'Отставка основателя, новый конфликт, финансовые декларации и открытые вопросы.',
      href: new URL(G3_PRODUCT_METADATA.canonical).pathname,
      published: true,
    },
  ] satisfies JournalSeriesPart[],
} as const;
