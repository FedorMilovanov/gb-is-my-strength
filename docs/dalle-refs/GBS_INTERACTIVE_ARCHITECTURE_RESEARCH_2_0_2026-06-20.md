# GBS Interactive Architecture Research 2.0  
## Родословие, библейские карты `/karty/`, карта связей `/map/`

**Проект:** `gb-is-my-strength`  
**Репозиторий:** <https://github.com/FedorMilovanov/gb-is-my-strength>  
**Дата версии:** 20 июня 2026  
**Статус документа:** итоговое архитектурное ТЗ 2.0 для агента/разработчика  
**Цель:** заложить систему так, чтобы не пришлось через месяц переписывать всё заново.

---

## 0. Главный итог 2.0

Нужно перестать мыслить отдельными “красивыми схемами”. На сайте формируются три разных интерактивных продукта:

1. **`/rodosloviye/` — полный библейский атлас родословий.**  
   Не декоративная линия “Адам → Христос”, а многоуровневая генеалогическая база: канонические родословия, родовые списки, племена, служебные списки, спорные места, Матфей/Лука, отдельный слой раннецерковной традиции.

2. **`/karty/` — библейские 2D-карты маршрутов и мест.**  
   Авраама использовать как эталонный пилот, данные сохранить, но постепенно перевести на `MapEngine v2`. Остальные карты не чинить поштучно в старых HTML, а пересобрать на общем движке, сохранив `route.json`.

3. **`/map/` — карта связей сайта.**  
   Не смешивать с библейскими картами. Это отдельный network graph сайта: статьи, серии, карты, темы, внутренние ссылки, кластеры.

**Ключевой принцип:**  
**данные сохранять, визуальные оболочки и движки пересобирать модульно.**

---

## 1. Что проверено

### 1.1. Репозиторий

Проверены актуальные исходники:

- `src/pages/rodosloviye/index.astro`
- `src/components/genealogy/GenealogyTree.tsx`
- `src/components/genealogy/layout.ts`
- `src/components/genealogy/theme.ts`
- `src/components/genealogy/SplitView.tsx`
- `src/components/genealogy/DetailPanel.tsx`
- `src/components/genealogy/types.ts`
- `data/genealogy/genealogy.json`
- `karty/_shared/README.md`
- `karty/_engine/map-engine.js`
- `karty/avraam/route.json`
- `karty/index.html`
- `map/index.html`
- `scripts/validate-map-routes.js`
- `scripts/avraam-map-audit.js`

### 1.2. Документация и современные подходы

Проверены актуальные подходы и библиотеки:

- React Flow / XYFlow
- ELK / elkjs
- Dagre
- D3 / d3-geo / geoPath
- MapLibre GL JS
- Leaflet
- Panzoom
- Sigma.js
- Graphology
- Mapshaper / GeoJSON / TopoJSON
- исторический вопрос о генеалогических архивах: Иосиф Флавий, Юлий Африкан, Евсевий / Schaff

---

## 2. Архитектурное решение одним блоком

| Раздел | Что строим | Основной стек | Что сохранить | Что переписать |
|---|---|---|---|---|
| `/rodosloviye/` | Полный интерактивный атлас библейских родословий | Astro + React island + React Flow + ELK + D3 utilities | `genealogy.json`, типы, богословская модель, поиск, фокус, Split View, тур | визуальный слой, layout pipeline, data model 2.0, компонентную структуру |
| `/karty/avraam/` | Эталонная 2D-карта маршрута Авраама | MapEngine v2 SVG/Canvas + D3-geo utilities | `route.json`, тексты, места, этапы, источники, visual ideas | убрать inline data, перевести на общий движок |
| остальные `/karty/*/` | Библейские карты маршрутов | MapEngine v2 | `route.json`, контент, источники | старые HTML/shell почти с нуля |
| `/map/` | Карта связей сайта | Sigma.js + Graphology | идею карты сайта | текущий hardcoded demo-граф |
| `/karty/` hub | Витрина карт | Astro/HTML cards | принцип “показывать только проверенные карты” | усилить статусы, audit gate, карточки |

---

# ЧАСТЬ I. РОДОСЛОВИЕ `/rodosloviye/`

---

## 3. Текущая реализация родословия

### 3.1. Что уже хорошо

Сейчас раздел уже построен не как статичная картинка, а как React Flow-интерактив:

- `ReactFlow`
- `Background`
- `Controls`
- `MiniMap`
- поиск
- фильтры линий
- “золотая нить”
- semantic zoom
- фокус ветви
- split view Матфей/Лука
- клавиатурная навигация
- тур по golden path

Это хорошая база: её не надо выбрасывать.

