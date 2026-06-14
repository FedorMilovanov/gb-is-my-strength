# Карты + будущий React/Astro/движок сайта — дорожная карта рефакторинга

Дата: 2026-06-12  
Статус: черновик стратегии, не техническое ТЗ для немедленного переписывания.

## 0. Главный вывод

Текущий сайт — статический HTML-проект с сильной ручной оптимизацией, SEO и аудит-скриптами. Раздел `/karty/avraam/` уже является мини-приложением. Его нельзя просто копировать под новые карты: при второй карте нужно вынести общий движок и данные.

Для всего сайта не стоит делать резкий rewrite. Правильная стратегия: **strangler migration** — новый генератор/React-слой живёт рядом со старым HTML, страницы переводятся партиями, URL остаются прежними, CI сравнивает результат.

## 1. Leaflet / MapLibre / custom SVG: когда что выбирать

### 1.1 Custom SVG, текущий путь

Лучший выбор для стилизованного библейского атласа:

- художественная карта, а не современная GIS-карта;
- мало объектов;
- важны подписи, иврит/греческий, маршруты, источники, кинотур;
- автономность, отсутствие внешних тайлов;
- полный контроль над эстетикой.

Минусы:

- свой pan/zoom/keyboard/accessibility;
- свои координаты и проекция;
- сложнее подключать реальные GIS-данные.

### 1.2 Leaflet

Leaflet хорош, если нужна простая настоящая карта с raster tiles, markers, popups, GeoJSON.

Плюсы:

- простая API;
- лёгкий порог входа;
- много плагинов;
- отлично для маркеров, простых линий и оверлеев;
- можно использовать `L.CRS.Simple` для негеографической/рисованной карты;
- можно класть свою SVG/PNG-подложку как imageOverlay/svgOverlay.

Минусы:

- по умолчанию это мир Web Mercator/тайлов, а не «старинный атлас»;
- векторные тайлы не основная модель;
- сложные стили и 3D не его сильная сторона;
- для глубокой кастомизации всё равно начнутся плагины.

### 1.3 MapLibre GL JS

MapLibre хорош, если нужна современная WebGL-карта:

- vector tiles;
- динамические стили по данным;
- pitch/bearing/rotation;
- globe/terrain/3D;
- много объектов;
- будущий GIS-режим.

Плюсы:

- стиль как JSON spec;
- sources/layers/filter/expressions;
- WebGL;
- vector tiles/PMTiles;
- сильная база для большого интерактивного атласа.

Минусы:

- тяжелее по JS и GPU;
- хуже для «тонкой рукописной» SVG-эстетики;
- нужна инфраструктура tiles/style/glyphs/sprites;
- сложнее accessibility;
- в статическом духовно-контентном сайте может быть оверкилл.

## 2. HTML-примеры

### 2.1 Leaflet: современная OSM-карта + маршрут Авраама

```html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Leaflet demo — Путь Авраама</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { height: 100%; margin: 0; }
    .place-label { font: 600 13px system-ui; color: #2b2112; text-shadow: 0 1px 2px white; }
  </style>
</head>
<body>
  <div id="map" aria-label="Карта пути Авраама"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([34.8, 39.5], 5);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const places = [
      { id: 'ur', name: 'Ур Халдейский', lat: 30.962, lng: 46.103, text: 'Быт 11:28–31' },
      { id: 'harran', name: 'Харран', lat: 36.86, lng: 39.03, text: 'Быт 11:31' },
      { id: 'shechem', name: 'Сихем', lat: 32.213, lng: 35.281, text: 'Быт 12:6' },
      { id: 'hebron', name: 'Хеврон', lat: 31.532, lng: 35.099, text: 'Быт 13:18' },
      { id: 'moriah', name: 'Мория / Иерусалим', lat: 31.778, lng: 35.235, text: 'Быт 22; 2 Пар 3:1' }
    ];

    const route = places.map(p => [p.lat, p.lng]);

    L.polyline(route, {
      color: '#b88a2b',
      weight: 4,
      opacity: 0.85,
      dashArray: null
    }).addTo(map);

    places.forEach(p => {
      L.circleMarker([p.lat, p.lng], {
        radius: 7,
        color: '#6b4a10',
        weight: 2,
        fillColor: '#e8c879',
        fillOpacity: 0.95
      })
      .bindPopup(`<b>${p.name}</b><br>${p.text}`)
      .bindTooltip(p.name, { permanent: true, direction: 'top', className: 'place-label' })
      .addTo(map);
    });

    map.fitBounds(route, { padding: [40, 40] });
  </script>
</body>
</html>
```

### 2.2 Leaflet: рисованная карта как image/svg overlay

