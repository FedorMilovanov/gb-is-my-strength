# RUSSIAN_SEARCH_ALTERNATIVES_2026.md — альтернативы поиска для русского сайта

Дата: 2026-06-12  
Связано с:

- `docs/PAGEFIND_RUSSIAN_SEARCH_NOTES_2026.md`
- `docs/SEARCH_AND_DISCOVERY_ARCHITECTURE_2026.md`
- `docs/FREE_PAID_SERVICES_COST_STRATEGY_2026.md`

---

## 1. Проблема

Русский язык морфологически богатый:

```text
Авраам / Авраама / Аврааму
благодать / благодати / благодатью
сердце / сердца / сердцем
```

Статический поиск может не всегда понимать формы слов.

---

## 2. Вариант A — текущий search-manifest + aliases

Цена:

```text
бесплатно
```

Плюсы:

```text
+ полный контроль
+ лёгкий bundle
+ хорошо для command palette
+ aliases можно добавить вручную
```

Минусы:

```text
- нет настоящей морфологии
- нужно поддерживать aliases/keywords
```

Подходит сейчас.

---

## 3. Вариант B — Pagefind

Цена:

```text
бесплатно/open source/static
```

Плюсы:

```text
+ full-text из HTML
+ static assets
+ filters
+ lazy index chunks
+ no backend
```

Минусы:

```text
- русский stemming нужно проверить
- dev index stale
- не command palette replacement
```

Решение:

```text
сделать benchmark на русском.
```

---

## 4. Вариант C — Fuse.js / MiniSearch / Lunr

Цена:

```text
бесплатно/open source
```

Плюсы:

```text
+ client-side
+ можно добавить fuzzy search
+ легко для небольшого сайта
```

Минусы:

```text
- индекс часто грузится целиком
- морфология ограничена
- при росте сайта bundle/index растёт
```

Может быть полезно для command palette, но не для большого full-text.

---

## 5. Вариант D — Algolia

Цена:

```text
free tier возможен, но коммерческое/большое использование может стать платным
```

Плюсы:

```text
+ отличный поиск
+ typo tolerance
+ analytics
+ fast SaaS
```

Минусы:

```text
- SaaS dependency
- стоимость
- нужно индексировать данные
```

Не нужен сейчас.

---

## 6. Вариант E — Meilisearch / Typesense / OpenSearch

Цена:

```text
open source, но нужен сервер/хостинг = платно/DevOps
```

Плюсы:

```text
+ мощный поиск
+ можно настраивать язык/синонимы
+ API
```

Минусы:

```text
- backend
- maintenance
- hosting cost
- избыточно для статического сайта
```

Не сейчас.

---

## 7. Вариант F — Yandex Site Search / external search

Нужно отдельно исследовать актуальность. Но стратегически лучше иметь свой статический поиск.

---

## 8. Recommended path

```text
1. Оставить current manifest search.
2. Добавить aliases/keywords в content model.
3. Сделать Pagefind эксперимент.
4. Прогнать Russian query benchmark.
5. Если Pagefind ок — full-text /search/.
6. Если слабый — hybrid: Pagefind + aliases/manifest boosting.
7. SaaS search только при реальной необходимости.
```

---

## 9. Alias model

В frontmatter:

```yaml
search:
  aliases:
    - "Авраам"
    - "Аврама"
    - "Аврааму"
    - "Рим 7"
  keywords:
    - "освящение"
    - "внутренний человек"
```

---

## 10. Итог

Русский поиск решаем постепенно и бесплатно:

```text
manifest + aliases сейчас;
Pagefind benchmark потом;
paid search only if necessary.
```
