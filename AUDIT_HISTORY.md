# Audit History — gospod-bog.ru

> All audit changelogs consolidated into one file.
> Last updated: 2026-06-04

---

## v34 — Inline-script dedup: topnav/reveal cleanup moved to global JS (2026-06-04)

### What was improved:
- Added a global `.reveal` fallback observer in `js/site.js`, so long-form article reveal animations no longer require page-specific inline IntersectionObserver snippets.
- Removed duplicated inline topnav scroll controllers from:
  - `articles/krajne-li-isporcheno-serdce/`
  - `articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/`
  because `js/site.js` module 34 already owns `#articleTopnav` globally.
- Removed duplicated inline reveal observers from the same pages.
- Removed redundant inline `.fn-marker` aria-label scripts from the same pages because `js/site.js` module 20 already sets those attributes centrally.
- Removed one dead inline `qbc-exclaim` script from `krajne-li-isporcheno-serdce` (selector absent in DOM).
- Result: fewer inline-script blocks (86 → 79), fewer duplicate scroll listeners, cleaner article HTML, and one less class of page-specific JS drift.

### Verified:
- `npm run cache-bust` → ✅ PASS.
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (33 passed / 2 warnings / 0 errors).

---

## v33 — QA guardrails: canonical quiz schema + OG image uniqueness enforcement (2026-06-04)

### What was improved:
- Extended `scripts/validate.js` with two new global HTML contract checks:
  - canonical quiz-source schema enforcement (`question / correct / explanation` only);
  - duplicate OpenGraph image meta detection (`og:image`, `og:image:width`, `og:image:height`, `og:image:type`, `og:image:alt`).
- Extended `scripts/audit-pro.js` with the same production-facing guarantees.
- Added a lightweight `SITE_CONFIG` extraction path in both validators, so page-level quiz data is now audited semantically, not just syntactically.
- Result: future regressions of the exact kind that caused the June quiz wave issues are now blocked automatically in CI/audit.

### Verified:
- `node --check scripts/validate.js scripts/audit-pro.js` → ✅ PASS.
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (33 passed / 2 warnings / 0 errors).

---

## v32 — Remaining quiz-source canonicalization + OG duplicate cleanup (2026-06-04)

### What was improved:
- Canonicalized the remaining legacy quiz sources across the site:
  - `20-antisovetov-pastoru`
  - `dzhon-gill-spravochnik`
  - `nagornaya/chast-1`
  - `nagornaya/chast-2`
  - `nagornaya/chast-3`
  - `nagornaya/chast-4`
  - `nagornaya/chast-5`
- Converted those quiz definitions from legacy `q / answer / ok / err` source shape into the canonical `question / correct / explanation` source shape while preserving the current runtime compatibility layer.
- Canonicalized the `20-antisovetov` bonus round as well.
- Result: all site quiz sources are now consistently authored in the modern schema, not just supported by compatibility code.
- Cleaned duplicate OpenGraph image metadata on:
  - `/index.html`
  - `/biografii/index.html`
  removing conflicting duplicate `og:image:type/alt/width/height` blocks.

### Verified:
- Canonical quiz-state check:
  - `20-antisovetov` → 10/10 canonical questions + 6/6 canonical bonus questions
  - `dzhon-gill-spravochnik` → 4/4 canonical questions
  - `nagornaya/chast-1` → 3/3 canonical questions
  - `nagornaya/chast-2` → 4/4 canonical questions
  - `nagornaya/chast-3` → 3/3 canonical questions
  - `nagornaya/chast-4` → 5/5 canonical questions
  - `nagornaya/chast-5` → 4/4 canonical questions
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (31 passed / 2 warnings / 0 errors).

---

## v31 — Quiz canonicalization + sourceRef enrichment + metadata cleanup (2026-06-04)

### What was improved:
- Converted the three recently affected quiz pages to the canonical schema in source HTML:
  - `kod-da-vinchi`
  - `hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki`
  - `krajne-li-isporcheno-serdce`
- Result: no more mixed `legacy/new` quiz definitions inside those pages; all questions now use `question / correct / explanation` directly in source.
- Rebuilt bonus-question blocks in Hermeneutics and Krajne to the same canonical format.
- Added explicit `sourceRef` objects across the upgraded quiz sets, so feedback now points readers back to relevant sections instead of generic "перечитать раздел" hints.
- Hardened `js/site.js` further:
  - heading lookup now returns real section titles for source references;
  - explanation fallback now combines legacy `ok/err` material more intelligently;
  - bad/legacy anchors are normalized more safely.
- Cleaned malformed HTML/metadata on the same pages:
  - removed stray `</link></link>` garbage;
  - removed conflicting duplicate `og:image:type/alt/width/height` blocks where they contradicted the actual `og:image` file.

