# MAPS DESIGN CONTRACT
## Архитектурные требования к библейским картам — что ДЕЛАТЬ и чего НЕ ДЕЛАТЬ

**Проект:** `gb-is-my-strength` — раздел `/karty/`
**Дата:** 2026-06-21
**Статус:** действующий

---

## 0. Главный принцип

> **Отдельные SEO-страницы + единый общий MapShell / MapEngine.**
> Не iframe/modal как основа. Не один общий `/karty/app` без отдельных страниц.
> Каждая карта — отдельный URL (`/karty/avraam/`, `/karty/ishod/` и т.д.), но внутри — общий движок и UI.

---

## 1. АТЛАСНОЕ — ДЕЛАТЬ

### 1.1 Структура каждой карты

Каждая карта — это **страница-оболочка (shell)** + данные `route.json` + общий движок:

```
karty/ishod/
  index.html    ← shell: CSP, OG, JSON-LD, MapEngine.createMap(), dark theme init
  route.json    ← данные: places, stages, stories, ctx, viewport_init

karty/_engine/
  map-engine.js ← общий движок MapEngine v0.52 (createMap, zoom, tour, panel, layers...)
  base-geo.svg  ← базовая география SVG (загружается через opts.baseGeoUrl)
```

### 1.2 Что нужно в каждом shell

```html
<!-- SEO-обвязка -->
<link rel="canonical" href="https://gospod-bog.ru/karty/{id}/">
<meta property="og:title" content="...">
<meta property="og:image" content="...">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[...]} </script>

<!-- Preload данных -->
<link rel="preload" href="route.json" as="fetch" type="application/json">

<!-- Dark theme init (до рендера карты) -->
<script>(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();</script>

<!-- Карта -->
<div id="stage" style="position:fixed;inset:0;background:#070a10"></div>
<script src="../_engine/map-engine.js"></script>
<script>
  fetch('route.json')
    .then(r => r.json())
    .then(route => MapEngine.createMap(document.getElementById('stage'), route, {
      baseGeoUrl: '../_engine/base-geo.svg'   // опционально
    }));
</script>
```

### 1.3 route.json — единый контракт данных

Все карты используют единый контракт:
```json
{
  "meta": { "id", "title", "title_he", "subtitle", "era", "viewport_init", "stats" },
  "stories": [{ "id", "label", "description", "place_ids", "stage_ids", "highlight_color" }],
  "places": [{ "id", "name", "x", "y", "type", "stage", ... }],
  "stages": [{ "n", "t", "km", "r", "age" }],
  "ctx": [{ "id", "name", "x", "y", "type" }]
}
```

**Правило:** новая карта = `index.html` + `route.json`. Движок и базовая география не трогаются.

### 1.4 Multi-story карта

Одна карта может показывать разные «сюжеты»:
- «Весь путь» — все места + этапы
- «Линия Лота» — только города долины
- «Война царей» — только этап IV
- и т.д.

При выборе сюжета: активные места горят, остальные dim, маршрут переключается.

### 1.5 Слои карты (Atlas UX)

Визуальная архитектура каждой карты:

```
┌──────────────────────────────────────────────────────────────┐
│ .me-header: title · subtitle · story chips · back button     │
├────────┬─────────────────────────────────────────────────────┤
│        │              .me-canvas (pan/zoom SVG)              │
│ .me-   │   base-geo (opacity 0.5)                           │
│ layers │   route paths (animated draw)                      │
│ toggle │   markers (pulse + hover glow)                     │
│        │   labels (semantic zoom)                           │
│        │   ctx dots                                         │
│        ├─────────────────────────────────────────────────────┤
│        │ .me-timeline: stages / era markers                  │
├────────┴─────────────────────────────────────────────────────┤
│ .me-stage-dots: I · II · III · IV · V · VI                  │
└──────────────────────────────────────────────────────────────┘
```

