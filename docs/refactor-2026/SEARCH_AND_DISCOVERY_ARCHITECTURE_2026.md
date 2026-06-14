# SEARCH_AND_DISCOVERY_ARCHITECTURE_2026.md — поиск, навигация, discovery, AI-readiness

Дата: 2026-06-12  
Связано с:

- `docs/ASTRO_SITE_REFACTOR_RESEARCH_2026.md`
- `docs/CONTENT_MODEL_AND_AUTHORING_2026.md`
- `docs/SEO_TECHNICAL_CONTRACT_2026.md`

---

## 1. Цель

Сайт должен быть удобен не только поисковикам, но и читателю:

```text
найти статью;
понять серии;
увидеть связанные материалы;
перейти к карте;
искать по оригинальным словам;
видеть источники;
получать RSS;
быстро пользоваться командной палитрой.
```

---

## 2. Текущий фундамент

В репозитории уже есть:

```text
data/search-manifest.json
data/links-graph.json
data/series.json
data/glossary.json
data/original-words.json
data/verses.json
/map/ — карта связей статей
```

Это сильная база. При Astro-переходе её нельзя потерять — нужно начать генерировать эти данные из content collections.

---

## 3. Два уровня поиска

### Уровень A — собственный search-manifest

Сохранить сначала.

Плюсы:

```text
+ уже встроен в сайт
+ можно тонко контролировать поля
+ хорошо для command palette
+ маленький объём при текущем числе страниц
```

Минусы:

```text
- при росте до сотен/тысяч страниц может стать тяжёлым
- нужно самому делать ранжирование/морфологию
```

### Уровень B — Pagefind

Pagefind генерирует статический индекс после build и ищет в браузере без backend.

Плюсы:

```text
+ статический
+ индекс строится из HTML
+ не нужен сервер
+ чанки загружаются по запросу
+ можно ограничить область индекса через data-pagefind-body
+ можно фильтровать через data-pagefind-filter
```

Pagefind используется так: сначала `astro build`, потом `pagefind --site dist`; Pagefind сканирует HTML в `dist` и создаёт индекс в `dist/pagefind/` [2](https://deku.posstree.com/en/astro/search/).

---

## 4. Рекомендация

```text
Фаза 1: сохранить текущий search-manifest, но генерировать его из Astro collections.
Фаза 2: добавить /search/ на Pagefind как эксперимент.
Фаза 3: если Pagefind лучше — оставить его для full-text, а command palette питать лёгким manifest.
```

То есть не выбирать одно против другого:

```text
Command Palette → lightweight manifest
Full-text search → Pagefind
```

---

## 5. Pagefind разметка

В ArticleLayout:

```astro
<article data-pagefind-body>
  <h1>{title}</h1>
  <p data-pagefind-meta="description">{description}</p>
  <span data-pagefind-filter="section">{section}</span>
  {tags.map((tag) => <span data-pagefind-filter="tag">{tag}</span>)}
  <slot />
</article>
```

Исключать:

```astro
<nav data-pagefind-ignore>...</nav>
<footer data-pagefind-ignore>...</footer>
```

Pagefind filters работают через `data-pagefind-filter`, где значение берётся из содержимого элемента [1](https://younagi.dev/blog/astro-with-pagefind-filtering-search/).

---

## 6. Search page

```text
/search/
```

Фичи:

```text
query param ?q=
фильтр по разделу
фильтр по серии
фильтр по тегам
результаты с excerpt
клавиатурная навигация
```

---

## 7. Command palette

Command palette не должен грузить весь Pagefind.

Ему нужен маленький manifest:

```json
[
  {
    "title": "Римлянам 7: верующий, неверующий или человек под законом?",
    "url": "/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/",
    "section": "articles",
    "tags": ["Римлянам", "экзегеза"],
    "description": "..."
  }
]
```

И команды:

```text
Открыть статью
Открыть карту
Открыть раздел
Найти стих
Найти слово
```

---

## 8. Links graph

Текущий `/map/` строится из `data/links-graph.json`. В будущем граф должен генерироваться из:

```text
content internal links
series data
manual related links
map links
original word links
```

Цель:

```text
связи не руками;
граф обновляется при build;
related articles генерируются из тех же данных;
сломанные ссылки ловятся CI.
```

---

## 9. Related articles

Источники для related:

```text
same series
shared tags
explicit related in frontmatter
internal link graph
same Bible book / topic
```

Frontmatter:

```yaml
related:
  - kod-da-vinchi
  - hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki
```

Если related не задан — генерировать автоматически.

---

## 10. Серии как discovery layer

Каждая серия должна иметь:

```text
landing page
ItemList JSON-LD
prev/next
progress indicator
related map if exists
RSS/category feed optional
```

---

## 11. Глоссарий и оригинальные слова

Текущие данные:

```text
data/glossary.json
data/original-words.json
```

Можно развить:

```text
/glossary/
/words/he/...
/words/gr/...
```

И в статьях:

```mdx
<OriginalWord lang="grc" word="σάρκινος" />
```

Это усилит internal linking и topical authority.

---

## 12. AI-readiness

По состоянию на 2026 не стоит строить стратегию вокруг «магических» AI-файлов. Появились сообщения о руководстве Google по AI Search, где подчёркивается: оптимизация для AI Overviews/AI Mode остаётся обычным SEO, а `llms.txt`/AI-specific markup не требуются для Google [1](https://gap3.co/blog/google-ai-search-optimization-guide/).

Практический подход:

```text
[ ] хороший HTML
[ ] sitemap
[ ] structured data
[ ] ясные заголовки
[ ] sources
[ ] author/entity
[ ] internal links
[ ] уникальная аналитика
[ ] content visible without JS
```

`llms.txt` можно добавить позже как эксперимент для не-Google инструментов, но не как замену sitemap/SEO.

---

## 13. Sitemap как discovery

Сгенерировать не только общий sitemap, но при росте можно сделать:

```text
sitemap.xml index
sitemap-articles.xml
sitemap-karty.xml
sitemap-series.xml
```

Astro sitemap integration поддерживает splitting через entryLimit и `serialize` для изменения entries [2](https://docs.astro.build/en/guides/integrations-guide/sitemap/).

---

## 14. RSS

Сохранить:

```text
/feed.xml
```

В будущем можно добавить:

```text
/feed/articles.xml
/feed/maps.xml
/feed/series/dzhon-gill.xml
```

Но сначала сохранить текущий.

---

## 15. Metrics

Отслеживать:

```text
search queries in internal search
zero-result queries
most opened command palette items
related article clicks
map links clicks
RSS subscribers if measurable
```

---

## 16. Итог

Discovery architecture:

```text
Astro collections → search manifest + Pagefind + links graph + related + sitemap + RSS.
```

Не нужно руками поддерживать пять разных систем. Источник истины — content model.
