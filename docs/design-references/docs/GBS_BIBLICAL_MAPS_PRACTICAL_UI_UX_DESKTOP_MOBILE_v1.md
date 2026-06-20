# GBS Biblical Maps — Practical UI/UX & Implementation Notes v1.0

**Дата:** 2026-06-20  
**Проект:** `gb-is-my-strength`  
**Зона:** интерактивные библейские SVG-карты `/karty/`  
**Назначение:** практичное ТЗ для агента: что брать из визуальных референсов, что не брать, как проектировать desktop/mobile, как не создать новый монолит.

---

## 0. Короткий итог

Последние визуальные варианты карт дали очень хорошее направление: **светлый библейский атлас**, SVG-картография, мягкий пергамент, чистые панели, слои, легенды, миникарта, хронология, карточки мест, route tour, источники, заметки, сравнение карт.

Но это нельзя реализовывать буквально как “один огромный SVG/HTML на карту”. Нужно сделать **единый MapEngine v2**, где каждая карта — это данные (`route.json` / `map.json`) + конфигурация слоёв + общий UI.

Главная стратегия:

- **Авраам** — оставить как эталонный пилот и довести.
- **Остальные карты** — не чинить поштучно старые HTML, а пересобрать на новом общем движке.
- **Визуалы DALL·E** — использовать как UX-референс, не как географический источник.
- **Desktop** — полноценный atlas workspace.
- **Mobile** — не “тот же desktop, только сжатый”, а отдельный маршрутный/слоевой режим с bottom sheet.

---

## 1. Что получилось хорошо в визуальных вариантах

### 1.1. Общий стиль найден

Лучшие референсы показали правильную эстетику:

- светлая пергаментная база;
- мягкая бумажная фактура;
- ясная SVG-картография;
- водоёмы в приглушённом синем;
- маршруты цветными линиями;
- регионы с мягкими заливками;
- подписи крупные, спокойные, русские;
- интерфейс как библейский атлас, а не игровая карта.

Это направление надо закрепить как **основную дизайн-систему карт**.

### 1.2. Карты стали похожи на продукт, а не на иллюстрацию

Удачные UI-паттерны:

- левый список слоёв;
- правая панель места/изучения;
- нижняя хронология;
- миникарта;
- легенда;
- переключатели маршрутов;
- карточки этапов;
- всплывающая карточка места;
- избранные карты;
- поиск;
- фильтры;
- режим сравнения;
- исследовательский режим.

Это надо переносить в настоящую систему.

### 1.3. Хорошо раскрыты разные типы карт

Нужны не одна-две карты, а семейство:

1. Атласный обзор Древнего Ближнего Востока.
2. Путешествия Авраама.
3. Исход.
4. Раздел земли по коленам.
5. Израиль и Иудея / царства.
6. Земля Иисуса / служение Христа.
7. Миссионерские путешествия Павла.
8. Иерусалим в библейские времена.
9. Сравнение карт.
10. Исследовательский режим.

Это можно сделать одной системой, если грамотно разделить data, rendering, UI.

---

## 2. Главные риски по текущим визуалам

### 2.1. Красиво, но не всегда географически точно

DALL·E создаёт убедительные карты, но:

- может неправильно размещать города;
- может путать маршруты;
- может вставлять сомнительные места;
- может смешивать эпохи;
- может писать некорректные ссылки;
- может искажать названия.

**Вывод:** визуалы — только style/UX reference. География и маршруты должны идти из проверенных данных.

### 2.2. Слишком много текста внутри картинки

На реальном сайте нельзя перегружать карту:

- большими цитатами;
- длинными справками;
- множеством вкладок одновременно;
- десятками карточек на одном экране;
- фейковыми “источниками”.

**Правило:** карта показывает слой и контекст; подробности — в панели.

### 2.3. На desktop выглядит богато, но на mobile развалится

Большинство визуалов — desktop 16:9. Их нельзя просто адаптировать CSS-ом.

Для mobile нужна отдельная UX-модель:

- full-screen map;
- bottom sheet;
- крупные касательные зоны;
- упрощённые слои;
- маршрутный режим;
- horizontal stage carousel;
- минимум одновременных панелей.

### 2.4. Риск нового монолита

Если агент начнёт переносить визуал напрямую, получится:

