# Lane: premiumcontrols-heart-series-wiring-2026-06-26

**Date:** 2026-06-26
**Mode:** LANE (route-scoped, 2 files)
**Branch:** `lane/premiumcontrols-heart-series-wiring-2026-06-26`
**Base:** `106f98d`
**Goal:** оживить мёртвые PremiumControls (Play/Save) на heart-series статьях (AuditRepo: PC-002).

## Проблема (PC-002)

Статьи серии «Тайны человеческого сердца»:
- `/articles/krajne-li-isporcheno-serdce/` (`KrajneBody.astro`)
- `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/` (`Rimlyanam7Body.astro`)

рендерят в `.gbs2-rfoot` кнопки `gb-ember` (Play) и `gb-save` (Save) с `data-fc-action`,
но контейнер **не имел** `data-fc-root` / `data-fc-controls`. Контроллер
`floating-cluster-controller.js` инициализирует клики только внутри таких корней:

```js
// initPlayExpand()
if (!ember.closest('[data-fc-root], [data-fc-controls]')) return;
// MAIN INIT
var roots = qsa('[data-fc-root]'); roots.forEach(root => initCluster(root));
```

Итог: Play и Save были видимы, но **не работали** (init никогда не доходил до этих кнопок).

## Исправление

Добавлен `data-fc-root data-fc-mode="series-rich" data-fc-variant="heart"` на `.gbs2-rfoot`
в обоих компонентах — точно по образцу рабочей Нагорной
(`NagornayaChast1PageChrome.astro`: `nag-sidebar-controls` имеет
`data-fc-root data-fc-mode="series-rich" data-fc-variant="nagornaya"`).

`series-rich` корректно обрабатывается main-init: `initCluster(root)` навешивает делегирование
кликов на play/save/theme/search/font; `data-gbs2-theme`/`data-gbs2-search` в mobile-head
уже обслуживаются глобально через `initGillRail()`.

Diff: 2 файла, 2 строки.

## Проверки (source + build + BROWSER witness)

### Static / build
- `astro:check` — ✅ 0 errors, 0 warnings (13 pre-existing hints)
- `strangler:build:production-like` — ✅ 52 pages, postbuild cache-bust converged drift→0
- dist обеих страниц: `.gbs2-rfoot` несёт `data-fc-root … series-rich … heart`, контроллер `?v=ba4a4019` (актуальный) присутствует.

### Browser witness (Playwright Chromium, production-like dist)
На обеих страницах:
- `root._gbClusterInit` = **true** (раньше false)
- `window.__gbCluster` = object (контроллер инициализирован)
- Save: `aria-pressed` false → **true** при клике ✅
- Play: speed-panel (`.gb-ember-expand`) **открывается** при клике ✅
- console errors: **0**

> Примечание по build-mode trap: при плоском `astro:build` (без `copy-legacy-to-dist`)
> JS/CSS/шрифты отсутствуют в dist → 404 и контроллер не грузится. Корректная проверка —
> только `strangler:build:production-like`. На нём всё зелёное.

## Связь с другими находками
- **S3-N4 / PC-003** (cache-bust не переписывает `src/*.astro`): на этих страницах
  hardcoded `?v=efd81d3a` устаревший; postbuild `astro-cache-bust-postbuild.js` чинит dist,
  но source остаётся stale. Этот баг **не** в scope данной lane (отдельная системная lane),
  однако подтверждён здесь как причина первоначальных 404 при неполной сборке.
- Остальные PremiumControls-находки (PC-001 anchor, PC-004 canonical CSS, PC-005 PlayEmber
  семантика, PC-006 archetype audit) — отдельные lane согласно proposal
  `premiumcontrols-feature-completion-2026-06-26`.

## Scope guard
Только 2 файла, только добавление data-атрибутов на контейнер. Не трогались: JS-контроллер,
CSS, другие маршруты, контент.

## FULL gate
`validate:static-publication` целиком в песочнице не гонялся (ресурсы). astro:check +
production-like build + browser smoke — зелёные. Рекомендуется финальный полный прогон на CI.