### 3.2. Что плохо

Главная проблема — **компонентный и визуальный монолит**.

`GenealogyTree.tsx` одновременно занимается:

- состояниями UI;
- поиском;
- layout;
- semantic zoom;
- focus mode;
- keyboard navigation;
- tour;
- render React Flow;
- toolbar;
- side panels;
- inline styles.

`layout.ts` сейчас построен как Dagre layout + golden path + AM positioning + focus lineage. Dagre подходит для простого направленного дерева, но слабоват для полной генеалогической системы с группами, эпохами, Матфеем/Лукой, боковыми ветвями и служебными списками.

### 3.3. Вердикт

**Не удалять раздел.**  
**Не переписывать всё с нуля.**  
**Но визуальную и layout-архитектуру пересобрать почти полностью.**

---

## 4. Главное уточнение 2.0: нужна ВСЯ генеалогия

Раздел не должен быть короткой декоративной схемой “Адам → Христос”.

Нужна **полная библейская генеалогическая база**, где:

- на общем плане видна история спасения;
- при приближении раскрываются сотни имён;
- ветви не теряются;
- списки и родословия не смешиваются;
- спорные места видны, но оформлены спокойно;
- после Христа есть отдельный слой традиции, не как продолжение потомков Христа.

---

## 5. Минимальный канонический охват данных

Агент должен расширять данные не произвольно, а по источникам.

### 5.1. Основной канонический слой

Обязательно покрыть:

1. **Бытие 5** — Адам → Ной.
2. **Бытие 10** — таблица народов.
3. **Бытие 11** — Сим → Авраам.
4. **Бытие 22, 25, 36, 46** — ветви Авраама, Измаила, Исава/Едома, дом Иакова.
5. **Руфь 4** — линия к Давиду.
6. **1 Паралипоменон 1–9** — большой корпус родословий: от Адама, колена Израиля, левиты, священники, цари, возвращённые.
7. **Ездра / Неемия** — родовые списки вернувшихся, священники, левиты, служители.
8. **Матфей 1** — царственно-юридическая линия ко Христу.
9. **Лука 3** — родословная линия ко Христу.

### 5.2. Канонические списки, не всегда строгая генеалогия

Отдельно маркировать:

- списки священников;
- левитские служения;
- певцов;
- привратников;
- служителей;
- вернувшихся из плена;
- “дом”, “род”, “колено”, “служение”.

Это нельзя рисовать как обычную связь “отец → сын”.

### 5.3. Слой после Христа

Каноническая родословная ко Христу заканчивается Христом.  
После Христа нельзя рисовать “потомков Христа”.

Можно сделать отдельный слой:

**“После Христа / раннецерковная традиция”**

Туда:

- Мария;
- Иосиф;
- Иаков, брат Господень;
- Иуда, брат Господень;
- Симеон;
- `desposyni`;
- раннецерковные сведения о родственниках Господа.

Этот слой должен иметь явную маркировку:

> “Раннецерковная традиция / не основная каноническая родословная линия”.

---

## 6. Про утрату генеалогий и архивов

Не писать грубо:

> “Все генеалогии сгорели при разрушении Иерусалима”.

Это слишком сильное утверждение.

Корректная формулировка:

> После разрушений I века и утраты/недоступности официальных архивов непрерывные публичные родословные линии стали практически недоступны; часть семейных сведений могла сохраняться частно. Поэтому слой после Христа нужно отделять от основной канонической линии.

Основание:

- Иосиф Флавий описывает катастрофу разрушения Иерусалима и храма в 70 году в `Jewish War`, Book VI: <https://penelope.uchicago.edu/josephus/war-6.html>
- Юлий Африкан, сохранённый у Евсевия, связывает утрату родовых регистров с Иродом и говорит, что часть частных сведений сохранялась у некоторых семей, включая `desposyni`: <https://www.newadvent.org/fathers/0614.htm>
- Schaff/CCEL прямо предупреждает, что рассказ Африкана о сожжении всех записей проблематичен, потому что по Иосифу публичные записи ещё существовали позднее: <https://www.ccel.org/ccel/schaff/npnf201.iii.vi.vii.html>

---

## 7. Новая data model 2.0 для родословия

Текущие поля хорошие, но их мало для полной базы.

### 7.1. Новые типы слоёв источников

```ts
type GenealogySourceLayer =
  | 'canonical'
  | 'canonical-list'
  | 'gospel-matthew'
  | 'gospel-luke'
  | 'early-church-tradition'
  | 'historical-note';
```

### 7.2. Типы связей