- один файл на 3000–6000 строк;
- inline SVG + inline CSS + inline JS;
- разные баги на каждой карте;
- невозможность исправлять все карты сразу;
- тяжёлый будущий рефакторинг.

**Запрет:** не делать отдельный кастомный HTML/JS для каждой карты.

---

## 3. Основная архитектура MapEngine v2

### 3.1. Принцип

Каждая карта должна быть:

```text
map shell
  + route/map data
  + layer configuration
  + shared renderer
  + shared UI components
```

Не так:

```text
avraam.html содержит всё
ishod.html содержит всё
pavel.html содержит всё
каждый файл живёт отдельно
```

А так:

```text
/karty/_engine/v2/
  core/
  renderers/
  layers/
  ui/
  mobile/
  themes/
  validation/

/karty/avraam/route.json
/karty/ishod/route.json
/karty/pavel/route.json
...
```

### 3.2. Suggested folder structure

```text
karty/
  _engine/
    v2/
      index.ts
      types.ts
      schema.ts

      core/
        loadMapData.ts
        normalizeMapData.ts
        validateMapData.ts
        createMapState.ts
        mapStore.ts

      projection/
        planarProjection.ts
        geoProjection.ts
        fitBounds.ts
        coordinateUtils.ts

      renderers/
        SvgMapRenderer.ts
        CanvasBaseRenderer.ts
        LabelRenderer.ts
        MarkerRenderer.ts
        RouteRenderer.ts
        RegionRenderer.ts

      layers/
        layerRegistry.ts
        layerVisibility.ts
        layerOrdering.ts
        layerStyles.ts

      labels/
        labelModel.ts
        labelCollision.ts
        labelAnchors.ts
        semanticZoomLabels.ts

      interactions/
        camera.ts
        panZoom.ts
        selection.ts
        hover.ts
        keyboard.ts
        shareState.ts

      ui/
        MapShell.tsx
        MapToolbar.tsx
        MapSidebar.tsx
        MapRightPanel.tsx
        MapLegend.tsx
        MapMiniMap.tsx
        MapTimeline.tsx
        MapStageCarousel.tsx
        MapPlacePanel.tsx
        MapLayerPanel.tsx
        MapComparePanel.tsx

      mobile/
        MobileMapShell.tsx
        MobileBottomSheet.tsx
        MobileLayerSheet.tsx
        MobileStageSheet.tsx

      themes/
        biblicalAtlasLight.ts
        biblicalAtlasDark.ts
        routeColors.ts
        mapTokens.ts

      audits/
        auditLabels.ts
        auditViewport.ts
        auditMobile.ts
        auditRouteData.ts
```

---

## 4. Desktop UX

### 4.1. Desktop layout A — Standard atlas view

Подходит для большинства карт.

```text
┌─────────────────────────────────────────────────────────────┐
│ Header: title / search / sections / actions                 │
├───────────────┬───────────────────────────────┬─────────────┤
│ Left sidebar  │ Main SVG map                  │ Right panel │
│ layers/legend │ routes, regions, labels       │ place/study │
│ filters       │ minimap, zoom, popovers       │ sources     │
├───────────────┴───────────────────────────────┴─────────────┤
│ Bottom timeline / stages / quick cards                      │
└─────────────────────────────────────────────────────────────┘
```

Использовать для:

- Авраам;
- Исход;
- Павел;
- Земля Иисуса;
- Царства;
- Колена.

### 4.2. Desktop layout B — Map-first route view

Для маршрутов, где главное — путь.

Особенности:

- карта занимает 65–75% экрана;
- слева только компактные слои;
- справа хронология/стихи;
- снизу этапы;
- popup активной точки.

Лучше для:

- Авраам;
- Исход;
- Павел;
- путь Иисуса.

### 4.3. Desktop layout C — Research mode

Для админского/глубокого режима, не обязательно публичного по умолчанию.

Особенности:

- левый тёмный/контрастный слой-набор;
- центральная карта;
- правая карточка места;
- низ: datasets, version history, notes;
- tools на карте: draw, measure, pin, text, export.

Использовать как future mode:

- для проверки карт;
- для редактора;
- для глубокого исследования.

### 4.4. Desktop layout D — Compare mode

Для сравнения двух карт или двух маршрутов.

