# Lane: system-cache-bust-astro-source-2026-06-26

**Date:** 2026-06-26
**Mode:** SYSTEM (shared tooling: `scripts/cache-bust.js`)
**Branch:** `lane/system-cache-bust-astro-source-2026-06-26`
**Base:** `106f98d`
**Goal:** устранить системный корень hash-drift (AuditRepo: S3-N4 / PC-003 / P0-10) — `cache-bust.js` не переписывал `src/*.astro`.

## Корневая причина

`scripts/cache-bust.js` (`collectHTML`) **намеренно пропускал `src/`**, переписывая `?v=HASH`
только в legacy/public HTML. Но Astro-компоненты хардкодят `?v=HASH` для тех же общих CSS/JS.
Итог: хеши в `src/**/*.astro` дрейфовали навсегда; консистентность dist держалась
**только** на `astro-cache-bust-postbuild.js` (rescue-проход, 527 замен на каждой сборке).

Это и был «двигатель» рецидивов P0-10: каждое изменение `floating-cluster-controller.js` и т.п.
оставляло `src` со старым хешем (`efd81d3a`), хотя реальный файл — `ba4a4019`.
Подтверждено браузером в lane PC-002: при неполной сборке контроллер 404-ил из-за этого.

## Исправление

`scripts/cache-bust.js`: добавлены `collectAstro()` + `bustAstroFile()`. Теперь скрипт после
прохода по HTML обходит `src/**/*.astro` и переписывает `?v=HASH`.

**Строгий режим для Astro:** в отличие от legacy HTML, для `.astro` мы НЕ добавляем `?v=` там,
где его не было — только переписываем уже существующий `?v=<8 hex>` (та же проверенная регулярка,
что в `astro-cache-bust-postbuild.js`). Это исключает попадание в import-строки, комментарии,
data-атрибуты.

## Эффект

- Все 18 общих ассетов в `src/` теперь имеют корректный хеш (было: `fc-controller` 3 версии, 0 верных).
- 38 Astro-компонентов синхронизированы (171 ins / 112 del).
- Скрипт **идемпотентен**: повторный прогон → 0 изменений.
- `astro-cache-bust-postbuild.js` после сборки теперь рапортует **Files touched: 0, Hash replacements: 0**
  (раньше — 527). Postbuild стал чистым safety-net, источник правды — сам `src`.

## Проверки

- `node -c scripts/cache-bust.js` — ✅ syntax OK
- `node scripts/cache-bust.js --dry-run` → 38 Astro, 0 HTML; повторный прогон → 0 (идемпотентно)
- import-строки не тронуты (`git diff | grep import.*?v=` → пусто)
- `strangler:build:production-like` — ✅ 52 pages; postbuild drift **0/0**
- `node scripts/audit-pro.js` — ✅ AUDIT PASSED — ready for deploy
- `npm run data:consistency` — ✅ passed
- `npm run guard:shared-files` — ✅ (lane-tagged commit)

## Scope guard

Затронут только `scripts/cache-bust.js` (логика) + 38 `src/**/*.astro` (механическая синхронизация
хешей, без изменения разметки/контента). Postbuild-скрипт не менялся (остаётся как safety-net).

## FULL gate

`validate:static-publication` целиком в песочнице не гонялся (ресурсы 2 CPU/~2 GB). audit-pro +
production-like build + guard:shared-files + data:consistency — зелёные. Рекомендуется финальный
полный прогон на CI.
