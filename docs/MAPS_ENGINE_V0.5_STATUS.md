# MAPS ENGINE — STATUS (updated 2026-06-18)

> **Внимание:** этот документ изначально описывал v0.5 (2026-06-16). Движок
> развился до v0.44+ (~2276 строк). Точная архитектура — в `AGENTS.md` §12.5.
> Файлы `modules/` (map-data.js, map-render.js, timeline.js) — **мёртвый код**,
> не интегрированы в map-engine.js.

## Текущее состояние (2026-06-18)

**Архитектура:** единый `karty/_engine/map-engine.js` (~2276 строк) — самодостаточный.
- `MapEngine.createMap(container, route, opts)` — главная точка входа
- 10 карт используют движок (avraam — только DATA API, остальные — createMap)
- `_on()` helper трекит слушателей, `destroy()` + `_cleanupAll()` освобождают
- Встроенный CSS через `me-base-css` style element

**Актуальная документация:** `AGENTS.md` §12.5 (структура, правила, история регрессий).
**Стратегия:** `docs/MAPENGINE_PROFESSIONAL_STRATEGY_2026-06-17.md`.
