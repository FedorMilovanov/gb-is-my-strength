# ASTRO_COMPONENT_INVENTORY_2026.md — инвентарь будущих компонентов

Дата: 2026-06-12  
Связано с:

- `docs/TYPOGRAPHY_DESIGN_SYSTEM_2026.md`
- `docs/ACCESSIBILITY_STANDARD_2026.md`
- `docs/ASTRO_IMPLEMENTATION_BLUEPRINT_2026.md`

---

## 1. Цель

До миграции определить компонентную модель, чтобы не создавать хаотичные `.astro` и `.tsx` файлы.

Astro поддерживает typed props через TypeScript `interface Props` во frontmatter; Astro docs показывают pattern `interface Props { name: string } const { name } = Astro.props` [2](https://docs.astro.build/en/basics/astro-components/).

---

## 2. Layout components

### BaseLayout.astro

```ts
interface Props {
  title: string;
  description: string;
  canonical: string;
  robots?: string;
  ogImage?: string;
  ogImageAlt?: string;
  type?: 'website' | 'article';
  jsonLd?: unknown[];
}
```

Ответственность:

```text
html/head/body skeleton
SEO
global styles
header/footer
```

### ArticleLayout.astro

```ts
interface Props {
  entry: ArticleEntry;
  breadcrumbs: BreadcrumbItem[];
  related?: ArticleSummary[];
}
```

Ответственность:

```text
ArticleHeader
TOC
content slot
AuthorBox
SourceBox
RelatedArticles
```

### MapLayout.astro

```ts
interface Props {
  route: MapRoute;
  breadcrumbs: BreadcrumbItem[];
}
```

Ответственность:

```text
SEO for maps
MapTranscript
MapApp island
sources/methodology
```

---

## 3. SEO components

### Seo.astro

Props как в BaseLayout, но без shell.

### JsonLd.astro

```ts
interface Props {
  graph: unknown[];
}
```

### Breadcrumbs.astro

```ts
interface BreadcrumbItem {
  name: string;
  href: string;
}
interface Props {
  items: BreadcrumbItem[];
}
```

Должен рендерить видимые `<nav aria-label="Хлебные крошки">` и JSON-LD строится из тех же данных.

---

## 4. UI components

### Header.astro

```text
static HTML nav
current section state optional
mobile menu progressive enhancement later
```

### Footer.astro

```text
links to about/editorial policy/rss/map/karty
```

### Button.astro

Использовать осторожно. Нативные кнопки лучше.

```ts
import type { HTMLAttributes } from 'astro/types';
interface Props extends HTMLAttributes<'button'> {
  variant?: 'primary' | 'ghost' | 'gold';
}
```

Astro TypeScript docs показывают `HTMLAttributes<'a'>`/`HTMLAttributes<'button'>` для типизации native attributes [3](https://docs.astro.build/en/guides/typescript/).

---

## 5. Article components

### ArticleHeader.astro

```ts
interface Props {
  title: string;
  description: string;
  publishedAt: Date;
  updatedAt?: Date;
  author: Author;
  readingTime?: number;
  tags?: string[];
}
```

### ArticleToc.astro

```ts
interface Props {
  headings: Array<{ depth: number; slug: string; text: string }>;
}
```

### VerseBlock.astro

```ts
interface Props {
  ref: string;
  translation?: string;
  lang?: 'ru' | 'he' | 'grc';
}
```

### OriginalWord.astro

```ts
interface Props {
  lang: 'he' | 'grc';
  word: string;
  translit?: string;
  gloss?: string;
  strong?: string;
}
```

### NoteBox.astro

```ts
interface Props {
  type?: 'editorial' | 'pastoral' | 'warning' | 'source' | 'language' | 'archaeology';
  title?: string;
}
```

### SourceRef.astro

```ts
interface Props {
  id: string;
  locator?: string;
}
```

### SourceBox.astro

```ts
interface Props {
  ids: string[];
}
```

### Figure.astro

```ts
interface Props {
  src: ImageMetadata | string;
  alt: string;
  caption?: string;
  priority?: boolean;
}
```

---

## 6. Listing components

### ArticleCard.astro

```ts
interface Props {
  article: ArticleSummary;
  variant?: 'compact' | 'featured' | 'series';
}
```

### SeriesCard.astro

```ts
interface Props {
  series: Series;
}
```

### MapCard.astro

```ts
interface Props {
  map: MapManifestItem;
}
```

---

## 7. React islands

### CommandPalette.tsx

Hydration:

```astro
<CommandPalette client:idle manifest={manifest} />
```

Props:

```ts
type Props = {
  manifest: SearchItem[];
};
```

### SearchBox.tsx / SearchPage.tsx

Hydration:

```astro
<SearchPage client:idle />
```

Если Pagefind — динамически импортировать pagefind только на search page.

### MapApp.tsx

Hydration:

```astro
<MapApp client:visible route={route} />
```

Props:

```ts
type Props = {
  route: MapRoute;
  initialPlaceId?: string;
  initialStageId?: string;
};
```

### Quiz.tsx

```astro
<Quiz client:visible data={quiz} />
```

---

## 8. Accessibility requirements per component

```text
Header — nav aria-label
Breadcrumbs — nav aria-label
Button — native button
ArticleToc — nav aria-label
NoteBox — label text, not color only
MapApp — keyboard and transcript fallback
CommandPalette — Esc, focus management, keyboard list
Search — form/list semantics
```

---

## 9. Anti-patterns

```text
❌ layout as React island
❌ all article cards as hydrated React
❌ button role on div when native button works
❌ MDX components with required JS for static content
❌ hidden SEO text not visible to users
```

---

## 10. Итог

Компоненты делятся на:

```text
Astro components — layout/content/SEO/static UI
React islands — only true interactivity
```

Так сохраняется SEO и скорость.
