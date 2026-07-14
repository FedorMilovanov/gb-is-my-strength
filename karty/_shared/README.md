# karty/_shared/ — API Documentation

**Owner:** `karty/_engine/map-engine.js`  
**Schema:** `route.schema.json` (JSON Schema draft 2020-12)  
**Status:** Level0 gates closed; API contract stable.

---

## 1. Route JSON Schema

Every map route file (`route.json`) must conform to `route.schema.json`.

### Required top-level fields

```typescript
{
  meta: {            // required
    id: string,      // kebab-case, e.g. "avraam"
    title: string,   // human-readable, e.g. "Путь Авраама"
    era: string,     // e.g. "Быт. 11–25, ~2000–1800 до н.э."
    stats: object,   // arbitrary (used in UI: places count, stages count, etc.)
    viewport_init: { cx: number, cy: number, w: number }  // initial camera
  },
  stories: [         // required, minItems: 1
    {
      id: string,    // kebab-case, e.g. "lech-lecha"
      label: string, // short label, e.g. "Лех-леха"
      place_ids?: string[],
      stage_ids?: number[],
    }
  ],
  places: [          // required, minItems: 1
    {
      id: string,    // kebab-case, e.g. "ur"
      name: string,  // e.g. "Ур Халдейский"
      x: number,     // canvas coordinate
      y: number,     // canvas coordinate
      type: string,  // "settlement" | "journey" | "battle" | "event" | "marker"
      stage: number, // 0-indexed stage index
      story?: string,// story id (optional)
      he?: string,   // Hebrew name for bilingual display
    }
  ],
  stages: [          // required, minItems: 1
    {
      n: string,     // short label, e.g. "I"
      t: string,     // full title, e.g. "Ур → Харран"
      r: string,     // description
      paths?: [number, number][]  // polyline waypoints for stage path drawing
    }
  ]
}
```

### Optional fields

- `ctx`: array of contextual/geographic reference points (shown as background markers)
- `verified_waypoints`: array of arch-verified location coordinates
- `scientific_variants`: object with alternative localization options per place

---

## 2. MapEngine Public API

Loaded from `karty/_engine/map-engine.js`. Provides a reusable SVG-based map engine.

### Static methods

```javascript
// Load + normalize a route.json file
MapEngine.loadRoute(url: string, opts?: {credentials?, headers?}): Promise<NormalizedRoute>

// Validate a route object (for QA after editing route.json)
MapEngine.validateRoute(route: object): {
  ok: boolean,
  errors: string[],
  warnings: string[],
  stats: { places, stages, stories, ctx }
}
```

### Instance methods

```javascript
// Initialize engine with route data
engine = MapEngine.init({
  svgId: string,              // SVG element id for the map canvas
  routeData: NormalizedRoute, // from loadRoute() or direct normalization
  onPlaceOpen: (place) => void,  // callback when a place is selected
  onStageChange: (stage) => void,// callback when active stage changes
  onStoryChange: (story) => void // callback when active story changes
})

// Camera control
engine.flyTo(cx: number, cy: number, w: number, duration?: number)
// cx/cy = viewport center in map coordinates
// w = viewport width in map units
// duration in ms (default: smooth animation)

engine.setZoom(factor: number)  // 1 = 100%, 2 = 200%, 0.5 = 50%

// Navigation
engine.openPlace(id: string)  // show place details panel + fly to
engine.setStory(storyId: string)  // highlight places/stages for a story
engine.nextPlace()            // advance to next place in current story
engine.prevPlace()            // previous place
engine.startTour()            // auto-advance through story places
engine.stopTour()             // stop auto-tour

// State & sharing
engine.getState(): {
  place: string | null,       // current place id
  story: string | null,       // current story id
  stage: number | null,       // current stage index
  zoom: number,               // current zoom factor
  view: { cx, cy, w }         // current viewport
}
engine.shareURL()             // update URL hash with current state

// Cleanup
engine.destroy()              // remove event listeners, stop tour
```

### Normalized route structure

```javascript
{
  meta: { id, title, title_he?, subtitle?, era, stats, viewport_init },
  stories: [{ id, label, description?, place_ids?, stage_ids? }],
  places: [{ id, name, he?, x, y, type, stage, story?, era?, bible?, arch? }],
  stages: [{ n, t, r, paths? }],
  ctx: [{ id?, name?, x, y, type?, label? }],
  yec_position?: { ... }  // young earth creationism position data
}
```

---

## 3. Map Coordinates System

- Canvas: 1900×1430 logical units (W0×H0)
- Initial viewport for avraam: cx=950, cy=715, w=1900 (full view)
- Pad space: 450px left, 380px top (reserved for labels/UI overlay)
- Zoom range: minW=240, maxW=2600
- All places/stages defined in canvas coordinates

---

## 4. Adding a new map (Sprint N process)

1. Create `karty/{slug}/route.json` conforming to `route.schema.json`
2. Run `node scripts/validate-map-routes.js` to QA
3. Run `node scripts/avraam-map-audit.js` for avraam-specific checks
4. Add `karty/{slug}/index.html` — standalone page with inline map engine OR use MapEngine API
5. Add to `data/series.json` if it's a series landing
6. Update `migration/page-ownership.json` if migrating to Astro

---

## 5. Current state (2026-07-10)

Полный live-инвентарь всех карт: `node scripts/atlas-inventory.js` → `data/atlas-inventory-baseline.json` + `reports/atlas-inventory.md`
(единственный источник счётчиков — таблицу здесь больше не дублируем, см. Single-Writer-Per-Fact).

Сводка на 2026-07-10: **10 карт** с route.json (133 места, 47 этапов, 52 истории, 84 научных
варианта). Production-режим всех `/karty/*` маршрутов — Astro (`page-ownership.json`):
avraam и ishod = strict-native-app на `MapEngine.createMap()`, остальные 8 = holding pages
(`temporary-placeholder`) до прохождения гейтов публикации.

Контракты Атласа (архетипы, координатные семейства, словарь уверенности, гейты G1–G9):
**`docs/ATLAS-CONTRACT-2026-07-10.md`** — читать перед любой работой с картами.

---

## 6. Prohibition

- **Do not** edit `karty/_engine/map-engine.js` without running `npm run avraam:audit` afterwards
- **Do not** change coordinate system (W0/H0) without updating all route.json files
- **Do not** rename place `id` fields without updating all story `place_ids` references
- Route.json files are the single source of truth — don't duplicate place data inline in HTML