# ASTRO_CONTENT_LOADER_STRATEGY_2026.md — стратегия loaders/content collections

Дата: 2026-06-12  
Связано с:

- `docs/ARTICLE_MDX_FRONTMATTER_SCHEMA_FINAL.md`
- `docs/CMS_OPTIONS_DECISION_2026.md`
- `docs/ASTRO_SITE_REFACTOR_RESEARCH_2026.md`

---

## 1. Главный вывод

Для проекта нужен **build-time content layer**, а не live runtime data.

```text
Статьи, серии, источники, авторы, карты → build-time collections.
Live collections → не использовать на старте.
```

---

## 2. Почему build-time

Astro docs рекомендуют build-time collections, когда:

```text
performance critical;
content relatively static;
нужны build-time optimization/caching;
нужен MDX;
нужна image optimization;
data can be fetched once and reused.
```

Это ровно наш случай.

---

## 3. Почему не live collections

Astro docs указывают ограничения live collections:

```text
No MDX support at runtime;
No image optimization at runtime;
Data fetched on each request;
No persistent content layer store;
Performance tradeoff.
```

Для сайта со статьями и библейскими картами это не нужно.

---

## 4. Loaders by collection

### articles

```ts
loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' })
```

### maps

```ts
loader: glob({ pattern: '**/*.json', base: './src/content/maps' })
```

или сначала оставить:

```text
karty/<slug>/route.json
```

и позже перенести.

### authors

```ts
loader: file('src/data/authors.json')
```

Важно: `file()` loader требует unique `id` у entries, если это array.

### series

```ts
loader: file('src/data/series.json')
```

### sources

```ts
loader: file('src/data/sources.json')
```

---

## 5. Manual sorting required

Astro docs предупреждают: `getCollection()` order nondeterministic/platform-dependent.

Правило:

```ts
const posts = (await getCollection('articles'))
  .sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());
```

Никогда не полагаться на порядок файлов.

---

## 6. References

Когда authors/series/sources будут collections, использовать `reference()`:

```ts
author: reference('authors')
related: z.array(reference('articles')).default([])
series: reference('series').optional()
```

Astro docs показывают reference для author и related posts. Это лучше, чем свободные строки, когда структура стабилизируется.

---

## 7. Custom loaders

Custom loader может пригодиться позже для:

```text
старого data/search-manifest.json;
автоматически извлечённых route.json;
remote CMS;
external bibliography;
```

Но на старте не нужен.

Astro Content Loader API позволяет loader object с `load({ store, parseData })`, `store.clear()`, `store.set()`, schema и async fetch. Для простых источников loader может быть function, возвращающая array entries with id или object keyed by id.

---

## 8. Content source of truth

После миграции:

```text
src/content/articles/*.mdx → статьи
src/data/authors.json → авторы
src/data/series.json → серии
src/data/sources.json → источники
src/content/maps/*.json → карты
```

Производные файлы:

```text
search-manifest.json
links-graph.json
sitemap.xml
feed.xml
related articles
```

не должны быть ручным источником истины.

---

## 9. Migration stages

```text
1. legacy data remains in /data and HTML.
2. define schemas in src/content.config.ts.
3. migrate /about/ and one article.
4. migrate authors/series as file() collections.
5. generate search/links graph from collections.
6. maps route.json into maps collection.
```

---

## 10. Итог

Loaders strategy:

```text
glob() for page-like content;
file() for structured arrays/objects;
reference() after model stabilizes;
custom loaders only when necessary;
live collections not now.
```