```text
┌─────────────┬─────────────┬─────────────┐
│ Map A       │ Compare bar │ Map B       │
├─────────────┴─────────────┴─────────────┤
│ timeline / metadata / notes             │
└─────────────────────────────────────────┘
```

Фичи:

- синхронный zoom/pan;
- highlight intersections;
- “только в A”;
- “только в B”;
- различающиеся участки;
- общий inspector.

---

## 5. Mobile UX

### 5.1. Главный принцип

Mobile не должен быть уменьшенным desktop.

На телефоне одновременно можно показывать только:

- карту;
- один bottom sheet;
- один floating toolbar;
- один stage carousel.

Никаких постоянных 3 колонок.

### 5.2. Mobile layout

```text
┌────────────────────────┐
│ Top compact header      │
├────────────────────────┤
│ Fullscreen map          │
│ + zoom controls         │
│ + current layer chip    │
│ + active stage marker   │
├────────────────────────┤
│ Bottom sheet            │
│ collapsed / half / full │
└────────────────────────┘
```

### 5.3. Mobile header

Минимум:

- название карты;
- кнопка назад;
- поиск;
- слои;
- меню.

Пример:

```text
← Путешествия Авраама      🔍  ⛶  ☰
```

### 5.4. Mobile bottom sheet states

#### Collapsed

Показывает:

- активное место;
- краткий статус;
- кнопки next/previous.

```text
Рефидим · Исх. 17:1–7
Вода из скалы
[←] [Подробнее] [→]
```

#### Half

Показывает:

- описание;
- ссылки;
- действия;
- карточки связанных мест.

#### Full

Показывает:

- Писание;
- заметки;
- источники;
- медиа;
- комментарии;
- “открыть статью”.

### 5.5. Mobile route mode

Для Авраама, Исхода, Павла.

Bottom sheet должен иметь stage carousel:

```text
1 Ур → Харан
2 Харан → Ханаан
3 В Ханаане
4 Египет
5 Герар
6 Вирсавия
```

При свайпе stage:

- карта фокусируется на участке;
- активный маршрут подсвечен;
- popup обновляется;
- URL hash меняется.

### 5.6. Mobile layer sheet

Кнопка “Слои” открывает sheet:

- маршруты;
- города;
- рельеф;
- спорные участки;
- современные границы;
- фото/археология.

Не показывать все слои постоянно на экране.

### 5.7. Mobile map controls

Крупные кнопки:

- zoom in;
- zoom out;
- fit route;
- my/current focus reset;
- layers;
- active stage.

Минимальный размер касания: около 44px.

### 5.8. Mobile fallback для сложных карт

Для тяжёлых карт, например “Колена Израиля” или “Иерусалим”:

- default mobile: route/list mode;
- карта открывается full screen;
- сложные легенды скрыты в sheet;
- территории/слои переключаются крупными chips.

---

## 6. Какие фичи должны быть в MapEngine v2

### 6.1. Общие фичи

- search;
- fit route;
- fit bounds;
- focus place;
- focus stage;
- share link;
- copy current view;
- zoom controls;
- minimap;
- layer toggles;
- legend;
- selected place panel;
- scripture references;
- related articles;
- notes;
- source/citation block;
- image/media gallery;
- print/export later.

### 6.2. Layer model

Каждый слой должен иметь:

```ts
type MapLayer = {
  id: string;
  label: string;
  group: string;
  type: 'route' | 'point' | 'region' | 'label' | 'raster' | 'annotation';
  defaultVisible: boolean;
  minZoom?: number;
  maxZoom?: number;
  priority: number;
  styleToken: string;
  source?: string;
};
```

### 6.3. Route model

```ts
type RouteStage = {
  id: string;
  order: number;
  title: string;
  subtitle?: string;
  refs: string[];
  from?: string;
  to?: string;
  path: string[];
  colorToken: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  confidence: 'certain' | 'probable' | 'traditional' | 'disputed';
  description?: string;
};
```

### 6.4. Place model

```ts
type MapPlace = {
  id: string;
  name: string;
  altNames?: string[];
  type: 'city' | 'region' | 'mountain' | 'river' | 'sea' | 'site' | 'camp' | 'tribe';
  x?: number;
  y?: number;
  geo?: { lat: number; lng: number };
  refs?: string[];
  description?: string;
  sourceConfidence?: 'high' | 'medium' | 'low' | 'disputed';
  label?: {
    priority: number;
    dx?: number;
    dy?: number;
    anchor?: 'top' | 'right' | 'bottom' | 'left';
    minZoom?: number;
    maxZoom?: number;
  };
};
```

