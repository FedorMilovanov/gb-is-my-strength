/** Standalone pastoral letter: intentionally outside the numbered series config. */
export const TEEN_PERSONAL_LETTER_SLUG = 'poka-vse-dumayut-chto-u-tebya-vse-normalno';
export const TEEN_PERSONAL_LETTER_HREF = `/articles/${TEEN_PERSONAL_LETTER_SLUG}/`;
export const TEEN_PERSONAL_LETTER_SOURCE = `src/pages/articles/${TEEN_PERSONAL_LETTER_SLUG}/index.astro`;

const LETTER_MEDIA_BASE = '/images/teen-series/personal-letter';
const LETTER_OG_IMAGE = `${LETTER_MEDIA_BASE}-og.webp`;

interface LetterMedia {
  src: string;
  srcset: string;
  alt: string;
}

interface LetterArticleData {
  slug: string;
  title: string;
  h1?: string;
  description: string;
  readingTime?: number;
  ogImage?: string;
  ogImageAlt?: string;
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
  media?: LetterMedia;
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
  // W51: use the selected artwork only once its canonical MDX metadata
  // points to the committed asset family. No fallback to the trilogy hero.
  const alt = article.ogImageAlt?.trim();
  const media = article.ogImage === LETTER_OG_IMAGE && alt ? {
    src: `${LETTER_MEDIA_BASE}-cover.webp`,
    srcset: `${LETTER_MEDIA_BASE}-cover-600w.webp 600w, ${LETTER_MEDIA_BASE}-cover-1200w.webp 1200w, ${LETTER_MEDIA_BASE}-cover.webp 1600w`,
    alt,
  } : undefined;
  const content: LetterCardContent = {
    title: article.h1 || article.title,
    description: article.description,
    readingTime: article.readingTime,
    ...(media ? { media } : {}),
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
