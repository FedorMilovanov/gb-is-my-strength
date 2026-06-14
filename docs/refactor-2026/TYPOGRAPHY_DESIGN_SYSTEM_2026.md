# TYPOGRAPHY_DESIGN_SYSTEM_2026.md — типографика, дизайн-токены, визуальная система

Дата: 2026-06-12  
Связано с:

- `docs/DESIGN-TOKENS.md`
- `docs/ASTRO_IMPLEMENTATION_BLUEPRINT_2026.md`
- `docs/CONTENT_MODEL_AND_AUTHORING_2026.md`

---

## 1. Цель

Сохранить авторский визуальный стиль сайта, но сделать его системным:

```text
единые токены;
единая типографика статей;
единые компоненты;
предсказуемая мобильная версия;
поддержка русского, иврита, греческого;
лёгкая правка 100 страниц через один CSS/component layer.
```

---

## 2. Главный принцип

Не делать резкий redesign при Astro-миграции.

```text
Фаза 1: сохранить текущий визуальный характер.
Фаза 2: нормализовать tokens/components.
Фаза 3: улучшать отдельные элементы.
```

---

## 3. Текущие сильные стороны

```text
тёмно-золотая эстетика;
хорошая богословско-литературная атмосфера;
локальные шрифты;
выразительные карточки;
сильные обложки;
карты имеют уникальный стиль;
```

Не потерять.

---

## 4. Базовые токены

```css
:root {
  --color-bg: #070a10;
  --color-bg-2: #0b0f16;
  --color-panel: rgba(13,17,26,.92);
  --color-line: rgba(232,200,121,.26);

  --color-gold: #e8c879;
  --color-gold-soft: rgba(232,200,121,.55);
  --color-gold-dim: rgba(232,200,121,.16);

  --color-text: #e9e4d6;
  --color-muted: #9aa2ae;
  --color-faint: #5e6570;

  --font-serif: 'Playfair Display', Georgia, serif;
  --font-body: 'Cormorant Garamond', Georgia, serif;
  --font-sans: 'Source Sans 3', system-ui, -apple-system, sans-serif;
  --font-hebrew: 'Noto Serif Hebrew', 'Noto Sans Hebrew', serif;
  --font-greek: 'Noto Serif Greek', 'Noto Sans Greek', serif;

  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;

  --shadow-panel: 0 30px 80px rgba(0,0,0,.65);

  --measure-article: 72ch;
}
```

---

## 5. Typography scale

```css
:root {
  --step--1: clamp(0.88rem, 0.84rem + 0.2vw, 0.96rem);
  --step-0: clamp(1rem, 0.96rem + 0.25vw, 1.08rem);
  --step-1: clamp(1.18rem, 1.05rem + 0.55vw, 1.35rem);
  --step-2: clamp(1.45rem, 1.22rem + 1vw, 1.8rem);
  --step-3: clamp(1.85rem, 1.45rem + 1.8vw, 2.45rem);
  --step-4: clamp(2.35rem, 1.75rem + 2.6vw, 3.4rem);
}
```

---

## 6. Article layout

```css
.article {
  max-width: var(--measure-article);
  margin-inline: auto;
  font-family: var(--font-body);
  font-size: var(--step-0);
  line-height: 1.75;
}

.article h1,
.article h2,
.article h3 {
  font-family: var(--font-serif);
  line-height: 1.15;
  color: #f4eedd;
}

.article p + p {
  margin-top: 1.05em;
}
```

---

## 7. Компоненты статей

Стандартизировать:

```text
ArticleHero
ArticleMeta
ArticleToc
VerseBlock
QuoteBlock
NoteBox
WarningBox
SourceBox
Figure
RelatedArticles
SeriesNav
AuthorBox
```

Каждый компонент должен иметь:

```text
Astro implementation
accessible markup
dark/light considerations if future
mobile behavior
```

---

## 8. Hebrew / Greek

```css
[lang="he"] {
  font-family: var(--font-hebrew);
  direction: rtl;
  unicode-bidi: isolate;
}

[lang="grc"],
[lang="el"] {
  font-family: var(--font-greek);
}

.original-word {
  font-size: 1.08em;
  color: var(--color-gold);
  letter-spacing: .01em;
}
```

Компонент:

```mdx
<OriginalWord lang="he" word="חֶסֶד" translit="hesed" />
```

---

## 9. Quotes

```astro
<blockquote class="quote-block">
  <slot />
  {source && <footer>{source}</footer>}
</blockquote>
```

Не делать цитаты просто декоративным div.

---

## 10. Notes

Типы:

```text
editorial
pastoral
warning
source
language
archaeology
```

```astro
<aside class={`note note--${type}`}>
  <strong>{label}</strong>
  <slot />
</aside>
```

Цвет не должен быть единственным носителем смысла: нужен label/icon/text.

---

## 11. Tables

```text
responsive wrapper
caption if meaningful
scope for th
no tiny mobile text
```

---

## 12. Code / citations

Для богословских статей code не главный, но могут быть:

```text
греческий/иврит morphology tables
source references
argument matrices
```

Нужно отдельное оформление для:

```text
source reference
bibliographic item
verse reference
```

---

## 13. Cards

Единые карточки:

```text
ArticleCard
SeriesCard
MapCard
BioCard
```

Поля:

```text
title
description
section
date
readingTime
tags
cover optional
```

---

## 14. Mobile typography

```text
[ ] article measure не шире экрана
[ ] h1 не ломается некрасиво
[ ] line-height достаточно высокий
[ ] touch targets ≥ 40px
[ ] TOC collapsible
[ ] tables scrollable
[ ] footnotes readable
```

---

## 15. CSS architecture in Astro

Рекомендация:

```text
src/styles/tokens.css
src/styles/global.css
component-scoped styles in .astro
no massive inline CSS per page
```

Не вводить Tailwind в первой фазе. Текущий стиль авторский; сначала перенести tokens/components.

---

## 16. Visual regression

Для design system обязательно:

```text
[ ] article page screenshot
[ ] section index screenshot
[ ] map hub screenshot
[ ] mobile screenshot
[ ] dark backgrounds/card states
```

---

## 17. Итог

Дизайн-система должна сохранить «голос» сайта, но убрать ручной хаос:

```text
авторская эстетика + системные токены + Astro components.
```
