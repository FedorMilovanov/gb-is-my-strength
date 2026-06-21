# Полное исследование интерактивных систем сайта `gb-is-my-strength`

**Дата:** 2026-06-20  
**Объект:** `https://github.com/FedorMilovanov/gb-is-my-strength`  
**Зоны аудита:**

1. `/rodosloviye/` — интерактивное родословие от Адама до Христа.
2. `/karty/` — интерактивные 2D SVG/редакционные библейские карты.
3. `/karty/avraam/` — карта Авраама как текущий пилот.
4. Остальные карты: `ishod`, `pavel`, `melachim`, `maccabim`, `shoftim`, `shvatim`, `yeshua`, `early-church`, `revelation`.
5. `/map/` — карта связей сайта.
6. Общая стратегия движков: React Flow, ELK, D3, SVG/Canvas, Leaflet, MapLibre, Sigma.js/Graphology.

---

## 0. Короткий итог для владельца

Главный вывод: **данные сохранять, визуально-интерактивные оболочки пересобирать модульно**.

Не надо “сносить всё”. Но опасно продолжать “нанизывать” новые фичи прямо на существующие крупные компоненты/HTML/JS-комбайны.

### Решение по разделам

| Раздел | Текущее состояние | Что делать | Движок |
|---|---|---|---|
| `/rodosloviye/` | смысловая модель хорошая, визуальный слой корявый/монолитный | пересобрать визуал и layout pipeline, данные оставить | React Flow + ELK, D3 только утилитарно |
| `/karty/` hub | правильный принцип: 1 карта открыта, 9 на аудите | сохранить audit-gate, усилить статусы и visual QA | Astro/HTML каталог |
| `/karty/avraam/` | лучший пилот, богатые данные, но архитектурно тяжёлый | не удалять; доводить и мигрировать на MapEngine v2 | MapEngine v2 SVG/Canvas |
| Остальные `/karty/*/` | данные есть, визуал снят с витрины/кривой | страницы пересобрать заново на общем движке, route.json сохранить | MapEngine v2 |
| `/map/` | заявлена большая карта, фактически похоже на демо/заглушку | переписать с нуля на data-driven графе | Sigma.js + Graphology |

---

## 1. Что подтверждено по текущему репозиторию

### 1.1. Стек сайта

README проекта фиксирует текущий production-подход: GitHub Pages публикует Astro/strangler `dist/`, старые HTML/CSS/JS в корне остаются как rollback/source layer, а runtime стек описан как статический HTML + handcrafted CSS + vanilla JS, при этом React не является общим runtime-стеком сайта, кроме изолированных мест. Это важно: интерактивы должны быть “островами”, а не превращать весь сайт в SPA.

Источник:  
`https://github.com/FedorMilovanov/gb-is-my-strength`  
`README.md`, раздел “Стек и хостинг”.

### 1.2. Обязательное правило для агентов

`AGENTS.md` прямо задаёт дисциплину: агент обязан читать этот файл до правок, а нарушения трактуются как регресс. Для будущего рефакторинга это критично: никакой агент не должен “быстро поправить CSS” в интерактивной карте без понимания контракта сайта.

Источник:  
`https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/AGENTS.md`

### 1.3. Раздел `/karty/`

`karty/index.html` уже содержит правильную редакционную политику:

- открыта 1 карта;
- 9 карт на аудите;
- 0 черновиков на витрине;
- недоведённые карты не показываются как готовые материалы;
- перед возвратом нужны initial viewport, label collision, desktop/mobile, слои/controls, читаемость маршрута, owner review.

Это надо сохранить как принцип “премиальной витрины”, а не откатывать к “всё показываем, что технически собирается”.

Источник:  
`https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/index.html`

### 1.4. `route.json`-контракт карт

`karty/_shared/README.md` фиксирует базовый контракт карт: `meta`, `stories`, `places`, `stages`, optional `ctx`, `verified_waypoints`, `scientific_variants`, а также API `MapEngine.loadRoute`, `validateRoute`, `createMap`, `flyTo`, `openPlace`, `setStory`, `startTour`, `shareURL`, `destroy`.

