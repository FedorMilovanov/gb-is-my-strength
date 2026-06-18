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