```ts
type RelationshipType =
  | 'father'
  | 'mother'
  | 'spouse'
  | 'child'
  | 'legal-father'
  | 'adoptive'
  | 'levirate'
  | 'tribal'
  | 'house'
  | 'clan'
  | 'list-member'
  | 'service'
  | 'descendant'
  | 'uncertain';
```

### 7.3. Уровень доказанности

```ts
type EvidenceLevel =
  | 'explicit'
  | 'inferred'
  | 'traditional'
  | 'disputed'
  | 'unknown';
```

### 7.4. Видимость на масштабах

```ts
type VisibilityTier =
  | 'anchor'
  | 'major'
  | 'normal'
  | 'dense'
  | 'detail-only';
```

### 7.5. Расширенный человек

```ts
type PersonNode = {
  id: string;
  type: 'person';
  name: {
    ru: string;
    he?: string;
    alt?: string[];
  };
  gender?: 'm' | 'f' | 'unknown';
  roles?: string[];
  tribe?: string;
  house?: string;
  clan?: string;
  era?: string;
  sourceLayer: GenealogySourceLayer[];
  refs: string[];
  visibilityTier: VisibilityTier;
  disputed?: DisputedInfo[];
  chronology?: ChronologyInfo;
  relationships: Relationship[];
};
```

### 7.6. Групповой узел

```ts
type GroupNode = {
  id: string;
  type: 'group';
  label: string;
  groupKind:
    | 'tribe-group'
    | 'nation-table'
    | 'house'
    | 'clan'
    | 'service-list'
    | 'gospel-list'
    | 'tradition-layer';
  members: string[];
  refs: string[];
  visibilityTier: VisibilityTier;
  expandMode: 'cluster' | 'list' | 'subgraph';
};
```

### 7.7. Связь

```ts
type Relationship = {
  source: string;
  target: string;
  type: RelationshipType;
  evidence: EvidenceLevel;
  refs: string[];
  lineStyle?: 'solid' | 'dotted' | 'dashed' | 'double';
  note?: string;
};
```

---

## 8. Semantic zoom 2.0

Главная UX-идея: **в базе всё, на экране — нужный слой**.

### 8.1. Zoom Level 0 — обзор

Показывать:

- Адам;
- Ной;
- Авраам;
- Иаков / Израиль;
- Давид;
- Иисус Христос;
- крупные группы:
  - допотопные патриархи;
  - народы от Ноя;
  - потомки Авраама;
  - 12 колен Израиля;
  - левиты;
  - дом Давида;
  - Матфей 1;
  - Лука 3;
  - родственники Господа / традиция.

Не показывать сотни имён.  
Показывать капсулы:

- `+ 70 народов`
- `+ 12 колен`
- `+ 42 поколения`
- `+ 77 поколений`
- `+ много имён`

### 8.2. Zoom Level 1 — средний масштаб

Показывать:

- главные имена внутри групп;
- частично раскрытые ветви;
- патриархи;
- 12 колен кратко;
- Дом Давида выборочно;
- Матфей/Лука с опущенными поколениями;
- главные спорные места.

### 8.3. Zoom Level 2 — близкий масштаб

Показывать:

- все имена выбранной зоны;
- роли;
- пол;
- короткие ссылки;
- AM / исторические метки;
- значки “мать”, “жена”, “царь”, “священник”;
- типы связей.

### 8.4. Zoom Level 3 — детальный слой

Показывать:

- refs;
- хронологию;
- текстологические заметки;
- спорные позиции;
- связи “дом / список / служение”;
- подробную карточку человека.

---

## 9. Цветовая система родословия

| Смысл | Цвет / стиль |
|---|---|
| Мессианская линия | старое золото |
| Матфей 1 | царский пурпур |
| Лука 3 | teal / сине-бирюзовый |
| Заветная патриархальная линия | оливковый |
| Каинова линия | приглушённая ржавчина |
| Боковые ветви | тёплый серо-коричневый |
| Спорные места | янтарный пунктир + `?` |
| Женские фигуры | терракотовая боковая метка |
| Служебные/списочные связи | пунктир / тонкая линия |
| Традиционный слой | пунктирная рамка / приглушённая охра |

---

## 10. Важная богословская логика Матфея и Луки

### 10.1. Матфей

Визуально:

> Авраам → Давид → Соломон → цари → Иосиф → Христос

Смысл:

- царственно-юридическая линия;
- линия через Соломона;
- структура 14/14/14;
- связь с царским правом.

### 10.2. Лука

В текущей логике сайта визуально лучше:

> Адам → Ной → Авраам → Давид → Нафан → Мария → Христос

Смысл:

- родословная линия;
- линия через Нафана;
- связь с универсальностью: от Адама;
- аккуратно отмечать спорные/вариантные места.