### 6.5. Disputed geography

Спорные маршруты и места должны быть не ошибкой, а нормальной фичей.

Визуально:

- пунктир;
- янтарная/фиолетовая маркировка;
- отдельная легенда;
- панель “варианты локализации”;
- предупреждение без сенсационности.

Не писать:

> “точный путь Исхода”.

Писать:

> “традиционный маршрут”, “альтернативный маршрут”, “дискуссионный участок”.

---

## 7. Semantic zoom для карт

### 7.1. Far zoom

Показывать:

- крупные регионы;
- моря;
- главные города;
- главные маршруты;
- крупные подписи.

Скрывать:

- мелкие места;
- secondary labels;
- мелкие иконки;
- длинные popup-подписи.

### 7.2. Mid zoom

Показывать:

- основные этапы;
- города;
- route arrows;
- спорные участки;
- краткие подписи.

### 7.3. Close zoom

Показывать:

- все остановки;
- мелкие места;
- источники;
- уточнённые границы;
- route details;
- локальные подписи;
- clusters.

### 7.4. Detail zoom

Показывать:

- карточки;
- micro-labels;
- археологические объекты;
- варианты локализации;
- annotations.

---

## 8. Label collision и подписи

### 8.1. Главная проблема карт

Кривые карты чаще всего ломаются не из-за маршрутов, а из-за подписей:

- подписи налезают;
- мелкие города конкурируют с крупными;
- важные места исчезают;
- на mobile всё превращается в кашу.

### 8.2. Требования к label engine

Каждая подпись должна иметь:

- priority;
- anchor;
- offset;
- minZoom;
- maxZoom;
- collision group;
- fallback anchors;
- optional leader line.

Пример:

```json
{
  "id": "jerusalem",
  "label": {
    "priority": 100,
    "anchor": "right",
    "dx": 12,
    "dy": -4,
    "minZoom": 0.3,
    "maxZoom": 5,
    "collisionGroup": "major-city"
  }
}
```

### 8.3. Правило публикации

Карта не публикуется, если:

- ключевые подписи налезают;
- маршрут закрывает названия;
- popup перекрывает главный путь;
- на mobile легенда закрывает карту;
- нет initial viewport.

---

## 9. Карта Авраама

### 9.1. Что делать

Авраам — лучший кандидат на эталон.

Не переписывать резко.

План:

1. Сохранить текущий `route.json`.
2. Использовать как pilot для MapEngine v2.
3. Добиться визуала уровня лучших референсов.
4. Убрать inline data duplication.
5. Прогнать audit.
6. Сделать desktop + mobile.
7. Только потом мигрировать остальные карты.

### 9.2. Что добавить Аврааму

- режим “по этапам”;
- карта заветных мест;
- слой “путь в Египет”;
- layer “спорные/традиционные локализации”;
- place cards: Хеврон, Мамре, Вирсавия, Шхем, Мория;
- панель “обетование”;
- timeline справа на desktop;
- bottom stage carousel на mobile.

### 9.3. Не делать

- не превращать Авраама в 5000-line custom HTML;
- не дублировать данные в JS;
- не использовать DALL·E-географию как источник;
- не делать все тексты внутри SVG.

---

## 10. Исход

### 10.1. Особенности

Карта Исхода должна прямо признавать реконструктивность маршрута.

Обязательные слои:

- традиционный маршрут;
- альтернативный маршрут;
- дискуссионные участки;
- стоянки;
- ключевые события;
- горы;
- воды;
- пустыни;
- современные границы optional;
- библейские регионы.

### 10.2. UX

Desktop:

- слева слои и легенда;
- центр карта;
- справа “изучение”: ссылки, темы, заметки;
- снизу timeline 40 лет.

Mobile:

- карта full screen;
- bottom sheet активной стоянки;
- stage carousel;
- toggle “традиционный / альтернативный” в sheet.

### 10.3. Тексты

Всегда писать осторожно:

> “маршруты частично реконструированы”.

---