Источник:  
`https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/_shared/README.md`

### 1.5. Схема route.json

`route.schema.json` использует JSON Schema draft 2020-12 и требует `meta`, `stories`, `places`, `stages`. В `places` сейчас обязательны `id`, `name`, `x`, `y`, `type`, `stage`. Это подтверждает, что текущие карты в основном редакционно-планарные, а не настоящие lat/lng GIS-карты.

Источник:  
`https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/_shared/route.schema.json`

### 1.6. Карта Авраама

`karty/avraam/route.json` — богатый источник истины: meta version 2.0, 19 мест, 8 этапов, 5 историй, 7 context points, 40 фото, 59 стихов, 5 verified waypoints, 45 scientific variants. Это не надо выбрасывать.

Источник:  
`https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/avraam/route.json`

### 1.7. Остальные карты

Например, `karty/ishod/index.html` и `karty/pavel/index.html` сейчас являются страницами визуального аудита: “карта временно снята с публичного просмотра”. Это правильно: данные могут существовать, но публичный статус должен быть заблокирован до визуального уровня Авраама.

Источники:  
`https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/ishod/index.html`  
`https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/pavel/index.html`

### 1.8. Старый MapEngine

`karty/_engine/map-engine.js` — самодостаточный MapEngine, без framework dependency, с API load/validate/createMap/openPlace/setStory/tour/flyTo/destroy. Но он уже крупный и смешивает всё: data layer, rendering, styles, events, panels, tour, archaeology references, story focus, DOM creation. Это опасная зона монолита.

Источник:  
`https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/_engine/map-engine.js`

Дополнительно `karty/_engine/modules/README.md` прямо говорит, что прежняя модульная реорганизация сломала Авраама и потребовала восстановительных коммитов, а `map-engine.js` был оставлен самодостаточным. Это важное предупреждение: новый рефакторинг нельзя делать как хаотичное “распилить ради распила”. Нужен shadow-mode, тесты и постепенная миграция.

Источник:  
`https://github.com/FedorMilovanov/gospod-bog/tree/main/karty/_engine/modules`

### 1.9. Валидаторы карт

`validate-map-routes.js` уже проверяет meta, viewport, places, stages, stories, duplicate ids, координаты, photos, scientific_variants, signature, stats и логику витрины. Это хороший базовый guard, его надо не удалять, а расширять.

Источник:  
`https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/scripts/validate-map-routes.js`

### 1.10. Родословие

`GenealogyTree.tsx` уже содержит сильные идеи: React Flow canvas, поиск, фильтры, золотая нить, SplitView, semantic zoom, focus lineage, keyboard nav, tour. Но это всё смешано в одном компоненте и окрашено в тёмно-золотую inline-стилистику. Это не надо чинить “поверх” — нужен модульный refactor.

Источник:  
`https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/src/components/genealogy/GenealogyTree.tsx`

`layout.ts` использует `@dagrejs/dagre`, строит golden path, AM positioning и focus lineage. Dagre подходит как быстрый tree layout, но для твоей богословской карты с группами, эпохами, боковыми ветвями, Матфеем/Лукой и спорными узлами лучше ELK-first.

Источник:  
`https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/src/components/genealogy/layout.ts`

### 1.11. Карта связей сайта `/map/`

`map/index.html` заявляет “42 страницы · 180+ связей · 7 тематических кластеров”, но raw-файл сейчас выглядит как очень короткий документ/заглушка. Такой раздел нельзя наращивать вручную: нужен data-driven graph JSON и отдельный графовый движок.

Источник:  
`https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/map/index.html`

---

## 2. Сравнение движков и технологий

### 2.1. Родословие: React Flow + ELK, не чистый D3

