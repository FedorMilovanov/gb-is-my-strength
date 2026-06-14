# ASTRO_SITE_REFACTOR_RESEARCH_2026.md — исследование перехода сайта на Astro + React islands

Дата: 2026-06-12  
Цель: выбрать «топовый» фундамент для сайта gospod-bog.ru на годы вперёд: SEO, скорость, визуал, удобное добавление статей, единый дизайн/движок, безопасная миграция без потери текущих URL и поисковых сигналов.

---

## 1. Короткое решение

Для текущего сайта лучший целевой вариант: **Astro + React islands + MD/MDX content collections + статическая генерация по умолчанию**.

Не чистая React SPA. Не «всё на клиенте». Не большой rewrite за один раз.

Формула:

```text
Astro = HTML/SEO/контент/layout/сборка
React = интерактивные острова: карты, поиск, командная палитра, квизы, сложные UI
MD/MDX = статьи и контент
JSON/YAML = карты, серии, граф связей, словари, источники
CI = валидация SEO/ссылок/данных/доступности до деплоя
```

Почему это «топ» именно для этого проекта:

- сайт контентный и SEO-first;
- страницы должны быть полноценным HTML уже в исходной выдаче;
- интерактив нужен точечно, а не на каждой строке текста;
- нужно менять 100 страниц через один layout/компонент;
- нужно безопасно добавлять новые статьи через схему, а не руками копировать HTML;
- текущая сильная статическая база не ломается, а постепенно переезжает.

---

## 2. Почему не чистая React SPA

Для gospod-bog.ru чистая SPA была бы архитектурной ошибкой.

Риски:

1. **SEO и AI-crawler видимость** — критический контент не должен зависеть от выполнения JS.
2. **Core Web Vitals** — лишний JS ухудшает INP/LCP, особенно на мобильных.
3. **Сложность** — статьи, canonical, sitemap, RSS и structured data проще генерировать как статический HTML.
4. **Долгосрочная поддержка** — контентные страницы должны жить десятилетиями, даже если JS-фреймворк поменяется.

Рекомендация 2026 для контентных сайтов: SSG/SSR для основного HTML, client-side JS только для интерактива. Это совпадает с направлением Astro.

---

## 3. Что Astro даёт проекту

### 3.1 SEO: полный HTML до JavaScript

Astro по умолчанию отдаёт статический HTML. Это значит:

- статья видна в `view-source`;
- заголовки, абзацы, ссылки, цитаты, footnotes, JSON-LD есть сразу;
- Google не обязан ждать гидратацию;
- не-Google краулеры и AI-краулеры видят контент лучше;
- no-JS fallback становится естественным.

### 3.2 Компонентность без SPA

Можно создать один SEO/layout-компонент:

```astro
<BaseLayout
  title={title}
  description={description}
  canonical={canonical}
  ogImage={ogImage}
  schema={schema}
>
  <slot />
</BaseLayout>
```

И затем 100 страниц автоматически получают:

- единый `<head>`;
- canonical;
- OG/Twitter;
- schema.org;
- шрифты;
- header/footer;
- breadcrumbs;
- аналитику;
- дизайн-токены.

### 3.3 React только там, где нужен

Пример:

```astro
<SearchBox client:idle />
<CommandPalette client:idle />
<MapApp client:visible route={route} />
<Quiz client:visible data={quiz} />
```

Обычная статья не грузит React runtime, если на ней нет React-острова.

### 3.4 Content Collections + Zod

Astro content collections позволяют валидировать frontmatter и данные на build-time.

Пример схемы статьи:

```ts
import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: ({ image }) => z.object({
    title: z.string().min(8).max(90),
    description: z.string().min(80).max(170),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    canonical: z.string().optional(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    author: z.string().default('Фёдор Милованов'),
    section: z.enum(['articles', 'biografii', 'hard-texts']),
    series: z.string().optional(),
    tags: z.array(z.string()).default([]),
    cover: image().optional(),
    coverAlt: z.string().optional(),
    draft: z.boolean().default(false),
    noindex: z.boolean().default(false),
    readingTime: z.number().optional(),
    sourcesRequired: z.boolean().default(true),
  })
});

export const collections = { articles };
```

Плюс: если забыть `description`, поставить кривую дату, неправильный slug или draft — сборка падает до деплоя.

