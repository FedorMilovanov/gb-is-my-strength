# MAPS ENGINE — STATUS (updated 2026-06-18)

> **Внимание:** этот документ изначально описывал v0.5 (2026-06-16). Движок
> развился до v0.45+ (~2300 строк). Точная архитектура — в `AGENTS.md` §12.5.
> Файлы `modules/` (map-data.js, map-render.js, timeline.js) — **мёртвый код**,
> не интегрированы в map-engine.js.

## Текущее состояние (2026-06-18)

**Архитектура:** единый `karty/_engine/map-engine.js` (~2300 строк) — самодостаточный.
- `MapEngine.createMap(container, route, opts)` — главная точка входа
- 10 карт используют движок (avraam — только DATA API, остальные — createMap)
- `_on()` helper трекит слушателей, `destroy()` + `_cleanupAll()` освобождают
- Встроенный CSS через `me-base-css` style element

**Актуальная документация:** `AGENTS.md` §12.5 (структура, правила, история регрессий).
**Стратегия:** `docs/MAPENGINE_PROFESSIONAL_STRATEGY_2026-06-17.md`.


## Update 2026-06-18 — v0.45 visual/evidence polish

- Stage routes now render with a soft underlay glow (`.me-route-underlay`) plus main route (`.me-route-main`).
- Route labels (`.me-route-label`) are generated per stage to make route structure more legible.
- Active-place route highlighting uses `data-stage`/`data-route-kind`, not fragile DOM indexes.
- Archaeology/evidence footer now adds compact source badges (primary / field / academic / conservative / heritage) derived from reference metadata.
- `smoke:maps` checks underlay/main route presence and route labels for all 9 engine-rendered maps.

## Update 2026-06-18 — v0.46 scientific variants + click regression guard

- Scientific variants tab supports canonical statuses: `consensus`, `primary`, `candidate`, `alternative`, `caveat`, `minor`, `rejected`.
- Variant rows now show cleaner labels, status colors, and optional source chips from `sources/source/src`.
- `maps:validate` validates variant statuses across all route files.
- `smoke:maps` now opens a marker and clicks the `sci` tab for each engine-rendered map with scientific variants.
- The new smoke caught and fixed a real regression: marker click crashed with `svg is not defined` because ripple code referenced a top-level `svg`; `addRipple(svg, ...)` now receives the SVG explicitly.

- Collapsible evidence footer: first two archaeology items visible by default; remaining items expand with a button.
- Smoke guard opens scientific tab and verifies sci items, source badges, and archaeology footer for every engine-rendered map.

## Update 2026-06-18 — v0.48 automatic story viewport

- Added `getStoryViewport(route, storyId)`: explicit `story.viewport/cam` wins, main uses `meta.viewport_init`, other stories use a padded bbox of their places.
- `setStory()` now always flies the map to the story focus area, even when route JSON lacks a manual viewport.
- `smoke:maps` clicks a secondary story chip and verifies that the SVG viewBox changes.

## Update 2026-06-18 — v0.49 data-driven signature overlays

- Added `route.signature` rendering for per-map character without copying renderers.
- `signature.type = "lampstands"` renders seven glowing lampstands (used by Revelation).
- `signature.type = "gospel-waves"` renders expanding gospel waves from an origin place (used by Early Church).
- `smoke:maps` now verifies signature DOM when `route.signature` exists.

## Update 2026-06-18 — v0.50 expanded signature overlays

- `signature.type = "water-split"` renders parted-water walls and a golden lane (used by Exodus / `ishod`).
- `signature.type = "sea-voyage"` renders ship icons/wakes along selected route points (used by Paul / `pavel`).
- `signature.type = "hanukkah-lights"` renders a Hanukkah menorah with animated flames (used by Maccabees / `maccabim`).
- Current signature maps: `ishod`, `pavel`, `maccabim`, `early-church`, `revelation`.
- Backward compatibility restored for old wrappers/modules that call `flyTo(cx, cy, zoomFactor)` with values like `0.72` / `0.85`; small positive values are converted to viewBox width to prevent collapsed 1px viewBoxes.
- `smoke:maps` and `smoke:maps:mobile` now print/check viewBox width (`viewW`) to catch future collapse regressions.

## Update 2026-06-18 — v0.51 signatures completed

- `signature.type = "split-kingdom"` renders North/South kingdom regions and a dividing line (used by Kings / `melachim`).
- `signature.type = "judge-cycles"` renders cyclical rings around key Judge-era places (used by Judges / `shoftim`).
- `signature.type = "tribe-stars"` renders a star network for tribal inheritances (used by Tribes / `shvatim`).
- `signature.type = "ministry-light"` renders a light trail through the Gospel chronology (used by Jesus / `yeshua`).
- All 9 engine-rendered maps now have a `route.signature`; Avraam remains its own protected flagship renderer.
