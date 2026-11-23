# Внедрение Reader и стандартов по сайту — исследование и исполнимый план

**Статус: предложение, не разрешение на rollout.** Основание: exact Reader PR2352 `52782ce400d988b78f9b6ef2827f84f828fef3ad`, собственная production-like сборка и ранее прочитанные комментарии до W128/W88. Повторное чтение GitHub сейчас блокируется EOF GraphQL/REST; новые указания и актуальный CI НЕ подтверждены. Перед реализацией любого пункта обязательна сверка HEAD, новых comments/reviews, владельцев и отменённых решений. Дата исследования2026-11-22 UTC по окружению; даты Git-коммитов могут отличаться. Draft/HOLD сохраняется.

## 1. Что исследовано сейчас, а не предполагается

Read-only inventory: `inventory.csv/json`, скрипт `../site-rollout-inventory.py`. Источники — `migration/page-ownership.json` и built dist, не список URL по префиксам. 113 manifest routes с HTML:75 имеют проверяемый `article.article-body` или `article[data-pagefind-body]`;12 относятся к защищённым prefixes updates/journal/nagornaya;26 не имеют этой article-сигнатуры. Duplicate HTML IDs в этих113 не найдены. Это НЕ доказательство правильной семантики/доступности и НЕ список75 готовых к включению страниц.

Отдельный существующий `reader-platform-single-owner-contract.cjs` на тех же bytes:79 readers (2native,69series,8standalone),34exceptions,0duplicates. Наш71 `data-reader-root`/`data-gill-v16` marker и75 semantic article — другие метрики; расхождение НЕ равно8 отсутствующим движкам. В inventory добавлен `data-reader-engine`, чтобы сверять по каждой строке. Existing contract важнее грубого HTML-признака при классификации владельца.

Показательные ловушки автоматического rollout: `/about/` и `/baptisty-rossii/` имеют semantic article, но это не разрешает превращать их в long-form Reader; `/konfessii/*` запрещён premium-controls manifest как interactive app. G3-защита требует owner review независимо от URL. Нельзя считать любой article или MDX документ подходящим для замены shell.

Свежие локальные source/static проверки на52782ce4: article-capability-owner PASS(4семейства), ReaderProjection source70/70, single-owner PASS, MDX structure70files/0errors/0warnings, page-ownership production-like PASS. Raw logs рядом. Эти результаты НЕ заменяют browser/paint/CI/интеграционные gate.

Архитектурная опора уже есть:
- `src/components/reader-platform/ReaderActionsRuntime.astro`: один transport для ReaderProjection → print/actions/a11y → TTS lifecycle/media-session → article-interactions.
- `src/runtime/reader-projection.js`: версия1, root/section/text/policies и обновления; не владелец speech engine/данных заметок/визуала.
- `src/components/article-pilots/_shared/series/SeriesReaderChrome.astro`: общий config-driven shell, single GillAnalyticsStudy, canonical search; не копировать на каждую серию.
- `research/reader-w57-pilot/UNIVERSAL_READER_ROLLOUT.md`: уже существующий продуктовый контракт. Этот план — evidence/sequence supplement, не второй competing стандарт.
- Его фраза «W57 opt-in» историческая: W125 preview на>=1121 теперь auto-W57, reader-pilot=0 opt-out; это поведение preview.py, НЕ production readiness и НЕ разрешение global injection.

## 2. Целевое разделение: один движок ≠ одинаковый сайт

**Общие стандарты** распространяются на весь сайт: клавиатура/фокус, contrast/zoom/motion, semantic HTML, идентичность ссылок, asset integrity, достоверные тесты и privacy-safe диагностика. **Reader engine** подключается только одобренным reading routes. News/G3/Journal/Nagornaya, приложения, карты и каталоги сохраняют свои renderer/runtime; применимость общего accessibility-стандарта не означает права внедрить в них W57.

Три слоя без нового competing renderer:
1. Authored MDX/Astro + текущие Scripture/reference data — семантическая истина: стабильные ID, provenance, структура, разрешённые crosslinks, явные exclusion policies. Один уже существующий semantic processor, не regex/JS-wrapper поверх готового текста.
2. ReaderProjection и canonical capability owners — единый lifecycle для текста, search/TTS/print/current section; canonical preferences, annotations/Library/notes, search palette, audio и quiz. По одному writer/owner; не новая storage schema в каждой серии.
3. Shell adapters/config/tokens — native mobile, W57 и series identity. Обложки, Roman TOC, current series page и active reading section различаются по данным, а не fork обработчикам.

