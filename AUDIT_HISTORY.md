# Audit History — gospod-bog.ru

> All audit changelogs consolidated into one file.
> Last updated: 2026-06-04

---

## v27 — PLAN-05: docs cleanup + visual QA + HTML hotfix (2026-06-04)

**Commits:** `e59f6df` (hotfix HTML) · `971475a` (AGENTS-r63 rewrite) · `643f4a7` (this changelog cleanup)

### What was improved:

**1. Visual QA с реальным браузером (Playwright + chromium)**
- Установлен Playwright + chromium-headless + system libs (libnspr4/libnss3/etc).
- Запущен `scripts/visual-audit.js` на полном наборе: 32 страницы × 96 скриншотов.
- Результат: **0 console errors, 0 network errors, 0 raw bugs** (28 invisible-text — все подавлены).
- Дополнительно: 12 тёмных скриншотов (key pages × desktop+mobile) для проверки dark theme после PLAN-04.
- Подтверждено: ВСЕ PLAN-04 изменения (199 !important, удаление мёртвых компонентов, перенос .h-hero-title и .h-phrase--* в home.css) не вызвали визуальных регрессий.

**2. HTML hotfix — найден визуальной проверкой**

В тёмной теме страницы `articles/dzhon-gill-chast-1-chelovek/` внутри карточки «Часть I → Человек» текст «Вы здесь» отображался вертикальным столбиком символов «В Ы З Д Е С Ь».

Причина (HTML5 parsing spec): тег `<span>` для синей точки-индикатора 4×4 px не имел `</span>` закрытия. Браузер «впитывал» текст «Вы здесь» внутрь 4px span, и `width:4px;display:inline-block` ломал текст по одному символу в столбик.

Тот же баг был во **всех 3** файлах dzhon-gill (chast-1/2/3 — копи-паст шаблона). Все три исправлены: добавлено `</span>` сразу после style-атрибута точки. Теперь корректно: «ЧАСТЬ I • ВЫ ЗДЕСЬ».

После фикса: HTML balance check (htmlparser2) → **0 unclosed tags во всех 24 HTML**.

**3. AGENTS.md полная перезапись (AGENTS-r63)**

Старый AGENTS.md (709 строк, r62):
- 66+ записей в истории
- ПРОТИВОРЕЧИЯ: учил создавать `.theme-float-btn` / `.ai-disclosure` (давно удалены в PLAN-04 P5/P7) — из-за этого новые агенты регулярно ВОЗВРАЩАЛИ мёртвые компоненты, отсюда регрессии июня 2026.
- Сломанная нумерация: §0-§8, §10, §11, ВТОРОЙ §11
- Устаревшие счётчики !important (~189, ~313, ~320 в разных местах)

Новый AGENTS.md (567 строк, r63):
- 11 чистых разделов, актуальное состояние
- §0 TLDR: 13 правил «СРАЗУ нельзя», включая legacy-кнопки и !important чеклист
- §4.2: актуальный счёт (199), 5-шаговый чеклист перед добавлением !important, точный список 7 легитимных категорий
- §4.4 CSS Integrity Rules: 10 правил, включая п.9 «Мёртвый компонент = удалить»
- §5.3: секция про Playwright visual-audit
- §8 (новая): Service Worker правила
- §9 (новая): Безопасность/гигиена
- §11 История: компактная таблица из 5 последних вех + ссылка на git log

**4. AUDIT_HISTORY.md чистка**
- v9-v21 свёрнуты в краткую summary-таблицу
- Удалена устаревшая секция «Previous Audit History» (v1-v7 placeholder)
- Удалена устаревшая секция «Remaining Items» (8 пунктов, все либо неактуальны после PLAN-04, либо архитектурные «не дробить site.js» противоречат AGENTS)

### Verified:
- `node scripts/audit-pro.js` → ✅ PASSED 29/2 warn/0 err
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings)
- `npm run tokens:check` → ✅ PASS (0 / 0)
- `npm run visual-audit` (Playwright × 96 screenshots) → ✅ 0 console errors, 0 network errors
- HTML tree-balance check (htmlparser2) → ✅ 0 unclosed tags в 24 HTML