React Flow уже используется в проекте и подходит для node-based interactive diagrams. Официальная документация React Flow называет Dagre простым layouting-решением для directed graphs с минимальной конфигурацией, а ELK — более сложным и гораздо более настраиваемым layout engine.

Источники:  
`https://reactflow.dev/learn/layouting/layouting`  
`https://reactflow.dev/examples/layout/elkjs`

React Flow также уже содержит встроенные MiniMap/Controls/Background/Panel и имеет поддержку keyboard/screen-reader accessibility: nodes/edges keyboard-focusable, Enter/Space selection, Escape clear, autoPanOnNodeFocus, ariaLabelConfig.

Источники:  
`https://reactflow.dev/learn/advanced-use/accessibility`  
`https://reactflow.dev/learn/advanced-use/performance`

**Вывод:** для родословия не переходить на чистый D3. Использовать:

```text
Astro page
  → React island
    → React Flow canvas
      → ELK layout
        → D3 utilities only where helpful
```

D3 можно использовать точечно: шкалы AM, timeline, расчёт кривых, локальные layout’ы, анимационные interpolation. Но отдавать весь canvas D3 — риск самописного engine.

### 2.2. Библейские карты: не Leaflet/MapLibre как основа

MapLibre GL JS — TypeScript library, которая использует WebGL для интерактивных карт из vector tiles и управляет картой через style document. Это мощно, но избыточно для редакционных библейских SVG-карт, где главные требования: художественный контроль, авторские подписи, спорные зоны, карточки, туры, источники, ручная композиция.

Источник:  
`https://www.maplibre.org/maplibre-gl-js/docs/`

Leaflet — лёгкая open-source библиотека для mobile-friendly interactive maps, около 42 KB JS. Она хороша для классических tile maps, но не идеальна как основа для премиальной редакционной карты с кастомной подложкой, SVG-лейблами и спорными локализациями.

Источник:  
`https://leafletjs.com/`

D3 `geoPath` умеет брать GeoJSON geometry/feature и генерировать SVG path или рендерить в Canvas. Это идеально как географический utility-layer, но не как весь продуктовый MapEngine.

Источник:  
`https://d3js.org/d3-geo/path`

Panzoom поддерживает SVG напрямую, touch/pinch gestures и mobile/desktop. Это хороший кандидат для камеры SVG-карт, если не использовать `d3-zoom`.

Источник:  
`https://github.com/timmywil/panzoom`

**Вывод:** для `/karty/` нужен собственный `MapEngine v2`, но не самописный хаос. Основа: SVG/Canvas renderer + Panzoom или d3-zoom + D3-geo utilities + route.json contract.

### 2.3. Карта сайта `/map/`: Sigma.js + Graphology

Sigma.js — современная JS-библиотека для rendering/interactions network graphs в браузере; она работает вместе с Graphology, где Graphology отвечает за data model & algorithms, а Sigma — за rendering & interactions. Это ровно соответствует задаче карты связей сайта.

Источник:  
`https://www.sigmajs.org/`

Graphology — multipurpose graph object для JS/TS: directed/undirected/mixed graphs, self-loops, parallel edges, algorithms, layouts, traversal utilities, browser renderer backend.

Источник:  
`https://graphology.github.io/`

**Вывод:** `/map/` не должен использовать MapEngine карт и не должен оставаться hardcoded HTML. Его надо переписать на `site-graph.json` + Graphology + Sigma.js.

---

## 3. Архитектурные решения по каждому разделу

## 3.1. `/rodosloviye/`: родословие

### Вердикт

**Данные и типы сохранить. Визуал и структуру компонента пересобрать.**

### Почему

Текущий `GenealogyTree.tsx` уже имеет хорошие фичи, но компонент делает слишком много сразу:

- хранит state;
- строит layout;
- фильтрует nodes/edges;
- содержит search logic;
- содержит focus logic;
- содержит keyboard nav;
- рендерит toolbar/sidebar/tour/detail;
- держит inline styles;
- смешивает тёмную тему с логикой.

