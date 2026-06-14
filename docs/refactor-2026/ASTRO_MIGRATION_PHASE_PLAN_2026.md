# ASTRO_MIGRATION_PHASE_PLAN_2026.md — пошаговый план миграции на Astro

Дата: 2026-06-12  
Связано с: `docs/ASTRO_SITE_REFACTOR_RESEARCH_2026.md`  
Статус: рабочий план, предназначен для постепенного выполнения в отдельных ветках.

---

## 0. Принцип миграции

Миграция должна идти не как «переписать сайт», а как **управляемая замена слоя публикации**.

```text
Контент и URL сохраняются.
Визуальная система нормализуется.
SEO-контракт фиксируется.
Astro появляется рядом.
Страницы переводятся партиями.
Legacy удаляется только после проверки.
```

Главный запрет:

```text
❌ Не удалять текущие HTML до появления baseline + Astro-пилота + сравнительных проверок.
```

---

## 1. Фаза 0 — baseline и URL contract

### Цель

Зафиксировать текущее состояние сайта, чтобы не потерять SEO, canonical, OG, sitemap и внутренние связи.

### Уже начато

Созданы черновые baseline-файлы:

```text
reports/url-contract-draft.json
reports/url-contract-draft.md
```

Сейчас найдено 32 HTML-файла.

### Что нужно довести

1. Улучшить parser baseline:
   - title;
   - description;
   - canonical;
   - h1;
   - robots;
   - OG image;
   - JSON-LD types;
   - internal links;
   - local assets.

2. Сделать постоянный скрипт:

```text
scripts/extract-url-contract.js
```

3. Добавить команду:

```json
"contract:extract": "node scripts/extract-url-contract.js"
```

4. Зафиксировать файл:

```text
docs/URL_CONTRACT_2026.md
```

### Definition of Done

```text
[ ] все текущие URL перечислены
[ ] у каждого URL есть canonical
[ ] все title/description извлечены корректно
[ ] sitemap сравнен с HTML-страницами
[ ] системные страницы помечены отдельно
[ ] 404/verification файлы исключены из контентной миграции
```

---

## 2. Фаза 1 — Astro prototype рядом с legacy

### Цель

Поднять минимальный Astro-проект без изменения production output.

### Рекомендуемая ветка

```bash
git checkout -b astro-prototype
```

### Пакеты

Минимальный набор:

```bash
npm install -D astro typescript
npm install @astrojs/react @astrojs/mdx @astrojs/sitemap @astrojs/rss
npm install react react-dom
```

Если deployment останется GitHub Pages/static:

```text
output: static
```

Если позже Cloudflare Pages:

```bash
npm install @astrojs/cloudflare
```

