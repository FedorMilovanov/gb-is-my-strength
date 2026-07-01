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

---

## Обновление — 2026-07-01 (checks 161–200)

### ИСПРАВЛЕНО в этой сессии

**Deploy #1241 падение — root cause и fix:**

`openOverlay()` был изменён в предыдущей сессии на `SiteUtils.lockScroll()`.  
`SiteUtils.lockScroll` использует `body.style.position='fixed'`, а не `overflow='hidden'`.  
`gill-v16-mobile-play-smoke.js` проверяет `body.style.overflow === 'hidden'` → assert fail.  
**Fix:** откатить `openOverlay/closeOverlay/openSheet/closeSheet` к прямому `body.style.overflow`.  
Gill overlays имеют `z-index:2147483100` — `SiteUtils.lockScroll` для них не нужен.

---

### Подтверждено ОК (проверки 161–200)

| # | Проверка | Вердикт |
|---|---|---|
| 161 | openSheet double-open guard после реверта | ✅ guard сохранён |
| 162 | Smoke assert vs FCC overflow | ✅ совместимы теперь |
| 163 | testMobileOverlays (INTRO only) vs testMobPartTocBtn (all 5) | ✅ покрытие OK |
| 164 | normalizePath edge cases | ✅ все 8 сценариев верны |
| 165 | search.js te() trailing-slash fix | ✅ патч корректен |
| 166 | highlights.js Invalid Date guard | ✅ `isNaN(_d.getTime())` работает |
| 167 | deploy.yml step order (23 шага) | ✅ логически правильный |
| 168 | gill-mobile-layout-audit: 18 assert (alpha, contrast, overflow, label) | ✅ |
| 169 | sw:dist:audit:deploy-switch flags | ✅ `--require-cache-bump` |
| 170 | validate:static-publication: 35 шагов | ✅ audit-pro, consistency, guard |
| 171 | continue-on-error: 0 шагов | ✅ все blocking |
| 175 | isFavorite дважды читает LS | INFO (1x при загрузке) |
| 176 | toggleFavorite: setFavorites в if/else | ✅ не дублирование |
| 177 | getToast() lazy singleton | ✅ |
| 178 | updateGillProgress initial call | ✅ |
| 179 | pickRuVoice() кешируется + voiceschanged | ✅ |
| 180 | applyFontScale re-queries articleEl | INFO (приемлемо) |
| 181 | .toc-sheet__handle V3 !important override | ✅ |
| 186 | Two .toc-sheet__handle rules, V3 wins | ✅ |
| 187 | 2 document click listeners per ember (2 embers typical) | INFO |
| 188 | speakNextChunk event-driven, not true recursion | ✅ |
| 189 | SW CACHE_VERSION: gb-v177 | ✅ |
| 190 | SW precache без версионных URL | ✅ |
| 191 | updateScrollProgress vs updateGillProgress | ✅ distinct names |
| 192 | stripIds function: 2 mentions | ✅ |
| 194 | FONT_SCALE_KEY: isNaN + range + try/catch | ✅ |
| 195 | fontScale bounds [0.85, 1.25] | ✅ |
| 197 | updateProgress (TTS) → .gb-ember --p var | ✅ |
| 198 | Speed panel leaveTimer clearTimeout | ✅ |
| 199 | Speed panel Tab focus trap | ✅ |
| 200 | audit-pro final | ✅ 162 passed · 0 errors |

---

## Обновление — 2026-07-01 (checks 201–310)

### Новые открытые проблемы

---

## 🟡 OPEN — P3: favorites inline script — innerHTML без экранирования

**Файл:** `index.html` (inline `<script>` блок 5)  
**Проблема:** `f.title`, `f.description`, `f.section` из `localStorage['gb-favorites']` вставляются через `innerHTML` без HTML-экранирования.  
`f.image` подставляется в `style="background-image:url(...)"` без URL-sanitizer.

**Цепочка данных:**  
`toggleFavorite()` → `getPageMeta()` → OG meta теги страницы (owner-controlled) → `localStorage` → `innerHTML`

**Реальный вектор атаки:** DevTools manipulation OR prior XSS (same-origin требование).  
Данных от пользователя в этом потоке нет — риск **VERY LOW**.

**Рекомендация:**
```js
// Вместо innerHTML-конкатенации использовать textContent:
var titleEl = document.createElement('span');
titleEl.className = 'favorites-card__title';
titleEl.textContent = f.title || 'Статья'; // textContent экранирует
card.appendChild(titleEl);
// Для f.image — добавить URL-валидатор: /^https?:\/\//.test(url)
```

---