## 11. Колена Израиля

### 11.1. Особенности

Это не route map, а polygon/region map.

Нужны:

- территории колен;
- города левитов;
- города убежища;
- границы колен;
- приблизительные границы;
- ключевые города;
- режим расселения;
- режим рельефа;
- карточки каждого колена.

### 11.2. Важное богословское уточнение

Левий не должен отображаться как обычный земельный удел.

Правильно:

- отдельный блок “Левиты”;
- слой “города левитов”;
- пояснение: “Господь — удел их наследия”.

### 11.3. Mobile

На mobile лучше не показывать все территории сразу с постоянной легендой.

Режим:

- список колен в bottom sheet;
- tap tribe → карта фокусируется;
- карточка колена раскрывается;
- legend in sheet.

---

## 12. Израиль и Иудея / царства

### 12.1. Особенности

Это time-period map.

Нужны:

- segmented period selector;
- unified monarchy;
- divided kingdom;
- Assyrian threat;
- Babylonian period;
- rulers/dynasties;
- prophets layer;
- trade routes;
- military events;
- archaeological finds.

### 12.2. Desktop

Лучший layout:

- top period selector;
- center political map;
- right panel dynasties/events/scripture;
- left legend/minimap;
- bottom toolbar: measure, timeline, compare periods.

### 12.3. Mobile

- top period chips horizontally scrollable;
- map;
- bottom sheet “правители / события / слои”.

---

## 13. Земля Иисуса

### 13.1. Особенности

Очень удачные визуальные идеи:

- Gospel filters: Матфей, Марк, Лука, Иоанн;
- маршруты Иисуса;
- чудеса;
- притчи;
- важные события;
- Страстная неделя;
- Jerusalem inset.

### 13.2. Риски

Не перегрузить:

- слишком много иконок у каждого места;
- все Евангелия одновременно;
- inset Jerusalem слишком большой на mobile.

### 13.3. Desktop

- left nav: Карта / Места / События / Притчи / Чудеса / Страстная неделя / Писание;
- center map;
- right filters;
- Jerusalem inset optional, collapsible.

### 13.4. Mobile

- default layer: “важные события”;
- chips: “Чудеса”, “Притчи”, “Страстная неделя”;
- Jerusalem opens as separate full-screen inset map.

---

## 14. Павел

### 14.1. Особенности

Это multi-route maritime + land map.

Нужны:

- 1-е путешествие;
- 2-е;
- 3-е;
- путь в Рим;
- sea route vs land road;
- epistle cities;
- Acts references;
- chronology.

### 14.2. Good visual pattern

Лучший вариант — карточки путешествий снизу:

- корабль;
- цвет маршрута;
- годы;
- Деян. refs.

### 14.3. Mobile

- one journey at a time;
- route stages carousel;
- “show all journeys” optional;
- avoid showing all colored routes by default on small screens.

---

## 15. Иерусалим

### 15.1. Особенности

Это city plan, не regional map.

Нужны слои:

- стены;
- ворота;
- храмовый комплекс;
- дороги;
- водоёмы;
- археологические объекты;
- маршруты событий;
- рельеф;
- современная застройка optional.

### 15.2. Связь с сайтом

Иерусалим должен связывать:

- статьи;
- Писание;
- родословные;
- события;
- личности;
- медиа.

### 15.3. Mobile

- full-screen city map;
- layer chips;
- right panel превращается в bottom sheet;
- tabs внутри sheet: Обзор / Писание / События / Личности.

---

## 16. Карта сравнения

### 16.1. Сильная фича

Сравнение карт — очень полезно:

- Авраам vs Исход;
- Царства vs Пророки;
- Земля Иисуса vs Павел;
- древние дороги vs современные контуры;
- разные гипотезы маршрута Исхода.

### 16.2. UX

Desktop:

- два map panes;
- center compare toolbar;
- right inspector;
- synced pan/zoom;
- route overlay optional.

Mobile:

- не side-by-side;
- use tabs:
  - Map A;
  - Map B;
  - Differences;
  - Inspector.

---

## 17. Research mode

### 17.1. Для кого

Не обязательно публично первым экраном.

Для:

- редактора;
- проверки;
- глубокого исследования;
- будущего admin/research режима.

### 17.2. Что включить