Это создаёт будущий рефакторинг неизбежным. Лучше сделать controlled refactor сейчас.

### Новая структура

```text
src/components/genealogy/
  GenealogyTree.tsx              # orchestration/state only
  GenealogyCanvas.tsx            # React Flow canvas
  GenealogyToolbar.tsx           # поиск, фильтры, режимы
  GenealogySidebar.tsx           # эпохи, легенда
  GenealogyMinimapPanel.tsx      # миникарта/навигация
  PersonNode.tsx                 # визуал узла
  PersonDetailPanel.tsx          # карточка человека
  SplitView.tsx                  # Матфей/Лука
  TourPanel.tsx                  # пошаговый обзор
  Legend.tsx                     # условные обозначения
  TimelineAxis.tsx               # AM шкала
  layout/
    graphModel.ts                # normalize persons -> semantic graph
    visibleGraph.ts              # filters/search/focus/semantic zoom
    elkLayout.ts                 # primary layout
    dagreLayout.ts               # fallback/simple layout
    d3Timeline.ts                # optional D3 utilities
  theme/
    tokens.ts
    lineage.ts
    eras.ts
  utils/
    search.ts
    focus.ts
    validateGenealogy.ts
```

### Движок

- React Flow оставить.
- ELK сделать основным layout engine.
- Dagre оставить fallback.
- D3 использовать только для timeline/scale/local geometry.

### Визуальная система

Светлая тема как основная:

| Смысл | Цвет/стиль |
|---|---|
| Мессианская линия | old gold |
| Матфей | royal purple |
| Лука | teal/blue |
| Заветная линия / патриархи | olive green |
| Каинова линия | muted rust |
| Боковые ветви | warm gray |
| Спорные места | amber dotted + ? |
| Женские фигуры | terracotta side accent, not “pink branch” |

### Обязательные фичи

1. Общая карта.
2. Светлая тема.
3. Эпохи как sidebar и/или soft bands.
4. Миникарта.
5. Фильтры линий.
6. Поиск с состоянием `Найдено: Давид`.
7. Фокус ветви: `Фокус: линия Давида`, `Сбросить фокус`.
8. Semantic zoom:
   - overview: Адам, Ной, Авраам, Давид, Христос;
   - key: ключевые роли + disputed;
   - details: все имена, AM, ссылки.
9. Split View: Матфей/Лука.
10. Disputed nodes UX.
11. Женские фигуры в родословии.
12. Guided tour.
13. Keyboard navigation.
14. Русские ARIA labels.
15. Mobile fallback как список/маршрут, не “впихнуть canvas”.

### Богословская точность

Критично:

- Матфей: Авраам → Давид → Соломон → цари → Иосиф → Христос.
- Лука: Адам → Ной → Авраам → Давид → Нафан → … → Мария → Христос.
- Не рисовать Луку как финальную линию через Иосифа, если текущая логика сайта ведёт через Марию.
- Ишмаил/Исав не должны визуально быть равны Исааку/Иакову по весу заветной линии.

---

## 3.2. `/karty/`: библейские карты

### Вердикт

**Сохранить route.json-контракт. Создать MapEngine v2 рядом со старым. Авраама мигрировать как пилот. Остальные карты пересобрать заново на v2.**

### Почему не чинить старое поштучно

Поштучный ремонт `index.html` каждой карты приведёт к 10 разным картам, 10 наборам багов и невозможности сделать общий visual quality gate. Текущий hub уже честно говорит: карты не должны быть на витрине без визуального аудита.

### Что делать с Авраамом

Авраам — лучший пилот и источник требований:

- данные богатые;
- 19 мест;
- 8 этапов;
- 5 историй;
- 40 фото;
- 45 scientific variants;
- есть проверочные скрипты.

Не переписывать его резко. Сделать shadow route:

```text
/karty/avraam-v2/     # dev/shadow
```

или локальный флаг:

```text
?engine=v2
```

Сначала добиться parity/улучшения, потом переключать live `/karty/avraam/`.