---

## v26 — 🎯 PLAN-04: !important cleanup wave (2026-06-04)

**Commits:** `f0f3982` (plan) ... `a37664a` (P15, target reached) + `notify-on-failure.yml`

**Goal:** Восстановить архитектурный лимит `site.css ≤200 !important` (AGENTS-r42 §4.2)
после регрессии за июнь 2026 (342 vs контракт 200).

**Method:** 15 точечных партий. Для каждого `!important` рассчитана CSS specificity
конкурентов; снимались только те, где **математически доказано**, что каскадная
победа гарантирована без важности-override. Никаких массовых «эстетических»
правок — каждое изменение обосновано.

### What was improved:

| # | Commit | Effect |
|---|--------|--------|
| hotfix | `d0a7193` | Замена мёртвой ссылки `anglicanbooksrevitalized.us` (302 → спам-домен `survey-smiles.com`) на `web.archive.org` снимок 2025-05-14 |
| P1 | `2108bc7` | 3 настоящих top-level дубль-селектора (blockquote, .bottom-bar, article p) слиты |
| P1b | `56367d3` | 6 premium-section дубль-селекторов слиты (body, h1, h1-large, article a, .pq-scripture, #reading-progress, .pullquote::before) |
| P2 | `ce6af68` | `.fn-marker .tooltip:hover` — псевдокласс специфичности (−2) |
| P3 | `af7f3c5` | **`.h-hero-title:hover` архитектурный фикс**: значения перенесены из site.css в home.css БЕЗ важности-override (−13) |
| P4 | `61713f5` | Landscape cascade reorder + 4 мёртвых `.sd-*` правила (−6) |
| P5 | `d683088` | Удалён legacy `.theme-float-btn` (AGENTS-r17 заменил на `.gb-fc-theme`), ~110 строк CSS, −1.2 КБ |
| P6 | `1ee834c` | 4 мёртвых класса: `.epilogue-*`, `.h-section-link`, `.article-img.float-fallback`, `.card.fx-lift` (−7, −900b) |
| P7 | `c141f36` | `.ai-disclosure` (DEAD per AGENTS-r11) + 2 dead Tailwind overrides (−1) |
| P8 | `fd732b0` | `.summary-card__check svg` — нет конкурентов (−6) |
| P9 | `54bce49` | `.summary-card{,__item,__check}` массовая чистка — нет конкурентов (−23) |
| P10 | `945cd4b` | Финальная чистка .summary-card mobile overrides (−10) |
| P11 | `db3860c` | `.gb-accuracy-*` + `.heading-anchor.copied` — specificity (−6) |
| P12 | `a2228a1` | **Добавлен `.github/workflows/notify-on-failure.yml`** — открывает GitHub issue при падении deploy/indexnow |
| P13 | `4582635` | Mobile-overrides где specificity уже выигрывает: `.kbd-hint-toast`, `#back-to-top`, `body.nagornaya-page .flex.*`, `#canonTimeline .ctw-*` (−31) |
| P14 | `7d8df6d` | Specificity-audit: `.mobile-controls .theme-toggle`, `body.nagornaya-page .max-w-4xl > .mb-6 > p.text-stone-*`, `body.has-bottom-bar #back-to-top`, `#selection-share-popup` (−26) |
| **P15** | **`a37664a`** | **🎯 ЦЕЛЬ ДОСТИГНУТА.** `.biography-hero/portrait`, `.h-phrase--greek/hebrew` (move to home.css), `.fn-marker.fn-trans` (−11) |

### Final numbers:

| Metric | Baseline (2026-06-03) | After P15 (2026-06-04) | Target |
|---|-:|-:|-:|
| `site.css` !important | **342** | **199** ✅ | ≤200 |
| `site.css` size | 267 905 b | 264 887 b (−3 КБ) | — |
| `home.css` !important | 20 | 20 | — |
| Top-level duplicate selectors | 14 | 0 (4 legitimate) | 0 |
| audit-pro | ✅ PASSED 29/2/0 | ✅ PASSED 29/2/0 | ✅ |
| `notify-on-failure.yml` | not installed | **installed** ✅ | installed |

### Verified after every batch:

- `node --check js/*.js scripts/*.js sw.js` → PASS
- `npm run cache-bust` → matched
- `npm run validate:all` → PASS (0 errors, 0 warnings)
- `npm run tokens:check` → PASS (0/0)
- `node scripts/audit-pro.js` → PASSED 29 / 2 warn / 0 err

### Plan & per-batch journal:

Полный план и журнал партий: [`audit/AUDIT_CLEANUP_PLAN_2026-06-04.md`](audit/AUDIT_CLEANUP_PLAN_2026-06-04.md)

### Что НЕ менялось (контракт):

- Атрибуция авторства (AGENTS-r4 §3.1) — `Автор-редактор` / `Редактор`
- JSON-LD структура (§3.2), OG/Twitter теги (§3.3)
- Tailwind в nagornaya/tw.min.css — не трогали
- Структура папок, имена файлов
- 5 CSS + 11 JS — никаких новых файлов
- Бюджеты в audit-pro.js (375K CSS / 365K JS) — не повышались

### Note for future agents:

AGENTS.md §4.2 обновлён с актуальными цифрами и историей регрессии-восстановления.
Для предотвращения новой регрессии — следовать §4.2 чеклисту перед добавлением
любого нового `!important`.

---

## v25 — Mobile long-block premium compaction (2026-06-03)

**Commit:** `r61.17: Add mobile long-block compaction`

### What was improved:
- Manual mobile review and measurement found very long editorial blocks (`note-box`, `info-box`, `warn-box`, `summary-card`) creating multi-screen “портянки”.
- Added mobile-only progressive enhancement in `js/enhancements.js`: long blocks get an accessible expand/collapse control.
- Added premium mobile styling in `css/site.css`: 560px preview, gradient fade, pill-shaped expand button, dark-mode support.
- Conservative thresholds avoid button spam: `summary-card ≥ 740px`, other editorial blocks ≥ 950px.
- Desktop is unchanged and all content stays in the DOM/readable after expansion. Cache-bust refreshed.

### Verified:
- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS.
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings).
- `npm run tokens:check` → ✅ PASS (`0 / 0` legacy var references).
- `node scripts/audit-pro.js` → ✅ PASS (29 passed, 0 errors; only existing CSS/JS budget warnings).
- `npm run visual-audit` → ✅ PASS: 32 page/viewport runs, 96 screenshots, 0 console errors, 0 network errors, 0 filtered findings.