## 🟡 OPEN — P3: DEAD CODE — `src/components/genealogy/` (8 файлов, 56KB)

**Файлы:** `GenealogyTree.tsx`, `layout.ts`, `types.ts`, `theme.ts`, `DetailPanel.tsx`, `PersonNode.tsx`, `SplitView.tsx`, `TimelineAxis.tsx`  
**Проблема:** 0 importers в `src/`. `rodosloviye/index.astro` использует `RodoslaviyeBody.astro`, который **не импортирует** `GenealogyTree`.  
**Аналог:** `src/lib/premium-controls/` (задокументировано ранее) — тот же паттерн прототипного компонента без интеграции.  
**Зависимости:** `@dagrejs/dagre` и `@xyflow/react` в `devDependencies` — единственные потребители.  
**Recommendation:** владелец должен решить: интегрировать в `RodoslaviyeBody.astro` или удалить вместе с `@dagrejs/dagre`, `@xyflow/react`.

---

### Подтверждено ОК (проверки 201–310)

| # | Проверка | Вердикт |
|---|---|---|
| 201 | enhancements.js style injection context (btoc-seg-bar) | INFO: без guard, в IIFE, idempotent |
| 202 | openSearch() в enhancements.js — 4 селектора | ✅ 1 в Astro (#hCpBtnNav), fallback KeyboardEvent |
| 203 | `ready()` x5 в enhancements.js | ✅ каждый scoped в своём IIFE |
| 204 | openSearch().gb-fc-search — в dist не существует | INFO: FCC создаёт `.gb-fc-search` кнопку в DOM |
| 206–207 | series-cards.js — XSS via slug | ✅ slug из owner-controlled series.json |
| 208–210 | nagornaya-mobile-toc.js — SiteUtils guards | ✅ lockScroll корректен для nagornaya |
| 214–215 | nagornaya/index.html: nagornaya-toc(defer) < site-utils(sync) | ✅ defer всегда после sync |
| 216–218 | scroll-perf.js — ScrollBus, visualViewport, cleanup | ✅ |
| 219–221 | sw-register.js — 3 style injections без guard | INFO: documented |
| 222–226 | sitemap.xml — 43 URLs, 0 dupes, karty noindex→excluded | ✅ |
| 227–229 | JSON-LD 63 blocks — 0 errors, @graph корректен | ✅ |
| 230–235 | hreflang на 45 страницах, Gill pages без hreflang | INFO: ru-only site |
| 236–240 | glossary.js — guard, innerHTML из trusted dict | ✅ |
| 241–242 | 13 JSON файлов — 0 parse errors | ✅ |
| 243–244 | 20 MDX файлов — frontmatter OK, даты OK | ✅ |
| 245–247 | AGENTS.md — drift ±5 R.ok() | ✅ (within tolerance) |
| 248–250 | 87 scripts/ — все с shebang | ✅ |
| 251–254 | SW.js — skipWaiting, clients.claim, LRU, QuotaExceeded, conditional waitUntil | ✅ |
| 255–256 | asset-version.js 19 hashes + 477 HTML refs | ✅ все верны |
| 257–263 | CSS: z-index=2147483100 (< INT32_MAX), !important в V3 intentional | ✅ |
| 264–267 | try/catch coverage, empty catches — все для optional browser APIs | ✅ |
| 268–270 | safeUrl() — data: не блокирует, но pagefind index только site URLs | INFO |
| 271 | premium-controls dead module | ✅ (уже задокументировано) |
| 272 | GillPart*PageHead 73% identical | INFO (уже задокументировано) |
| 278–279 | validate.js — 0 errors, 2 warnings (intentional title≠og:title) | ✅ |
| 281–285 | package.json — 0 prod deps, 14 dev deps, 0 suspicious | ✅ |
| 286–288 | @dagrejs/@xyflow → genealogy/ dead code | P3 задокументировано |
| 289–291 | migration/ JSON — page-ownership 54 routes, SW baseline v177 | ✅ |
| 292–295 | workflows: 0 hardcoded tokens, issues:write permission | ✅ |
| 296 | robots.txt: Allow/Disallow правильны, /llms.txt для scrapers | ✅ |
| 297 | manifest.json — все required PWA fields | ✅ |
| 298 | 404.html — noindex, title, home link | ✅ |
| 302–308 | favorites inline: innerHTML из OG meta (owner-controlled) | P3 задокументировано |
| 310 | audit-pro: 162 passed · 0 errors | ✅ |

---

## Обновление — 2026-07-01 (checks 311–360)

### Новые открытые проблемы

---

## 🟡 OPEN — P3: DEAD CODE — `src/utils/legacyFullDocument.ts` и `legacyShadow.ts`

**Файлы:** `src/utils/legacyFullDocument.ts` (1KB), `src/utils/legacyShadow.ts` (3KB)  
**Проблема:** 0 importers в `src/`. Экспортируют `LegacyFullDocument`, `loadLegacyFullDocument`, `LegacyShadowPage`, `loadLegacyShadowPage`.  
**Аналог:** то же, что `premium-controls/` и `genealogy/` — прототипный/легаси код без интеграции.  
**Рекомендация:** удалить после подтверждения у владельца.

---

## 🔵 INFO: breadcrumb `<nav>` без `aria-label` в `baptisty-rossii/index.html`

**Файл:** `baptisty-rossii/index.html` (legacy HTML)  
**Проблема:** `<nav class="breadcrumb">` без `aria-label="Хлебные крошки"`.  
Astro-компоненты (например `AboutPageChrome.astro`) имеют правильный `aria-label`.  
**Severity:** очень низкая — screen reader объявит "навигация" (допустимо).  
**Рекомендация:** добавить `aria-label="Хлебные крошки"` в legacy HTML при следующем ручном обновлении файла.

---

## 🔵 INFO: nagornaya — 3 `<nav>` без `aria-label` на всех страницах серии

**Файлы:** `nagornaya/index.html`, `nagornaya/chast-1/index.html` … `nakhodki/index.html` (9 файлов)  
**Проблема:** breadcrumb nav, mobile-nav, btoc nav без `aria-label`.  
**Severity:** низкая — screen reader видит роль "navigation" без метки.  
**Рекомендация:** при рефакторинге nagornaya добавить `aria-label` на `<nav>` элементы.

---

### Полный реестр мёртвого кода в src/ (обновлён)

| Путь | Файлов | Размер | Причина |
|---|---|---|---|
| `src/lib/premium-controls/` | 6 | ~7KB | TS controller stubs, 0 importers |
| `src/components/genealogy/` | 8 | ~56KB | React GenealogyTree, 0 importers |
| `src/utils/legacyFullDocument.ts` | 1 | ~1KB | Legacy loader, 0 importers |
| `src/utils/legacyShadow.ts` | 1 | ~3KB | Legacy loader, 0 importers |
| **Итого** | **16** | **~67KB** | Owner решает: интегрировать или удалить |

---

### Подтверждено ОК (проверки 311–360)

| # | Проверка | Вердикт |
|---|---|---|
| 311–313 | site.js: 144 named functions, dupes — все в отдельных IIFEs | ✅ |
| 314–315 | SiteUtils.forceUnlockEmergency — определена в site.js, fallback в site-utils.js | ✅ |
| 316–320 | SiteBTOC, scrollRaf(RAF+passive), touch swipe detection | ✅ |
| 321 | site.js: eval() = 0 | ✅ CRITICAL |
| 322 | site.js: document.write() = 0 | ✅ |
| 323 | site.js: 61 innerHTML= — все из owner-controlled данных | ✅ |
| 324 | dangerouslySetInnerHTML: false | ✅ |
| 325 | insertAdjacentHTML — хардкоженная SVG иконка | ✅ |
| 326 | fetch(): 4 calls, все с .catch() | ✅ |
| 327–329 | setTimeout 45/clearTimeout 12 — 35 fire-and-forget, 10 saved→cleared | ✅ |
| 330–335 | innerHTML sources: quiz через tt() sanitizer, explanation из SITE_CONFIG | ✅ |
| 336 | src/data/site.ts — нет sensitive data, clean exports | ✅ |
| 337 | floating-cluster-ui.ts — 2 importers (FloatingCluster, SeriesLiteCluster) | ✅ |
| 338–341 | data-fc-root: krajne/rimlyanam7 legacy HTML без root, но Astro Body имеет | ✅ |
| 342 | content.config.ts Zod schema — min/max/regex/enum/superRefine | ✅ |
| 345 | astro.config.mjs — trailingSlash:'always', sitemap filter /izbrannoe/ | ✅ |
| 346–347 | Двойной sitemap: root/sitemap.xml копируется в dist/, Astro генерирует sitemap-0.xml — разные файлы | ✅ |
| 348 | 39 PageHead компонентов — canonical/og/viewport/charset у всех | ✅ |
| 350 | console.log: 0 (только warn/error в validated guards) | ✅ |
| 353 | 61 HTML файлов — 0 img без alt | ✅ |
| 356 | skip-link: 35 Astro компонентов + 38 HTML файлов | ✅ |
| 359 | audit-pro финал: 162 passed · 0 errors | ✅ |
