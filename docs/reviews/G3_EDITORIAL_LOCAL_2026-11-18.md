# Агент 8 — G3 / Journal, редакционная волна 18 ноября 2026

> **Текущий владелец варианта: Агент 8**, Arena session `7f634191`.
> После завершения локальной волны владелец явно разрешил push в мультиагентном режиме.
> Текущая граница публикации ветки записана в §F. Результаты и ограничения §A–E —
> сохранённый локальный свидетель, не разрешение публикации истории и не старый CI нового HEAD.

## Lane / authority

- Mode: **LANE**.
- Owner: **Агент 8** (Arena session `7f634191`), по прямому поручению владельца; сначала local-only, затем разрешён push только своей Arena-ветки.
- Working branch: `arena/7f634191-gb-is-my-strength` (не переименовывать).
- Arena admission / main: `9edef94ece08012223c1364bec7ddcd561cf5713`.
- Presentation baseline / rollback: Product [PR #2338](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338), `b2ae614730b0c2e164d3b07453797074253d9698`, ветка `lane/journal-editorial-premium-20261118`, автор PR FedorMilovanov. Взята **fast-forward только в локальную Arena-ветку**; remote не изменён. Публичный login не устанавливает личность параллельного агента; writer lease не присваивался.
- Bounded scope: `src/components/journal/**`, кандидатные данные истории `src/data/journal/g3HistoryDraft*.ts`, presentation-only manifest существующей обложки `src/data/journal/g3EditorialMedia.ts`, адресные Journal QA/review scripts + fixture, этот единый handoff. `JournalDocumentHead.astro` затронут только подключением resource hints уже используемых шрифтов: подтверждённый cold-load layout shift, не изменение SEO/date authority. Только необходимый автоматически полученный счётчик Scripture source files допускается как derived delta; фактические ссылки Писания не меняются.
- Adjacent work: #2338 — канонический Product lane; эта ветка — только локальное предложение для последующей интеграции туда, не конкурирующий PR. Research [#582](https://github.com/FedorMilovanov/Research/pull/582) остаётся у своего владельца. Ни remote-ветки, ни PR descriptions/comments, ни Research не изменяются.
- Source of truth: текущие route profiles `/journal/` и `/journal/dossiers/g3/`, Astro-owned source, root/router + normative editorial policies. Общие layouts, CSS/JS, floating controls, route ownership, dependencies, immutable handoff и protected data вне scope.
- Checks: Astro check/build + canonical postbuild; scoped DOM/SEO/anchor/publication contract; exact factual-prose comparison; responsive/browser screenshots, axe WCAG A/AA, keyboard/search/theme/print/reflow; search/RSS/sitemap/Scripture/cache-bust checks. Недоступный браузер не считается PASS.
- **Нет push / PR creation / merge / deploy.** Локальная сборка не является опубликованным сайтом.

## Проверенные anchors

| Объект | Exact anchor | Состояние при аудите |
| --- | --- | --- |
| Product main | `9edef94ece08012223c1364bec7ddcd561cf5713` | совпадает с Arena admission |
| Product #2338 | `b2ae614730b0c2e164d3b07453797074253d9698` | OPEN / Draft; все 28 non-skipped checks success, 4 autofix checks skipped; inline review/discussion отсутствуют |
| Research main | `75a70a504ba4cf409ef129bc4d8f9da37336ea11` | прочитан read-only GitHub tarball |
| Research #582 | `93d6f08a40c7989eb1f6362fd1667094742144d2` | OPEN / Draft, 5/5 checks success; изменён только исторический кандидат |
| G3 publication seal | `298d00ddc4db46522c8ad904016e98a4426c9fcf` | только `G3-PUB-001…016`, 21 source ID |
| Handoff bytes | SHA-256 `9b6dd9238d52b9420aa815e9b6c78cfc357c387f60fc58ad15d7face41a065a2` | байты seal и прочитанного Research main совпадают |

Проверены AGENTS / reference / OWNER-INVARIANTS / WORK_MODES / LANE_LOCK, route ownership/profiles, редакционная Хартия S1–S54, source/content/reference-transfer/media policies. В Research прочитаны AGENTS, AGENT_RULES, CURRENT_AUTHORITY, обе machine policies, SELF_PLAN_PROTOCOL, corpus README, ARTICLE_OUTLINE, CONFERENCE_HISTORY, SOURCE_LEDGER, CLAIMS_LEDGER, OPEN_QUESTIONS, immutable handoff и точный файл-кандидат #582.

Указанные зелёные GitHub checks относятся **только к baseline SHA**, не к этой локальной дельте.

## A. Подтверждённые недостатки baseline

Все ниже — `CONFIRMED-CURRENT` на `b2ae614730b0c2e164d3b07453797074253d9698`.

1. Hero вытесняет иллюстрацию: верх обложки y=722 при 1440 px, y=744 при 390 px; длинный курсивный лид конкурирует с заголовком. Авторство видно лишь в footer.
2. На 390 px навигация masthead обрезает названия рубрик горизонтальным скроллом; desktop rail повторяет хронологию, после начала чтения не даёт постоянного содержания. Некоторые history rail links ведут к началу общего раздела вместо нужного года.
3. У истории нет своей библиографии: прямые ссылки разбросаны по прозе, служебная Research-информация попала в читательский текст. У досье все 21 записи спрятаны в одном details, а видимые labels содержат машинные статусы.
4. История смешивает анонс, каталог записей и содержание выступления. Название сессии не доказывает пересказ всей проповеди. Ссылка AJC в 2023 названа репортажем, хотя источник в Research обозначен и как анонс. Майский листинг 2024 доказывает план, не проведение; текстовая расшифровка интервью Бьюса не является прослушанным аудио.
5. `g3History.css` исправляет собственную каскадную специфичность через `!important`; AVIF-варианты подготовлены, но не используются в picture. В baseline нет `article-header` / `author-card` hooks на G3.

Приложенного референса концепции №2 нет. Работа ведётся как native-contract refinement существующего navy/paper/gold направления, **не** как exact-replica.

## Research boundaries / предложение владельцу #582

Никакие сведения этой волны не являются новым Research handoff. Внешние исторические веб-страницы и аудио в этой сессии не объявляются непосредственно прочитанными/прослушанными: редактура опирается на **прочитанные точные Research записи**. Новых внешних URL ради количества не собирали (STOP_DISCOVERY).

Перед следующим handoff требуется:

- Сохранить `PUBLICATION_HOLD` всех `G3-HIST-PUB-01…09` и получить explicit authorization на конкретные формулировки, не на макет.
- В кандидате #582 нормализовать независимые оси **в самом Research**, без создания второго ledger в Product: встречающиеся `FULL_HTML_READ`, `SECTION_VERIFIED`, `TEXTUAL_CITATION_ONLY`, `PUBLICATION_HOLD` не являются enum values соответственно `accessState`, `locatorState`, `rightsState`, `publicationState` политики v2. Возможные enum values устанавливаются владельцем после проверки объектов; `PUBLICATION_HOLD` остаётся отдельным holds flag, а не заменой `BLOCKED`.
- `HIST-01` / `G3-HIST-PUB-01`: архивный объект объявления 10.08.2011 всё ещё нужен; HTTP 200 старого домена не подтверждает старый текст.
- `HIST-03…11`: год / имя / точное название каталожной записи сверить с acquired original или проверенным rehost; оригинальные старые G3 страницы сохраняют locator/archive ограничения. Не выдавать каталог за просмотр с аудио; не устанавливать полный ежегодный состав по выборке записей.
- `HIST-15/16`: интервью The Christian Worldview от 18.01.2025, эпизод `16458733`; нужен точный человечески проверенный аудиофрагмент о переезде и 2020-м. До этого год переезда не подаётся как независимо установленный.
- `HIST-17`: письменный пост Аниола 01.09.2021 подтверждает должность/намерения, не фактический выпуск всех продуктов к этой дате.
- `HIST-19`: история Dallas Statement атрибутируется составителю; Чаллис не подписал. Это не причинное доказательство кризисов.
- `HIST-20`: майская регистрация — план; октябрь — регистрация + свидетельство Питерса. Ранний анонс California не подменяет позднюю Oklahoma; причина смены площадки остаётся неизвестной.
- На Research main есть более поздняя юридическая/доменная дельта 15.11.2026, **не включённая в старый seal**. Не импортировать её в досье без нового handoff и correction decision. Корпоративное переименование не доказывает приобретателя активов.
- Комментарий соседнего storage-аудита #582 предупреждает о сроке Actions-артефактов 24.11.2026. Это сигнал владельцу custody lane, не факт потери и не разрешение этому Product lane менять хранение.

Ни один `EVIDENCE_HOLD`, `LOCATOR_HOLD`, `ARCHIVE_HOLD`, `RIGHTS_HOLD`, `PUBLICATION_HOLD` здесь не снимается. История остаётся source-only; публичный `/journal/dossiers/g3/history/` не создаётся и не входит в sitemap/RSS/search.

## B. Реализованная редакционная система

- `JournalArticleHeader` — общий presentation-only opening обеих статей: крупный заголовок, спокойный лид, авторство до основного чтения, периоды и даты только из входных данных, responsive picture и подпись. SEO остаётся в существующем head, не дублируется в компоненте.
- `JournalContents` — **одно** нативное `details/nav`: desktop rail, компактное мобильное содержание, Escape, закрытие после перехода и перенос фокуса к реальной цели. Без второго меню, scrollspy, history router или библиотеки.
- `JournalDataFigure` — SSR-сравнение трёх закреплённых изменений FY2022→FY2023: **1 061 800 / 817 283 / 246 511** долларов. Полосы независимы; подпись прямо запрещает воспринимать их как состав суммы или внешний аудиторский вывод. Числа остаются текстом, полосы декоративны, клиентского runtime нет.
- Лендинг использует канонический заголовок досье, одну реальную ведущую историю и редакционные принципы, а не пустые новостные карточки. Его ссылки не обещают неопубликованную историческую статью.
- Светлая и тёмная палитры оформлены одинаково полно. Контент ограничен читаемой мерой; мобильные таймлайны складываются в одну колонку, меню переносится вместо обрезания горизонтальным скроллом. `!important` в локальных слоях нет.
- Masthead — адаптер существующих `GBReaderPreferences` / `GBSearchBootstrap`: без второго хранилища темы, загрузчика или поисковой палитры. Ctrl/⌘+K делегируется bootstrap, а место постепенно включаемой кнопки темы зарезервировано до её появления. Accessible name логотипа берётся из видимого текста.
- Использованы только подготовленные 640/1200 AVIF/WebP и существующее OG-изображение; новых изображений, шрифтов и rights clearance нет. Обложка явно названа редакционной иллюстрацией, не архивной фотографией.
- `JournalFontPreloads` содержит четыре resource hint на **уже используемые** WOFF2 (49 004 байта суммарно); определения остаются в `fonts/fonts.css`. Подключён один раз в существующий head и отдельно в QA fixture. Подсказки устраняют подтверждённую гонку загрузки шрифта/переноса дат, не меняют сами шрифты, SEO, CSP или даты. Никаких shared font/CSS/SW edits.

## C. Содержание и исправленные дефекты итераций

**Досье:** сохранены byte-identical четыре data authority owners, 16 разрешённых claim IDs и 21 source object. Контракт сравнивает все **37 фактических абзацев** десяти модулей, включая timeline и интерполированные финансовые числа, с `b2ae6147…`: допускается только пробельное форматирование. Переведены два английских UI-заголовка, исправлены пробелы у inline-тегов. Все 21 библиографические записи видимы; технические локаторы раскрываются адресно, не прячут заголовок-цель внутри общего закрытого списка. Исходные evidence class / eligibility сохранены в атрибутах, но не превращены в читательские «вердикты».

**История:** самостоятельная source-only рукопись 2013–2024 с 20 кандидатными ссылками, библиографией, годичными якорями и явным статусом. Сняты недоказанные обобщения содержания проповедей по названиям каталога. Каталог, приглашение, объявленный план, свидетельство участника и независимо подтверждённый факт не отождествляются. Состав 2023 года не приписывается одной ссылке AJC; переезд не датируется непрослушанной расшифровкой; обзор Sharper Iron не получает неподтверждённую дату; запуск G3+ не переносится задним числом в 2013–2024. Аниол 2021 — должность и планы; май 2024 — план мероприятия; октябрь — страница мероприятия и собственный отчёт Питерса, чей отчётный год не подменяет дату публикации. Причина смены площадки неизвестна. Оценка чтения — около 1 350 слов / 200 слов в минуту = **7 минут**, без справочного приложения; это draft estimate, не публикационные метаданные.

Подтверждённые дефекты собственных промежуточных версий исправлены, не объявлены ложными только ради зелёного теста:

| Находка | Исправление / свидетель |
| --- | --- |
| Холодный Ctrl+K не открывал Journal search | once-bound адаптер к существующему bootstrap; cold Ctrl+K, Meta+K, click/query/arrows/Escape и единственность палитры проверены |
| History reflow 200%: потомки выходили до x≈419 при viewport 390, хотя document overflow был 0 | mobile grid `minmax(0, 1fr)`; проверяются видимые потомки, а не только корневой scrollWidth |
| Старый anchor witness игнорировал общий html scroll-padding 72px | проверяется реальная сумма shared padding + local margin, допуск 2px и безопасная видимая позиция; shared CSS не менялся |
| PDF оставлял рубрики без заголовков, скрывал HOLD-предупреждение; финальная визуальная полоса обнаружила разрыв штампа 2013 на две строки | локальные print break rules; предупреждение сохранено на первой странице; для цифровых лет — nowrap и безопасный paper size, плюс проверка однострочности всех штампов в print witness |
| axe incomplete: aria-label на новом div без роли | метаданные получили `role=group`; все 48 статических поверхностей теперь требуют **0 violations и 0 incomplete** |
| Cold-load shift собственной версии досье: локальный CLS около 0,29 | изолированные эксперименты установили font-swap/root cause; предзагрузка существующих кириллических шрифтов и латинских цифр UI, резерв кнопки; максимальный CLS публичных поверхностей в полном прогоне ниже 0,05 при бюджете 0,1 |

В общей search-палитре axe 4.11 оставляет `controlsWithinPopup` review item (`aria-controls=cp-listbox`), **не нарушение и не скрытое исключение**. Raw finding сохранён; отдельно проверены уникальность ID, видимый listbox, вложенный активный option с `aria-selected=true`, а также ArrowDown/ArrowUp. Другие incomplete findings не допускаются. Shared search owner не менялся. Это не сертификация всей WCAG и не screen-reader signoff.

## D. Локальная проверка и реальные before/after

Исходники после тестов фиксируются без технических мутаций; точный локальный SHA и соответствие проверенным source hashes отражаются в итоговом сообщении и ignored `commit-attestation.json`. Ни один старый GitHub check не переносится на этот SHA. Крупные PNG/PDF, логи и зависимости QA не включаются в Git.

| Проверка | Фактический результат |
| --- | --- |
| `astro:check` | **667 файлов, 0 errors / 0 warnings / 7 существующих hints** |
| `strangler:build:production-like` | **PASS**, 112 страниц; canonical asset/CSP/editorial/reader/sitemap flow без дрейфа |
| `pagefind:build:dist` | **PASS**, 103 страницы, русский индекс; рукопись не индексируется |
| `journal-editorial-contract.mjs` | **PASS**, 37 абзацев / 16 claims / 21 source, четыре неизменённых authority owners, history HOLD, две built SEO/DOM поверхности, четыре уникальных существующих font hints |
| Chromium 153.0.8010.0 + axe 4.11 | **48 сочетаний**, три поверхности × 320/360/390/430/768/1024/1440/1920 × light/dark; raw report — 0 problems; отдельный контрольный прогон 12 сочетаний — exit 0 |
| Keyboard / preferences | skip link, native TOC, фокус/якоря/Escape, поиск click/холодный Ctrl+K/Meta+K/стрелки/Escape, сохранение темы и cross-tab — PASS |
| Reflow / no-JS / print | root text 200% + reader scale 1,4 без видимого overflow; чтение и якоря без JS; print chrome exclusion / source disclosure / видимый history HOLD — PASS |
| Local performance | на публичных 32 responsive cases начальный CLS ≤0,1 (наблюдаемый максимум <0,05); LCP/transfer записаны только как **локальная лаборатория**, не field CWV |
| Strict native runtime | 112 strict-native + 1 intentional built-app shadow; обе Journal routes strict-native |
| Dist JSON-LD / SEO | 117 HTML / 120 JSON-LD; 112 production routes; 0 errors / 0 warnings |
| Rich results | PASS; **22 существующих предупреждения** об отсутствии изображения в другой серии «Сердце», не скрыты и не исправлялись этим lane |
| Search / RSS / sitemap | strict search 112/112/0; RSS 81 canonical items / 0 warnings, feed byte-exact; sitemap 103 indexable routes + image contracts PASS |
| Tokens / metadata / dist ownership | соответствующие адресные strict checks PASS |
| Scripture index | canonical regeneration меняет **только** `stats.scannedSourceFiles` 545→549; все ссылки, occurrences и остальные поля идентичны; `--check` PASS |
| Development-only review gate | `NODE_ENV=production node scripts/journal-local-review.mjs` корректно отвергается; обычный review HTTP 200, noindex/nofollow/noarchive + no-store |

Существующие build/CI/security gates не отключались. Неблокирующее Node предупреждение `MODULE_TYPELESS_PACKAGE_JSON` не устранялось сменой package type. Одна read-only попытка сравнить большой JSON упёрлась в стандартный `execFileSync` buffer; повтор с достаточным `maxBuffer` подтвердил единственную механическую разницу. Полный browser JSON и логи хранят результаты даже промежуточных неудачных попыток; финальный процесс проверяется с явной печатью его exit code.

### Before → after

| Поверхность | До | После |
| --- | --- | --- |
| Досье, desktop 1440 | верх иллюстрации около y=722; авторство только внизу | иллюстрация y=224 рядом с заголовком; авторство до чтения, постоянное содержание |
| Досье, mobile 390 | иллюстрация около y=744; обрезаемая рубричная навигация | иллюстрация y=626; переносимое меню, спокойный лид, нативное содержание, читаемые источники |
| История | длинный заголовок, разрозненные внешние ссылки, служебные статусы среди прозы | отдельная композиция и библиография; предупреждение о неопубликованной рукописи; точные годичные цели |
| Финансы | лишь число в прозе | доступное сравнение без выдуманной «структуры суммы»; те же закреплённые значения |

Реальные файлы находятся в `reports/g3-editorial-local-20261118/`:

- `before/` — 12 baseline PNG (390/1440, три поверхности, обе темы).
- `after/` — полный responsive набор + body/sources/search и finance detail; например `dossier-1440-light.png`, `dossier-390-dark.png`, `history-1440-dark.png`, `history-390-light.png`.
- `browser-chromium.json`, `contract.json` — raw acceptance и source hashes; `layout-stability-experiment.json` / `font-subset-experiment.json` — отдельные эксперименты, не основной final witness.
- `journal-print.pdf` / `dossier-print.pdf` / `history-print.pdf` — 2 / 17 / 15 страниц; первая страница рукописи явно маркирована «Не опубликовано». Выборочные страницы визуально отрендерены через PyMuPDF в `print-final/`; отсутствие пустых текстовых страниц проверено. **Не каждый PNG и не каждая страница PDF просмотрены вручную.** Печатная библиография остаётся длинной; отдельная последняя страница footer рукописи — известная неоптимальность, не потеря текста.
- `index.html` — локальный навигатор скриншотов/сравнений; это evidence viewer, не deployment Journal.

До закрытия локальной волны осмотрены реальные top/body/source/finance screenshots в диапазоне 320–1920, обе темы, старые history before и финальные обложки/печатные страницы. Цветовые/типографические решения — предложение на визуальную приёмку владельца, не вывод из зелёного build.

### Воспроизведение

Нужны Node не ниже repository minimum 22.23.4, установленный Playwright browser и явный путь к axe-core; package manifests/locks не менялись.

```sh
npm run astro:check
npm run strangler:build:production-like
npm run pagefind:build:dist
node scripts/journal-editorial-contract.mjs
node scripts/build-scripture-occurrence-index.mjs --check
# Отдельные процессы: static artifact server на 0.0.0.0:4173 и dev-only review:
node scripts/journal-local-review.mjs
# Затем, с существующим axe и при необходимости JOURNAL_CHROMIUM_EXECUTABLE:
node scripts/journal-editorial-browser.mjs --origin=http://localhost:4173 --history-origin=http://localhost:4321 --axe=/path/to/axe.min.js
```

Для настоящих альтернативных движков предусмотрены `--browser=firefox` / `--browser=webkit`; Chromium device emulation их не заменяет. Локальные серверы отдают relative browser URLs, review не входит в production routing.

## E. Неполнота, интеграция и следующая содержательная работа

### Не сделано / не выдано за PASS

1. **Firefox / WebKit — 0 проверенных случаев:** Playwright downloads завершились TLS `ECONNRESET`; бинарников нет. Логи `.cache/g3-audit/{firefox,webkit}-install.log`. Полная трёхдвижковая приёмка остаётся открытой.
2. Нет приложенной концепции GPT Image №2, поэтому exact visual match не оценивался. Нет владельческой художественной приёмки, физических устройств, browser-UI zoom или screen-reader сессии; root-text enlargement не назван их заменой.
3. Нет production/live-byte/CWV verification, push, remote PR mutation, merge или deploy. Эти локальные проверки не характеризуют опубликованный сайт.
4. История остаётся **PUBLICATION_HOLD**; ни новый Research handoff, ни rights clearance не выданы. Никаких утверждений о прослушивании аудио, контексте полной проповеди или новом Research приобретении.
5. Print output читабелен и содержит HOLD/источники, но не является компактной газетной PDF-версией. Библиография длинная; предпринята не полная пополосная художественная вычитка.

### Обнаруженное параллельное пересечение — read-only, не интегрировано

Канонический Product #2338 по последней проверке остаётся OPEN/Draft на `b2ae614730b0c2e164d3b07453797074253d9698`; Research #582 — OPEN/Draft на `93d6f08a40c7989eb1f6362fd1667094742144d2`. Во время этой локальной волны соседние предложения продолжили развиваться:

| PR | Последний прочитанный HEAD | Пересечение / disposition |
| --- | --- | --- |
| #2339 | `0b9576278d2ec5ea89da804934823d460720501a` | Journal content/masthead/CSS/head + отдельная расширенная shared font/SW волна; **не импортирована**, её SYSTEM scope не присваивается этому lane |
| #2340 | `a7ac603b13f12dcde6b76b5dc386f62d3b27dd4a` | та же исходная presentation поверхность, `JournalContents`, contract filename и derived counter; не копировать компоненты/тесты вслепую |
| #2341 | `9793a2818d82a4c719f4a7cb4218820c4e742797` | альтернативные dossier/history/CSS/series/scrollspy; не соединять два navigation owners |
| #2342 | `4efc032405069c7e985cf2781b8efdcc4cd41244` | заявленный соседним автором синтез; тот же body/masthead/head/CSS и обязательные даты head; не объявлен интегрированным в #2338 |

Ни одна из этих веток, PR или Research здесь не изменена. Это **локальное предложение**, не пятый удалённый PR и не takeover writer lease. Владелец canonical lane должен выбрать композицию и вручную согласовать пересечения. Полезные переносимые решения этой волны: фактический prose/authority witness; несуммируемая finance figure; no-hidden-source-target библиография; исправленный reflow; честные candidate-only формулировки истории; cold-search/axe-review/performance/print witnesses. Head font hints можно перенести отдельной двухстрочной интеграцией, не затирая соседнюю защиту обязательных publication dates. После интеграции — новый exact-head build/browser/SEO pass; старый локальный PASS не переносится автоматически.

Следующая работа не заключается в новом декоративном слое: (а) выбрать и свести presentation proposal в #2338 без двойных handlers; (б) выполнить Firefox/WebKit и владельческую визуальную приёмку; (в) владельцу Research закрыть конкретные original-object/locator/audio/context вопросы выше, нормализовать независимые оси кандидата и выдать **новый подписанный history handoff** с разрешёнными формулировками. До этого не создавать public route истории, не снимать PROD guards и не активировать её в RSS/sitemap/search.

## F. Агент 8 — разрешённый push и граница мультиагентного предложения

Новая команда владельца «ПРОДОЛЖАЙ и пуш» отменяет прежний local-only запрет **только для отправки своей ветки**. По поручению владельца этот вариант обозначен как **Агент 8**. Имя Arena-ветки фиксировано; менять его нельзя. Прежние записи «нет push / remote mutation» выше описывают завершённую локальную фазу, а не текущий запрет отправки.

- **Mode / owner:** LANE, Агент 8, Arena session `7f634191`. Это изолированное предложение владельцу canonical Product #2338, не takeover его lane или writer lease.
- **Единственная ветка отправки:** [`arena/7f634191-gb-is-my-strength`](https://github.com/FedorMilovanov/gb-is-my-strength/tree/arena/7f634191-gb-is-my-strength), обычный push без force. При несовместимом remote HEAD — остановиться, а не перезаписывать его.
- **Base / rollback:** main `9edef94ece08012223c1364bec7ddcd561cf5713`; presentation baseline / integration base `b2ae614730b0c2e164d3b07453797074253d9698`. Перед отправкой обе remote refs повторно прочитаны и не изменились; своей remote-ветки на момент preflight нет.
- **Bounded scope / SSOT:** неизменны относительно Lane / authority выше. В продолжении изменён **только этот handoff** для имени агента, нового разрешения и координации; product source, QA scripts, immutable authority и generated data не изменялись.
- **Проверенный технический HEAD:** `ad28a2688bcc20d0a1abac3a502bbf3f7fb7cd68`; implementation `fce77f398743318d06520645fe7a5e8461753c09` + print fix `ad28a2688…`. На точном ad28 выполнены build → Pagefind → contract → Chromium с явными exit 0; 48 cases / 0 problems. После возобновления все 23 tested source hashes совпали с диском. Маркерный docs-only коммит не выдаётся за новый browser/build run: проверяются его единственный изменённый путь, ссылки, `git diff --check` и соответствие technical bytes исходному свидетелю.
- **Adjacent overlap refresh:** #2338 остаётся `b2ae614730b0c2e164d3b07453797074253d9698`; #2339 — `0b9576278d2ec5ea89da804934823d460720501a`; #2340 продвинулся до `dceed04b4fa42bfff16891759b730118f933f645`; #2341 — до `505ea4e0952e97b542378fef9e038fe0f15e0bc1`; #2342 — `4efc032405069c7e985cf2781b8efdcc4cd41244`. Новые комментарии/heads прочитаны; чужие реализации не импортированы и не объявлены совместимыми. Сохраняются cautions о date safeguard, shared font/SW scope и едином navigation owner.
- **Remote coordination:** один комментарий от Агента 8 в #2338 с exact pushed HEAD и integration base; не переименовывать канонический PR в «Агент 8». **Новый PR не создаётся**, чужие PR descriptions и refs не редактируются. Выбор и интеграция остаются у владельца #2338; не сливать унаследованную ветку напрямую в main.
- **Research / publication:** #582 повторно прочитан: OPEN/Draft, `93d6f08a40c7989eb1f6362fd1667094742144d2`. Research не записывается. Сохраняются 16 разрешённых кризисных claims / 21 source и **PUBLICATION_HOLD** истории; push кода не является handoff, merge, deploy, выдачей прав или публикацией статьи.
- **Открытая приёмка:** Firefox / WebKit (0 cases), owner visual signoff, physical-device / screen-reader / настоящий browser-UI zoom и production verification. На docs-only HEAD не переносятся старые GitHub checks. Крупные скриншоты/PDF, raw JSON, логи и локальные зависимости остаются ignored, не отправляются в Git.

Окончательное доказательство отправки — совпадение remote ref с локальным HEAD и ссылка на координационный комментарий. Оно сообщается после ответа GitHub, не подменяется намерением выполнить push.

## G. Агент 8 — контекстный возврат из библиографии

- **Mode / owner:** LANE, Агент 8 / `7f634191`, продолжение только собственного изолированного варианта по новой команде владельца. Base / rollback этой волны: `8a8dced5b6571730c164d3df2312962b143ac90e`; main и canonical base неизменны.
- **CONFIRMED-CURRENT:** на точном 8a8d, 390/1440 px × light/dark, у источника IRS досье нет обратной ссылки; источник Чаллиса после перехода из `#g3-growth` возвращает к `#g3-history`, а не к месту чтения. Исходный probe и screenshots сохраняются отдельно в `reports/g3-editorial-local-20261118/citation-navigation/`.
- **Bounded scope:** устойчивые SSR ID уже существующих сносок в двух статьях; один route-local переиспользуемый компонент возврата; их же scoped CSS, source/browser QA и этот handoff. Canonical Scripture regeneration допускает только необходимый derived source-file count. Текст фактов, URL/классы источников, metadata dates, shared runtime/layouts/CSS, route/search policy и Research вне scope.
- **Design / SSOT:** существующие ссылки сносок и библиографические объекты, не новый evidence ledger. Нативные anchors владеют URL/scroll/focus; небольшой DOM-adapter меняет только обратную ссылку конкретного источника на последнюю открытую сноску. No-JS/direct-source-entry имеют правдивый SSR fallback к методике/связанному разделу. Нет scroll router, нового storage, запрета Back/modified-click или скрытых source targets. Navigation-only ссылки не засоряют print.
- **Overlap:** #2338 по-прежнему b2ae; #2340 dceed / #2341 505ea / #2342 054a / новый #2343 fd108 прочитаны как активные альтернативы. Их source/navigation owners не импортируются. Эта ветка не продолжает чужой lane; новый PR, merge/deploy и снятие HOLD не разрешены.
- **Required checks:** исходный отрицательный контроль; 37-paragraph / 16-claim / 21-source / four-authority preservation; Astro check, production-like build + canonical asset flow / Pagefind; responsive Chromium/axe + keyboard/pointer/repeated-source round trips, fragment focus, Back/Forward, direct-entry/reload, no-JS, print и runtime; targeted SEO/search/feed/sitemap/Scripture. Новые raw results хранятся отдельно от §D, старый PASS не переносится. Firefox/WebKit без доступных бинарников не считаются выполненными.

### Реализация и проверка продолжения

`JournalSourceReturn` даёт одинаковый механизм обеим статьям: **11 + 26 существующих сносок** получили устойчивые SSR ID; каждый из 21 + 20 источников имеет ровно одну обратную ссылку. DOM-adapter читает реальные связи `href`, не заводит второй citation/evidence registry. Он обновляет только ссылку выбранного источника, не перехватывает native navigation и не записывает storage. Повторное обращение к одному источнику возвращает к последней сноске именно этого чтения; новая вкладка / reload используют честный fallback, не чужой старый контекст. Ctrl/Meta/Shift/Alt и средняя кнопка не меняют возврат текущей вкладки. Нативные Back/Forward и скопированные citation URLs работают без нового router.

Пункт назначения выделяется без изменения layout, фокус возвращается к самой ссылке. В production досье adapter минифицирован до **946 байт** (530 gzip), встроен canonical asset/CSP flow **один раз**, не по числу источников; отдельного нового запроса нет. На лендинге его нет. Navigation-only ссылки имеют `data-pagefind-ignore` и скрыты в print; сами документы и библиография остаются.

Расширенная no-JS проверка подтвердила собственный прежний дефект: раскрытый мобильный TOC перекрывал source links. Теперь rail по умолчанию в normal flow; sticky включается лишь после binding существующего TOC adapter (`:has([data-journal-contents-bound])`). С отключённым JS все переходы мышью проходят без `force` / ручного закрытия меню. Ни shared mobile chrome, ни `JournalContents` runtime не переписаны.

В no-store development fixture повторная загрузка вызывала четыре unused-font-preload warnings при уже отрисованных font faces. Изолированные probes (`font-*.json`) не подтвердили исправление искусственными задержками / foreground переключением. Поэтому **только QA fixture** использует обычную CSS-загрузку тех же шрифтов; оба production head сохраняют четыре исходных hints и прежний CLS budget. Правила runtime/axe не ослаблялись. Ранний отдельный декоративный символ также давал axe incomplete и удалён, а не внесён в allowlist.

Предкоммитный acceptance: **Chromium 153, 48 cases / 0 problems, process exit 0**; 32 основных + 8 повторных source round trips, keyboard/pointer/focus/offset/Back/Forward/bookmark/reload/direct-entry/modified-click/no-JS/print checks. Статические и targeted-source axe — 0 violations / 0 incomplete; прежний shared-search manual-review остаётся видимым. Public local CLS max **0.048672179017345746**; не field CWV. Все 37 фактических абзацев / 16 claims / 21 authority sources сохранены, четыре authority owners и history bibliography data не менялись. Canonical Scripture delta — **только** 549→550 scanned source files; 1372 references / 3511 occurrences / 103 routes прежние.

Новый evidence namespace — `reports/g3-editorial-local-20261118/citation-navigation/`: exact baseline `baseline-probe.json`, стабильные `before/`, отдельные неудачные `preflight` / `iteration-*`, предкоммитный `acceptance/`, затем **`final/` и `commit-attestation.json` для нового committed HEAD**. Production-like build / typecheck / Pagefind / все 48 cases и applicable audits повторяются после commit; их исход не подменяется предкоммитным PASS. 24 source hashes и actual subprocess exits позволяют проверить соответствие итогов коммиту. Старые свидетельства §D/F не переименовываются.

В acceptance PDF — 2 / 17 / 14 страниц, без пустых текстовых страниц; история сохраняет «Не опубликовано», screen-only возвратов на бумаге нет. Выбранные source/return screenshots 390/1440 в обеих темах и первые/последние PDF полосы просмотрены. Длинная печатная библиография / остаточная отдельная финальная полоса истории — прежняя pagination limitation, не полная художественная PDF-приёмка. Firefox/WebKit, физические устройства, screen reader, owner visual signoff и production witness по-прежнему не заявлены. Новых фактов, listening/rights/handoff или разрешения публикации истории нет.

Завершённая волна §G: exact committed HEAD `9e77d9d3fcd86ce8c6cb62a7b0aa2e0b5b05d258`, clean tree, production-like build / Pagefind / contract / Chromium 48 cases / 14 targeted commands — actual exits 0. Все 24 source hashes сверены с committed bytes. Обычный push только своей ветки выполнен; remote ref совпал. GitHub checks на этом SHA на момент проверки — 0, не прежний CI canonical. Новый viewer — `reports/g3-editorial-local-20261118/citation-navigation/index.html`; исторические отчёты сохранены отдельно.

## H. Агент 8 — доступное оглавление в невысоком окне

- **Mode / owner:** LANE, Агент 8 / `7f634191`, продолжение своего изолированного предложения; не takeover canonical #2338. Base / rollback этой волны: `9e77d9d3fcd86ce8c6cb62a7b0aa2e0b5b05d258`. Main `9edef94ece08012223c1364bec7ddcd561cf5713` и canonical `b2ae614730b0c2e164d3b07453797074253d9698` повторно прочитаны и неизменны.
- **CONFIRMED-CURRENT:** на точном 9e77, Chromium / 1440×480 / обе темы, rail досье занимает y=30…626, последний пункт — y=477…515. Wheel над rail прокручивает статью, а не оглавление; keyboard focus тоже оставляет ссылку за нижним краем окна. `short-viewport/baseline-probe.json` сохраняет геометрию до / после wheel / focus и четыре исходных PNG. У истории при этой высоте ссылки ещё помещаются, но пояснение ниже rail уже обрезано; это не объявлено тем же дефектом скрытой последней ссылки.
- **Bounded scope:** только desktop-screen overflow/viewport constraints существующего `.je-editorial-rail` в `journalEditorial.css`, регрессии в собственном `scripts/journal-editorial-browser.mjs` и этот handoff. Нет второго TOC, JS scroll handler, нового runtime/asset/source owner или source-file-count delta.
- **SSOT / design:** существующие `JournalContents` / `JournalEditorialRail`, нативные focus, anchors и scrolling. Высокое окно не получает обязательной полосы прокрутки; в низком все ссылки и пояснение должны быть достижимы внутри rail, не смещая основное чтение. Focus outline не должен обрезаться. Mobile disclosure, no-JS normal flow и print остаются у прежних правил.
- **Adjacent overlap:** metadata #2345 `0b021c355170957596ee4669a6ef6bb2ddd7bcc3`, QA #2344 `d17e9d500908195380800cb731d2c2fbaafc6690`, альтернативы #2342 `6c75b514177970f4767543f9c151f0c326ee2f8a` / #2343 `73bc8a1964fe7100ba1a829e6910d93338fc7c66` и обсуждение #2338 прочитаны read-only. Их реализации / даты / control handlers не импортируются; один navigation owner, без нового PR или записи в чужие refs. Research #582 остаётся `93d6f08a40c7989eb1f6362fd1667094742144d2`, без записи.
- **Required checks:** отрицательный контроль на baseline; short-window matrix 1024/1440/1920 × 390/480/600 × light/dark × JS/no-JS для двух статей; реальные wheel и Tab, видимость focus outline, нативный переход/фокус и resize к mobile/tall. Затем прежние 48 responsive cases / axe / source-return regressions, source/publication contract, production-like build с canonical asset flow, Pagefind и applicable targeted audits на финальных байтах. Недоступные движки не засчитываются.
- **Вне этой дельты:** подтверждённый orphan `.je-next-story` в history A4 (label на 13-й полосе, ссылка на 14-й) сохранён в `print-integrity/before/`, но не смешивается с overflow repair. Route-owned metadata safeguard остаётся отдельным #2345; shared mobile-search focus defect — отдельный SYSTEM owner. Никаких фактов, metadata dates, media rights, Research-handoff, publication/route/search/feed/sitemap authority или shared CSS/JS изменений. История остаётся **PUBLICATION_HOLD**.

### Реализация и честная последовательность проверки

Весь product diff этой волны — один **desktop-screen-only** media block: native `overflow-y: auto` + ограничение высоты rail. Локальные 8px padding с отрицательным inline margin сохраняют прежнюю ширину содержимого и целиком вмещают 7px focus outline. На обычном высоком окне scroll range не нужен; колёсико по-прежнему прокручивает статью. Нет `overscroll-behavior: contain`, scroll trap, нового listener, storage, зависимости, asset request или скрытого native anchor. Mobile и print не получают этот media block.

Первая CSS-итерация с прежними 30px inset прошла production-like build / Pagefind / contract, но **не прошла** новый keyboard witness: focus сдвигал основное чтение на десятки пикселей. Read-only probe установил причину: действующий shared `html` имеет **72px scroll-padding с обеих сторон**, а не 30px. Исправление согласует только локальный rail с этим существующим clearance (включая bottom safe-area), не переписывает глобальные правила и не перехватывает `focusin`. Регрессия читает фактический root padding, проверяет wheel / все Tab и Shift+Tab / полный outline / неизменность reading `scrollY`, затем обычный pointer переход к последнему разделу. Таким образом, будущий drift scroll clearance не останется ложным PASS.

`short-viewport/negative-control/` сохраняет **8/8 ожидаемых failures / actual exit 1** на исходном product CSS 9e77 (новый test script и handoff ещё working-tree). `iteration-1/` — build actual exits 0, но 8 keyboard failures / actual exit 1, не acceptance. `iteration-2-dev/` после 72px correction — **8 cases / 0 problems / actual exit 0**, включая native no-JS Tab и resize 1440×480 → 844×390 → 1440×1080. Это development smoke, не production witness. Выбранные light/dark low-window и landscape PNG открыты и просмотрены. Отдельный diagnostic style-injection probe с отключёнными скриптами завис и был остановлен; он не дал результата и не засчитан как проверка.

Дополнительный development edge-preflight (1024/1920 × 390/600) дал 28 PASS и 4 harness failures: при Shift+Tab Chromium оставляет прокрученными 2px верхней границы disclosure. Summary и полный outline при этом видимы, чтение неподвижно (PNG открыт). Произвольное требование `scrollTop === 0` заменено **не допуском погрешности**, а теми же более содержательными assertions полного focus outline / native focus / неизменного article `scrollY`, которые действуют для каждой ссылки; фактический scrollTop остаётся в raw JSON. Этот failed preflight сохранён отдельно. Research main продвинулся до `6759dadc40b321be44079a5f6b015f22a0c2dbca` с несвязанным Charnock merge: актуальные AGENTS / AGENT_RULES / CURRENT_AUTHORITY / machine registry / evidence policy и immutable G3 handoff повторно получены read-only и byte-identical уже прочитанным.

Финальная проверка выполняется **после recoverable commit**, на чистом точном HEAD: canonical build/typecheck/postbuild → Pagefind → source/publication contract → прежние 48 responsive cases + новые 72 short-window cases и applicable targeted audits. Выходы subprocess и все 24 source hashes записываются в отдельный `short-viewport/final/` / `commit-attestation.json`; промежуточные отчёты не переименовываются. Print проверяется на сохранение текста/геометрии предыдущих PDF, не объявляется исправленным. No-JS цвета не называются отдельной поддержкой темы: без shared script сохраняется прежняя SSR paper palette, browser preference и фактический `--je-paper` записаны раздельно. Firefox/WebKit без доступных executables, owner art signoff, physical device / screen reader / реальный UI zoom и production по-прежнему не заявлены.


Завершённая §H: exact tested / pushed HEAD `fcd4a46e512be181672ce82102aefdc2c91129bb`, clean tree; production-like build / Pagefind / contract / 14 targeted commands — actual exits 0. Chromium 48 responsive + 72 short-window cases / 0 problems; ещё 16 cases с видимым 15px scrollbar gutter / 184 keyboard steps / 0 problems. Все 24 source hashes совпали с committed bytes. Candidate patch plan / visual TOC-finance-hero review — `short-viewport/`; собственный единый координационный комментарий #2338 обновлён с сохранением исторического среза. Main/canonical/Research не записаны; owner visual signoff не объявлен.

## I. Агент 8 — цельный переход к следующей статье на бумаге

- **Mode / owner:** LANE, Агент 8 / `7f634191`, продолжение только собственного предложения. Base / rollback `fcd4a46e512be181672ce82102aefdc2c91129bb`; main `9edef94ece08012223c1364bec7ddcd561cf5713`, canonical #2338 `b2ae614730b0c2e164d3b07453797074253d9698` повторно проверены и неизменны.
- **CONFIRMED-CURRENT:** на чистом exact fcd4 заново получены 24 PDF (3 поверхности × A4/Letter × light/dark browser preference × JS/no-JS). Во всех **8 history cases** label «Документальное досье · 2025–2026» находится на странице 13, полный target title — на 14. Source titles не пропали, но связанный companion block разорван. A4 13/14 и Letter 13 открыты визуально. Root cause: существующий `.je-next-story` не входит в print `break-inside` rule; не размер шрифта или источник данных.
- **Bounded scope:** только добавление companion к имеющемуся route-local print cohesion rule в `journalEditorial.css`; адресный print suite существующего `scripts/journal-editorial-browser.mjs` и его reusable PDF-analysis helper под `scripts/lib/`; этот единый handoff. Без изменений article prose/markup, dates, source URLs/data owners, screen/mobile/TOC rules, shared fonts/runtime/CSS, package/CI, route/search/feed/sitemap policy или Research.
- **SSOT / design:** существующие `.je-next-story > p` и ссылка, текущая print typography / bibliography / unpublished warning. Нативная CSS fragmentation, не beforeprint/afterprint JS. Цель — label + весь title на одной странице, **не** заданное число страниц и не уменьшение шрифта / отступов ради счётчика.
- **Overlap:** актуальные #2339 `798b85f29dbfbfa9a33fd74feda1c130043bc6f5`, #2340 `a682d395930de16f950a0bbe7ba2f5e2cc3dd2d4`, #2341 `d70b33c77dc8e6cf49d935e845f3ea8352678acf`, #2343 `cbe3ebea1a79d1ffb44338bd3b54f6e9e0a05a44`, #2344 `259074909f0d1a35aca255adbb12bd40e99b3044`, #2345 `eb8ffc5a43c7923bf3bca75d934b0e767f028d2d` metadata/file lists и новое адресное owner review в #2338 прочитаны. Ничего не импортируется; canonical не продолжается этой веткой. Metadata #2345 / shared-search SYSTEM остаются отдельными owners.
- **Research:** main `6759dadc40b321be44079a5f6b015f22a0c2dbca`, #582 `93d6f08a40c7989eb1f6362fd1667094742144d2` неизменны с предыдущего чтения; текущие AGENTS/AGENT_RULES/CURRENT_AUTHORITY перечитаны из exact-byte snapshot. Никаких новых handoff / listening / rights / publication claims. История **PUBLICATION_HOLD**, оба production throws и отсутствие public route/discovery сохраняются.
- **Required checks:** actual-PDF отрицательный контроль; 24-case print matrix с physical page size / nonempty text / all source titles / full-label-title co-location / HOLD-first-page / screen-controls omission; before→after normalized full text и per-character font/style preservation; screen-only source bytes + реальные screenshots/keyboard/source-return regression; source/publication contract, production-like build и canonical asset flow / Pagefind / applicable targeted audits на финальном committed HEAD. Firefox/WebKit без executables не засчитываются.
- **Evidence:** отдельный namespace `reports/g3-editorial-local-20261118/print-continuity/`; чистый baseline `before/capture.json`, все 24 исходных PDF, `before/pagination.json` и реальные PNG. Вспомогательный read-only analyzer сначала использовал отсутствующее в PyMuPDF `Rect.size`; исправлен на width/height без повторного получения PDF. Это ошибка helper, не product finding. Failed negative controls / iterations сохраняются отдельно от `final/`.

### Реализация, отрицательный контроль и границы результата

В product CSS добавлен **только `.je-next-story` в существующий print `break-inside: avoid` selector**. Screen/mobile/short-viewport и все font sizes остаются прежними. Нет нового print JS, markup, искусственного page-break, скрытия source text или зависимости в package. Нативный движок переносит целиком только небольшой companion block; сам эпилог не принуждается к новой полосе.

Адресный `--suite=print` и full Chromium suite заново получают A4/Letter в fresh contexts (light/dark preference × scripting on/off). `scripts/lib/journal-print-pdf.py` читает **реальные PDF** через явно требуемый PyMuPDF; отсутствие среды — ошибка, не skip. `--pdf-python` выбирает executable, обычный `PYTHONPATH` — установленную среду; пакет автоматически не устанавливается. `--print-baseline=<before/capture.json>` дополнительно проверяет сохранение всего normalised текста и каждого не-пробельного символа с font/size/flags/color, а на двух незатронутых public surfaces — прежнюю геометрию текстовых glyphs. Поиск полного label/title на ровно одной общей странице не заменён проверкой одного CSS property. Проверяются paper size, отсутствие пустых текстовых полос, все source titles, H1 и полный unpublished warning на первой полосе, literal HOLD, отсутствие в PDF skip/source-return navigation text. Число страниц истории не зафиксировано как gate.

Первый browser helper неверно потребовал `display:none` от **shared off-canvas skip link вне `.journal-edition`**. Это не product defect: в исходных PDF ссылка не печатается. `negative-control-capture-initial/` сохраняет эти harness failures. Исправлен только witness: для существующих route-local controls остаётся computed hiding check, а skip link вместе с source-return labels проверяется по отсутствию в **фактическом PDF**; shared owner/CSS не меняется. Затем `negative-control/` на исходном product CSS дал **24 captures, 8 ожидаемых history failures, analyzer/browser actual exits 1** и никакого иного failure; все 16 public cases прошли. Отдельный read-only анализ ранее полученных exact-fcd4 PDF дал те же восемь failures.

`iteration-1-dev/` после единственного CSS selector change: **24 actual PDF cases / 0 problems / actual exit 0**. Во всех восьми history cases label и полный title теперь вместе на странице **14**. Все тексты и character font/style hashes совпали с baseline; public text geometry не поменялась. Документ остаётся **14 страниц**, включая короткую последнюю полосу: это исправление смысловой связности, не заявление об идеальной PDF-композиции или устранении всех коротких концовок. A4 1/13/14 и Letter 14 открыты визуально; HOLD видим, текст не обрезан. Отдельные **16 screen PNG (8 cases: 390/1440 × light/dark × dossier/history, opening + detail)** до/после побайтно одинаковы. Это development evidence; не выдаётся за финальный production-like результат.

Recoverable commit включает только CSS, собственный browser witness, PDF helper и этот handoff. После него, на чистом точном HEAD, повторяются canonical production-like build / Pagefind / source-publication contract, **48 responsive + 72 short-window + 24 actual PDF cases** и applicable targeted audits; все 25 source hashes и реальные exits фиксируются в отдельном `final/` / `commit-attestation.json`. Unavailable Firefox/WebKit, owner visual signoff, настоящий browser print dialog / printer, physical devices, screen reader и production по-прежнему не заявлены. Canonical / Research / чужие ветки / semantic-date safeguard #2345 не редактируются; история остаётся **PUBLICATION_HOLD**.


Завершённая §I: exact tested / pushed HEAD `6ff1520f3b7c4100c8de1b7159205d670dd677e5`, clean tree; build / Pagefind / contract / 14 targeted commands / Chromium **48 responsive + 72 short-window + 24 actual PDF cases** — actual exits 0, 0 problems. Seal — `print-continuity/commit-attestation.json`, 25 source / 343 artifact hashes при сдаче; viewer / patch plan / собственный #2338 comment обновлены и read-back проверен. Companion label/title вместе на странице 14 во всех восьми history print cases; короткая последняя полоса остаётся. Research main при завершении `2c3a8aed3e338c7ac0e59a5f5b58e85bf1e0c5a8`, шесть relevant authority files byte-identical предыдущему pin; HOLD не менялся.

## J. Агент 8 — полный клавиатурный фокус мобильного оглавления

- **Mode / owner:** LANE, Агент 8 / `7f634191`, только своё изолированное предложение для #2338. Base / rollback `6ff1520f3b7c4100c8de1b7159205d670dd677e5`; main `9edef94ece08012223c1364bec7ddcd561cf5713`, canonical `b2ae614730b0c2e164d3b07453797074253d9698`; собственный remote HEAD совпал, tracked tree перед исследованием чистый.
- **CONFIRMED-CURRENT:** 16 read-only cases / 32 settled first-last focus states: dossier/history × 390×844/844×390 × light/dark × JS/no-JS. Native Tab действительно активирует видимую ссылку, но `.je-contents nav` с overflow:auto обрезает её 7px outline extent: left 7px, right 2px, first top 6px; last dossier landscape bottom 7px. Открытые PNG подтверждают рамку только горизонтальными обрезками. В отдельном sticky Tab→Shift+Tab воспроизведении summary y=54 / outline extent=7: точка сверху попадает в существующий `header.mcp-top`. Это локальный focus-clearance defect, не объявление нового shared-search/WCAG findings owner.
- **Bounded scope:** только mobile ≤1023px focus clearances существующих rail / native nav в `src/components/journal/journalEditorial.css`; адресная native mobile keyboard regression в своём `scripts/journal-editorial-browser.mjs`; этот единый handoff. Не менять `JournalContents` / source-return / shared mobile header/search JS, reader state, markup, print typography, fonts, content/dates/metadata/data/route owners, package/CI или Research. Один native TOC / theme/search owner сохраняется.
- **SSOT / design:** nav сохраняет существующий 2px + 5px outline, max-height 50svh / native scrolling и текущий shared header 52px. Дать контуру реальное место, не маскировать overflow / не перехватывать focus или scroll. Сохранить прежнюю ширину строк, 5px right gutter и нативное раскрытие. После failed exact-e470 inset-подход для summary скорректирован: **усиленный 3px внутренний контур**, без увеличения collapsed rail или shared-header rewrite; glyph ranges не соприкасаются с рамкой. Полная причина и отрицательные результаты сохранены ниже.
- **Adjacent:** перечитаны latest #2339 `d7646aa0c1289dbaa92c443da9050b77362aeffd`, #2340 `1979ef2e7e73ba68c937d4f74beb9bea387ef4fc`, #2341 `71c86927aa5b625d4b8eb9359e8babcdf05e423f`, #2343 `86f59f527df1d7e40d552533129de057b6a6acec`, QA #2344 `259074909f0d1a35aca255adbb12bd40e99b3044`, SEO #2345 `eb8ffc5a43c7923bf3bca75d934b0e767f028d2d`. CSS alternatives не импортируются; новый SYSTEM mobile-search handoff #2338 comment 6993590262 прочитан, его generic `js/search.js` prototype не переносится. Сохранить required kind/dates / Article-only OG safeguard #2345 при будущей интеграции.
- **Research:** current main при refresh `98f4a481d197bd54093b91b748f0565eb5c9cd36`; шесть instructions/registry/evidence-policy/immutable-handoff файлов получены read-only с этого exact pin, byte-identical предыдущему снимку. AGENTS/AGENT_RULES/CURRENT_AUTHORITY перечитаны. #582 по-прежнему OPEN/Draft `93d6f08a40c7989eb1f6362fd1667094742144d2`. Нового signed history handoff нет, **PUBLICATION_HOLD** сохраняется. Ни Research mutation, ни listening/rights/publication upgrade не выполняются.
- **Required checks:** отрицательный контроль нового mobile suite на исходном product CSS; actual native forward/reverse focus / full outline inside scrollport and viewport / summary not under actual visible shared header / Escape and native disclosure / last-anchor focus; portrait + landscape, 320/360/390/430/768/1023 × 390/844 × light/dark × JS/no-JS, отдельно visible-scrollbar witness. На финальном чистом committed HEAD — canonical build / Pagefind / publication contract, прежние 48 responsive + 72 short-window + 24 actual PDFs и 96 mobile-focus cases; applicable targeted audits. Print geometry/text и desktop screen source invariants не должны меняться. Firefox/WebKit без binaries — 0 cases, не PASS.
- **Evidence namespace:** `reports/g3-editorial-local-20261118/reading-resilience/`. До Product mutation проверены все **264 print pages / 302496 non-space glyphs**: unbounded MediaBox extraction не нашёл off-paper / 32pt safety-margin escapes; на шести unique layouts нет сильных metric-overlap candidates. Это geometry diagnostic, не physical-printer / optical signoff. 36 screen cases (320/390 × обе темы × three surfaces × normal / root200+reader140 / text-spacing) — 0 text-range escapes; root200 не называется настоящим browser-UI zoom. Эти поверхности не объявлены сломанными ради изменения CSS.
- **Harness limits:** первый quadratic glyph-pair diagnostic timeout 180s, PID 50979 явно остановлен; результат не засчитан, линейная/line-pruned проверка прошла за 7.36s. Первые focus PNG сняты до окончания native smooth scroll, сохранены в `mobile-focus-initial/`, не visual acceptance; повторный witness дождался root/nav scroll, подтвердил видимый active focus и сохранил отдельные actual before PNG/JSON. Никаких отключённых animation/force-click для PASS.


### Мобильная реализация и сохранённые ограничения

Первая recoverable-итерация `e470715e93cb7f060c43fd8405108312fd45fb99` (**позднее отклонена полной регрессией**, не pushed) меняла два mobile CSS rules. В rail добавлены 8px paper-backed top inset (существующий sticky `top:52px + safe-area` не переписан) и фон текущей бумаги; nav получает 8px focus inset / отрицательные inline margins / прежний дополнительный 5px right gutter / нативный scroll-padding. Ширина text measure, 2px + 5px indicator, 50svh cap, 44px links, desktop / print rules, shared header, JS и article text не изменены. Background под верхним inset выбран после реального просмотра: первая top:60px development-итерация оставляла щель с фрагментом движущейся прозы под fixed header. Вместо этого outline целиком располагается на route-owned бумаге; новый shared chrome / псевдопанель не вводится.

Новый operator-run `--suite=mobile` использует actual Tab / Shift+Tab, отдельно дожидается root + nav + header movement, проверяет полный outline во viewport и scrollport, возврат к summary, native Space/Enter, существующий JS Escape, last-link native activation / target focus и layout overflow. В no-JS скрипт не приписывает Escape закрытие `details`: этого нативная модель не обещает. `--visible-scrollbars=true` убирает только Playwright default `--hide-scrollbars`, затем требует реальный native gutter, а не CSS имитацию. Новый режим не запускает случайно desktop / PDF suites. Full mode сохраняет прежние suites и добавляет 96 compact cases.

**Отрицательный контроль:** source CSS совпал с clean exact 6ff; новый test дал **16/16 expected clipped-focus failures / actual browser exit 1**, без иных классов отказа. Wrapper сохраняет actual nonzero, не называет expected failure Product PASS. `negative-control/` содержит source hashes / raw state / 16 screenshots / exit. В baseline comparative capture первый helper попал в гонку native initial scroll: `scrollIntoViewIfNeeded` timeout, два partial cases сохранены в `before-focus-initial/`; добавлено реальное ожидание движения, не выключены animation/guards. Исправленный `before-focus/` — четыре matched procedures / 12 PNG, original product CSS hash `e0b4654191377a601d786dd87c2c81fa3de35310057dd84f925f8c2cb72c115f`.

**Development evidence, не final-head acceptance:** `iteration-1-dev/` — все 32 cases прошли forward/reverse / summary outline geometry, но 12 cases честно завершились failure на неожиданном axe incomplete для строк за scrollport. Это **не** объявлено 32/32 PASS и не «исправлено» уменьшением шрифта/палитры или исключением правил. axe 4.11 не может вычислить фон частично clipped rows при открытом sticky nav. Новый narrow manual-review witness сохраняет каждый original incomplete, допускает **только** `color-contrast` / exact partial-obscuration reason / единственный target внутри того же nav, реально clipped link rect, flat opaque ancestry и самостоятельно вычисленное **≥4.5:1**. Иные targets/reasons/incomplete остаются failures. Прежние static/source/short audits и их zero-incomplete assertions не ослаблены. `iteration-2-dev/` на первой paper-backed CSS: **8 cases / actual exit 0 / 0 problems**, все native keyboard/last-anchor checks; 48 clipped contrast nodes read-back, min **5.223267297482299:1**. Это measured review, не полный WCAG / screen-reader signoff. First/last/summary PNG открыты визуально, рамки не отрезаны; верхний inset не показывает фрагменты движущегося текста.

Recoverable commit ограничен CSS, своим browser witness и этим handoff. **После него** — build/Pagefind/contract, полные 48 responsive + 72 short-window + 96 compact-focus + 24 PDF cases на чистом committed HEAD; дополнительные 844×390 с actual visible scrollbars, повтор narrow text-range diagnostics и exact-source/PDF/desktop preservation checks. Actual exits, failures, source+artifact seal, selective patch plan и собственный coordination read-back фиксируются в новом `reading-resilience/final/`, не переписывают завершённую §I приёмку. История остаётся source-only / **PUBLICATION_HOLD**, без merge/deploy/release.


### Строгая source-регрессия отклонила e470; итог без увеличения rail

На чистом exact `e470715e93cb7f060c43fd8405108312fd45fb99` build/Pagefind/contract и 14 targeted commands прошли; 96 compact-focus / 72 desktop-short / 24 PDF cases также без failures. Но две dossier **390 light/dark repeated-source axe** проверки нашли `target-size` у предыдущего `#src-G3-S001 > .biblio-details > summary`: из-за добавленных 8px у rail видимая часть стала меньше 24px. **Actual full-browser exit 1; этот candidate не принят и не pushed.** Вся исходная попытка остаётся по своим неизменным capture paths в `reading-resilience/final/` (включая successful mobile-tall); она не переименована в зелёную приёмку.

`source-target-diagnostic/probe.json` повторил оба failures на built e470 direct-source entry. Только browser-only CSSOM rollback rail padding дал visible summary **19.71875 → 27.71875px**, axe violations **1 → 0** в обеих темах. Оригинальные PNG и точные DOM hit-points сохранены. Эксперимент показал собственную source regression, не оправдание отключить `target-size` или поменять shared scroll-padding.

Итоговый bounded product diff относительно 6ff — **три compact TOC rules**, исходный rail полностью восстановлен. (1) Summary получает inline outset/matching padding 8px: text positions / reading measure / 50px height не меняются. (2) Только его keyboard indicator становится **3px, outline-offset:-3px** — целиком внутри кликабельной области, ниже header; inline inset оставляет место, не закрывает текст/стрелку. (3) Native nav сохраняет уже проверенные margin/padding/scroll-padding для исходной 7px внешней рамки ссылок. Нет font reduction, скрытия/выключения контуров, source-offset workaround, JS или новых owners. Collapsed rail dimensions и source landing offsets прежние.

Mobile witness теперь отдельно фиксирует настоящую paint width, offset и outer extent (0 допустим **только** у реально нарисованной внутренней рамки). Требует solid ≥2px paint и дополнительно проверяет **все summary text-range rectangles внутри внутреннего края рамки**. Это проверка отсутствия concealment, не ослабление clip assertion. Все прежние source/static/short axe assertions сохранены побайтно. `iteration-3-dev/`: **8 mobile cases / exit 0**, включая summary-return / glyph clearance / native last target. Два exact repeated-source native round trips с full-page axe также прошли: **0 violations / 0 incomplete**, visible previous-summary **27.71875px**. Реальные first/last/summary/source PNG просмотрены.

Новый recoverable commit сохраняет и ошибочный e470 в истории (без reset/rebase), но только после **повторных exact-head** build/Pagefind/contract, 48 responsive + 72 short-window + 96 compact-focus + 24 PDF и targeted commands допускается push. Accepted evidence будет в отдельном `reading-resilience/final-inset/`, чтобы старые PDF capture paths / failures `final/` не были перезаписаны. Final seal / viewer / selective handoff обязаны различать эти два SHA и два результата. Никаких изменений canonical/чужих веток/Research или разрешения истории к публикации.


### Final-head harness: полезная ширина с настоящим scrollbar

На исправленном **exact ad0bfa4d8052aa710eedb1d33574c5f0e50d2b6e** повторные build/Pagefind/contract и 14 targeted commands — actual exits 0. Полный browser evidence разделён только по высоте compact viewport, чтобы каждая one-shot команда укладывалась в предел среды: `final-inset/browser-chromium.json` — **48 responsive + 72 short + 48 compact(390px high) + 24 PDF / actual exit 0**; `final-inset/mobile-tall/` — остальные **48 compact(844px high) / exit 0**. Это ровно 96 unique compact cases, не двойной учёт. Таким образом source regression e470 устранена без ослабления старого axe gate.

Дополнительный **real 15px scrollbar** run на ad0 прошёл все forward/reverse/summary/activation checks, но завершился **16 failures / actual exit 1** на последнем новом harness postcondition: `scrollWidth - innerWidth` равен **−15**, а не 0, когда системная полоса занимает место. Это подтверждённая ошибка измерения теста, не horizontal product overflow и не повод скрыть root scrollbar. В mobile witness теперь сравниваются **scrollWidth и documentElement.clientWidth**, outer/usable widths сохраняются, а фокус ограничен ещё более строгой **usable** шириной (без scrollbar gutter). Прежние static/source/short проверки не менялись. `iteration-4-harness/`: исходный Product CSS ad0 неизменён, **8 cases / actual exit 0**, outer=390 / usable=scrollWidth=375, native gutter=15. После QA-only recoverable commit всё равно нужны повторные exact-head checks; accepted receipts будут отдельно в `reading-resilience/verified/`, старые `final/` и `final-inset/` не перезаписываются.

Текстовый read-back уточнил старое диагностическое имя `root200-reader140`: API действительно получает request 1.4, но текущий shared preference owner **нормализует его до 1.25** (`js/reader-preferences.js`), что было видно и в исходном raw JSON. Никакого Product bug / полномочия менять shared cap здесь не заявлено. `final-inset/text/` явно фиксирует **36 comparable cases** (normal / root200+actual max125 / text-spacing) плюс **12 отдельно обозначенных CSS-only stress140 cases**, всего **48 / exit 0 / 0 text-range escapes**. У stress API остаётся 1.25, только browser diagnostic CSS variable равна 1.4. Это не UI zoom, не новый пользовательский режим и не доказательство 140% через штатный API. Четыре enlarged/spacing PNG сохранены для оптической проверки.

Дополнительный preservation helper честно остановился (`final-inset/preservation-helper-initial.json`, actual exit 1), когда попытался перечитать **mutable external dist paths** старого 6ff seal после новой canonical сборки. Старые 338 durable review artifacts внутри `print-continuity/` проверены и неизменны; пять прежних `dist/**` записей не выдаются за сегодняшние 6ff bytes. Старый seal не переписан. Новый seal должен хранить copies generated asset bytes **в собственном evidence namespace**, проверять baseline PDF/screens отдельно и связывать source bytes с immutable commit, а не обещать вечность mutable dist path.

Перед последней exact-head приёмкой перечитан новый read-only coordination #2338 comment **6994945229**: canonical `b2ae614730b0c2e164d3b07453797074253d9698`, main `9edef94ece08012223c1364bec7ddcd561cf5713` неизменны; художественный финалист не выбран, Agent 8 остаётся source reference. Этот lane не присваивает себе интеграционное решение. Research main `e2d7f0a00165bec83f0f8e6ae939049706a6ec2c` — шесть relevant authority/handoff файлов byte-identical нашему pin 98f4; #582 прежний Draft SHA, история **PUBLICATION_HOLD**. Нового PR / merge / deploy / shared-owner takeover нет.