```html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Leaflet CRS.Simple — рисованная карта</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>html, body, #map { height: 100%; margin: 0; background: #070a10; }</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    // Координаты не lat/lon, а пиксели/условные единицы подложки.
    const W = 1900, H = 1430;
    const map = L.map('map', {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 2,
      zoomSnap: 0.25
    });

    const bounds = [[0, 0], [H, W]];

    // Можно подложить PNG/WebP/SVG твоей карты.
    L.imageOverlay('/karty/_shared/geo-base.webp', bounds).addTo(map);

    const places = [
      { name: 'Ур', xy: [897, 1710] },
      { name: 'Харран', xy: [220, 990] },
      { name: 'Ханаан', xy: [760, 640] }
    ];

    L.polyline(places.map(p => p.xy), { color: '#e8c879', weight: 3 }).addTo(map);

    places.forEach(p => L.marker(p.xy).bindPopup(p.name).addTo(map));

    map.fitBounds(bounds);
  </script>
</body>
</html>
```

### 2.3 MapLibre: vector style + GeoJSON route

```html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MapLibre demo — Путь Авраама</title>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css">
  <style>html, body, #map { height: 100%; margin: 0; }</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
  <script>
    const places = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { id: 'ur', name: 'Ур Халдейский' }, geometry: { type: 'Point', coordinates: [46.103, 30.962] } },
        { type: 'Feature', properties: { id: 'harran', name: 'Харран' }, geometry: { type: 'Point', coordinates: [39.03, 36.86] } },
        { type: 'Feature', properties: { id: 'shechem', name: 'Сихем' }, geometry: { type: 'Point', coordinates: [35.281, 32.213] } },
        { type: 'Feature', properties: { id: 'moriah', name: 'Мория' }, geometry: { type: 'Point', coordinates: [35.235, 31.778] } }
      ]
    };

    const route = {
      type: 'Feature',
      properties: { id: 'abraham-main' },
      geometry: {
        type: 'LineString',
        coordinates: places.features.map(f => f.geometry.coordinates)
      }
    };

    const map = new maplibregl.Map({
      container: 'map',
      style: 'https://demotiles.maplibre.org/style.json',
      center: [39.5, 34.5],
      zoom: 4,
      pitch: 0,
      bearing: 0
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }));

    map.on('load', () => {
      map.addSource('abraham-route', { type: 'geojson', data: route });
      map.addSource('abraham-places', { type: 'geojson', data: places });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'abraham-route',
        paint: {
          'line-color': '#e8c879',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2, 7, 5],
          'line-opacity': 0.9
        }
      });

      map.addLayer({
        id: 'places-circle',
        type: 'circle',
        source: 'abraham-places',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 7, 9],
          'circle-color': '#e8c879',
          'circle-stroke-color': '#0b0f16',
          'circle-stroke-width': 2
        }
      });

      map.addLayer({
        id: 'places-label',
        type: 'symbol',
        source: 'abraham-places',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 13,
          'text-offset': [0, -1.4],
          'text-anchor': 'bottom'
        },
        paint: {
          'text-color': '#f4eedd',
          'text-halo-color': '#0b0f16',
          'text-halo-width': 1.5
        }
      });

      map.on('click', 'places-circle', e => {
        const f = e.features[0];
        new maplibregl.Popup()
          .setLngLat(f.geometry.coordinates)
          .setHTML(`<b>${f.properties.name}</b>`)
          .addTo(map);
      });
    });
  </script>
</body>
</html>
```

### 2.4 MapLibre + PMTiles, если когда-нибудь нужен оффлайн/vector atlas

```js
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      atlas: {
        type: 'vector',
        url: 'pmtiles://https://gospod-bog.ru/tiles/biblical-atlas.pmtiles'
      }
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#070a10' } },
      {
        id: 'water',
        type: 'fill',
        source: 'atlas',
        'source-layer': 'water',
        paint: { 'fill-color': '#0d1d2e' }
      }
    ]
  },
  center: [35, 32],
  zoom: 5
});
```

## 3. Решение для проекта

### 3.1 Не мигрировать карты на Leaflet/MapLibre прямо сейчас

Для текущего `/karty/avraam/` custom SVG лучше. Библиотеки дадут много лишнего и ухудшат уникальную эстетику.

### 3.2 Но данные хранить так, чтобы потом можно было экспортировать в GeoJSON

Минимум:

```json
{
  "id": "ur",
  "name": "Ур Халдейский",
  "geo": { "lat": 30.962, "lon": 46.103, "confidence": "high" },
  "map": { "x": 1710, "y": 897 }
}
```

Тогда в будущем можно иметь:

- custom SVG mode;
- Leaflet demo/export;
- MapLibre GIS mode;
- static printable map.

## 4. React/движок сайта: выбор платформы

### Вариант A: Astro + React islands — рекомендуемый для этого сайта

Почему:

- сайт контентный, SEO-first;
- большинство страниц должны быть статическим HTML;
- React нужен точечно: поиск, командная палитра, карты, квизы, интерактивы;
- можно использовать MD/MDX и content collections;
- меньше JS на читателя;
- легче сохранить текущую философию сайта.