### 10.3. Главное предупреждение

Не показывать Луку как обычную линию “через Иосифа” в том же смысле, что Матфея, если выбранная богословская логика сайта ведёт Луку через Марию.

Если нужно указать альтернативные традиции — через слой “позиции”.

---

## 11. Обязательные UI-состояния родословия

Агент должен реализовывать не “один красивый экран”, а систему состояний.

### 11.1. Общий вид

- большая карта;
- golden path;
- групповые капсулы;
- left eras sidebar;
- right minimap;
- search;
- filters;
- quick links;
- legend.

### 11.2. Дальний zoom

- только ключевые узлы;
- группы с количеством;
- множество имён показано через “ветви-точки”;
- подсказка “Обзорный масштаб”.

### 11.3. Средний zoom

- больше имён раскрыто;
- группы частично раскрыты;
- Матфей/Лука показывают внутренние якоря;
- Давид / дом Давида выборочно.

### 11.4. Близкий zoom Авраама

- Авраам;
- Сарра;
- Агарь;
- Исаак;
- Измаил;
- Ревекка;
- Иаков;
- Исав;
- Лия;
- Рахиль;
- Валла;
- Зилпа;
- дети Иакова;
- refs и роли.

### 11.5. Раскрытые 12 колен

- Иаков в центре;
- 12 сыновей;
- Иуда → мессианская линия;
- Левий → священническая линия.

### 11.6. Левиты и служения

- Левий;
- Гирсон;
- Кааф;
- Мерари;
- Аарон;
- дома священников;
- служебные списки;
- отличие “генеалогия” от “служение / список”.

### 11.7. Фокус линии Давида

- активная линия яркая;
- нерелевантные ветви приглушены;
- chip “Фокус: линия Давида”;
- кнопка “Сбросить фокус”.

### 11.8. Split View Матфей / Лука

- две колонки;
- Матфей пурпур;
- Лука teal;
- карточка сравнения;
- общее / различия;
- спорные места.

### 11.9. Спорный узел

- янтарная рамка;
- пунктир;
- `?`;
- detail drawer;
- “Есть разные текстовые традиции”;
- “Открыть позиции”.

### 11.10. После Христа / традиция

- основная каноническая линия заканчивается Христом;
- отдельная пунктирная область “Родственники Господа / традиция”;
- пояснение, что слой не является продолжением канонической линии.

### 11.11. Guided tour

- шаги;
- подсветка участка;
- mini-map viewport;
- прогресс;
- кнопки Назад / Далее / Пропустить.

---

## 12. Рекомендуемая архитектура родословия

```txt
data/genealogy/*.json
        ↓
validateGenealogyData()
        ↓
semanticGraph.ts
        ↓
visibleGraph.ts
  filters / search / focus / semantic zoom / split mode
        ↓
layoutEngine/
  elkLayout.ts       основной
  dagreLayout.ts     fallback
  d3TreeLayout.ts    локальные поддеревья
        ↓
React Flow render
        ↓
nodes / edges / panels / sidebar / minimap / tour
```

### 12.1. Почему не чистый D3

D3 — мощный инструмент для custom visualization, но не готовый product graph UI. На чистом D3 придётся руками делать:

- node selection;
- keyboard navigation;
- minimap;
- focus management;
- accessibility;
- panels;
- state sync;
- search;
- split views;
- mobile fallback;
- stable layout.

Для этого проекта лучше:

> **React Flow = интерактивная оболочка**  
> **ELK = умный layout**  
> **D3 = утилиты для шкал, timeline, локальных поддеревьев и SVG-красоты**

React Flow прямо позиционируется как кастомизируемый React-компонент для node-based editors and interactive diagrams: <https://reactflow.dev/>  
React Flow имеет готовые компоненты для MiniMap, Controls, Background и Panel: <https://reactflow.dev/learn/concepts/built-in-components>  
Dagre в React Flow примерах описан как простая интеграция для tree layouts, а ELK предлагается как более advanced layouting library: <https://reactflow.dev/examples/layout/dagre> и <https://reactflow.dev/examples/layout/elkjs>  
React Flow также имеет рекомендации по accessibility и performance: <https://reactflow.dev/learn/advanced-use/accessibility>, <https://reactflow.dev/learn/advanced-use/performance>

---

## 13. Компонентная структура родословия

