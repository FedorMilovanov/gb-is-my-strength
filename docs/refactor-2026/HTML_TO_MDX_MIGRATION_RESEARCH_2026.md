# HTML_TO_MDX_MIGRATION_RESEARCH_2026.md — перенос текущих HTML-страниц в MDX

Дата: 2026-06-12  
Связано с:

- `docs/CONTENT_MODEL_AND_AUTHORING_2026.md`
- `docs/ASTRO_MIGRATION_PHASE_PLAN_2026.md`

---

## 1. Цель

Перенести текущие ручные HTML-страницы в MDX так, чтобы:

```text
SEO сохранился;
контент не потерялся;
визуал стал компонентным;
источники стали структурными;
внутренние ссылки сохранились;
добавление новых статей стало проще.
```

---

## 2. Не делать полностью автоматическую миграцию

Автоматический конвертер HTML→MDX может помочь, но не должен быть единственным этапом.

Почему:

```text
HTML содержит layout/head/scripts/styles, а нужен только контент;
много декоративной разметки надо заменить компонентами;
часть блоков лучше вручную превратить в MDX-компоненты;
источники и примечания надо структурировать;
автомат может испортить семантику цитат/таблиц/иврита/греческого.
```

Решение:

```text
Автоматизировать extraction + черновой markdown.
Финальная MDX-редактура обязательна.
```

---

## 3. Миграционный pipeline

```text
1. Extract head metadata → frontmatter
2. Extract main/article content → HTML fragment
3. Clean layout-only wrappers
4. Convert basic HTML → Markdown/MDX
5. Replace repeated patterns with components
6. Normalize internal links
7. Normalize images/Figure components
8. Add sources/tags/series
9. Run content schema
10. Visual + SEO diff
```

---

## 4. Что извлекать в frontmatter

Из legacy HTML:

```text
<title> → title
meta description → description
canonical → canonicalOverride или slug validation
og:image → ogImage
article:published_time → publishedAt
article:modified_time → updatedAt
h1 → проверить против title
breadcrumbs → section
JSON-LD Article author → author
article:section/tags → section/tags
```

---

## 5. Что переносить в body MDX

Только содержательный контент:

```text
h1/h2/h3
paragraphs
lists
tables
quotes
verses
notes
source blocks
figures/images
interactive placeholders
```

Не переносить:

```text
head
CSP meta
analytics
header/footer/nav
global CSS
inline scripts
JSON-LD как ручной блок
breadcrumbs, если они будут генерироваться layout
related articles, если будут генерироваться
```

---

## 6. Инструменты

Для серьёзной трансформации лучше использовать unified ecosystem:

```text
rehype-parse     — HTML → HAST
rehype-remark    — HAST → MDAST
remark-mdx       — MDX syntax
remark-stringify — Markdown output
custom plugins   — project-specific transforms
```

unified/remark ecosystem хорош тем, что работает через AST, а не regex. Обзоры 2026 по Markdown parsers отмечают: remark/unified — самый мощный выбор для content pipelines и трансформаций, особенно когда нужен AST и MDX [2](https://www.pkgpulse.com/guides/marked-vs-remark-vs-markdown-it-parsers-2026).

MDX сам работает через unified/remark/rehype; `remark-mdx` нужен для MDX syntax и AST-интеграции [1](https://unifiedjs.com/explore/package/remark-mdx/).

---

## 7. Компонентные замены

### 7.1 Цитаты

HTML:

```html
<blockquote>...</blockquote>
```

MDX:

```mdx
<Quote>
  ...
</Quote>
```

Или через MDX components mapping: стандартный `blockquote` рендерится как `QuoteBlock`.

Astro MDX docs показывают, что MDX позволяет заменять стандартные Markdown/HTML элементы custom components через `components` mapping [3](https://5-0-0-beta.docs.astro.build/en/guides/integrations-guide/mdx/).

### 7.2 Стихи

```mdx
<Verse ref="Рим 7:14">
  Ибо мы знаем, что закон духовен...
</Verse>
```

### 7.3 Оригинальные слова

```mdx
<OriginalWord lang="grc" word="σάρκινος" translit="sarkinos" />
```

### 7.4 Примечания

```mdx
<Note type="editorial">
  Здесь важно различать...
</Note>
```

### 7.5 Источники

```mdx
<SourceRef id="lloyd-jones-romans-7" />
```

---

## 8. Internal links normalization

Legacy links могут быть разными:

```text
../
/articles/foo/index.html
/articles/foo/
https://gospod-bog.ru/articles/foo/
```

Цель:

```text
/articles/foo/
```

Правила:

```text
[ ] внутренние ссылки root-relative
[ ] no .html
[ ] trailing slash
[ ] anchors проверяются
[ ] external links target/rel политика единая
```

---

## 9. Images migration

Legacy:

```html
<img src="/images/foo.webp" alt="...">
```

MDX варианты:

```mdx
<Figure src="/images/foo.webp" alt="..." caption="..." />
```

или Astro assets для новых материалов:

```mdx
import cover from '../../assets/articles/foo/cover.webp';

<Figure src={cover} alt="..." />
```

Правило: сначала не ломать существующие `/images/...`, потом постепенно улучшать через Astro assets.

---

## 10. Special cases

### 10.1 Нагорная проповедь

Сложная серия с TOC, mobile styles, possibly special layout. Не мигрировать первой.

### 10.2 Карты

Не мигрировать через MDX. Карты идут через отдельную data-driven архитектуру.

### 10.3 `/map/` graph map

Это interactive utility page. Переносить после стабилизации React islands.

### 10.4 Verification files

Не трогать.

---

## 11. Порядок миграции контента

```text
1. /about/
2. одна простая статья
3. /articles/index
4. простые articles
5. серия Джона Гилла
6. hard-texts
7. nagornaya
8. maps
9. главная
```

Главную не переносить первой: у неё максимум связей и визуального значения.

---

## 12. Черновой converter script

Будущий файл:

```text
scripts/legacy-html-to-mdx-draft.js
```

Команда:

```bash
node scripts/legacy-html-to-mdx-draft.js articles/kod-da-vinchi/index.html
```

Выход:

```text
src/content/articles/kod-da-vinchi.mdx.draft
```

Скрипт должен помечать TODO:

```mdx
{/* TODO: проверить источник */}
{/* TODO: заменить этот блок на <Verse> */}
{/* TODO: проверить alt */}
```

---

## 13. Diff после конвертации

Для каждой страницы сравнить:

```text
[ ] title
[ ] description
[ ] canonical
[ ] h1
[ ] word count ± допустимый порог
[ ] internal links count
[ ] image count
[ ] JSON-LD generated types
[ ] visual screenshot
```

---

## 14. Почему MDX лучше HTML для дальнейшей жизни

```text
HTML: удобно браузеру, неудобно автору.
MDX: удобно автору, валидируется схемой, рендерится в HTML.
```

Преимущества:

```text
+ меньше boilerplate
+ компоненты внутри текста
+ единый layout
+ frontmatter validation
+ Git diff читаемый
+ можно генерировать RSS/search/sitemap
+ легче редактура
```

---

## 15. Итог

Миграция HTML→MDX должна быть полуавтоматической:

```text
Extractor помогает.
Человек редактирует.
Schema проверяет.
Visual/SEO diff подтверждает.
```
