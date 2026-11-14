/**
 * Central editorial update ledger. One published event = one meaningful change
 * to an EXISTING article, never a duplicate publication or an automatic git bump.
 * Article identity and title come from the existing search manifest.
 */
import ledger from '../../data/editorial-updates.json';
import searchManifest from '../../data/search-manifest.json';

export type EditorialUpdateKind = 'new-evidence' | 'correction' | 'expanded' | 'revised-conclusion';

interface RawEditorialUpdate {
  id: string;
  artwork: string;
  status: 'draft' | 'published';
  articleUrl: string;
  date: string;
  kind: EditorialUpdateKind;
  anchor: string;
  headline: string;
  summary: string;
  sourceUrls: string[];
}

export interface EditorialUpdate extends RawEditorialUpdate {
  articleTitle: string;
  articleSection: string;
  href: string;
}

export const EDITORIAL_UPDATE_LABELS: Record<EditorialUpdateKind, string> = {
  'new-evidence': 'Новый источник',
  correction: 'Исправление факта',
  expanded: 'Дополнено исследование',
  'revised-conclusion': 'Пересмотрен вывод',
};

const articleIndex = new Map(
  searchManifest.items
    .filter((item) => item.type === 'article' && item.url)
    .map((item) => [item.url, item]),
);
const ids = new Set<string>();

export const publishedEditorialUpdates: EditorialUpdate[] = (ledger.entries as RawEditorialUpdate[])
  .map((entry) => {
    if (ids.has(entry.id)) throw new Error(`Повтор editorial update id: ${entry.id}`);
    ids.add(entry.id);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(entry.date) || !Number.isFinite(Date.parse(entry.date))) {
      throw new Error(`Неверная дата редакционного обновления: ${entry.id}`);
    }
    if (!/^[a-z0-9-]+$/.test(entry.anchor) || !entry.articleUrl.startsWith('/') || !entry.articleUrl.endsWith('/')) {
      throw new Error(`Неверный URL или якорь редакционного обновления: ${entry.id}`);
    }
    if (!/^archive-(?:0[1-9]|10)\.webp$/.test(entry.artwork)) {
      throw new Error(`Недопустимая архивная иллюстрация: ${entry.id}`);
    }
    if (!EDITORIAL_UPDATE_LABELS[entry.kind] || !entry.summary.trim() || !entry.headline.trim()) {
      throw new Error(`Незаполнено редакционное обновление: ${entry.id}`);
    }
    const article = articleIndex.get(entry.articleUrl);
    if (!article) throw new Error(`Нет опубликованной статьи для редакционного обновления: ${entry.articleUrl}`);
    return {
      ...entry,
      articleTitle: article.title || entry.articleUrl,
      articleSection: article.section || 'Статья',
      href: `${entry.articleUrl}#${entry.anchor}`,
    };
  })
  .filter((entry) => entry.status === 'published')
  .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

export function updatesForArticle(articleUrl: string): EditorialUpdate[] {
  return publishedEditorialUpdates.filter((entry) => entry.articleUrl === articleUrl);
}

export function editorialDate(date: string): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  });
}
