# ATLAS VISUAL QA MARATHON PROTOCOL

**Дата:** 2026-08-02  
**Статус:** обязательный протокол для reference-map и последующих map lanes  
**Первая карта:** `avraam`  
**Цель:** обнаруживать географические, SVG, label, interaction и responsive-дефекты до owner review, а не после публикации.

---

## 1. Что этот протокол исправляет

Недостаточно проверить, что:

- JSON парсится;
- SVG существует;
- на странице нет общего horizontal overflow;
- одна история переключается;
- один desktop screenshot выглядит приемлемо;
- legacy и Astro содержат одинаковые строки.

Такие проверки не обнаруживают системно:

- реку, ушедшую с суши или за край;
- неверно связанный маршрут;
- подпись вне safe area;
- перекрытие названий, leader lines и markers;
- control, закрывающий важный объект;
- слишком мелкий hit target;
- дефект только на одном semantic zoom bucket;
- mobile sheet, из которого нельзя выйти;
- пропавший focus, клавиатурную ловушку или жест, конфликтующий с pan;
- print crop и no-JS content loss.

---

## 2. Четыре параллельных вида доказательств

Каждый значимый visual/runtime change требует не одного скриншота, а четырёх типов evidence.

### A. Structural evidence

- schema/effective projection;
- unique IDs and references;
- route graph connectivity;
- source/status/right bindings;
- deterministic output;
- no hidden route-specific mutation.

### B. Geometry evidence

Собираются DOM/SVG метрики:

- viewport and viewBox;
- `getBBox()` и `getBoundingClientRect()`;
- canvas/safe-area intersections;
- label/label, label/marker, label/control overlaps;
- route/path bounds;
- hydrography/land bounds;
- hit target dimensions;
- clipping and offscreen states;
- selected/focused object visibility.

### C. Visual evidence

- macro screenshots;
- regional screenshots;
- micro crops;
- side-by-side current/baseline;
- mobile, zoom, print and no-JS screenshots.

### D. Interaction evidence

- scripted clicks;
- keyboard sweep;
- touch/pointer sweep;
- focus restoration;
- state/URL restoration;
- layer and story combinations;
- error/fallback behavior.

Ни один вид evidence не заменяет остальные.

---

## 3. Macro matrix

Для каждого final candidate head делаются полные кадры как минимум в следующих режимах.

### Desktop

- 1920×1080;
- 1440×900;
- 1366×768;
- 1280×720, если viewport реально поддерживается продуктом.

### Tablet

- 1024×768 landscape;
- 768×1024 portrait.

### Mobile

- 430×932;
- 390×844;
- 375×812;
- 360×800.

### Browser zoom / density

- 80% или ближайший поддерживаемый уменьшенный режим;
- 100%;
- 125%;
- 150%;
- 200%.

На каждом обязательном viewport проверяется:

- initial overview;
- Atlas Shell closed/open;
- selected key place;
- one dense dossier;
- one story focus;
- max practical zoom;
- min practical zoom;
- all four map corners after pan;
- return to overview/reset.

---

## 4. Micro matrix

Micro screenshot — это не случайный crop, а доказательство конкретного риска.

Для Авраама обязательны группы:

1. **Ур и Нижняя Месопотамия** — river/coast/base alignment, main vs candidate Ur, labels, glyphs.
2. **Харран и Северная Месопотамия** — route turn, context places, text density.
3. **Дамаск → Сихем → Бет-Эль** — long-route continuity, mountain/road labels, leader lines.
4. **Египетский эпизод** — edge behavior, route excursion, Nile/base geography.
5. **Хеврон/Мамре/Махпела** — dense place cluster and semantic zoom.
6. **Содом/долина Сиддим/Талл-эль-Хаммам** — competing localizations, non-consensus styling, no false main route.
7. **Дан/Хова/Салим** — war route separated from Abraham main route.
8. **Герар/Беэр-Шева/Беэр-лахай-рои/Кадес** — southern edge and label collisions.
9. **Мория/Иерусалим** — place identity, route end, selected/focus state.
10. **Картуш, легенда, компас, масштаб, Atlas Shell trigger** — safe area and visual hierarchy.

Для каждой группы сохраняются:

- clean state;
- selected state;
- one open contextual UI state;
- min/max relevant semantic zoom;
- overlap metrics JSON.

---

## 5. Обязательная edge sweep

Агент проходит по периметру карты и проверяет:

```text
top-left → top-center → top-right
→ right-center → bottom-right → bottom-center
→ bottom-left → left-center → center
```

На каждой точке:

- нет обрезанных labels/markers;
- UI не перекрывает критический объект;
- pan bounds не открывают пустую бесконечную область;
- карта не прыгает при открытии/закрытии drawer;
- zoom anchor работает предсказуемо;
- reset возвращает идентичный deterministic overview.

Отдельно проверяются все объекты, расположенные ближе заданного safe margin к краю effective viewBox.

---

## 6. Label and declutter gate

### 6.1 Нельзя проверять только глазами

Автоматически вычисляются пересечения:

- label ↔ label;
- label ↔ marker/glyph;
- label ↔ route milestone;
- label ↔ cartouche/legend/control;
- leader ↔ unrelated label;
- selected halo ↔ clipped edge.

### 6.2 Допустимые пересечения

Любое допустимое пересечение должно быть явно классифицировано, например:

- intentional halo behind its own label;
- decorative hatch under text;
- same-object leader touching own marker.

Глобальный allowlist запрещён. Исключение привязано к object IDs, viewport family, zoom bucket и объяснению.

### 6.3 Typography

Проверяются:

- minimum rendered font size;
- line height;
- contrast against actual rendered background;
- halo/stroke width;
- Cyrillic, Hebrew and Greek glyph coverage;
- truncation/ellipsis only where product explicitly permits;
- no label outside safe frame;
- no upside-down or non-readable rotated text.

---

## 7. Rivers, coastlines and route geometry

### 7.1 Hydrography

Для рек и береговых линий проверяется:

- path bounds inside coordinate family;
- no unexpected self-intersection;
- expected endpoints and confluences;
- no water path continuing across land/sea boundary due to wrong transform;
- no clipping at current sheet viewport;
- consistent base across all maps of family.

### 7.2 Routes

Для каждого semantic route segment:

- valid `from` and `to` references;
- direction and story membership;
- no implicit route via array order when explicit graph is required;
- no candidate/context node inserted into main route;
- no segment hidden by adapter or CSS;
- selected story shows exactly its expected segments;
- route remains readable at all relevant zoom buckets.

### 7.3 Visual route audit

Micro crops are required at:

- sharp turns;
- branch points;
- crossings;
- water crossings;
- close parallel routes;
- route endpoints;
- every disputed localization that can be mistaken for the canonical path.

---

## 8. Click marathon

For every interactive object visible in at least one state:

1. click/tap opens correct object;
2. title and ID match;
3. marker receives selected state;
4. selected object remains visible after UI opens;
5. close/Escape restores focus;
6. browser back/forward restores meaningful state where URL state exists;
7. switching story/layer does not leave orphaned panel content;
8. repeated open/close does not duplicate listeners or DOM;
9. reset removes transient state;
10. external/source link has safe target behavior and correct label.

The sweep covers:

- every place;
- every story;
- every layer;
- every localization variant;
- every Atlas Shell item;
- every menu and setting;
- source drawer;
- search result selection;
- keyboard shortcuts;
- error/retry controls.

Случайная выборка допустима только на iteration loop. Final gate обязан использовать полный inventory-generated список.

---

## 9. Keyboard and accessibility marathon

Обязательно:

- Tab/Shift+Tab across all visible controls;
- Enter/Space activation according to control semantics;
- Arrow navigation where widget pattern requires it;
- Escape closes topmost contextual surface only;
- focus trap only inside modal surfaces, never on ordinary popover/drawer without reason;
- focus returns to opener;
- map shortcuts do not fire inside input/textarea/select/contenteditable;
- modified browser shortcuts are not intercepted;
- selected place and map state have accessible names;
- dynamic changes announce appropriately without noisy live regions;
- target size at least 44×44 CSS px for touch controls, unless an explicit accessible alternative exists;
- reduced-motion mode removes nonessential fly/zoom animation;
- 200% zoom remains operable without loss of information.

---

## 10. Touch and pointer marathon

- one-finger pan;
- pinch zoom;
- tap marker;
- tap empty map to close only the intended surface;
- drawer drag if supported;
- no accidental page scroll lock after close;
- no hover-only content;
- pointer capture released after gesture;
- no click after pan threshold;
- controls near safe-area insets remain usable;
- landscape mobile remains recoverable.

---

## 11. Contextual UI and clean-map rule

Every menu, card or drawer is tested in relation to the map, not separately.

Gate questions:

- Does it obscure the selected object?
- Does it cover the route the user is studying?
- Can it reposition or collapse intelligently?
- Is the map still visually primary?
- Is there a clean one-action exit?
- Does opening a second contextual surface replace or stack predictably?
- Does mobile use bottom sheet rather than tiny desktop popover?
- Does desktop preserve enough visible map area?
- Is important information reachable without leaving the map?

