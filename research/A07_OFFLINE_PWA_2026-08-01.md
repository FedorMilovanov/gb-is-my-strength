# Agent 07 — честный Offline/PWA

**Первичная дата:** 2026-08-01  
**Current-main recovery:** 2026-08-03  
**Решение:** `REBUILD_CURRENT_MAIN`  
**Статус:** `CURRENT_MAIN_IMPLEMENTED_PENDING_EXACT_HEAD_CI`  
**Current source anchor / rollback:** `29a781d97b7915cf0993ede379d96ea6fd5e261f`  
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

Archive-ветка отставала от current `main` более чем на сто коммитов и не сливалась. На новую canonical branch перенесены только девять semantic-файлов A07:

1. `.github/workflows/deploy-candidate-contract.yml`;
2. `data/offline-route-matrix.json`;
3. `js/sw-register.js`;
4. `migration/sw-cache-version-baseline.json`;
5. этот research-документ;
6. `scripts/reader-state-regression-test.js`;
7. `scripts/sw-dist-readiness-audit.js`;
8. `scripts/sw-offline-browser-test.mjs`;
9. `sw.js`.

Generated HTML, Astro components, asset-revision projections и другие архивные файлы не восстанавливались из archive.

## Canonical asset-revision transaction

Source-only Metadata gate на первом current-main head правильно обнаружил 57 stale references после изменения `js/sw-register.js`. Старые архивные однострочные проекции не копировались. Канонический `node scripts/cache-bust.js --write` материализовал текущий hash `?v=3fbabcf1` из фактических bytes ветки и обновил только:

- `src/lib/asset-version.js`;
- существующие HTML references;
- существующие Astro references.

Transaction commit: `a46257cf7482949bc63d4db3b5d2e5f86472b7ae`. Одноразовый workflow удалил себя в том же коммите и отсутствует в финальном дереве. Никакой второй runtime, ручной массовой подстановки или архивной HTML/Astro-реставрации не осталось.

## Почему runtime не удалён

Root Service Worker и offline toast реально подключены к публичным страницам. Полное удаление убрало бы полезную возможность повторно открыть посещённую страницу без сети. Поэтому Agent 07 сохраняет один существующий runtime owner и устраняет ложные обещания и fail-open поведение.

## Один current owner

- runtime: `sw.js`;
- registration/UI: `js/sw-register.js`;
- contract data: `data/offline-route-matrix.json`;
- static gate: `scripts/sw-dist-readiness-audit.js`;
- physical Chromium witness: `scripts/sw-offline-browser-test.mjs`;
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
- Pagefind bootstrap/static: cache-first;
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
