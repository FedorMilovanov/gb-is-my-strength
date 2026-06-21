# MDX Enrichment Gap — kod-da-vinchi pilot

**Дата:** 2026-06-22
**Статус:** BLOCKED — MDX activation on hold until enrichment completes

## Проблема

MDX-файл `src/content/articles/kod-da-vinchi.mdx` (335 lines, 52K chars) содержит текстовый контент в markdown-формате, но **0 из 103 CSS-классов**, присутствующих в legacy HTML (`article-body.html`, 80.8K chars).

Это означает, что прямая замена `<Fragment set:html={articleBodyHtml}/>` на `<Content/>` произведёт **фундаментально другой HTML** с визуальной регрессией.

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

**Текущий выбор:** Вариант C — MDX-активация отложена до завершения CSS @layer и JS decomposition.
MDX-обогащение (Вариант A) можно делать параллельно как content-задачу.

## Скрипт для автоматического обогащения

Возможен скрипт `scripts/enrich-mdx-from-legacy.js`:
1. Парсит legacy HTML article-body
2. Для каждого `<h2>` находит соответствующий MDX-заголовок
3. Между заголовками — переносит CSS-классы и HTML-структуру
4. Генерирует обогащённый MDX

Это risky, но можно попробовать на 1 секции для proof of concept.
