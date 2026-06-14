# BIBLIOGRAPHY_SOURCE_MODEL_2026.md — модель источников и библиографии

Дата: 2026-06-12  
Связано с:

- `docs/EDITORIAL_AUTHORITY_EEAT_2026.md`
- `docs/CONTENT_MODEL_AND_AUTHORING_2026.md`
- `docs/MAPS_DATA_SCHEMA_2026.md`

---

## 1. Цель

Сделать источники структурированными, проверяемыми и переиспользуемыми.

```text
Не просто список литературы в HTML.
А data/sources.json + SourceRef components + CI checks.
```

---

## 2. Source types

```ts
type SourceType =
  | 'biblical'
  | 'commentary'
  | 'academic'
  | 'archaeology'
  | 'historical'
  | 'dictionary'
  | 'lexicon'
  | 'traditional'
  | 'encyclopedia'
  | 'map'
  | 'article'
  | 'web';
```

---

## 3. Reliability

```ts
type Reliability =
  | 'primary'
  | 'high'
  | 'medium'
  | 'low'
  | 'disputed';
```

---

## 4. Source shape

```json
{
  "id": "lloyd-jones-romans-7",
  "title": "Romans: Exposition of Chapter 7",
  "author": "D. Martyn Lloyd-Jones",
  "year": 1973,
  "type": "commentary",
  "reliability": "high",
  "url": "",
  "publisher": "Banner of Truth",
  "note": "Классическая реформационная позиция по Рим 7"
}
```

---

## 5. Biblical sources

```json
{
  "id": "genesis",
  "title": "Книга Бытия",
  "type": "biblical",
  "reliability": "primary"
}
```

---

## 6. Source references in MDX

```mdx
<SourceRef id="lloyd-jones-romans-7" locator="гл. 3" />
```

or:

```mdx
<Sources ids={["lloyd-jones-romans-7", "moo-romans"]} />
```

---

## 7. Map sourceIds

В route.json:

```json
"sourceIds": ["genesis", "woolley-ur"]
```

CI проверяет, что source exists.

---

## 8. Visible source policy

```text
[ ] если sourceId используется, источник должен быть видим в блоке источников или в карточке места
[ ] external academic/source links не nofollow по умолчанию
[ ] disputed claims must have source/debate
[ ] no fake citations
```

Google link best practices говорят, что external links can help establish trustworthiness when citing sources, and nofollow should be used when you don't trust the source, not for every external link.

---

## 9. Future bibliography page

Можно сделать:

```text
/sources/
/sources/lloyd-jones-romans-7/
```

Но не обязательно на первой фазе.

---

## 10. CI checks

```text
[ ] all SourceRef ids exist
[ ] all map sourceIds exist
[ ] sourcesRequired articles have at least one source
[ ] source URLs valid if present
[ ] no duplicate source ids
[ ] disputed map places have sources or debate
```

---

## 11. Итог

Источники — часть доверия проекта.

```text
Библиография должна быть машинно-проверяемой, но видимой читателю.
```