```txt
src/components/genealogy/
  GenealogyPageShell.tsx
  GenealogyTree.tsx
  GenealogyCanvas.tsx
  GenealogyToolbar.tsx
  GenealogySidebar.tsx
  GenealogyMinimapPanel.tsx
  GenealogyLegend.tsx
  GenealogyTourPanel.tsx
  GenealogySearch.tsx
  GenealogyFilters.tsx
  SplitView.tsx
  PersonDetailPanel.tsx
  nodes/
    PersonNode.tsx
    GroupNode.tsx
    TraditionNode.tsx
    DisputedNode.tsx
  edges/
    GenealogyEdge.tsx
    DottedEvidenceEdge.tsx
    SpouseEdge.tsx
    ServiceEdge.tsx
  layout/
    semanticGraph.ts
    visibleGraph.ts
    elkLayout.ts
    dagreLayout.ts
    d3LocalTree.ts
  theme/
    tokens.ts
    colors.ts
    lineage.ts
    eras.ts
  validation/
    validateGenealogyData.ts
    validateRelationships.ts
```

---

# ЧАСТЬ II. БИБЛЕЙСКИЕ 2D-КАРТЫ `/karty/`

---

## 14. Текущая ситуация по картам

### 14.1. Что хорошо

Уже есть `route.json`-контракт.

`karty/_shared/README.md` описывает идею общего контракта: каждая карта должна иметь `meta`, `stories`, `places`, `stages`, координаты, verified waypoints, scientific variants и общий публичный API движка.

У Авраама богатый `route.json`:

- места;
- этапы;
- сюжеты;
- фото;
- контекст;
- проверенные точки;
- научные варианты.

Это нельзя выбрасывать.

### 14.2. Что плохо

`karty/_engine/map-engine.js` уже выглядит как монолит: рендер, данные, панель места, фото, тур, источники, hash, lifecycle и UI-логика смешаны.

Остальные карты в основном лучше не чинить поштучно. Если открываются криво, проблема не только в CSS, а в отсутствии общего движка с:

- label collision;
- semantic zoom;
- viewport presets;
- mobile mode;
- source panel;
- story mode;
- audit gates.

---

## 15. Решение по Аврааму

**Авраама не переписывать с нуля.**

Причина: он уже лучший пилот, в нём много ценного:

- визуальная идея;
- контент;
- route.json;
- места;
- маршруты;
- научные варианты;
- проверочные скрипты.

Но:

- не продолжать раздувать старый HTML/JS;
- не добавлять новые фичи в старый монолит;
- сделать `MapEngine v2` рядом;
- подключить `avraam/route.json`;
- добиться visual parity или лучше;
- переключить live route только после проверки.

---

## 16. Решение по остальным картам

**Остальные карты пересобрать заново на общем движке, сохранив данные.**

Не чинить:

```txt
/karty/ishod/index.html
/karty/pavel/index.html
/karty/melachim/index.html
...
```

по одному, если они кривые.

Правильно:

```txt
/karty/{slug}/route.json
        ↓
MapEngineV2.load()
        ↓
единый shell
        ↓
единый renderer
        ↓
единая панель
        ↓
единый audit gate
```

---

## 17. MapEngine v2

### 17.1. Рекомендуемый стек

**MapEngine v2 на SVG/Canvas + D3-geo utilities + Panzoom/d3-zoom.**

Не делать основой MapLibre/Leaflet, потому что твои карты — не стандартные tile maps, а **редакционные библейские SVG/Canvas-карты**.

MapLibre GL JS — TypeScript/WebGL-библиотека для интерактивных карт из vector tiles: <https://www.maplibre.org/maplibre-gl-js/docs/>  
Leaflet — лёгкая библиотека для mobile-friendly interactive maps, около 42 KB JS: <https://leafletjs.com/>  
Они хороши для географических тайлов, но не должны быть главным движком редакционной богословской карты.

D3-geo нужен для проекций и path generation. `geoPath` умеет генерировать SVG path или рендерить в Canvas из GeoJSON: <https://d3js.org/d3-geo/path>  
Mapshaper полезен для подготовки GeoJSON/TopoJSON и web maps: <https://mapshaper.org/docs/guides/geojson-for-web-maps.html>

Panzoom поддерживает pan/zoom для SVG-элементов напрямую: <https://github.com/timmywil/panzoom>

### 17.2. Структура

```txt
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
    premiumDark.ts
```

---

## 18. Route schema 2.0 для карт

Добавить optional-поля:

```ts
type Place = {
  id: string;
  name: string;
  x?: number;
  y?: number;
  geo?: {
    lat: number;
    lng: number;
  };
  coord_confidence?: 'certain' | 'probable' | 'disputed' | 'symbolic';
  localization_status?: 'consensus' | 'candidate' | 'alternative' | 'rejected' | 'unknown';
  label?: {
    dx?: number;
    dy?: number;
    anchor?: 'top' | 'right' | 'bottom' | 'left' | 'auto';
    priority?: number;
    minZoom?: number;
    maxZoom?: number;
  };
  render?: {
    layer?: string;
    priority?: number;
    icon?: string;
    variant?: string;
  };
};
```

