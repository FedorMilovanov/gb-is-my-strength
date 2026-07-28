# Атлас исследований — UX и engine specification

Статус: **каноническая спецификация**  
Публичный маршрут: `/map/`  
Browser payload: `/data/relations.compiled.json`  
Пользовательское название: **Атлас исследований**

## 1. Продуктовая задача

Атлас не является декоративной схемой. Он помогает:

- увидеть тематические кластеры;
- найти конкретный материал;
- понять ближайшие и межтематические связи;
- открыть контекст узла;
- перейти к публикации;
- работать через равноправный список;
- сохранить состояние исследования в URL.

## 2. Архитектурная граница

### Relation compiler

Владеет:

- узлами и canonical URL;
- typed relations и inverse labels;
- группами;
- классификацией `series / cluster / structure / bridge`;
- counts и diagnostics;
- article projections.

### SSR shell

Владеет:

- интерфейсной разметкой;
- фильтрами;
- полным списком anchors;
- no-JS библиотекой;
- вычисленными counts.

### Atlas runtime

Владеет только интерактивным состоянием:

- renderer;
- camera;
- pan/zoom/pinch;
- focus;
- search/filter state;
- URL state;
- detail panel.

Runtime не компилирует предметные отношения и не загружает raw sources.

## 3. Data contract

Browser делает один запрос:

`GET /data/relations.compiled.json`

Payload имеет обязательные поля:

- `schemaVersion`;
- `engineVersion`;
- `nodes[]`;
- `edges[]`;
- `groups[]`;
- `edgeKinds[]`;
- `stats`.

Runtime падает в доступный list mode при:

- HTTP error;
- неизвестной schema version;
- отсутствии массивов nodes/edges/groups;
- edge с неизвестным endpoint;
- edge с неизвестным Atlas kind.

Silent partial graph запрещён.

## 4. Три масштаба

### Overview

- тематические кластеры;
- хабы;
- главные межтематические мосты;
- минимальное количество labels.

### Cluster

- названия материалов кластера;
- внутренние и структурные связи;
- более заметные node targets;
- cluster labels.

### Detail

- выбранный узел и окружение глубины 1;
- читаемые neighbor labels;
- усиленные connected edges;
- приглушённая нерелевантная сеть;
- открытая detail panel.

Semantic zoom управляет детализацией, но не скрывает информацию из list mode.

## 5. Native renderer

Текущая production-модель — SVG renderer с детерминированным кластерным layout.

Причины:

- доступные DOM nodes;
- keyboard events без отдельного hit-testing слоя;
- отсутствие тяжёлой runtime dependency;
- предсказуемый static deploy;
- visual regression через обычный browser screenshot;
- точный fallback без WebGL capability assumptions.

Renderer является потребителем compiled model, а не владельцем данных. Замена SVG на Canvas/WebGL допускается только как новый adapter к тому же payload и не требует изменения relation compiler, URL state, SSR list или article projections.

Scale guard:

- до 250 узлов — full SVG labels по semantic zoom;
- 251–750 — SVG с label virtualization;
- более 750 — отдельный Canvas/WebGL renderer adapter;
- list mode остаётся полным при любом размере.

Threshold должен проверяться кодом и диагностикой, а не скрытым предположением.

## 6. Управление картой

Обязательно:

- wheel / trackpad zoom относительно указателя;
- drag pan;
- pinch zoom;
- кнопки `+`, `−`, «Показать всё»;
- keyboard `+`, `−`, `0`;
- ограничение минимального и максимального zoom;
- отсутствие постоянной физической симуляции.

Layout после загрузки стабилен. Никакой бесконечной дрожи или пересчёта координат в idle.

## 7. Desktop layout

Три зоны:

1. темы и типы связей слева;
2. карта по центру;
3. non-modal detail panel справа.

Top bar содержит:

- название;
- поиск;
- `Карта / Список`;
- фильтры;
- сброс состояния.

Detail panel не закрывает выбранный кластер и не превращается в центральную модалку.

## 8. Mobile layout

- отдельная compact top bar;
- полноэкранная stage area;
- floating zoom/center controls;
- filter drawer;
- detail bottom sheet;
- переключатель `Карта / Список`;
- labels только в релевантной степени детализации.

Touch target управляющих кнопок — не меньше 38px в текущем UI и целевой минимум 44px при следующей visual normalization.

## 9. Focus mode

