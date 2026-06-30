# Deep Code Audit — Костыли, дублирование, слабости
**Date:** 2026-06-30  
**Auditor:** Arena Agent (60+ проверок)  
**HEAD:** 27862d4d  

---

## 🔴 FIXED — P1: SW CACHE_VERSION застыла на 20260625
**Файл:** `sw.js`  
**Проблема:** CACHE_VERSION не обновлялась с Jun 25, хотя после этой даты изменились:
- `js/floating-cluster-controller.js` (Gill progress, fontScale persist, normalizePath)
- `js/bookmark-engine.js` (collect-then-delete)
- `js/highlights.js` (Invalid Date guard)
- `js/search.js` (safeUrl XSS fix)
- `css/floating-cluster.css` (V3 mobile block)

Пользователи с кешем v176 получали старый JS без патчей.  
**Fix:** CACHE_VERSION → `gb-v177-security-font-normpath-20260630` (этот коммит)

---

## 🟡 OPEN — P2: search.js te() — неверная глубина без trailing slash
**Файл:** `js/search.js` функция `te()`  
**Проблема:** `/articles/foo` (без trailing slash) → e=1 → `'../'` вместо `'../../'`  
pagefind.js ищется по неверному относительному пути → поиск не загружается.  
**Mitigation:** все страницы сайта генерируются с trailing slash → практически не проявляется.  
**Recommendation:** добавить нормализацию: `if (!p.endsWith('/')) p += '/'` перед подсчётом slashes.  
**Status:** OPEN — требует owner-решения (изменение в minified файле)

---

## 🟡 OPEN — P2: data-gill-current-part добавлен в HTML но не используется в JS
**Файл:** `src/components/article-pilots/gill-series/GillSeriesOverlay.astro`  
**Проблема:** `data-gill-current-part="true"` на `<a>` элементе генерируется Astro,  
но `js/floating-cluster-controller.js` не читает этот атрибут (использует `is-current` класс).  
**Статус:** декоративный атрибут, не баг функциональности. Либо использовать в JS как альтернативный selector, либо удалить.

---

## 🟡 OPEN — P2: assetUrl() / ASSET_VERSIONS — мёртвый экспорт (PC-004)
**Файл:** `src/lib/asset-version.js`  
**Проблема:** 493 `?v=` ссылки в 401 Astro-компонентах хардкожены вручную.  
`assetUrl()` экспортируется но ни один компонент его не импортирует (0 hits).  
cache-bust.js обновляет ссылки через sed/regex, минуя TypeScript-типизированный API.  
**Recommendation:** либо подключить `import { assetUrl }` во все компоненты (большая задача),  
либо убрать экспорт и документировать что cache-bust.js — единственная точка обновления.  
**Status:** OPEN — требует owner архитектурного решения

---

## 🟡 OPEN — P3: openSearch() — массив из 7 legacy селекторов
**Файл:** `js/floating-cluster-controller.js`, функция `openSearch()`  
**Проблема:** 7 fallback-селекторов (`#searchToggle`, `#searchButton`, `#hCpBtnNav` и др.)  
ни один из которых не присутствует в текущих HTML страницах.  
Только `[data-gbs2-search]` используется, но обрабатывается отдельным capture handler.  
**Risk:** низкий — лишние querySelector, не влияет на поведение.  
**Recommendation:** сократить массив до 2-3 актуальных селекторов + CustomEvent fallback.

---

## 🟡 OPEN — P3: GBS2-theme обрабатывается в 3 местах
**Файл:** `js/floating-cluster-controller.js`  
**Проблема:** `data-gbs2-theme` click → три обработчика (initCluster bubble, initGillRail forEach, ready() capture).  
Проверено: runtime double-toggle НЕ происходит (capture + stopPropagation + отдельные DOM-деревья).  
**Risk:** архитектурный долг — трудно читать и поддерживать.  
**Recommendation:** убрать initCluster bubble-check для gbs2-theme (оставить только capture + forEach).

---

## 🟡 OPEN — P3: highlights.js — нет confirm перед удалением цитаты
**Файл:** `js/highlights.js`  
**Проблема:** кнопка удаления цитаты срабатывает без подтверждения и без undo.  
Пользователь случайным тапом теряет сохранённую цитату безвозвратно.  
**Recommendation:** добавить `if (!confirm('Удалить цитату?')) return;` или Toast с Undo на 5 секунд.

---

## 🔵 INFO: CSS media query consolidation opportunity
**Файл:** `css/floating-cluster.css`  
`@media (hover: hover)` — 27 раз, `@media (max-width: 899px)` — 6 раз.  
37 из 50 media-блоков избыточны. Консолидация снизит размер файла.  
**Risk:** нулевой, косметика. Не приоритет пока файл <50KB.

---

## 🔵 INFO: enhancements.js и highlights.js — style inject без ID guard
**Файлы:** `js/enhancements.js`, `js/highlights.js`  
При двойной загрузке (SW cache race) создаются дублированные `<style>` теги.  
Стили idempotent → визуальных багов нет, но DOM засоряется.  
**Recommendation:** добавить `if (document.getElementById('gb-hl-styles')) return;` guard.

---

## 🔵 INFO: 19 дублированных функций-тел в scripts/visual-parity-*
Функции `stripTags`, `canonical`, `meta`, `mustEqual` скопированы в 4+ файлах.  
Нет общего `scripts/lib/audit-utils.js`. Рефакторинг снизит maintenance burden.

---

## СВОДКА
| Приоритет | Кол-во | Исправлено |
|---|---|---|
| P1 (критический) | 1 | ✅ 1 (SW CACHE_VERSION) |
| P2 (средний) | 3 | 0 (требуют owner решения) |
| P3 (низкий) | 3 | 0 (архитектурный долг) |
| INFO | 3 | — |

*Предыдущие P2 баги (fontScale, normalizePath, bookmark-engine, highlights, search.js safeUrl) — закрыты в предыдущих коммитах.*
