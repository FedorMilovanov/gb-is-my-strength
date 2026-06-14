# INTERNAL_LINKING_STRATEGY_2026.md — внутренняя перелинковка, topic clusters, граф сайта

Дата: 2026-06-12  
Связано с:

- `docs/SEARCH_AND_DISCOVERY_ARCHITECTURE_2026.md`
- `docs/CONTENT_MODEL_AND_AUTHORING_2026.md`
- `docs/SEO_TECHNICAL_CONTRACT_2026.md`

---

## 1. Цель

Внутренняя перелинковка должна быть не случайной, а системной:

```text
помогать читателю;
помогать поисковикам обходить сайт;
показывать тематические связи;
усиливать серии;
связывать статьи, карты, глоссарий и оригинальные слова;
поддерживать /map/ как карту связей.
```

---

## 2. Google link basics

Google link best practices: Google обычно может crawl link, если это `<a>` element с `href`; ссылки через JS events или нестандартные элементы не надёжны. URL в `href` должен быть реальным web address [1](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

Правила проекта:

```text
[ ] все важные ссылки — <a href="...">
[ ] не делать важную навигацию только button/onClick
[ ] root-relative URLs: /articles/foo/
[ ] no .html in internal links
[ ] descriptive anchor text
```

---

## 3. URL structure и root-relative links

Google URL structure docs предупреждают о broken relative links и рекомендуют root-relative URLs, чтобы избежать бесконечных/битых пространств URL [5](https://developers.google.com/search/docs/crawling-indexing/url-structure).

Решение:

```text
✅ /articles/foo/
❌ ../foo/
❌ ../../category/stuff
❌ /articles/foo/index.html
```

---

## 4. Типы внутренних ссылок

```text
Navigation links       — header/footer/section nav
Breadcrumbs            — иерархия
Contextual links       — внутри текста
Series links           — prev/next, список серии
Related articles       — блок после статьи
Map links              — открыть место/маршрут на карте
Glossary links         — термины
Original word links    — греч./евр. слова
Source links           — источники/библиография
Graph links            — для /map/
```

---

## 5. Topic clusters

Для сайта естественные clusters:

```text
Джон Гилл
Римлянам 7
Нагорная проповедь
Тайны человеческого сердца
Библейские карты
Апологетика / Код да Винчи
Пасторское служение
Герменевтика
```

Каждый cluster должен иметь:

```text
pillar page / hub
supporting articles
links hub → all spokes
links spokes → hub
links spokes → related spokes
```

---

## 6. Серии

В `series.json`:

```json
{
  "id": "dzhon-gill",
  "title": "Джон Гилл",
  "hubUrl": "/articles/dzhon-gill-spravochnik/",
  "items": [
    "dzhon-gill-chast-1-chelovek",
    "dzhon-gill-chast-2-uchenyi",
    "dzhon-gill-chast-3-nasledie"
  ]
}
```

Генерировать:

```text
[ ] блок серии на каждой статье
[ ] prev/next
[ ] ItemList JSON-LD
[ ] related articles
[ ] links graph edges
```

---

## 7. Related articles algorithm

Источники веса:

```text
explicit related frontmatter: +100
same series: +80
shared tags: +10 each
same section: +5
links to each other: +20
same Bible book/topic: +20
map/place relation: +15
```

В frontmatter:

```yaml
related:
  - dzhon-gill-chast-1-chelovek
  - dzhon-gill-istoricheskiy-kontekst
```

Если related задан вручную — он главный. Если нет — генерируем автоматически.

---

## 8. Contextual links policy

Ссылки в тексте должны отвечать на вопрос:

```text
«Что читателю естественно открыть дальше?»
```

Плохо:

```text
Читайте здесь
подробнее
эта статья
```

Хорошо:

```text
подробный разбор Римлянам 7
исторический контекст Джона Гилла
карта пути Авраама
```

---

## 9. Link density

Не нужно превращать каждый абзац в ссылочный блок.

Правило:

```text
3–8 контекстных внутренних ссылок для средней статьи — нормально.
Больше — только если статья большая и ссылки реально помогают.
```

---

## 10. Orphan pages

CI должен ловить:

```text
страница есть, но на неё нет внутренних ссылок.
```

Исключения:

```text
verification files
404
служебные dev/noindex страницы
```

---

## 11. Links graph

Текущий:

```text
data/links-graph.json
/map/
```

Будущий генератор:

```text
content links + series + related + maps + glossary → links-graph.json
```

Edge types:

```ts
type EdgeKind =
  | 'explicit-link'
  | 'same-series'
  | 'related'
  | 'same-tag'
  | 'map-place'
  | 'glossary'
  | 'source';
```

---

## 12. Maps as linking hubs

Статьи должны ссылаться на карты:

```mdx
<MapLink map="avraam" place="moriah">Мория на карте пути Авраама</MapLink>
```

Карты должны ссылаться на статьи:

```text
место/этап → связанные статьи
источник → статья/глоссарий
```

Это создаст сильную связку:

```text
контент ↔ карта ↔ источники ↔ глоссарий
```

---

## 13. Breadcrumbs

Каждая публичная страница:

```text
Главная → Раздел → Страница
```

Для серии:

```text
Главная → Нагорная проповедь → Часть 1
```

Breadcrumb UI и BreadcrumbList JSON-LD должны совпадать.

---

## 14. Navigation depth

Важные страницы должны быть доступны:

```text
≤ 3 клика от главной
```

При текущем размере сайта это легко достижимо через:

```text
главная
разделы
серии
related
карта связей
```

---

## 15. External links

Для источников:

```text
[ ] visible source label
[ ] url if available
[ ] no fake citations
[ ] archived link optional
[ ] rel policy for external links
```

Не использовать `nofollow` для нормальных академических/источниковых ссылок без причины.

---

## 16. Automation scripts

Будущие:

```text
scripts/generate-links-graph-from-content.js
scripts/check-orphan-pages.js
scripts/check-internal-anchors.js
scripts/generate-related-articles.js
```

---

## 17. CI checks

```text
[ ] no broken internal links
[ ] no .html internal links
[ ] no orphan public pages
[ ] breadcrumbs exist
[ ] related articles valid
[ ] series prev/next valid
[ ] map links target existing map/place
[ ] glossary links target existing term
```

---

## 18. Итог

Внутренняя перелинковка должна стать частью content model:

```text
Не ручная россыпь ссылок, а граф знаний сайта.
```

Это усилит SEO, UX, карты и поиск.