### Что делать с остальными картами

Для `ishod`, `pavel`, `melachim`, `maccabim`, `shoftim`, `shvatim`, `yeshua`, `early-church`, `revelation`:

- route.json сохранить;
- старые HTML/заглушки не развивать;
- подключить через общий v2 shell;
- каждую карту выпускать только после visual gate.

### MapEngine v2 структура

```text
karty/_engine/v2/
  index.ts
  types.ts
  schema.ts
  normalizeRoute.ts
  validateRoute.ts
  project.ts
  viewport.ts
  camera.ts
  layers.ts
  labels.ts
  labelCollision.ts
  paths.ts
  markers.ts
  stories.ts
  tour.ts
  panel.ts
  photos.ts
  sources.ts
  accessibility.ts
  keyboard.ts
  shareState.ts
  renderers/
    svgRenderer.ts
    canvasRenderer.ts
  themes/
    premiumLight.ts
    premiumDark.ts  # позже, не обязательно сейчас
```

### Data pipeline

```text
route.json
  → schema validation
  → normalizeRoute
  → projection / planar coordinates
  → layer model
  → label placement / collision
  → render SVG/Canvas
  → bind interactions
  → sync URL hash
  → expose public API
```

### Schema v2 extensions

Добавить optional-поля, не ломая старые карты:

```json
{
  "geo": { "lat": 0, "lng": 0 },
  "coord_confidence": "certain | probable | disputed | symbolic",
  "localization_status": "consensus | candidate | alternative | rejected | unknown",
  "label": {
    "dx": 0,
    "dy": 0,
    "anchor": "n | ne | e | se | s | sw | w | nw | auto",
    "priority": 1,
    "minZoom": 0.5,
    "maxZoom": 4
  },
  "render": {
    "layer": "main | context | disputed | route | background",
    "priority": 1,
    "icon": "settlement | city | mountain | river | battle | temple",
    "variant": "default | muted | candidate | verified"
  },
  "variants": [
    {
      "id": "north-ur",
      "title": "Северный Ур",
      "status": "candidate",
      "geo": { "lat": 0, "lng": 0 },
      "x": 0,
      "y": 0,
      "note": "...",
      "sources": []
    }
  ]
}
```

### Label engine

Обязателен. Без него карты опять будут кривые.

Требования:

- у каждой подписи `priority`;
- у каждой подписи preferred anchors;
- при collision пробовать fallback anchors;
- при collision с главным label скрывать низкоприоритетный;
- для спорных/плотных зон использовать leader lines;
- на дальнем зуме показывать только главные labels;
- на mobile labels ещё более агрессивно упрощать;
- visual audit должен ловить overlap.

### Слои карт

Обязательные слои v2:

1. base geography;
2. waters;
3. regions;
4. roads/routes;
5. main route;
6. story route;
7. verified waypoints;
8. disputed candidates;
9. context points;
10. labels;
11. active/focus overlay;
12. photo markers;
13. source markers;
14. route signature overlay.

### Semantic zoom карт

| Зум | Что видно |
|---|---|
| far | регионы, море/реки, 3–5 главных мест, общий маршрут |
| mid | этапы, основные города, story highlights |
| close | все места, альтернативы, фото, источники, мелкие подписи |
| focus | активный story/stage яркий, остальное приглушено |

### Mobile mode

На телефоне не пытаться показать всё как desktop.

Нужно:

- full-screen map;
- bottom sheet для места;
- крупные controls;
- swipe между этапами;
- collapsed legend;
- route list fallback;
- “поверните экран” допустимо только как подсказка, не как единственный UX.

---

## 3.3. `/map/`: карта связей сайта

### Вердикт

**Переписать с нуля. Не чинить текущий `/map/index.html` поверх.**

### Почему

`/map/index.html` заявляет крупную карту: 42 страницы, 180+ связей, 7 кластеров. Но структура raw-файла выглядит как короткий static/shadow-документ. Такой раздел должен строиться из данных сайта, а не из вручную захардкоженного HTML.