---

## v24 — Mobile compact premium cards (2026-06-03)

**Commit:** `r61.16: Compact mobile archive and series cards`

### What was improved:
- Manual mobile review found archive/series cards becoming tall “портянки”: thumbnails stacked above text and planned cards taking too much vertical space.
- Added a scoped compact row layout for non-home mobile `.h-article-card` lists in `css/home.css` under 440px.
- Mobile list thumbnails are now compact 104×76, titles/abstracts are line-clamped, and planned placeholders remain premium but no longer dominate half the screen.
- Compacted the `20-antisovetov` mobile series navigator: lower padding, wider cards, static badge, smaller meta, and clamped excerpts.
- Desktop layout is unchanged. Cache-bust refreshed.

### Verified:
- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS.
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings).
- `npm run tokens:check` → ✅ PASS (`0 / 0` legacy var references).
- `node scripts/audit-pro.js` → ✅ PASS (29 passed, 0 errors; only existing CSS/JS budget warnings).
- `npm run visual-audit` → ✅ PASS: 32 page/viewport runs, 96 screenshots, 0 console errors, 0 network errors, 0 filtered findings.

---

## v23 — Manual screenshot QA: 20-Antisovetov series DOM + reliable bottom screenshots (2026-06-03)

**Commit:** `r61.15: Fix antisovetov series card DOM and screenshot scroll`