При выборе узла:

- active node получает главный акцент;
- neighbors остаются хорошо читаемыми;
- connected edges усиливаются;
- остальные узлы приглушаются;
- камера центрирует окружение;
- URL получает `focus=<id>`;
- detail panel открывается.

Enter и Space активируют keyboard node. Escape снимает focus.

## 10. Фильтры

### Темы

Список строится из `compiled.groups`, а не из ручного массива.

### Типы линий

- `series` — порядок серии;
- `cluster` — внутри темы;
- `structure` — материал и раздел;
- `bridge` — мост между темами.

Semantic relation type сохраняется в edge model и используется для человекочитаемой подписи detail panel. Atlas line kind отвечает только за визуальную читаемость карты.

Фильтр синхронно меняет graph и list mode.

## 11. Поиск

Поиск работает по:

- названию;
- тегам;
- описанию;
- теме.

Требования:

- case-insensitive;
- выдача не более восьми быстрых результатов;
- Enter фокусирует первый результат;
- выбор переводит в graph view и центрирует узел;
- Escape закрывает выдачу;
- список использует тот же filter state.

## 12. Detail panel

Содержит:

- тему;
- заголовок;
- аннотацию;
- время чтения;
- число ближайших связей;
- до семи neighbor actions;
- semantic прямую или inverse подпись;
- настоящий переход «Читать материал».

URL берётся только из compiled node.

## 13. List mode

List mode — полноценное представление, не аварийная заглушка.

Он содержит:

- все compiled nodes;
- группировку по темам;
- настоящие anchors;
- descriptions и reading time;
- действие «На карте»;
- синхронные group/search filters.

При runtime failure list mode остаётся рабочим без повторной загрузки данных.

## 14. No-JS

`<noscript>` содержит полный compiler-backed список.

No-JS acceptance:

- interactive app скрыт;
- список видим;
- число ссылок равно `compiled.nodes.length`;
- первый target ≥ 44px;
- data requests отсутствуют;
- horizontal overflow отсутствует.

## 15. URL state

Поддерживаются:

- `focus=<id>`;
- `group=<group>`;
- `view=list`.

Canonical остаётся `/map/`.

Неизвестные ID/group игнорируются безопасно. Reset удаляет transient query state.

## 16. Failure recovery

При отказе compiled endpoint:

- `data-runtime-error="1"` выставляется явно;
- graph view скрывается;
- server-rendered list открывается;
- detail/sidebar скрываются recovery controller;
- graph button получает disabled semantics;
- техническая ошибка не перекрывает библиотеку.

## 17. Доступность

- graph имеет полный текстовый эквивалент;
- узлы доступны Enter/Space;
- search имеет label и listbox semantics;
- theme controls используют `aria-pressed`;
- relation filters используют checkbox semantics;
- Escape закрывает transient UI;
- кнопки дублируют drag/gesture управление;
- focus ring видим;
- `prefers-reduced-motion` отключает camera transitions.

## 18. Визуальный язык

Образ: **ночной музейный богословский атлас**.

- чернильно-синий фон;
- тёплое золото focus;
- приглушённые cluster colors;
- слабое зерно;
- линии тихие вне focus;
- крупные cluster labels;
- спокойная книжная типографика;
- без sci-fi neon и SaaS-dashboard эстетики.

## 19. Запрещённые решения

- ручные arrays nodes/edges в runtime;
- отдельная компиляция graph в SSR и browser;
- несколько raw JSON requests;
- случайный или постоянно движущийся layout;
- URL, построенные догадкой из ID;
- modal, закрывающая карту;
- drag как единственное управление;
- mobile как уменьшенный desktop;
- Canvas/WebGL без равноправного list mode;
- ослабление schema validation ради отображения частичного графа.

## 20. Browser acceptance

Desktop:

- runtime counts точно равны compiled counts;
- zoom уменьшает viewBox;
- focus обновляет URL;
- detail panel открывается;
- list links точно равны node count;
- выполняется ровно один compiled data request.

Mobile:

- filter drawer открывается/закрывается;
- node tap открывает sheet;
- controls имеют touch-safe geometry;
- overflow ≤ 2px.

Failure/no-JS:

- compiled endpoint failure переключает в list mode;
- no-JS links равны node count;
- raw graph/series requests равны нулю.

Visual evidence покрывает 390, 768, 1440 и 1920px перед переводом PR из draft.