### Новый стек

```text
site-graph.json
  → Graphology model
  → layout positions
  → Sigma.js render
  → filters/search/focus/neighborhood
```

### Data model

```json
{
  "nodes": [
    {
      "id": "gill-part-1",
      "title": "Джон Гилл: человек",
      "url": "/.../",
      "type": "article | series | map | landing | biography | hard-text | resource",
      "cluster": "john-gill",
      "tags": ["..."],
      "weight": 3,
      "updated": "2026-06-20",
      "summary": "..."
    }
  ],
  "edges": [
    {
      "source": "gill-part-1",
      "target": "gill-part-2",
      "type": "series | internal-link | thematic | scripture | map-related | reference",
      "weight": 2,
      "reason": "части одной серии"
    }
  ],
  "clusters": [
    {
      "id": "john-gill",
      "label": "Джон Гилл",
      "color": "#...",
      "description": "..."
    }
  ]
}
```

### Источники graph data

- sitemap/public route contract;
- `data/search-manifest.json` если есть;
- `data/series.json`;
- MDX frontmatter;
- internal links из HTML/MDX;
- curated edges file `data/site-graph-curated.json`;
- карты `/karty/*/route.json`;
- родословие `/rodosloviye/` как отдельный node;
- ручные curated thematic edges.

### Фичи `/map/`

1. Search.
2. Filter by cluster.
3. Filter by type.
4. Focus node.
5. Neighborhood mode.
6. Edge explain: “Почему связаны?”.
7. Path finding между двумя материалами.
8. Related materials panel.
9. Cluster legend.
10. Stable layout.
11. URL hash state.
12. Mobile fallback list.
13. Build-time validation.
14. Counts sync: если написано 42/180+, graph JSON должен реально иметь эти числа.

---

## 4. Техническая стратегия миграции

## Phase 0. Заморозка и baseline

1. Не добавлять новые фичи в старый `map-engine.js`, кроме критических багфиксов.
2. Снять screenshots baseline для:
   - `/karty/`
   - `/karty/avraam/`
   - `/karty/ishod/`
   - `/karty/pavel/`
   - `/map/`
   - `/rodosloviye/`
3. Зафиксировать current audit status.
4. Проверить `npm run maps:validate`.
5. Проверить `npm run smoke:maps` и `npm run smoke:maps:mobile`, если применимо.

## Phase 1. Данные и схемы

1. Расширить `route.schema.json` optional-полями v2.
2. Не ломать старые route.json.
3. Добавить `scripts/validate-map-routes-v2.js`.
4. Добавить `scripts/validate-genealogy-data.js`.
5. Добавить `scripts/build-site-graph.js`.
6. Добавить `scripts/validate-site-graph.js`.

## Phase 2. MapEngine v2 shadow

1. Создать `karty/_engine/v2/`.
2. Сделать `avraam-v2` shadow page.
3. Подключить только `avraam/route.json`.
4. Реализовать:
   - renderer;
   - camera;
   - layers;
   - labels;
   - panel;
   - tour;
   - hash state;
   - a11y.
5. Сравнить визуально с текущим Авраамом.
6. Переключать live только после качества выше текущего.

## Phase 3. Родословие v2

1. Разбить `GenealogyTree.tsx`.
2. Перейти на light design system.
3. Внедрить ELK.
4. Проверить Матфей/Лука.
5. Проверить semantic zoom.
6. Проверить focus/search/tour/mobile.
7. Добавить accessibility.

## Phase 4. Остальные карты

Порядок:

1. `ishod` — потому что много спорных маршрутов и нужен хороший disputed UX.
2. `pavel` — потому что нужны маршруты, море, этапы, possibly timeline.
3. `melachim` — царства/разделение.
4. `shoftim` — циклы судей.
5. `shvatim` — распределение колен.
6. `yeshua` — служение Иисуса.
7. `early-church`.
8. `maccabim`.
9. `revelation`.