**Обязательные слои:**
- `.me-map` — контейнер
- `.me-canvas` — SVG viewport (pan/zoom)
- `.me-header` — заголовок, сюжеты, навигация
- `.me-zoom` — кнопки +/–
- `.me-story-chip` — переключение сюжетов
- `.me-stage-dot` — точки этапов
- `.me-panel` — панель места (открывается по клику на маркер)
- `.me-legend` — легенда маршрутов
- `.me-share-btn` — share state
- `.me-theme-btn` — dark/light toggle
- `.me-search` — поиск по местам
- `.me-caption` — tour caption
- `.me-toast` — уведомления
- `.me-timeline` — timeline этапов

### 1.6 Навигация по этапам

При клике на stage dot → панель места открывается, viewport flyTo на место.

### 1.7 Панель места (Atlas Panel)

При клике на маркер:
1. Панель открывается снизу (mobile) или слева (desktop ≥640px)
2. Табы: описание, стихи, археология, фото, dispute, иврит
3. Кнопки prev/next по местам сюжета
4. Кнопка закрытия

### 1.8 Mobile UX

Full-screen карта + bottom sheet:
- `.me-panel` трансформируется в bottom sheet (вместо side panel)
- Timeline упрощённый
- Крупные касательные зоны (min 44px)
- Упрощённые layer toggles

### 1.9 Semantic zoom

При уменьшении зума:
- Sea labels → opacity 0.55 → 0.2 → 0.07
- Region labels → opacity 0.4 → 0.07
- Sub-labels (lbl-z1, lbl-z2) → fade out

### 1.10 Share state

`?story=main&place=rameses&zoom=1.2` — URL отражает состояние карты.

---

## 2. НЕ АТЛАСНОЕ — НЕ ДЕЛАТЬ

### 2.1 Не делать отдельный HTML/CSS/JS на карту

❌ НЕ создавать `karty/ishod/custom-engine.js` или `karty/ishod/styles.css`  
✅ Все карты через единый `MapEngine.createMap()`

### 2.2 Не делать iframe/modal как основу

❌ НЕ строить `/karty/app` который загружает карты в iframe/modal  
✅ Каждая карта — отдельная страница с canonical URL, OG, JSON-LD

Исключение: iframe можно использовать позже для **embed-превью** внутри статей (маленькие карточки-превью маршрута в тексте статьи).

### 2.3 Не копировать монолит Авраама как шаблон

❌ НЕ использовать `karty/avraam/index.html` (2385 строк inline монолит) как шаблон  
✅ Авраам — protected pilot (28/28 audit ✅). Использовать только как источник данных `route.json`.

### 2.4 Не делать гигантский SVG прямо в HTML

❌ НЕ вставлять `<svg>...500KB SVG...</svg>` inline в HTML  
✅ SVG загружается через движок, подложка через `baseGeoUrl` опцию

### 2.5 Не перегружать карту текстом

❌ НЕ вставлять большие цитаты, длинные справки, десятки карточек одновременно  
✅ Карта показывает слой и контекст; подробности — в панели

### 2.6 Не делать GIS/tile-based карту

❌ НЕ использовать MapLibre/Leaflet как основу для библейской SVG-картографии  
✅ Плановая SVG-проекция (x/y в route.json — не lat/lng). Библии нужны авторские подписи, спорные зоны, ручная композиция.

### 2.7 Не смешивать с другими типами интерактива

❌ НЕ использовать MapEngine для `/rodosloviye/` (родословное древо) или `/map/` (карта связей сайта)  
✅ `/rodosloviye/` → React Flow + ELK  
✅ `/map/` → Sigma.js + Graphology  
✅ `/karty/` → MapEngine SVG/Canvas

### 2.8 Не пытаться сделать идеальный атлас сразу

❌ НЕ реализовывать за один этап: compare mode, full semantic zoom, advanced source panels, mini map, search, keyboard navigation, research mode, synchronized Bible text, full timeline, all layer controls  
✅ Сначала — вертикальный срез (minimal pilot):
1. route.json грузится
2. base-geo.svg отображается (опционально)
3. маршруты рисуются
4. маркеры работают (click → panel)
5. подписи не налезают критически
6. story filter работает
7. zoom работает
8. theme toggle работает
9. share button работает
10. panel tabs (description/bible/arch/photos)
11. мобильный viewport рендерит корректно
12. initial viewport из route.json

Потом добавлять: mini map, compare mode, semantic zoom, search, keyboard nav, timeline, source panels.

