# ASTRO_SEO_COMPONENT_SPEC.md — спецификация SEO-компонентов Astro

Дата: 2026-06-12  
Связано с:

- `docs/STRUCTURED_DATA_GRAPH_2026.md`
- `docs/SEO_TECHNICAL_CONTRACT_2026.md`
- `docs/ASTRO_COMPONENT_INVENTORY_2026.md`

---

## 1. Цель

Вся SEO-логика должна жить в компонентах и функциях, а не копироваться в каждую страницу.

```text
Одна правка Seo.astro → корректировка всего сайта.
```

---

## 2. Компоненты

```text
Seo.astro
JsonLd.astro
Breadcrumbs.astro
OpenGraph.astro optional
ArticleStructuredData.ts
schema.ts
```

---

## 3. Seo.astro Props

```ts
interface Props {
  title: string;
  description: string;
  canonical: string;
  robots?: 'index, follow' | 'noindex, follow' | string;
  type?: 'website' | 'article';
  ogImage?: string;
  ogImageAlt?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  publishedAt?: Date;
  updatedAt?: Date;
  jsonLd?: unknown[];
}
```

---

## 4. Required output

```astro
<title>{title}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonical} />
<meta name="robots" content={robots ?? 'index, follow'} />
```

---

## 5. OpenGraph output

```astro
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:type" content={type ?? 'website'} />
<meta property="og:url" content={canonical} />
<meta property="og:locale" content="ru_RU" />
<meta property="og:site_name" content="Господь Бог — Сила Моя" />
{ogImage && <meta property="og:image" content={absoluteUrl(ogImage)} />}
{ogImageWidth && <meta property="og:image:width" content={String(ogImageWidth)} />}
{ogImageHeight && <meta property="og:image:height" content={String(ogImageHeight)} />}
{ogImageAlt && <meta property="og:image:alt" content={ogImageAlt} />}
```

---

## 6. Twitter output

```astro
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
{ogImage && <meta name="twitter:image" content={absoluteUrl(ogImage)} />}
<meta name="twitter:site" content="@FedorMilovanov" />
<meta name="twitter:creator" content="@FedorMilovanov" />
```

---

## 7. Article meta

Для article pages:

```astro
{publishedAt && <meta property="article:published_time" content={publishedAt.toISOString()} />}
{updatedAt && <meta property="article:modified_time" content={updatedAt.toISOString()} />}
```

---

## 8. JSON-LD

```astro
{jsonLd.map((node) => (
  <script type="application/ld+json" set:html={JSON.stringify(node)} />
))}
```

Google Structured Data docs рекомендуют JSON-LD как наиболее удобный формат для реализации и поддержки; structured data не должна описывать невидимую пользователю информацию [Google intro](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data).

---

## 9. URL helper

```ts
export function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  return new URL(pathOrUrl, SITE.url).toString();
}
```

---

## 10. Canonical helper

```ts
export function canonicalFor(section: string, slug?: string): string {
  const path = slug ? `/${section}/${slug}/` : `/${section}/`;
  return new URL(path, SITE.url).toString();
}
```

---

## 11. Schema builders

```ts
buildOrganization()
buildWebSite()
buildPerson()
buildWebPage({ url, title, description, breadcrumbs })
buildArticle(entry)
buildBreadcrumbList(items)
buildCollectionPage(...)
buildMapLearningResource(route)
```

---

## 12. Validation rules

```text
[ ] title non-empty
[ ] description 70–180 for articles
[ ] canonical absolute
[ ] og:url == canonical
[ ] if ogImage then ogImageAlt recommended/required
[ ] jsonLd parseable
[ ] Article pages have Article schema
[ ] Breadcrumb UI matches JSON-LD
```

---

## 13. Anti-patterns

```text
❌ page-specific hand-written meta duplicated everywhere
❌ JSON-LD about content not visible on page
❌ relative canonical
❌ og:url different from canonical
❌ noindex controlled by random page code
```

---

## 14. Итог

SEO-компонент — центральная точка контроля поискового качества.

```text
No page ships without Seo.astro.
```
