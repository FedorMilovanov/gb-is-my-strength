# Один Reader Core, общие панели, разные стили — сверенный план внедрения

## Статус и новое уточнение владельца

**Исследование / предложение реализации, Product не изменён.** Проверен exact PR2352 HEAD `ce08ef67b975b2264ceda0e45e9cd2eae6bf9fec`, прочитаны свежие комментарии до308-го, включая W129/W132, W35–W37, SYS W89–W91 и W130. Текущий запрос владельца уточняет цель: **единый движок, общие TOC и левая/правая выдвижные панели, но оформление адаптируется к каждой подстранице**. Не одинаковая панель, скопированная во все разделы, и не отдельный движок для каждого дизайна.

Этот документ дополняет существующие architecture/rollout docs и заменяет устаревшие freshness/blocker-пункты нашего `../site-rollout-52782ce4/PLAN.md`. Он не создаёт новую обязательную нормативную иерархию, не разрешает deploy/merge и не заменяет accepted mobile Classic / desktop W57 новым макетом. Draft/HOLD.

Mode: LANE research-only; owner исследователь Reader GB; bounded scope только собственные research files. Product ownership: основной исполнитель2352; SYS/notes/print/special owners не затрагиваются. Rollback исследования — предыдущий локальный commit4e52f6d, не rollback Product. Проверки — source/registry contracts на изолированном archive exact SHA, без claims о новом browser build.

## 1. Что именно изучено

`document-index.json`: полный автоматический scan342 Markdown-файлов под docs/research;23 содержат термины ключевых Reader owners/унификации. Для них сохранены path/hash/headings. Это discovery, **не утверждение, что все342 документа прочитаны человеком целиком**. Вручную изучены релевантные архитектурные разделы и текущий код владельцев; не относящиеся к Reader карты/генеалогия/исторические миграции не объявляются актуальными по одному названию.

| Документ | Что брать в текущий план | Что НЕ считать сегодняшним фактом |
|---|---|---|
|`docs/READER-PLATFORM-ARCHITECTURE-2026-07-21.md`|Дополнения09.11: один core, publication structures, existing owners, slots/tokens|Июльские62 bootstrap/41consumers; ранняя фраза «три движка»; уже отменённая делегация GillSeriesChrome|
|`docs/READER-PLATFORM-MIGRATION-MATRIX-2026-07-21.md`|R1–R6 как направления convergence, capability-first classification|Все listed debt считать открытым без source check; R5 тут о PageHead, а в overlay plan о другом этапе — нельзя связывать только по номеру|
|`docs/READER-R4-PUBLIC-SURFACE-REGISTRY-2026-07-21.md`|Profiles+ownership+resolved import graph, не вторая ручная route list|Исторический baseline76routes|
|`docs/READER-R4-PUBLIC-SURFACE-INVENTORY-2026-07-21.md`|Provenance первоначальных gaps|Старые76/41/24 как нынешнее покрытие|
|`docs/READER-R5-OVERLAY-RUNTIME-PLAN-2026-07-21.md`|Один OverlayRuntime: stack/locks/inert/focus/recovery, не новый panel runtime|Историческую cross-browser приёмку выдавать за ce08ef67|
|`docs/READER-R5-OVERLAY-RUNTIME-INVENTORY-2026-07-21.md` и `SPECIAL-OVERLAY-ADAPTERS-PLAN-2026-07-21.md`|Границы special adapter и nested ownership|Старые direct-writer counts как текущие: source guard сейчас уже проходит эти строки до retired-owner assertion|
|`docs/SERIES-ENGINE-GUIDE.md`|defineSeriesConfig, flat/book, satellites, theme tokens, no forks|Историческую speed geometry/раскладку вернуть поверх W124–W129|
|`docs/READER_AND_COVER_UNIFICATION_WAVES_2026-11-10.md`|ReaderRail/SeriesReaderChrome/current scrollspy reuse; heading dedupe≠engine convergence|Label/count component считать полностью общим TOC runtime|
|`docs/READER_TOC_GROK_ADAPTER_GATE_2026-11-06.md`|Lossless ReaderTocNode projection; desktop presenter не второй scroll owner|Stage1 projection считать глобальным desktop release|
|`research/reader-w57-pilot/UNIVERSAL_READER_ROLLOUT.md`|One owner per capability, skins/adapters, explicit exclusions, data-integrity gates|Старый opt-in preview wording: W125 desktop preview теперь auto-W57|
|`docs/READER-ARGON-CLASSIC-VISUAL-SOURCE-2026-11-21.md`|Mobile Classic отдельно от accepted desktopW57|Восстановить rejected desktopW58 ради «общего стиля»|
|`docs/TEEN-SERIES-READER-PROJECTION-PLAN.md`|Единая projection, отдельные search/TTS/print policies для bibliography|Новый Teen parser или источники автоматически скрыть в печати|
|`docs/ARTICLE-STANDARD-CHARTER.md`, `CONTENT-QUALITY-STANDARD.md`, `OWNER-INVARIANTS.md`, `AGENTS.md`, `WORK_MODES.md`|S1–S54 для всех реальных статей; scope/authority/leases; standards≠visual sameness|Зелёный layout тест как подтверждение редакционной/источниковедческой приёмки|

