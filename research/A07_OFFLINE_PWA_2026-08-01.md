# Agent 07 — честный Offline/PWA

**Первичная дата:** 2026-08-01  
**Current-main recovery:** 2026-08-03  
**Решение:** `REBUILD_CURRENT_MAIN`  
**Статус:** `CURRENT_MAIN_IMPLEMENTED_PENDING_EXACT_HEAD_CI`  
**Original source anchor / rollback:** `29a781d97b7915cf0993ede379d96ea6fd5e261f`  
**Clean-lane base:** `c247ebbf782f16304e5d0d1681f6c2d7983b3099`  
**Clean implementation anchor:** `9961a9d9c615071c791772d26647ec5a0850a96c`  
**Recovery source:** `archive/offline-pwa-working-20260801` — selective recovery only  
**Production claim:** `no`

## Current-main reverify

Перед восстановлением реализации семь прежних дефектов повторно проверены на exact source anchor `29a781d97b7915cf0993ede379d96ea6fd5e261f` и классифицированы как `CONFIRMED-CURRENT`:

- install всё ещё использовал `Promise.allSettled`, поэтому новый SW мог активироваться с частичным precache;
- HTML navigation всё ещё использовал stale-while-revalidate, поэтому старый cache выигрывал у свежего online response;
- versioned `?v=` request не мог использовать current unversioned precache offline;
- `/data/*.json` попадал в cache-first static strategy и мог сохранять устаревшие данные до cache bump;
- runtime eviction опирался на in-memory `Map`, теряя порядок после worker restart;
- `CACHE_ARTICLE` и background sync оставались orphan API без source producer/state owner;
- offline toast обещал доступность «кэшированных статей», не проверяя текущий route.

Archive-ветка отставала от current `main` более чем на сто коммитов и не сливалась. В clean lane перенесены только десять semantic owners A07:

1. `.github/workflows/deploy-candidate-contract.yml`;
2. `data/offline-route-matrix.json`;
3. `js/sw-register.js`;
4. `migration/sw-cache-version-baseline.json`;
5. этот research-документ;
6. `scripts/dist-publication-audit.js`;
7. `scripts/reader-state-regression-test.js`;
8. `scripts/sw-dist-readiness-audit.js`;
9. `scripts/sw-offline-browser-test.mjs`;
10. `sw.js`.

Оставшиеся 57 changed paths — только канонические asset-revision projections изменённого `js/sw-register.js`. Generated `dist`, архивные компоненты и временные workflow/materializer в clean tree отсутствуют.

## Canonical asset-revision transaction

Source-only Metadata gate на первом current-main head правильно обнаружил 57 stale references после изменения `js/sw-register.js`. Старые архивные однострочные проекции не копировались. Канонический `node scripts/cache-bust.js --write` материализовал current hash из фактических bytes ветки и обновил только существующие root/Astro references и registry owner.

Исходная transaction была доказана на commit `a46257cf7482949bc63d4db3b5d2e5f86472b7ae`; clean PR #819 squash-flattened итоговое permanent tree на current `main` как `9961a9d9c615071c791772d26647ec5a0850a96c`. Временная transport-history в clean PR не присутствует.

## Почему runtime не удалён

Root Service Worker и offline toast реально подключены к публичным страницам. Полное удаление убрало бы полезную возможность повторно открыть посещённую страницу без сети. Поэтому Agent 07 сохраняет один существующий runtime owner и устраняет ложные обещания и fail-open поведение.

## Один current owner

- runtime: `sw.js`;
- registration/UI: `js/sw-register.js`;
- contract data: `data/offline-route-matrix.json`;
- static gate: `scripts/sw-dist-readiness-audit.js`;
- physical Chromium witness: `scripts/sw-offline-browser-test.mjs`;
- publication parser: `scripts/dist-publication-audit.js`;
- exact candidate owner: `.github/workflows/deploy-candidate-contract.yml`.

Второй SW, второй registration runtime и второй offline state registry не создаются.

## Новый контракт

### Installation/update