Структура:

```text
src/
  content/
    articles/*.mdx
    maps/*.json
    biographies/*.mdx
  layouts/
    BaseLayout.astro
    ArticleLayout.astro
    MapLayout.astro
  components/
    Header.astro
    Seo.astro
    MapApp.tsx
    CommandPalette.tsx
  pages/
    index.astro
    articles/[slug].astro
    karty/[slug].astro
```

### Вариант B: Next.js static export

Хорош, если сайт станет полноценным React-приложением с большим количеством app-like функций. Но для текущего проекта он тяжелее и сложнее:

- больше React runtime;
- больше решений вокруг MDX/content;
- статический экспорт требует дисциплины;
- для контентного сайта часто избыточен.

### Вариант C: Vite React SPA

Не рекомендуется как основа сайта. Хорош для отдельных приложений, но хуже для SEO-first контента.

## 5. Безопасный план миграции

### Фаза 0. Заморозить контракт текущего сайта

- Сохранить все URL.
- Сгенерировать список всех HTML страниц.
- Сохранить title/description/canonical/OG для каждой.
- Снять Lighthouse/PageSpeed baseline.
- Зафиксировать текущий sitemap/feed.

### Фаза 1. Добавить новый проект рядом, не ломая старый

```text
legacy/ или public-legacy/  — текущие HTML
src/                        — новый генератор
```

Важно: первая сборка должна выдавать тот же `/dist` или `/site`, но можно публиковать только часть новых страниц.

### Фаза 2. Вынести общие данные

- `data/series.json`
- `data/search-manifest.json`
- `data/verses.json`
- `data/maps-manifest.json`
- `karty/*/route.json`

Цель: сначала данные, потом UI.

### Фаза 3. Перевести layout, а не статьи

Сначала сделать:

- BaseLayout;
- SEO component;
- Header/Footer;
- article shell;
- typography.

Но статьи оставить HTML/MDX постепенно.

### Фаза 4. Мигрировать 3–5 страниц как пилот

Не начинать со всего сайта. Пилот:

1. `/about/`
2. `/articles/`
3. одна короткая статья;
4. `/karty/`
5. тестовая копия карты, например `/dev/karty/avraam/`.

### Фаза 5. Автоматические проверки

Обязательные проверки перед заменой страницы:

- URL совпадает;
- canonical совпадает;
- title/description не хуже;
- JSON-LD валиден;
- нет 404 на локальные ресурсы;
- sitemap содержит страницу;
- noindex не появился случайно;
- LCP/INP/CLS не хуже baseline;
- HTML transcript есть для интерактивов;
- keyboard smoke-test.

### Фаза 6. Перевод партиями

Партиями по 5–10 страниц:

- статьи одной серии;
- биографии;
- hard-texts;
- карты;
- главная последней или почти последней.

### Фаза 7. Удаление старого только после стабильного периода

Старый HTML не удалять сразу. Сначала:

- 2–4 недели параллельной проверки;
- Search Console без падений;
- лог 404 чистый;
- метрики не хуже.

## 6. Правила, чтобы не сломать SEO

- URL не менять.
- Не менять slug без 301.
- Canonical должен оставаться один-в-один.
- OpenGraph image сохранять.
- `dateModified` вести осознанно.
- Не генерировать пустые страницы.
- Не закрывать CSS/JS от индексации.
- Не делать контент только client-side.
- У интерактивов должен быть SSR/no-JS fallback.

## 7. Карты в будущей архитектуре

React-компонент карты должен получать данные:

```tsx
<MapApp
  route={routeJson}
  baseGeo={baseGeo}
  initialMode="cinema"
/>
```

Но страница должна иметь статический fallback:

```astro
<MapTranscript places={route.places} />
<MapApp client:visible route={route} />
```

То есть:

- поисковик и пользователь без JS видят содержание;
- интерактив подключается как island;
- данные типизированы и валидируются.

## 8. Ближайшие практические задачи

1. Создать `docs/MAPS_AND_REACT_REFACTOR_ROADMAP_2026.md`.
2. Расширить `docs/MAPS-ARCHITECTURE.md` стандартом route/place/source.
3. Создать `data/maps-manifest.json`.
4. Создать `karty/avraam/route.draft.json` из текущих `PLACES/STAGES/LIFE`.
5. Добавить JSON Schema для карт.
6. Добавить no-JS transcript в `/karty/avraam/`.
7. Сделать accessibility-pass по карте.
8. Только потом начинать вторую карту.

## 9. Предварительное решение

Для карт: **оставить custom SVG как основной движок**, но сделать данные совместимыми с GeoJSON.

Для всего сайта: **не чистый React SPA**. Лучше **Astro + React islands** или похожий SSG-подход: статический HTML для контента, React только там, где нужна интерактивность.