Историю проверил локально (shallow history, ограничение явно учтено) и через GitHub commits API по конкретным owner paths. `owner-history.json` сохраняет полученные SHA/subjects. Основные вехи:
- `e9b013c4b263` — architecture baseline; `37010bd4ca57` — neutral façade; `ba9552dd5a3c` — Reader Core/Argon consolidation (из GitHub path history architecture).
- `354222d8` — lossless TOC projection / real-series tests / safe Grok gate, не замена scrollspy.
- `86806138` — W121 один quiz в Analytics; `52950832` — canonical search/source handoff; `78e6cb9` — валидированный article fallback.
- `d02b8e1` / `29903a8` — W129 hitbox/Analytics containment; серия source/browser test commits далее описывает новую геометрию, не старые21fail.
- `86a25c6` — full answer-bank signature; `ce08ef6` — только TTS smoke selector для compact Save.

## 2. Архитектура: что общее, что меняется на подстранице

**Общий core — не монолитный mega-component.** Одна модель данных/состояния и владельцы событий; несколько совместимых presenters поверх общих panel primitives.

| Слой | Общий владелец / существующая точка | Разрешённая вариативность |
|---|---|---|
|Route/capability truth|`data/route-profiles`, `migration/page-ownership.json`, `scripts/lib/public-surface-registry.js`|surface/shape/capabilities/explicit exceptions; не новый hand-maintained registry|
|Серия/книга|`seriesConfig.ts`, `defineSeriesConfig`, `SeriesReaderChrome.astro`|flat/book, порядок, front matter/satellites, обложки, editorial data|
|Семантическое тело|Authored Astro/MDX + ReaderProjection + ScriptureDataProjection|Явные source/TTS/search/print policies; данные статьи, не новый parser|
|TOC model|`readerTocProjection.ts`: projectSeriesReaderToc/projectStandaloneReaderToc, ReaderTocNode|single document / flat / book hierarchy; только текущая статья гидратирует section tree|
|Левая панель|Существующие ReaderRail/GillSeriesRail + общий heading primitive, native TOC overlays и Grok presenter|Branding/skin/обложка; общие node identity и navigation semantics|
|Правая панель|Текущий Analytics/marginalia, single GillAnalyticsStudy, W57 research host|Состав карточек по capabilities и approved themed slots; не второй quiz/notes runtime|
|Panel lifecycle|`js/site-utils.js`: window.OverlayRuntime / SiteUtils.OverlayRuntime|Docked desktop либо modal drawer mobile — адаптер presentation; один stack/lock/focus owner|
|Mobile shell|MobileChromeShell + текущие adapters/shared Play/speed primitives|Нужные capabilities/progress semantics; не перенос всех кнопок на page/special|
|Settings/preferences|GBReaderPreferences + ReaderPreferencesHead; текущие settings adapters|Разные skins общей UI primitive, согласованные диапазоны и реально применённый computed style|
|Saved data/search/audio|Canonical Library/highlights/notes, GBSearch/Pagefind, Product TTS owners|Представление/placement; никакого второго store/index/speech engine|
|Визуал|semantic tokens + `[data-series-theme]` + props/slots|Цвета, текстуры, шрифтовые роли, обложки, рисунки и утверждённый дизайн карточек|

### Общие панели — конкретный контракт

1. Одни node IDs для desktop rail/mobile drawer: series page identity отдельно от active heading identity. Переключение presenter не пересоздаёт reading session и не угадывает target по тексту.
2. Левая панель: общее дерево/переключение опубликованных частей и headings, collapse/expand/back/continue с теми же semantics. Различие book/flat/single задаёт projection, не отдельный renderer/parser.
3. Правая панель: capability slots (Scripture/glossary/quiz/notes/context), единые данные/контроллеры. Перемещение единственного DOM-owner между host допустимо с lifecycle/focus proof; клонирование интерактивного controller запрещено.
4. У каждой drawer — canonical OverlayRuntime registration; Escape закрывает только верхний modal layer; после последнего close восстановлены точные scroll/styles/opener; docked rail не притворяется aria-modal и не блокирует body.
5. Panel open/collapse/pin preferences записывает один существующий state owner. До изменений составить точную таблицу текущих state keys — **новый универсальный store здесь не предлагается**. Resize persistence у назначенного владельца, не параллельный rewrite.
6. Theme не переопределяет событийную модель, anchors/ARIA/tab order/44px/safe-area. Новая карточка может иметь свой дизайн через слот, но не свой overlay lock/quiz attempt/notes writer. Различная оформление не означает произвольную несовместимую геометрию общих controls.

