# Тотальный аудит — Product `main@80440f9` против MASTER_BUG_MATRIX (AuditRepo `d5364d1`)

**Дата:** 2026-10-26. **Product anchor:** `80440f9ce4bdfca92769330ea79109625c868725` (merge PR #2194).
**AuditRepo anchor:** `d5364d1` («audit: current-main TLP and GBS verification (#488)», 2026-10-25).
**Ветка:** `arena/c412f083-gb-is-my-strength`. **Метод:** 4 уровня — (1) свежая матрица + closure ledger + 5 новых reverify-отчётов #488; (2) полная git-история Product (shallow-клон раздут до 5115 коммитов) и Wave-сообщения W1–W40; (3) живой source + `strangler:build:production-like` (exit 0, 108 страниц); (4) Sparticuz Chromium 153 на rebuilt `dist` — нативные переходы, axe 56+64 загрузок, CDP-геометрия, negative controls.

---

## 1. Короткий ответ

Матрица объявляет **50 активных work units** (27 direct defects + 4 improvements + 19 system lanes). Матрица **не отражает** Product-волны W1–W40 и merges #2190–#2194: она записана на якорях `8d93fe4…`, `948ecff…`, `015573af…`, т.е. до основной массы исправлений.

Фактическая перепроверка на точном `80440f9`:

| Класс | Кол-во | Что это значит |
|---|---:|---|
| **A. Уже исправлено в Product** | **32** | Строка всё ещё открыта в AuditRepo → нужен owner-reverify с приёмом evidence. Кода не требует. |
| **B. Реально открыто, нужен код** | **14** | Подтверждено живым source/build/браузером на `80440f9`. |
| **C. Владелец / evidence boundary** | **4** | Решение редакции, политика, внешний witness или разблокировка лейна #2179. |

Иными словами: **закрывать осталось 18 содержательных вопросов** (14 код + 4 решение владельца) плюс **канонический owner-reverify 32 уже сделанных**. Не «50 багов», а 18 живых + бухгалтерия.

---

## 2. Что принесли «большие исследования» #488 (2026-10-25)

Пять новых reverify-отчётов и пять JSONL-evidence. Разбор:

- **`2026-10-25-series-navigation-document-identity.md`** — admit `SYS-READER-DOCUMENT-NAVIGATION-INTERCEPTION`: 63 маршрута, 772 нативные активации, **0/772** доставляли целевой документ. Это самый тяжёлый живой дефект продукта. ✅ **Закрыт в этой сессии** (§3).
- **`2026-10-25-content-authoring-universality.md`** — admit `SYS-CONTENT-AUTHORING-PUBLICATION-CONTRACT` (49→50): валидный publishable MDX проходит сборку без маршрута; config-only пункт Pastor даёт 30 битых ссылок на 10 страницах. Архитектурный лейн, **открыт**.
- **`2026-10-25-reading-table-keyboard-scroll.md`** — admit `SYS-READING-TABLE-KEYBOARD-SCROLL` (48→49): 15 табличных маршрутов × 320/390/641 px → 19/22/9 реальных X-скроллов, Axe 18/20/1 serious. **Открыт**, свежий witness ниже.
- **`2026-10-25-teen-series-letter-taxonomy.md`** — буквенная таксономия I→II→III→A→B→C→D признана **намеренной**; admit `GBS-TEEN-SERIES-CORE-STEP-PROGRESS`: rail показывает «Часть 3 из 3». **Открыт**.
- **`2026-10-25-gill-folded-navigation-closure.md`** — `SYS-GILL-NAV-COLLAPSED-FOCUS-EXPOSURE` → `FIXED-CURRENT` (49→48) на Product #2192: `gbSetFolded`, inert, 0 tabbable под свёрнутыми регионами, CDP AX-tree witness. Закрытие принято; строка уже отсутствует в матрице.

Итог #488: **+4 новых admission, −1 закрытие**. Ни один из этих admission не был снят волнами W1–W40 — три из четырёх остаются живыми, один закрыт сейчас.

---

## 3. СДЕЛАНО в этой сессии (W41 + W42)

### W41 — `SYS-READER-DOCUMENT-NAVIGATION-INTERCEPTION` (корень, не ссылка)

**BEFORE** (production-like `dist` точного `80440f9`, Chromium 153, `/articles/dzhon-gill-chast-1-chelovek/` → клик по `.gbs-rail-card` Части II):

```
BEFORE h1: "…Часть I: Человек"
AFTER  href: /articles/dzhon-gill-chast-2-uchenyi/
AFTER  h1:   "…Часть I: Человек"     ← исходный документ выжил
NAV_REQUESTS: ["/articles/dzhon-gill-chast-1-chelovek/"]   ← целевых запросов: 0
VERDICT: SAME-DOCUMENT-URL-ONLY
```

Корень — `src/runtime/reader-tts-lifecycle.js`: `NavigateEvent.intercept({handler: retire})` для **каждого** cross-document события. Хендлер лишь retiring TTS и не фетчит destination; Chromium коммитит URL/history как same-document.

**AFTER** (тот же сценарий после правки):

```
AFTER  href: /articles/dzhon-gill-chast-2-uchenyi/
AFTER  h1:   "…Часть II: Учёный"     ← отрисован целевой документ
NAV_REQUESTS: ["…/chast-1-chelovek/", "…/chast-2-uchenyi/"]
ERRORS: []
VERDICT: DOCUMENT-REPLACED
```

Правка: cross-document navigation **никогда не перехватывается**; TTS-retirement остаётся best-effort и дублируется штатным `pagehide` движка; same-document fragment/history не трогается.

**Укреплены оба контракта (бывший false-green):**

- `scripts/tts-sharedworker-client-lifecycle-browser-test.js` — теперь **разные** H1/body у source/destination (`Owner/Departing/Probe/Departed`), явная проверка target document request + commit + destination identity + Back/Forward restoration, source-level запрет `.intercept(`, и **негативный witness-мутант** со старым поведением, который новые проверки обязаны отвергнуть. Результат: `SharedWorker document lifecycle browser contract: PASS`, включая ACK-retirement, 3 различных MessagePort generation и `mutantWitness = { destinationRequests: 0, title: "Mutant source document" }`.
- `scripts/tts-route-crawl-browser-test.js` (уже исполняется в CI `tts-reader-polish.yml`, без правки workflow) — добавлен production-surface witness: **81 кейс** по 73 TTS-маршрутам (pointer/Enter/touch, desktop 1440 + mobile 390) с обязательным target request и сменой H1. Итоговый прогон полного контракта:

```
[TTS-ROUTE-CRAWL-SUMMARY] candidateRoutes:73, checks:146, pass:146,
productFindings:0, routeErrors:0, pagehideFailures:0, pageErrorChecks:0,
documentIdentityCases:81, documentIdentityPass:77, documentIdentityNoLink:4
TTS production-like route crawl: PASS
```

4 `no-cross-document-link` — маршруты/режимы, где выбранный владелец серийного chrome отсутствует (не ошибка продукта).

### W42 — `GBS-CHROME-LABEL-IN-NAME-MISMATCH` (последний живой владелец)

Axe experimental sweep 64 загрузки (16 маршрутов × 1440/390 × light/dark) нашёл единственный остаток правила `label-content-name-mismatch`: `.h-nav-logo` на `/` и `/articles/` (8 загрузок). Причина — `aria-hidden="true"` на видимом span с тире: видимая строка не входит в `aria-label`. Проверка в браузере: снятие `aria-hidden` → **0 нарушений**, геометрия логотипа не меняется. Правка применена ко всем **7** копиям шапки (articles / hard-texts / home / nagornaya-seriya ×2 / pastor-series / biografii). Это не `aria-hidden`-костыль, а наоборот — возвращение видимого текста в доступную модель; label остаётся прежним.

**Class-level guard:** в `scripts/interactive-audit.js` (уже исполняется CI) добавлен source-контракт `assertChromeLabelNameSource()` — обход всех `.h-nav-logo`, проверка вхождения видимого текста в `aria-label`, запрет `aria-hidden` на нарисованном тире и **негативная фикстура** с точной регрессией, которую guard обязан отвергнуть. Локальный полный прогон: `chrome labels: 7`, **0** `chrome-label-name-source` issues; единственные 42 issue — `ERR_CONNECTION_CLOSED` внешних ресурсов (известный sandbox-egress артефакт, в CI отсутствует).

---

## 4. Таблица A — уже исправлено в Product, нужен owner-reverify (32)

Свежие доказательства получены в этой сессии; «Wave» — коммит/PR Product.

| ID | Wave / commit | Свежее подтверждение |
|---|---|---|
| `GBS-KRAJNE-REDUCED-MOTION-QUIZ-OCCLUSION` | W1–5 `5e8e34e` | axe: 0 `color-contrast`/`nested-interactive` на загруженных профилях |
| `GBS-QUIZ-LITERAL-MARKUP` | W1–5 + W27 `a0be892` | контракт rich-text в interactive-audit |
| `GBS-PRINT-TERMINAL-REGION-HIDES-CONTENT` | `0b154d7` | root resolution + `[data-print-policy=include]` opt-in; PDF 1/2547→7/3177 chars |
| `GBS-PRINT-MEDIA-CONTRAST-COLLAPSE` | W8 `015573a` | print reset — единый authority ink/surface |
| `GBS-ANTISOVETOV-NESTED-MAP-TRIGGERS` | W1–5 | axe `nested-interactive` = 0 |
| `GBS-MOBILE-CHROME-NAVBAR-SYNC-LAG` | W22 `26e8629` | MobileChrome следует hidden-state |
| `GBS-JOURNAL-READER-SOURCE-LOCATORS-MISSING` | W28 `73ffee8` | G3 bibliography |
| `GBS-JOURNAL-STICKY-NAV-SCROLL-OWNER` | W16 `efb56c0` | scroll owner |
| `GBS-HOME-SEARCH-FOCUS-RESTORE` | W15 `56424c8`, W18 `b3812e8` | синхронный restore |
| `GBS-NAGORNAYA-READER-FONT-SCALE-INCOMPLETE` | W30 `7826432` | масштаб всей прозы |
| `GBS-GENESIS6-THEME-TOGGLE-LOW-CONTRAST` | W15 | glyph split |
| `GBS-HERMENEUTIKA-MOBILE-SPEED-BADGE-UNDERSIZED` | W1–5/W13 | **измерено:** badge 36×28, overlap с Play = 0 px (было 20.3×13, overlap 20.3×17) |
| `GBS-KRAJNE-HEART-FLIP-BACK-LIGHT-UNREADABLE` | W8/каскад | **измерено:** после flip фон `rgb(21,16,10)`, axe `color-contrast` = 0 и в light, и в dark |
| `GBS-FOOTNOTE-RICH-TOOLTIP-FOCUS-MODEL` | W8 | focus model |
| `GBS-INLINE-TOOLTIP-DEFINITION-ASSOCIATION` | `571ee69` | `article-tooltips.js` |
| `GBS-OUTLINE-ORDER-AND-LANDMARK-CONTAINMENT` | `2855e39` + W6 | axe `heading-order`/`region` = 0 |
| `GBS-HOME-OFFER-FROZEN` | W21 `ad3097a` | полка по реальным датам |
| `GBS-GENEALOGY-OVERVIEW-SEMANTICS` | ранее на main | **измерено:** 154 `.react-flow__node`, только **5** `aria-label`, axe `aria-prohibited-attr` = 0, статус «Показано 5 из 154» → semantic layer == painted |
| `GBS-GENEALOGY-POINTER-PANEL-STATE-DESYNC` | W37 #2194 | toggle по `selected`, CI genealogy gates зелёные |
| `GBS-3D-NO-WEBGL-FALLBACK` | W19 `af3d9c2` | живой source: `<main>`, `#nowebgl-fallback` с сообщением, `Baptizm3DStaticProjection` |
| `GBS-SITEMAP-LASTMOD-UNOWNED` | W20 `f934310` | **запущено:** `--check` → «skipped diagnostics: **none**», 0 disclaim |
| `GBS-SEARCH-HISTORY-SHAPE-ISOLATION` | W32 `bea0880` | fault-кейсы `{}`/`null`/`"str"`/bad JSON/`[]`: pageerror = 0, `GBSearch.__ready=true` |
| `SYS-AUDIT-PRO-LLMS-ROOT-RESOLUTION` | W8 | **запущено:** 55/55 URL разрешаются в `dist`+root; negative control (`__probe_missing_route__`) возвращает warning; после отката снова чисто |
| `SYS-READER-SPEED-KEYBOARD-MODEL` | `e2c0cf2` | collapsed panel keyboard state |
| `SYS-READER-PROJECTION-CONSUMER-BYPASS` | W38 #2194 | TTS потребляет `getTtsSegments()`; parity foreign=0 |
| `SYS-READER-PROJECTION-SPEAKABLE-AUTHORITY-OVERWRITE` | W36 #2194 | authored-first, 194/194 |
| `SYS-ARTICLE-IMAGE-VIEWER-OPENER-SEMANTICS` | W6 `948ecff` | keyboard opener + focus restore |
| `SYS-READER-SHARE-COPY-OUTCOME-CONTRACT` | W16 | честный outcome |
| `SYS-FAQ-COLLAPSED-FOCUS-EXPOSURE` | W1–5 | живой source: `body.inert` + reversible attribute |
| `SYS-STRATEGIC-MAP-DIALOG-FOCUS-ENTRY` | W6 | focus entry + exact return |
| `SYS-REVERSIBLE-CARD-DESCENDANT-ACTIVATION-COLLISION` | W6 | descendant isolation |
| `SYS-READER-DOCUMENT-NAVIGATION-INTERCEPTION` | **W41 (этот PR)** | §3, 77/77 identity cases |

---

## 5. Таблица B — реально открыто, нужен код (14)

| ID | Живое доказательство на `80440f9` | Минимальный bounded closure |
|---|---|---|
| `GBS-TEEN-SERIES-CORE-STEP-PROGRESS` | rail «**Часть 3 из 3**» при marks `I, II, A, B, C, D` | явная core-sequence progress 1–7 в desktop/mobile, сохранить marks |
| `GBS-GENEALOGY-RELATION-LABEL-DIRECTION` | `DetailPanel.tsx:22–29` не менялся с 2026-09-16; `relationshipKindLabel(relation, person.id)` печатает роль выбранного рядом с `peerName` | форматтер направления «субъект → объект / роль → роль»; father/mother/legal-parent/spouse с двух концов |
| `GBS-TEXT-CONTRAST-RESIDUAL-BATCH` | axe: 6 узлов — `.h-title-accent` (/articles/), `.gbs-rail-spdbadge` + 2 `.related-articles__link` (kod-da-vinchi dark), `.lt` (konfessii mobile dark) | поправить 4 владельца, painted-glyph перепроверка light/dark |
| `SYS-HEAD-ASSET-PROJECTION-PROLIFERATION` | **82** Astro-файла / **506** `?v=` литералов против 19 файлов с `assetUrl()` (68 вызовов) | единая Astro head-проекция, negative fixtures на hash literals |
| `SYS-TTS-RECOVERY-STATUS-OWNERSHIP` | `git log d14da74c..HEAD -- js/vosk-tts-engine.js js/vosk-tts-worker.js` — **пусто** | generation-owned retry/status/notice в worker+client+notice |
| `SYS-EDITORIAL-DATELINE-SLOT-SEMANTICS` | `projectVisibleDateline()` по-прежнему выводит slot из CSS-класса `.article-updated` / `.article-byline` | явная slot identity + approved visible-label authority, 9 маршрутов |
| `SYS-SERIES-DISCOVERY-CURRENT-AUTHORITY` | нет коммитов `data/series.json` и новых membership-guards после anchor | typed membership owner + current-head negative fixture |
| `SYS-DEPENDENCY-ADVISORY-LIFECYCLE` | `.github/workflows/dependency-security.yml` — **нет `schedule:`**; 1 moderate Astro advisory без disposition | scheduled audit + dated owner acceptance; **блокировано #2179** |
| `SYS-INJECTED-HEADER-CONTROL-HOST` | **измерено:** `#gbSearchBtn` и `#themeToggle` пересекаются **12 px** на 320/390/768/1440; на 768 правый край 823 > 768 | именованный host/API с capacity и viewport containment вместо `querySelector('.mobile-controls')` |
| `SYS-CSS-CASCADE-GOVERNANCE-NONENFORCING` | `css:layer:validate` → `site.css` **18.8%** layered при target 80%, потолок `!important` = текущему долгу 200, `VALIDATION PASSED` с warning | per-root baselines + ratchet + negative fixtures |
| `SYS-CONTENT-AUTHORING-PUBLICATION-CONTRACT` | новый #488; first-class scaffold/admission owner отсутствует | typed manifest + scaffold + negative fixtures (orphan MDX, config-only item, locked series) |
| `SYS-READING-TABLE-KEYBOARD-SCROLL` | axe `scrollable-region-focusable` на `table:nth-child(49)` gill-1 mobile light+dark; `#canonTimeline` уже починен отдельно | conditional overflow primitive: только реальные скроллеры в Tab order, name + Arrow/Home/End |
| `SYS-SEARCH-LAZY-BOOTSTRAP-OWNERSHIP` | `HardTextsPageChrome.astro:139` inline `load(false)` не ставит `__gbSearchBootRequested`; 18 скопированных writer'ов | один bootstrap API/generation owner, negative writer guard |
| `GBS-CHROME-LABEL-IN-NAME-MISMATCH` | **W42 (этот PR)** закрывает последнего владельца; до правки 8/64 загрузок | принять W42 (fix + 7 копий + class-level guard с negative fixture) |

> После W42 класс B фактически **13** строк; в таблице оставлена 14-я с пометкой «закрыто в PR».

**Отдельные наблюдения вне матрицы (не заводятся как новые строки без admission):** axe `target-size` на 18 `#note-ref-…` (Hermenevtika desktop) и `link-in-text-block` ×3 на `/konfessii/russkij-baptizm/` — оба низкоприоритетные, не меняют арифметику 50.

---

## 6. Таблица C — решение владельца / evidence boundary (4)

| ID | Что нужно |
|---|---|
| `SYS-NOTE-NUMBER-AUTHORITY-CONTRADICTION` | `docs/REFERENCE-TOOLTIP-CONTRACT.md:37` требует «preserve their visible number», а генератор после #2183 канонизирует 27/36→2/3. Выбрать authority и синхронизировать doc+generator+tests. |
| `GBS-BAPTISTS-VISIBLE-COPY-QUESTION-MARK-LOSS` | Живой source: **1308** маскированных runs в 9 body-компонентах (Spravochnik 323 … Vsehib 55). `scripts/baptisty-mojibake-ratchet.mjs` держит дефект ограниченным, но донора авторского текста нет — нужно редакционное восстановление по `audit/BAPTISTY-MOJIBAKE-RECOVERY-PACK-2026-10-13.md`. |
| `GBS-NAGORNAYA-MENU-ICON-MISSING-FORCED-COLORS` | Структурная половина закрыта W24 (`@media (forced-colors:active){#menuBtn .bar{background:ButtonText}}`). Цветовая половина требует реального Windows HCM witness — Playwright `forcedColors:'active'` не перекрашивает background. |
| `SYS-TTS-ORT-PATH-CONTRACT-FALSE-RED` | Source-половина закрыта: structural guard **PASS (3 adversarial mutations rejected)**. CI-половина (`set -o pipefail` перед `tee`) **не закрыта**: `.github/workflows/tts-reader-polish.yml` принадлежит открытому PR **#2179** — lane-collision guard. |

**Ключевое управленческое решение владельца:** disposition PR **#2179** (dependabot, 74 workflow-файла). Пока он открыт, заблокированы как минимум `SYS-DEPENDENCY-ADVISORY-LIFECYCLE` и остаток `SYS-TTS-ORT-PATH-CONTRACT-FALSE-RED`. #2179 — «мёртвый» бот, `@dependabot rebase` не работает; разумно закрыть его и внести нужные workflow-правки отдельным lane'ом.

---

## 7. Проверено / Не проверено / Среда

**Проверено (команды, точный HEAD):**
- `npm ci` (375 пакетов), `npm run strangler:build:production-like` → **exit 0** (108 HTML, CSP 107, G-1..G-8 PASS, asset drift 0).
- `node scripts/tts-sharedworker-client-lifecycle-browser-test.js` → **PASS** с усиленными identity assertions + mutant witness.
- `node scripts/tts-route-crawl-browser-test.js` → **PASS**: 146/146 crawl + 77/81 identity.
- `node scripts/sitemap-policy-normalizer.js --check` → skipped diagnostics **none**.
- `node scripts/tts-ort-worker-path-contract.js` → PASS, 3 мутации отвергнуты.
- `node scripts/audit-pro.js` → llms.txt 55/55, negative control возвращает warning.
- `node scripts/interactive-audit.js` → 43 страницы, `chrome labels: 7`, 0 source-guard issues (42 egress-артефакта в sandbox).
- W42 axe-перепроверка: **24 профиля** (6 маршрутов × desktop/mobile × light/dark) → 0 `label-content-name-mismatch`, геометрия логотипа 220/235 px без изменений.
- Chromium 153: 56 загрузок axe default + 64 загрузки axe experimental = **120 профилей**, 0 pageerror, 0 harness error; CDP-геометрия header/badge/heart/genealogy.
- Нативный probe навигации BEFORE/AFTER (§3).

**Не проверено в этой сессии:**
- WebKit/Firefox локально (CDN Playwright вне egress) — их закрывают CI release gates.
- Полная повторная экстракция A4-PDF для всех 104 маршрутов (print row принят по evidence W8 + живым источникам).
- Реальный Windows High Contrast witness (нужен владелец).
- Live-production bytes (все доказательства — exact-SHA production-like local build).
- Полный 772-активационный прогон из #488 (постоянный контракт покрывает 81 репрезентативный кейс на 73 маршрутах).

**Среда:** ветка `arena/c412f083-gb-is-my-strength` от `80440f9`; Sparticuz Chromium 153.0.8010.0 (`/tmp/chromium`) + AL2023 NSS-библиотеки (`/tmp/lib`), статический сервер `dist` на 8090; все отчёты/артефакты в `reports/` (gitignored) и `/tmp`.

---

## 8. Рекомендованный порядок закрытия

1. **Принять этот PR** (W41 + W42) → снять `SYS-READER-DOCUMENT-NAVIGATION-INTERCEPTION` и остаток `GBS-CHROME-LABEL-IN-NAME-MISMATCH`.
2. **Owner-reverify 32 строк класса A** по таблице §4 — это самая большая «бухгалтерская» работа, кода не требует.
3. **Быстрые bounded repairs:** `GBS-TEEN-SERIES-CORE-STEP-PROGRESS`, `GBS-GENEALOGY-RELATION-LABEL-DIRECTION`, `GBS-TEXT-CONTRAST-RESIDUAL-BATCH` (4 владельца), `SYS-INJECTED-HEADER-CONTROL-HOST`.
4. **Средние системные:** `SYS-READING-TABLE-KEYBOARD-SCROLL`, `SYS-SEARCH-LAZY-BOOTSTRAP-OWNERSHIP`, `SYS-TTS-RECOVERY-STATUS-OWNERSHIP`, `SYS-EDITORIAL-DATELINE-SLOT-SEMANTICS`, `SYS-SERIES-DISCOVERY-CURRENT-AUTHORITY`.
5. **Архитектурные (SYSTEM scope):** `SYS-HEAD-ASSET-PROJECTION-PROLIFERATION`, `SYS-CSS-CASCADE-GOVERNANCE-NONENFORCING`, `SYS-CONTENT-AUTHORING-PUBLICATION-CONTRACT`.
6. **После #2179:** `SYS-DEPENDENCY-ADVISORY-LIFECYCLE` + остаток `SYS-TTS-ORT-PATH-CONTRACT-FALSE-RED`.
7. **Владелец:** note-number authority, Baptist originals, Windows HCM witness, note-number policy, AuditRepo#489 rename/close.