### 3.5 MDX для сложных статей

Обычный Markdown — для простых материалов.  
MDX — для статей, где нужны компоненты:

```mdx
---
title: "Римлянам 7: верующий или неверующий?"
description: "..."
publishedAt: 2026-06-12
---

# Римлянам 7

<Verse ref="Рим 7:14" />

<ArgumentMap id="romans-7" />
```

Контент остаётся текстовым, версионируемым в Git, но может включать интерактивные блоки.

### 3.6 Sitemap/RSS/search

В Astro можно системно генерировать:

- `/sitemap.xml` через `@astrojs/sitemap`;
- `/feed.xml` через `@astrojs/rss`;
- статический поиск через Pagefind;
- `search-manifest.json` для текущей командной палитры;
- `llms.txt`/`llms-full.txt` в будущем для AI-поиска.

### 3.7 CSP

В Astro 6 CSP поддержка стала стабильной по сообщениям экосистемы: это важно, потому что текущий сайт использует много inline CSS/JS и CSP с `'unsafe-inline'`. Цель рефакторинга — уйти от этого к автоматически/явно управляемому CSP.

---

## 4. Целевая структура проекта

```text
src/
  content.config.ts

  content/
    articles/
      rimlyanam-7-veruyushchiy-ili-neveruyushchiy.mdx
      kod-da-vinchi.mdx
    biographies/
      dzhon-gill-chast-1-chelovek.mdx
    hardTexts/
      krajne-li-isporcheno-serdce.mdx
    maps/
      avraam.json
      ishod.json

  data/
    site.ts
    navigation.ts
    authors.json
    series.json
    glossary.json
    original-words.json
    verses.json
    maps-manifest.json

  layouts/
    BaseLayout.astro
    ArticleLayout.astro
    SectionLayout.astro
    MapLayout.astro

  components/
    seo/
      Seo.astro
      JsonLd.astro
      Breadcrumbs.astro
      OpenGraph.astro
    article/
      ArticleHeader.astro
      ArticleToc.astro
      SourceNote.astro
      Verse.astro
      RelatedArticles.astro
    ui/
      Header.astro
      Footer.astro
      Button.astro
      Card.astro

  components/react/
    CommandPalette.tsx
    SearchBox.tsx
    MapApp.tsx
    Quiz.tsx
    InteractiveTimeline.tsx

  pages/
    index.astro
    about/index.astro
    articles/index.astro
    articles/[slug].astro
    biografii/index.astro
    biografii/[slug].astro
    hard-texts/index.astro
    hard-texts/[slug].astro
    karty/index.astro
    karty/[slug].astro
    feed.xml.ts
```

---

## 5. URL-контракт: не ломать текущие адреса

Текущие URL должны остаться:

```text
/articles/kod-da-vinchi/
/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/
/biografii/
/hard-texts/
/karty/
/karty/avraam/
/map/
```

Правила:

1. URL не менять без крайней необходимости.
2. Если меняется — только через 301 redirect.
3. Canonical должен совпадать с текущим.
4. Trailing slash сохранить.
5. Старый sitemap и новый sitemap сравнивать автоматически.
6. OG image сохранить или улучшить, но не потерять.
7. Никаких случайных `noindex`.

---

## 6. SEO-компонент как единая точка правки

Цель: любые изменения SEO делать в одном месте.

```astro
---
interface Props {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  type?: 'website' | 'article';
  publishedAt?: Date;
  updatedAt?: Date;
  noindex?: boolean;
  jsonLd?: unknown[];
}
const props = Astro.props;
---

<title>{props.title}</title>
<meta name="description" content={props.description} />
<link rel="canonical" href={props.canonical} />
<meta name="robots" content={props.noindex ? 'noindex, follow' : 'index, follow'} />

<meta property="og:title" content={props.title} />
<meta property="og:description" content={props.description} />
<meta property="og:url" content={props.canonical} />
<meta property="og:type" content={props.type ?? 'website'} />
{props.ogImage && <meta property="og:image" content={props.ogImage} />}

{props.jsonLd?.map((schema) => (
  <script type="application/ld+json" set:html={JSON.stringify(schema)} />
))}
```

Для статей стандартный JSON-LD graph:

```text
Organization
WebSite
WebPage
Article
BreadcrumbList
Person/Author
```

Для карт:

```text
WebPage
LearningResource / CreativeWork
Dataset, если route.json публикуется как данные
ItemList мест
BreadcrumbList
```

---

## 7. Добавление новой статьи в целевой системе

Идеальный workflow:

```bash
npm run new:article
```

Скрипт спрашивает:

```text
Название
Описание
Раздел
Серия
Теги
Обложка
```

Создаёт:

```text
src/content/articles/new-slug.mdx
```

Шаблон:

```mdx
---
title: ""
description: ""
slug: ""
publishedAt: 2026-06-12
updatedAt: 2026-06-12
section: "articles"
series: ""
tags: []
draft: true
sourcesRequired: true
---

# Заголовок

Текст...
```

Потом:

```bash
npm run validate:content
npm run build
npm run validate:seo
```

Если frontmatter плохой — build падает. Если ссылка битая — CI падает. Если description слишком короткий — CI падает.

---

## 8. Фазы безопасной миграции

### Фаза 0 — аудит текущего состояния

Сгенерировать baseline:

```text
reports/baseline/urls.json
reports/baseline/meta.json
reports/baseline/sitemap.xml
reports/baseline/feed.xml
reports/baseline/lighthouse/*.json
reports/baseline/link-check.json
```

Нужно знать:

- сколько страниц;
- какие URL;
- какие title/description;
- какие canonical;
- какие OG;
- какие JSON-LD;
- какие внутренние ссылки;
- какие страницы дают поисковый трафик.

### Фаза 1 — новый проект рядом

Не удалять старый HTML. Добавить Astro рядом.

```text
legacy/ или root html пока остаётся
src/ — новый Astro
```

На первом этапе Astro может генерировать только `/dev/astro-test/`.

### Фаза 2 — общий layout и SEO

Сделать:

- `BaseLayout.astro`;
- `Seo.astro`;
- `ArticleLayout.astro`;
- `JsonLd.astro`;
- `Breadcrumbs.astro`;
- дизайн-токены.

Контент пока не переносить массово.

### Фаза 3 — пилотные страницы

Перевести 3–5 страниц:

```text
/about/
/articles/
одна короткая статья
/karty/
/dev/karty/avraam/
```

Проверить:

- визуал;
- SEO;
- sitemap;
- RSS;
- CWV;
- Yandex.Metrika;
- OpenGraph.

### Фаза 4 — контентные коллекции

Перенести статьи партиями.

Порядок:

1. Самые простые статьи.
2. Серии.
3. Биографии.
4. Hard texts.
5. Интерактивные материалы.
6. Главная и карты — после стабилизации.

### Фаза 5 — карты как islands

Карты не смешивать с основным рефакторингом. Для них отдельный документ и отдельные фазы.

В Astro-странице карта должна иметь:

```astro
<MapTranscript places={route.places} />
<MapApp client:visible route={route} />
```

То есть SEO/no-JS видит текст, пользователь получает интерактив.

### Фаза 6 — замена legacy

Только когда новая сборка покрывает 80–90% страниц и проходит CI, старые HTML удаляются партиями.

---

## 9. Проверки перед заменой каждой страницы

Минимальный чеклист:

```text
[ ] URL совпадает
[ ] canonical совпадает
[ ] title есть и не ухудшен
[ ] description есть и не ухудшен
[ ] h1 один
[ ] OG есть
[ ] JSON-LD валиден
[ ] breadcrumbs есть
[ ] страница есть в sitemap
[ ] если статья — есть в feed.xml при необходимости
[ ] нет битых внутренних ссылок
[ ] нет битых изображений
[ ] noindex не включён случайно
[ ] контент виден без JS
[ ] Lighthouse не хуже baseline
[ ] мобильная версия проверена
```

---

## 10. CI/CD после перехода

Текущие скрипты из `package.json` сохранить и адаптировать:

```json
{
  "validate": "...",
  "validate:strict": "...",
  "seo-audit": "...",
  "validate:static-publication": "...",
  "interactive-audit": "...",
  "readable-audit": "...",
  "editorial:lint": "...",
  "source:links": "..."
}
```

Добавить:

```json
{
  "build": "astro build",
  "dev": "astro dev",
  "preview": "astro preview",
  "validate:content": "astro check",
  "validate:urls": "node scripts/compare-url-contract.js",
  "validate:sitemap": "node scripts/validate-sitemap.js",
  "validate:jsonld": "node scripts/validate-jsonld.js",
  "new:article": "node scripts/new-article.js"
}
```