## 3. Текущий audit и корректировка W130

Source-only проверки на archivece08ef67, Node22.22.3, raw logs рядом:
- `public-surface-registry-audit.js` **PASS**:113publicroutes; classification series82/article5/page11/special15; flat46/book36;73governed reading-series и5explicit native exceptions.
- `public-surface-registry-regression-test.js` **PASS**.
- `check-engine-contracts.js` **FAIL1contract**: Play/rate check ищет series mobile-spdbadge/mobileSpeedrail в старом sharedPlayGroup. В source классы уже в ReaderMobileSpeedBadge/speedSlot. Это source-location assertion, не доказательство product regression.
- `overlay-runtime-contract-test.js` **FAIL** line41: требует retired `gill-learning`. W121 удалил Learning и оставил quiz в Analytics. **Новая узкая находка:** source gate требует возвращения удалённого overlay owner. В in-memory counterfactual удалён только retired owner из expected list, добавлены no-gill-learning и canonical GillAnalyticsStudy composition assertions — остальные проверки целиком PASS. Product/test files НЕ менялись. Это не browser proof nested panel parity.
- `engine-sweep.mjs:324` по source всё ещё требует badgeRadius>=10 на кликабельном элементе. Browser sweep наce08 не запускался; исторические219/225 изW130 не присваиваются новому SHA. Guard должен проверять отдельно painted circle и rectangular hit region, не требовать мёртвые углы.

**W130 полезен, но требует reconciliation перед реализацией:**
- 13explicit mobileChrome entries ≠13покрытых routes. Architecture appendix уже объявляет этот registry selective compatibility adapter; готовый public-surface builder уже объединяет profiles/import graph. Не создавать второй generator/SSOT, не включать shell автоматически из surface.
- Его82DOM-chrome/113 на52782 и наши82classified-series наce08 — разные измерения. Нельзя по совпавшему числу объявить73%runtime coverage или оставшиеся31 автоматической очередью.
- Изменение fontScale изучать по computed paragraph/headings в fresh contexts. Его1.4→1.25 может быть нормализацией официального диапазона; это mismatch только если UI обещает1.4. Нельзя blanket `1em*scale` на вложенные списки/цитаты: проверить отсутствие двойного масштабирования и cascade specificity; не снимать clamp без решения владельца.
- `/izbrannoe/` явно исключён из mobileChromeRegistry из-за sticky-navbar/double header. Его нельзя «подключить за5строк» без resolving existing chrome ownership.
- News/G3/Journal/Nagornaya защищены. W130 research suggestion о page adapter дляupdates/nagornaya — НЕ author approval. Можно переиспользовать общие standards/overlay capability через отдельного владельца, но не внедрять туда W57/общий Reader shell этой волной.

## 4. Актуальные PR/CI blockers, а не прежний список

`ci-snapshot.json` получен наce08ef67: Reader Controls и TTS checks SUCCESS. MapEngine Intro Focus FAILURE; W91 подтверждает repeated apt/browser install exit124 до сценариев — infrastructure lane, не причина менять MapEngine runtime. `interactive-audit` также FAILURE на snapshot; **причина здесь не расследована, не объявлять её старым quiz fail**. Skipped autofix jobs не равно failed product gate.

SYSW89: при join сохранить PastorDossierA35min/readingProgressPartMin35 + dossier-specific OG/Twitter **и railCover**, не PartI20-антисоветов image. Notes2370 и cold PDF2349 остаются отдельными незакрытыми приёмками до свежего owner evidence. Прежний52782список21/293 больше не current blocker list.

## 5. Внедрение без потери дизайна: bounded work packages