At least one screenshot proves the map in its clean resting state after all surfaces are closed.

---

## 12. Source and archaeology dossier gate

For representative conservative and nonconservative entries:

- status is visible;
- site position is visible but not confused with consensus;
- primary source and secondary explanation are distinguishable;
- evidence does not claim more than the source supports;
- competing locations can be compared;
- radiocarbon fields show range/context/assumptions rather than one magic date;
- image credits and licenses are reachable;
- HOLD or missing primary locator is visible internally and cannot silently publish as verified.

At least one full source-drawer interaction is part of desktop and mobile golden candidates.

---

## 13. No-JS, failure and offline-adjacent modes

### No-JS

- meaningful text and route summary remain available;
- sources and uncertainty are not lost;
- no opaque loading canvas remains;
- navigation back to Atlas is available.

### Runtime failure

- visible accessible error;
- no raw exception content;
- retry/reload control;
- fallback text reachable;
- no infinite spinner.

### Missing asset/source

- map remains usable;
- missing photo does not collapse layout;
- broken external source is reported by link audit, not hidden.

---

## 14. Print/PDF gate

Print is a separate projection, not a screenshot of the interactive UI.

Checks:

- correct page size/orientation;
- no clipped map/frame/title/legend;
- readable labels at physical scale;
- no interactive controls;
- source/rights footer or companion page;
- optional overview plus selected detail pages;
- raster images have sufficient effective resolution;
- SVG filters do not disappear or produce black boxes;
- PDF text remains searchable where possible;
- physical PDF screenshot/render witness is retained.

---

## 15. Evidence artifact structure

Each marathon run writes an immutable evidence directory keyed by source SHA:

```text
audit/atlas-evidence/<slug>/<sha>/
  manifest.json
  environment.json
  route-effective.json
  geometry/
    overview.json
    overlaps.json
    edges.json
    hit-targets.json
  screenshots/
    macro/
    regions/
    micro/
    mobile/
    zoom/
    no-js/
    print/
  interactions/
    clicks.json
    keyboard.json
    touch.json
    console.json
  findings.json
  summary.md
```

Если policy репозитория не разрешает хранить тяжёлые screenshots в product source, manifest и hashes остаются в product/AuditRepo согласно действующему Single-Writer-Per-Fact, а изображения публикуются как immutable CI artifact. В документации всегда указывается, где находится фактический artifact.

---

## 16. Iteration loop и final gate

### Быстрый iteration loop

После bounded изменения:

- affected structural checks;
- affected geometry checks;
- 1 macro screenshot;
- все затронутые micro regions;
- targeted interactions.

### Полный candidate loop

После визуально целостной итерации:

- вся macro matrix;
- вся micro matrix;
- edge sweep;
- full inventory click/keyboard sweep;
- mobile/touch;
- no-JS/failure;
- print;
- side-by-side owner candidates.

### Final exact-head gate

- run only on final PR SHA;
- no baseline auto-update inside test command;
- zero unclassified geometry errors;
- zero console/page errors;
- no skipped required viewport/browser without written reason;
- findings ledger reconciled;
- owner golden candidate package produced.

---

## 17. Autonomous super-marathon rule

«Автономный марафон» означает не бесконтрольное массовое изменение, а длинный самостоятельный цикл внутри bounded lane.

Агент обязан:

- сам искать дефекты по inventory и risk matrix;
- делать несколько итераций до исчерпания подтверждённых проблем lane;
- прокликивать и измерять, а не ограничиваться визуальным впечатлением;
- сохранять evidence каждого meaningful candidate;
- не просить владельца оценивать сырые промежуточные кадры вместо собственного QA;
- не расширять scope на другие карты или shared subsystem без отдельного решения;
- остановиться при реальном authority conflict, unsafe overlap или необходимости owner taste decision;
- честно записать недоступные browsers/tools и не подделывать green.

Owner review проводится на подготовленном сравнительном пакете: что изменилось, какие дефекты закрыты, какие варианты предлагаются, какой exact SHA проверен.

---

## 18. Minimum pass criteria for Avraam phase 1

Первая техническая фаза не редизайнит карту. Она обязана:

1. включить Авраама в dedicated browser evidence вместо default skip;
2. отделить current Astro/MapEngine truth от legacy artifact checks;
3. добавить geometry collector;
4. добавить macro overview screenshots;
5. добавить mandatory micro regions;
6. добавить inventory-driven click sweep;
7. зафиксировать current defects без автоматического baseline acceptance;
8. не менять другие карты;
9. не менять shared rendering behavior до получения baseline evidence.