### 2.9 Не забывать audit gate

❌ НЕ публиковать карту как готовую, пока не пройден визуальный QA  
✅ Принцип: «1 карта открыта, остальные на аудите»

Чеклист перед открытием карты:
- [ ] initial viewport корректный
- [ ] label collision проверен
- [ ] desktop + mobile рендер
- [ ] слои и controls работают
- [ ] маршрут читаем
- [ ] owner review пройден

### 2.10 Не добавлять !important без обоснования

❌ НЕ добавлять `!important` в CSS без письменного обоснования  
✅ Лимит: ≤200 !important в `css/site.css` (AGENTS §4.10)

Исключения (всегда обоснованы):
- Hebrew font-stack override (`[lang=he]`, `[lang=iw]`)
- Theme toggle flex display (body.has-bottom-bar)
- GBS2 series link underline suppress

---

## 3. АРХИТЕКТУРНЫЕ РЕШЕНИЯ

### 3.1 MapEngine как центр

```
karty/_engine/map-engine.js v0.52
  └── MapEngine.createMap(container, routeData, opts)
        ├── injects CSS inline (no external CSS file needed)
        ├── creates .me-map DOM structure
        ├── renders SVG (routes, markers, labels, ctx, regions)
        ├── manages state: activeStory, activePlace, tour, zoom, pan
        └── exposes MapInstance API: openPlace, setStory, flyTo, startTour, destroy
```

### 3.2 Новая карта — минимальный план

1. Создать `karty/{id}/index.html` (shell по шаблону выше)
2. Проверить `route.json` валидацию: `node scripts/validate-map-routes.js`
3. Запустить smoke test: `node scripts/ishod-qa.js` (адаптировать для новой карты)
4. Visual QA: screenshot desktop + mobile
5. Проверить label collision, viewport, story filter, panel tabs
6. Owner review
7. Обновить хаб: "N карт открыта, остальные на аудите"
8. Push

### 3.3 CSS tokens — эра и тема

```css
/* Эра задаёт цветовую схему карты */
[data-era="bronze"]      { --route-color: #e8c879; --bg: #070a10; }
[data-era="bronze_late"] { --route-color: #e8c879; --bg: #070a10; }
[data-era="iron"]        { --route-color: #9fc0dd; --bg: #070a10; }
[data-era="roman"]       { --route-color: #c7a5ff; --bg: #070a10; }
[data-era="byzantine"]   { --route-color: #9ee7ad; --bg: #070a10; }
```

Темы: dark (default) / light:
```css
html.dark  { --bg: #070a10; --txt: #e9e4d6; --gold: #e8c879; }
html.light { --bg: #f7f1e8; --txt: #1a1a1a; --gold: #9f7b35; }
```

### 3.4 Пуш из sandbox

```bash
cd gb-refresh
git add .
git commit -m "feat(karty/{id}): connect {id} to MapEngine v0.52"
git push origin main
```

---

## 4. ВАЛИДАЦИЯ

Перед каждым push:
```bash
npm run maps:validate   # 10/10 ✅
npm run avraam:audit    # 28/28 ✅
node --check karty/_engine/map-engine.js  # OK
npm run validate:all    # PASS
node scripts/audit-pro.js  # PASS (164 checks)
```

После изменений в CSS/JS:
```bash
npm run cache-bust
```

После добавления карты:
```bash
node scripts/ishod-qa.js   # 34 checks desktop + mobile
```

---

## 5. REFERENCES

- `docs/MAPS-RD-MASTERPLAN-2026.md` — полное ТЗ карт
- `docs/MAPENGINE_PROFESSIONAL_STRATEGY_2026-06-17.md` — план извлечения фич
- `docs/MAPS-FLAGSHIP-ARCHITECTURE-2026-06-18.md` — ADR «все флагман»
- `docs/design-references/` — визуальные референсы (curated, 43 webp, 4.4MB)
- `karty/_shared/README.md` — API движка
- `karty/_shared/route.schema.json` — JSON Schema контракта данных
- `scripts/ishod-qa.js` — smoke test для ishod (34 checks, desktop + mobile)
