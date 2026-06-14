# MAPS_DATA_SCHEMA_2026.md — конкретная схема данных для библейских карт

Дата: 2026-06-12  
Связано с:

- `docs/MAPS_ENGINE_RESEARCH_2026.md`
- `docs/MAPS-ARCHITECTURE.md`
- `docs/STRUCTURED_DATA_GRAPH_2026.md`

---

## 1. Цель

Перевести карты из HTML-монолитов в data-first архитектуру.

```text
Новая карта = route.json + общие компоненты/движок.
Не новая копия index.html.
```

---

## 2. Почему JSON Schema + Zod

Для карт нужно два уровня контроля:

```text
JSON Schema — проверять route.json независимо от Astro/TS.
Zod — типизировать данные в Astro/React.
```

Astro content collections используют Zod для schemas и автоматических TypeScript types [2](https://docs.astro.build/en/guides/content-collections/). Для standalone JSON в текущем legacy-проекте удобно использовать JSON Schema/Ajv. Ajv поддерживает Draft 2020-12 через отдельный entrypoint `ajv/dist/2020` [3](https://jsonic.io/guides/ajv-json-schema).

---

## 3. Версионирование схемы

Каждый route.json:

```json
{
  "$schema": "https://gospod-bog.ru/schemas/map-route.schema.json",
  "schemaVersion": "1.0.0",
  "id": "avraam"
}
```

Правило:

```text
patch — добавлены необязательные поля
minor — добавлены новые возможности без поломки
major — breaking changes
```

---

## 4. MapRoute

```ts
type MapRoute = {
  schemaVersion: string;
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  canonical: string;
  status: 'draft' | 'live' | 'archived';
  era: EraId;
  biblicalBooks: string[];
  references: string[];
  language: MapLanguage;
  defaultViewport: string;
  viewports: Viewport[];
  layers: LayerDefinition[];
  places: Place[];
  routeSegments: RouteSegment[];
  stages: Stage[];
  timeline?: TimelineEvent[];
  sources: Source[];
  seo: MapSeo;
};
```

---

## 5. EraId

```ts
type EraId =
  | 'patriarchs'
  | 'exodus'
  | 'conquest'
  | 'judges'
  | 'united-monarchy'
  | 'divided-monarchy'
  | 'exile'
  | 'post-exile'
  | 'second-temple'
  | 'roman'
  | 'early-church';
```

---

## 6. Certainty

```ts
type Certainty =
  | 'textual'
  | 'high'
  | 'probable'
  | 'possible'
  | 'disputed'
  | 'traditional'
  | 'symbolic';
```

Смысл:

```text
textual      — прямо из текста
high         — сильная локализация
probable     — вероятно
possible     — возможно
disputed     — спорно
traditional  — традиция
symbolic     — богословско-символический слой
```

---

## 7. Place

```ts
type Place = {
  id: string;
  name: string;
  names?: EraName[];
  he?: string;
  gr?: string;
  translit?: string;
  type: PlaceType;
  certainty: Certainty;
  geo?: GeoPoint;
  map: MapPoint;
  references: string[];
  content: PlaceContent;
  sourceIds: string[];
  relatedArticleSlugs?: string[];
};
```

### PlaceType

```ts
type PlaceType =
  | 'main'
  | 'candidate'
  | 'context'
  | 'region'
  | 'battle'
  | 'camp'
  | 'water'
  | 'mountain'
  | 'city'
  | 'road'
  | 'altar'
  | 'well';
```

### GeoPoint

```ts
type GeoPoint = {
  lat: number;
  lon: number;
  confidence: Certainty;
};
```

### MapPoint

```ts
type MapPoint = {
  x: number;
  y: number;
  labelSide?: 'top' | 'right' | 'bottom' | 'left';
  priority?: 1 | 2 | 3;
};
```

---

## 8. EraName

```ts
type EraName = {
  era: EraId;
  name: string;
  he?: string;
  gr?: string;
  translit?: string;
  certainty?: Certainty;
  note?: string;
};
```

Пример:

```json
{
  "era": "patriarchs",
  "name": "Шалем",
  "he": "שָׁלֵם",
  "certainty": "probable"
}
```

---

## 9. PlaceContent

```ts
type PlaceContent = {
  summary?: string;
  story?: string;
  bible?: string;
  language?: string;
  archaeology?: string;
  debate?: string;
  sources?: string;
};
```

Правило: content может быть HTML subset или MD string, но нужно выбрать единый формат.

Рекомендация:

```text
Фаза 1: сохранить HTML строки из текущего Авраама.
Фаза 2: перейти на Markdown/MDX fragments, если будет удобно.
```

---

## 10. RouteSegment

```ts
type RouteSegment = {
  id: string;
  from: string;
  to: string;
  stageId: string;
  kind: SegmentKind;
  certainty: Certainty;
  style: 'solid' | 'dashed' | 'dotted';
  path?: string;
  geoPath?: Array<[number, number]>;
  distanceKm?: number;
  durationDays?: number;
  references: string[];
  sourceIds: string[];
};
```

### SegmentKind

```ts
type SegmentKind =
  | 'main'
  | 'return'
  | 'war'
  | 'lot'
  | 'mission'
  | 'exile'
  | 'hypothesis'
  | 'detour';
```

---

## 11. Stage

```ts
type Stage = {
  id: string;
  n: number;
  title: string;
  subtitle?: string;
  description: string;
  placeIds: string[];
  segmentIds: string[];
  references: string[];
  age?: string;
  viewport?: string;
};
```

---

## 12. LayerDefinition

```ts
type LayerDefinition = {
  id: string;
  label: string;
  description?: string;
  color?: string;
  defaultOn: boolean;
  kind: 'route' | 'places' | 'context' | 'hypothesis' | 'terrain' | 'labels';
};
```

---

## 13. Viewport

```ts
type Viewport = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
```

Для текущего SVG `viewBox="0 0 1900 1430"`.

---

## 14. TimelineEvent

```ts
type TimelineEvent = {
  id: string;
  yearLabel?: string;
  age?: number;
  title: string;
  description: string;
  placeId?: string;
  references: string[];
};
```

---

## 15. Source

```ts
type Source = {
  id: string;
  title: string;
  author?: string;
  year?: number;
  type: 'biblical' | 'academic' | 'archaeology' | 'traditional' | 'encyclopedia' | 'map' | 'article';
  url?: string;
  note?: string;
  reliability: 'primary' | 'high' | 'medium' | 'low' | 'disputed';
};
```

---

## 16. MapSeo

```ts
type MapSeo = {
  title: string;
  description: string;
  ogImage: string;
  ogImageAlt: string;
  keywords?: string[];
  transcriptIntro: string;
};
```

---

## 17. Minimal route example

```json
{
  "$schema": "https://gospod-bog.ru/schemas/map-route.schema.json",
  "schemaVersion": "1.0.0",
  "id": "avraam",
  "slug": "avraam",
  "title": "Путь Авраама",
  "description": "Интерактивная карта пути Авраама по Быт 11–25.",
  "canonical": "https://gospod-bog.ru/karty/avraam/",
  "status": "live",
  "era": "patriarchs",
  "biblicalBooks": ["Бытие"],
  "references": ["Быт 11–25"],
  "language": { "primary": "ru", "ancient": ["he"] },
  "defaultViewport": "full",
  "viewports": [{ "id": "full", "label": "Вся карта", "x": 0, "y": 0, "width": 1900, "height": 1430 }],
  "layers": [],
  "places": [],
  "routeSegments": [],
  "stages": [],
  "sources": [],
  "seo": {
    "title": "Путь Авраама — интерактивная карта",
    "description": "Путь Авраама от Ура до Мории: интерактивная библейская карта.",
    "ogImage": "/images/og-karty-1200x630.webp",
    "ogImageAlt": "Интерактивная карта пути Авраама",
    "transcriptIntro": "Карта показывает основные этапы пути Авраама по Книге Бытия."
  }
}
```

---

## 18. CI validation

Будущая команда:

```json
"maps:validate": "node scripts/validate-map-routes.js"
```

Проверять:

```text
[ ] все place ids уникальны
[ ] all segment from/to exist
[ ] all stage placeIds exist
[ ] all sourceIds exist
[ ] all layer ids unique
[ ] canonical matches slug
[ ] live maps have ogImage
[ ] disputed places have debate or sourceIds
[ ] geo lon/lat in valid ranges
```

---

## 19. Итог

Схема должна защитить карты от хаоса:

```text
география + источники + эпохи + уверенность + SEO + transcript — всё в данных.
```