---

## 11. Дизайн-система

Нужно уйти от ручных CSS-островов на каждой странице к токенам:

```css
:root {
  --color-bg: #070a10;
  --color-panel: rgba(13,17,26,.92);
  --color-gold: #e8c879;
  --color-text: #e9e4d6;
  --font-serif: 'Playfair Display', Georgia, serif;
  --font-body: 'Cormorant Garamond', Georgia, serif;
  --font-sans: 'Source Sans 3', system-ui, sans-serif;
  --radius-card: 18px;
  --shadow-panel: 0 30px 80px rgba(0,0,0,.65);
}
```

Компоненты:

```text
ArticleCard
SeriesCard
SourceBox
VerseBlock
NoteBox
QuoteBlock
Toc
Hero
SectionHeader
MapCard
```

---

## 12. Поиск

Два возможных уровня:

### Уровень 1 — текущий search-manifest

Оставить текущую логику, но генерировать manifest из collections.

### Уровень 2 — Pagefind

Pagefind генерирует статический индекс после build и не требует backend. Хорошо подходит для Astro/static сайтов.

Рекомендация: сначала сохранить текущий поиск, потом сделать эксперимент с Pagefind на `/dev/search/`.

---

## 13. CMS: сейчас не обязательно

На старте лучше Git + MDX. Это надёжно и прозрачно.

В будущем можно добавить:

- Keystatic — file-based CMS поверх Markdown/JSON;
- TinaCMS — визуальное редактирование Git-контента;
- Sanity/Contentful — если нужна редакция, preview, роли, медиа workflow.

Но для первого этапа CMS усложнит миграцию. Сначала — стабильный Astro pipeline.

---

## 14. Основные риски

| Риск | Как избежать |
|---|---|
| Потеря SEO | URL contract, canonical diff, sitemap diff, Search Console мониторинг |
| Потеря визуала | перенос дизайн-токенов, visual regression, пилотные страницы |
| Слишком большой rewrite | strangler migration, партии по 5–10 страниц |
| Лишний JS | React только через islands, client:visible/client:idle |
| Поломка статей | content schema + CI |
| Поломка карт | карты отдельно, сначала route.json, потом MapApp |
| CSP/Yandex/inline scripts | отдельная фаза CSP hardening |

---

## 15. Первые практические задачи

1. Создать этот документ.
2. Создать отдельный документ по картам.
3. Сгенерировать inventory текущих URL/meta.
4. Создать ветку `astro-prototype`.
5. Поднять минимальный Astro build без публикации.
6. Реализовать `BaseLayout`, `Seo`, `ArticleLayout`.
7. Перевести `/about/` как первый пилот.
8. Перевести одну короткую статью.
9. Сравнить HTML/SEO с legacy.
10. Только после этого двигать серии.

---

## 16. Источники и ориентиры, июнь 2026

- Astro docs — Islands architecture: https://docs.astro.build/en/concepts/islands/
- Astro docs — Content collections: https://docs.astro.build/en/guides/content-collections/
- Astro docs — Sitemap integration: https://docs.astro.build/en/guides/integrations-guide/sitemap/
- Astro docs — RSS recipe: https://docs.astro.build/en/recipes/rss/
- Astro docs — Image assets/custom image: https://docs.astro.build/en/recipes/build-custom-img-component/
- Next.js docs — Static exports: https://nextjs.org/docs/app/guides/static-exports
- Google Search Central — Structured data intro: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- web.dev — Web Vitals: https://web.dev/articles/vitals
- Pagefind: https://pagefind.app/

---

## 17. Итог

Переход на Astro даст много плюсов:

```text
SEO: лучше и стабильнее, потому что HTML-first
Скорость: меньше JS, лучше CWV
DX: статьи через MDX, схемы, типы, единый layout
Масштаб: 100 страниц меняются через компоненты
Интерактив: React остаётся для карт/поиска/квизов
Безопасность: CSP и меньше inline хаоса
Контроль: статическая публикация, Git, CI
```

Решение: **да, Astro стоит рассматривать как основной будущий движок сайта**. Но переходить нужно не рывком, а через поэтапный параллельный рефакторинг.