Дополнить существующий adapter contract при реализации (точные TS поля согласует владелец): canonical route + series/page IDs; article kind; authored TOC IDs/levels; reading progress identity; capabilities; research/editorial data; provenance; semantic policies; skin tokens. Eligibility/readiness не смешивать с SEO publication status. Новую отдельную route database не создавать: расширить текущий owner/config contract после согласования, с default OFF для новых adopters.

## 3. Порядок работ и gate между волнами

| Этап | Конкретный результат | Критерий выхода | Кто отвечает |
|---|---|---|---|
|0 Freshness/leases|Свежий HEAD, полный delta comments+reviews; таблица approved/retracted/open; exact CI IDs|Нет правок на устаревшем SHA/чужом lease|Главный исполнитель2352, исследователь сверяет|
|1 Stabilize existing Reader|Разобрать фактические Reader Controls failures; обновить только устаревшие отношения Search/Save; реальный hit-test speed-pill/44px/scroll rates; skip-link contrast|Exact final SHA relevant CI green; root-cause fixes или явное принятое owner decision, без blanket exemptions|Reader controls/CSS owner|
|1b Integrity/print параллельно|Notes2370 fail-closed при contention/quota; cold user print2349; tables577 отдельным evidence|Нет unlocked fallback write/потери данных; первый пользовательский PDF имеет все final blocks; конкретные browser proofs|Notes/print/table owners, не этот audit|
|2 Joined candidate|Контролируемое соединение Reader+SYS на разрешённой рабочей ветке интегратора|Результат проверен по combined bytes; semantic conflicts reviewed; final hashes/index/SW regenerated|SYS+Reader main integrator|
|3 OFF-by-default semantic pilot|Одна выбранная Baptist chapter + одна Teen content route, авторизованные владельцем; fixture двукратного2Tim2:22|Один semantic owner; два отдельных occurrence anchors/notes; mobile+W57 соответствуют одному source; rollback tested|MDX/Scripture/platform owners|
|4 Gill regression + иной обычный article|Не новый shell, а прогон retained capabilities на структурно иной статье|Матрица below green, real screenshot review; no duplicate event/state owners|Reader+article owner|
|5 Малые long-form cohorts|Baptist chapters, далее biography/pastoral, затем другие явно разрешённые reading routes|Каждая route имеет receipt/capabilities/rollback; protected sentinels unchanged|Семейный владелец+интегратор|
|6 Release/наблюдение|Явное разрешение включения; bounded approved batch; затем расширение|Green exact joined SHA, deploy provenance, exercised rollback; нет data-integrity regression|Fedor/release owner|

Этап3 — ограниченный MDX pilot из предыдущего owner directive, не разрешение переделать защищённую Teen hub или весь Baptist landing. Точные две routes выбрать после свежих comments и проверки eligibility; в этом плане они намеренно не выдуманы. Gill — существующий baseline, не новая массовая миграция. Waves5/6 не запускать пока blockers1/1b/2 не закрыты; независимые исследования pilot можно вести без включения в production.

SYS integration checklist из последних прочитанных handoff, требует новой сверки: сохранить Pastor35min/DossierA, Diotrophes dossier-specific OG, единый GillAnalyticsStudy вместо удалённогоLearning, SYS editorial slots/assetUrl; Scripture index строить из joined source; asset-version/SW/manifest только canonical generation. Не ours/theirs для generated ownership. PR2352 в том snapshot направлен в2346, не разрешение merge в main; никаких force/auto merge.

## 4. Обязательная приёмка каждого adopter

