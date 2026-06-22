# MDX Enrichment Gap — kod-da-vinchi pilot

**Дата:** 2026-06-22
**Статус:** PARTIALLY UNBLOCKED — monolithic legacy body split into per-section seams; MDX activation still on hold until section enrichment proves parity

## Проблема

MDX-файл `src/content/articles/kod-da-vinchi.mdx` (335 lines, 52K chars) содержит текстовый контент в markdown-формате, но **0 из 103 CSS-классов**, присутствующих в legacy HTML (`article-sections/*.html`, formerly monolithic `article-body.html`, ~80.8K chars total).

Это означает, что прямая замена ordered section fragments на `<Content/>` произведёт **фундаментально другой HTML** с визуальной регрессией. Но после Phase 3a можно заменять не всю статью сразу, а один `article-sections/NN-*.html` fragment за раз.


## Phase 3a update — 2026-06-22

Сделан безопасный shadow-breakout шаг без визуального риска:

- `KodDaVinchiArticleBody.astro` больше не импортирует один 80K monolith.
- `_legacy/article-body.html` удалён.
- Тело статьи разрезано на 21 ordered fragment:
  - `00-pagefind-meta.html`;
  - `01-sec-intro.html` … `20-summary-title-auto.html`.
- Компонент сам собирает `<article class="article-body" data-pagefind-body>` и рендерит fragments через `import.meta.glob(..., eager: true)`.
- `article-mdx-pilot-audit` теперь закрепляет этот seam: monolith не должен вернуться, fragment count = 21, pagefind meta first.

Проверка normalized article body legacy root vs dist после split: exact equality. Это значит, что следующий refactor step может заменить **одну секцию** на enriched MDX/Astro и сравнить именно её, а не рисковать всей статьёй.

## Phase 3b update — 2026-06-22

The former `00-pagefind-meta.html` fragment has been promoted into a real Astro component: `KodDaVinchiPagefindMeta.astro`. The article body now has:

- one Astro-owned metadata island;
- 20 visible legacy section fragments.

This proves the smallest safe replacement unit: non-visible metadata first, visible sections next. The next safe step is one visible low-risk section/component, with comment-insensitive article parity and visual gates.

## Количественный разрыв

| Метрика | Legacy HTML | MDX | Дельта |
|---------|-----------|-----|--------|
| Размер | 80,835 chars | 52,395 chars | -35% |
| CSS-классы | 103 unique | 0 | -100% |
| `<h2>` теги | 22 | 19 | -3 |
| `<div>` теги | ~120 | 1 | -99% |
| `<span>` теги | ~200 | 0 | -100% |
| Слов | 6,835 | 7,107 | +272 (+3.8%) |

## Ключевые компоненты, отсутствующие в MDX

1. **`fn-marker` + `tooltip`** — inline footnotes с hover-подсказками (15+ штук)
2. **`drop-cap`** — декоративная первая буква абзаца
3. **`stat-grid` / `stat-card`** — анимированные карточки статистики
4. **`quote-box`** — стилизованные цитаты (заменены на markdown `>`)
5. **`compare-cards` / `compare-card`** — карточки сравнения
6. **`flip-card` / `error-flip-card`** — flip-анимации
7. **`faq-accordion`** — раскрывающиеся FAQ
8. **`ctw-*`** — timeline-компонент (25+ классов)
9. **`ehrman-*`** — блок цитаты Барт Эрман
10. **`myth-box` / `fact-box` / `info-box` / `warn-box`** — callout-блоки
11. **`summary-card`** — карточки резюме
12. **`article-figure` / `figure-wide`** — figure с caption
13. **`sources-block` / `sources-list`** — блок источников
14. **`reading-list`** — список для чтения

## Решение

### Вариант A: Обогатить MDX (рекомендуется)
Добавить в MDX-файл все HTML-компоненты с CSS-классами.
Плюсы: единый source of truth, MDX обогащается и станет production-ready.
Минусы: много ручной работы (или автоматизация через скрипт).

### Вариант B: Гибридный рендеринг
Рендерить MDX Content + legacy-специфичные компоненты как Astro-компоненты.
Плюсы: постепенная миграция.
Минусы: два source of truth для одного контента.

### Вариант C: Отложить MDX-активацию
Оставить KodDaVinchiArticleBody на legacy HTML, двигать CSS @layer и JS decomposition.
Плюсы: нулевой риск регрессии.
Минусы: MDX остаётся orphaned.

**Текущий выбор:** Вариант C→A по секциям. Полная MDX-активация всё ещё отложена, но Phase 3a подготовил section-level seams. MDX-обогащение теперь надо делать по одному fragment/section с parity gate на каждом шаге.

## Скрипт для автоматического обогащения

Возможен скрипт `scripts/enrich-mdx-from-legacy.js`:
1. Парсит legacy HTML article-body
2. Для каждого `<h2>` находит соответствующий MDX-заголовок
3. Между заголовками — переносит CSS-классы и HTML-структуру
4. Генерирует обогащённый MDX

Это risky, но можно попробовать на 1 секции для proof of concept.