### `astro.config.mjs` черновик

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
        // позже: lastmod из content collections
        return item;
      },
    }),
  ],
});
```

### Важно

На первой итерации Astro может собирать только dev-страницы:

```text
/dev/astro-test/
```

или собираться в отдельную директорию, не перетирая текущий сайт.

### Definition of Done

```text
[ ] `npm run astro:dev` запускается
[ ] `npm run astro:build` собирает dist
[ ] legacy HTML не повреждён
[ ] можно открыть тестовую Astro-страницу
[ ] шрифты/стили подключаются локально
```

---

## 3. Фаза 2 — базовые layouts и SEO-компоненты

### Цель

Создать общий каркас, на который потом переедут все страницы.

### Файлы

```text
src/layouts/BaseLayout.astro
src/layouts/ArticleLayout.astro
src/layouts/SectionLayout.astro
src/components/seo/Seo.astro
src/components/seo/JsonLd.astro
src/components/seo/Breadcrumbs.astro
src/components/ui/Header.astro
src/components/ui/Footer.astro
src/styles/tokens.css
src/styles/global.css
```

### SEO-компонент должен уметь

```text
title
description
canonical
robots
OG/Twitter
theme-color
RSS link
favicon/apple-touch-icon
JSON-LD graph
```

### Definition of Done

```text
[ ] BaseLayout генерирует валидный HTML
[ ] Seo.astro покрывает текущие meta-паттерны
[ ] Header/Footer воспроизводят текущую навигацию
[ ] дизайн-токены не ломают текущий визуальный стиль
[ ] нет глобального React runtime без необходимости
```

---

## 4. Фаза 3 — content collections

### Цель

Описать строгие схемы для контента.

### Файл

```text
src/content.config.ts
```

### Коллекции

```text
articles       — статьи
biographies    — биографии
seriesPages    — страницы серий/циклов
maps           — карты как JSON-данные
authors        — авторы из JSON
series         — серии из JSON
```

### Черновая схема articles

```ts
const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: ({ image }) => z.object({
    title: z.string().min(8).max(100),
    description: z.string().min(70).max(180),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    author: z.string().default('fedor-milovanov'),
    section: z.enum(['articles', 'biografii', 'hard-texts', 'nagornaya']),
    series: z.string().optional(),
    tags: z.array(z.string()).default([]),
    cover: image().optional(),
    coverAlt: z.string().optional(),
    ogImage: z.string().optional(),
    draft: z.boolean().default(false),
    noindex: z.boolean().default(false),
    sourcesRequired: z.boolean().default(true),
  }),
});
```

### Definition of Done

```text
[ ] `astro check` валидирует content
[ ] плохой frontmatter ломает build
[ ] draft не попадает в production
[ ] slug не расходится с URL
[ ] section/series/tags типизированы
```

---

## 5. Фаза 4 — первая пилотная страница `/about/`

### Почему `/about/`

- одна страница;
- важная, но не самая сложная;
- SEO и author/entity важны;
- мало интерактива.

### Что проверить

```text
[ ] URL: /about/
[ ] title совпадает или улучшен
[ ] description совпадает или улучшен
[ ] canonical: https://gospod-bog.ru/about/
[ ] h1: Фёдор Милованов
[ ] Organization/WebPage/Person JSON-LD
[ ] OG image
[ ] внутренняя навигация
[ ] mobile
```

### Definition of Done

```text
[ ] legacy и Astro версии визуально близки
[ ] HTML содержит контент без JS
[ ] Search Console URL Inspection после деплоя без проблем
```

---

## 6. Фаза 5 — первая статья

### Кандидат

Выбрать короткую или среднюю статью, не самую сложную. Не начинать с Нагорной и не с карты.

### Перенос

```text
legacy HTML → MDX
frontmatter → schema
внутренние ссылки → Astro link helper
картинки → Astro Image/Picture или обычные optimized assets
источники → SourceBox/footnotes
```

### Проверить

```text
[ ] Article JSON-LD
[ ] BreadcrumbList
[ ] datePublished/dateModified
[ ] author
[ ] OG image
[ ] related articles
[ ] search-manifest
[ ] feed.xml
```

---

## 7. Фаза 6 — индексы разделов

Перевести:

```text
/articles/
/biografii/
/hard-texts/
/karty/
```

Индексы должны строиться из collections/data, а не ручной разметки.

Пример:

```astro
const articles = await getCollection('articles', ({ data }) => !data.draft);
```

---

## 8. Фаза 7 — массовый перенос партиями

Партии:

```text
Партия A: простые статьи
Партия B: Джон Гилл
Партия C: hard-texts
Партия D: Нагорная проповедь
Партия E: карты/интерактив
Партия F: главная
```

Каждая партия идёт через PR и checklist.

---

## 9. Фаза 8 — интерактивные острова

Переносить после стабилизации контента:

```text
CommandPalette.tsx
SearchBox.tsx
Quiz.tsx
MapApp.tsx
Timeline.tsx
```

Правило:

```text
client:idle    — поиск/палитра, если не критично
client:visible — карты, квизы, таймлайны ниже первого экрана
client:load    — только критичная навигация, если реально нужно
client:only    — только для компонентов, где SSR невозможен
```

---

## 10. Фаза 9 — sitemap/RSS/search

### Sitemap

- генерировать через `@astrojs/sitemap`;
- исключать draft/noindex;
- добавить lastmod из `updatedAt || publishedAt`;
- проверить, что verification/system pages не ломают sitemap.

### RSS

- `/feed.xml` должен сохранить текущий URL;
- включать только опубликованные статьи;
- sorted by publishedAt/updatedAt.

### Search

Этап 1: генерировать текущий `data/search-manifest.json` из collections.  
Этап 2: протестировать Pagefind.

---

## 11. Фаза 10 — CSP hardening

Текущий сайт использует inline CSS/JS и `'unsafe-inline'`.

Цель после миграции:

```text
[ ] CSS вынесен/собран Astro
[ ] JS modules вместо inline
[ ] JSON-LD безопасно вставляется
[ ] Yandex.Metrika оформлена через разрешённый script src
[ ] CSP без лишнего unsafe-inline, где возможно
```

CSP не делать первой фазой, иначе можно сломать аналитику/интерактив до стабилизации.

---

## 12. Фаза 11 — deployment strategy

Варианты:

### GitHub Pages / текущий static hosting

Плюсы:

- минимальный operational risk;
- статический output.

### Cloudflare Pages

Плюсы:

- быстрый CDN;
- хорошая связка с Astro;
- headers/redirects;
- future server islands/SSR при необходимости.

Решение не срочное. Сначала можно оставаться на static output.

---

## 13. Команды будущего package.json

```json
{
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "check": "astro check",
  "contract:extract": "node scripts/extract-url-contract.js",
  "contract:compare": "node scripts/compare-url-contract.js",
  "content:new": "node scripts/new-article.js",
  "validate:content": "astro check",
  "validate:seo": "npm run build && node scripts/seo-audit.js",
  "validate:all": "npm run check && npm run build && npm run validate:seo && npm run contract:compare"
}
```

---

## 14. Stop conditions

Миграцию останавливаем и не мержим, если:

```text
[ ] изменились URL без 301
[ ] пропал canonical
[ ] title/description стали пустыми
[ ] контент виден только после JS
[ ] sitemap потерял важные страницы
[ ] feed.xml сломан
[ ] Lighthouse сильно хуже baseline
[ ] Яндекс/Google verification пропали
[ ] analytics сломана
[ ] внутренние ссылки массово 404
```

---

## 15. Ближайший следующий PR

Рекомендуемый минимальный PR:

```text
PR: baseline-url-contract

- scripts/extract-url-contract.js
- reports/url-contract-draft.json
- reports/url-contract-draft.md
- docs/URL_CONTRACT_2026.md
- package.json script contract:extract
```

После него можно делать:

```text
PR: astro-prototype-minimal
```

---

## 16. Итог

Самый безопасный путь:

```text
1. Зафиксировать текущий сайт.
2. Поднять Astro рядом.
3. Сделать layout/SEO.
4. Перевести /about/.
5. Перевести одну статью.
6. Сравнить.
7. Переносить партиями.
8. Карты держать отдельным проектом внутри общей архитектуры.
```
