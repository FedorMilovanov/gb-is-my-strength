# Agent 07 — честный Offline/PWA

**Дата:** 2026-08-01  
**Решение:** `REBUILD_CURRENT_MAIN`  
**Статус:** `IMPLEMENTATION_IN_PROGRESS`  
**Production claim:** `no`

## Почему runtime не удалён

Root Service Worker и offline toast реально подключены к публичным страницам. Полное удаление убрало бы полезную возможность повторно открыть посещённую страницу без сети. Поэтому Agent 07 сохраняет один существующий runtime owner и устраняет ложные обещания и fail-open поведение.

## Подтверждённые дефекты прежнего owner

- install использовал `Promise.allSettled`, поэтому новый SW мог активироваться с частичным precache;
- HTML navigation использовал stale-while-revalidate, поэтому старый cache выигрывал у свежего online response;
- versioned `?v=` request не мог использовать current unversioned precache offline;
- `/data/*.json` был cache-first и мог бессрочно сохранять исправленные данные до ручного cache bump;
- runtime eviction опирался на in-memory `Map`, теряя порядок после restart;
- `CACHE_ARTICLE` и background sync существовали как orphan API без source producer/state owner;
- offline toast сообщал, что кэшированные статьи доступны, не проверяя текущий route.

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

## A03 Offline Series boundary

Все routes, включая `/baptisty-rossii/`, используют один автоматический route-level contract. Отдельный `CACHE_ARTICLE` marker/state/controller отсутствует; dead manual message/sync API удаляется и запрещается static gate.

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
- branch cleanup;
- production deployment не заявляется без отдельного live witness.
