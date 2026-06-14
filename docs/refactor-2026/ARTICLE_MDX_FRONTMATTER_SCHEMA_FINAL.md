# ARTICLE_MDX_FRONTMATTER_SCHEMA_FINAL.md — финализируемая схема frontmatter статей

Дата: 2026-06-12  
Статус: проект схемы для Astro content collections

---

## 1. Цель

Статья должна быть полноценной единицей публикации: SEO, авторство, серия, источники, изображения, draft/noindex и связи.

---

## 2. Базовый frontmatter

```yaml
---
title: "Римлянам 7: верующий, неверующий или человек под законом?"
description: "Экзегетический разбор Римлянам 7: грамматика текста, основные позиции толкователей и пастырские выводы."
slug: "rimlyanam-7-veruyushchiy-ili-neveruyushchiy"
section: "articles"
publishedAt: 2026-06-12
updatedAt: 2026-06-12
author: "fedor-milovanov"
series: "rimlyanam-7"
tags:
  - "Римлянам"
  - "экзегеза"
  - "освящение"
related:
  - "hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki"
ogImage: "/images/og-rim7.webp"
ogImageAlt: "Открытая Библия и заметки к Римлянам 7"
draft: false
noindex: false
sourcesRequired: true
---
```

---

## 3. Поля

### Required

```text
title
description
slug
section
publishedAt
author
draft
noindex
```

### Recommended

```text
updatedAt
tags
series
related
ogImage
ogImageAlt
sourcesRequired
```

---

## 4. Section enum

```ts
type Section =
  | 'articles'
  | 'biografii'
  | 'hard-texts'
  | 'nagornaya';
```

---

## 5. Date policy

```text
publishedAt — первая публикация
updatedAt — содержательное обновление
```

Правила:

```text
updatedAt >= publishedAt
не обновлять дату ради видимости
```

---

## 6. Zod schema draft

```ts
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const articleSchema = ({ image }) => z.object({
  title: z.string().min(8).max(110),
  description: z.string().min(70).max(180),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  section: z.enum(['articles', 'biografii', 'hard-texts', 'nagornaya']),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  author: z.string().default('fedor-milovanov'),
  series: z.string().optional(),
  tags: z.array(z.string().min(1).max(40)).default([]),
  related: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
  cover: image().optional(),
  coverAlt: z.string().optional(),
  ogImage: z.string().optional(),
  ogImageAlt: z.string().optional(),
  draft: z.boolean().default(false),
  noindex: z.boolean().default(false),
  sourcesRequired: z.boolean().default(true),
  canonicalOverride: z.string().url().optional(),
  readingTime: z.number().int().positive().optional(),
}).superRefine((data, ctx) => {
  if (data.cover && !data.coverAlt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['coverAlt'],
      message: 'coverAlt обязателен, если задан cover',
    });
  }
  if (data.ogImage && !data.ogImageAlt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ogImageAlt'],
      message: 'ogImageAlt обязателен, если задан ogImage',
    });
  }
  if (data.updatedAt && data.updatedAt < data.publishedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['updatedAt'],
      message: 'updatedAt не может быть раньше publishedAt',
    });
  }
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: articleSchema,
});
```

Astro docs подчёркивают, что schemas гарантируют предсказуемую форму данных и дают TypeScript typings; если файл нарушает schema, Astro показывает ошибку [content collections docs](https://docs.astro.build/en/guides/content-collections/).

---

## 7. References между коллекциями

Когда появятся `authors` и `series` collections, можно перейти к `reference()`:

```ts
author: reference('authors'),
related: z.array(reference('articles')).default([]),
```

Astro docs показывают `reference()` для связи blog posts с authors и related posts [content collections references](https://docs.astro.build/en/guides/content-collections/#defining-collection-references).

---

## 8. Draft/noindex publishing rules

```text
draft: true → не строить в production
noindex: true → строить, но robots noindex
```

Для production:

```ts
const posts = await getCollection('articles', ({ data }) => {
  return import.meta.env.PROD ? !data.draft : true;
});
```

Astro docs показывают фильтрацию `getCollection()` по `draft` для production [content collections filtering](https://docs.astro.build/en/guides/content-collections/#filtering-collection-queries).

---

## 9. Canonical generation

По умолчанию:

```ts
const canonical = `${SITE.url}/${section}/${slug}/`;
```

Для исключений:

```yaml
canonicalOverride: "https://gospod-bog.ru/custom/"
```

Использовать override редко.

---

## 10. Migration notes

Legacy HTML meta → frontmatter:

```text
title tag → title
meta description → description
canonical path → slug/section check
og:image → ogImage
article published/modified → dates
```

---

## 11. Итог

Эта schema — один из главных инструментов качества. Новая статья не должна попасть на сайт, если она не проходит frontmatter validation.
