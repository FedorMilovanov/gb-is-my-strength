# AGENTS.md — gb-is-my-strength (gospod-bog.ru)

> **Обязательно к прочтению ДО любой правки кода**, если ты — ИИ-агент
> (Cursor / Arena Agent / Copilot Workspace / Kilo / любой).
>
> **⚠️ Если ты работаешь в Arena Agent Mode (Qwen Code / Arena.ai):**
> Сначала прочитай `docs/SANDBOX-ENV-2026-06-21.md` — инструкция по выживанию
> в этой среде. Там описано: как не потерять файлы, как пушить, почему
> агенты падают и как не повторять моих ошибок. **Этот файл обязателен.**
> Этот файл — **договор** между владельцем (Фёдор Милованов) и любым агентом.
> Нарушение = регресс, который видят сотни читателей сайта.
> Если правило кажется глупым — **спроси, ПОЧЕМУ оно появилось**.

| Версия документа | Дата | Состояние |
|---|---|---|
| **AGENTS-r279** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 parallel pilot deepened `/articles/` catalog without touching Kod/Gill article lanes.** After the earlier split into raw fragments, `ArticlesMain.astro` now no longer depends on `?raw` section imports either. The catalog is assembled from hand-authored Astro components: `ArticlesHeroSection`, `ArticlesPublicationsSection`, `ArticlesRefutationsSection`, and `ArticlesArticleEndBlock`, preserving the premium catalog DOM/copy while removing raw transport from the main shell. `articles-visual-parity-audit` now guards the componentized-main contract and forbids regression back to raw section imports. |
| **AGENTS-r278** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 parallel pilot advanced `/` home main while still staying off Kod/Gill article lanes.** `HomeMain.astro` no longer proxies `_legacy/main.html?raw`. The premium home main is now assembled from named legacy-faithful fragments: `hero.html`, `resume-mobile.html`, `directions.html`, `planned.html`, `publications.html`, `refutations.html`, `about.html`, `quote.html`, and `post-article.html`, preserving the standalone home DOM/copy while removing the monolithic main transport. `home-visual-parity-audit` now guards the split-main contract and forbids regression back to the raw main import. |
| **AGENTS-r277** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 parallel pilot advanced `/biografii/` landing while still staying off Kod/Gill article lanes.** `BiografiiMain.astro` no longer proxies `_legacy/main.html?raw`. The landing main is now assembled from named legacy-faithful fragments: `recent.html`, `focus.html`, six era-section fragments, `epigraph.html`, and `post-article.html`, preserving the premium biography landing DOM/copy while removing the monolithic main transport. `biografii-visual-parity-audit` now guards the split-main contract and forbids regression back to the raw main import. |
| **AGENTS-r276** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 parallel pilot advanced `/articles/` catalog without touching Kod/Gill article lanes.** `ArticlesMain.astro` no longer proxies `_legacy/main.html?raw`. The catalog main is now assembled from named legacy-faithful fragments: `hero.html`, `publications.html`, `refutations.html`, and `post-article.html`, preserving the premium catalog DOM/copy while removing the monolithic main transport. `articles-visual-parity-audit` now guards the split-main contract and forbids regression back to the raw main import. |
| **AGENTS-r284** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G13: summary/intro Gill context block promoted to Astro.** `00-summary-and-intro.html` retired and replaced by `GillContextSectionSummaryIntro.astro`; `GillContextArticleBody.astro` now renders 1 raw fragment + 11 Astro sections in original order. Guard checks raw fragment count 1 + 11 Astro sections = 12, absence of old `00`/`01`/`02`/`03`/`04`/`05`/`06`/`07`/`08`/`09`/`10` fragments, summary/intro markers, reconstructed body parity, word/H2 parity. |
| **AGENTS-r283** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G12: tenth visible Gill context section promoted to Astro.** `04-sec-clarendon.html` retired and replaced by `GillContextSectionClarendon.astro`; `GillContextArticleBody.astro` now renders 2 raw fragments + 10 Astro sections in original order. Guard checks raw fragment count 2 + 10 Astro sections = 12, absence of old `01`/`02`/`03`/`04`/`05`/`06`/`07`/`08`/`09`/`10` fragments, section markers, reconstructed body parity, word/H2 parity. |
| **AGENTS-r282** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G11: ninth visible Gill context section promoted to Astro.** `01-sec-from-puritans-to-baptists.html` retired and replaced by `GillContextSectionFromPuritansToBaptists.astro`; `GillContextArticleBody.astro` now renders 3 raw fragments + 9 Astro sections in original order. Guard checks raw fragment count 3 + 9 Astro sections = 12, absence of old `01`/`02`/`03`/`05`/`06`/`07`/`08`/`09`/`10` fragments, section markers, reconstructed body parity, word/H2 parity. Pixel parity remains 0.000% desktop/mobile. |
| **AGENTS-r281** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G10: eighth visible Gill context section promoted to Astro.** `08-sec-southwark.html` retired and replaced by `GillContextSectionSouthwark.astro`; `GillContextArticleBody.astro` now renders 4 raw fragments + 8 Astro sections (`ParticularVsGeneral`, `GreatEjection`, `Academies`, `SaltersHall`, `CoffeeHouse`, `Southwark`, `Books`, `Conclusion`) in original order. Guard checks raw fragment count 4 + 8 Astro sections = 12, absence of old `02`/`03`/`05`/`06`/`07`/`08`/`09`/`10` fragments, section markers, reconstructed body parity, word/H2 parity. |
| **AGENTS-r280** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G9: seventh visible Gill context section promoted to Astro.** `03-sec-great-ejection.html` retired and replaced by `GillContextSectionGreatEjection.astro`; `GillContextArticleBody.astro` now renders 5 raw fragments + 7 Astro sections (`ParticularVsGeneral`, `GreatEjection`, `Academies`, `SaltersHall`, `CoffeeHouse`, `Books`, `Conclusion`) in original order. Guard checks raw fragment count 5 + 7 Astro sections = 12, absence of old `02`/`03`/`05`/`06`/`07`/`09`/`10` fragments, section markers, reconstructed body parity, word/H2 parity. |
| **AGENTS-r279** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G8: sixth visible Gill context section promoted to Astro.** `06-sec-salters-hall.html` retired and replaced by `GillContextSectionSaltersHall.astro`; `GillContextArticleBody.astro` now renders 6 raw fragments + 6 Astro sections (`ParticularVsGeneral`, `Academies`, `SaltersHall`, `CoffeeHouse`, `Books`, `Conclusion`) in original order. Guard checks raw fragment count 6 + 6 Astro sections = 12, absence of old `02`/`05`/`06`/`07`/`09`/`10` fragments, section markers, reconstructed body parity, word/H2 parity. |
| **AGENTS-r278** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G7: fifth visible Gill context section promoted to Astro.** `07-sec-coffee-house.html` retired and replaced by `GillContextSectionCoffeeHouse.astro`; `GillContextArticleBody.astro` now renders 7 raw fragments + 5 Astro sections (`ParticularVsGeneral`, `Academies`, `CoffeeHouse`, `Books`, `Conclusion`) in original order. Guard checks raw fragment count 7 + 5 Astro sections = 12, absence of old `02`/`05`/`07`/`09`/`10` fragments, section markers, reconstructed body parity, word/H2 parity. |
| **AGENTS-r277** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G6: fourth visible Gill context section promoted to Astro.** `09-sec-books.html` retired and replaced by `GillContextSectionBooks.astro`; `GillContextArticleBody.astro` now renders 8 raw fragments + 4 Astro sections (`ParticularVsGeneral`, `Academies`, `Books`, `Conclusion`) in original order. Guard checks raw fragment count 8 + 4 Astro sections = 12, absence of old `02`/`05`/`09`/`10` fragments, section markers, reconstructed body parity, word/H2 parity. |
| **AGENTS-r276** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G5: third visible Gill context section promoted to Astro.** `02-sec-particular-vs-general.html` retired and replaced by `GillContextSectionParticularVsGeneral.astro`; `GillContextArticleBody.astro` now renders 9 raw fragments + 3 Astro sections (`ParticularVsGeneral`, `Academies`, `Conclusion`) in original order. Guard checks raw fragment count 9 + 3 Astro sections = 12, absence of old `02`/`05`/`10` fragments, section markers, reconstructed body parity, word/H2 parity. |
| **AGENTS-r275** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G4: second visible Gill context section promoted to Astro.** `05-sec-academies.html` retired and replaced by `GillContextSectionAcademies.astro`; `GillContextArticleBody.astro` now renders 10 raw fragments + 2 Astro sections (`Academies`, `Conclusion`) in original order. Guard checks raw fragment count 10 + 2 Astro sections = 12, absence of old `05`/`10` fragments, academies/conclusion markers, reconstructed body parity, word/H2 parity. |
| **AGENTS-r274** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 parallel pilot advanced `/baptisty-rossii/` landing without touching Kod/Gill article lanes.** `BaptistyRossiiMain.astro` no longer proxies `_legacy/main.html?raw`. The GBS2 landing main is now assembled from named legacy-faithful fragments: `header-hero.html`, `article-body.html`, and `post-article.html`, preserving the premium series DOM/copy while removing the monolithic main transport. `baptisty-rossii-visual-parity-audit` now guards the split-main contract and forbids regression back to the raw main import. |
| **AGENTS-r273** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 parallel pilot advanced `/karty/` without touching Kod/Gill article lanes.** `KartyMain.astro` no longer proxies `_legacy/hub.html?raw`. The premium standalone hub is now composed from named Astro leaf components: `KartyBackLink`, `KartyHeroSection`, `KartyBodySection`, `KartyNote`, preserving the legacy DOM/classes/copy and standalone `karty-hub` shell. `karty-visual-parity-audit` now guards the componentized-hub contract and forbids regression back to the raw monolith import. |
| **AGENTS-r271** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G3: first visible Gill context section promoted to Astro.** `10-sec-conclusion.html` retired and replaced by `GillContextSectionConclusion.astro`; `GillContextArticleBody.astro` renders 11 raw fragments + the Astro conclusion component in the original order. Guard now checks raw fragment count 11 + 1 Astro section = 12, absence of the old conclusion fragment, conclusion H2/note-box markers, reconstructed body parity, and word/H2 parity. Pixel parity remains 0.000% desktop/mobile. |
| **AGENTS-r270** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G2: `/articles/dzhon-gill-istoricheskiy-kontekst/` article body split into ordered section seams.** `GillContextArticleBody.astro` now owns `<article class="article-body">` and renders 12 ordered raw fragments from `_legacy/article-sections/`; retired `_legacy/article-body.html` monolith. Guard `gill:context:visual-parity:audit` now enforces fragment count/order, monolith absence, reconstructed body parity, word/H2 parity, and generic-layout bans. Pixel parity for Gill context remains 0.000% desktop/mobile at threshold 0.5. |
| **AGENTS-r269** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Gill Phase G1: `/articles/dzhon-gill-istoricheskiy-kontekst/` componentized shadow-breakout.** Код Да Винчи остаётся за другим агентом; первая Gill-страница вышла из pure `bodyHtml` transport в Gill-specific Astro seams: `GillContextMainShell` + `HeaderHero` / `ArticleBody` / `PostArticle` and `_legacy` body segments. Content/visual output intentionally unchanged; reconstructed body matches legacy after whitespace normalization, word/H2 parity preserved. New guard: `npm run gill:context:visual-parity:audit`, wired into `validate:static-publication`. See `docs/refactor-2026/PILOT_IMPLEMENTATION_GILL_CONTEXT_2026-06-22.md`. |
| **AGENTS-r269a** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 parallel pilot moved into `/konfessii/`, still staying off Kod/Gill lanes.** `KonfessiiMain.astro` no longer proxies one `_legacy/main.html?raw` blob. The standalone confessions grid is now composed from named Astro leaf components: `KonfessiiRusskijBaptizmCard`, `KonfessiiPentecostalCard`, `KonfessiiOverviewCard`, preserving the legacy DOM/classes/SVG/copy and the required inline Pagefind sr-only style. `konfessii-visual-parity-audit` now guards the componentized-main contract and forbids regression back to the raw monolith import. |
| **AGENTS-r268** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 parallel pilot continued on `/pastor-series/`, still avoiding Kod/Gill overlap.** `PastorSeriesMain.astro` no longer proxies one `_legacy/main.html?raw` blob. The route now composes `<main id="main-content">` from named Astro leaf components: `PastorSeriesCardsSection`, `PastorSeriesStatsSection`, `PastorSeriesArticleEndBlock`, preserving legacy text/classes/URLs and planned-card states. `pastor-series-visual-parity-audit` now guards the componentized-main contract and forbids regression to the raw monolith import. |
| **AGENTS-r267** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 parallel pilot: `/hard-texts/` main shell componentized without touching Kod/Gill lanes.** `HardTextsMain.astro` no longer proxies one `_legacy/main.html?raw` blob. The route now composes `<main id="main-content">` from named Astro leaf components: `HardTextsCardsSection`, `HardTextsStatsSection`, `HardTextsSeriesMapSection`, `HardTextsArticleEndBlock`, while preserving legacy text/classes/URLs. `hard-texts-visual-parity-audit` now guards the new contract and forbids a return to the monolithic raw main import. |
| **AGENTS-r266** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Phase 3c: first visible Astro-owned section in `/articles/kod-da-vinchi/`.** `01-sec-intro.html` promoted to `KodDaVinchiSectionIntro.astro` while preserving legacy DOM/classes (`sec-intro`, `drop-cap`, `fn-marker`, `quote-box`). Remaining legacy visible fragments now 19 (`02-sec-phenomenon.html` first). `article-mdx-pilot-audit` guards the intro component markers and remaining fragment count. Comment-insensitive article body parity remains exact after build. |
| **AGENTS-r265** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Phase 3b: first real Astro island inside `/articles/kod-da-vinchi/` article body + related read-time drift guard.** Pagefind metadata moved from raw `00-pagefind-meta.html` into `KodDaVinchiPagefindMeta.astro`; article body now has 20 visible section fragments. `article-mdx-pilot-audit` verifies the Astro meta component and section seam. Visible related-card read times were synced to `data/search-manifest.json` (`kod-da-vinchi` 30, hermeneutics 50), and `data:consistency` now guards `.related-articles__tag` read-time drift. |
| **AGENTS-r264** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Phase 3a: `/articles/kod-da-vinchi/` article body split from monolith to ordered section seams.** `KodDaVinchiArticleBody.astro` no longer imports one 80K `_legacy/article-body.html`; the body is now `<article class="article-body" data-pagefind-body>` + 21 ordered fragments under `_legacy/article-sections/` (`00-pagefind-meta.html`, `01-sec-intro.html` … `20-summary-title-auto.html`). `article-mdx-pilot-audit` guards against monolith resurrection and requires 21 fragments with Pagefind meta first. Normalized legacy article body equals dist article body after split. This prepares safe one-section-at-a-time MDX/Astro activation without visual drift. |
| **AGENTS-r263** | 2026-06-22 | **Post-audit hardening after current-main recheck.** Fixed `/articles/kod-da-vinchi/` double theme toggle, fake pilot cache-bust labels, Gill III readable defects, stale root read-time text, map placeholder indexing/search governance, `css:layer:validate`, visual-audit false-green, `/about/` stale full-document parity requirement, workflow notification gaps. Added map publication-status guard, search fallback drift guard, dist-readable fatal patterns and stricter visual-audit exit behavior. See `docs/CURRENT_RECHECK_2026-06-22_FIXES.md`. |
| **AGENTS-r262** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Phase 3 JS decomposition pilot.** 4 modules extracted from site.js into `js/modules/`: `faq-accordion.js` (1.5KB, zero deps), `theme.js` (3.9KB, dark/light toggle), `img-loaded.js` (1.1KB, shimmer stop), `back-to-top.js` (1.3KB, scroll-to-top). All use AbortController for cleanup. Bundled as `js/site-modules.js` (8.1KB), loaded on pilot page after site.js. CSS: `site-layered.css` cleaned (!important=202, matches site.css). Gates: audit-pro PASSED, URL contract 51/51. |
| **AGENTS-r261** | 2026-06-22 | **РЕФАКТОРИНГ 6.0 Phase 1+2 pilot progress.** (1) Shadow-breakout pilot: `/articles/kod-da-vinchi/` transitions from pure-full-body-shadow to componentized shadow — `<main>` extracted into `KodDaVinchiMainShell.astro`, then split into 3 semantic components (`HeaderHero`/`ArticleBody`/`PostArticle`). DOM markers: 12/12 preserved, h2 count 22/22, article body EXACT PARITY. MDX activation BLOCKED pending enrichment (MDX has 0/103 CSS classes from legacy HTML — documented in `MDX_ENRICHMENT_GAP_2026-06-22.md`). (2) CSS @layer: `css/site-layered.css` created with 8-layer architecture (`reset, base, legacy, gbs2, nagornaya, components, utilities, overrides`); previously-unlayered CSS wrapped in `@layer legacy`; layered ratio: 91% (was 22.2%); pilot page uses layered CSS. (3) Route profiles: 52 profiles generated in `data/route-profiles/`. (4) `scripts/css-layer-validator.js` + `scripts/generate-route-profiles.js` created. Gates: audit-pro PASSED, URL contract 51/51, build 52 pages. |
| **AGENTS-r260** | 2026-06-22 | **CRITICAL CONTENT REGRESSION FIX: 19 native Astro routes switched back to legacy shadow-wrap.** These routes were rendering via `BaseLayout`/`ArticleLayout` (native Astro) instead of `loadLegacyFullDocument`, producing different HTML structure (`astro-shell`/`astro-header`/`astro-article`) than the premium legacy design (`gbs-paper`/GBS2 chrome). Affected: 5 article routes (kod-da-vinchi, 20-antisovetov, rimlyanam-7, krajne-li-isporcheno, hermenevticheskaya-otsenka), 10 baptisty-rossii series routes, karty/avraam, karty/ishod, konfessii/russkij-baptizm, rodosloviye. All converted to `loadLegacyFullDocument` shadow-wrap with sr-only `data-pagefind-body` for search. Gates: audit-pro 164/0 ✅, URL contract 51/51 ✅, page-ownership ✅, build 52 pages ✅. **Also:** SANDBOX-ENV v8.0 with §16 VISION/IMAGE full diagnosis + OCR workaround; `/about/` route profile (`data/route-profiles/about.json`). |
| **AGENTS-r259** | 2026-06-20 | **DALL-E visual references для `/karty/*` библейских карт загружены в `docs/dalle-refs/v3-biblical-maps/`.** 13 PNG: царства Израиля/Иудеи (01), 3 путешествия Павла (02-03), Библейский атлас с эрами (04, 12), Авраам с хронологией (05), Исход (06), 12 колен Израилевых (07), Израиль/Иудея с табами эр (08), Земля Иисуса с sidebar (09), Апостолы с кораблями (10), Иерусалим со стеной Неемии (11), техническая карта со слоями (13). **⚠️ ЭТО DALL-E:** координаты приблизительные, названия упрощены, хронология может быть неверной, маршруты не реалистичны. **НЕ копировать буквально.** Цель — visual layout pattern + sidebar patterns + era timeline tabs + multi-journey overlays + detail panels. **Топ-уровень по стилю**, но реальные данные берём из `route.json` + канонических источников. Подробная карта реализации (файлы для создания, паттерны, что НЕ делать) — `docs/dalle-refs/v3-biblical-maps/README.md` (236 строк). Обновлён главный README: `docs/dalle-refs/README.md`. |
| **AGENTS-r258** | 2026-06-20 | **DALL-E visual reference documentation загружена в `docs/dalle-refs/`.** Владелец приложил 16 PNG (9 новых + 7 ранних) с DALL-E референсами для `/rodosloviye/` genealogy tree. **Важно прочитать `docs/dalle-refs/README.md` перед любой работой над древо!** Главное предупреждение: **это DALL-E, не библия** — связи часто нарисованы неправильно, имена могут быть выдуманные (например, на `v2/06-unnamed-wife-7-kids-detail.png` показана "безымянная жена" с 7 детьми), хронология может быть неверной. **Скрин `v2/03-bug-overlay-visual-errors.png` — ОБРАЗЕЦ ОШИБОК:** красные подсветки показывают что НЕ делать (наложения, обрезанный текст, broken layout). **Не копировать буквально.** Цель референсов — visual layout pattern + цветовая палитра (cream/beige + gold #d4a857/#c4a04a + teal для Луки + purple для Матфея). Данные проверять против `data/genealogy/genealogy.json` (156 персон) и канонических источников (Быт 5/10/11/22/25/36/46, 1 Пар 1-9, Мф 1, Лк 3). **Архитектурный план:** `docs/dalle-refs/GBS_INTERACTIVE_ARCHITECTURE_RESEARCH_2_0_2026-06-20.md` (1478 строк) — полное ТЗ 2.0 для следующих агентов. **Дополнительно:** сделаны UX-фиксы — Avraam tour step 1050ms→4500ms (пользователь жаловался: «слишком быстро»), убран auto-open первой точки при выборе истории (пользователь: «карта превратилась не в карту, а в маршруты»), genealogy `minZoom` 0.04→0.5 (77→143 видимых узлов при initial fitView). |
| **AGENTS-r257** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 closing 3 remaining holes: (1) `maps:validate` broken regex literal fixed; (2) MapEngine document-level listener leak closed; (3) CI integration of `visual:parity:guard`.** (1) **CRITICAL regex bug в `scripts/validate-map-routes.js`**: regex literal `/href=["']\.\/[^\"']*\b${id}\b[^\"']*["']/` искал буквальный substring "${id}" (JS regex literals НЕ интерполируют template literals) → все 10 routes ошибочно помечались как missing clickable card. Сломан с AGENTS-r252. Fixed: `new RegExp(\`href=["']\\.\\/[^\"']*\\b${id}\\b[^\"']*["']\`)` правильно интерполирует. Также добавлено распознавание owner-design «audit-pending» для `/karty/` hub: explicit message «9 на аудите» + numeric `<b>9</b><span>на аудите</span>` match — owner design «только Авраам + 9 на аудите» теперь не блокирует CI. (2) **MapEngine leak**: 2 raw `document.addEventListener('pointermove'/'pointerup')` calls в panel resize handler были document-level и не tracked — destroy() их не cleanup. Заменены на `_on(document, ...)`. Расширен `scripts/avraam-map-audit.js` с 4 lifecycle checks: `destroy()` exists, `_on()` tracks listeners, `_cleanupAll()` removes, document.pointer* tracked. (3) **CI integration**: новый `.github/workflows/visual-parity.yml` — weekly Monday 06:00 UTC + manual trigger. Pipeline: `strangler:build:production-like` → `visual:parity:screenshots` → `visual:parity:baseline:check`. Owner-approved `--update` only via `OWNER_APPROVED=true` env var. `notify-on-failure.yml` обновлён чтобы слушать новый workflow. **§12.5.6 known-debts обновлён**: 2 HIGH долга (19 listeners, нет destroy()) теперь ✅ Исправлено. **Итог: `validate:static-publication` exit 0, `audit-pro` 164 passed · 0 errors, `avraam:audit` 28/28 passed, `maps:validate` 10/10 ✅.** |
| **AGENTS-r256** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 Phase 6 verification pass: pixel-diff guard выполнен вживую.** Arena Agent запустил полную цепочку `strangler:build:production-like` (Node 22.12.0, Astro 6) → `visual:parity:screenshots` (Playwright chromium-headless-shell v1223 + pixelmatch@^5.3.0) → `visual:parity:baseline:check` против реального `origin/main@de1fbee2`. **Результат: 13 routes × 2 viewports = 26/26 PASS** при threshold 1%, tolerance 0.5%. Максимальный diff — 0.126% (`/nagornaya/chast-5/` mobile, большой 37K-px документ, micro-noise floor). 24 viewports — 0.000% desktop+mobile; 1 viewport — 0.004% mobile (`/nagornaya/`); 1 viewport — 0.126% mobile (`/nagornaya/chast-5/`). **Это закрывает разрыв source-only → pixel-level:** Phase 6 native-shadow recipe **доказуемо** byte-identical на pixel-уровне, не только на DOM-маркерах. Артефакты: `audit/visual-parity-evidence-2026-06-20.md` (полный отчёт 26 пар) + `data/visual-parity-baseline.json` (добавлены `/nagornaya/chast-1/` 0/0 и `/nagornaya/chast-5/` 0.004/0.126 entries для Phase 6 wave 7 routes, которые появились ПОСЛЕ r248 baseline creation). Никаких изменений в `src/**`, `js/**`, `css/**`, конфигах workflow, deps. **Pure documentation commit**, zero risk. См. AGENTS-r248 (Phase 5 infra) + REFACTORING_5_0_PIXEL_DIFF_GUARD_2026-06-20.md §10. |
| **AGENTS-r255** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 Phase 6 wave 7: `/nagornaya/*` + 8 subroutes native pilot.** ВСЕ 9 страниц серии «Нагорная проповедь» переведены с partial/full-document shadow на native-shadow recipe (r249-r254): landing + chast-1..5 + seriya + istochniki + nakhodki. Уникальный Tailwind world: desktop fixed left aside (w-64) + mobile TOC + mobile menu. Семантический блок — `<main id="main-content" class="lg:pl-64" data-pagefind-body">` для chast-N, `<main id="main-content">` для остальных. Body chrome (skip-link, desktop sidebar, mobile menu, runtime `nagornaya-mobile-toc.js` + `SITE_CONFIG`) сохранён verbatim через Vite `?raw`. **Архитектура:** единый компонент `src/components/nagornaya/NagornayaPageMain.astro` использует Vite `import.meta.glob('./*/_legacy/main.html', { query: '?raw' })` для подгрузки правильного fragment по `slug` prop (один компонент, 9 страниц). 9 `_legacy/` директорий: `index/`, `chast-1/`, ..., `chast-5/`, `seriya/`, `istochniki/`, `nakhodki/`. **Артефакты:** `src/components/nagornaya/NagornayaPageMain.astro` + 9 `_legacy/` директорий (27 legacy fragments, byte-identical) + 9 Astro pages в `src/pages/nagornaya/` + `scripts/nagornaya-visual-parity-audit.js` + `package.json`: `nagornaya:visual-parity:audit` в chain. **Мотивация (владелец):** «буду ещё добавлять и углублять нагорную» — лучше перевести сейчас под native-shadow, чтобы будущие правки шли в Astro components / `_legacy` fragments, а не в monolithic legacy HTML. **Финальный результат Рефакторинга 5.0:** 10 из 11 landing'ов + 8 subroutes = 18 страниц теперь настоящие Astro pages. Только `/map/` остаётся в shadow-wrap (intentional, JS-driven SVG). Зелёные gates: `nagornaya:visual-parity:audit` ✅ 50+ source-only checks, `audit-pro` 164 passed · 0 errors. См. `REFACTORING_5_0_PIXEL_DIFF_GUARD_2026-06-20.md` §10. |
| **AGENTS-r254** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 Phase 6 wave 6: `/` (home) native pilot.** Самая критичная landing — premium standalone главная — переведена с full-document shadow на native-shadow recipe (r249-r253). **Семантический блок** — `<main id="main-content" data-pagefind-body>` (h-hero, h-mobile-hero-hub, resume-reading block, h-mobile-dashboard с 4 quick-start карточками, h-mobile-rail, h-mobile-paths с 6 guided-reading карточками, h-mobile-dock, h-featured shelves «Биографии служителей» + «Нагорная проповедь», h-card-glass «Публикации», h-card-planned «В планах», h-article-list, h-about, h-quote-section, gb-accuracy-block, sdg-footer). **Body chrome** (body-segment-{0,1}.html, byte-identical через Vite `?raw`): skip-link, hMobileBackdrop, h-mobile-nav, h-navbar, home-v20 wrapper open/close, gbFloatingControls, runtime `<script>` (sw-register, search). `package.json`: `home:visual-parity:audit` встроен в `validate:static-publication` chain. **Результат:** 9 из 11 landing'ов теперь настоящие Astro pages, остались 2 в shadow-wrap: `/nagornaya/` (HIGH, Tailwind sidebar — пропускаем по запросу владельца), `/map/` (intentional, JS-driven SVG). Зелёные gates: `home:visual-parity:audit` ✅, `baptisty-rossii:visual-parity:audit` ✅, `karty:visual-parity:audit` ✅, `audit-pro` 164 passed · 0 errors. **Финальный результат Рефакторинга 5.0:** все 5 high/MED risk landings (кроме Nagornaya) теперь настоящие Astro pages. |
| **AGENTS-r253** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 Phase 6 wave 5: `/baptisty-rossii/` native pilot.** Series overview landing переведён с full-document shadow на native-shadow recipe (r249-r252). **Семантический блок** — `<main id="main-content">` (gbs2-hero + article-header + h-article-list с 10 карточками частей + note-box + research link + article-end-block). **Body chrome** (body-segment-{0,1}.html, byte-identical через Vite `?raw`) включает полную GBS2 chrome: skip-link, gbs2-mobile-head (sticky), gbs2-world wrapper, gbs2-rail (sidebar со всеми 10 частями + progress ring + theme/font/share/search controls), breadcrumb, gbs2-bbar (mobile bottom bar), gbs2-sheet (mobile sheet с частями/TOC tabs), runtime `<script>` блоки. **Важно:** `gbs2-timeline` и `author-card` НЕ присутствуют в landing `/baptisty-rossii/` — они живут в `SeriesArticleLayout.astro` для INDIVIDUAL статей (`/baptisty-rossii/noch-na-kure/` и т.д.). Это правильное разделение: index landing = обзор серии, individual article = серийный мир для чтения. Артефакты: `src/components/baptisty-rossii/BaptistyRossiiMain.astro`, `src/components/baptisty-rossii/_legacy/{main,body-segment-0,1}.html`, `scripts/baptisty-rossii-visual-parity-audit.js`. `package.json`: `baptisty-rossii:visual-parity:audit` встроен в `validate:static-publication` chain (между `karty:visual-parity:audit` и `catalogs:visual-parity:audit`). **Результат:** 8 из 11 landing'ов теперь настоящие Astro pages, остались 3 в shadow-wrap: `/nagornaya/` (HIGH, Tailwind sidebar — пропускаем по запросу владельца), `/` (home, HIGH), `/map/` (intentional, JS-driven SVG). Зелёные gates: `baptisty-rossii:visual-parity:audit` ✅, `karty:visual-parity:audit` ✅, `audit-pro` 164 passed · 0 errors. |
| **AGENTS-r252** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 Phase 6 wave 4: `/karty/` native pilot + depth-aware extract-native-pilot.js.** `/karty/` переведён с full-document shadow на native-shadow recipe (r249-r251). Главная фишка — `scripts/extract-native-pilot.js` стал **depth-aware** для nested block tags (`<div>`, `<section>`, `<aside>`, `<article>`, `<main>`, `<nav>`, `<header>`, `<footer>`, `<form>`, `<figure>`): вместо первого `</div>` после start (раньше ломалось на `karty-hero__inner` — первый `</div>` после `<div class="karty-hub">`), теперь считает depth и матчит по балансу. Артефакты: `src/components/karty/KartyMain.astro`, `src/components/karty/_legacy/{hub,body-segment-0,body-segment-1}.html`, `scripts/karty-visual-parity-audit.js`. `/karty/` — premium standalone landing без body chrome (skip-link, theme toggle, breadcrumb, footer) — всё тело = один `<div class="karty-hub" data-pagefind-body>`, поэтому `body-segment-{0,1}.html` пустые (1 байт). Pixel parity гарантирован byte-identical через Vite `?raw` import (как в r249-r251). `package.json`: `karty:visual-parity:audit` встроен в `validate:static-publication` chain (между `konfessii:visual-parity:audit` и `catalogs:visual-parity:audit`). **Результат:** 7 из 11 landing'ов теперь настоящие Astro pages, остались 4 в shadow-wrap: `/baptisty-rossii/` (HIGH, GBS2 world), `/nagornaya/` (HIGH, Tailwind sidebar), `/` (home, HIGH), `/map/` (intentional, JS-driven SVG). Зелёные gates: `karty:visual-parity:audit` ✅ 17/17 source-only checks, `audit-pro` 164 passed · 0 errors. См. `REFACTORING_5_0_PIXEL_DIFF_GUARD_2026-06-20.md` §10 roadmap. |
| **AGENTS-r251** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 Phase 6 wave 3: native pilots для `/articles/` и `/konfessii/`.** Тот же native-shadow рецепт расширен на 2 MED-risk landings: `/articles/` (catalog с `articles-index-page` + `h-article-list`) и `/konfessii/` (standalone HTML с inline `<style>`). Добавлены `ArticlesMain.astro` и `KonfessiiMain.astro` компоненты, чек-конроль через `articles-visual-parity-audit.js` и `konfessii-visual-parity-audit.js`. **Особый момент для `/konfessii/`:** страница не подключает `css/site.css`, поэтому Pagefind sr-only div ОБЯЗАН содержать inline visually-hidden style (защищается r247 fix); audit проверяет `position:absolute;left:-9999px` в Astro файле. `catalogs-visual-parity-audit.js` обновлён — `/articles/` переведён на `bodyContract: 'native-shadow'`. **`/map/` остался в shadow-wrap осознанно**: это interactive SVG-визуализация без `<main>`, разбивать смысла нет, только высокий риск сломать JS. **Результат:** 6 из 11 landing'ов теперь настоящие Astro pages (`/about/`, `/biografii/`, `/hard-texts/`, `/pastor-series/`, `/articles/`, `/konfessii/`), остальные 5 (`/map/`, `/karty/`, `/baptisty-rossii/`, `/nagornaya/`, `/`) в shadow-wrap. Все 11 routes × 2 viewports проходят visual:parity:guard с diff ≤ baseline + tolerance, 21×0.000% + 1×0.002% noise floor. Зелёные gates: `validate:static-publication` ✅ (164 passed, 0 errors), `visual:parity:guard` ✅. Следующее — HIGH-risk pilots (`/karty/`, `/baptisty-rossii/`, `/nagornaya/`, home), требуют отдельного owner approval из-за GBS2 worlds / Tailwind sidebar / MapEngine / mobile sheet особенностей. |
| **AGENTS-r250** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 Phase 6 wave 2: native pilots для `/biografii/`, `/hard-texts/`, `/pastor-series/` + retry-loop в pixel guard.** Повторён тот же native-shadow рецепт, что доказан на `/about/` (r249): legacy `<head>` через `loadLegacyFullDocument` byte-identical, body chrome через `body-segment-{0,1}.html` фрагменты, semantic block `<main>` промоутится в named Astro-компонент (`BiografiiMain`, `HardTextsMain`, `PastorSeriesMain`). Добавлен helper `scripts/extract-native-pilot.js` — повторяет split body→segments+blocks для будущих pilot'ов. Per-route audits: `scripts/{biografii,hard-texts,pastor-series}-visual-parity-audit.js` подключены в `validate:static-publication`. `scripts/catalogs-visual-parity-audit.js` обновлён под двойной контракт: `bodyContract: 'full-shadow'` (для shadow-wrap routes как `/articles/`) и `bodyContract: 'native-shadow'` (для Phase 6 routes как `/biografii/`). **Критический фикс в guard'е:** `scripts/visual-parity-screenshots.js` получил `img.complete && naturalWidth > 0` waiter + retry-loop (до 3 попыток, фиксируется минимальный diff). До этого `/biografii/` desktop flake-fail'ил 5.001% при работающем HTML — большой `<picture class="bio-cover">` не успевал декодироваться к моменту screenshot'а несмотря на `networkidle`. 5 проверочных прогонов после фикса — 5/5 зелёных. **Результат:** все 11 landing routes × 2 viewports = 21×0.000% + 1×0.002% (`/articles/` mobile = noise floor). 4 страницы (`/about/`, `/biografii/`, `/hard-texts/`, `/pastor-series/`) теперь настоящие Astro pages с editable semantic components, остальные 7 landings + 5 Gill GBS + 3 Nagornaya subroutes пока в shadow-wrap. Следующий pilot по плану `REFACTORING_5_0_PIXEL_DIFF_GUARD_2026-06-20.md` §3 roadmap: `/konfessii/` (MED risk: landing + 3D-баптизм ссылки), затем `/map/`. `/karty/`, `/baptisty-rossii/`, `/nagornaya/`, `/` (home) — HIGH risk, требуют отдельных планов и approve владельца. Зелёные gates: `validate:static-publication` ✅ (audit-pro 160 passed, 0 errors), `visual:parity:production` ✅, `visual:parity:guard` ✅. |
| **AGENTS-r249** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 Phase 6: первый shadow→native pilot — `/about/`.** Под защитой Phase 5 pixel-diff guard (`visual:parity:guard`) выполнен первый осторожный native pilot по `OWNER-REQUIREMENTS` («Astro без заглушек», 95%+ visual parity). Подход «native-shadow»: legacy `<head>` остаётся verbatim через `loadLegacyFullDocument` (SEO/JSON-LD/Metrika/SITE_CONFIG byte-identical), legacy body chrome (skip-link, theme toggle, breadcrumb, footer, runtime `<script>`) — через 3 фрагмента `_legacy/body-{before,mid,after}.html`, а два semantic-блока — `<article class="about-page">` и `<aside class="gb-accuracy-block">` — вынесены в именованные Astro-компоненты `src/components/about/AboutArticle.astro` и `AboutAccuracyBlock.astro`. Сырые legacy-фрагменты лежат под `src/components/about/_legacy/*.html` (audit-pro `skipDirs` расширен на `_legacy` чтобы не валидировать их как самостоятельные страницы). **Результат:** `npm run visual:parity:screenshots -- --routes /about/` → desktop 0.000% / mobile 0.000% diff, все 11 landings × 2 viewports остались в пределах owner-approved baseline. **Что это даёт владельцу:** теперь `/about/` — настоящая Astro-страница, секции редактируются как отдельные компонентные файлы, а не grep'ом в monolithic `about/index.html`. **Что ещё не сделано:** содержимое `AboutArticle` / `AboutAccuracyBlock` пока импортируется raw из `_legacy/*.html` (`?raw`) — следующая итерация переведёт их в hand-authored Astro/MDX, но только под защитой того же `visual:parity:guard`. Audits обновлены: `about-visual-parity-audit.js` теперь проверяет native-shadow контракт (`AboutArticle`, `AboutAccuracyBlock`, `_legacy/body-*.html`, отсутствие BaseLayout/Header/Footer), `audit-pro` пропускает `_legacy/` директории. План dал и pilot roadmap (`/biografii/` → `/hard-texts/` → `/pastor-series/` → дальше) живут в `docs/refactor-2026/REFACTORING_5_0_PIXEL_DIFF_GUARD_2026-06-20.md`. Зелёные gates: `validate:static-publication` ✅ (audit-pro 0 errors), `about:visual-parity:audit` ✅, `visual:parity:production` ✅, `visual:parity:guard` ✅, `visual:parity:screenshots -- --routes /about/` ✅ 0.000% desktop / 0.000% mobile. |
| **AGENTS-r248** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 Phase 5: pixel-diff visual parity guard.** Phases 1–4 (r245-r247) восстановили shadow-wrap visual parity и закрыли все generic `astro-card-grid` regression markers через DOM-marker / structural / contract gates. Но это не доказывает byte-identical визуал и не ловит будущие микро-регрессии CSS/legacy, которые сохраняют DOM-маркеры. Phase 5 закрывает gap: добавлены `scripts/visual-parity-screenshots.js` (Playwright + pixelmatch, два HTTP-сервера legacy/dist, full-page desktop 1280×900 + mobile 390×844, защита от lazy-load false-positives через eager + decode + bottom→top scroll, freeze animations/transitions) и `scripts/visual-parity-baseline.js` (owner-approved baseline `data/visual-parity-baseline.json`, валит CI при росте diff% > baseline + tolerance default 0.5%). npm: `visual:parity:screenshots(:landings)`, `visual:parity:baseline:{check,update}`, `visual:parity:guard`. devDeps: `pixelmatch@^5.3.0`, `pngjs@^7.0.0`. **Результат на текущем main:** 11 landing routes × 2 viewports = 21×0.000% + 1×0.004% — shadow-wrap r245+r247 **действительно** byte-identical визуально (раньше это утверждалось только на основе DOM-маркеров). Никаких production HTML/CSS/JS изменений (zero-risk infrastructure). Pilot план первой shadow→native миграции `/about/`, anti-regression contract, CI-integration TODO: `docs/refactor-2026/REFACTORING_5_0_PIXEL_DIFF_GUARD_2026-06-20.md`. **Правило промоушна**: любая будущая `shadow-wrap → native Astro` промоция URL ОБЯЗАНА (a) пройти `visual:parity:guard` ≤ baseline + tolerance, (b) приложить `reports/visual-parity/<route>/diff-*.png` в PR, (c) обновить baseline через `--update` только с commit message `visual-baseline(<route>): owner-approved diff X% desktop / Y% mobile — <reason>`. Playwright system libs (libnspr4, libnss3, libatk*, libgbm1, libpango-1.0-0, libcairo2, libasound2, libatspi2.0-0) требуются в любой среде где запускается guard; CI-интеграция в `strangler:deploy-readiness` — TODO после стабилизации Playwright в Actions runner. |
| **AGENTS-r247** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 hardening after crash: visual contract реально заблокировал оставшиеся generic routes.** После восстановления сессии и синхронизации с актуальным `origin/main` найдено, что `visual:parity:production` всё ещё падал на `/nagornaya/seriya/` и Gill GBS pages, а `workflows:check` не пропускал dist deploy без ownership/dist-publication/SW/visual gates. Исправлено: Gill cluster и Nagornaya `seriya/istochniki/nakhodki` переведены на full-document shadow, `legacyFullDocument` сохраняет head verbatim и корректно парсит body attrs, deploy.yml получил обязательные `page-ownership:dist:production-like`, `visual:parity:production`, `dist-publication-audit --require-pagefind --forbid-dev`, `sw:dist:audit:deploy-switch`; audits обновлены под visual-first shadows/holding pages. QA: `validate:static-publication` ✅, `strangler:deploy-readiness` ✅, `visual:parity:production` ✅, `sw:dist:audit:deploy-switch` ✅, `workflows:check` ✅. |
| **AGENTS-r246** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 Phase 2+3: dist deploy switch готов.** Full-document shadow-wrap (r245) + build-time strangler + Pagefind dist + SW readiness audit all pass. Pipeline: `strangler:build:production-like` → `pagefind:build:dist` → `sw:dist:audit:deploy-switch` → green. 51/51 dist pages carry CSS, 51/51 URL contract match, 10/10 maps validate, audit-pro 0 errors. `deploy.yml` updated: `path: dist`, build step added, IndexNow key writes to `dist/`, `.nojekyll` in dist. Deploy switch approved for next CI run. |
| **AGENTS-r245** | 2026-06-20 | **РЕФАКТОРИНГ 5.0 Phase 1: full-document shadow-wrap для всех generic Astro landing pages.** Восстановление visual parity после emergency rollback (r244). Все landing/series/catalog pages с generic `astro-card-grid` заглушками (baptisty-rossii, nagornaya, karty, hard-texts, konfessii, pastor-series, map, home) переведены на `loadLegacyFullDocument` full-document shadow: emits ровно тот же legacy HTML без BaseLayout и без generic Astro CSS. Правило: пока route не прошёл 95%+ visual parity, он остаётся в `shadow-pilot` (или `shadow-dist`); promotion в `production-dist` требует screenshots, DOM-marker contract, owner review. Deploy остаётся на root до завершения Phase 2 dist readiness. См. `docs/refactor-2026/REFACTORING_5_0_PLAN.md`. |
| **AGENTS-r244** | 2026-06-19 | **EMERGENCY: dist deploy rollback + Astro visual-parity doctrine.** Владелец подтвердил критический регресс: H1/H2/SEO/word-count без визуала = 0% visual parity. Production `dist` switch выкатил generic Astro-заглушки вместо legacy premium pages. Немедленная цель проекта: перейти на Astro только при 95%+ визуальном совпадении legacy→Astro desktop/mobile, без `astro-card` заглушек, с сохранением серийных миров (Гилл = GBS2, Нагорная = отдельный Tailwind/sidebar world). До прохождения route-specific visual contract production deploy возвращается на legacy root. Любая будущая `shadow-pilot → production-dist` promotion обязана иметь screenshots, DOM-marker contract и ручное owner review. |
**Historical note:** 2026-06-15 also included a 3D Russian Baptist map UX pass: Timeline landmark-mode, softer map highlight, wheel-capture and no native button titles. That work was completed in the iframe app and guarded by `konfessii:audit`; it remains part of project history but is intentionally kept outside the AGENTS changelog table so the table stays machine-readable.


Older changelog rows **AGENTS-r77–r131** and older 2026-06-13 map-wave rows **r131–r139** archived to `docs/AGENTS-CHANGELOG-ARCHIVE-2026-06-14.md` to keep this instruction file scannable; normative rules below remain authoritative.

**Владелец:** Фёдор Милованов (редактор/автор-редактор, не «автор»)
**Прод:** https://gospod-bog.ru · GitHub Pages workflow artifact `dist` из ветки `main`
**Node:** требуется `>=22.12.0` (Astro 6 scaffold; legacy scripts также проверены на Node 22 в CI)

---

## 0. TLDR — что СРАЗУ нельзя делать

1. ❌ **Создавать новые CSS/JS файлы.** Архитектурный максимум: **5 CSS + 1 шрифтовой + 11 JS**. Список фиксирован, см. §2.
2. ❌ **Менять byline на «Автор: Фёдор Милованов».** Только `Автор-редактор:` (тип A/B) или `Редактор:` (тип C — переводы). См. §3.1.
3. ❌ **Возвращать `AI-disclosure`.** Удалён 2026-06-02 (`AGENTS-r11`), повторно удалён в PLAN-04 (CSS-остатки). Об ИИ — только на `/about/`.
4. ❌ **Запускать `prettier --write .` или `eslint --fix .`** по всему дереву. Только точечно.
5. ❌ **Обновлять зависимости в `package.json`** без явного запроса.
6. ❌ **Удалять/переименовывать `?v=...` хеши.** Они генерируются `scripts/cache-bust.js`. После любой правки CSS/JS — запусти `npm run cache-bust`.
7. ❌ **Удалять заголовки `<header class="article-header">` или `<aside class="author-card">`.** Это контракт разметки.
8. ❌ **Создавать мусорные root-артефакты** (`.patch`, одноразовые `*.py`, `*.tsx` в корне). `src/**` теперь production Astro-слой: новые `src/pages/**`/`src/components/**` допустимы только по существующей Astro-архитектуре, с записью в `migration/page-ownership.json` для routes.
9. ❌ **Дублировать `<meta og:*>`.** Один `og:image` per page. JPG-fallback — только если `.jpg` файл реально есть на диске.
10. ❌ **Создавать legacy-кнопки** `.theme-float-btn`, `#themeFloat`, `#gbSearchFloat`, `.nag-theme-btn`. Удалены в PLAN-04 P5. Единственный canonical блок плавающих контролов — `gbFloatingControls` (`js/site.js` модуль 29), классы `.gb-fc-theme` / `.gb-fc-search`.
11. ❌ **Добавлять новые `!important` без анализа конкурента.** См. §4.2 — обязательный 5-шаговый чеклист.
12. ✅ **После любой правки CSS/JS** → `npm run cache-bust`.
13. ✅ **Перед коммитом** → `npm run validate:all` + `node scripts/audit-pro.js`. Оба должны быть PASS. Эти проверки теперь включают Russian quote policy guard; подробные правила — в `docs/EDITORIAL-SOURCE-POLICY.md`.
14. ❌ **Не оставлять английские прямые цитаты в русских статьях.** Названия книг/статей, URL, DOI и библиографические данные могут быть на английском; цитируемые мысли, прямые речи и сильные фразы автора в теле русской статьи должны быть переведены на русский. Оригинал можно давать только ссылкой на источник, не вставляя англоязычную цитату в текст.

---

## 1. О проекте

Христианский богословский сайт со статьями, биографиями, серией «Нагорная проповедь» (5 частей), серией «Тёмная сторона кафедры» (pastor-series), серией о Джоне Гилле (5 текстов), статьями о Коде да Винчи / герменевтике / Иеремии и др.

**Стек:** production = статический artifact `dist/`, собранный Astro 6 + MDX/content collections + build-time strangler; runtime остаётся HTML + handcrafted CSS + vanilla JS.
**Хостинг:** GitHub Pages, автодеплой через `.github/workflows/deploy.yml`, artifact path: `dist`.
**Поисковая индексация:** `.github/workflows/indexnow.yml` уведомляет Яндекс/Bing при push в main.
**Алерты на падение CI:** `.github/workflows/notify-on-failure.yml` открывает GitHub issue (label `ci-failure`).

### 1.1 Целевые браузеры

| Платформа | Браузер | Минимальная версия |
|---|---|---|
| Desktop | Chrome / Edge | 90+ |
| Desktop | Firefox | 90+ |
| Desktop | Safari | 15+ |
| Mobile | iOS Safari | 15+ |
| Mobile | Android Chrome | 90+ |
| Mobile | Samsung Internet | 16+ |

CSS-фичи, не поддерживаемые в этих версиях (`color-mix()`, `grid-template-rows: 0fr`, `:has()`), **обязаны** иметь `@supports`-fallback или каскадный fallback (`property: rgb(...); property: color-mix(...);`).

### 1.2 Метрики качества

| Метрика | Цель |
|---|---|
| Lighthouse Performance (mobile) | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Core Web Vitals LCP | < 2.5s |
| Core Web Vitals CLS | < 0.1 |
| `audit-pro` | ✅ PASSED, errors = 0 |
| `validate:all` | ✅ 0 errors, 0 warnings |
| `tokens:check` | ✅ 0 / 0 |
| `visual-audit` (Playwright) | server required; 0 console-errors, 0 network-errors, 0 unsuppressed HIGH/CRITICAL bugs |
| CSS `!important` в `site.css` | цель **≤ 200**; авто-потолок в `audit-pro.js` (сейчас 202, ratchet вниз) |

---

## 2. Архитектура — единственно верная

**Важно после refactoring 4.5:** живой сайт публикуется из generated `dist/`. Корень репозитория остаётся legacy/source/rollback layer; `src/**` — Astro production source. `dist/`, `reports/`, `pagefind/` не коммитить.

```
/
├── index.html                      ← главная
├── 404.html                        ← страница ошибки
├── sw.js                           ← Service Worker
├── manifest.json                   ← PWA
├── feed.xml                        ← RSS
├── robots.txt, sitemap.xml         ← SEO
├── llms.txt                        ← правила для LLM
├── AGENTS.md                       ← ⭐ ЭТОТ файл
├── README.md                       ← пользовательская архитектурная документация
├── AUDIT_HISTORY.md                ← консолидированный changelog аудитов
├── CNAME                           ← gospod-bog.ru
│
├── package.json                    ← build-скрипты + Astro/tooling devDependencies
├── astro.config.mjs, tsconfig.json  ← Astro static build config
├── src/                             ← Astro/MDX production source (pages/content/layouts/components)
├── migration/page-ownership.json    ← ownership manifest для dist
├── .github/workflows/              ← deploy.yml + indexnow.yml + source-links + notify-on-failure
│
├── css/                            ← РОВНО 5 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.css                    ← основной слой (статьи, шапка, тёмная тема)
│   ├── home.css                    ← только главная + каталоги (hero, dashboard)
│   ├── command-palette.css         ← поиск (Ctrl+K)
│   ├── mobile-hotfix.css           ← мобильные производительные hotfix-правки
│   └── nagornaya-mobile-toc.css    ← мобильное оглавление Нагорной проповеди
│
├── fonts/
│   └── fonts.css                   ← @font-face деклараты, не трогать
│
├── js/                             ← РОВНО 11 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.js                     ← главное (theme, nav, quiz, tooltips, gbFloatingControls)
│   ├── site-utils.js               ← утилиты, доступные отдельным страницам
│   ├── scroll-perf.js              ← производительность scroll/observers
│   ├── search.js                   ← Ctrl+K поиск (CommandPalette)
│   ├── enhancements.js             ← scroll-эффекты, lazy load, ambient phrases
│   ├── highlights.js               ← подсветка текста, заметки
│   ├── glossary.js                 ← глоссарий богословских терминов
│   ├── bookmark-engine.js          ← закладки (localStorage)
│   ├── series-cards.js             ← карточки серий
│   ├── nagornaya-mobile-toc.js     ← мобильное TOC для проповеди
│   └── sw-register.js              ← регистрация Service Worker
│
├── data/                           ← JSON-данные для рантайма
│   ├── glossary.json               ← термины глоссария
│   ├── search-manifest.json        ← индекс поиска
│   ├── series.json                 ← карточки серий
│   └── strategic-map-antisovetov.json  ← MAP_DATA для 20-antisovetov-pastoru
│
├── articles/                       ← статьи (каждая = папка с index.html)
│   ├── index.html                  ← каталог всех статей
│   ├── 20-antisovetov-pastoru/
│   ├── dzhon-gill-chast-1-chelovek/
│   ├── dzhon-gill-chast-2-uchenyi/
│   ├── dzhon-gill-chast-3-nasledie/
│   ├── dzhon-gill-istoricheskiy-kontekst/
│   ├── dzhon-gill-spravochnik/
│   ├── hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/
│   ├── kod-da-vinchi/
│   └── krajne-li-isporcheno-serdce/
│
├── nagornaya/                      ← серия «Нагорная проповедь»
│   ├── chast-1/ ... chast-5/       ← 5 частей
│   ├── istochniki/                 ← библиография
│   ├── nakhodki/                   ← находки
│   ├── seriya/                     ← обзор серии
│   ├── tw.min.css                  ← Tailwind (НЕ ТРОГАТЬ — отдельная генерация)
│   └── index.html                  ← обзор серии
│
├── about/, pastor-series/, biografii/   ← статичные разделы
│
├── scripts/                        ← build-инструменты (Node.js)
│   ├── cache-bust.js               ← ⭐ генерит ?v=... хеши
│   ├── validate.js                 ← валидация HTML/JSON/манифестов
│   ├── audit-pro.js                ← главный аудит (запускать перед каждым push)
│   ├── seo-audit.js                ← SEO-проверки
│   ├── visual-audit.js             ← Playwright скриншоты + console/network errors
│   ├── update-meta.js              ← обновление meta-тегов
│   ├── check-design-tokens.js      ← валидация дизайн-токенов
│   ├── deep-check.js, _audit-deep.js  ← глубокий аудит (внутренние)
│   ├── download-fonts.js           ← скачка шрифтов
│   ├── build-avif.sh               ← конвертация в AVIF
│   └── resize_og.py                ← рескейл OG-картинок (Pillow)
│
├── audit/                          ← последние audit-pro отчёты + AUDIT_CLEANUP_PLAN
└── images/                         ← все изображения
```

### Запрещено создавать новые CSS-файлы

У сайта **ровно 5 CSS + 1 шрифтовой**. Каждый файл = отдельный HTTP-запрос на статическом хостинге без bundler'а. Новая правка идёт в существующий файл по таблице:

| Что правишь | В какой CSS |
|---|---|
| Общие компоненты, статьи, шапка, тёмная тема | `site.css` |
| Главная + каталоги (только то, чего нет на других страницах) | `home.css` |
| Поиск (Ctrl+K, всплывашка) | `command-palette.css` |
| Мобильные hotfix touch-pointer overrides | `mobile-hotfix.css` |
| Мобильное оглавление Нагорной проповеди | `nagornaya-mobile-toc.css` |
| @font-face декларации | `fonts/fonts.css` |
| Tailwind для Нагорной | `nagornaya/tw.min.css` (НЕ ТРОГАТЬ) |

### 2.1 Tailwind policy — локальное исключение, не курс всего проекта

- Tailwind **не является** основной styling-стратегией сайта. Базовый путь проекта: существующий handcrafted CSS (`site.css`, `home.css`, `mobile-hotfix.css` и т.д.) + Astro/build-time ownership layer.
- Допустимые контексты для Tailwind в будущем:
  1. уже существующие route-scoped legacy зоны вроде `nagornaya/tw.min.css`;
  2. изолированные subapps / iframe-apps / built artifacts, где UI живёт как отдельный мини-проект;
  3. новые большие self-contained interactive sections, если владелец явно согласует именно такой путь.
- Недопустимо без отдельного решения владельца:
  - тащить Tailwind в глобальный shell сайта;
  - переводить `/`, обычные article pages, shared Astro layouts или legacy-faithful wrappers на utility-first слой;
  - плодить новые глобальные compiled Tailwind CSS в `/css/`.
- Если Tailwind где-то допускается, он должен быть:
  - **route-scoped или app-scoped**, а не global;
  - собран в уже существующий допустимый asset-слой, не увеличивая core-count CSS-файлов в `/css/`;
  - подчинён visual-parity задаче: не делать «другой сайт» там, где owner хочет 1:1 continuity.
- Коротко: **Astro — да, Tailwind — только локально и по делу.** Главный курс миграции = сохранить visual language сайта, а не переписать его под новый utility stack.

### Запрещено создавать новые JS-файлы в `js/`

Все 11 файлов — фиксированный набор. Новая логика идёт **внутрь существующего** файла по теме (если ничего не подходит — в `enhancements.js`).

---

## 3. PROTECTED — не трогать без письменного разрешения

### 3.1 Атрибуция авторства (КРИТИЧНО)

Фёдор Милованов на сайте — **автор-редактор** оригинальных статей и **редактор** переводов. **НЕ «автор»** в традиционном смысле. Он задаёт направление, редактирует, исправляет неточности и собирает материал при помощи ИИ.

#### Правило: нигде не писать «Автор: Фёдор Милованов».

| Тип контента | Byline в `<header>` | `.author-card-label` | Карточки в каталогах |
|---|---|---|---|
| Тип A — авторская статья | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Автор-редактор: Фёдор Милованов` |
| Тип B — авторская серия / разбор | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Автор-редактор: Фёдор Милованов` |
| Тип C — перевод зарубежной статьи | `Редактор: Фёдор Милованов` | `Редактор` | `Ред.: Фёдор Милованов` |

#### Meta-теги:

- **Тип A/B:** `<meta name="author" content="Фёдор Милованов">` + `<meta property="article:author" content="Фёдор Милованов">`.
- **Тип C:** `<meta name="author" content="Имя оригинального автора">` + `<meta name="translator" content="Фёдор Милованов">` + `<meta property="article:author" content="Имя оригинального автора">`.

#### feed.xml для всех типов:

```xml
<dc:creator>Фёдор Милованов</dc:creator>
```

### 3.2 JSON-LD структура

В каждой статье есть `<script type="application/ld+json">` с `Article` (или `ScholarlyArticle` для переводов) + `BreadcrumbList` + `Person` (автор оригинала или Фёдор как редактор). **Не упрощать, не «оптимизировать», не удалять.** Это критично для SEO.

Для переводов:
```json
"@type": "ScholarlyArticle",
"author": { "@type": "Person", "name": "Имя Автора Оригинала" },
"translator": { "@id": "https://gospod-bog.ru/about/#person" }
```

### 3.3 OpenGraph + Twitter Card теги

В каждой `index.html` статьи есть полный набор `<meta property="og:*">`. Не удалять, не сокращать «для чистоты». **Один `og:image` per page.** JPG-fallback можно ставить ТОЛЬКО если файл `images/<name>.jpg` реально существует.

### 3.4 Service Worker и cache-bust

Версии файлов в HTML:
```html
<link rel="stylesheet" href="css/site.css?v=2223865f">
<script src="js/site.js?v=54e3f377"></script>
```

Хеши — **CRC32 содержимого файлов**, генерируются `scripts/cache-bust.js`. **Не трогать руками.** После правки CSS/JS — обязательно `npm run cache-bust`.

`CACHE_NAME` в `sw.js` также пересчитывается автоматически.

### 3.5 Структура Нагорной проповеди

Серия = 5 частей + 3 вспомогательных страницы (`istochniki`, `nakhodki`, `seriya`). Внутри каждой части — `<aside class="article-toc">`. **Не упрощать TOC, не сжимать вёрстку, не удалять подключение `tw.min.css`** в Нагорной.

`tw.min.css` — минифицированный Tailwind, генерируется отдельно от основного проекта. Если нужен новый Tailwind-класс в `nagornaya/chast-*` — обратись к владельцу для регенерации.

### 3.6 Изображения

| Правило | Подробнее |
|---|---|
| **Формат** | `.webp` основной; `.png/.jpg` — backup, не для `<img>` напрямую |
| **Размеры** | Обязательно 3 ширины: `600w`, `900w`, `1200w` |
| **Именование** | `images/<name>.webp`, `images/<name>-600w.webp`, ... |
| **Качество WebP** | 82–85% |
| **OG** | один `og:image` per page; JPG-fallback только если файл реален |

### 3.7 Создание новой статьи — требования к качеству (ОБЯЗАТЕЛЬНО)

При создании новой статьи (или значительном обновлении существующей) **обязательно** соблюдать следующие правила качества:

#### 3.7.1 Тултипы и глоссарий
- **Все** исторические названия (города, территории, законы, институты, события) должны быть обёрнуты в `<span class="gterm" data-term="..." data-term-title="...">...</span>`.
- **Все** сложные богословские, герменевтические, раввинистические и апологетические термины должны иметь тултип.
- Пояснения должны быть **не поверхностными** — минимум 1–2 предложения, понятных рядовому читателю, без упрощения до примитива.
- Примеры исторических терминов, требующих тултипа: Кеттеринг, Хорслидаун, Саутварк, Акт о корпорациях, Gin Craze, Банхилл-Филдс, Приорат Сиона, Никейский собор, гностики и т.д.

#### 3.7.2 Квизы
- Каждый квиз должен содержать **минимум 1–2 вопроса по терминологии и понятиям** (не только по фактам и сюжету).
- Все вопросы обязаны иметь `explanation.short` + `explanation.full`.
- `explanation.full` должен давать **глубокое богословское/историческое/методологическое объяснение**, а не просто «верно/неверно».
- Вопросы должны быть **адаптированы под тематику статьи**:
  - Биографии → акцент на личность, решения, контекст.
  - Экзегетика/герменевтика → акцент на метод, термины, аргументацию.
  - Апологетика → акцент на факты, критерий затруднения, контраргументы.
  - Антропология/доктрина → акцент на понятия, различения, богословские нюансы.

#### 3.7.3 Общий принцип
- Статья должна быть **самодостаточной** для читателя без богословского образования.
- Если термин или историческая реалия встречается в статье — читатель должен иметь возможность понять его значение **не выходя из статьи** (через тултип).
| **figcaption** | НЕ вставлять `<span class="ai-note">` или «Изображение сгенерировано ИИ». Прозрачность — только на `/about/`. |

#### Шаблон `<picture>`:

```html
<figure class="article-img wide reveal">
  <picture>
    <source srcset="../../images/<name>-600w.webp 600w,
                    ../../images/<name>-900w.webp 900w,
                    ../../images/<name>-1200w.webp 1200w"
            sizes="(max-width: 640px) 92vw, 1200px" type="image/webp">
    <img src="../../images/<name>.webp" alt="…"
         width="1200" height="630" loading="lazy" decoding="async">
  </picture>
  <figcaption>Подпись без упоминания ИИ.</figcaption>
</figure>
```

---

## 4. CSS-правила

### 4.1 Каскад

Порядок подключения CSS в `<head>` (не менять):

1. `fonts/fonts.css` (preload + stylesheet)
2. `css/site.css`
3. `css/home.css` (на главной и каталогах)
4. `css/command-palette.css`
5. На Нагорной — **сначала** `nagornaya/tw.min.css`, **потом** `site.css` (Tailwind обязан грузиться раньше — site.css перебивает его по каскаду).

### 4.2 `!important` — обязательный чеклист перед добавлением

**Текущее состояние (2026-06-04, после PLAN-04):**

| Файл | `!important` | Назначение |
|---|---:|---|
| `site.css` | **202** ⚠️ | цель ≤200; потолок `IMPORTANT_CEIL` в audit-pro (только вниз) |
| `home.css` | 20 | OK |
| `command-palette.css` | 7 | OK |
| `mobile-hotfix.css` | 74 | touch / pointer:coarse overrides — легитимно |
| `nagornaya-mobile-toc.css` | 122 | Tailwind override на nagornaya-page — легитимно |

**Корректный подсчёт:** `grep -o '!important' file | wc -l` (НЕ `grep -c` — он считает строки).

#### 5-шаговый чеклист перед добавлением нового `!important`:

1. **Найди конкурента.** `grep -nE 'твой-селектор' css/*.css`.
2. **Рассчитай specificity** обоих правил (id=100, class=10, element=1).
3. **Если твоё выше** → `!important` не нужен; используй каскад.
4. **Если ниже** → увеличь специфичность через дополнительный класс/id/атрибут (например, `body.your-page .selector` или `.parent .selector`).
5. **`!important` оправдан ТОЛЬКО для:**
   - `@media print`
   - `@media (prefers-reduced-motion: reduce)`
   - `@media (forced-colors: active)`
   - `@media (scripting: none)` — no-JS fallback
   - Tailwind override на nagornaya (если selectivity не помогает)
   - Defensive disable (`display: none !important`) для скрытия legacy/повреждённого элемента
   - Внутри `@layer components/utilities` — для перебивания правил вне layer (правила вне `@layer` имеют выше priority по spec)

**Если уже есть `!important` на том же селекторе/свойстве — исправь существующий, не добавляй второй.**

### 4.3 Тёмная тема

Используется класс `html.dark` на `<html>` (переключается JS в `site.js`).

| Правило | Пример |
|---|---|
| ✅ Используй переменные | `color: var(--color-text)`, `background: var(--color-bg)` |
| ❌ Не хардкодить `#fff`, `#000` | искл.: фолбэки в `color-mix(in srgb, ... var(--color-x, #fff))` |
| ✅ `html.dark` всегда | НЕ просто `.dark` — JS выставляет именно `html.dark` |
| ✅ `color-mix()` fallback | Сначала простое значение, потом `color-mix` ниже — каскад перебивает |

### 4.4 CSS Integrity Rules — анти-регрессия

Эти правила введены после серии регрессий май-июнь 2026 (см. AUDIT_HISTORY).

1. **`html.dark` — всегда, никогда просто `.dark`.** Класс `.dark` на body не используется.

2. **Дублирование top-level селекторов запрещено.** Перед добавлением правила для `.foo` — `grep ".foo"` по файлу. Найдено → расширяй существующее, не добавляй новый блок. PLAN-04 P1+P1b слили 9 настоящих дублей.

3. **Пустые правила `{}` — мусор, удалять.** Допустимо только намеренное `:empty` с пояснительным комментарием.

4. **Двойное свойство в одном блоке — первое мёртво.** Два `box-shadow`, два `color` в одном `{}` — первый всегда перебивается. Удаляй его. **Исключение:** color-mix fallback pattern (`color: #fff; color: color-mix(...);`) — это намеренно.

5. **`:hover` с важным эффектом — только внутри `@media (hover: hover) and (pointer: fine)`.** Без guard — срабатывает на тапе (iOS/Android). Исключение: декоративные opacity/color, не меняющие layout.

6. **Переключатель темы — singleton.** Три канонических места:
   - `.theme-toggle` (absolute, в статьях рядом с breadcrumbs)
   - `.gb-fc-theme` (FAB через `gbFloatingControls` site.js модуль 29)
   - `.bar-icon-btn[data-action=theme]` (bottom-bar, mobile)

   ❌ Не создавать четвёртую: `.theme-float-btn`, `#themeFloat`, `.nag-theme-btn` — всё удалено в PLAN-04 P5.

7. **Tooltip — три канонических вида, один контроллер.**
   - `.gterm > .gtip` (глоссарий)
   - `.fn-marker > .tooltip` (академические сноски)
   - `.bref > .btip` (Библейские ссылки)

   Контроллер: `SiteUtils.makeTooltipController()` (единственная реализация).
   ❌ Не добавлять четвёртый тип tooltip с другими классами/позиционированием.

   **Модификатор `.fn-marker--dove`** — это НЕ четвёртый тип, а вариант `fn-marker`
   (та же `.tooltip`, тот же контроллер), у которого числовой маркер заменён на иконку
   голубя. Глиф рисует JS: функция `e()` в `js/site.js` инжектит inline-SVG
   `<svg class="fn-dove-icon">` (тело `.fn-dove-body` + отдельное крыло `.fn-dove-wing`).
   `::before` в CSS — это no-JS фолбэк (статический голубь), он скрывается, когда JS
   проставил `data-gb-dove-ready`. Крыло машет на hover (`@keyframes fn-dove-flap`,
   только `@media (hover:hover) and (pointer:fine)`, отключается при `prefers-reduced-motion`).
   ❌ Не возвращать инлайновый `<svg class="fn-dove-icon">` в HTML статей — JS инжектит его сам
   (audit-pro это проверяет и упадёт).
   ⚠️ **Все inline-маркеры закрывай явно** (`<span ...></span>`). `.fn-marker--dove` —
   `display:inline-flex`; незакрытый `<span>` «проглатывает» следующие `<p>/<h4>`, делая их
   flex-детьми → горизонтальный overflow. То же с «eyebrow»-лейблами `<span style="display:inline-flex">`.
   После правок контента/CSS прогоняй **visual-audit** (Playwright) — он ловит overflow и контраст:
   `python3 -m http.server 8080 --bind 127.0.0.1 -d dist & ; npx playwright install-deps chromium ; AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit` → сервер обязателен; отсутствие сервера и любые unsuppressed HIGH/CRITICAL теперь дают exit 1. Массовые low/medium false positives могут быть suppressed, но crash не suppress-ится.

8. **CSS-переменные — не объявлять «про запас».** Объявленная в `:root` переменная без `var(--...)` нигде = мёртвый код, удалить.

9. **Мёртвый компонент = удалить.** Если класс нигде в HTML/JS не используется (включая динамическую конкатенацию в JS `'class--' + variant`) — удалить CSS-правила. PLAN-04 P5-P7 удалил `.theme-float-btn`, `.ai-disclosure`, `.fx-lift`, `.epilogue-*`, `.float-fallback`, `.sd-url-strip/divider/copy/label-default`, `.article-img--portrait-wide`, `.card.fx-lift` и др.

10. **`!important` лимит для `site.css` — цель ≤ 200, жёсткий потолок задан в `audit-pro.js`.**
    Теперь это **автоматическая проверка** (`IMPORTANT_CEIL` / `IMPORTANT_GOAL` в `scripts/audit-pro.js`):
    - выше `IMPORTANT_CEIL` → **ERROR** (audit падает, push блокируется);
    - выше `IMPORTANT_GOAL` (200) но в пределах потолка → **WARNING** (продолжай гасить долг).
    Потолок — храповик: **только вниз**. Снизил `!important` — снизь и `IMPORTANT_CEIL`.
    Ручная проверка: `grep -o '!important' css/site.css | wc -l`.
    История: PLAN-04 342 → 199; затем dove/tooltip-серия дала регрессию 194 → 295,
    после чистки (унификация tooltip-компонентов) → 202.

    **ПРИЧИНА большого числа `!important`** (важно понимать): `css/site.css` исторически
    собран из НЕзакрытых `@media`/`@supports`/`@layer` блоков — на 2026-06-08 в файле был
    дисбаланс **+151** открывающей скобки (браузер закрывал их на EOF). Из-за этого многие
    правила оказывались «погребены» на глубине вложенности ~151 и применялись только при
    накопленных media-условиях — поэтому их и заставляли работать через `!important`.
    Блок `fn-marker--dove` был восстановлен **плоским, на глубине 0, в конце файла** (после
    явного закрытия всех скобок) — и там `!important` ему уже НЕ нужен (un-layered правило
    бьёт любой `@layer`). Дальнейшее снижение к 200 — тем же приёмом: чинить вложенность,
    а не добавлять `!important`. **Проверяй баланс скобок:**
    `python3 -c "s=open('css/site.css').read();print(s.count('{')-s.count('}'))"` → должно быть 0.
    **`!important` сам по себе не «зло», но >50 в одном файле — запах: каскадные слои
    (`@layer reset,base,components,utilities`) решают специфичность без него.**

---

## 5. JS-правила

### 5.1 Архитектура

Каждый JS-файл — самодостаточный, под одну тему. **НЕ создавать общий `utils.js`** — это сломает текущую модульность (`site-utils.js` существует, но имеет узкую роль). Подробная карта 27 модулей внутри `site.js` — в `README.md`.

### 5.2 Запреты

- ❌ `eval()`, `Function()`, `innerHTML = userInput`
- ❌ `addEventListener` без `removeEventListener` (память)
- ❌ CDN-зависимости (jQuery, Lodash) — проект bessebt (vanilla)
- ❌ ES2024+ фичи без проверки на Safari 15+
- ❌ Переход на TypeScript / Vite / любой bundler — архитектурный выбор vanilla

### 5.3 Обязательные проверки перед коммитом

```bash
# Синтаксис JS — все 11 файлов + sw.js + scripts
node --check js/*.js
node --check scripts/*.js
node --check sw.js

# Хеши cache-bust свежие
npm run cache-bust

# Полная валидация (HTML, JSON, manifest, SEO)
npm run validate:all

# Дизайн-токены
npm run tokens:check

# Главный аудит (38 проверок)
node scripts/audit-pro.js
# Должно: ✅ PASSED, errors = 0
```

Если хоть одна — FAIL, **не коммитить**.

#### Visual audit (Playwright, опционально но рекомендовано перед крупными CSS-правками)

```bash
# 1. Локальный HTTP-сервер (отдельная вкладка)
python3 -m http.server 8080 --bind 127.0.0.1

# 2. Playwright + chromium (один раз)
npm install --no-save playwright
npx playwright install chromium

# 3. Аудит (52 контекста / 156 скринов в shots/)
AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit
```

Должно: `0 console errors, 0 network errors` и `0` unsuppressed HIGH/CRITICAL bugs. Скрипт fail-fast падает без HTTP-сервера; `crash` не suppress-ится.

---

## 6. Статьи — как добавлять

### 6.1 Структура

```
articles/<slug>/
└── index.html
```

slug — строчные латинские буквы и дефисы, без слэша в начале.

### 6.2 Обязательные блоки в `<head>`

См. [`README.md` § «Добавление новой статьи»](README.md) — полный шаблон с meta-тегами, JSON-LD, OG/Twitter, SITE_CONFIG, breadcrumb JSON-LD.

### 6.3 Runtime-компоненты

| Компонент | Поведение |
|---|---|
| `<header class="article-header">` | h1, byline (см. §3.1), метаданные (дата, ≈мин чтения) |
| `<aside class="author-card">` | Перед `.sources-block` / `.reading-list` |
| `<aside class="article-toc">` | Для длинных статей (>20мин) |
| Глоссарий `<span class="gterm">термин<span class="gtip">…</span></span>` | luxury tooltip, mobile bottom-sheet |
| Академические сноски `<span class="fn-marker">N<span class="tooltip">…</span></span>` | mobile bottom-sheet |
| Библейские ссылки `<button class="bref" data-ref="Иер 17:9">` | tooltip с переводами |
| `.gb-accuracy-btn--email` | mailto: только `viktorcoy2012@gmail.com`, subject/body формируются JS из h1 + URL |

### 6.4 SITE_CONFIG — обязательная часть HTML

См. README.md § «Контракт `window.SITE_CONFIG`».

### 6.5 Quiz Engine v3+

Если `features.quiz.enabled === true` и в `window.SITE_CONFIG.quiz.questions` есть вопросы, HTML обязан содержать канонический mount `<div id="quizPlaceholder"></div>`. **Не вставлять вручную legacy `#quizWrapper`**: runtime сам генерирует `#quizWrapper`, `#quizLaunch`, `#quizQuestion`, `.quiz-option` и bonus-блоки. Ручной wrapper уже ломал Da Vinci / Krajne: overlay открывался, но вопрос и варианты не рендерились.

Вопросы могут содержать `sourceRef` для академического feedback:

```js
{
  id: 'q1',
  type: 'single',
  category: 'theology',
  difficulty: 'medium',
  question: 'Вопрос...',
  options: ['...', '...', '...'],
  correct: 1,
  explanation: {
    short: 'Короткий вывод.',
    full: 'Развёрнутое объяснение ответа.',
    anchor: 'sec-intro'
  },
  sourceRef: { label: 'Иер. 17:9', href: '#sec-intro' }
}
```

`sourceRef` — строка, объект `{ label, href }` или массив. Результаты квиза сохраняются в `localStorage` как `quiz-result-v2:{page.id}`. Legacy-формат `q / answer / ok / err / focus` поддерживается только для старых страниц; новые вопросы писать в новом формате.

### 6.6 Share API (для цитат, результатов квизов)

```js
window.SiteShare.open(button, {
  dialogTitle: 'Поделиться цитатой',
  title: document.title,
  text: '«цитата» — Название статьи',
  url: 'https://gospod-bog.ru/article/#:~:text=...'
});
```

НЕ подменять заголовок диалога через DOM. Все платформы (TG/WA/VK/MAX/OK/Copy) используют `activeShareUrl/Title/Text` из payload.

### 6.7 Язык статей и цитат

Русскоязычная статья должна читаться как цельный русский текст. Это правило закреплено не только документально, но и технически: `scripts/validate.js` и `scripts/audit-pro.js` блокируют английские прямые цитаты в читательском русском тексте и quiz-строках. Полная редакционно-источниковая политика — `docs/EDITORIAL-SOURCE-POLICY.md`.

- ✅ Основной текст, прямые речи, сильные цитаты, цитаты в quiz/explanation, подписи к иллюстрациям и callout-блоки — **на русском**.
- ✅ Английские названия книг, статей, журналов, издательств, URL, DOI, `href`, библиографические записи и технические термины в скобках допустимы, если они нужны для идентификации источника.
- ❌ Не вставлять в тело русской статьи английскую прямую цитату ради «солидности».
- ✅ Если важно показать, что формулировка верифицирована, дать русский перевод и рядом ссылку на оригинал: `МакАртур формулирует: «…» <a href="...">GTY transcript</a>`.
- ✅ Если перевод спорный или авторский, можно добавить: «перевод наш» / «смысловой перевод», но сам цитируемый текст остаётся русским.
- ❌ Не заменять русскую цитату машинным калькированным английским термином. Сначала русский эквивалент, затем при необходимости оригинальный термин в скобках: «различный отбор материала (variant selections)» — допустимо как термин; «variant selections» как самостоятельная цитата — нет.

### 6.8 После добавления статьи

1. Обновить `sitemap.xml` (ISO8601 lastmod с +03:00)
2. Обновить `feed.xml` (`<item>` в начало `<channel>` + `<lastBuildDate>`)
3. Обновить `data/series.json` (если статья входит в серию)
4. Обновить `data/search-manifest.json` (для Ctrl+K)
5. Добавить карточку на `/articles/index.html` и (если уместно) на `/index.html`
6. Подготовить OG-картинку (1200×630, `.webp` или `.jpg`)
7. `npm run cache-bust`
8. `npm run validate:all` + `node scripts/audit-pro.js`

IndexNow при `git push main` сам уведомит Яндекс/Bing.

---

## 7. Красные флаги

| Если ты собираешься… | …почему НЕТ |
|---|---|
| «Создать новый CSS для article-share-buttons.css» | См. §2. Используй `site.css`. |
| «Создать `utils.js` для общих функций» | См. §5.1. У каждого JS своя тема. |
| «Заменить "Редактор" на "Автор" — короче» | См. §3.1. Это намеренно. |
| «Упростить JSON-LD — слишком много свойств» | См. §3.2. Это для SEO. |
| «Удалить старые AUDIT_*.md — лишний мусор» | Оставлять `AUDIT_HISTORY.md`. `audit/AUDIT_CLEANUP_PLAN_*.md` оставлять до завершения плана. |
| «Обновлю pretty каждый файл — для красоты» | НЕТ. Diff нечитаем. |
| «Прогоню `eslint --fix` — улучшит код» | НЕТ. Только точечно. |
| «Поправил CSS — забыл `cache-bust`» | Запусти. SW не подхватит правки. |
| «Перепишу legacy runtime на TypeScript/React для надёжности» | НЕТ. Astro/TS допустимы в `src/**` build layer; публичный runtime остаётся static HTML + handcrafted CSS + vanilla JS. |
| «Верну AI-disclosure для прозрачности» | См. §0 п.3. Об ИИ — только на `/about/`. |
| «Добавлю `!important` на всякий случай» | См. §4.2 чеклист. |
| «Перепишу `summary-card` с `!important` для надёжности» | НЕТ. PLAN-04 P8-P10 сняли 39 ненужных. Конкурентов в каскаде нет (компонент только на 2 не-nagornaya страницах). |

---

## 8. Service Worker — что важно

`sw.js` — версионируется автоматически (`scripts/cache-bust.js` обновляет `CACHE_VERSION`). При правке `sw.js` руками — **не править version-строку**, скрипт это сделает.

Precache список — в самом `sw.js`. При добавлении нового шрифта/JS-файла — добавь в precache.

---

## 9. Безопасность / гигиена

- ❌ Не добавлять `http://` ссылки в контент — `audit-pro` ругается на mixed-content. Используй `https://` или (для умерших источников) `https://web.archive.org/web/2025/http://...`.
- ❌ Не хранить ключи / токены в репозитории. `INDEXNOW_KEY` — только в GitHub Secrets.
- ❌ Не использовать `eval` / `Function` / `innerHTML = userInput`.

---

## 10. Что из корня репо никогда не коммитить

| Файл / маска | Почему нельзя |
|---|---|
| `*.patch` | git-артефакты, не контент |
| `*.py` в корне | Статический сайт. Python — только в `scripts/` (build-tools) |
| `*.tsx`, `*.ts` в корне | Root-мусор/одноразовые компоненты; TypeScript живёт только в `src/**` или `scripts/` по архитектуре |
| случайные `src/components/*` без использования | `src/**` — production Astro layer; компонент должен быть подключён, задокументирован и не нарушать ownership/gates |
| `README-<что-то>.txt`, `README.txt` | Дубли `README.md` |
| `PATCH-V*-SUMMARY.md`, `AUDIT_REPORT_*.md`, `*_PLAN_*.md` (в корне) | Истёкшие планы; история — в git log и `AUDIT_HISTORY.md`. План в `audit/` — оставлять до завершения. |
| `apply_*.py`, `fix_*.py`, `final_*.py`, `split_*.py` | Одноразовые костыли. Нужен скрипт — в `scripts/` + `package.json` |
| `shots/`, `visual-audit-report.json`, `deep-check.json`, `node_modules/`, `.playwright-browsers/` | Уже в `.gitignore` |
| `<INDEXNOW_KEY>.txt` | Генерируется `deploy.yml` только в Pages-артефакте |

Если AI-агент создал такой файл во время работы — обязан удалить перед коммитом.

---

## 11. История документа (свёрнуто)

Полная история r1..r110 — в `git log` (`git log --oneline --grep="AGENTS-r"`).
Детальные changelog'и r68–r110 свёрнуты при r115 (были занимали >400 строк).

Последние 5 значимых вех (полная таблица r111+ — выше):

Полная история r1..r62 — в `git log` (`git log --oneline --grep="AGENTS-r"`).

Сохранены здесь только последние 5 значимых вех:

| Версия | Дата | Главное |
|---|---|---|

---

## 12. Раздел «Карты» (/karty/) — архитектура и правила

Полная документация: **`docs/MAPS-ARCHITECTURE.md`**.

### 12.1 Ключевые принципы

1. **ОДНА базовая карта** — единая SVG-география Ближнего Востока (viewBox `0 0 1900 1430`). Маршруты = слои данных поверх неё.
2. **Вторая карта = триггер рефакторинга** — вынести base-geo, map-engine.js и route.json. НЕ выносить заранее.
3. **era-теги** — каждое место несёт `era:["bronze"]` (или `["iron"]`, `["roman"]`). При второй карте — фильтрация по эпохе.
4. **Standalone inline** — karty/avraam/ (129 KB, 852 LOC script) автономен от site.js. Лимит inline-JS: warning >500 LOC.

### 12.2 Текущее состояние карты Авраама

| Метрика | Значение |
|---|---|
| Места (PLACES) | 19 (с era-тегами) |
| Контекстные точки (CTX) | 7 (Вавилон, Мари, Эбла, Ниневия, Мегиддо, Пещера Лота, Хацор) |
| Этапы кинотура (STAGES) | 8 (с km дистанциями) |
| Слои (LAYERS) | 9 (abr, lot, war, cand, ctx, trades, waypoints, mounts, debate) |
| Торговые пути | Via Maris, Царская дорога, Дорога Сура (SVG + иврит) |
| Горы | Геризим (גְּרִזִּים), Гевал (עֵיבָל) |
| Археология | 13/19 мест верифицировано по академическим источникам |

### 12.3 URL — НЕ менять

| URL | Что | Почему |
|---|---|---|
| `/karty/` | Хаб библейских карт | Кириллица = SEO под русские запросы |
| `/karty/<slug>/` | Конкретная карта | Слаг = имя героя (avraam, ishod, pavel) |
| `/map/` | Карта связей статей | Служебная, другой тип, НЕ переименовывать |

### 12.4 Запрещено

- ❌ Копипастить avraam/ целиком для новой карты — вынос базы обязателен
- ❌ Растровые подложки / тайлы / спутник — только SVG-вектор
- ❌ Leaflet / MapLibre — оверкилл для стилизованной исторической карты
- ❌ Отдельный «поддомен» / SPA на карту — хаб /karty/ единый


---

> **Если правило кажется глупым — спроси, ПОЧЕМУ оно появилось.**
> Большинство «странных» правил появилось после реальных регрессий.
> Прежде чем менять контракт — открой `AUDIT_HISTORY.md`.


---

## 12.5. MapEngine — архитектура движка (КРИТИЧНО: читать перед любой правкой)

### 12.5.1 Структура файлов

```
karty/_engine/
├── map-engine.js          (~2590 строк) — ОСНОВНОЙ ФАЙЛ. Все карты грузят его.
│                            Самодостаточный: данные, рендеринг, CSS, события, таймлайн.
│                            НЕ импортирует модули.
├── modules/
│   └── timeline-integrated.js (67 строк) — интегрированный таймлайн (только pavel)
│                            ⚠️ выставляет container.style.position='relative' →
│                            контейнер карты обязан иметь explicit height (фикс 60c9bca6)
├── base-geo.svg           (38KB) — базовая география для всех карт
└── base-geo-premium.svg   (5KB) — расширенная версия
```

> Ранее в `modules/` лежали `map-data.js`, `map-render.js`, `timeline.js` (346 строк
> мёртвого кода от провального модульного рефакторинга). Удалены 2026-06-18.

### 12.5.2 ИСТОРИЯ РЕГРЕССИЙ (ЗАПРЕЩЕНО ПОВТОРЯТЬ)

**Критический инцидент (2026-06-16):**
При попытке «модульной» реорганизации движка (`9315a510`, `8f1e172c`) были
СЛОМАНЫ карты Авраама и Исхода:
- `route.json` данные были «выпотрошены» (gutted)
- Авраам перестал работать и был восстановлен как монолит (`2dfa1b3e`)
- Аудит Авраама сломался (`22abf658`, `72807e3d`)
- Модули `map-render.js`, `map-data.js` были созданы, но НЕ интегрированы
  в `map-engine.js` — они существуют мёртвым кодом

**УРОК:**
- ❌ НЕЛЬЗЯ рефакторить `map-engine.js` без предварительного полного понимания
  как он используется во ВСЕХ 10 картах
- ❌ НЕЛЬЗЯ удалять функции из `map-engine.js` — только добавлять новые
- ❌ НЕЛЬЗЯ трогать Авраама (`karty/avraam/index.html`, 4792 строк extracted (2385+2407)) — 
  это отдельное приложение, которое использует движок только для ДАННЫХ
- ✅ Перед ЛЮБОЙ правкой движка: запустить `npm run maps:validate` и 
  `npm run avraam:audit` (23/23 проверок)
- ✅ После правки: все 10 карт должны проходить maps:validate

### 12.5.3 Как работает движок СЕЙЧАС

**map-engine.js (~2590 строк) — самодостаточный:**
- Не импортирует модули (0 references to modules/)
- Содержит ВСЮ логику: данные, рендеринг, CSS, события
- `MapEngine.createMap(container, route, opts)` — главная точка входа
- 43 addEventListener (большинство через `_on()` с трекингом), `destroy()` вызывает `_cleanupAll()` для освобождения. Часть сырых addEventListener на element-scoped слушателях (маркеры) собирается GC вместе с элементом.
- Встроенный CSS (~103 строки) через `me-base-css` style element

**Какие карты как используют движок:**

| Карта | Способ | Примечание |
|---|---|---|
| avraam | `MapEngine.loadRoute()` + `MapEngine.validateRoute()` + `MapEngine.compareRouteData()` | Только DATA API. Весь рендеринг свой (68 функций). |
| ishod | `MapEngine.createMap()` | Полностью на движке |
| pavel | `MapEngine.createMap()` | Полностью на движке + timeline-integrated |
| shoftim...revelation | `MapEngine.createMap()` | Полностью на движке |

#### ⚠️ HAZARD: ДВОЙНОЙ ПУТЬ РЕНДЕРИНГА (читать перед любой правкой движка)

В проекте **ДВЕ независимые реализации** визуального слоя карт:

1. **MapEngine (`karty/_engine/map-engine.js`)** — рендерит 9 карт (ishod, pavel, shoftim,
   melachim, shvatim, yeshua, maccabim, early-church, revelation) через `createMap()`.
   Здесь живут `renderMarkers`, `renderPanel`, `open`, `setTab`, `flyTo`, `openPhoto`,
   `startTour`, `updateMinimap` и т.д.
2. **Авраам (`karty/avraam/avraam-app.js`, 2404 строки + index.html 2385 строк)** —
   флагман-карта со своим собственным рендерингом: `openPlace`, `setTab`, `renderPhotos`,
   `renderVariants`, `startTour`, `flyTo`, `updateMinimap`, ночные звёзды, караван, GSAP,
   ambient-аккорды. Использует MapEngine ТОЛЬКО для data-хелперов (`getPlaceVisual`,
   `getStoryState`, `getPanelModel`, `validateRoute`, `compareRouteData`).

**Это значит:**
- ❌ Правка `renderPanel`/`flyTo`/`open`/`setTab` в MapEngine **НЕ влияет на Авраам**.
  Авраам останется как был. И наоборот: правка `avraam-app.js` **НЕ влияет** на 9 других карт.
- ✅ Если нужно изменить визуал **везде** — править надо в ДВУХ местах (engine + avraam-app)
  и проверять оба: `npm run maps:validate` (10 карт) + `npm run avraam:audit` (23/23).
- ✅ Это намеренная архитектура (см. §12.5.6): Авраам = эталон, фичи ИЗВЛЕКАЮТСЯ из него
  в движок, а не наоборот. Портить Авраам ради «унификации» — повторение катастрофы
  `c94a3298`–`22abf658` (см. §12.5.2). Когда движок накопит ≥80% фич Авраама — можно
  портировать; до тех пор два пути сосуществуют.

**Перед правкой движка ВСЕГДА отвечай:** «Эта правка должна затронуть и Авраам?»
Если да — редактируй и `map-engine.js`, и `avraam-app.js`. Если правишь только движок —
проверь, что Авраам не сломался (`avraam:audit 23/23`), и задокументируй рассинхрон в
AGENTS changelog.

### 12.5.4 ПРАВИЛА создания новой карты

```bash
# 1. Создать route.json
# 2. Создать index.html (шаблон ниже)
# 3. Создать src/pages/karty/{slug}/index.astro
# 4. Обновить migration/page-ownership.json
# 5. Обновить data/public-content-baseline.json
# 6. Обновить karty/index.html (карточка в хабе)
# 7. npm run maps:validate
# 8. npm run contract:compare
```



### 12.5.7 Статус извлечения (2026-06-17)

**100% извлекаемых фич Авраама → движок.** 60/60 функций перенесено.

Авраам структурно очищен: JS вынесен в `karty/avraam/avraam-app.js` (2404 строки),
`index.html` сокращён с 4792 до 2385 строк (extracted). Движок остаётся чистым и универсальным.

Оставшиеся 12 визуально-декоративных фич (ночные звёзды, караван, GSAP, 
ambient-аккорды и др.) являются дизайн-специфичными и НЕ извлекаются.

**Структура карт после реструктуризации:**
```
karty/
├── _engine/map-engine.js     ← ДВИЖОК (~2590 строк)
├── _engine/base-geo.svg      ← общая география
├── _engine/modules/          ← МЁРТВЫЙ КОД (не использовать)
├── avraam/
│   ├── index.html            ← HTML+SVG+CSS (2385 строк)
│   └── avraam-app.js         ← JS приложения (2404 строки)
├── ishod/index.html          ← 50 строк (createMap)
├── pavel/index.html          ← 50 строк (createMap)
└── ...                       ← все на createMap()
```
### 12.5.6 Правило извлечения фич из Авраама в движок

**Авраам — эталонная карта. Движок — общий фундамент.**

1. **Авраам НЕ трогать.** Он защищён аудитом 23/23. Любое изменение визуала = регресс.
2. **Извлекать фичи ИЗ Авраама В движок.** Анализировать код Авраама, понять паттерн,
   реализовать в движке как универсальный API.
3. **Тестировать на ishod, потом pavel.** Эти карты простые и используют движок.
4. **avraam:audit должен оставаться 23/23.** Никаких изменений в Аврааме.
5. **Не копировать — переосмысливать.** Код Авраама написан под конкретный дизайн.
   В движке фича должна быть универсальной, с опциями.

**Извлечено (v0.8→v0.9):**
- v0.8: фото-модалка (openPhoto) + интро-экран (me-intro)
- v0.9: timeline (me-timeline) + layer toggles (me-layers)

**Очередь на извлечение:**
- v1.0: контекстные маркеры (CTX), поиск по контенту (bible/arch)
- v1.1: миникарта (minimap), караван-анимация (опционально)
- v1.2+: портировать Авраама на движок (когда ≥80% фич)

### 12.5.5 ПРАВИЛА правки движка

1. **Никогда не удалять функции из map-engine.js** — только добавлять
2. **Перед правкой:** `npm run maps:validate && npm run avraam:audit`
3. **После правки:** то же самое + `node --check karty/_engine/map-engine.js`
4. **Avraam НЕ трогать** — он использует движок только для validate/compare
5. **Новые фичи добавлять в конец файла** — не переставлять существующий код
6. **Модули в modules/ использовать ТОЛЬКО если они уже интегрированы в engine.js**
   (сейчас они НЕ интегрированы — не импортировать их)


### 12.5.7 Статус извлечения (2026-06-17)

**100% извлекаемых фич Авраама → движок.** 60/60 функций перенесено.

Авраам структурно очищен: JS вынесен в `karty/avraam/avraam-app.js` (2404 строки),
`index.html` сокращён с 4792 до 2385 строк (extracted). Движок остаётся чистым и универсальным.

Оставшиеся 12 визуально-декоративных фич (ночные звёзды, караван, GSAP, 
ambient-аккорды и др.) являются дизайн-специфичными и НЕ извлекаются.

**Структура карт после реструктуризации:**
```
karty/
├── _engine/map-engine.js     ← ДВИЖОК (~2590 строк)
├── _engine/base-geo.svg      ← общая география
├── _engine/modules/          ← МЁРТВЫЙ КОД (не использовать)
├── avraam/
│   ├── index.html            ← HTML+SVG+CSS (2385 строк)
│   └── avraam-app.js         ← JS приложения (2404 строки)
├── ishod/index.html          ← 50 строк (createMap)
├── pavel/index.html          ← 50 строк (createMap)
└── ...                       ← все на createMap()
```
### 12.5.6 Известные долги движка

Состояние на 2026-06-20 (РЕФАКТОРИНГ 5.0 closing hole #2):

| Долг | Приоритет | Статус |
|---|---|---|
| 19 event listeners без removeEventListener | HIGH | ✅ Исправлено — 25 listener calls routed через `_on()` helper, document-level listeners (panel resize) тоже tracked. Только element-scoped addEventListener остались raw (GC с элементами). |
| Нет destroy() метода | HIGH | ✅ Исправлено — `destroy()` существует с r157; `_cleanupAll()` удаляет listeners, timers, rafId, tourTimer, injected CSS, body.overflow. `avraam:audit` 28/28 проверяет все 4 lifecycle guards. |
| Модули не интегрированы | MEDIUM | Созданы но не подключены |
| Авраам не на движке (свой рендеринг) | LOW | Намеренно, не трогать |
| CSS встроен в JS | LOW | Работает, не ломать |


## 9. Железобетонные UI-правила (НИКОГДА не нарушать)

### 9.1 Имена Бога на главной странице
- `js/enhancements.js` содержит блок ambient-фраз (42 фразы: иврит/греческий/латинский (35 боковых + 7 центральных))
- **Страж запуска**: `if (!document.getElementById('hScriptureBg')) return;`  
- НЕ менять на проверку `.h-phrase--ambient` — элемента в статическом HTML нет
- При любых правках `js/enhancements.js` — проверить что `document.querySelectorAll('.h-phrase').length >= 35`

### 9.1b Home mobile dashboard — быстрый вход вместо «портянки»
- На главной странице должен существовать mobile-only first-screen блок `.h-mobile-hero-hub`: компактный «вход в библиотеку» ещё до длинных shelf-блоков.
- Если у пользователя есть сохранённый прогресс, resume-блок (`#resumeReadingBlock` / `#resumeListBlock`) должен оставаться выше dashboard, а не теряться после длинной ленты.
- На главной странице должен существовать mobile-only блок `.h-mobile-dashboard` с 4 quick-start карточками.
- Под ним должен существовать mobile-only быстрый rail `.h-mobile-rail` для быстрых переходов по главной и в ключевые разделы.
- Ниже должен существовать mobile-only блок `.h-mobile-paths` минимум с 3 guided-reading карточками: серия, каталог, 3D/визуальный вход.
- Внизу мобильной главной должен существовать fixed quick-actions dock `.h-mobile-dock` с быстрым доступом хотя бы к публикациям, 3D-карте и блоку «О проекте».
- Минимальный набор ссылок в quick-start:
  - `/articles/`
  - `/nagornaya/`
  - `/baptisty-rossii/`
  - `/konfessii/russkij-baptizm/`
- `#main-content` на `/` обязан оставаться `data-pagefind-body`, чтобы домашняя страница индексировалась поиском как точка входа, а не выпадала из discoverability.
- Если меняешь мобильную IA главной, цель — app-like библиотека и быстрый вход в большие разделы, а не длинная неструктурированная «портянка» карточек.

### 9.2 FC-controls (плавающие кнопки тема/поиск)
- Компактный пилл-контейнер с `backdrop-filter`, `border-radius:24px`, `padding:3px`
- Кнопки `36x36px`, NO `border-radius:50%`, NO `background-color` на hover
- Hover: ТОЛЬКО `transform:translateY(-2px)` — никаких кругов, никакого фона
- Высота контейнера ≤ 110px (две кнопки + padding)
- Класс `.gb-floating-controls` в `css/site.css`
- На mobile, если `features.themeToggle.enabled !== false`, должен быть видимый theme control: `.gb-fc-theme`, `#barThemeBtn`, `#themeToggle` или Нагорная sidebar/bottom-bar equivalent. Не скрывать `.gb-fc-theme` только потому, что есть bottom-bar: это уже приводило к отсутствию темы на статьях.

### 9.3 bio-cover в статьях о Гилле
- `articles/dzhon-gill-chast-1-chelovek/index.html` ДОЛЖЕН содержать `.bio-cover` с изображением `gill-authentic-study-cover`
- Это 16:9 кабинетный портрет Гилла в библиотеке — НЕ city-view, НЕ portrait 3:4, НЕ кафедра
- `aspect-ratio` в `.bio-cover` = `16/9` (не 21/9)

### 9.4 Карточки-thumbnails серии Гилла на главной
- Часть 1 (`dzhon-gill-chast-1`): thumbnail = `gill-authentic-study-cover` (широкоформатный кабинетный портрет)
- НЕ использовать `og-gill-authentic-study-cover` как thumbnail-картинку карточки: это social-share OG, а не компактный карточный ресурс

### 9.5 Запрет дублирования контента
- В `chast-1` — НЕ должно быть двух одинаковых портретов Гилла
- `biography-portrait` / малый 3:4 `dzhon-gill-portret` в шапке — НЕ возвращать
- На первом экране Части I должен остаться один главный образ: `.bio-cover` с `gill-authentic-study-cover`

### 9.6 Playwright-регрессионные проверки
`scripts/visual-audit.js` содержит автоматические проверки:
- `ambientPhrases === 0` на `/` → CRITICAL bug
- `fcControlsH > 110` → HIGH bug  
- отсутствует текущий Gill Part I cover marker (`.bio-cover` или GBS2 cover/header) → HIGH bug

Запуск перед каждым коммитом: `npm run validate:all && node scripts/audit-pro.js`

### 9.7 Theme-toggle / search-icon — ЧИСТЫЙ SVG БЕЗ РАМОК
**Никогда не добавлять** `background`, `border`, `border-radius`, `box-shadow`, `backdrop-filter` к иконкам переключения темы и поиска. Это:
- `.theme-toggle` (absolute, в статьях)
- `.gb-fc-theme`, `.gb-fc-search` (FAB, `js/site.js` модуль 29)
- `.h-cp-btn`, `.gb-nav-search-icon` (в шапке home)
- `.bar-icon-btn` (bottom-bar, mobile)

Должно быть: **только сам SVG** (stroke=currentColor), `background:transparent`, `border:none`, никаких pill/circle обводок. Hover-эффект только `transform:translateY(-2px) scale(1.08)` + изменение `color`, без opacity-флипа (иначе оба `.icon-sun` и `.icon-moon` могут показаться одновременно — баг от 2026-06-08).

**Исключение:** серия «Нагорная проповедь» (`body.nagornaya-page`) — там своя система с Tailwind-классами, не трогать.

**Search keyboard contract:** `Ctrl/⌘+F` — всегда нативный поиск браузера; сайт не должен делать `preventDefault()` и не должен открывать command palette. Command Palette открывается только `Ctrl/⌘+K` (case-insensitive: Chromium/Playwright может дать `key="K"`). `Escape` внутри palette должен закрывать palette, а не только чистить строку. Это защищено `audit-pro` G112 и `npm run interactive-audit`.

**Media/share runtime contract:** image viewer должен открываться по клику на article image, ставить scroll-lock (`html.style.overflow='hidden'`) и закрываться по Escape с восстановлением overflow. Share dialog должен открываться через `#articleEndShareBtn`, иметь `aria-hidden="false"`, закрываться по Escape и опираться на canonical URL, не на preview/local URL. Это проверяет `npm run interactive-audit`.


**Map publication status contract:** temporary map placeholders are allowed to be reachable, but never indexable/search-promoted. If `route.json` has `publication.status=temporary-placeholder`, the page must be `noindex, follow`, excluded from sitemap/llms/search-manifest/public baseline, and must not carry `data-pagefind-body`. This is guarded by `npm run maps:publication-status` and included in `npm run maps:validate`.

**Search fallback contract:** hardcoded command-palette fallback recommendations in `js/search.js` must match `data/search-manifest.json` read times. `npm run data:consistency` blocks drift.

**Readable/publication contract:** декоративные номера summary (`.summary-card__num`) не должны быть читательским текстом: span пустой, `aria-hidden="true"`, номер хранится в `data-num` и рисуется CSS `content:attr(data-num)`. Главный H1 на `/` в `innerText` обязан читаться как `Господь Бог — Сила Моя`. В публичном тексте не должно быть внутренних enum labels (`Book`, `Confession`, `ChicagoDoc`, `Warning`, `Father`, `Academic`) и overclaim-бейджа `Проверено историками`. Это защищает `npm run readable-audit`.

**Data/source contract:** после изменения карточек, серий или article meta запускать `npm run data:consistency` (readTime/title/search-manifest/series drift). Для внешних источников production-проверка — `npm run source:links:dist` (строит production-like `dist` и проверяет именно публикуемый artifact). Root-only `npm run source:links` остаётся быстрым source-layer audit. TLS/404/bad-host — ошибка; 403/429/timeout — предупреждение с ручной проверкой, потому академические сайты часто режут ботов.

**Workflow/CI contract:** `indexnow.yml` и `deploy.yml` обязаны запускать `npm run validate:static-publication`; `source-links.yml` и `interactive-audit.yml` должны быть manual+scheduled; `notify-on-failure.yml` должен слушать оба этих workflow. Это защищено `npm run workflows:check`. Локальный `npm run ci:check` теперь = cache-bust + static publication gates + workflow policy.

### 9.8 article-topnav — УДАЛЁН
Sticky шапка `.article-topnav` (показывалась при скролле статьи с «← Господь Бог — Сила Моя | TITLE | поиск») **удалена из всех 8 статей** по запросу владельца 2026-06-08. **Не возвращать.** Хлебных крошек (`.breadcrumb`) достаточно для навигации.

CSS-правила `.article-topnav*` пока остаются в site.css как dead code (для возможного восстановления). При полной чистке можно удалить через PLAN; до этого не реанимировать в HTML.

### 9.9 Hover на ссылках-карточках в тёмной теме — НЕ розовый
`.h-article-card:hover .h-article-title` в светлой теме = `--h-accent` (#8b2626 темно-красный — ок). В **тёмной** теме `--h-accent` = #d97a6c — это **розово-красный**, плохо контрастирующий с золотисто-палевым телом. Поэтому в `html.dark` hover-цвет переопределён на **золотистый `#e8c97a`** (`css/home.css`). Не возвращать на `var(--h-accent)`.

### 9.10 FOUC шрифтов на главной
Кроме `Lora-cyrillic-400`, **обязательно preload** для:
- `Inter-cyrillic-600` (используется в `.h-sacred-ref` — «АВВАКУМ 3:19»)
- `PlayfairDisplay-cyrillic-700` (используется в `.h-section-title`, hero и др.)

Иначе виден FOUC: сначала рендерится fallback Times New Roman, потом подмена. Это видно на главной при перезагрузке.



### 9.13 Изображения владельца — НЕ ЗАМЕНЯТЬ генерациями

**НИКОГДА** не заменять изображения, которые загрузил владелец, на AI-генерации.
Если изображение визуально не устраивает — спроси владельца, а не генерируй замену.

Конкретно:
- `whitefield-preaching.*` — картинка Уайтфилда на Кеннингтон-Коммон. Загружена владельцем.
  Это ВТОРАЯ картинка Уайтфилда в gill-kontekst. НЕ удалять, НЕ заменять.
- `whitefield-field.*` — картинка Уайтфилда в поле. ПЕРВАЯ в gill-kontekst. НЕ удалять.
- Между двумя Уайтфилдами должен быть текст (не ставить подряд).

### 9.12 Голуби (fn-marker--dove) vs Цифры (fn-marker) — РАЗДЕЛЕНИЕ ТИПОВ СНОСОК

Два типа сносок — **железобетонное правило**, не смешивать:

| Тип | Класс | Иконка | Когда использовать |
|---|---|---|---|
| **Цифровая сноска** | `fn-marker` (без `--dove`) | Число (1, 2, 3…) | Ссылки на источники, библиографические сноски, переводческие ссылки на оригинал |
| **Голубь-сноска** | `fn-marker fn-marker--dove` | 🕊️ SVG-голубь | Пояснения редактора, справочная информация, терминологические справки, контекстные примечания |

**По статьям:**
- **Переводы** (герменевтика Чау и др.) → **ТОЛЬКО ЦИФРЫ**. В оригинале были цифровые сноски.
- **Авторские статьи** (20 антисоветов и др.) → **ГОЛУБИ** для авторских/редакторских комментариев.
- **Биографии Гилла** → цифры для ссылок на источники, голуби для пояснительных вставок (†, ‡ и т.д.).
- **Код да Винчи, Иеремия, Римлянам** → цифры (ссылки на источники).

**Запрещено:** ставить голубей на ВСЕ сноски подряд. Голубь — это визуальный маркер «здесь пояснение», а не «здесь источник».

CSS поддерживает оба типа:
- `.fn-marker` — цифра в суперскрипте, hover показывает tooltip
- `.fn-marker.fn-marker--dove` — SVG-голубь с машущим крылом, hover показывает tooltip

JS `site.js` функция `e()` инжектит SVG тело голубя только в `.fn-marker--dove`.

### 9.11 Series World (GBS) — единый канон для серий статей (с 2026-06-11, r96–r99)

Все многочастные серии статей используют **GBS** («мир серии»):
тёмный левый рельс (desktop) + sticky-шапка и нижняя капсула со шторкой (mobile),
weighted-прогресс серии по минутам, живой TOC, hero+kinetic, prev/next-карточки,
era-timeline. Живые эталоны: 5 страниц Гилла + 2 hard-texts.

- Стили: `css/site.css`, секция `body.gbs-world` / `gbs2-*` (минифицировано, ~строки 369–373).
- Поведение: `js/enhancements.js`, 3 IIFE «GBS reference pilot v2».
- Анатомия миграции страницы, плейсхолдеры и грабли: **`docs/GBS-PATTERN.md`**.
- `data/series.json` остаётся источником данных серий (тайтлы/slug'и/минуты/status); формат прежний:
```json
{
  "<series-key>": {
    "title": "Название серии",
    "baseUrl": "/articles/",
    "parts": [
      {"n": 1, "slug": "url-slug-of-part", "title": "Часть I. Заголовок", "status": "published", "readingTime": 25}
    ]
  }
}
```
- Прогресс серии в рельсе — data-атрибуты на body: `data-gbs2-done-min` (сумма минут предыдущих частей), `data-gbs2-part-min`, `data-gbs2-total-min`. При добавлении части — пересчитать на ВСЕХ страницах серии + series.json.
- Для встраивания gbs2-компонентов (timeline, next-card) на страницы БЕЗ `body.gbs-world` (лендинги серий, каталоги) — класс **`.gbs2-scope`** на секции-контейнере (даёт переменные light+dark). Пример: `/hard-texts/`.
- `status: "planned"` части показываются приглушёнными (`opacity:.55`, без href) в рельсе/шторке/next-картах.

**Запрещено:**
- Возвращать legacy series-UI: `data-series-strip` / `data-series-nav` / `.gb-strip` / `.gb-snav` / `.series-next-cta` — удалены со всех страниц в r96–r97; рендереры strip/nav и CSS `.gb-snav` ВЫЧИЩЕНЫ из кода в r107 (по «да» владельца на тотальную чистку). В `js/series-cards.js` остался только режим `data-series-cards` (каталоги); к article-страницам файл не подключается (r99).
- Дублировать inline-карточки «Часть I / II / III» вручную в HTML.
- Создавать новые CSS/JS-файлы под серию — GBS живёт в существующих файлах.
- Оставлять при миграции legacy-блоки `#reading-progress`, `#section-label`, старый `#themeToggle`, `#tocSidebar`, `#bottomBar`, `#btocOverlay` — именно так упал агент до r96 (двойная полоса прогресса).

**Нагорная проповедь** — историческое исключение (свой Tailwind-sidebar + nagornaya-mobile-toc.js). Не трогать; новые серии делать на GBS.

Перед изменением GBS-кода обязательно прогнать `npm run interactive-audit`: он проверяет на всех 7 series-страницах рельс/aria-current/toc/ring, отсутствие legacy-UI, клик по TOC (скролл, не навигация), а на мобиле — открытие шторки, переключение вкладок и закрытие.

**Инварианты дизайна GBS (решения владельца, фаза 2; нарушение = регресс):**
- Все направляющие линии — от реальных центров элементов (getBoundingClientRect), без магических отступов.
- Scroll-spy: кэш позиций + инвалидация на resize/шрифты; низ страницы → последняя секция; гистерезис ~12px.
- Автоподскролл активного пункта TOC — только scrollTop контейнера, НИКОГДА scrollIntoView.
- Один rAF-тик на скролл; классы перекрашиваются только при смене секции.
- view-transition-name не в статическом CSS — только на время перехода (JS вешает/снимает).
- Resume-позиция пишется только после реального скролла пользователя (wheel/touch/клавиши) и y>120.
- prefers-reduced-motion отключает параллакс/кинетику/зерно/отсчёты/VT — функциональность остаётся.
- У каждой картинки интерфейса — дизайн-фолбэк (onerror → градиент + номер части).

**Анти-фичи — владелец ЯВНО отклонил, не возвращать:**
- ❌ чекбокс «Отметить прочитанным» (прогресс только автоматический);
- ❌ «Дочитаете к ЧЧ:ММ» (допустим только тихий «осталось ~N мин»);
- ❌ минуты у пунктов оглавления ЧАСТИ (в списках частей — можно);
- ❌ кикер «СЕРИЯ … — N ИЗ M» над H1 (дублирует hero-подпись);
- ❌ автопереход на следующую часть по таймеру (только подсветка + клик);
- ❌ геймификация с бейджами.

**Ожидает решения владельца (без «да» не делать):** Popover API для тултипов; 3D-карта связей (three.js, этап «в» §2.4); hover-карточки внутренних ссылок / Tufte-сноски / режим фокуса; GBS для pastor-series (осмыслен при ≥2 частях); миграция «Римлянам 8» по docs/GBS-PATTERN.md когда статья будет написана (total пересчитать, обновить series.json + сестринские страницы).


### 9.17 John Gill image system — final editorial lock

  * Часть 1 bio-cover и thumbnail = `gill-authentic-study-cover`: монументальный кабинетный портрет Джона Гилла в библиотеке, 16:9.
  * Малый 3:4 портрет `dzhon-gill-portret` в верхней карточке Части I не использовать: он создаёт дублирование и непремиальную белую рамку.
  * На первом экране Части I должен быть один главный визуальный образ, а не два портрета подряд.
  * В Части I после рассказа о крещении и гимна должна быть иллюстрация `gill-baptism-scene`; не ставить её перед обращением на Быт. 3:9.
  * В Части II в блоке о раввинистике/Талмуде использовать только `gill-talmud-study-authentic`; старую `gill-engraving-talmud-study` не возвращать.
  * Книжная лавка Кеттеринга в историческом контексте = `gill-bookshop-strip` как узкая горизонтальная полоса. Не возвращать вертикальный `gill-context-scroll`.
  * Кафедра Гилла в тексте = `gill-pulpit-strip` как узкая горизонтальная полоса.
  * В Частях I–III не возвращать interstitial-блок `context-bridge` с текстом «Исторический фон серии…». После owner-review 2026-06-10 он признан лишним дублем навигации.
  * Слот скорби/пастырского утешения в Части I = `gill-funeral-sermon`: погребальная проповедь Гилла в капелле XVIII века, а не сцена с одной женщиной и не типография.
  * `gill-pastoral-succession` не трогать: владелец отдельно попросил оставить эту схему как есть. Если файл временно не используется в HTML, не удалять его без отдельного подтверждения.
  * Защищённые исходники схемы преемственности: `images/gill-pastoral-succession.webp`, `images/gill-pastoral-succession.jpg`, `images/gill-pastoral-succession-600w.webp`, `images/gill-pastoral-succession-900w.webp`, `images/gill-pastoral-succession-1200w.webp`.

### 9.18 John Gill grief/consolation slot

  * В Части I слот скорби/пастырского утешения должен использовать `gill-funeral-sermon`.
  * Сцена должна показывать исторически правдоподобную погребальную проповедь: кафедра, открытая Библия, траурное собрание, скорбящая община, а не частную сцену утешения одной девушки.
  * Старую семью `gill-pastoral-consolation` после замены не возвращать.

### 9.19 John Gill image truth-lock — описывать реальное изображение, а не только filename

  * После self-audit 2026-06-10 зафиксировано: у части Gill-asset families filename исторически неточен. **Нельзя слепо писать alt/figcaption по имени файла. Сначала открыть картинку и описать то, что реально видно.**
  * `gill-kettering-1697` = ранняя кеттерингская бытовая/ремесленная среда, дом и дорога под вечерним небом. Это **не** funeral scene и не обязательно «суконные мастерские крупным планом».
  * `gill-spurgeon-succession` = символическая сцена преемственности кафедры (кафедра, Библия, молитва), а **не** буквальный портрет/репортаж со Спердженом. Если используется, подпись должна быть о символе преемственности, не о «фото Сперджена».
  * `gill-bunhill-fields` = погребальная процессия / memorial engraving в Банхилл-Филдс, а не просто пустой вид кладбища. Подпись должна это отражать.
  * `gill-young-boy-shop` в текущей approved-family визуально является still-life с чернильницей и пером. Если используется — подпись о письме/чернилах/инструментах труда, а не о «мальчике в книжной лавке».
  * Если image family кажется семантически неидеальной, **не возвращать старые удалённые семьи автоматически**. Сначала проверь, можно ли честно переписать alt/figcaption под реальный approved image. Старое «restore ради совпадения filename→caption» запрещено без отдельного подтверждения владельца.

### 9.20 John Gill historical-restore lock

  * Если восстанавливаешь Gill-текст из старого git history, после вставки **обязательно** перепроверь `fn-marker` / `fn-marker--dove` вручную. Старые коммиты могли содержать формально «сбалансированные», но семантически сломанные span-обёртки, когда outer-marker проглатывает абзац.
  * После любого history-restore для Gill-страниц: (1) grep по `<figure class="article-img` + captions, (2) browser-check desktop+mobile, (3) verify no stale preload remains for removed/replaced image family.

### 9.21 Glossary/tooltips in summaries — HARD LOCK

  * `.summary-card` / блок «Коротко» — **только краткий plain-text summary**. Внутри summary-card запрещены `.gterm`, `.gtip`, всплывающие glossary-карточки, dotted underline и любые interactive tooltip terms. Термины и всплывающие пояснения допустимы в основном тексте статьи, но не в summary.
  * `js/glossary.js` обязан пропускать `.summary-card` и при авто-hydration текста, и при `hydrateGlossaryTerms()`. Не возвращать glossary auto-markup в summary ради “обогащения”: владелец явно попросил минималистичные summary без пунктирных терминов.
  * Glossary popup desktop-карточка должна быть цельной, без урезанного внутреннего layout: `.gtip-luxury` — block layout, header/title/body не должны вести себя как inline-flow, нормальные короткие определения не должны получать внутренний scrollbar. Mobile bottom-sheet может скроллиться только когда контент реально длинный.
  * Перед любыми правками tooltip/glossary: Playwright smoke на Gill context + Gill part + Krajne: hover/tap `.gterm`, проверить видимую карточку, непрозрачный фон, non-zero width/height, no clipping, no `.summary-card .gterm`.
  * Source-footnote tooltips must be flat DOM: запрещены `.tooltip .fn-marker`, `.tooltip .tooltip`, `.fn-marker .fn-marker`. Это уже ломало статью Chou/hermeneutics: основной текст был проглочен внутрь tooltip. После любых массовых правок сносок прогонять audit-pro G104 и browser hover на статье.
  * `audit-pro.js` guards G104/G106/G107 защищают эти правила. Если они падают — не обходить, а чинить tooltip/summary contract.

### 9.22 Регистр названий отделов/разделов — Title Case (с 2026-06-12)

  * **Названия ОТДЕЛОВ библиотеки** (бренд-лейблы разделов) пишутся в Title Case:
    значимые слова — с заглавной, служебные (предлоги/союзы/частицы) — строчными,
    кроме первого слова. Образец-эталон: **«Конфессии и Деноминации»**.
    Служебные строчными: *и, а, но, или, в, на, по, с, о, об, от, до, для, к, у,
    за, из, под, над, при, без, через*.
  * Это касается именно **имён разделов** (как они звучат в навигации, на карточке
    отдела на главной, в H1 хаба и хлебных крошках нового раздела). Новые отделы
    создавать сразу в этом регистре.
  * **НЕ распространять Title Case на:** заголовки статей, описательные заголовки
    секций, цитаты, имена собственные, ссылки на Писание, ambient-фразы. В русском
    это обычный регистр предложения (sentence case) — он остаётся как есть, иначе
    текст становится неидиоматичным. Слепая массовая «капитализация каждого слова»
    запрещена.
  * Легаси-идентификаторы, уже зашитые в structured data (`articleSection`,
    breadcrumb JSON-LD, `SITE_CONFIG.section`), менять только если меняется ВЕЗДЕ
    согласованно (видимый текст + JSON-LD + breadcrumbs + SITE_CONFIG на всех
    страницах раздела) — иначе не трогать ради косметики.

### 9.23 Отдел «Конфессии и Деноминации» — 3D-карта (iframe-приложение) и регресс-защита (с 2026-06-13)

### 9.24 OG image alignment — выделенные og:image НЕ обязаны совпадать с LCP (с 2026-06-15)

Аудит-про выдал INFO-level notice: 5 страниц имеют `og:image` ≠ LCP-priority изображению.
Это **намеренно** для страниц с выделенным social-share изображением (custom og:image с
кастомным `og:image:alt` для читаемого описания в соцсетях). Страницы: `/`, `/articles/20-antisovetov-pastoru/`, `/articles/kod-da-vinchi/`, `/articles/krajne-li-isporcheno-serdce/`, `/pastor-series/`. Правило: если у страницы есть dedicated og-изображение с кастомным alt — keep it, не выравнивать по LCP.

Документировать OG alignment decision в AGENTS.md §9.24 вместо изменения изображений.

  * `/konfessii/russkij-baptizm/` — **нативная обёртка сайта** (шапка/крошки,
    SEO/OG/JSON-LD/canonical, sr-only `<h1>`, CSP `frame-src 'self'`, Yandex, лоадер),
    внутри `<iframe src="./_app/index.html">`.
  * **Внутри iframe — ОРИГИНАЛЬНОЕ 3D-приложение** из LM Arena (перенос 1-в-1):
    React 19 + TypeScript + Vite + Tailwind 4 + **Three.js + react-force-graph-3d + d3-geo**.
    Настоящая 3D-сцена: сферы-узлы со свечением, торы-орбиты, тубы-связи, карта стран
    (d3-geo Mercator + world-atlas), режимы «граф/карта», маршруты, инспектор, лоадер,
    AI-ассистент (Gemini, без ключа graceful-null). Это собранный singlefile-бандл ~2.2 МБ.
    **Почему так:** ранний vanilla-порт (2D canvas) сильно упрощал оригинал — владелец
    потребовал точное 1-в-1; согласовано встроить оригинал как изолированный iframe-ассет.
  * **`_app/` — built-asset, исключён из статических валидаторов** (skipDirs/EXCLUDE_DIRS
    в validate.js, audit-pro.js, seo-audit.js, readable-audit.js, editorial-lint.js).
    НЕ редактировать бандл руками (кроме обязательных мета — см. README); пересобирать
    из исходников приложения.
  * **CSP бандла** (своя, в `_app/index.html`): Three.js требует `script-src 'unsafe-eval'
    blob:` и `worker-src blob:`; шрифты Inter/JetBrains — `style-src/font-src/connect-src`
    с `fonts.googleapis.com`/`fonts.gstatic.com`. Бандл несёт `robots=noindex` (индексируется
    только обёртка). Обёртка остаётся в строгой CSP сайта + `frame-src 'self'`.
  * **Регресс-защита:** `npm run konfessii:audit` (`scripts/konfessii-map-audit.js`,
    Playwright) — инварианты I1–I14 на desktop+mobile: обёртка (canonical/og/h1/JSON-LD/
    theme-color/CSP/iframe-src), бандл (singlefile/viewport/CSP/noindex/root), live
    (загрузка приложения в iframe, скрытие лоадера, **активация 3D WebGL-canvas**,
    0 pageerror, 0 overflow). I8–I13 защищают событийный data-driven Timeline,
    route-router, learning coach, article previews, BWA-статистику и кейсы гонений/самиздата;
    **I14** защищает smooth physics constants против возврата jitter/tension (`d3AlphaDecay .0165`,
    `d3VelocityDecay .24`, `warmupTicks 150`, `cooldownTicks 220`, `cooldownTime 7000`,
    anchor `*1.28`). Без браузера/WebGL — мягкий SKIP (exit 0). Прогонять после любой
    пересборки `_app`. Если падает — чинить страницу/пересобрать бандл, не упрощать тест.
  * **Сборка/пересборка:** инструкция в `_build-tools/konfessii-baptizm/README.md`
    (исходники приложения — отдельный Vite-проект у владельца; `base:'./'`,
    `vite-plugin-singlefile`, после сборки вернуть CSP/noindex/favicon в `<head>`).


### 9.25 Astro migration — premium visual parity only (2026-06-19)

Главная цель миграции: перейти на Astro **премиально, без заглушек и без потери визуала**. Подробный план: `docs/ASTRO-PREMIUM-MIGRATION-ROADMAP.md`.

Жёсткое правило владельца: H1/H2/SEO/word-count не считаются визуальным переносом. Если визуал сломан, страница получает 0% visual parity, даже если текст и мета совпали.

До production допускается только Astro-страница, которая прошла:

- desktop screenshot legacy vs Astro;
- mobile screenshot legacy vs Astro;
- route-specific DOM/CSS markers;
- отсутствие generic `astro-card`/`astro-page` вместо авторского layout;
- owner visual review первого экрана.

Нельзя повторять ошибку `shadow-pilot → production-dist` без визуального gate. Production остаётся legacy root, пока конкретный URL не доказал 95%+ визуального совпадения.

### 9.26 «Баптисты России» — long-term deepening pipeline (2026-06-19)

Серия будет постоянно пополняться research `.md`-файлами другими агентами. Нельзя относиться к текущим HTML как к финалу или закрывать задачу косметическими костылями.

Канонический roadmap:

- `data/baptisty-rossii-expansion-roadmap.json`
- `baptisty-rossii/research/31-editorial-expansion-roadmap-2026-06-19.md`
- `baptisty-rossii/research/media-ledger.md`

Guard:

- `npm run baptisty:roadmap:audit`

Правила:

- статьи серии должны углубляться по структуре, источникам, тексту, изображениям и связи с 3D-картой;
- реальные фото/портреты/факсимиле добавлять только после проверки прав;
- production не hotlink-ит чужие изображения;
- каждое изображение должно иметь запись в media ledger: source URL, лицензия, автор/архив, attribution, дата проверки;
- AI-картинку нельзя выдавать за историческое фото;
- visual polish серии не должен заменять работу по глубине текста.

### 9.27 «Баптисты России» — 2D SVG visual atlas (2026-06-19)

В серии могут появляться 2D SVG-схемы: маршруты, сети влияния, split-timeline, source-confidence matrix, publication-flow. Это не заменяет 3D-карту и не является декоративной заглушкой; это редакционный слой внутри статей.

Канонические файлы:

- `data/baptisty-rossii-visual-atlas.json`
- `baptisty-rossii/research/32-2d-svg-visual-atlas-plan-2026-06-19.md`

Guard:

- `npm run baptisty:visual-atlas:audit`

Правила:

- SVG локальный или inline; remote SVG/hotlink запрещён;
- внутри SVG не тянуть внешние raster images;
- обязательны title/desc или figure+figcaption;
- схема должна читаться на 375px;
- каждый узел связан с источником или source-confidence уровнем;
- если SVG повторяет узлы 3D-карты, обновлять mapSync;
- не рисовать псевдоточность для спорных данных.

### 9.28 `/about/` — first visual-first Astro migration route (2026-06-19)

`/about/` is the first route selected for near-100% visual parity migration. Current rule: Astro emits the legacy document directly from `about/index.html` (full-document shadow: legacy head + legacy body, no BaseLayout and no extra global Astro CSS) until a hand-built Astro version passes screenshot parity.

Guard:

- `npm run about:visual-parity:audit`
- `npm run astro:audit:about` (Node 22+ / CI)

Forbidden regressions for `/about/`:

- `class="astro-about"` generic article;
- `astro-contact-grid` generic contacts;
- `astro-accuracy-block` generic feedback card;
- adding BaseLayout generic header/footer around the legacy page;
- claiming visual parity from SEO/H1/H2 only.

Required legacy visual markers:

- `about-page`
- `about-contacts`
- `about-contact-card`
- `gb-accuracy-block`

### 9.29 Concurrent GitHub agents — sync protocol (2026-06-19)

Multiple agents may work on this repository at the same time. Before every edit/push:

1. `git fetch origin main` and `git pull --rebase origin main`.
2. If local mode-only changes appear after tooling (`100755 => 100644`), restore executable bits instead of committing chmod noise.
3. Never force-push to `main`.
4. Keep commits small and route-scoped.
5. Re-run route-specific guards for touched areas.
6. If another agent lands research files while you work, rebase and preserve their files; do not delete new research `.md`/raw-source files unless explicitly asked.
7. If a push is followed by an auto `update-meta/cache-bust [skip ci]` commit, pull again before the next change.

This matters especially for `/baptisty-rossii/research/**`, where other agents continuously add source dossiers.

### 9.30 `/articles/` — visual-first Astro migration route (2026-06-19)

`/articles/` must preserve the legacy premium catalog before any component refactor. The old generic Astro catalog (`astro-card`, `astro-card-grid`, manually recreated `const cards`) is forbidden because it produced a non-premium replacement instead of visual parity.

Guard:

- `npm run catalogs:visual-parity:audit`

Current rule: `src/pages/articles/index.astro` emits `articles/index.html` through `loadLegacyFullDocument('articles/index.html')` and keeps legacy markers:

- `articles-index-page`
- `home-v20`
- `h-hero-title`
- `h-article-card`

A hand-built Astro catalog is allowed only after desktop+mobile screenshot parity and owner approval.

### 9.31 `/biografii/` — visual-first Astro migration route (2026-06-19)

`/biografii/` follows the same practical rule as `/articles/`: protect the main legacy visual first, do not reintroduce generic `astro-card-grid` landings. Gill must remain visually strong as a series entry, not flattened into loose technical cards.

Guard:

- `npm run catalogs:visual-parity:audit`

Current rule: `src/pages/biografii/index.astro` emits `biografii/index.html` through `loadLegacyFullDocument('biografii/index.html')` and keeps legacy markers:

- `home-v20`
- `h-hero-title`
- `h-article-card`
- `Биографии служителей`
- `Джон Гилл`

A hand-built Astro biography catalog is allowed only after desktop+mobile screenshot parity and owner approval. Avoid accumulating throwaway generic code; once a shared visual migration guard covers a route, remove route-specific duplicate guards.