- layer sets;
- saved views;
- dataset table;
- version history;
- notes;
- export;
- citations;
- measurements;
- compare versions.

### 17.3. Важно

Не делать это default для обычного пользователя. Обычному пользователю нужен чистый режим, а research mode — advanced.

---

## 18. Дизайн-токены

### 18.1. Base palette

```ts
const mapTokens = {
  bg: '#F7F0DF',
  panel: '#FFF8E9',
  panelSoft: '#F5E9D0',
  ink: '#3D2A16',
  mutedInk: '#756553',
  gold: '#B78932',
  olive: '#5E6F34',
  blueWater: '#8CB9CF',
  routeRed: '#B94A3A',
  routeBlue: '#2F6FAE',
  routeGreen: '#4F8A56',
  routePurple: '#7954A1',
  routeOrange: '#D07A24',
  disputed: '#C48A2C',
  border: '#D8C399'
};
```

### 18.2. Line styles

```ts
const lineStyles = {
  certain: { dash: 'none', width: 3 },
  traditional: { dash: 'none', width: 2.5 },
  probable: { dash: '6 4', width: 2 },
  disputed: { dash: '2 4', width: 2 },
  secondary: { dash: '4 6', width: 1.5 }
};
```

### 18.3. Symbol classes

- city;
- important city;
- capital;
- camp;
- mountain;
- river;
- sea;
- route waypoint;
- archaeological site;
- event;
- miracle;
- parable;
- refuge city;
- Levite city;
- epistle city.

---

## 19. Quality gates

Перед публикацией каждой карты:

### Data

- все ids уникальны;
- все stage place ids существуют;
- все route path ids существуют;
- все refs валидны по формату;
- нет пустых названий;
- нет неизвестных layer ids;
- disputed items имеют note.

### Visual desktop

- initial viewport правильный;
- key labels do not collide;
- route readable;
- legend readable;
- panels do not cover key path;
- minimap not obstructing;
- no fake text;
- screenshot baseline approved.

### Visual mobile

- map usable at 360px width;
- bottom sheet works;
- controls tappable;
- route stages readable;
- no three-column layout;
- layer sheet works;
- orientation fallback if needed.

### Accessibility

- buttons have aria-label;
- keyboard navigation;
- Esc closes panels;
- focus trap in modals;
- contrast AA;
- not color-only distinctions.

### Performance

- lazy media;
- no rerender whole map on hover;
- labels memoized;
- route paths precomputed;
- map data normalized once;
- heavy geometry simplified.

---

## 20. Realistic phased plan

### Phase 1 — MapEngine v2 skeleton

- create engine folder;
- define types;
- implement data loader;
- implement SVG renderer shell;
- implement pan/zoom;
- implement layers;
- implement legend;
- implement place panel.

### Phase 2 — Avraam v2

- connect `avraam/route.json`;
- reproduce current functionality;
- improve visual;
- add mobile;
- compare with existing page;
- audit.

### Phase 3 — Label engine

- priority labels;
- anchors;
- collision;
- zoom levels;
- manual overrides.

### Phase 4 — Exodus

- migrate `ishod/route.json`;
- add disputed-route handling;
- add stage timeline;
- mobile route mode.

### Phase 5 — Other maps

Order:

1. Павел;
2. Земля Иисуса;
3. Колена;
4. Царства;
5. Иерусалим;
6. Compare mode;
7. Research mode.

### Phase 6 — Public hub

- `/karty/` shows only approved maps;
- cards have status:
  - готово;
  - в работе;
  - скрыто;
  - требует аудита.

---

## 21. Final instruction to agent

Do not implement these DALL·E images literally. They are visual references for direction.

Implement:

- shared MapEngine v2;
- data-driven maps;
- reusable UI components;
- desktop and mobile layouts;
- label collision system;
- semantic zoom;
- route stages;
- layer registry;
- validation scripts;
- screenshot audit.

Do not implement:

- separate 5000-line HTML per map;
- inline data constants;
- fake text;
- hardcoded labels in SVG;
- desktop compressed into mobile;
- uncontrolled map-specific CSS hacks.

The goal is not “make one pretty map”.

The goal is:

> Build a maintainable premium biblical SVG atlas platform where every future map benefits from the same engine, same label system, same panels, same mobile model, same validation, and same visual quality.
