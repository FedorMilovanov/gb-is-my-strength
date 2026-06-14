# PAGEFIND_RUSSIAN_SEARCH_NOTES_2026.md — Pagefind, русский поиск, command palette

Дата: 2026-06-12  
Связано с:

- `docs/SEARCH_AND_DISCOVERY_ARCHITECTURE_2026.md`
- `docs/INTERNAL_LINKING_STRATEGY_2026.md`

---

## 1. Главный вывод

Pagefind подходит для статического full-text search, но русский поиск нужно тестировать отдельно.

```text
Pagefind full-text → эксперимент на /search/
Command palette → оставить lightweight manifest
```

---

## 2. Multilingual behavior

Pagefind multilingual docs говорят:

```text
если страница имеет lang, поиск автоматически ограничивается страницами с тем же языком;
Pagefind адаптирует stemming algorithms к языку, если он поддерживается;
если stemming не поддерживается, поиск не будет матчить разные формы слов;
UI переводится для ряда языков;
force language option создаёт один общий index.
```

Источник: https://pagefind.app/docs/multilingual/

---

## 3. Риск для русского

Нужно проверить:

```text
поддерживается ли русский stemming в текущей версии Pagefind;
как ищутся формы: благодать / благодати / благодатью;
как ищутся имена: Авраам / Авраама;
как работает греческий/иврит;
как работает транслитерация.
```

Если stemming слабый:

```text
Pagefind всё равно полезен для точного поиска;
command palette/manifest можно усилить aliases/keywords.
```

---

## 4. Index markup

ArticleLayout:

```astro
<article data-pagefind-body>
  <h1 data-pagefind-meta="title">{title}</h1>
  <p data-pagefind-meta="description">{description}</p>
  <span data-pagefind-filter="section">{section}</span>
  {tags.map((tag) => <span data-pagefind-filter="tag">{tag}</span>)}
  <slot />
</article>
```

Exclude:

```astro
<header data-pagefind-ignore>...</header>
<footer data-pagefind-ignore>...</footer>
<nav data-pagefind-ignore>...</nav>
```

Pagefind docs: `data-pagefind-body` limits indexed body, `data-pagefind-ignore` excludes content, `data-pagefind-filter` tags pages for filters.

---

## 5. Filters

Filters:

```text
section
series
tag
author
map
book
```

Pagefind API supports:

```js
const filters = await pagefind.filters();
const search = await pagefind.search(query, {
  filters: {
    section: 'articles',
    tag: ['экзегеза', 'Римлянам']
  }
});
```

---

## 6. Metadata

Search UI needs:

```text
title
url
description
image optional
section
publishedAt
```

Pagefind can capture metadata via `data-pagefind-meta`.

Example:

```astro
<img src={ogImage} alt={ogImageAlt} data-pagefind-meta="image[src], image_alt[alt]" />
```

---

## 7. Dev mode caveat

Pagefind indexes built HTML, so in dev it can be stale.

Workflow:

```bash
astro build && pagefind --site dist
```

During `astro dev`, either:

```text
use stale last build index;
or disable full-text search and use manifest search.
```

---

## 8. Command palette remains separate

Command palette should not import Pagefind by default.

It needs tiny manifest:

```json
{
  "title": "Путь Авраама",
  "url": "/karty/avraam/",
  "section": "karty",
  "aliases": ["Авраам", "карта Авраама", "Ур", "Харран"]
}
```

---

## 9. Russian aliases

Для русского поиска полезны aliases:

```yaml
aliases:
  - "Авраам"
  - "Аврама"
  - "Аврааму"
  - "Римлянам 7"
  - "Рим 7"
```

Это особенно полезно для command palette.

---

## 10. Tests

Создать тестовый набор запросов:

```text
авраам
авраама
ур халдейский
римлянам 7
сердце
крайне испорчено
джон гилл
благодать
σάρκινος
חֶסֶד
```

Проверить:

```text
[ ] Pagefind
[ ] command manifest
[ ] current search
```

---

## 11. Итог

Pagefind — хороший full-text слой, но для русского проекта нельзя принимать качество поиска на веру.

```text
Сначала тестовая /search/ и query benchmark.
Потом решение о production.
```