- precache выполняется атомарно через `cache.addAll`;
- при любой ошибке staging static cache удаляется, install падает, старый worker остаётся;
- `skipWaiting()` вызывается только после полного precache;
- activation удаляет только старые governed `gb-*` caches;
- clients получают `GB_SW_ACTIVATED` после полного activation.

### Online/offline

- HTML navigation: network-first;
- cached route появляется только после успешного online response;
- offline fallback: exact route → canonical route → `/404.html`;
- versioned static online всегда проверяет сеть, offline использует exact revision или current canonical precache;
- mutable JSON and Pagefind index/fragment: network-first with exact offline fallback;
- Pagefind bootstrap/static: runtime Pagefind cache → atomic install-precache → network;
- images: cache-first с persistent timestamp metadata;
- TTS/audio/video/model/range requests: network-only, CacheStorage не используется.

### Honest UI

Offline toast проверяет именно текущий URL:

- `Вы офлайн — эта страница доступна`;
- либо `Вы офлайн — эта страница не сохранена`.

Blanket claim «кэшированные статьи доступны» удалён.

## Deterministic browser matrix

Chromium fixture обязан доказать:

1. cold atomic install;
2. forced partial precache failure → worker `redundant`, staging cache отсутствует;
3. online first load → offline reload exact route;
4. unvisited missing route → explicit 404 fallback;
5. update over old cache → old `gb-*` caches удалены, latest route response работает offline;
6. revisioned static offline canonical fallback;
7. mutable JSON freshness online and exact fallback offline;
8. Pagefind bootstrap/data boundary;
9. TTS/audio bypass and absence from CacheStorage.

## Exact verification chain

### Pagefind cache-owner repair

Deploy Candidate run `30771683015` и повторная current-branch диагностика доказали точную причину прежнего `Failed to fetch`: install сохранял `/pagefind/pagefind.js` в `*-static`, а fetch-handler искал bootstrap только в `*-pagefind`.

Commit `84800b56f04d62cdf1e16a32e9960e897678d15d` добавил bounded dual-owner lookup без ослабления негативных сценариев. На этой голове production-like build, Pagefind, static SW audit и deterministic Chromium Offline/PWA witness прошли; следующий общий publication gate тогда блокировался независимым stale Home-order guard, позднее закрытым отдельно.

### Publication parser repair

Current formatted `PRECACHE_ASSETS` больше не соответствует устаревшему single-line regex публикационного аудита. Clean implementation:

- парсит многострочный `PRECACHE_ASSETS`;
- разрешает обе quote styles и существующие uppercase string constants;
- сохраняет fail-closed возврат пустого списка на неизвестном token;
- подтверждает 31 precache entry, `/pagefind/pagefind.js` и `OFFLINE_FALLBACK`;
- не зависит от одного formatting style.

Первоначальный parser repair был materialized bot-коммитом `09eef30f77a3efead34378243a6a9bfdd8cd11bb`, из-за чего GitHub создал `action_required` runs без jobs. Это control-plane состояние устранено не пустым trigger-коммитом, а новым clean-history PR #819: итоговое permanent tree squash-flattened поверх current `main`, без временной workflow ancestry.

## Series/Reader boundary

Все routes, включая `/baptisty-rossii/`, используют один автоматический route-level contract. Отдельный `CACHE_ARTICLE` marker/state/controller отсутствует; dead manual message/sync API удаляется и запрещается static gate. ReaderState regression дополнительно фиксирует, что service-worker cache version и baseline остаются согласованными.

## Definition of done

Статус станет `DONE` только после:

- cache version/baseline atomic bump;
- production-like build;
- static SW audit;
- девяти Chromium scenarios;
- publication and URL contracts;
- all triggered exact-head workflows green;
- review threads = 0;
- guarded squash merge;
- merged-main verification;
- production deployment не заявляется без отдельного live witness.

## Current handoff

Authority принадлежит только clean PR #819 и его текущей exact head после этого evidence update. PR #787 закрыт без merge и не является merge-кандидатом. Любые receipts старых SHA сохраняются как причинная история, но не заменяют current exact-head fan-out.