- **Content identity:** canonical/anchors/hierarchy и SEO не изменены случайно; broken/duplicate fragment0; серия current page НЕ подменяет active H2/H3. Исторический crosslink audit не зачесть за новый integrated SHA.
- **Keyboard/landscape:** Tab/ShiftTab, Enter/Space/Escape, один modal owner/inert/focus trap и точный возврат opener; узкий landscape даёт достижимые список/Close/Continue без обрезки; resize persistence проверяет его текущий владелец.
- **Native/W57:**320/390/768/1120 native;1121/1440 W57 actual ready через preview.Handler;568×320 landscape; light/dark,200% text zoom, reduced+normal motion.1920 и mobile keyboard+safe areas для визуальной приёмки. Emulation не выдавать за физическое iOS/Android.
- **Protected optical contract:** Home painted-right → Analytics SVG+text → Play painted-left;44px независимые targets, один TTS arc/rate badge+expansion/dual progress. Кликать реальные границы painted speed-pill и triangle, не только центр DOM box. Cormorant/Inter/Literata/Mono native mobile сохраняются; W57 skin отдельно.
- **Projection/Scripture:** одинаковые policy-aware boundaries в TTS/search/print; tooltip/footnote/UI не озвучиваются дважды; один processor. Два одинаковых2Tim2:22 проверять независимо: anchor recovery, select/highlight/note, reload; не только количество строк.
- **Search:** actual fresh Pagefind; query→реальный result→keyboard+click; exact P focus/selection; morphology без literal→truthful H1 fallback+pending clear; repeat search после natural header reveal; repeated-occurrence ambiguity не считать решённой. Наш22/22 receipt покрывает только GillII Chromium на52782ce4.
- **Quiz:** один controller/attempt across inline/native/W57; editorial/series identity; source exact focus и Back; modifiers new tab; нет Learning duplicate. Наш32/32 наd7c13676 не all82source acceptance.
- **Saved data:** existing quote/anchored same-text occurrences, linked notes/Library, edit/delete/undo/export/reload; concurrent create/update/delete/WebLocks unavailable/3s contention/quota/failed commit. При ошибке сохранить draft и сообщить пользователю, не писать unlocked и не очищать библиотеку. Disable adopter не удаляет пользовательские данные.
- **TTS:** actual start/stop/rates after real rail scroll, keyboard/media-session, selection vs whole article, network/worker failure. Не заменять speech engine вторым.
- **Print:** cold native user Save as PDF, first/repeat parity всех заключительных блоков, font/pagination readiness+unlock; table reading order/visible headers/PDF text/AT отдельно. page.pdf и synthetic beforeprint — только отдельные witnesses, не подмена user path.
- **Accessibility/visual:** contrast с computed color/cascade, skip-link cold+focused+blur; representative screenshots с reviewer sign-off. No-overflow и70source assertions не доказывают дизайн/AT.
- **Scope sentinels:** News/G3/Journal/Nagornaya и apps/catalogs до/после: неизменность shell/owners, отсутствие W57 injection/нового storage writer. Сравнивать также exception metadata, не только URL prefixes.

## 5. Rollback и критерий остановки

Для каждой маленькой волны сначала упражнение отката: выключить route opt-in в существующем config, восстановить предыдущий shared shell path, пересобрать canonical assets/index/SW, проверить обычную навигацию+старые anchors+доступность сохранённых данных. Не откатывать данные/не очищать storage. Деструктивные schema migrations не совмещать с visual rollout; если нужны — отдельный reversible/export-first дизайн.

Stop: любая потеря/перепривязка notes/quotes; двойной writer или annotation painting; неверный cross-route jump; скрытые controls/focus trap; несовпадение print content; нерассмотренное изменение protected engine; разъезд built/deployed SHA. Не продолжать следующие cohorts ради процента охвата.

## 6. Формат evidence и ближайшие поручения

Каждая задача: `{scope, baseSha, candidateSha, owner, touchedPaths, scenarios, passed/failed/skipped, browser/device, artifactLinks, unresolved, rollbackProof}`. Тестовые артефакты обезличены: не собирать текст пользовательских заметок/поиска в telemetry. Исторические результаты всегда подписывать SHA и ограничением, SKIP не превращать вPASS.

Ближайший исполнимый backlog:
1. Восстановить GitHub read; сверить последние решения по Controls/notes/PDF/skip contrast; приложить свежую exact-SHA blocker matrix. Не публиковать этот snapshot как последнее состояние PR.
2. Главному исполнителю — narrow source fixes и обновление неправильных test relationships с negative controls. Не запускать новый большой визуальный редизайн.
3. Исследователю — на свежем joined candidate повторить inventory и сопоставить75semantic/79engine rows вручную; не устанавливать Reader на about/landing по heuristic.
4. MDX/Scripture владельцу — согласовать две конкретные pilot routes и двукратный2Tim2:22 fixture, reuse processor/owners; feature defaultOFF.
5. После approval — один adopter change/receipt, затем runtime cross-browser proof; не переносить сотни legacy blocks wholesale.

Готовность плана не равна готовности сайта. На момент подготовки GitHub недоступен; новых CI/release/deploy claims и продуктовых коммитов нет.
