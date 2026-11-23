/** Standalone pastoral letter: intentionally outside the numbered series config. */
export const TEEN_PERSONAL_LETTER_SLUG = 'poka-vse-dumayut-chto-u-tebya-vse-normalno';
export const TEEN_PERSONAL_LETTER_HREF = `/articles/${TEEN_PERSONAL_LETTER_SLUG}/`;
export const TEEN_PERSONAL_LETTER_SOURCE = `src/pages/articles/${TEEN_PERSONAL_LETTER_SLUG}/index.astro`;

interface LetterArticleData {
  slug: string;
  title: string;
  h1?: string;
  description: string;
  readingTime?: number;
  draft: boolean;
  noindex: boolean;
}

interface LetterRouteOwner {
  owner?: string;
  status?: string;
  source?: string;
}

interface LetterCardContent {
  title: string;
  description: string;
  readingTime?: number;
}

export type TeenPersonalLetterCard = LetterCardContent & (
  | { kind: 'published'; href: string }
  | { kind: 'preview'; href: null }
);

/**
 * One decision for the visible card and CollectionPage.hasPart.
 * A source-only draft may be seen in DEV, never as a link or production teaser.
 * Route registration and the production route contract are separate release gates.
 */
export function resolveTeenPersonalLetterCard(
  articles: readonly LetterArticleData[],
  routeOwner: LetterRouteOwner | undefined,
  dev: boolean,
): TeenPersonalLetterCard | null {
  const matches = articles.filter(({ slug }) => slug === TEEN_PERSONAL_LETTER_SLUG);
  if (matches.length !== 1) return null;

  const article = matches[0];
  const content = {
    title: article.h1 || article.title,
    description: article.description,
    readingTime: article.readingTime,
  };

  if (
    article.draft === false &&
    article.noindex === false &&
    routeOwner?.owner === 'astro' &&
    routeOwner.status === 'production-dist' &&
    routeOwner.source === TEEN_PERSONAL_LETTER_SOURCE
  ) {
    return { ...content, kind: 'published', href: TEEN_PERSONAL_LETTER_HREF };
  }

  return dev ? { ...content, kind: 'preview', href: null } : null;
}
