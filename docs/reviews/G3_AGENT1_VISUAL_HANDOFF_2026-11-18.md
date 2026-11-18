# Agent 1 — независимая visual/UX приёмка и selective handoff

**Задание:** [Owner review #2340 / 6991773494](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2340#issuecomment-6991773494). Это новая визуальная/interaction работа, не продолжение print-backlog и не повтор общего P0/P1-аудита.

## Граница работы

- **Mode / owner:** LANE / Agent 1; собственная ветка `arena/a9995426-gb-is-my-strength`, Draft #2340. Canonical integration owner — #2338.
- **Baseline собственной приёмки:** `a682d395930de16f950a0bbe7ba2f5e2cc3dd2d4`. Main / rollback: `9edef94ece08012223c1364bec7ddcd561cf5713`. Canonical: `b2ae614730b0c2e164d3b07453797074253d9698`.
- **Scope этой волны:** этот handoff и существующий `scripts/journal-editorial-browser-test.mjs`; ignored screenshots, raw browser/PDF observations и воспроизводящие helpers. **Ни один файл приложения не изменён.** Нативная версия не получила выдуманный «исправленный дефект» ради коммита.
- **Source of truth:** два Journal route profiles, `migration/page-ownership.json`, существующие Journal components и неизменённые Research handoff / bibliography / metadata owners. Визуальная приёмка не выдаёт публикационный допуск.
- **Overlap:** #2341, #2343 и Agent 8 экспортированы по exact commit objects в ignored read-only snapshots. Их refs, PR и source не записывались. Не выполнялись merge, retarget, deploy или импорт чужого runtime.
- **Checks:** matched 390/1440 light/dark screenshots; реальный длинный H1; native TOC, source/return, Tab continuation и mobile-bar geometry; 320/640/720/768 CSS px; no-JS; настоящие A4 PDF; final-head усиленный browser witness и прямые source contracts. Численные результаты final-head запуска — в отчёте, а не обещание в этом документе.

**Recovery подтверждён:** обычный push `dceed04… → a682d395…` завершился exit 0; remote ref и PR head повторно прочитаны как `a682d395…`. Без reset/clean/rebase/force-push. Два прежних print-коммита теперь на собственной remote-ветке; старые evidence packages не переписывались.

## Что реально рассмотрено

| Snapshot | Exact SHA | Контекст |
|---|---|---|
| Собственная версия #2340 | `a682d395930de16f950a0bbe7ba2f5e2cc3dd2d4` | Full production-like output; 8 новых first-screen PNG и отдельные interaction/reflow views |
| Canonical #2338 | `b2ae614730b0c2e164d3b07453797074253d9698` | Baseline для before/after |
| Agent 7 #2341 | `6c9cb87aa2d5e0ff67f1f8c69c1e3d98f56d00b6` | Interactive navigation alternative |
| Agent 9 #2343 | `cbe3ebea1a79d1ffb44338bd3b54f6e9e0a05a44` | Actual API head, не старый SHA из PR body |
| Agent 8, session `7f634191` | `9e77d9d3fcd86ce8c6cb62a7b0aa2e0b5b05d258` | Ветка определена по ownership-комментарию, **не** QA PR #2344; включает contextual source return |

У peers собраны только две точные public route entrypoints с их собственными компонентами: это достаточный screenshot/navigation witness, **не** full-repository CI или production readiness. Shared `css/`, `js/`, `fonts/`, `icons/`, mobile-chrome owners и layouts одинаковы с canonical на всех пяти SHA. Font readiness, viewport, theme preference, reduced motion и отсутствие service worker унифицированы; H1 и 21 source record сопоставимы. Отличающиеся редакционные лиды кандидатов не подменялись ради «одинаковой картинки».

Первый symlink-entrypoint fixture не включил Astro component CSS; его непригодные кадры исключены. Byte-identical **копии** route files, их hashes и CSS/font guards устранили ошибку harness до финальной матрицы. Нестилизованные кадры не объявлены дефектами кандидатов.

### Наблюдения, а не рейтинг вкуса

- **Собственная версия:** на рассмотренных двух public routes нет подтверждённого нового repair-worthy дефекта. Длинный H1 не обрезан; обе темы читаемы; source target получает нативный фокус; Tab входит в ссылки источника, а после return продолжает внутри связанного раздела. Это локальная инженерная приёмка, не owner visual signoff.
- **Композиция:** на 1440 px первый reading paragraph имеет ширину 760 px у Agent 1, 379 px у canonical/#2341 и 740 px у #2343/#8. У Agent 1 rail начинается **после** общего opening. Это измеримые различия, а не заявление, что более узкая мера сама по себе баг.
- **Источники:** canonical и #2343 в этих snapshots не имеют source-return controls; это отсутствие возможности, не «сломанная ссылка». Agent 1/#2341 имеют 21 section-return; #8 дополнительно возвращает к последней активированной citation, сохраняя section fallback без JS. Наша section-return не выдаётся за возврат к точной citation.
- **#2341 — воспроизводимое препятствие selective integration:** после native `#finance` или `#src-G3-S001` URL верен, но JS scrollspy через `scrollIntoView` возвращает viewport к navigation; следующий Tab не продолжает целевой раздел/источник. Повторный read-only witness с 600 ms settling воспроизвёл это на 390/1440. Например, 390 px: через 600 ms finance top = 3382 px, source top = 10444 px; при disabled scripts — соответственно 146/144 px, и Tab идёт в целевой контент. См. raw recheck JSON и PNG. Не переносить этот scroll owner вместе с native alternative; исправление остаётся у владельца #2341.
- **Print:** свежие собственные public PDFs — Journal 3 листа, dossier 18; все 21 DOM-derived source titles присутствуют, пустых текстовых страниц / U+FFFD / выходящих за лист text spans нет. У canonical/#2343/#8 — 17 листов dossier, у #2341 — 23; page count не является оценкой качества. Текст/геометрия text spans light/dark совпадают, но декоративные border colours различаются: pixel-identical print parity **не** заявлена. Свежий dark dossier совпадает всеми 18 растеризованными страницами с прежним exact-source a682 PDF; прежний полный print review остаётся отдельным неизменённым evidence, не новой работой этой волны.

## Пять конкретных переносимых решений для #2338

Это **план selective integration владельцем canonical**, не разрешение cherry-pick/merge всей ветки.

| № | Что переносить и зачем | Components / hooks | Критерий после интеграции |
|---|---|---|---|
| 1 | Общее opening: полный H1 → lead → явные byline/dates/reading time → существующая обложка с честной подписью и research-scope note | `JournalArticleOpening.astro`; `g3EditorialPresentation.ts`; вызов в `G3Dossier.astro` | Длинный H1 390/1440 в обеих темах без clipping; byline **«Автор-редактор:»** до чтения; даты только из существующего route-owned metadata; тот же подготовленный media asset |
| 2 | Разделить opening и reading grid; ограничить прозу, оставить rail только повторными входами; единые mobile/safe-area gutters и footer edge | `JournalEditorialShell.astro`, `JournalEditorialRail.astro`, `JournalLanding.astro`, `JournalMasthead.astro`; scoped `.journal-feature-grid`, `.journal-story-column`, `.prose`, gutter tokens в `journalEditorial.css` | На 1440 reading max 760 px; rail не сужает H1; на mobile скрыт только дублирующий rail, контент остаётся; footer/main x совпадают; ни одного нового shared CSS/font/SW owner |
| 3 | **Один** native TOC с 11 существующими anchors, keyboard disclosure и no-JS чтением; не смешивать со scrollspy | `JournalContents.astro`; `contents` projection в `G3Dossier.astro`; `.je-contents` | Enter/Space/Tab; `#finance` + следующий Tab в finance; Back/Forward остаётся у browser; 11 существующих targets; никаких `IntersectionObserver` / route-local router / второго fixed control |
| 4 | Reader-facing bibliography без подмены evidence states: 21 focusable native target, названия/даты/locator, public/ledger links и понятный section-return | `JournalBibliography.astro`; `sourceSections`/`bibliography` projection в `G3Dossier.astro`; `.bibliography-item:target`, `.biblio-return` | Закрытый details раскрывается fragment navigation; target не под mobile bar; Tab входит в source links, return продолжает связанный раздел; tier/eligibility остаются исходными data attributes, не новым permission |
| 5 | Забрать rendered-text и interaction protection вместе с presentation, а не только CSS | `scripts/journal-editorial-contract.mjs`, `scripts/journal-editorial-browser-test.mjs`; существующие узкие print rules в `journalEditorial.css` | Production DOM сравнивается с реальным source без второго copy текста; проверяются spaces/accessible name/anchors/21 sources/hold. Новый witness использует настоящий `.mobile-chrome.is-shown .mcp-top`, focus и обе Tab-continuation точки; не достаточно одного hash-change или axe=0 |

### Порядок интеграции и карта конфликтов

1. Сначала canonical выбирает один целостный opening/reading/TOC owner: Agent 1, #2343 или #8. Переносить один комплект markup + scoped CSS, не склеивать одноимённые selectors трёх вариантов. `G3Dossier.astro`, `JournalLanding.astro`, `JournalMasthead.astro`, `journalEditorial.css` пересекаются у всех; wholesale branch merge не является этим handoff.
2. Если выбран Agent 1, переносить пункты 1–4 в этом порядке; компонент source data остаётся исходным. В пункте 4 #8 `JournalSourceReturn.astro` — отдельная полезная **опция** для exact citation return. Ей нужны стабильные citation IDs, одна bounded adapter instance, проверка no-JS fallback и повторный Tab witness; не подменять ею bibliography/claims целиком.
3. Theme/search остаются у существующих shared owners. Agent 1 не имеет второго store/listener; если нужны masthead controls #2343/#8, брать только consumer shared API после отдельного выбора владельца. Указанную Owner’ом shared `.mcp-search` focus проблему не «чинить» route-local workaround; её новая shared-surface приёмка не входит в этот public-route witness.
4. Не заменять `JournalDocumentHead.astro` нашим старым optional-date/fallback контрактом: сохранить независимый required route-date safeguard #2345 / SEO owner. QA #2344 и Agent 4 accessible-name/role/font предложения дедуплицировать по actual source. SYSTEM font bundle / shared CSS / SW / package changes в этот перенос **не** входят; CLS gains peers здесь не измерены и не присваиваются Agent 1.
5. Затем перенести пункт 5 и прогнать build/canonical asset revisions → source/hold contracts → public screenshots/navigation/reflow/PDF на **новом exact canonical SHA**. Отдельно Firefox/WebKit и owner visual choice. Нынешний CI/PNG другого SHA не становится приёмкой интегрированного результата.

## Реальные before/after и воспроизведение

[**Основной visual report / полная screenshot matrix / raw JSON / PDF**](https://4323-ibdwza5dfubsidrppk86s.e2b.app/agent1-owner-review/)

| View | Before: canonical b2ae | After: Agent 1 a682 |
|---|---|---|
| Dossier 390 light | [PNG](https://4323-ibdwza5dfubsidrppk86s.e2b.app/agent1-owner-review/canonical/dossier-390-light.png) | [PNG](https://4323-ibdwza5dfubsidrppk86s.e2b.app/agent1-owner-review/agent1/dossier-390-light.png) |
| Dossier 1440 dark | [PNG](https://4323-ibdwza5dfubsidrppk86s.e2b.app/agent1-owner-review/canonical/dossier-1440-dark.png) | [PNG](https://4323-ibdwza5dfubsidrppk86s.e2b.app/agent1-owner-review/agent1/dossier-1440-dark.png) |
| Journal 1440 light | [PNG](https://4323-ibdwza5dfubsidrppk86s.e2b.app/agent1-owner-review/canonical/journal-1440-light.png) | [PNG](https://4323-ibdwza5dfubsidrppk86s.e2b.app/agent1-owner-review/agent1/journal-1440-light.png) |

Это **before/after integration alternative**, не новая bug-fix пара и не deployment. Viewer временный; исходные файлы и reproduction helpers находятся в ignored `reports/g3-editorial-wave/agent1-owner-review/`. Документ в Git сохраняет компоненты, SHA, наблюдения и порядок переноса; bulky PNG/PDF в Git не добавляются.

Новый browser witness запускается обычным способом из header скрипта. Для public-only приёмки не задавать `JOURNAL_HISTORY_URL`. Никакой новый публичный/production history fixture не нужен.

## Что не подтверждено и что запрещено выводить из проверки

- Firefox/WebKit: executables отсутствуют, **0 cases**, не pass. Реальные устройства, browser-UI zoom, screen reader, physical print и owner art-direction не выполнены. 720×550 CSS px — **reflow equivalent** 1440×1100 / 200%, не симуляция через `deviceScaleFactor` и не настоящее browser UI zoom.
- Новый source/test handoff не меняет текущие public claims, byline, dates, media, runtime или маршруты. Существующий print-density/owner-choice вопрос не закрыт этой работой.
- Research #582 повторно прочитан: `93d6f08a40c7989eb1f6362fd1667094742144d2`, Draft. Только 16 approved public claims / 21 sources старого seal. Все 9 history gates **PUBLICATION_HOLD / NOT_ISSUED**; оба production throws и отсутствие history route/link/search/RSS/sitemap обязательны. Ни один browser/test/print pass не является новым Research→Product handoff.