### Verified:
- `npm run cache-bust` → ✅ PASS.
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (31 passed / 2 warnings / 0 errors).
- Canonical quiz-state check:
  - `kod-da-vinchi` → 10/10 canonical questions
  - `hermenevtika` → 11/11 canonical questions + 6/6 canonical bonus questions
  - `krajne` → 12/12 canonical questions + 6/6 canonical bonus questions

---

## v30 — Quiz engine hardening + glossary hydration + inline-script guard (2026-06-04)

### What was improved:
- Fixed the quiz-engine regression where new-format questions (`question / correct / explanation`) crashed the runtime that still expected legacy `q / answer / ok / err` fields.
- Added a backward-compatible normalization layer in `js/site.js`: old and new quiz schemas now work together safely, including `type`, `correct`, `explanation`, `sourceRef`, and heading-anchor resolution.
- Upgraded feedback rendering: `explanation.short` and `explanation.full` are now both surfaced in the UI instead of being silently reduced to a single escaped string.
- Added glossary hydration for dynamic quiz HTML via `js/glossary.js` + `gb:quiz-rendered` events, so `.gterm[data-term]` inside quiz questions/options becomes a real tooltip rather than dead decorative markup.
- Expanded `data/glossary.json` with missing aliases/entries used by the new quiz/tooltips wave (`kettering`, `gin-craze`, `song-of-songs`, `polemic`, `witness`, `gnostic`, `nicea`, `priory-of-sion`, etc.).
- Repaired broken inline `SITE_CONFIG` quiz blocks in John Gill Part I / II / III and cleaned wording/typos (`Сперджен`, `смиренный`, `тексты`, `первый систематик`).
- Fixed John Gill Part I body markup where a footnote tooltip swallowed a whole paragraph after a tooltip insertion.
- Corrected the Hermeneutics quiz mismatch where a question about `Heilsgeschichte` had options/explanations from another question.
- Added inline `<script>` syntax validation to both `scripts/validate.js` and `scripts/audit-pro.js`, closing the QA blind spot that previously missed broken page-level JavaScript.
- Updated `README.md` and `AGENTS.md` quiz examples to document the new canonical quiz schema while explicitly marking legacy schema as backward-compat only.

### Verified:
- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS.
- `npm run cache-bust` → ✅ PASS.
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings).
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (31 passed / 2 budget warnings / 0 errors).

---

## v29 — Image contract fixes: `<picture>` wrappers, base files, PNG cleanup (2026-06-04)

**Commits:** `PLAN-07` (this release)

### Что исправлено

| Проблема | Решение | Файлы |
|---|---|---|
| Rim7: 10 `<img srcset>` без `<picture>` | Обёрнуты в `<picture><source type="image/webp"><img>` | `rimlyanam-7-veruyushchiy-ili-neveruyushchiy` |
| Rim7: 5 изображений без base-файлов | Созданы из largest variants (`-1600w` → `.webp`) | `rim7-threshold-hero`, `rim7-rom6-8-banner`, `rim7-positions-map`, `rim7-old-new-covenant`, `rim7-no-condemnation-banner` |
| Gill: 2 изображения без base-файлов | Созданы из largest variants | `gill-preacher-pulpit`, `gill-nine-volumes` |
| `underground-puritan-meeting.png` — единственный `<img>` без webp | Конвертирован в webp + responsive variants + JPG fallback, обёрнут в `<picture>` | `dzhon-gill-istoricheskiy-kontekst` |
| `20-antisovetov-pastoru`: 10 `<img srcset>` без `<picture>` | Обёрнуты в `<picture>`, srcset/sizes перенесены на `<source>` | `20-antisovetov-pastoru` |
| `krajne-li-isporcheno-serdce`: 16 `<img srcset>` без `<picture>` + 2 сломанных `<img <picture>` | Все 18 обёрнуты в `<picture>`, исправлены сломанные теги | `krajne-li-isporcheno-serdce` |
| `kod-da-vinchi`: hero img srcset на `<img>` внутри `<picture>` | srcset перенесён на `<source>`, JPG fallback исправлен | `kod-da-vinchi` |
| PNG-бэкапы Gill (10 файлов, ~7MB) | Удалены (webp-пары существуют) | `images/gill-*.png` |
| `whitefield-field*` (5 файлов, ~3MB) | Удалены (не использовались) | `images/whitefield-field*` |
| `biografii/index.html`: PNG ref | Заменён на `.webp` | `biografii` |
| `dzhon-gill-chast-2`: preload PNG ref | Заменён на `.webp` | `dzhon-gill-chast-2-uchenyi` |
| `krajne`: 14 несуществующих JPG `<source>` fallback | Удалены | `krajne-li-isporcheno-serdce` |

### Результаты

- **`validate:all`**: ✅ 0 errors, 0 warnings
- **`audit-pro.js`**: ✅ 30 passed / 2 warn (budget only) / 0 errors
- Все 44 `<img>` с `srcset` теперь обёрнуты в `<picture>` с `<source type="image/webp">`
- Созданы 7 base-файлов изображений, 7 responsive-вариантов
- Удалено 16 неиспользуемых файлов (~10MB)