| Пакет | Изменение | Не менять | Exit evidence |
|---|---|---|---|
|U0 Standards reconciliation|В существующих docs отметить superseded statements; existing guards сверить с актуальными owner modules/retiredLearning|Ни product geometry, ни нормативы44px|Registry PASS; engine source contract исправлен по actual composition; overlay source passes с negative retired-owner guard; screenshot semantics не ослаблены|
|U1 Left panel parity map|Сопоставить ReaderRail/GillSeriesRail/native/Grok node↔DOM↔active-heading; reuse projection|Новые TOC parser/scrollspy/renamed anchors|Standalone+flat+book+satellite, keyboard/active state/crossdoc focus, no-JS links|
|U2 Shared panel lifecycle|Ограниченно свести дублируемые registration/focus/Escape/scroll code к существующему OverlayRuntime API; presenters оставить|Новый global panel manager, стили acceptedW57/mobileClassic|Nested left→right/settings→Escape, обратный порядок, pagehide/destroy/reopen, short landscape, exact focus/scroll, docked nonmodal|
|U3 Right capability composition|Единый provider+single-controller quiz/notes/Scripture slots на mobile/W57/inline|Копии quiz, новый notes schema/store, `innerHTML` painting|Одна attempt/notes identity, source Enter/modifiers,2Tim2:22distinct anchors, annotations не paint twice при resize|
|U4 Theme adapter contract|У каждой family config/theme/slots с palette/typography/card presentation; parity screenshots|Route-specific core CSS hacks/`!important` piles|Day/Sepia/Night, contrast, real44px hits, visual review approved per family|
|U5 Preferences application|Сверить supported UI range и реальные CSS outputs per adapter; исправлять bounded owner styles|Global font multiply на всю страницу/отдельные preferences stores|Computed text changes и safe wrapping320/390, no nested double-scale,200%zoom, persistence across surfaces|
|U6 Cohort adoption|По existing profiles/capabilities, один approved adopter/transaction; повторное использование уже работающих components|Массовый catch-all injector и replacement специальных движков|Exact built+browser receipt и отработанный route-level rollback|

Порядок: U0 и актуальный interactive CI triage → U1 mapping → U2/U3 bounded implementations → U4/U5 по готовым adapters → U6 малые cohorts. Mapping/research можно делать параллельно; product integration только с разрешением текущего owner, по актуальному HEAD/lease. SYS joined build и data/print gates обязательны перед release, не обязательно блокируют read-only research.

**Когорты:** Gill baseline; standaloneHermenevtika/KodDaVinchi для отличий структуры; flatBaptist и bookHeart для hierarchy; затем pastoral/Teen approved content routes. Catalogs получают page navigation capabilities только там, где нет уже существующей конфликтующей шапки; progress/TTS не включать по умолчанию. Specials получают только согласованные theme/safe-area/OverlayRuntime adapters. Конкретный limitedOFF-by-default Baptist/Teen semantic pilot сверить с owner directive, не путать с миграцией hub. Protected renderers не переписывать без отдельного решения.

## 6. Общая приёмка панелей и стандартов

Каждому adopter: exactSHA+build provenance, source ownership, stable anchors/canonical, одна narrative projection, policy-aware TTS/search/print, raw outcomes и screenshots, zero duplicate state writers. Mouse/touch/keyboard, normal/reducedmotion,320/390/768/1120native и1121/1440genuineW57,568×320landscape,200%zoom, light/dark/sepia; actual safe-area/mobile keyboard и physicalAT как отдельные доказательства/честныеSKIP. DesktopW57 regression-only, не restoreW58.

Сохранить разницу currentseriespage/activeH2H3; доступные Left/Right/TOC close/continue; real44px and painted-pill hit tests; focusreturn; one modal owner; whenresize preserve reading/session via assignedowner. Saveddata failures/quota/concurrency — failclosed+draft retention. Cold first userPDF includes terminal content, не только page.pdftext. Search exactfocus и honestfallback безpending. Repeated occurrences/все82quizsource не считать закрытыми точечным receipt.

S1–S54 и качество материалов проверяются отдельно от engine adoption: source verification, Scripture accuracy, provenance/rights, typography/editorial depth. Новый skin не может менять даты публикации, attribution или статью ради удобства projection.

Rollback: маленький adapter/config opt-in revert, предыдущий shell/capabilities, canonical rebuildassets/index/SW; пользовательские notes/highlights/preferences не удалять. Stop при data loss, doublewriters/paint, wrong fragment, trappedfocus, protectedUI diff, content/PDF loss. После каждой волны test+visual receipt и owner decision, не массовое «готово».

## 7. Следующее конкретное действие исполнителю

1. Triage exactce08interactive failure; MapEngine infrastructure отдельно. Снова сверить HEAD перед записью.
2. В собственном занятом owner lane обновить existing source tests: speed classes по actual shared component composition; retiredgill-learning заменить negative guard + singlecanonicalquiz (in-memory proof приложен). Не возвращать старый UI ради теста.
3. По текущим existing registries построить one-route trace для4представителей: profile→shell→TOCprojection→left/rightDOM→OverlayRuntime owner→stores. Из него выбрать первый bounded duplicate lifecycle removal с zero visual diff.
4. Согласовать implementation patch+parity matrix; сначала один core fix и проверки на разных skins, а не копирование нового фасада во все страницы.

Исследование не изменяет Reader/SYS исходники, не создаёт ещё один runtime и не заявляет глобальную унификацию завершённой.