Для спорных мест:

```ts
type ScientificVariant = {
  id: string;
  placeId: string;
  label: string;
  position?: { x: number; y: number };
  geo?: { lat: number; lng: number };
  confidence: 'high' | 'medium' | 'low';
  positionOfSite?: boolean;
  sources: string[];
  note: string;
};
```

---

## 19. Обязательные фичи MapEngine v2

### 19.1. Label collision

Нельзя публиковать карту, если подписи налезают.

Нужно:

- label boxes;
- priority;
- preferred anchors;
- fallback anchors;
- hide low-priority labels;
- leader lines;
- desktop audit;
- mobile audit.

### 19.2. Semantic zoom

- far: регионы, море, основные маршруты, 3–5 мест;
- mid: этапы, основные места, главные подписи;
- close: все места, спорные варианты, фото, источники;
- focus: выбранный сюжет яркий, остальное приглушено.

### 19.3. Слои

Для Авраама:

- маршрут Авраама;
- линия Лота;
- война царей;
- Акеда;
- контекст эпохи;
- спорные локализации;
- проверенные опорные точки;
- фото/археология;
- география/рельеф/воды;
- дороги.

### 19.4. Панель места

- заголовок;
- еврейское название;
- транслитерация;
- краткое значение;
- Писание;
- география;
- археология;
- спорные позиции;
- фото;
- источники;
- связанные места;
- копировать ссылку;
- предыдущий / следующий.

### 19.5. Tour mode

- stages;
- progress bar;
- pause/resume;
- speed;
- caption;
- fly to stage;
- highlight route;
- skip/close.

### 19.6. Mobile mode

- full-screen map;
- bottom sheet;
- большие кнопки;
- swipe между этапами;
- collapse legends;
- fallback list;
- “поверните экран” как дополнительная подсказка, не как единственное решение.

---

## 20. Quality gates для карт

Каждая карта должна проходить:

1. schema validation;
2. no duplicate ids;
3. all story place ids exist;
4. all stages valid;
5. all photos have alt;
6. stats match actual data;
7. label collision audit desktop;
8. label collision audit mobile;
9. initial viewport audit;
10. controls audit;
11. panel audit;
12. keyboard audit;
13. reduced-motion audit;
14. screenshot baseline;
15. owner review gate.

---

# ЧАСТЬ III. КАРТА СВЯЗЕЙ САЙТА `/map/`

---

## 21. Текущая проблема `/map/`

Сейчас `/map/` выглядит как демо-граф.

В тексте заявляется большая карта связей, но фактическая структура выглядит как маленький hardcoded graph. Это нельзя масштабировать.

Вердикт:

**`/map/` переписать с нуля на data-driven graph.**

---

## 22. Рекомендуемый стек для `/map/`

**Sigma.js + Graphology.**

Sigma.js описывает себя как современную JS-библиотеку для рендера и взаимодействия с network graphs в браузере и работает в связке с Graphology: <https://www.sigmajs.org/>  
Graphology — multipurpose graph object for JavaScript/TypeScript: <https://graphology.github.io/>

Почему не React Flow:

- карта сайта — это network graph, а не genealogy tree и не node editor;
- нужны кластеры, force layout, neighbors, path finding;
- может быть много узлов и связей;
- Sigma/WebGL лучше для обзорной карты большого графа.

---

## 23. Data-driven model для `/map/`

```txt
data/site-graph.json
```

### 23.1. Nodes

```ts
type SiteGraphNode = {
  id: string;
  title: string;
  url: string;
  type:
    | 'article'
    | 'series'
    | 'map'
    | 'landing'
    | 'bio'
    | 'hard-text'
    | 'sermon'
    | 'resource';
  cluster: string;
  tags: string[];
  weight: number;
  updated?: string;
  summary?: string;
  image?: string;
};
```

### 23.2. Edges

```ts
type SiteGraphEdge = {
  source: string;
  target: string;
  type:
    | 'series'
    | 'internal-link'
    | 'thematic'
    | 'map-related'
    | 'author'
    | 'scripture'
    | 'reference';
  weight: number;
  reason: string;
  bidirectional?: boolean;
};
```

### 23.3. Clusters

```ts
type SiteGraphCluster = {
  id: string;
  label: string;
  color: string;
  description: string;
};
```

---

## 24. Источники для генерации карты сайта

`site-graph.json` должен собираться из:

- `data/search-manifest.json`;
- `data/series.json`;
- sitemap / публичные route;
- MD/MDX frontmatter;
- internal links из тела статей;
- curated manual file:
  - `data/site-graph-curated.json`;
- `/karty/*/route.json`;
- `/rodosloviye/`;
- страницы серий;
- карты;
- биографии.

---

## 25. Фичи `/map/`

Обязательно:

1. Search.
2. Filter by cluster.
3. Filter by type.
4. Focus node.
5. Neighbors mode.
6. Path finding between two materials.
7. Related articles panel.
8. Cluster legend.
9. Mini overview.
10. URL hash state.
11. “Почему связаны?” для edge.
12. Mobile fallback list.
13. Keyboard navigation.
14. No orphan nodes unless intentional.
15. Build-time graph validation.

---

## 26. Layout для `/map/`

- force layout допустим для маленького графа;
- для большого графа лучше precomputed positions;
- позиции хранить в:
  - `data/site-graph-layout.json`;
- layout не должен прыгать при каждом reload;
- новые страницы добавлять мягко, не пересобирать весь граф хаотично.

---

# ЧАСТЬ IV. ОБЩАЯ СТРАТЕГИЯ МИГРАЦИИ

---

## 27. Phase 0 — freeze and audit

1. Зафиксировать текущий main.
2. Проверить сборку.
3. Сохранить screenshots текущего состояния:
   - `/rodosloviye/`;
   - `/karty/avraam/`;
   - `/karty/`;
   - `/map/`.
4. Сделать inventory:
   - все карты;
   - все route.json;
   - все публичные/скрытые;
   - все разделы карты сайта.

---

## 28. Phase 1 — родословие 2.0 foundation

1. Вынести data model.
2. Добавить validators.
3. Сделать semanticGraph.
4. Сделать visibleGraph.
5. Подключить ELK.
6. Сохранить React Flow.
7. Сделать светлую design-system.
8. Реализовать group nodes.
9. Реализовать semantic zoom.
10. Реализовать полноту данных постепенно.

---

## 29. Phase 2 — визуальные состояния родословия

Сделать в Storybook/dev route:

1. overview;
2. medium zoom;
3. Abraham close-up;
4. 12 tribes expanded;
5. Levites expanded;
6. David focus;
7. Matthew/Luke split;
8. disputed node;
9. post-Christ tradition;
10. guided tour.

---

## 30. Phase 3 — MapEngine v2

1. Создать `karty/_engine/v2`.
2. Подключить Avraam route.json.
3. Сделать shadow route `/karty/avraam-v2/`.
4. Добиться качества выше текущего.
5. Подключить audit.
6. Переключить live Avraam.

---

## 31. Phase 4 — остальные карты

Порядок:

1. `ishod`;
2. `pavel`;
3. `melachim`;
4. остальные.

Каждую карту возвращать на витрину только после audit gate.

---

## 32. Phase 5 — `/map/` rewrite

1. Создать `scripts/build-site-graph.ts`.
2. Сгенерировать `data/site-graph.json`.
3. Добавить `data/site-graph-curated.json`.
4. Создать Sigma/Graphology renderer.
5. Сделать filters/focus/pathfinding.
6. Добавить validation.
7. Убрать hardcoded demo.

---

# ЧАСТЬ V. ГОТОВОЕ ТЗ ДЛЯ АГЕНТА

---

## 33. ТЗ агенту: общий приказ

```txt
Прочитай этот документ полностью. Не начинай с “подправить CSS”.
Задача — не декоративная правка, а контролируемая архитектурная миграция интерактивных разделов.

Нельзя:
- уничтожать данные;
- переписывать всё без плана;
- чинить старые карты по одной;
- раздувать текущие монолитные файлы;
- делать чистый D3 для родословия;
- смешивать `/karty/` и `/map/` одним движком;
- публиковать карты без visual audit.

Можно и нужно:
- сохранить данные;
- создать новые модули рядом;
- мигрировать постепенно;
- использовать shadow routes;
- сделать validation scripts;
- завести визуальные состояния;
- подключить performance/a11y gates.
```

---

## 34. ТЗ агенту по родословию

