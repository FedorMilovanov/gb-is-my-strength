# CONTENT_MODEL_AND_AUTHORING_2026.md — модель контента и workflow добавления статей

Дата: 2026-06-12  
Связано с: `docs/ASTRO_SITE_REFACTOR_RESEARCH_2026.md`

---

## 1. Цель

Сделать добавление и изменение материалов таким, чтобы:

```text
новая статья добавлялась за минуты;
SEO-поля не забывались;
обложки и alt проверялись;
серии/теги были типизированы;
битые ссылки ловились до публикации;
100 страниц менялись через layout/components;
источники и редакционная политика были системными.
```

---

## 2. Типы контента сайта

Текущие и будущие типы:

```text
articles          — обычные статьи
biographies       — биографические материалы
hardTexts         — трудные тексты/разборы
series            — серии/циклы
nagornaya         — Нагорная проповедь
maps              — интерактивные карты
landingPages      — главная, about, разделы
reference         — словарь, стихи, оригинальные слова
sourceNotes       — источники/библиография
```

---

## 3. Content collections

Целевая модель Astro:

```text
src/content/articles/*.mdx
src/content/biographies/*.mdx
src/content/hard-texts/*.mdx
src/content/nagornaya/*.mdx
src/content/maps/*.json
src/data/authors.json
src/data/series.json
src/data/glossary.json
src/data/sources.json
```

Почему так:

- MDX удобен для богословских статей;
- JSON удобен для структурных данных;
- content collections валидируют всё на build-time;
- можно генерировать индексы, sitemap, RSS, search manifest.

---

## 4. Frontmatter статьи

Минимальный стандарт:

```yaml
---
title: "Римлянам 7: верующий или неверующий?"
description: "Подробный разбор Римлянам 7: грамматика текста, позиции толкователей и пастырские выводы."
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
cover: "../../assets/articles/rim7/cover.webp"
coverAlt: "Открытая Библия и рукописные заметки к Римлянам 7"
ogImage: "/images/og-rim7.webp"
draft: false
noindex: false
sourcesRequired: true
---
```

---

## 5. Обязательные поля

```text
title          — человекочитаемый заголовок
description    — meta description
slug           — стабильный slug
section        — раздел сайта
publishedAt    — дата публикации
author         — author id
draft          — черновик
noindex        — индексировать или нет
```

Для статей с источниками:

```text
sourcesRequired: true
```

Если источник обязателен, но отсутствует блок источников, CI должен ругаться.

---

## 6. Рекомендуемые ограничения

```text
title: 8–100 символов
description: 70–180 символов
slug: только a-z, 0-9, дефисы
coverAlt: обязательно, если есть cover
updatedAt >= publishedAt
noindex нельзя случайно для production-статьи
```

---