Каждую карту возвращать на витрину только после owner review.

## Phase 5. `/map/` rewrite

1. Build `site-graph.json`.
2. Подключить Graphology.
3. Подключить Sigma.js.
4. Сделать stable layout.
5. Добавить filters/search/focus.
6. Добавить edge explain.
7. Добавить mobile fallback.
8. Удалить hardcoded demo.

---

## 5. Quality Gates

## 5.1. Общие gates

- `npm run strangler:deploy-readiness`
- `npm run visual:parity:production`
- `npm run owner:ui-guard`
- `npm run maps:validate`
- `npm run smoke:maps`
- `npm run smoke:maps:mobile`

## 5.2. Карты `/karty/*`

Обязательные проверки:

1. route schema valid;
2. no duplicate ids;
3. all story places exist;
4. all stage indexes valid;
5. all photos have alt;
6. all scientific variants have title/status/detail;
7. stats match actual data;
8. initial viewport correct;
9. no label collision desktop;
10. no label collision mobile;
11. tour works;
12. place panel works;
13. hash state works;
14. keyboard works;
15. reduced motion works;
16. source links safe;
17. no page errors;
18. screenshot baseline accepted;
19. owner review passed.

## 5.3. Родословие

1. Все ids валидны.
2. father/mother/children/spouse указывают на существующие ids.
3. Нет неожиданных циклов.
4. Матфей/Лука соответствуют богословской логике сайта.
5. Semantic zoom работает.
6. Search centers and highlights node.
7. Focus dims unrelated nodes.
8. Split view readable.
9. Disputed markers accessible.
10. Женские фигуры видны.
11. Keyboard navigation works.
12. Mobile fallback works.
13. React Flow performance: memoized nodes/components/callbacks.

## 5.4. Карта сайта `/map/`

1. node count matches displayed stat;
2. edge count matches displayed stat;
3. all node URLs exist;
4. no orphan nodes unless marked intentionally;
5. all edge source/target exist;
6. all clusters have labels/colors;
7. search finds every public route;
8. filter empty state works;
9. graph positions stable;
10. mobile fallback works;
11. no hardcoded demo data in HTML.

---

## 6. ТЗ для агента

```md
# AGENT TASK — Interactive Systems Architecture Refactor

Перед началом прочитать:
- AGENTS.md
- README.md
- karty/_shared/README.md
- karty/_shared/route.schema.json
- karty/_engine/map-engine.js
- karty/_engine/modules/README.md
- karty/avraam/route.json
- karty/avraam/index.html
- scripts/validate-map-routes.js
- src/components/genealogy/*
- data/genealogy/genealogy.json
- map/index.html

## Главный принцип

Не удалять данные. Не чинить визуал костылями поверх старых монолитов. Создать новую модульную архитектуру рядом со старой, мигрировать через shadow routes и audit gates.

## Родословие `/rodosloviye/`

Решение:
- оставить React Flow;
- внедрить ELK как основной layout engine;
- Dagre оставить fallback;
- D3 разрешён только как utility layer;
- пересобрать светлую дизайн-систему;
- разбить GenealogyTree.tsx на модули.

Обязательные фичи:
- светлая тема;
- semantic colors;
- Матфей через Иосифа;
- Лука через Марию;
- semantic zoom;
- search state;
- focus state;
- split view;
- disputed node UX;
- женские фигуры;
- guided tour;
- mobile fallback;
- ARIA labels.

## Карты `/karty/`

Решение:
- route.json сохранить;
- старый MapEngine не раздувать;
- создать `karty/_engine/v2`;
- Авраама мигрировать как пилот;
- остальные карты пересоздать на v2;
- не выпускать карту на витрину без visual audit.

MapEngine v2 должен иметь:
- validate/normalize route;
- project coordinates;
- layer model;
- label engine;
- collision avoidance;
- semantic zoom;
- Panzoom or d3-zoom camera;
- place panel;
- tour;
- stories;
- hash state;
- mobile bottom sheet;
- accessibility.

## Карта сайта `/map/`

Решение:
- переписать с нуля;
- создать build-time `site-graph.json`;
- использовать Graphology + Sigma.js;
- убрать hardcoded demo;
- counts must match data.

## Запрещено

- Не писать новый 2000-line HTML.
- Не хранить nodes/edges прямо в `/map/index.html`.
- Не править все карты поштучно.
- Не смешивать движок `/karty/` и `/map/`.
- Не переводить родословие на чистый D3.
- Не добавлять новые визуальные фичи без screenshot/audit gate.
```