```txt
РОДОСЛОВИЕ `/rodosloviye/`

Цель:
полный библейский атлас родословий, а не короткая декоративная линия.

Сохраняем:
- `data/genealogy/genealogy.json`;
- текущую идею Person/Era/Lineage;
- React Flow;
- поиск;
- фокус;
- SplitView;
- тур.

Пересобираем:
- data model 2.0;
- layout pipeline;
- визуальный слой;
- component structure;
- semantic zoom;
- group nodes.

Стек:
Astro + React island + React Flow + ELK + D3 utilities.

Не чистый D3.

Обязательные слои:
- canonical;
- canonical-list;
- gospel-matthew;
- gospel-luke;
- early-church-tradition;
- historical-note.

Обязательные типы связей:
- father;
- mother;
- spouse;
- legal-father;
- levirate;
- tribal;
- house;
- clan;
- list-member;
- service;
- uncertain.

Обязательные zoom states:
- overview;
- medium;
- close;
- detail.

Обязательные UI states:
- общий вид;
- дальний zoom;
- средний zoom;
- близкий zoom Авраама;
- 12 колен;
- левиты;
- фокус Давида;
- Матфей/Лука;
- спорный узел;
- после Христа / традиция;
- guided tour.

Богословская логика:
Матфей — через Соломона, царей, Иосифа.
Лука — через Нафана и Марию в выбранной логике сайта.
Спорные позиции показывать отдельно, спокойно, без сенсационности.
После Христа — только отдельный традиционный слой, не потомки Христа.
```

---

## 35. ТЗ агенту по картам `/karty/`

```txt
КАРТЫ `/karty/`

Цель:
общий MapEngine v2 для всех библейских карт.

Авраам:
- не переписывать с нуля;
- использовать как эталонный пилот;
- подключить route.json к v2;
- добиться visual parity или лучше;
- убрать inline data;
- сохранить audit.

Остальные карты:
- не чинить старые HTML по одному;
- route.json сохранить;
- index shell пересоздать;
- подключать к MapEngine v2;
- публиковать только после audit gate.

MapEngine v2:
- SVG/Canvas;
- D3-geo utilities;
- Panzoom или d3-zoom;
- label collision;
- semantic zoom;
- layers;
- place panel;
- tour;
- mobile bottom sheet;
- source panels;
- visual regression.

Не использовать MapLibre/Leaflet как основной движок.
Их можно рассмотреть только как отдельный режим реальной географической подложки позже.
```

---

## 36. ТЗ агенту по карте сайта `/map/`

```txt
КАРТА САЙТА `/map/`

Текущий hardcoded graph не латать.
Переписать на data-driven graph.

Стек:
- Sigma.js;
- Graphology;
- optional @react-sigma/core.

Данные:
- `data/site-graph.json`;
- `data/site-graph-curated.json`;
- `data/site-graph-layout.json`.

Собирать из:
- search manifest;
- series;
- sitemap;
- frontmatter;
- internal links;
- curated edges;
- karty route.json;
- rodosloviye;
- series pages.

Фичи:
- search;
- filters;
- clusters;
- focus node;
- neighbors;
- path finding;
- related panel;
- edge explanation;
- URL state;
- mobile fallback;
- validation.

Нельзя:
- хранить nodes/edges внутри HTML;
- писать свой force engine;
- смешивать с MapEngine;
- использовать React Flow только потому, что он уже есть.
```

---

# ЧАСТЬ VI. Definition of Done

---

## 37. Родословие готово, если

- есть полноценная data model 2.0;
- есть group nodes;
- semantic zoom работает;
- общая карта не перегружена;
- при приближении раскрываются реально многие имена;
- Матфей/Лука различаются;
- Лука в выбранной логике не уходит визуально в неверную схему;
- спорные места отмечаются;
- после Христа отделён от канона;
- mobile fallback не сломан;
- доступность учтена;
- performance не деградирует;
- есть validation scripts.

---

## 38. Карты готовы, если

- Авраам v2 не хуже текущего;
- данные не потеряны;
- `route.json` — источник истины;
- старый монолит не раздувается;
- labels не налезают;
- mobile usable;
- все карты проходят audit;
- на витрине только проверенные карты.

---

## 39. `/map/` готова, если

- реальное число nodes/edges соответствует заявлению;
- нет hardcoded demo;
- граф собирается из данных;
- есть кластеры;
- search/focus/path works;
- edge reason понятен;
- mobile fallback есть;
- validation проходит.

---

# 40. Финальный вывод

Самая опасная ошибка сейчас — пытаться “докрасить” существующие интерактивы.

Правильная стратегия:

- **родословие:** сохранить базу и React Flow, но пересобрать модель, layout и светлый UI;
- **карты:** Авраама довести через MapEngine v2, остальные пересобрать на общем движке;
- **карта сайта:** переписать с нуля на Sigma.js + Graphology;
- **D3:** использовать как математическую/географическую утилиту, не как основной product framework;
- **данные:** сделать центром всей системы;
- **визуал:** строить как набор состояний, а не одну картинку.

Главная формула проекта:

> **Полная база данных + умный просмотр + честная богословская маркировка + премиальная светлая SVG/atlas эстетика.**
