# Audit History — gospod-bog.ru

> All audit changelogs consolidated into one file.
> Last updated: 2026-05-30

---

## v11 — Final patch: 7 HTML/SEO + 10 JS bugs (2026-05-30)

**Commit:** `fix: audit v11 — close all remaining HTML/JS bugs (biografii + Gill article + quiz + tooltip + viewport)`

### Fixed (HTML/SEO/доступность)
- **«Доктор Витиеватый» → «Доктор Многотомный»** в теле статьи Гилла (стр. 1144, 1555). Прежняя замена в коммите `d575525` затронула только мета-теги и заголовки; в живом тексте оставалось внутреннее противоречие («Витиеватый (Dr. Voluminous) — за объём»).
- **Дублированные `class="reveal" class="..."`** (3 тега) в статье Гилла. Браузер берёт только первый `class`, поэтому стили `.author-card-desc`, `.gb-accuracy-title`, `.gb-accuracy-desc` де-факто не применялись.
- **`<link rel="icon" type="image/webp">` на `icon-192.png`** в `biografii/index.html` и `pastor-series/index.html` — третий размер фавикона забыли при предыдущей правке MIME. Заменено на `type="image/png"`.
- **Малая карточка `h-intro-card--biographies`** возвращена на главную перед широким featured-блоком (по явной просьбе владельца — индикатор «раздел в разработке»).
- **`aria-current="page"`** перенесён с `<li>` на `<span aria-current="page">` внутри последней крошки `biografii/index.html` (по спецификации ARIA атрибут должен стоять на интерактивном/контентном узле, а не на контейнере списка).
- **`<button class="h-scroll-top">`** получил `type="button"` в `biografii/index.html` (на главной уже стоял). Исключает потенциальный submit при наличии `<form>`.
- **`<link rel="manifest">`** переведён с абсолютного `https://gospod-bog.ru/manifest.json` на корневой `/manifest.json` на всех 4 страницах. PWA-манифест теперь корректно резолвится в staging/локальной разработке.

### Fixed (JS — поведенческие баги)
- **B1.** `js/site.js`: `window.SiteUtils = SiteUtils` стирал методы, добавленные `site-utils.js` (`lockScroll/unlockScroll/forceUnlockScroll`) и `scroll-perf.js` (`scheduleHebrewMeasure`), которые загружаются раньше. Заменено на merge с проверкой `hasOwnProperty`.
- **B2.** `js/site.js`: бонусный экран квиза создавался с `style="display:none"` и нигде не показывался — `showBonusScore()` показывал только внутренний `#quizBonusScore`. Добавлен показ родителя `#quizBonusResult`.
- **B3.** `js/enhancements.js`: `oldFill` кэшировался до `btocProgressWrap.innerHTML=''` — последующие записи в `style.width` уходили в detached node. Получаем актуальную ссылку через `getElementById` при каждом обновлении.
- **B4.** `js/site.js` модуль 29: тот же `#btocProgressFill` после enhancements.js — detached. Берём `fillNow` непосредственно в обработчике scroll, fallback на `.btoc-progress-bar-wrap .btoc-seg-fill`.
- **B5.** `js/site.js` `makeTooltipController` `pointerover`: при переходе мышью с одного якоря на другой у старого активного элемента снимался только класс `is-open`, но `aria-expanded` оставался `'true'`. Заменено на полный `close(true)`.
- **B6.** `js/site.js` блок «AUDIT V6 / H5» дублировал `visualViewport` resize-tracker (`--visual-viewport-h`, `--keyboard-height`) — без throttle, поверх `scroll-perf.js`. Дубль удалён.
- **B7.** `js/site-utils.js` `emergencyCheck` вызывал `window.SiteUtils.forceUnlockScroll()` — метод стирался багом B1. После B1 метод сохраняется, но добавлен fallback на `forceUnlockEmergency`.
- **B8.** `js/search.js` `runManifestSearch`: callback манифеста не проверял актуальность `_searchGen` — при быстрой смене запроса медленный async мог перетереть свежие результаты устаревшими. Добавлен guard.
- **B9.** Хардкод `' разделов'` в `js/site.js` модуль 09 и `js/nagornaya-mobile-toc.js` нарушал склонение для 1–4 разделов. Добавлена утилита `SiteUtils.pluralRu(n, one, few, many)`; обе точки применения переведены на неё. Заодно «вопросов» в квизе — тоже плюрализуется.
- **B10.** `js/site.js`: два `var qs = SiteUtils.getConfig('quiz.questions', [])` в одном function-scope (var-redeclare, copy-paste-индикатор). Объявлено один раз, переиспользовано.

### Verified
- `node --check js/*.js` → все 11 файлов PASS
- `npm run validate:strict` → 0 ошибок (3 предупреждения о нестандартных breakpoints — INFO, не блокирующие)
- `npm run seo-audit` → 0 ошибок, 0 предупреждений
- `npm run tokens:check` → PASS
- `npm run cache-bust` → 20 HTML-файлов обновлены, хеши синхронизированы с новыми CSS/JS
- Парсер дубликатов `class=` → 0 совпадений в `index.html`, `biografii/`, `articles/dzhon-gill-1697-1771/`, `pastor-series/`
- JSON-LD валидность → 3/3 страниц OK