---

---

## v28 — PLAN-06: JS cleanup (professional, careful, with Playwright re-checks) (2026-06-04)

**Commits:** `bdf8fe0` (plan) · `3872ba9` (P1) · `34ca8d6` (P2) · `acdd6d2` (P3) · `27d2543` (P6 finalize)

### Цель

Аккуратно проверить и почистить JS-код проекта (9436 строк, 440 КБ raw / 112 KB gzip).
**Главный приоритет:** не сломать функционал. Каждая партия → Playwright visual-audit (0 console / 0 network errors) → push.

### Результат

**JS код был уже чистым.** Обнаружены только косметические/документационные рассогласования:

| Партия | Файл | Что | Изменения в коде |
|---|---|---|---|
| **P1** `3872ba9` | `js/site.js` | Шапка-оглавление: убрано «25. (зарезервировано)» (модуля нет в коде), добавлены 28/29/30 модули с пометками AGENTS-r17 и PLAN-04 P5. | Comment-only |
| **P2** `34ca8d6` | `js/enhancements.js` | 3 безымянных модуля получили буквы C/D/E (Quiz Interactive, Hebrew Tap-Toggle, Ambient Scripture). Добавлено полное оглавление A..G в шапку. | Comment-only |
| **P3** `acdd6d2` | `js/site.js` | Один неточный комментарий `qFocus = ... /* legacy — kept for HTML compat */` заменён на точный. Два других legacy-комментария проверены и подтверждены легитимными. | Comment-only |
| **P4** (audit-only) | весь JS | Глубокий поиск: unused functions, dead DOM-refs, dead helpers. **Реальный dead-code не найден.** Все 12 «unused» из regex-scan оказались false positives (используются через property access / passed as callback / IIFE). 47 dead DOM-refs → 16 → 0 (все легитимные defensive fallback / template-literal injection / documented feature slot из AGENTS §11.2). | None |
| **P5** | — | Пропущена (P4 ничего не дал — нечего чистить). | — |

### Что было исследовано и явно НЕ изменено

- **Модуль 07 TOC Mobile** (~80 строк JS) — `#toc-panel/list/toggle/overlay/close` нет ни в одном HTML. Однако это **documented feature slot** (AGENTS §11.2 «Контракт разметки»), активируется при появлении в будущей статье. **Оставлен.**
- **`/* legacy key: keep for backwards compatibility */`** на `quiz-best-<slug>` localStorage key — это **активный compat** со старыми пользовательскими данными (новый ключ `quiz-result-v2:...` через `writeQuizMemory`). **Оставлен.**
- **`hCpBtnNav` → `gbSearchBtn` alias в `js/search.js`** — активный legacy compat. **Оставлен.**
- **130 `addEventListener` без `removeEventListener` в `js/site.js`** — большинство на `document/window/body` (живут навсегда). Симметризация = архитектурный refactor, не точечная чистка. **Оставлено как есть.**
- **`qFocus` placeholder с `display:none`** — формально мёртвый в main quiz-flow, но возможно используется в review-режиме (через `revFocus`). Полное удаление требует Playwright проверки interactive quiz flow — **отложено** до отдельной сессии.

### Verified after every batch:

- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS
- `npm run cache-bust` → matched
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings)
- `npm run tokens:check` → ✅ PASS (0/0)
- `node scripts/audit-pro.js` → ✅ PASSED 29 / 2 warn / 0 err
- **`npm run visual-audit` (Playwright × 96 screenshots × 3 раза)** → ✅ **0 console errors, 0 network errors** на baseline, после P1, после P2, после P3

### Numbers

JS baseline и итог совпадают — это была проверка качества, а не оптимизация веса:

| Метрика | Baseline | После P1-P3 |
|---|-:|-:|
| `js/site.js` строк | 5121 | 5129 (+8 строк комментариев) |
| Console errors | 0 | 0 |
| Network errors | 0 | 0 |
| `audit-pro` | ✅ PASSED 29/2/0 | ✅ PASSED 29/2/0 |
| Рассогласование `site.js` шапки с кодом | 3 (25/28/29/30) | **0** ✅ |
| Рассогласование `enhancements.js` нумерации | 3 (C/D/E пропущены) | **0** ✅ |

### Plan & journal

Полный план и журнал партий: [`audit/PLAN-06-DONE.md`](audit/PLAN-06-DONE.md)

### Note для будущих агентов

Если возникнет соблазн «разбить site.js на модули» — **нет**. Это намеренный архитектурный выбор (AGENTS §5.1), подтверждённый в PLAN-06 P4: дублей нет, чистка не нужна.

Если возникнет соблазн «удалить TOC Mobile модуль 07 (он мёртвый)» — **нет**. Это documented feature slot. Активируется при `<div id="toc-toggle">` в HTML статьи.

Если возникнет соблазн «удалить `qFocus`-placeholder» — **сначала тщательная проверка review-режима квиза в Playwright** (interactive flow).

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
