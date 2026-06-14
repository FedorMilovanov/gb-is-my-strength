# ASTRO_IMPLEMENTATION_BLUEPRINT_2026.md — практический blueprint первого Astro-прототипа

Дата: 2026-06-12  
Статус: черновик implementation blueprint, не выполнять без отдельной ветки.

---

## 1. Цель первого прототипа

Не мигрировать весь сайт, а доказать, что Astro может воспроизвести текущий SEO/визуал на 1–2 страницах.

Пилотные страницы:

```text
/dev/astro-test/   — техническая страница
/about/            — первый реальный кандидат
```

---

## 2. Установка

В отдельной ветке:

```bash
git checkout -b astro-prototype
npm install -D astro typescript @astrojs/check
npm install @astrojs/react @astrojs/mdx @astrojs/sitemap @astrojs/rss
npm install react react-dom
```

Node target:

```text
Для Astro 6 желательно Node 22+.
Текущий проект пока >=20, поэтому сначала проверить scripts.
```

---

## 3. package.json scripts

Черновик:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "check": "astro check",
    "contract:extract": "node scripts/extract-url-contract.js"
  }
}
```

В текущем проекте уже добавлено:

```json
"contract:extract": "node scripts/extract-url-contract.js"
```

---

## 4. astro.config.mjs

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://gospod-bog.ru',
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    react(),
    mdx(),
    sitemap({
      serialize(item) {
        return item;
      },
    }),
  ],
});
```

Не включать в первом прототипе:

```text
ClientRouter
View Transitions
SSR adapter
Cloudflare adapter
CMS
Tailwind
```

---

## 5. tsconfig.json

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

Astro content collections rely on TypeScript settings for Zod validation and type checking [2](https://docs.astro.build/en/guides/content-collections/).

---

## 6. Директории

```text
src/
  content.config.ts
  content/
    articles/
  data/
    site.ts
    authors.json
  layouts/
    BaseLayout.astro
    ArticleLayout.astro
  components/
    seo/
      Seo.astro
      JsonLd.astro
      Breadcrumbs.astro
    ui/
      Header.astro
      Footer.astro
  styles/
    tokens.css
    global.css
  pages/
    dev/astro-test.astro
```

---

## 7. site config

```ts
// src/data/site.ts
export const SITE = {
  name: 'Господь Бог — Сила Моя',
  url: 'https://gospod-bog.ru',
  lang: 'ru',
  locale: 'ru_RU',
  author: 'Фёдор Милованов',
  rss: 'https://gospod-bog.ru/feed.xml',
  yandexMetrikaId: '108353327',
};
```

---

## 8. BaseLayout.astro

```astro
---
import Seo from '@/components/seo/Seo.astro';
import Header from '@/components/ui/Header.astro';
import Footer from '@/components/ui/Footer.astro';
import '@/styles/tokens.css';
import '@/styles/global.css';

const {
  title,
  description,
  canonical,
  ogImage,
  robots = 'index, follow',
  jsonLd = [],
} = Astro.props;
---
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <Seo
      title={title}
      description={description}
      canonical={canonical}
      ogImage={ogImage}
      robots={robots}
      jsonLd={jsonLd}
    />
  </head>
  <body>
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

---

## 9. Seo.astro

```astro
---
const {
  title,
  description,
  canonical,
  ogImage,
  robots,
  type = 'website',
  jsonLd = [],
} = Astro.props;
---
<title>{title}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonical} />
<meta name="robots" content={robots} />

<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:type" content={type} />
<meta property="og:url" content={canonical} />
<meta property="og:locale" content="ru_RU" />
{ogImage && <meta property="og:image" content={ogImage} />}

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
{ogImage && <meta name="twitter:image" content={ogImage} />}

<link rel="alternate" type="application/rss+xml" title="Господь Бог — Сила Моя — RSS" href="https://gospod-bog.ru/feed.xml" />

{jsonLd.map((node) => (
  <script type="application/ld+json" set:html={JSON.stringify(node)} />
))}
```

---

## 10. content.config.ts минимальный

```ts
import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: ({ image }) => z.object({
    title: z.string().min(8).max(100),
    description: z.string().min(70).max(180),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    noindex: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    cover: image().optional(),
    coverAlt: z.string().optional(),
  }),
});

export const collections = { articles };
```

---

## 11. Тестовая страница

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
---
<BaseLayout
  title="Astro test | Господь Бог — Сила Моя"
  description="Техническая тестовая страница Astro-прототипа."
  canonical="https://gospod-bog.ru/dev/astro-test/"
  robots="noindex, follow"
>
  <h1>Astro test</h1>
  <p>Если эта страница собрана, Astro-прототип работает.</p>
</BaseLayout>
```

---

## 12. `/about/` pilot

Для `/about/` нужно воспроизвести текущие параметры из baseline:

```text
URL: /about/
Title: Об авторе — Фёдор Милованов | Господь Бог — Сила Моя
Canonical: https://gospod-bog.ru/about/
H1: Фёдор Милованов
```

JSON-LD:

```text
Organization
WebSite
Person
ProfilePage
BreadcrumbList
```

---

## 13. CSS strategy

Сначала перенести tokens:

```css
:root {
  --color-bg: #070a10;
  --color-text: #e9e4d6;
  --color-gold: #e8c879;
  --font-serif: 'Playfair Display', Georgia, serif;
  --font-sans: 'Source Sans 3', system-ui, sans-serif;
}
```

Не переписывать весь дизайн сразу. Сначала добиться близости.

---

## 14. Fonts

Текущие локальные шрифты сохранить:

```text
/fonts/...
```

В Astro можно подключить через global CSS или layout.

---

## 15. Проверка прототипа

```bash
npm run check
npm run build
npm run preview
npm run contract:extract
```

Затем сравнить:

```text
legacy /about/
astro /about/
```

По:

```text
title
description
canonical
h1
JSON-LD
visual screenshot
mobile
```

---

## 16. Итог

Первый Astro-прототип должен быть маленьким и скучным:

```text
никаких карт
никакого redesign
никакого ClientRouter
никакого CMS
только layout + SEO + одна страница
```

Если этот слой работает, можно двигаться дальше.
