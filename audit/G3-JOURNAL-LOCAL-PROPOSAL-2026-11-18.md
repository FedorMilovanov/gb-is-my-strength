# Agent 9 / Агент 9 — G3 / Journal editorial proposal

## Граница работы

- **Mode:** LANE.
- **Owner / идентификатор агента: Agent 9 (Агент 9).** Назначен владельцем репозитория в этой Arena-сессии.
- **Собственная ветка:** `arena/558cea0f-gb-is-my-strength`; имя закреплено Arena, поэтому идентификатор записан в этом файле, сообщении коммита и названии Draft PR.
- **Назначение:** переиспользуемая редакционная система Journal, документальное досье G3 и защищённая историческая рукопись; не изменение общесайтового reader/runtime.
- **Branch base:** `9edef94ece08012223c1364bec7ddcd561cf5713`.
- **Implementation / rollback anchor:** `b2ae614730b0c2e164d3b07453797074253d9698`, прочитанный HEAD Draft Product PR [#2338](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338).
- **Разрешённая поверхность:** `src/components/journal/**`, собственные проекции `src/data/journal/**`, один browser regression test и эта записка.
- **Пересечение / доставка:** canonical PR #2338 принадлежит существующему lane. Это изолированный вариант Agent 9 для сравнения и выборочной интеграции, не принятие владения его веткой. После локального snapshot владелец явно разрешил multi-agent comparison и push **только собственной ветки**. Один Draft proposal направляется в базовую ветку #2338, не напрямую в main. Merge, deploy, запись в чужие ветки и изменения Research не разрешены.
- **Source of truth:** действующие route profiles и page ownership; существующие Journal/reader owners; неизменённые `g3PublicationHandoff.ts`, `g3SourceBibliography.ts`, `g3ProductMetadata.ts`; закреплённый Research-кандидат для неопубликованной истории.

## Multi-agent checkpoint — 2026-11-18, Agent 9

- **Текущий подэтап:** FAST — видимая идентификация владельца и уникальное имя собственного QA entrypoint; без изменения frontend/runtime.
- **Rollback подэтапа:** `1b48452f5ec4e4a27adcee47f746c6db8ac56358` — проверенный локальный implementation checkpoint Agent 9.
- **Прочитанный main:** `9edef94ece08012223c1364bec7ddcd561cf5713`; **canonical #2338:** `b2ae614730b0c2e164d3b07453797074253d9698`.
- **Пересекающиеся варианты, read-only receipt около 19:29 UTC:** Agent 4 [#2339](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2339) `0b9576278d2ec5ea89da804934823d460720501a`; Agent 1 [#2340](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2340) `dceed04b4fa42bfff16891759b730118f933f645`; Agent 7 [#2341](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2341) `505ea4e0952e97b542378fef9e038fe0f15e0bc1`; Agent 5 [#2342](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2342) `054a8ab5e57a8f7fd00ea23926359f121df01368`.
- **Решение по overlap:** это альтернативные пересекающиеся UI proposals, не автоматически совместимые независимые lanes. Agent 9 не закрывает/не переименовывает/не cherry-pick-ит чужие PR. До выбора владельца вариант остаётся Draft; machine collision gate не обходится, supersession не заявляется.
- **Собственный QA entrypoint:** `scripts/journal-editorial-agent9-browser-test.mjs`. Переименован из локального `journal-editorial-browser-test.mjs`, потому что Agent 1 независимо добавил файл с тем же исходным именем. Новый default report path — `reports/g3-editorial/agent-9/after`; assertions не ослаблены.
- **Checks подэтапа:** `git diff --check`, Node syntax check, сверка неизменности assertions и content hashes frontend относительно implementation `1b48452…`. Прежние build/browser receipts относятся к этому implementation SHA; новый exact-head CI не объявляется зелёным заранее.

## Волна F — доступность masthead controls (Agent 9)

- **Mode / owner:** LANE / Agent 9, тот же изолированный Draft [#2343](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2343).
- **Rollback:** `fd1080e83d671744ff11807019d699517563af9a`; main и canonical #2338 остаются на указанных выше anchors.
- **CONFIRMED-CURRENT:** на rollback SHA при 320/390/1440 px отсутствуют visible top-of-page theme/search triggers (`#themeToggle=0`, `#gbSearchBtn=0`, mobile search скрыт), хотя canonical preferences API и search bootstrap уже mounted. Evidence: ignored `reports/g3-editorial/agent-9/wave-f/control-baseline.json` и before screenshots.
- **Bounded root cause / repair:** Journal masthead не предоставляет consumers уже существующих services. Разрешены `JournalMasthead.astro`, собственный browser test, эта записка и canonical-generated `data/scripture-search-index.json` (только устаревший `stats.scannedSourceFiles`, без изменения references/occurrences).
- **Ownership:** тема обращается только к `GBReaderPreferences.get/setTheme/subscribe`; без отдельного storage/class/theme owner. Поиск — только declarative trigger действующего `GBSearchBootstrap`, без второго click/keydown handler или search loader. Shared CSS/JS, MobileChromePage, metadata, route/Research owners не меняются. Неподдерживаемые до lazy load shortcuts не рекламируются.
- **Overlap:** Agent 7 и Agent 5 независимо предлагают свои theme/search consumers. Ветка Agent 9 остаётся альтернативой; чужой код не импортируется, текущие Draft heads проверены read-only перед mutation.
- **Checks:** before/after, 8 widths × обе темы, focus/hit targets, one-event theme activation + persistence + cross-tab sync, cold/warm single search runtime + keyboard close, no-JS progressive fallback, axe, syntax/type/build, native/ownership, canonical cache-bust и Scripture generator check. Shared mobile search defect остаётся отдельным открытым пунктом.
- **Локальная итерация до commit:** Chromium 153, 48 matrix + 14 interaction cases, 0 failures; cache-bust, CSS layers (с inherited coverage warnings), syntax/diff и Scripture check PASS. Canonical generator изменил только `scannedSourceFiles: 545 → 547`; 1372 references / 3511 occurrences / 103 routes побайтно сохранены. Это не exact-head build receipt; финальные проверки выполняются после commit.

## Что реализовано

1. `JournalArticleHeader.astro`: общая широкая шапка с двумя вариантами композиции, существующими AVIF/WebP, byline и слотами метаданных. SEO остаётся у `JournalDocumentHead.astro`; даты досье берутся из существующего metadata owner.
2. `JournalArticleToc.astro`: нативные якоря; на узком экране — горизонтальное содержание. Единственный локальный обработчик `focusin` в `JournalEditorialShell.astro` удерживает целиком видимыми сфокусированные ссылки содержания и masthead. Он прокручивает только соответствующий горизонтальный список, не перехватывает ссылки, не ведёт историю и не дублирует mobile chrome.
3. `journalEditorial.css`: собственные scoped токены обеих тем, широкое открытие, колонка чтения до 740px, rail, мобильные и печатные правила. Шрифты и файлы медиа переиспользованы, общие CSS/JS не переписаны.
4. Досье сохраняет `/journal/dossiers/g3/`, 16 разрешённых проекций и 21 библиографический объект. Источники из текста и хронологии ведут к постоянно доступным локальным записям. Финансовая врезка и абзац используют одну display-проекцию чисел из `G3-PUB-002`, с прежней оговоркой о классификации самой организации.
5. Историческая рукопись получила отдельную композицию, навигацию по годам и 20 аннотированных ссылок. Анонсы, метаданные записей, воспоминания и расшифровка не выдаются за равнозначные доказательства. Состав 2013/2017 и формулировки по 2014/2019 сужены до закреплённого кандидата; это не отрицание других участников.
6. Журнальная витрина больше не называет кризисное досье опубликованной полной историей конференций. Ссылка на неразрешённую историческую страницу не создаётся.
7. `JournalEditorialShell.astro` скрывает собственную обёртку chrome при печати, не меняя shared controls. В обеих исторических компонентах есть fail-closed production guard.

### Два подтверждённых адаптационных исключения

- В `site.css` важный мобильный `margin` для `.author-card` находится в `@layer components`. Для сохранённого protected hook компактного byline нужен **один** документированный scoped override в том же слое. Unlayered `!important` не решает этот cascade; глобальный owner не менялся.
- Chromium оставлял некоторые частично видимые TOC-ссылки обрезанными при Tab. Проверены scroll-margin/padding, snap и варианты CSS layout; маленький локальный focus enhancement устраняет дефект, сохраняя нативное чтение без JS. Дополнительная проверка нашла такое же обрезание ссылки «Богословские статьи» в masthead при 320/360/390px; оба scrollport теперь обслуживает один делегированный owner в Journal shell, старый TOC-handler удалён.

## Research / публикационная граница

- Действующий seal: `298d00ddc4db46522c8ad904016e98a4426c9fcf`.
- Evidence commit: `893e952de4e7ae617af02aca1344d385abcdf71b`.
- Handoff: `G3_HISTORY/PRODUCT_HANDOFF_G3_DOSSIER_2026-09-09.md`; SHA-256 сверенной копии `9b6dd9238d52b9420aa815e9b6c78cfc357c387f60fc58ad15d7face41a065a2`.
- Допуск распространяется только на **G3-PUB-001…016 и 21 источник**, не на исторические расширения.
- Исторический кандидат прочитан в Research PR [#582](https://github.com/FedorMilovanov/Research/pull/582), HEAD `93d6f08a40c7989eb1f6362fd1667094742144d2`, файл `G3_HISTORY/EDITORIAL_HISTORY_EXTENSION_CANDIDATE_2026-11-18.md`.
- `G3-HIST-PUB-01…09` остаются **PUBLICATION_HOLD**. Новая Product source-only таблица — receipt/проекция ссылок, не Research ledger и не разрешение публикации. Она раздельно хранит evidence class, access, locator, rights и publication state; Product receipt не заявляет получения оригиналов.
- Прямые исторические сайты, видео и аудио этой сессией не получены/не прослушаны. Нет новых verbatim-цитат, исторических фотографий, разрешений на перепечатку или выводов о передаче активов.
- Старые адреса G3 требуют архивного подтверждения. Дата переезда из рассказа Бьюса требует сверки аудио; майская регистрация 2024 года не доказывает проведение; смена площадки октябрьского события не объясняется предположениями.
- Публичный history route, его search/feed/sitemap-записи и новый handoff не создаются. Успешная сборка не снимает HOLD.

**STOP_DISCOVERY для этой волны:** закончен перенос ограничений закреплённого кандидата в рукопись. Дальнейшее расширение фактов — отдельная evidence-задача Research, а не догадки Product.

## Проверки и воспроизводимость

Рабочий Node должен соответствовать pin проекта: в этой среде использован изолированный **22.23.4**, без правки package/lock-файлов.

```sh
npm run strangler:build:production-like
npm run migration:metadata:check:strict
npm run native:runtime:audit:strict
npm run data:consistency
npm run cache-bust
npm run css:layer:validate
npm run page-ownership:dist:production-like
```

`strangler:build:production-like` уже включает `astro:check` и канонический postbuild. Journal CSS получает content-hashed Astro URL; shell focus enhancement остаётся Astro-owned module script (в проверенной сборке встроен в HTML, 489 B). Вручную менять asset revisions не надо.

Для production-like browser QA запустить статический сервер `dist` с bind `0.0.0.0`, затем:

```sh
JOURNAL_BASE_URL=http://127.0.0.1:4173 \
AXE_CORE_PATH=/path/to/installed/axe-core/axe.min.js \
node scripts/journal-editorial-agent9-browser-test.mjs
```

Тест по умолчанию запрашивает Chromium, Firefox и WebKit. Неустановленный браузер/axe означает незавершённую приёмку и ненулевой exit, а не skip-pass. Для явно ограниченного Chromium-прогона допустим `JOURNAL_BROWSERS=chromium`. Изолированный Chromium можно передать через `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` и JSON `PLAYWRIGHT_CHROMIUM_ARGS`.

Матрица: **320/360/390/430/768/1024/1440/1920 × light/dark**. Дополнительно проверяются отсутствие локальных dead anchors/duplicate IDs/script URLs, изображения, metadata owners, источник и фокус, keyboard/skip link, landscape, 200% root text, печатная видимость, нативные переходы без JS и 404 закрытого history route. Это не эмуляция реального iOS notch, физического pinch zoom или заключение о полном соответствии WCAG.

Защищённый draft тестируется только через disposable DEV-only noindex adapter вне `src/pages`, с `JOURNAL_HISTORY_PATH=/__local/g3-history/`. Нельзя добавлять публичный маршрут ради QA. Отдельные изолированные production probes должны отказываться собирать и `G3HistoryArticle`, и напрямую импортированный `G3HistoryFeature` именно с ошибкой `PUBLICATION_HOLD`.

Локальные доказательства сохраняются вне Git в `reports/g3-editorial/`: before, итерации, after, JSON, build/guard logs и итоговый `REPORT.md`. SHA, source hashes и реальный исход команд читаются из receipts; старый зелёный HEAD не переносится на новый. Скриншоты и временные browser/toolchain assets не входят в Product patch.

## Незакрытая shared-находка: поиск / возврат фокуса

**G3-JOURNAL-OOS-SEARCH-01 — CONFIRMED-CURRENT, воспроизводится и на baseline.**

- **Observed at:** baseline `b2ae614730b0c2e164d3b07453797074253d9698` и текущий local production-like `/journal/dossiers/g3/`, Chromium, 390×844.
- **Шаги:** прокрутка до `scrollY=1000` → открыть общий поиск из `.mcp-search` → Escape. Поиск открывается, выдача G3 и единственный dialog работают, блокировка прокрутки снимается, JS-ошибок нет. Но `scrollY` становится 0, панель скрывается и фокус остаётся на скрытой кнопке либо теряется на body после кадра.
- **Evidence:** `reports/g3-editorial/final-runtime-audit.json` — два failed roundtrip; `search-baseline-source.json` и `search-baseline-reproduction.json` — изолированный рендер шести исходных Journal-файлов через `git show` exact baseline, те же симптомы. Удаление новой print-обёртки из DOM также не устраняет проблему. Shared `MobileChromePage`, `ReaderPreferencesHead`, `js/search.js` и общие CSS не изменены.
- **Proposed lane:** отдельный owner-approved **SYSTEM / shared search + reader scroll/focus**. Конкретный root cause ещё не установлен; локальный обработчик Journal не подменяет этот owner.
- **Recovery risk:** none; baseline fixture/логи находятся вне Product source; диагностика не записывала ничего в shared owners или remote.

Зелёная Journal matrix **не закрывает** этот дополнительный shared smoke. Общая приёмка остаётся частичной также из-за отсутствующих Firefox/WebKit и реальных safe-area/zoom-проверок. Полное соответствие WCAG или готовность к публикации не заявляется. Фактический референс концепции №2 не получен; 1:1-соответствие ему не заявляется.

## Перед интеграцией в #2338

1. Получить explicit handoff владельца canonical lane; не перезаписывать его незавершённые изменения. Проверить новый exact HEAD и согласовать перенос delta Agent 9 после `b2ae614…`. Сохранять один stacked Draft proposal для этого варианта, не создавать новый PR на каждую волну.
2. Повторить проверки на интегрированном SHA. Firefox/WebKit в текущем sandbox не загрузились (`ECONNRESET`); их проверка, реальные safe areas и owner visual signoff остаются обязательным незакрытым приёмочным пунктом.
3. Research отдельно получает архивные оригиналы ранних программ, точные session-title locators и human audio receipt интервью 18.01.2025, уточняет проведение/программы 2024 года и подписывает новый handoff. До этого защищённую историю не маршрутизировать.
4. Push собственной ветки разрешён последующим явным указанием владельца. Это не разрешение на merge/deploy или публикацию исторической рукописи. Canonical #2338, main, чужие ветки и Research остаются read-only для Agent 9 без отдельного согласованного handoff.