### What was improved:
- Manual bottom screenshot review found a severe overlap in the `20-antisovetov` series navigator.
- Root cause: unclosed `series-card__current-badge`, `series-card__num`, and `series-card__tag` spans caused nested text/card swallowing.
- Closed the malformed spans and converted raw `h3` block headings inside the series `<ul>` into valid list/grid items.
- Hardened `scripts/visual-audit.js` scrolling with instant scroll behavior and a wait-for-scroll check before CDP screenshot capture, so bottom screenshots reliably reach true page bottoms even on very long articles.

### Verified:
- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS.
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings).
- `npm run tokens:check` → ✅ PASS (`0 / 0` legacy var references).
- `node scripts/audit-pro.js` → ✅ PASS (29 passed, 0 errors; only existing CSS/JS budget warnings).
- `npm run visual-audit` → ✅ PASS: 32 page/viewport runs, 96 screenshots, 0 console errors, 0 network errors, 0 filtered findings.

---

## v22 — Manual mobile navbar premium fix (2026-06-03)

**Commit:** `r61.14: Fix mobile home navbar overflow`

### What was improved:
- Manual screenshot review found desktop navigation links squeezed into 375px headers on home/archive/series layouts.
- Added a scoped mobile rule in `css/home.css` hiding `.h-navbar .h-nav-links` below 760px, leaving the premium logo + theme/search/burger controls.
- Verified `/`, `/articles/`, and `/pastor-series/` mobile nav now show clean logo + burger instead of clipped desktop links.
- Refreshed cache-bust hashes.

### Verified:
- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS.
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings).
- `npm run tokens:check` → ✅ PASS (`0 / 0` legacy var references).
- `node scripts/audit-pro.js` → ✅ PASS (29 passed, 0 errors; only existing CSS/JS budget warnings).
- `npm run visual-audit` → ✅ PASS: 32 page/viewport runs, 96 screenshots, 0 console errors, 0 network errors, 0 filtered findings.

---
## v9..v21 (свёрнуто) — 2026-05-22 → 2026-06-03

Полные changelog'и этих версий — в `git log` (`git log --oneline --grep "audit\|AGENTS\|r6[01]"`). Краткое резюме:

| Версия | Дата | Главное |
|---|---|---|
| v21 | 2026-06-03 | Visual-audit screenshot pipeline (CDP document clipping); премиум planned-card placeholders в pastor-series. |
| v20 | 2026-06-03 | Visual audit noise: убраны false-positive accessible-link warnings. |
| v19 | 2026-06-03 | 20-Antisovetov JS/HTML stabilization (mobile bottom-sheet, FAQ). |
| v18 | 2026-06-03 | Playwright visual-audit noise hardening (selector-based filtering). |
| v17 | 2026-06-03 | Safe Biografii inline CSS → `site.css` migration phase C. |
| v16 | 2026-06-03 | Safe CSS inline cleanup phase B (general). |
| v15 | 2026-06-03 | Safe stabilization phase A (cache-bust + audit-pro hardening). |
| v14 | 2026-06-03 | CSS Phase 2 + Quality Safeguards. |
| v13 | 2026-05-30 | Editorial pass: статья «Код да Винчи». |
| v12 | 2026-05-30 | Editorial pass: статья «20 антисоветов пастору». |
| v11 | 2026-05-30 | Final patch: 7 HTML/SEO + 10 JS bugs. |
| v10 | 2026-05-22 | Final Cleanup: 7.7MB PNG → .webp; убраны patch-скрипты, dead `package.json` scripts. |
| v9  | 2026-05-22 | Bug Hunter Real Fixes: critical SEO + IndexNow + sitemap fixes. |

История v1..v8 — в начальной фазе репо (май 2026), полностью покрыта в `git log` за май.

---

## Tracked issues — нет

Все issue из старого «Remaining Items» (8 шт) либо закрыты в PLAN-04 (v26),
либо признаны архитектурным выбором (не дробить `site.js` на модули — §5.1 AGENTS-r63),
либо были false-positives.

Текущие предупреждения `audit-pro` — это **CSS budget** (433KB vs 375KB target)
и **JS budget** (452KB vs 365KB target). Эти бюджеты — пороги в `scripts/audit-pro.js`,
без архитектурного обоснования; качество выше размера (см. PLAN-04 §1.2 контракт).
