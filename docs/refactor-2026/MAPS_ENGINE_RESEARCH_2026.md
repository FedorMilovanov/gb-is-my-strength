# MAPS_ENGINE_RESEARCH_2026.md — исследование будущей архитектуры карт

Дата: 2026-06-12  
Цель: отделить исследование карт от общего рефакторинга сайта. Выбрать архитектуру библейского атласа на годы вперёд: Авраам, Моисей, Давид, Павел, эпохи, слои, источники, SEO, доступность, производительность.

---

## 1. Короткое решение

Основной движок карт сейчас оставляем: **custom SVG / data-driven renderer**.

Не переносить текущую карту Авраама на Leaflet или MapLibre как основной вариант. Но данные нужно проектировать так, чтобы в будущем можно было сделать:

```text
Custom SVG renderer — основной художественный режим
GeoJSON export — универсальный обменный формат
Leaflet renderer — быстрый реальный/проверочный режим
MapLibre renderer — будущий GIS/vector-tile режим
Print renderer — печатная версия
```

Главная формула:

```text
Одна географическая база
+ один общий движок
+ разные route.json для карт
+ разные era/toponym layers
+ отдельные SEO-страницы под каждую карту
```

---

## 2. Почему не Leaflet как основной движок

Leaflet хорош для:

- простых веб-карт;
- OpenStreetMap/raster tiles;
- маркеров;
- popups/tooltips;
- GeoJSON;
- image overlay;
- быстрого прототипа.

Но для текущего проекта он не идеален как основа, потому что:

- эстетика станет более «обычной картографической»;
- авторская SVG-стилистика сложнее контролируется;
- древняя карта требует не только географической точности, но и художественной композиции;
- кинотур, богословский текст, источники, спорные гипотезы — это скорее интерактивный атлас, чем обычная карта.

Leaflet может быть полезен как вторичный режим:

```text
«Показать на современной карте»
«Проверить координаты»
«Экспорт GeoJSON → Leaflet preview»
```

---

## 3. Почему не MapLibre как основной движок сейчас

MapLibre GL JS хорош для:

- vector tiles;
- WebGL;
- больших слоёв данных;
- terrain/3D/globe;
- динамических стилей;
- GIS-атласа;
- PMTiles/offline vector atlas.

Но для текущей карты Авраама:

- объектов мало;
- WebGL может быть избыточен;
- bundle и сложность выше;
- нужно обслуживать style.json, glyphs, sprites, tiles;
- художественный SVG-контроль станет сложнее;
- доступность WebGL canvas сложнее, чем SVG/HTML.

MapLibre — хороший кандидат для будущего `/atlas/` или «научного режима», но не для первой линии карт.

---

## 4. Почему custom SVG остаётся лучшим

Плюсы:

- полный контроль над визуалом;
- стилизованная историческая карта;
- SVG-текст и элементы доступны DOM/SEO/assistive tooling лучше canvas;
- нет внешних tiles;
- работает статически;
- можно встроить духовно-литературный опыт;
- можно делать кинотур, родословия, хронологию, источники.

Минусы:

- нужно самим поддерживать pan/zoom;
- нужно самим делать доступность;
- нужно аккуратно считать координаты/расстояния;
- при росте карт надо обязательно выносить данные.

Решение: не менять основу, а сделать её data-driven.

---

## 5. URL-архитектура

```text
/karty/                 — хаб карт
/karty/avraam/          — путь Авраама
/karty/ishod/           — Исход / Моисей
/karty/david/           — Давид
/karty/pavel/           — путешествия Павла
/karty/sem-tserkvey/    — семь церквей Апокалипсиса
```

Не делать одну страницу `/karty/?hero=avraam` как основную. Для SEO лучше отдельные страницы.

Общий режим сравнения можно добавить позже:

```text
/karty/sravnenie/
/karty/atlas/
```

---

## 6. Главный архитектурный контракт

Новая карта = новый JSON/MDX данных, а не копия HTML.

```text
src/content/maps/avraam.json
src/content/maps/ishod.json
src/content/maps/pavel.json
```