---

## 7. Финальный вывод

### Что сохранять

- Все `route.json`.
- `karty/avraam/route.json` как эталонный богатый dataset.
- `validate-map-routes.js` и идею `avraam-map-audit.js`.
- Данные родословия и типы.
- React Flow для родословия.
- Принцип `/karty/`: только проверенные карты на витрине.

### Что переписывать

- Визуальную систему родословия.
- Layout pipeline родословия.
- MapEngine как v2 рядом со старым.
- Все непроверенные карты как страницы на едином v2 shell.
- `/map/` как data-driven graph.

### Что не делать

- Не уходить в чистый D3 для всего.
- Не выбирать Leaflet/MapLibre как основной движок редакционных SVG-карт.
- Не чинить старые карты индивидуальными CSS/HTML-патчами.
- Не “подкрашивать” старый тёмный визуал родословия.
- Не публиковать карты без owner review.

### Точка будущего качества

После рефакторинга сайт должен иметь три разные, но согласованные интерактивные системы:

1. **Родословие** — богословская knowledge-map система: React Flow + ELK.
2. **Библейские карты** — редакционные SVG/Canvas карты: MapEngine v2.
3. **Карта сайта** — network graph всех материалов: Sigma.js + Graphology.

Это уменьшит риск будущих больших рефакторингов: у каждого раздела будет свой правильный движок, свой data contract и свои quality gates.

---

## 8. Источники

### Репозиторий

- GitHub repo: `https://github.com/FedorMilovanov/gb-is-my-strength`
- README: `https://github.com/FedorMilovanov/gb-is-my-strength`
- AGENTS.md: `https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/AGENTS.md`
- karty index: `https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/index.html`
- route shared README: `https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/_shared/README.md`
- route schema: `https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/_shared/route.schema.json`
- MapEngine: `https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/_engine/map-engine.js`
- MapEngine modules README: `https://github.com/FedorMilovanov/gospod-bog/tree/main/karty/_engine/modules`
- Abraham route: `https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/avraam/route.json`
- Ishod placeholder: `https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/ishod/index.html`
- Pavel placeholder: `https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/karty/pavel/index.html`
- map index: `https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/map/index.html`
- GenealogyTree: `https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/src/components/genealogy/GenealogyTree.tsx`
- genealogy layout: `https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/src/components/genealogy/layout.ts`
- validate maps: `https://raw.githubusercontent.com/FedorMilovanov/gospod-bog/main/scripts/validate-map-routes.js`

### Технологии

- React Flow layouting: `https://reactflow.dev/learn/layouting/layouting`
- React Flow ELK example: `https://reactflow.dev/examples/layout/elkjs`
- React Flow performance: `https://reactflow.dev/learn/advanced-use/performance`
- React Flow accessibility: `https://reactflow.dev/learn/advanced-use/accessibility`
- D3 geoPath: `https://d3js.org/d3-geo/path`
- MapLibre GL JS docs: `https://www.maplibre.org/maplibre-gl-js/docs/`
- Leaflet: `https://leafletjs.com/`
- Panzoom: `https://github.com/timmywil/panzoom`
- Sigma.js: `https://www.sigmajs.org/`
- Graphology: `https://graphology.github.io/`
- Mapshaper GeoJSON/TopoJSON notes: `https://mapshaper.org/docs/formats/geojson.html`
