# MAPS_ROUTE_DRAFT_EXTRACTION_SCRIPT_PLAN.md — план скрипта извлечения карты Авраама

Дата: 2026-06-12  
Связано с:

- `docs/MAPS_AVRAAM_EXTRACTION_PLAN.md`
- `docs/MAPS_DATA_SCHEMA_2026.md`

---

## 1. Цель

Написать helper script, который поможет извлечь данные из `karty/avraam/index.html` в `route.draft.json`.

Но скрипт не должен делать финальный перенос полностью автоматически.

---

## 2. Почему автоматическое извлечение сложно

В `index.html` данные — это JS-объекты с:

```text
template literals
HTML strings
inline buttons
nested backticks
comments
functions рядом с данными
```

Простой regex может сломаться.

---

## 3. Стратегия

```text
1. Найти диапазон `const PLACES=[ ... ];`
2. Найти `const STAGES=[ ... ];`
3. Найти `const LAYERS=[ ... ];`
4. Найти `const LIFE=[ ... ];`
5. Сохранить raw JS snippets в reports/maps-extraction/
6. Попробовать vm sandbox evaluation
7. Если eval fails — fallback на ручной перенос
```

---

## 4. Безопасность

Не выполнять весь HTML script целиком.

Допустимо:

```text
извлечь только const block;
обернуть в sandbox;
отключить доступ к require/process/fs;
ограничить eval контекст.
```

Но всё равно ручная проверка обязательна.

---

## 5. Будущий файл

```text
scripts/extract-avraam-route-draft.js
```

Команда:

```json
"maps:extract:avraam": "node scripts/extract-avraam-route-draft.js"
```

---

## 6. Output

```text
reports/maps-extraction/places.raw.js
reports/maps-extraction/stages.raw.js
reports/maps-extraction/layers.raw.js
reports/maps-extraction/life.raw.js
karty/avraam/route.draft.generated.json
```

Не перезаписывать ручной:

```text
karty/avraam/route.draft.json
```

без флага `--write`.

---

## 7. Mapping minimum

### PLACES → places

```js
{
  id: pl.id,
  name: pl.name,
  he: pl.he,
  translit: pl.tr,
  type: mapType(pl.type),
  certainty: guessCertainty(pl),
  map: { x: pl.x, y: pl.y, labelSide: mapSide(pl.side) },
  references: extractRefs(pl.ep1, pl.bible),
  content: {
    summary: pl.kick,
    story: pl.story,
    bible: pl.bible,
    archaeology: pl.arch
  },
  sourceIds: []
}
```

### STAGES → stages + routeSegments

`STAGES.paths` нужно превратить в routeSegments, но from/to не всегда очевидны. На первой генерации можно:

```text
segment id: stage-{n}-path-{i}
from/to: placeholder
path: original SVG d
```

И потом вручную связать.

---

## 8. Integrity checks после генерации

```text
[ ] generated place count == current PLACES length
[ ] generated stage count == current STAGES length
[ ] all Hebrew strings preserved
[ ] all HTML content preserved
[ ] no undefined/null critical fields
```

---

## 9. Почему уже создан route.draft.json вручную

В репозитории уже создан минимальный:

```text
karty/avraam/route.draft.json
```

Он не полный, но валидируется integrity checker'ом.

Скрипт нужен для следующего шага — массово перенести остальные места и тексты.

---

## 10. Итог

Скрипт — помощник, не авторитет.

```text
generated draft → human review → validated route.draft.json
```