или до общего Astro-рефакторинга:

```text
karty/avraam/route.json
karty/ishod/route.json
karty/_shared/map-engine.js
karty/_shared/map.css
karty/_shared/base-geo.svg
```

---

## 7. Слои карты

От нижнего к верхнему:

```text
base-geo        — моря, берег, реки, рельеф
era-regions     — регионы выбранной эпохи
era-labels      — топонимы выбранной эпохи
context         — археология, империи, торговые пути
route           — маршрут текущей карты
hypotheses      — спорные версии
markers         — места
ui              — карточки, тур, поиск, легенда
transcript      — SEO/no-JS текстовая версия
```

Важно: топонимы не должны быть жёстко зашиты в base-geo. Они зависят от эпохи.

---

## 8. Эпохи и топонимы

Одна координата может иметь разные имена по эпохам.

Пример:

```json
{
  "id": "jerusalem",
  "geo": { "lat": 31.778, "lon": 35.235 },
  "names": [
    {
      "era": "patriarchs",
      "name": "Шалем",
      "he": "שָׁלֵם",
      "certainty": "probable"
    },
    {
      "era": "monarchy",
      "name": "Иерусалим",
      "he": "יְרוּשָׁלַיִם"
    },
    {
      "era": "roman",
      "name": "Иерусалим",
      "gr": "Ἱεροσόλυμα"
    }
  ]
}
```

Карта Авраама не должна показывать римские провинции как основной слой. Карта Павла не должна жить в топонимике патриархов.

---

## 9. Уровни уверенности

Для библейской географии это обязательно.

```ts
certainty:
  | 'textual'       // прямо следует из текста
  | 'high'          // высокая локализация
  | 'probable'      // вероятно
  | 'possible'      // возможно
  | 'disputed'      // спорно
  | 'traditional'   // традиция
  | 'symbolic'      // богословско-символический слой
```

Визуальные правила:

```text
solid line       — высокая уверенность
long dash        — вероятно
short dash       — возможно
dotted           — гипотеза
halo/area        — зона неопределённости
purple marker    — кандидат/альтернатива
source badge     — источник/тип уверенности
```

---

## 10. Стандарт `route.json`

### 10.1 Корень

```ts
type MapRoute = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  canonical: string;
  era: EraId;
  biblicalBooks: string[];
  language: {
    primary: 'ru';
    ancient?: Array<'he' | 'gr' | 'ar' | 'la'>;
  };
  viewports: Viewport[];
  places: Place[];
  routeSegments: RouteSegment[];
  stages: Stage[];
  layers: LayerDefinition[];
  timeline?: TimelineEvent[];
  sources: Source[];
  seo: MapSeo;
};
```

### 10.2 Place

```ts
type Place = {
  id: string;
  name: string;
  he?: string;
  gr?: string;
  translit?: string;
  type: 'main' | 'candidate' | 'context' | 'region' | 'battle' | 'camp' | 'water' | 'mountain';
  certainty: Certainty;
  geo?: {
    lat: number;
    lon: number;
    confidence: Certainty;
  };
  map: {
    x: number;
    y: number;
    labelSide?: 'top' | 'right' | 'bottom' | 'left';
    priority?: 1 | 2 | 3;
  };
  references: string[];
  content: {
    story?: string;
    bible?: string;
    language?: string;
    archaeology?: string;
    debate?: string;
    sources?: string;
  };
  sourceIds: string[];
};
```

### 10.3 RouteSegment

```ts
type RouteSegment = {
  id: string;
  from: string;
  to: string;
  stageId: string;
  kind: 'main' | 'return' | 'war' | 'lot' | 'mission' | 'exile' | 'hypothesis';
  certainty: Certainty;
  style: 'solid' | 'dashed' | 'dotted';
  path?: string;          // SVG path для художественного рендера
  geoPath?: Array<[number, number]>; // lon/lat для GeoJSON
  distanceKm?: number;
  durationDays?: number;
  references: string[];
  sourceIds: string[];
};
```

### 10.4 Source

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

