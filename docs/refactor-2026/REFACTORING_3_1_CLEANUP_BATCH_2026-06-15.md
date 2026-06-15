# REFACTORING_3_1_CLEANUP_BATCH_2026-06-15.md

Дата: 2026-06-15
Статус: in progress
Цель: не расширять Astro-coverage любой ценой, а довести shadow-слой до состояния, в котором он не ощущается как «другой сайт».

## Что закрыто первым cleanup-проходом

### 1. Astro article shell стал менее прототипным
- `src/layouts/ArticleLayout.astro`
- убран сырой technical eyebrow вида `articles · published · indexable`
- добавлены human-readable section labels
- добавлена более нормальная byline-строка
- для переводов различаются автор оригинала и редактор

### 2. Shadow articles снова попадают в Pagefind
- `data-pagefind-body` добавлен в `ArticleLayout.astro`
- в `dist` Pagefind теперь видит не только landing pages, но и Astro article routes
- `scripts/dist-publication-audit.js` усилен: требует indexability не только для `/about/`, но и для public Astro article/baptisty routes

### 3. SEO image metadata перестала врать для SVG
- `src/components/seo/Seo.astro` теперь определяет `og:image:type` по extension
- добавлены `og:image:alt` и `twitter:image:alt`
- закрыта ошибка, когда SVG отдавался как `image/webp`

### 4. Public shadow article entries больше не помечены как draft/noindex
- 10 MDX article entries, уже promoted to public shadow routes, приведены в согласованное состояние
- это важно для будущей генерации catalog/search/feed/sitemap из content layer

### 5. Root `/` и `/baptisty-rossii/` подняты выше baseline-floor
- расширен текстовый слой shadow home page
- расширен series hub `/baptisty-rossii/`
- `contract:compare:dist` снова проходит

### 6. Добавлены отдельные guards для самых рискованных public shadow routes
- `scripts/astro-home-pilot-audit.js`
- `scripts/baptisty-series-shadow-audit.js`
- npm scripts:
  - `npm run astro:audit:home`
  - `npm run astro:audit:home:no-build`
  - `npm run astro:audit:baptisty-series`
  - `npm run astro:audit:baptisty-series:no-build`
- `strangler:deploy-readiness` теперь должен проверять не только `/about/` и article MDX routes, но и shadow home page / baptisty-series layer

## Проверки после cleanup

Проходит:

```bash
npm run validate:static-publication
npm run astro:audit:article-mdx:strict
npm run contract:compare:dist
node scripts/dist-publication-audit.js --require-pagefind --forbid-dev
```

Локальный production-like pipeline по static-part теперь green до smoke/browser-level:

```bash
npm run strangler:build:production-like
npm run pagefind:build:dist
node scripts/dist-publication-audit.js --require-pagefind --forbid-dev
npm run contract:extract:dist
npm run contract:compare:dist
```

## Что ещё не закрыто

### A. Browser-level smoke still required
В sandbox не хватает системных Playwright libs (`libnspr4.so` и др.), поэтому
`dist-smoke-audit.js` / full `strangler:audit:production-like` в этой среде не добегают до конца.
Это не code-failure, а browser-runtime dependency issue.

### B. `/` всё ещё не 1:1 с legacy root
Хотя root page снова проходит contract word-floor, это ещё не финальная parity-версия.
Нужен отдельный home audit и отдельный mobile-first redesign batch.

### C. `baptisty-rossii/*` pages всё ещё не GBS-parity
Страницы уже технически shadow-owned, но не получили полноценный 1:1 GBS shell.
Следующий большой шаг — либо reusable GBS-compatible Astro layout,
либо controlled rollback этих 10 routes из public shadow до готовности.

## Следующий правильный шаг

Не брать пока `/map/`, `/karty/avraam/`, `nagornaya/chast-*`.

Следующий batch:

1. `astro:audit:home` — legacy vs Astro `/`
2. dedicated `astro:audit:baptisty-series`
3. решить судьбу 10 shadow-owned `baptisty-rossii/*` routes:
   - либо доводим до GBS parity,
   - либо временно убираем из public shadow ownership
4. после этого только moving on to:
   - `/konfessii/russkij-baptizm/`
   - `/karty/ishod/`

## Принцип batch 3.1

```text
Не расширять coverage быстрее, чем растёт parity.
Сначала quality shell.
Потом новые routes.
```
