# MAPS_AVRAAM_EXTRACTION_PLAN.md — план извлечения данных карты Авраама

Дата: 2026-06-12  
Связано с:

- `docs/MAPS_DATA_SCHEMA_2026.md`
- `docs/MAPS_ENGINE_RESEARCH_2026.md`
- `karty/_shared/route.schema.json`

---

## 1. Цель

Перевести `/karty/avraam/index.html` из монолита в data-first формат без потери текущего визуала и функций.

Не цель первой фазы:

```text
❌ переписать UI
❌ перейти на Leaflet/MapLibre
❌ менять URL
❌ менять дизайн карты
```

---

## 2. Текущее состояние

Файл:

```text
karty/avraam/index.html
```

Размер около 150 KB.

Внутри:

```text
inline CSS
inline SVG base map
inline HTML UI
inline JS engine
const PLACES
const STAGES
const LAYERS
const LIFE
CTX context markers
sources/method modal
```

---

## 3. Целевое состояние фазы 1

```text
karty/avraam/index.html       — пока остаётся рабочей страницей
karty/avraam/route.draft.json — данные, извлечённые из JS
karty/_shared/route.schema.json
```

На фазе 1 страница может ещё не использовать JSON. Главное — безопасно извлечь данные и сверить.

---

## 4. Извлекать по очереди

### Step 1 — PLACES

Из:

```js
const PLACES = [...]
```

В:

```json
"places": []
```

Поля mapping:

```text
id → id
name → name
he → he
tr → translit
x/y → map.x/map.y
type → type
stage → later stage relation
kick → content.summary
id1/id2/ep1/ep2 → content.summary or metadata later
story/bible/arch → content.story/bible/archaeology
side → map.labelSide
```

Добавить вручную:

```text
certainty
geo.lat/lon где известно
sourceIds
references
```

### Step 2 — STAGES

Из:

```js
const STAGES = [...]
```

В:

```json
"stages": []
"routeSegments": []
```

Текущие `paths` станут `routeSegments.path`.

### Step 3 — LAYERS

Из:

```js
const LAYERS = [...]
```

В:

```json
"layers": []
```

### Step 4 — LIFE

Из:

```js
const LIFE = [...]
```

В:

```json
"timeline": []
```

### Step 5 — SOURCES

Сейчас источники в modal HTML. Их надо превратить в:

```json
"sources": []
```

---

## 5. Промежуточный файл

```text
karty/avraam/route.draft.json
```

В нём допустимо:

```text
sourceIds: []
certainty: "possible" временно
geo отсутствует временно
```

Но финальная live-схема должна быть строже.

---

## 6. Проверки после извлечения

```text
[ ] количество places == 19
[ ] все id уникальны
[ ] все x/y сохранены
[ ] все story/bible/arch content сохранены
[ ] все stages сохранены
[ ] все route paths сохранены
[ ] all stage references valid
[ ] no lost Hebrew strings
[ ] no broken HTML entities
```

---

## 7. Валидация схемы

Схема уже создана:

```text
karty/_shared/route.schema.json
```

Будущий валидатор:

```text
scripts/validate-map-routes.js
```

Использовать Ajv 2020:

```js
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
```

Ajv в production лучше компилировать schema один раз и переиспользовать validator; format validation требует `ajv-formats` [2](https://go-tools.org/blog/json-schema-validation-complete-guide).

---

## 8. После фазы 1

Фаза 2:

```text
index.html начинает читать route.draft.json через fetch
или route data встраивается build script-ом
```

Фаза 3:

```text
вынести map-engine.js
вынести map.css
оставить base SVG/component
```

Фаза 4:

```text
Astro MapApp получает route как props
MapTranscript генерируется из route
```

---

## 9. Риски

```text
HTML strings с backticks трудно автоматически парсить
часть данных смешана с UI
источники не структурированы
route path не всегда from/to очевидны
```

Решение:

```text
полуавтоматическое извлечение + ручная сверка.
```

---

## 10. Минимальный PR

```text
PR: maps-avraam-route-draft

- karty/_shared/route.schema.json
- karty/avraam/route.draft.json
- docs/MAPS_DATA_SCHEMA_2026.md
- docs/MAPS_AVRAAM_EXTRACTION_PLAN.md
```

Без изменения production карты.

---

## 11. Итог

Первый шаг — не переписывать карту, а вынуть её данные.

```text
Данные отдельно → движок отдельно → новые карты без копипасты.
```