## 7. Схема articles для Astro

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
    section: z.enum(['articles', 'biografii', 'hard-texts', 'nagornaya']),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    author: z.string().default('fedor-milovanov'),
    series: z.string().optional(),
    tags: z.array(z.string()).default([]),
    cover: image().optional(),
    coverAlt: z.string().optional(),
    ogImage: z.string().optional(),
    draft: z.boolean().default(false),
    noindex: z.boolean().default(false),
    sourcesRequired: z.boolean().default(true),
    canonicalOverride: z.string().url().optional(),
  }).superRefine((data, ctx) => {
    if (data.cover && !data.coverAlt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'coverAlt обязателен, если задан cover',
        path: ['coverAlt'],
      });
    }
    if (data.updatedAt && data.updatedAt < data.publishedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'updatedAt не может быть раньше publishedAt',
        path: ['updatedAt'],
      });
    }
  }),
});
```

---

## 8. Authors

```json
[
  {
    "id": "fedor-milovanov",
    "name": "Фёдор Милованов",
    "url": "https://gospod-bog.ru/about/",
    "sameAs": [
      "https://t.me/fedormilovanov",
      "https://vk.com/curtmf"
    ],
    "description": "Автор и редактор богословского проекта «Господь Бог — Сила Моя»."
  }
]
```

Используется для:

- Article JSON-LD;
- author bio;
- страницы `/about/`;
- RSS;
- OpenGraph article author.

---

## 9. Series

```json
[
  {
    "id": "dzhon-gill",
    "title": "Джон Гилл",
    "description": "Серия материалов о жизни, трудах и наследии Джона Гилла.",
    "url": "/articles/dzhon-gill-spravochnik/",
    "items": [
      "dzhon-gill-chast-1-chelovek",
      "dzhon-gill-chast-2-uchenyi",
      "dzhon-gill-chast-3-nasledie"
    ]
  }
]
```

Серия должна генерировать:

- блок «Материалы серии»;
- `ItemList` JSON-LD;
- внутреннюю перелинковку;
- prev/next.

---

## 10. Источники

Для серьёзного богословского проекта источники должны стать структурой, а не только текстом внизу.

```json
{
  "id": "woolley-ur-1934",
  "title": "Ur Excavations",
  "author": "Leonard Woolley",
  "year": 1934,
  "type": "archaeology",
  "url": "",
  "reliability": "high",
  "note": "Классические раскопки Ура"
}
```

В статье:

```mdx
<SourceRef id="woolley-ur-1934" />
```

Или блок:

```mdx
<Sources ids={["woolley-ur-1934", "penn-ur-2023"]} />
```

---

## 11. MDX-компоненты для авторинга

Стандартизировать компоненты:

```text
<Verse ref="Рим 7:14">...</Verse>
<OriginalWord lang="gr" word="σάρκινος" translit="sarkinos" />
<SourceRef id="..." />
<Note type="pastoral">...</Note>
<Warning>...</Warning>
<ArgumentMap id="romans-7" />
<Timeline id="abraham-life" />
<MapLink map="avraam" place="moriah" />
```

Плюс можно переопределить стандартные Markdown-элементы:

```text
blockquote → красивый QuoteBlock
h2/h3 → якоря + TOC
table → responsive table
img → Figure/Image component
```

---

## 12. Изображения

Правила:

```text
[ ] у каждой содержательной картинки есть alt
[ ] filename описательный
[ ] hero/OG минимум 1200x630
[ ] WebP/AVIF по возможности
[ ] width/height заданы
[ ] lazy для below-the-fold
[ ] fetchpriority=high только для LCP image
```

Google Image SEO рекомендует использовать HTML `<img>` с `src` и descriptive `alt`, responsive images через `<picture>`/`srcset`, поддерживаемые форматы и описательные filenames [2](https://developers.google.com/search/docs/appearance/google-images).

---

## 13. Internal linking

Каждая статья должна иметь:

```text
[ ] хлебные крошки
[ ] ссылки на серию, если есть
[ ] related articles
[ ] ссылки на карты, если релевантно
[ ] ссылки на оригинальные слова/глоссарий
[ ] prev/next внутри серии
```

Цель: не вручную поддерживать перелинковку, а генерировать её из данных.

---

## 14. RSS и search manifest

Из content collections генерировать:

```text
feed.xml
search-manifest.json
links-graph.json
series pages
related articles
```

RSS item:

```ts
{
  title: article.data.title,
  description: article.data.description,
  pubDate: article.data.publishedAt,
  link: `/articles/${article.data.slug}/`,
}
```

Search manifest:

```json
{
  "title": "...",
  "url": "/articles/.../",
  "description": "...",
  "section": "articles",
  "tags": [],
  "bodyExcerpt": "..."
}
```

---

## 15. Draft workflow

```yaml
draft: true
```

Черновик:

- не попадает в sitemap;
- не попадает в RSS;
- не попадает в search manifest;
- не публикуется в production;
- может быть виден в dev.

---

## 16. Команда создания статьи

Будущий скрипт:

```bash
npm run new:article
```

Должен:

1. спросить title;
2. предложить slug;
3. спросить section/series/tags;
4. создать MDX;
5. добавить draft: true;
6. создать TODO-блок источников;
7. показать checklist перед публикацией.

---

## 17. Checklist перед публикацией статьи

```text
[ ] title нормальный
[ ] description 70–180 символов
[ ] slug правильный
[ ] canonical правильный
[ ] h1 совпадает по смыслу
[ ] есть intro/лид
[ ] есть источники, если нужны
[ ] картинки имеют alt
[ ] внутренние ссылки проверены
[ ] related articles есть
[ ] draft: false
[ ] updatedAt выставлен
[ ] JSON-LD валиден
[ ] статья есть в feed/search/sitemap
```

---

## 18. Что делать с текущими HTML

Не конвертировать всё автоматически без проверки.

Процесс:

```text
1. Извлечь meta/frontmatter.
2. Перенести body в MDX.
3. Заменить повторяющиеся блоки компонентами.
4. Проверить визуал.
5. Проверить ссылки.
6. Сравнить SEO.
```

Автоматическая конвертация может помочь, но финальная редактура обязательна.

---

## 19. Итог

Content model должен стать источником истины.

```text
Сейчас: HTML = контент + layout + SEO + JS + CSS.
После: MDX/JSON = контент, Astro components = layout/SEO/UI, React islands = интерактив.
```

Это даст управляемость, масштаб и качество публикации.