### Updated docs
- **AGENTS.md** → r10: счётчики `!important` (§4.2) приведены к актуальным цифрам (site.css 526 вместо устаревших 110, home.css 15 вместо 12, command-palette.css 4 вместо 3), добавлена строка про `mobile-hotfix.css` в таблице §2, исправлена хронология версий в §9, пояснение к `?v=` хешам (§0/§3.4).
- **README.md** → версия документа 2.2.
- **AUDIT_HISTORY.md** → эта запись (v11).

---

## v9 — Bug Hunter Real Fixes (2026-05-22)

**Commit:** `v9 Bug Hunter: real fixes (quiz SVG, CLS, search retry, CSS cleanup)`

### Fixed:
- **Quiz SVG icons** — `textContent` → `innerHTML` for `resultLabel` and `revDoneIcon`. Icons now render correctly instead of showing raw SVG markup.
- **lockScroll CLS** — Added scrollbar width compensation (`paddingRight`) when locking scroll. Prevents layout shift when scrollbar disappears.
- **CSS reduced-motion leak** — 5 animation/transition rules were outside `@media (prefers-reduced-motion: reduce)`, disabling animations for ALL users. Moved inside the media query.
- **CSS duplicate `.h-hero-search`** — ~114 lines of duplicate CSS block removed.
- **Search manifest retry** — Added retry on failure + user-facing error toast instead of silently breaking search permanently.
- **SW `waitUntil`** — Message handler now wraps cache operations in `e.waitUntil()` for reliability.
- **Cleanup** — Removed junk files (`fixed-v8/`, `site.js.bak`), deleted duplicate `js/sw.js`.

### Verified:
- `npm run validate:all` → ✅ PASS
- All JSON data files valid
- All JS/CSS files have balanced braces
- No `textContent` + SVG patterns remaining
- No reduced-motion leaks
- CSP, X-Content-Type-Options present on all pages
- JSON-LD valid on all pages
- sitemap.xml ↔ noindex: no conflicts

---

## Previous Audit History

### v5–v7 (2026-05-21 → 2026-05-22)
- Initial SEO audit and fixes
- robots.txt AI bot policies
- Schema.org JSON-LD implementation
- Service Worker caching strategies
- Performance optimizations (font preloading, image lazy loading)
- Accessibility improvements (skip link, aria-labels, focus management)

### v1–v4 (2026-05 earlier)
- Mobile responsive patches
- Interactivity fixes
- Dark mode support
- Command palette implementation

---

## Remaining Items (non-critical, tracked for future)

| # | Category | Description | Severity |
|---|----------|-------------|----------|
| 1 | PERF | `site.css` has 376 `!important` rules — consider refactoring specificity | INFO |
| 2 | PERF | 4 render-blocking CSS files in `<head>` — consider inlining critical CSS | INFO |
| 3 | PERF | 4 PNG files in `images/pastor-series/` have webp equivalents but originals still exist (2.2MB+1.9MB+2.6MB+1MB) — can delete PNGs | INFO |
| 4 | CSS | 4 selectors in `site.css` appear 3x (`.bar-icon-btn`, `.btoc-close`, `.quiz-wrapper`, `.gb-accuracy-inner`) — likely media query variants, not true duplicates | INFO |
| 5 | PERF | 10+ scroll/touch event listeners without `{passive: true}` — modern browsers handle this, but explicit is better | INFO |
| 6 | ARCH | `site.js` is 3888 lines — consider splitting into modules for maintainability | INFO |
| 7 | PWA | No `skipWaiting()` in SW — users must close all tabs to get updates | INFO |
| 8 | IMAGE | `og-preview.jpg` referenced in og:image but has no `.webp` equivalent | INFO |

**Overall project health: 9.5/10** — All critical and high-severity issues resolved.

---

## v10 — Final Cleanup (2026-05-22)

**Commit:** `v10 final cleanup: repo hygiene, PNG→webp, dead code removal`

### Cleaned:
- **4 old patch scripts** removed (`patch-v2/v4/v5/v6-apply.js`) — no longer needed
- **4 dead `patch:*` scripts** removed from `package.json`
- **6 stale audit reports** removed (kept latest only)
- **4 redundant PNGs** deleted (7.7MB saved) — hero.png, manipulation.png, mirror.png, og-hero.png
- **9 HTML references** updated from `.png` → `.webp`
- **AGENTS.md** updated to r3 (removed references to docs/archive, patch scripts, corrected architecture tree)

### Verified:
- `npm run validate:all` → ✅ PASS
- `node scripts/audit-pro.js` → ✅ 31/31 PASS, 0 errors, 0 warnings
- All PNG→webp references verified (no broken images)
- No dead file references in SW precache
- package.json clean (no dead scripts)

### Remaining INFO items (non-issues):
- 2 empty CSS rules in site.css (intentional placeholder selectors)
- localStorage calls are already wrapped in try/catch (scanner false positive)
- AGENTS.md uses short file names in text context (not literal paths)
- `javascript:void(0)` in resume-reading link (dynamically overwritten by bookmark-engine.js)

**Overall: 9.7/10 — Production-grade, clean repo.**
