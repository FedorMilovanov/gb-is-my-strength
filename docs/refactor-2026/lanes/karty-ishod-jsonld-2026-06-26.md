# Lane: karty-ishod-jsonld-2026-06-26

**Date:** 2026-06-26
**Mode:** LANE (1 file, structured-data fix)
**Branch:** `lane/karty-ishod-jsonld-2026-06-26`
**Base:** `106f98d`
**Goal:** исправить невалидный JSON-LD на `/karty/ishod/` (AuditRepo: S3-N5 / old P0-02 / dist-contract N-2026-06-26-04 / PFV-002).

## Проблема

`src/components/karty/ishod/IshodPageHead.astro` (строка 39) — inline `@graph` JSON-LD,
у узла `Organization` лишняя закрывающая `}`:

```
..."sameAs":["...vk.com/curtmf"]}},{"@type":"WebSite"...
                                 ^^ должно быть ]}
```

`JSON.parse` падает на позиции 344. Это **source of truth**, поэтому ошибка попадала в dist
(production), хотя legacy root `karty/ishod/index.html` был уже починен ранее — классический
build-mode trap, из-за которого ранние reverify ошибочно считали баг закрытым.

## Исправление

`]}},{"@type":"WebSite"` → `]},{"@type":"WebSite"` (убрана одна лишняя `}`). 1 строка.

## Проверки (source + build + dist)

- `JSON.parse` inline-блока IshodPageHead.astro — ✅ OK
- legacy root `karty/ishod/index.html` — уже был валиден (0 `]}}`), не трогался
- `strangler:build:production-like` — ✅ 52 pages
- `dist/karty/ishod/index.html` — JSON-LD errors: **0**
- Полный свип `dist/**/*.html` — **0** JSON-LD ошибок по всему сайту

## Scope guard

Только 1 файл, только структурные данные. Рекомендация на будущее (из dist-contract-verifier):
добавить `dist:jsonld:audit` gate — корневой `seo-audit.js` не валидирует dist, из-за чего баг и выжил.

## FULL gate

`validate:static-publication` целиком не гонялся (ресурсы песочницы). Build + dist JSON-LD sweep
зелёные. Рекомендуется финальный полный прогон на CI.