## 11. GeoJSON export

Каждая карта должна конвертироваться в GeoJSON:

```text
places → FeatureCollection<Point>
segments → FeatureCollection<LineString>
regions → FeatureCollection<Polygon>
```

Пример:

```json
{
  "type": "Feature",
  "properties": {
    "id": "ur",
    "name": "Ур Халдейский",
    "certainty": "high",
    "references": ["Быт 11:28–31"]
  },
  "geometry": {
    "type": "Point",
    "coordinates": [46.103, 30.962]
  }
}
```

Это даст совместимость с Leaflet/MapLibre/QGIS.

---

## 12. SEO для карт

Каждая карта — отдельная SEO-страница, а не только JS-приложение.

На странице должно быть:

```text
h1
описание
текстовый список мест
текстовый список этапов
источники
canonical
OG/Twitter
JSON-LD
внутренние ссылки на статьи
ссылка на /karty/
```

Принцип:

```astro
<MapTranscript places={route.places} stages={route.stages} sources={route.sources} />
<MapApp client:visible route={route} />
```

`MapTranscript` — виден поисковику и пользователю без JS.  
`MapApp` — интерактивный слой.

---

## 13. JSON-LD для карт

Базовый граф:

```text
Organization
WebSite
WebPage
BreadcrumbList
LearningResource или CreativeWork
Dataset, если данные route.json публичны
ItemList мест
```

Пример направления:

```json
{
  "@context": "https://schema.org",
  "@type": "LearningResource",
  "@id": "https://gospod-bog.ru/karty/avraam/#learning",
  "name": "Путь Авраама: интерактивная библейская карта",
  "inLanguage": "ru",
  "learningResourceType": "Interactive map",
  "about": ["Авраам", "Книга Бытия", "Библейская география"]
}
```

---

## 14. Доступность карт

Цель: WCAG 2.2 AA насколько возможно для интерактивной карты.

Обязательные пункты:

```text
[ ] все кнопки имеют aria-label
[ ] маркеры доступны с клавиатуры
[ ] Enter/Space открывает место
[ ] Esc закрывает панель/модалки
[ ] стрелки переключают места/этапы
[ ] +/- управляют зумом
[ ] есть кнопка «показать всё»
[ ] drag имеет альтернативу через кнопки/список мест
[ ] touch targets минимум 24px, лучше 40–44px
[ ] prefers-reduced-motion отключает кино-анимации
[ ] цвет не единственный способ передать уверенность/тип
[ ] есть текстовый transcript
```

---

## 15. Производительность карт

Цели:

```text
LCP ≤ 2.5s
INP ≤ 200ms
CLS ≤ 0.1
```

Практики:

- не грузить MapApp до видимости (`client:visible` в Astro);
- сначала отдавать статический transcript;
- SVG-фильтры отключать на слабых устройствах;
- избегать тяжёлого blur/turbulence на mobile;
- tooltip/card позиционировать через requestAnimationFrame;
- не пересчитывать layout на каждом pointermove;
- данные route.json кешировать;
- общий map-engine кешировать между картами;
- images/OG оптимизировать в WebP/AVIF.

---

## 16. Фазы развития карт

### Фаза A — стабилизация Авраама

```text
[ ] не копировать index.html
[ ] описать route schema
[ ] вынести PLACES/STAGES/LIFE в route.draft.json
[ ] добавить sourceIds
[ ] добавить certainty
[ ] добавить lat/lon где возможно
[ ] добавить transcript
[ ] улучшить keyboard accessibility
```

### Фаза B — общий движок

```text
karty/_shared/map-engine.js
karty/_shared/map.css
karty/_shared/base-geo.svg
karty/_shared/route.schema.json
```

### Фаза C — вторая карта

Лучший кандидат: `/karty/ishod/`.

Почему:

- другой региональный фокус: Египет/Синай/Моав;
- много спорных маршрутов;
- сразу проверит, выдерживает ли архитектура варианты/гипотезы.

### Фаза D — Astro integration

После общего рефакторинга:

```text
src/content/maps/avraam.json
src/components/react/MapApp.tsx
src/components/MapTranscript.astro
src/pages/karty/[slug].astro
```

### Фаза E — сравнение маршрутов

```text
/karty/sravnenie/
```

Фичи:

- Авраам + Лот;
- варианты Исхода;
- путешествия Павла 1/2/3;
- разные гипотезы Содома.

### Фаза F — Atlas/GIS mode

Только если появится реальная необходимость:

```text
/atlas/
MapLibre + PMTiles + vector tiles
```

---

## 17. Leaflet demo в будущем

Leaflet может рендерить GeoJSON export:

```js
L.geoJSON(routeGeoJson, {
  style: feature => ({
    color: feature.properties.certainty === 'high' ? '#e8c879' : '#9b8cf0',
    dashArray: feature.properties.certainty === 'disputed' ? '4 6' : null
  },
  onEachFeature: (feature, layer) => {
    layer.bindPopup(feature.properties.name);
  }
}).addTo(map);
```

Это не основной режим, а полезный инструмент проверки.

---

## 18. MapLibre demo в будущем

MapLibre может рендерить те же данные как source/layers:

```js
map.addSource('places', { type: 'geojson', data: placesGeoJson });
map.addLayer({
  id: 'places-circle',
  type: 'circle',
  source: 'places',
  paint: {
    'circle-color': [
      'match', ['get', 'certainty'],
      'high', '#e8c879',
      'disputed', '#9b8cf0',
      '#c9b186'
    ]
  }
});
```

Это пригодится, если появится полноценный библейский GIS-атлас.

---

## 19. Что НЕ делать

```text
❌ копировать /karty/avraam/index.html под /karty/ishod/
❌ делать все маршруты на одной SEO-странице
❌ зашивать топонимы эпохи в base-geo
❌ использовать MapLibre только потому, что «WebGL современнее»
❌ выносить всё в React без transcript
❌ хранить спорные локализации без certainty/sourceIds
❌ делать карты без keyboard accessibility
```

---

## 20. Первые практические задачи

1. Создать этот документ.
2. Расширить `docs/MAPS-ARCHITECTURE.md` ссылкой на это исследование.
3. Создать `karty/_shared/route.schema.json`.
4. Создать `karty/avraam/route.draft.json`.
5. Перенести туда `PLACES`, `STAGES`, `LAYERS`, `LIFE`.
6. Добавить `certainty` и `sourceIds`.
7. Добавить `geo.lat/lon` для мест, где это возможно.
8. Сделать генератор `MapTranscript`.
9. Сделать `GeoJSON export` скрипт.
10. Только потом начинать `/karty/ishod/`.

---

## 21. Источники и ориентиры, июнь 2026

- Leaflet 2.0 alpha discussion: https://github.com/Leaflet/Leaflet/discussions/9719
- Leaflet docs/API: https://leafletjs.com/reference.html
- MapLibre style spec — sources/layers: https://maplibre.org/maplibre-style-spec/sources/
- MapLibre Leaflet migration guide: https://maplibre.org/maplibre-gl-js/docs/guides/leaflet-migration-guide/
- Protomaps PMTiles + MapLibre: https://docs.protomaps.com/pmtiles/maplibre
- MDN SVG `vector-effect`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/vector-effect
- WCAG 2.2 overview: https://www.w3.org/TR/WCAG22/
- web.dev Web Vitals: https://web.dev/articles/vitals

---

## 22. Итог

Карты должны развиваться отдельно от общего рефакторинга сайта.

Решение:

```text
Сейчас: custom SVG оставить
Срочно: вынести данные в route.json
На будущее: единый map engine + JSON schema + GeoJSON export
SEO: transcript обязателен
Доступность: keyboard + no-drag alternatives
Leaflet: вспомогательный preview
MapLibre: будущий GIS/atlas mode, не сейчас
```

Так мы сохраняем уникальный визуал и одновременно строим фундамент, который выдержит Авраама, Моисея, Давида, Павла, эпохи и сравнение маршрутов.
