# BACKLOG: серия «Тёмная сторона кафедры» — единый реестр работ (2026-09-15)

**Формат:** по модели AuditRepo (verify → close stale/fixed → repair confirmed → reverify).
**Источник:** слияние трёх аудиторских проходов:
- pass-1 `gb-is-my-strength/audit/PASTOR-SERIES-DEEP-AUDIT-2026-09-14.md` (в репо),
- pass-2 `/home/user/audit-reports/PASTOR-SERIES-DEEP-AUDIT-2026-09-15-DEEPENING.md`,
- pass-3 `/home/user/audit-reports/PASTOR-SERIES-DEEP-AUDIT-2026-09-15-PASS3.md`.
**Статус всех WU: OPEN-UNREPAIRED** — аудит read-only, правки не вносились (общая ветка с другим агентом).
**База проверки:** head `3b40889` / `6830908`, production-like `dist` (legacy-ассеты скопированы).

⚠️ **Сквозная зависимость всех работ Волны 1:** `scripts/pastor-series-visual-parity-audit.js`
hardcode'ом требует `readingTime: 321`, запрещает `356`, требует discovery-ссылку на `feed-pastor-series.xml`
и `numberOfItems: 9` (D-04). Любая починка P0-3/P0-4 роняет этот guard. Правило: **данные и guard меняются
в одной транзакции**; константы guard переводятся на вычисление из registry.

---

## Верифицировано-исправное (CLOSED-VERIFIED, не переоткрывать без новых свидетельств)

| № | Утверждение | Свидетельство |
|---|---|---|
| V-1 | Стратегическая карта Части I целостна: 39 триггеров = 36 ключей + 3 намеренных повтора (6/20/42); мёртвых нет | pass-2 §A1 |
| V-2 | Квиз-пейлоад legacy-root и native Части I побайтово идентичен | pass-2 §A2 |
| V-3 | `data/search-manifest.json` покрывает все 11 маршрутов серии | pass-2 §A3 |
| V-4 | Структурные обещания выполнены: 20 point-id (I), 23 текста (III), 15 признаков (VIII), 12 вопросов (VI), 21 кейс (A), 40 reader-ссылок (A) | pass-2 §A4 |
| V-5 | TTS/reader-projection: `.fn-marker/.tooltip` исключены, квиз освежает проекцию (`gb:quiz-rendered`), JSON карты не озвучивается | pass-2 §A5 |
| V-6 | «181 источник» = 148 + 33, арифметика сходится (нужна лишь читательская расшифровка — WU-4.4) | pass-2 §A6 |
| V-7 | Тач-hit-area маркеров 44×44 (`::before` в `pointer:coarse`), contrast-more подчёркивание | pass-3 §Подтв.1 |
| V-8 | Мобильный overflow таблиц прикрыт (`overflow-x:auto`, 600px-правило, `.gb-mobile-collapsible`) | pass-3 §Подтв.2 |
| V-9 | `.sources-block`/служебные aside корректно вне TTS; «Нашли неточность» — вне article | pass-3 §Подтв.3 |
| V-10 | Таблица Части V содержательно консистентна (6 строк = «Шесть уровней»), кросс-ссылка на VII на месте | pass-3 §Подтв.4 |
| V-11 | 0 битых ссылок/якорей серии; контент-линтеры зелёные; экзегетические коррекции 30A–33A применены; финал IX христологичен | pass-1 вердикт |
| V-12 | Публикация II–IX легитимна: PR #1923 (owner-lane release, 2026-09-08), clearance #1918 | pass-1 §authority |
| V-13 | Accessible name map-триггеров Части I **ставится** runtime'ом: `article-strategic-map.js:142` → бандл ReaderActionsRuntime (подтверждено строкой «Открыть пояснение» в dist) | план Волны 1, §Corrections |
| V-14 | Карточки III–IX на лендинге живые (`<a href>` + «Опубликована»); слова «планируется» на лендинге серии нет | план Волны 1, §Corrections |

---

## P0 — витрина, навигация, времена, authority (Волна 1)

**WU-1.1** · P0-1 (pass-1, **уточнено при расписывании Волны 1**) · lane: content · severity ↓ P0→P2
Фактическая проверка лендинга: карточки III–IX уже **живые** (`<a href>` + тег «Опубликована»); слова
«планируется» на лендинге нет. Реальный остаток: (а) у карточек III–IX класс заглушки
`h-article-thumb--planned` (PastorSeriesCardsSection.astro:90–177) — опубликованные части визуально
помечены как «запланированные»; (б) карточка «Полевой справочник» задизейблена (opacity .72,
pointer-events:none, aria-disabled, строка 191) без явного статуса «Готовится»; (в) внутренние теги
«Досье 28/31» на витрине (→ WU-4.3).
Repair: снять `--planned` с опубликованных карточек (или дать настоящие thumbs); справочнику — явный
статус-тег; теги досье перенести внутрь статей.
Verify: `grep -c "planned" dist/pastor-series/index.html` = 0 для частей I–IX.

**WU-1.2** · P0-2 (pass-1) · lane: data · **разблокирует D-03 и рельсу TOC**
`partToc` пуст у II–IX (одна строка без summary) → «Оглавление части» и «Конспект» learning-sheet пусты.
Repair: заполнить partToc из фактических H2 с id+summary (12–21 пункт на часть).
Verify: для каждой части `partToc.filter(level===2 && summary).length >= 10`.

**WU-1.3** · P0-3 (pass-1) + D-04 + D-05 · lane: data+CI · **транзакция с guard**
readingTime фикция: канон 321 мин на всю серию; реальная ≈165; body-атрибуты `data-gbs2-*-min` наследуют fiction.
Repair: пересчитать минуты по фактическому wordCount каждой части; обновить `pastor-series-visual-parity-audit.js`
в том же коммите; синхронизировать editorialPublishedAt/ModifiedAt на release-дату; снять `migration-freeze-unverified`
(D-05) после перепроверки; pubDate фида = дата релиза.
Verify: guard зелёный при новых значениях; `reviewStatus != *-unverified` у всех 8 записей; feed pubDate = 2026-09-08+.

**WU-1.4** · P0-4 (pass-1) · lane: data · **транзакция с guard (discovery-ссылка)**
sitemap-шард и `feed-pastor-series.xml` устарели при рекламе в robots.txt.
Repair: пересобрать фид/sitemap из registry (или честно снять рекламу); обновить must-guard discovery.
Verify: все 11 URL в фиде и sitemap; даты соответствуют WU-1.3.

**WU-1.5** · P0-5 (pass-1) · lane: docs
MASTER-PLAN/CONTENT-CLEARANCE в research/ противоречат опубликованному дереву.
Repair: reconciliation-запись + receipt по модели AuditRepo; пометить superseded-секции.
Verify: diff-проход: каждое утверждение плана либо подтверждено деревом, либо помечено.

**WU-1.6** · D-01 (pass-2, **ОПРОВЕРГНУТО при расписывании Волны 1 — переквалификация P0→P3-hardening**)
Перепроверка: `article-strategic-map.js:142` **ставит** fallback `aria-label="Открыть пояснение {key}"`
на каждый триггер, и этот код входит в бандл `ReaderActionsRuntime…js`, который загружается на Части I
(строка «Открыть пояснение» найдена в dist-бандле). Pass-2 сканировал только статическую разметку, где имени
нет до гидрации. Остаточный риск — чисто теоретический: no-JS/статические сканеры видят безымянные role=button.
Repair (опционально, Волна 3): рендерить aria-label серверно в AntisovetovBody.astro; guard G-1 проверять
на browser-уровне, не статически. Verify: grep «Открыть пояснение» в dist-бандле ✓ (уже зелёный).

**WU-1.7** · E-01 (pass-3) · lane: layout
«Проверь себя» + «Контекст и связи» Части I вне `</article>` → вне Pagefind и TTS.
Repair: перенести внутрь article (как «Проверь различения» в Досье A) или расширить projection/pagefind-корень.
Verify: оба h2 между `<article…>` и `</article>`; Pagefind-индекс содержит «Проверь себя».

## P1 — читательский слой (Волна 2)

**WU-2.1** · P1-1 (pass-1) · 0 фигур в II–IX + generic OG-изображения.
Repair: минимум 1 фигура/схема на часть + part-specific OG (зеркало-мотив серии).
Verify: `grep -c "<figure" dist/articles/<part>/index.html` ≥ 1; og:image уникален на часть.

**WU-2.2** · P1-2 (pass-1) · 239 ссылок Части I без `.bref`-тултипов (в legacy были).
Repair: восстановить bref-слой или принять деградацию решением владельца (зафиксировать в route-profile).

**WU-2.3** · P1-3 (pass-1) + D-03 · 0 `gterm` на всех маршрутах серии → вкладка «Термины» пуста всегда.
Repair: разметить 8–15 ключевых терминов на часть (диотрефство, adiaphora, филοπρωτεύω…); до разметки —
убрать обманную заглушку «Конспект появится…».
Verify: `termsList` непуст; empty-state отсутствует при заполненном partToc.

**WU-2.4** · P1-4 (pass-1) · квиз Части I дефектен (9/10 вопросов correct=1, по 3 варианта), в II–IX квизов нет,
Досье A — третий механизм. Repair: рандомизация позиций/4 варианта; квиз-пул серии; унификация механизма.
Verify: распределение correct-индексов равномерное; `hasQuiz` true на всех частях.

**WU-2.5** · D-07 (pass-2) · «Коротко»: в II–IX plain h2+ol (не speakable), в Части I отсутствует, в Досье своя форма.
Repair: единый `.summary-card` во всех частях (включая Часть I).
Verify: `.summary-card` ≥1 на каждый маршрут серии; блок попадает в SPEAKABLE_SELECTORS.

**WU-2.6** · E-02 (pass-3) · таблица Части V: print-скоуп не покрывает серию; нет caption/scope; TTS-линеаризация.
Repair: расширить print-правила на `[data-gbs2-series]`; `<caption>`+`scope="col"`; решить TTS-политику таблиц.
Verify: в print-CSS селекторы включают body-класс серии; у таблицы есть имя.

**WU-2.7** · P1-5/P1-6/P1-7 (pass-1) · блоки-разнобой (note-box vs info-box vs warn-box), служебный H2-дубль,
дрейф названий частей между лендингом/фидом/заголовками. Repair: инвентаризация блоков → один словарь;
названия из registry. Verify: единый набор классов; 0 расхождений title.

**WU-2.8** · P1-8 + D-08 (pass-1/2) · ложные og:image:alt (описывают несуществующий кадр «пастор за кафедрой»);
frontmatter ogImageAlt мёртв (head-компонент переопределяет). Repair: один владелец alt, значение = описание
реального кадра (зеркало/корона). Verify: собранный og:image:alt == frontmatter и описывает изображение.

## P2 — структура, типографика, якоря, гигиена (Волны 3–4)

**WU-3.1** · D-02 + E-03 (pass-2/3) · `.heading-serif` не определена в native-CSS; Часть I на фикс-утилитах
(36/30/24px) без брейкпоинтов, II–IX адаптируются на 768/480. Repair: решение владельца — вернуть display-гарнитуру
токеном или унифицировать Часть I с manuscript-стилем; шкала clamp + breakpoints. Verify: H2/H3 Части I и II–IX
в единой системе; media-паритет.

**WU-3.2** · D-09 + E-04 (pass-2/3) · outline Части I: 5 скипов h1→h4; h4 двух сортов (anti-kicker-коробки
и heading-serif-блоки «зеркало/скрытый способ»); h2 «Эта статья — не приговор…» набран text-3xl.
Repair: anti-kicker → div/strong (не заголовок); зеркало-блоки → h3/h4 по месту в иерархии; выровнять размер h2.
Verify: каскад без скипов; h4 отсутствуют до первого h3.

**WU-3.3** · D-06 + D-12 (pass-2) · авто-кириллические id (`#коротко`, `#тёмная-сторона-кафедры`) и нестабильные
`#механизм-1…` в Части II; повторяющиеся H3 без метки стадии. Repair: anchor-политика — только рукописные latin-id;
H3 стадий с префиксом («Стадия 2 · Механизм»). Verify: 0 кириллических id в published; повтор H3-текстов = 0.

**WU-3.4** · D-05-остаток + D-11 (pass-2) · wave11-манифест: PUBLICATION_HOLD/publicRouteRegistered=false при живом
маршруте; нет ссылки «superseded by wave12». Repair: пометить замещение. Verify: статусы манифестов не противоречат дереву.

**WU-4.1** · P1-9 (pass-1) · мёртвый `data/strategic-map-antisovetov.json` (живёт inline-JSON). Repair: удалить или подключить.
**WU-4.2** · P1-10 (pass-1) · stale MDX-тень Части I. Repair: удалить тень или пометить archived.
**WU-4.3** · P2 (pass-1) · канцелярит-остатки; «Досье 28/30/31» на витрине; backtick-термины в прозе.
Repair: редакторский проход по словарю CONTENT-QUALITY-STANDARD.
**WU-4.4** · pass-2 A6 · раскрыть читателю состав «181» (148 authority + 33 faithful-witness) строкой в Досье A.
**WU-4.5** · D-10 (pass-2) · llms.txt: добавить 9 материалов серии (или генерировать раздел из registry).

## P3 — наблюдение

**WU-5.0** · E-05 (pass-3) · TTS молча вырезает `[lang="en"]`. Для серии сейчас неактуально (V-11: en-цитат нет).
Guard-контракт: «в prose серии нет lang=en ИЛИ есть текстовая замена».

## Волна 5 — guard-контракты (CI, после ремонта)

G-1 a11y: у каждого `role="button"` в published-разметке есть accessible name (D-01).
G-2 anchors: 0 markdown-авто-id и кириллических id в published-частях (D-06).
G-3 «Коротко» = `.summary-card` во всех частях, где объявлен (D-07).
G-4 learning-sheet: нет empty-state при непустой H2-структуре маршрута (D-03).
G-5 metadata: reviewStatus published-маршрутов не содержит `*-unverified` (D-05).
G-6 parity-guard: константы readingTime/feed вычисляются из registry, не hardcode (D-04).
G-7 content-корень: self-check-блоки серии внутри `article[data-pagefind-body]` (E-01).
G-8 print: селекторы table-print покрытий включают `data-gbs2-series` (E-02).

---

## Порядок исполнения (сводно)

1. **Волна 1 (одна транзакция):** WU-1.2…1.5 + WU-1.7 — времена/прогресс + guard-развязка (D-04) +
   partToc + фид/sitemap + metadata-статусы + article-корень «Проверь себя» + reconciliation/receipt.
   (WU-1.1 переквалифицирован в P2 → Волна 4; WU-1.6 опровергнут → опциональный hardening Волны 3.
   Пошаговый план: `PASTOR-SERIES-WAVE1-TRANSACTION-PLAN-2026-09-15.md`.)
2. **Волна 2:** WU-2.1…2.8 — OG/фигуры, bref/gterm/квизы, «Коротко», таблица, блоки/названия.
3. **Волна 3:** WU-3.1…3.4 — типографика Части I, outline, anchors, манифесты.
4. **Волна 4:** WU-4.1…4.5 — гигиена (дубли, канцелярит, счётчики, llms.txt).
5. **Волна 5:** G-1…G-8 — закрепить контрактным набором, чтобы дефекты не вернулись.

Оценка объёма Волны 1: ~1 рабочий день владельца + транзакция guard; Волны 2–3: основной массив
(фигуры/OG/квизы — самый дорогой пункт, WU-2.1/2.4); Волны 4–5: по полдня.

---

# ОБНОВЛЕНИЕ 2026-09-15 (pass-4): статусы после марафона со-агента

Ветка `arena/01a0a1b2` получила 6 коммитов другого агента (`2de7bcc…fa84544`, 26 файлов, +2193/−131):
собственный аудит `audit/PASTOR-SERIES-AUDIT-2026-09-14.md` + исполнение P0–P4.
Полная верификация: `PASTOR-SERIES-PASS4-COAGENT-VERIFICATION-2026-09-15.md`.
PR ещё нет; merge-tree с origin/main чистый; все контрактные скрипты перезапущены лично — зелёные.

## Статусы WU (пересмотр)

| WU | Было | Стало |
|---|---|---|
| WU-1.1 landing | OPEN P0→P2 | **CLOSED** марафоном: --planned сняты, реальные thumbs (II: crisis.webp), справочник «Отложено — решение за владельцем», byline «Автор-редактор:» ×10. Остаток: теги «Досье 28/30/31/32/33» на витрине → переносится в WU-4.3 |
| WU-1.2 partToc | OPEN P0 | **CLOSED**: 9–20 пунктов/часть, 6–9 summary, 125/125 якорей валидны; «Конспект» оживает |
| WU-1.3 reading-time | OPEN P0 | **OPEN (сознательно сохранено)**: 321/29–36 везде + guard зелёный на старых константах; план T1–T2 в силе; **новая поверхность: links-graph.json (N-4)** |
| WU-1.4 фид/sitemap-шард | OPEN P0 | **OPEN (отложено владельчески)**: фид 2 item, шард 3 loc, robots:123 рекламирует; основной sitemap/feed полны |
| WU-1.5 reconciliation | OPEN P0 | **PARTIAL**: MASTER-PLAN product-репо обновлён (статусы, field-guide «отложено», 2026-09-15); CONTENT-CLEARANCE receipt, AuditRepo-запись, внешний Research-репо — открыты |
| WU-1.6 aria-label | P3-hardening | без изменений (V-13) |
| WU-1.7 «Проверь себя» | OPEN P1 | **OPEN (не замечено ими)**: sec-quiz Части I по-прежнему вне `</article>`; у II–IX новый квиз — внутри (асимметрия выросла) |
| WU-2.1 OG/фигуры | OPEN P1 | **CLOSED**: 8 og-webp 1200×630, описательные ogImageAlt, 8 in-body изображений, per-part railCover. Остаток → N-3 (figure-обёртки) |
| WU-2.2 .bref ×239 | OPEN P1 | OPEN — не тронуты |
| WU-2.3 gterm/Термины | OPEN P1 | **PARTIAL**: +5 терминов (контракт зелёный); рабочие — газлайтинг/духовное насилие/LBCF; **риск мёртвых записей — safeguarding (URL+backtick), senior pastor (голое «senior»)** → N-2 |
| WU-2.4 квизы | OPEN P1 | **PARTIAL**: II–IX 8×8 вопросов, схема/якоря/explanation — отлично; **N-1 (P1): 62/64 correct=B, C/D никогда**; Часть I (3 варианта, 9/10=B) не тронута; Досье — по-прежнему третий механизм |
| WU-2.5 «Коротко» | OPEN P2 | OPEN — не тронуты |
| WU-2.6 таблица V | OPEN P2 | OPEN — не тронуты |
| WU-2.7 блоки/названия | OPEN P1 | **PARTIAL**: заголовки карточек приведены к канону; разнобой note-box/info-box остаётся |
| WU-2.8 og:alt | OPEN P1 | **PARTIAL**: II–IX — один владелец (frontmatter) + описательные alt ✓; мёртвое поле ogImageAlt Части I остаётся |
| WU-3.1 типографика I | OPEN P2 | **CLOSED (pass-12)**: `data-series-theme="manuscript"` добавлен на body II–IX (PastorSeriesArticlePage) и Части I (мёртвый attribute — manuscript-CSS не действовал на статьи II–IX); токены `.heading-serif` h2/h3 вынесены в css/series-manuscript.css (тема-scoped, глобальный — astro-scoped копия в head Части I никогда не матчила AntisovetovBody); шкала унифицирована с `article h2/h3` (clamp 20–24 / 17–20 + Playfair); фикс-утилиты text-4xl/text-3xl/text-2xl сняты с 42 заголовков |
| WU-3.2 outline Части I | OPEN P2 | **CLOSED (pass-12)**: 20 anti-kicker h4 → div/strong; 4 зеркало/скрытый-способ h4 → h3; h2 «не приговор» выровнен; каскад h1→h2→h3 без скипов |
| WU-3.3 anchors | OPEN P2 | **CLOSED (pass-12)**: 8 H3 Части II с префиксом стадии (0 дублей H3 в серии); авто-кириллические id сняты — postbuild `scripts/pastor-series-heading-id-hygiene.js` в обеих сборочных цепях (98 id/8 страниц); rehype-плагин в конфиге невозможен (Satteri: markdown.rehypePlugins — legacy-путь, запрещён контрактом) |
| WU-3.4 wave11-манифест | OPEN P2 | **CLOSED (pass-11)**: supersededBy→wave12 + статусы |
| WU-4.1/4.2 дубли/тень | OPEN P2 | OPEN — не тронуты |
| WU-4.3 канцелярит/витрина | OPEN P2 | **PARTIAL**: англицизмы reader-текста II–IX переведены (finding→вывод и др.), «Part II/VI»→«Часть»; backtick-термины и «Досье NN»-теги остаются |
| WU-4.4 расшифровка 181 | OPEN P2 | OPEN |
| WU-4.5 llms.txt | OPEN P2 | **CLOSED**: II–IX + Досье A с описаниями, Updated 2026-09-15 |
| D-05 metadata | OPEN P1 | OPEN — 8× migration-freeze-unverified не тронуты |

## Новые WU из верификации марафона

**WU-6.1 (N-1) · P1 · lane: data/quiz** — перемешать позиции правильных ответов (62/64 = B; C/D никогда)
в `src/data/pastor-series-quizzes.ts` + починить квиз Части I (4 варианта, распределение позиций).
Блокирует открытие PR с ветки. Verify: распределение correct по 4 позициям ≈равномерное.

**WU-6.2 (N-2) · P2 · lane: glossary** — «safeguarding»: вхождения только в URL/backtick → не гидратируется;
«senior pastor»: в тексте голое «senior». Repair: алиас/прозаическое вхождение или снятие записи; браузерная
проверка гидратации и вкладки «Термины». Verify: .gterm присутствует на страницах серии для ≥4 из 5 терминов.

**WU-6.3 (N-3) · P3 · lane: content** — in-body изображения II–IX: figure + width/height + srcset (600w/900w),
как в Части I. Verify: 0 голых markdown-img в published MDX серии.

**WU-6.4 (N-4) · P3 · lane: data** — links-graph readingTime = фикция; чинить внутри транзакции T1 (добавить
в инвентарь T1.9: `data/links-graph.json` + сверка check-data-consistency).

**WU-6.5 (N-5) · P3-doc** — поправить формулировки их таблицы закрытия: B1 (предложение не менялось),
«Часть I — образцовая: quiz 10» (см. WU-6.1).

## Порядок (обновлённый)

1. **Пре-PR фиксы ветки:** WU-6.1 (обязательно), WU-1.7 (2 строки), WU-6.2.
2. **Волна 1 (T1–T7 по плану)** — целиком остаётся: reading-time-транзакция с guard (+links-graph),
   фид/sitemap, metadata-статусы, reconciliation-остатки.
3. **Волны 2–4** — по остаткам PARTIAL/OPEN выше.
4. **Волна 5** — guard-контракты G-1…G-8 + новый G-9: «в published-квизах серии нет доминирующей
   позиции правильного ответа» (max ≤40% на позицию).

---

# ДОПОЛНЕНИЕ pass-5 (2026-09-15, вечером): сборка и dist-верификация марафона

Источник: `PASTOR-SERIES-PASS5-BUILD-AND-DIST-VERIFICATION-2026-09-15.md`.
Сборка дерева ветки выполнена лично: 103 страницы, `audit-pro.js` — AUDIT PASSED; copy-legacy корректен.

**WU-6.1 расширен (N-1 → две эвристики угадывания):** помимо 62/64 correct=B обнаружен length-bias —
правильный вариант в среднем 151 символ против 48 у дистракторов, в 61/64 он самый длинный.
Критерий закрытия усилен: позиции ≈равномерны по 4 слотам И «самый длинный = правильный» ≤ 60%;
эталон — квиз Досье A (5×B/5×C, 4 варианта).

**WU-6.6 (N-6) · P2 · lane: content/art** — переиспользование арта: og-*.webp и тела II–IX + landing-карточки
строятся на тех же 8 тематических webp, что уже в теле Части I (crisis встречается в 4 поверхностях).
Repair: новые арты/варианты или зафиксированное решение владельца о намеренном арт-наборе; минимум —
развести тело Части I и тела II–IX. Verify: пересечение множеств изображений тела I и тел II–IX = 0.

**Подтверждено dist-ом (закрыть как верифицированное):** пер-part og+alt; quiz cfg + placeholder +
sec-quiz внутри article у II–IX; «Нашли неточность?» ×8; «Конспект» 14–18 outline-card статически;
landing без --planned, 10 bylines, справочник «Отложено»; Part I без «Скоро/Планируется»-тегов.
**Подтверждено открытым:** sec-quiz Части I вне article (WU-1.7); gterm=0 статически (WU-6.2);
5 тегов «Досье NN» на витрине (WU-4.3); og≠LCP на landing (информационно, site-wide).

---

# ДОПОЛНЕНИЕ pass-6 (2026-09-15): контракт-скрипты на собранном дереве + семантика

Источник: `PASTOR-SERIES-PASS6-CONTRACTS-AND-SEMANTICS-2026-09-15.md`.
Полный контрактный набор сайта (articles-visual-parity --require-dist 81/81, series-reader-facade 45,
content-source-coverage, content:guard, editorial:lint, readable-audit, seo-audit 0/0) — **зелёный на
собранном дереве ветки**. Browser-контракты не запускались (нет playwright) — ни у кого.

Семантика нового корпуса (~230 предложений): канцелярит 0 истинных маркеров; переводы B3 качественные;
partToc-summaries — точные конденсации секций (сверка выборок); explanation.short avg 22.7 слова
(при желании сжать до ≤18 — P3).

**WU-6.7 (N-7) · P3 · lane: content** — `pastor-series-quizzes.ts:920`: «не подлежат никакого критики» →
«не подлежат никакой критике»; один copy-editing проход по 64 вопросам + 128 пояснениям; чинить в одном
коммите с WU-6.1.

**Итог перед PR:** блокер WU-6.1; в тот же коммит WU-6.7, WU-1.7, WU-6.2; решение владельца по WU-6.6.
Технических препятствий к PR нет (контракты зелёные).

---

# ДОПОЛНЕНИЕ pass-7 (2026-09-15, ночь): новые коммиты со-агента 7f0afa052 + 9b079253c

Со-агент запушил re-audit и verbatim quote-exactness sweep ДО нашего пуша. Верифицировано на head 9b079253c:
- **WU-6.7 CLOSED ими**: «не подлежат никакого критики» исправлено; переписаны неточные цитаты в ~23 строках
  квиза, 3 partToc-summaries, 1 landing; второй sweep англицизмов (19 мест: senior/sovereign→примат/суверенитет,
  adiaphora→адиафора, brand management, rubber-stamp и др.); partToc-якоря по-прежнему 0 мёртвых; guard зелёный.
- **WU-6.1 OPEN (без изменений, length-bias чуть хуже)**: correct dist 62/64 = B; правильный в среднем
  162 символа против 49; «самый длинный = правильный» в 61/64. Их sweep не трогал позиции/длины.
- **N-4/WU-6.4 OPEN**: links-graph по-прежнему несёт завышенные минуты (29/36/34).
- WU-6.2 (гидратация глоссария), WU-6.6 (арт), WU-1.7 («Проверь себя» Части I) — без изменений.
Итог: единственный содержательный блокер PR прежний — WU-6.1; технически ветка зелёная.

---

# ДОПОЛНЕНИЕ pass-8 (2026-09-15, вечер): верификация pass-7 + закрытие WU-6.1 / WU-1.7 / WU-6.2

Источник: работа на ветке `arena/01a0a1b2-gb-is-my-strength`, head перед коммитом = f86bea8 +
нераскоммиченные изменения (один коммит закрытия ниже).

**Независимая верификация pass-7:** все его утверждения проверены открытым и на собранным дереве —
WU-6.1 (блокеры B-bias + length-bias), WU-6.4/N-4 (завышенные минуты в links-graph), WU-6.2 (gterm=0
статически), WU-1.7 (sec-quiz вне article) — подтверждены без изменений. Пуши со-агента и ветка не
расходились (fetch по явным refspec'ам: local == remote == f86bea8 до коммита).

**WU-6.1 CLOSED (обе эвристики устранены):**
- II–IX (`pastor-series-quizzes.ts`): 64 вопроса × 4 варианта; позиции правильных A/B/C/D =
  16/16/16/16 (ровно 2/2/2/2 в каждой из 8 частей); «самый длинный = правильный» 36/64 = 56%
  (было 61/64); средний правильный 163 символа против 102 у отвлекающих. Правильные ответы сохранены
  вербатим. Дополнительно исправлено повреждение L333 (teksty q7 explanation.short) — артефакт
  раннего edit'а, найден повторным sweep'ом.
- Часть I (payload в `AntisovetovPageHead.astro` + `articles/20-antisovetov-pastoru/index.html`):
  10 вопросов × 4 варианта (было 8×3+2×4); позиции 3/3/2/2; payload'ы байт-идентичны (проверено
  на dist). 4 пояснения с позицийными отсылками (Первая/Вторая/Третья) переписаны под новый порядок.

**WU-1.7 CLOSED:** `#sec-quiz` + `#quizPlaceholder` Части I перенесены внутрь `<article>` (перед
`</article>`); accuracy-блок и авторская карточка остались снаружи — как у II–IX квиз. Верифицировано
в dist: `sec-quiz` строго между `<article>` и `</article>`.

**WU-6.2 CLOSED:** (1) в `data/glossary.json` у `safeguarding` добавлены родительные алиасы
«защиты уязвимых», «защиты детей и уязвимых» (368 → 370 алиасов) — теперь гидратируются вхождения
в Части III (teksty L158) и IX; `autoHydrate` у термина включён по умолчанию, boundary-regex
`js/glossary.js` совпадает с вхождениями. (2) В Части I (AntisovetovBody L50) добавлено прозаическое
вхождение: «— паттерн, который в церковной практике часто называют духовным насилием». Оба — в dist.

**Контрольная матрица на финальном `strangler:build` (1001 файл):** astro:build 0 errors;
article:qa 0/0; data:consistency ✅; pastor-series:visual-parity ✅; articles:visual-parity ✅
(81/81 routes); content:guard ✅ (43 baseline-страницы, +3 current delta — те же H1-диффы Дж. Гилла,
существующие с 3b40889); content:sources:check ✅; series:facade:guard ✅; glossary-contract-audit ✅
(130 терминов, 370 алиасов); glossary trust-boundary ✅; normalizer ✅; article-quiz-native-parity ✅.

**Свежие sweep'ы:** вербатим/цитаты — только принятые классы (документированные псевдо-цитаты
teksty q6 D0/D2/D3, scare-quotes, идиома «не выносить сор из избы», вербатим-исповедь vernye,
белый список «газлайтинг»/«бренд»); англицизмы — только белый список; фрагментов «буква.буква» в
изменённых файлах 0.

**Остались OPEN (решение владельца, не трогал сам):** WU-6.6 (арт-переиспользование), Wave 1
(WU-1.2…1.5), WU-6.4/N-4 (минуты links-graph), WU-4.3 (5 тегов «Досье NN», P2).

---

# ДОПОЛНЕНИЕ pass-9 (2026-09-15, ночь): самоаудит + шлифовка квизов

Полный самоаудит коммита 9081593: семантическая ревизия всех 40 расширенных отвлекающих вариантов
в контексте вопросов (ошибочность сохранена, двойных отрицаний/переворотов смысла нет), полная
верификация цитат пояснений Части I по тексту статьи, расширенные свипы (англицизмы, пунктуация,
повторы, гирлянда, латиница в кириллице, позиционные отсылки).

**Найдено и исправлено:**
1. `vernye q6` (правильный вариант): «обязан сделать X; … где Писание X не заповедует» — латинские
   X-плейсхолдеры в цитате → переписано: «…обязан сделать именно это…» — «формула, дающая суждению
   иммунитет от проверки там, где Писание ничего не заповедует».
2. `kogda-uhodit q2` (short): то же — «он сделал X» → «он поступил так».
3. `kogda-uhodit q6` (short): «функция vs борьба за влияние» → «функция, а не борьба за влияние».
4. `nesovershennyy q2/q6` (short): запятая перед тире без союза («следовало, — это») → убрана (×2).
5. Часть I q2: «бенефициар» ×2 + «vs» → «получатель пользы» / «один на один или в группе».
6. Часть I q5: вариант «ставит свой имидж выше истины — ради сохранения репутации» (тавтология +
   англицизм) → «ставит свою репутацию выше истины — ради сохранения лица»; пояснение «(имидж vs
   истина)» → «(репутация против истины)»; цитата «называет это «фундаментальной духовной
   подменой»» (неверный падеж в кавычках) → вербатим: «за каждым антисоветом стоит «фундаментальная
   духовная подмена»» (как в статье, L128).
7. Часть I q6 (full): «а в <em>агентуре</em>» — семантическая ошибка (агентура = шпионская сеть)
   → «а в том, кто направляет».
8. Часть I q7 (D4): внутренне противоречивый вариант («последствия теряют силу: плоды не
   обязательны») → непротиворечивый: ««Реальные последствия» — лишь публичное самопорицание перед
   общиной: исправления и возмещения не требуется…».
9. **Дециклирование позиций II–IX**: прежний порядок был ровно `0 1 2 3 0 1 2 3` во всех 8 частях —
   механический паттерн, видный в данных при любом разборе. 48 свапов вариантов: теперь 8 различных
   последовательностей (без повторов соседей), по-прежнему 2/2/2/2 в каждой части и 16/16/16/16
   глобально; length-bias не тронут (36/64 = 56%); пояснения позиционных отсылок не содержат
   (проверено), верная опция при свапе не изменялась.

**Проверено в финале:** все цитаты пояснений — вербатим (включая «Мне нужны не только ваши молитвы…»,
«мягок с полезными…», «Преврати кафедру…», 1 Тим. 5:19, Гал. 6:1, Евр. 12:11, Притч. 13:3);
«паттерн»/«бренд» — термины самих статей (anatomiya, disciplina, nesovershennyy, vernye);
остаток свипа — 5 корректных конструкций с тире + допустимый многоточие-лейбл; payload'ы Части I
идентичны во всех трёх копиях (src / root / dist); полная контрактная матрица на `strangler:build`
— зелёная (article:qa 0/0, data:consistency, pastor-series + articles visual-parity, content:guard
43 страницы, glossary 370 алиасов, quiz-native-parity).

---

# ДОПОЛНЕНИЕ pass-10 (2026-09-15, ночь): Wave 1 транзакция — закрыто

По третьему приказу владельца («продолжай работу, которую еще можно сделать и не закрыли») закрыты
все оставшиеся пункты волны 1, включая бывшие «решения владельца». Один атомарный коммит.

**T1 + T2 + WU-6.4 — честные минуты (атомарно с гвардом):**
- Ре-тайминг @200wpm по dist: II–IX = 9/14/9/11/11/14/11/11 → **ядро I–IX = 157 мин** (I = 67 без
  изменения), **Досье A = 15 мин** (было: фикция 321/35, ±11% к измерению).
- Все 12 поверхностей синхронизированы: `data/series.json` (SSOT), `pastorSeriesConfig.ts`
  (CORE_TOTAL_MIN=157, items, done-min 67/76/90/99/110/121/135/146, part/total Досье 15/15),
  8×MDX `readingTime`, PageHead (157/15), StatsSection (157), 10 карточек-кикеров лендинга,
  Part I route total-min=157, diotrefy route part/total=15, DiotrophesDraft «15 мин»,
  `data/search-manifest.json` (readTime 9 записей + landing 157), `data/links-graph.json`
  (n18=157, n21–28 новые, n29=15).
- **C-5 (гвард):** `pastor-series-visual-parity-audit.js` больше не дублирует минуты —
  `expectedCore` деривирует их из `data/series.json`; контрактные константы
  `CONTRACT_CORE_TOTAL_MIN=157` / `CONTRACT_COMPANION_MIN=15` фиксируют канон, чтобы тихий
  дрейф реестра падал, а не перебазировал гвард. mustNot «readingTime: 356» и «Часть II · 35 мин»
  сохранены.

**T3 — фиды и sitemap:**
- `feed-pastor-series.xml`: 2 → **10 материалов** (I–IX + Досье A); pubDate II–IX =
  Tue, 08 Sep 2026 21:00:00 GMT — фактическая дата релиза, **верифицирована через
  `gh pr view 1923`** (PR #1923 «release(pastor-series): publish canonical Parts II–IX»,
  merged 2026-09-08T23:27:22Z). lastBuildDate = дата транзакции.
- `sitemap-pastor-series.xml`: 3 → **11 URL** (II–IX с per-part og-изображениями).
- `feed.xml` (main): 8 pubDate II–IX (было 2026-07-10/2026-09-06 — даты манускриптов) → релиз.
- `sitemap.xml` (main): lastmod 11 pastor-URL обновлены (все страницы меняются транзакцией).

**T4 — editorial metadata:**
- Frontmatter II–IX: `publishedAt` → 2026-09-09T00:00:00+03:00 (релиз, MSK-полночь),
  `updatedAt` → 2026-09-15T00:00:00+03:00 (фактическая последняя правка; ≥ published).
- `data/search-manifest.json` II–IX: publishedTime/modifiedTime/readTime синхронизированы.
- `pastor-series-ii-ix-20260908.json`: 8 записей `migration-freeze-unverified` → **`approved`**
  (единственное допустимое «верифицированное» значение по ALLOWED_REVIEW_STATUS),
  editorialPublishedAt = 2026-09-08T21:00:00.000Z, editorialModifiedAt = 2026-09-14T21:00:00.000Z.
- Наблюдения обновлены писателем реестра (`registry.js --write`): все 5 published-поверхностей
  сошлись в единый момент, modified-поверхности сошлись; `registry --check`,
  `freeze-audit` («Approved metadata converges»), `workflow-contract-test` — зелёные.
  Побочный эффект: записи teen-series (были с пустыми observations) и nagornaya (устаревшие
  modified-значения) также получили корректные наблюдения тем же писателем.

**WU-4.3 — витрина:** 5 внутренних тегов «Досье 28/30/31/32/33» удалены с карточек
`/pastor-series/` (в статьях эти номера не присутствуют; публичный канон — «Досье A»).

**WU-6.6 (минимум) — арт:** пересечение множеств изображений тела I и тел II–IX было ≠ 0
(все 8 body-фигур II–IX дублировались в теле Части I). Сгенерированы 8 новых body-фигур
(anatomiya/teksty/sem-tipov/disciplina/kogda-uhodit/vernye/priznaki/nesovershennyy-600w.webp,
600×400, lossy q80, 17–49KB) в стилистике серии, по alt-ТЗ каждой части; Part I не тронут.
**Verify: пересечение = 0** ✓. (Полный WU-6.6 — новые арты для landing-карточек и дизjointность
og-наборов — остаётся на волну 4 как арт-работа.)

**T7 (in-repo):** `research/pastor-series/MASTER-PLAN.md` §12 — строка Wave 1 reconciliation
(дата релиза, PR #1923, минуты 157/15, SSOT, удаление тегов); `CONTENT-CLEARANCE-II-IX.md` —
addendum с фактом публикации и списком синхронизации. (Реceipt в AuditRepo `verified/` — за
границей этой транзакции, не трогали.)

**Финальная верификация (блок плана) — всё зелёное:**
- guard: ✅ на новых константах (деривация из реестра, контракт 157/15);
- rss-feed-normalizer-test ✅, sitemap-route-contract-test ✅;
- `<item>` в shard-фиде = 10; `<loc>` в shard-sitemap = 11;
- grep «321 | companionReadingTime: 35» по src/components/pastor-series + series.json = 0;
- dist: все 9 core-страниц `data-gbs2-total-min="157"`, Досье A 15/15 (компаньон по дизайну),
  done-min 67/76/90/99/110/121/135/146;
- `reviewStatus … unverified` в supplements II–IX = 0;
- sec-quiz Части I INSIDE article (проверка из плана пройдена повторно);
- data:consistency ✅ (после синхронизации landing readTime 157 + generatedAt),
  content:guard ✅, editorial:lint ✅, contract:compare ✅, migration:metadata:check:strict ✅,
  mdx:structure:audit ✅.

**Остатки (не в этой транзакции):** WU-2.2 (239 .bref — объёмная механика), остальное WU-2.x/3.x,
Wave 5 guards G-1…G-8, полный WU-6.6 (landing-арт), AuditRepo receipt.

---

# ДОПОЛНЕНИЕ pass-11 (2026-09-15, ночь): Волна 4 закрыта

**WU-4.1 — CLOSED.** `data/strategic-map-antisovetov.json` удалён: repo-wide grep — ноль
ссылок из кода (только исторические audit/docs-документы и dist-copy-manifest как реестр
файлов); живые данные strategic map — inline-JSON в компоненте.

**WU-4.2 — CLOSED.** Stale MDX-тень `src/content/articles/20-antisovetov-pastoru.mdx` (197KB,
frontmatter с датой 2026-05-13/06-12, ложный ogImageAlt «Пастор за кафедрой в раздумьях»,
related на сердцевые статьи) удалена; route-profile
`data/route-profiles/articles-20-antisovetov-pastoru.json`: `mdxStatus: reference-only → absent`,
`mdxPath: null` (contentSourceMode=astro-native-entry, renderSource = index.astro — не менялись).
Проверено: content-source-provenance-audit зелёный (нет unowned MDX, нет absent+path-конфликта),
article-qa / sources:hygiene / mdx:structure:audit / migration:metadata:check:strict — зелёные,
сборка 0 errors (collection больше не собирает тень).

**WU-4.4 — CLOSED.** Абзац «Источники и границы проверки» Досье A теперь раскрывает состав «181»:
«181 запись: 148 исходных записей и 33 источника дополнения Wave 11 о верных свидетелях… Ниже — 40
прямых читательских ссылок; раздел Wave 11 добавляет ещё 33 ссылки — 73 всего». Числа сверены с
`data/diotrophes-wave11-faithful-witness-manifest.json` (counts: 148+33=181, 40+33=73) и
`diotrophes-wave12-release-manifest.json` (authoritySources=181); Wave 11-раздел действительно
рендерится на публичном маршруте (DiotrophesPublishedPage → DiotrophesWave11Draft →
FaithfulWitnessSupplement, в dist data-authority-sources="181").

**WU-3.4 — CLOSED.** `data/diotrophes-wave11-faithful-witness-manifest.json`: добавлен
`supersededBy` → `data/diotrophes-wave12-release-manifest.json` (at 2026-08-02T00:00:00+03:00,
reason: маршрут выпущен Wave 12; PUBLICATION_HOLD/registered=false — состояние до выпуска).
Исторический статус wave11 не переписан (receipt-семантика); wave12-манифест (актуальный,
PUBLIC_ROUTE_RELEASED, readingTimeMinutes=35 на момент выпуска) не тронут.

**Промежуточный инцидент (зафиксировать для future-своод):** между ходами среда сбросила локальный
git до base 3b40889 и стёрла node_modules/dist//tmp, но worktree и remote-ветка сохранились;
`git diff 3d1b07f` = пусто → `git reset --hard 3d1b07f` вернул полную историю (9081593→7ba3258→
3d1b07f). Урок: перед любыми коммитами — проверить `git log -1` и, при расхождении с ожидаемым,
fetch + diff до remote-ветки.

**Матрица после транзакции:** migration:metadata:check:strict, article:qa, sources:hygiene,
mdx:structure:audit, data:consistency, content:guard, contract:compare, editorial:lint,
readable-audit, pastor-series guard, editorial registry --check, content-source-provenance —
все зелёные; сборка 0 errors.

---

## PASS-12 — закрытие Волны 3 (WU-3.1 + WU-3.2 + WU-3.3)

### WU-3.3 (якоря) — DONE
**Часть A — дубли H3 (Часть II).** 8 H3-переименований в
`src/content/articles/anatomiya-padeniya-pyat-stadiy.mdx`: «Механизм» ×4 →
«Стадия 1·2·3·4 · Механизм», «Ранний маркер» ×3 → «Стадия 1·2·3 · Ранний маркер»,
«Ранние маркеры» → «Стадия 5 · Ранний маркер». Итог: 0 дублей H3 во всех 8 частях
II–IX (инвентаризация: III 0 / VI 0 / IX 11 → 11 уникальных после проверки, остальные
уникальны). Не префиксованы осознанно (уникальны в своей части, самоочевидны):
«Здоровый противовес»-серии по стадиям — нет (они префиксованы), исключение — одиночные
уникальные H3 («Внутренняя проверка и независимость», «Ось N» и др.).

**Часть B — авто-кириллические id.** Источники: (1) Satteri heading-ids-плагин
(`@astrojs/markdown-satteri` 0.3.8) присваивает slug каждому h1–h6 без явного id
(включая HTML-заголовки); (2) `markdown.rehypePlugins` в astro.config.mjs — legacy-путь,
требующий `@astrojs/markdown-remark`, который Satteri-контракт (`scripts/astro7-satteri-contract.mjs`)
прямо запрещает как прямую зависимость. ⇒ Единственный чистый путь — **postbuild-гигиена**:
`scripts/pastor-series-heading-id-hygiene.js` (удаление `id` с не-латинским значением с h1–h6
на 8 публикационных страницах II–IX; явные латинские id — partToc-якоря — не трогаются;
residual-assert = fail-fast). Вшита в `strangler:build` и `strangler:build:production-like`.
Результат: 98 авто-id сняты (19/4/4/14/35/9/3/10 по частям), 0 внутри `<script>`.
Безопасность: in-MDX anchor-ссылок нет ни в одном файле; «Конспект»-карточки строятся из
partToc (латинские явные id); landing/catalog не читают авто-slug (census pass-11).

### WU-3.2 (outline Части I) — DONE
`src/components/article-pilots/antisovetov/AntisovetovBody.astro`:
- 20 × `<h4 class="anti-kicker">` (кикеры-коробки) → `<div class="anti-kicker"><strong>…</strong></div>` —
  декоративные метки больше не заголовки;
- 4 зеркало/скрытый-способ `<h4 class="heading-serif text-2xl">` → `<h3>` (по месту в иерархии:
  под h2 «Двустороннее зеркало…» и h2 «Скрытый способ…»);
- h2 «Эта статья — не приговор…» выровнен на канонический класс h2 Части I;
- каскад: h1 (page) → 14 h2 → 24 h3; 0 h4 до первого h3; 0 скипов h1→h4.

### WU-3.1 (типографика, единая система I ↔ II–IX) — DONE
**Корневые причины (найдены при верификации):**
1. `data-series-theme="manuscript"` отсутствует на body статей II–IX и Части I ⇒ ВСЕ
   manuscript-правила (Playfair h2/h3, золотой борд под h2, золотые blockquote, kinetic,
   summary-card gold) были МЁРТВЫМИ на 9 публикационных страницах, хотя
   `css/series-manuscript.css` линкуется. Genesis6 (шаблон-донор) атрибут имеет.
2. `.heading-serif` в Части I определена в scoped `<style>` AntisovetovPageHead.astro —
   astro-scope (data-astro-cid) не покрывает AntisovetovBody ⇒ токен никогда не применялся;
   заголовки Части I фактически были на фикс-утилитах text-4xl/text-3xl (36/30px, Lora).

**Ремонт:**
- `data-series-theme="manuscript"` добавлен: body `PastorSeriesArticlePage.astro` (II–IX)
  и body `src/pages/articles/20-antisovetov-pastoru/index.astro` (Часть I; конфликтов нет —
  в Части I нет .gbs2-head/.gbs2-kinetic/.section-label, атрибут безопасно инертен там);
- токены вынесены в `css/series-manuscript.css` (глобальный файл, тема-scoped):
  `article h2.heading-serif` = Playfair + `clamp(20px, 3.2vw, 24px)` + border + margin clamp(44–70)/20;
  `article h3.heading-serif` = Playfair + `clamp(17px, 2.5vw, 20px)` + margin clamp(32–50)/16;
  `article h4.heading-serif` = Playfair 1.15rem. Шкала = точное зеркало `article h2/h3`
  в css/site.css ⇒ Часть I и II–IX в единой clamp-системе, media-паритет по построению;
- из AntisovetovPageHead.astro удалены мёртвые scoped-копии + добавлен
  `<link href="../../css/series-manuscript.css">`;
- сняты фикс-утилиты с 42 заголовков (14 h2: text-4xl/mt-16/mb-8; 20 h3: text-3xl;
  8 h3/h4: text-2xl) — разметка теперь честна относительно применяемого CSS.

### Верификация
- `npm run strangler:build` — 0 errors; hygiene-шаг в логе: 8 pages, 98 stripped;
- dist: Часть I — theme-атрибут ✓, series-manuscript.css в head ✓, правило
  `[data-series-theme="manuscript"] article h2.heading-serif{…Playfair…clamp(20px, 3.2vw, 24px)…}`
  в dist/css/series-manuscript.css ✓, 0 фикс-утилит на h2/h3 ✓, первый h2 раньше первого h3 ✓;
- dist II–IX: theme-атрибут ✓ (Playfair + борд действуют), 0 кириллических id,
  латинские partToc-id сохранены (metod, rannie-markery, stadiya-1..5, tri-osi) ✓;
- батарея: pastor-series:visual-parity:audit ✓, data:consistency ✓, page-ownership:dist ✓,
  contract:extract:dist ✓ (compare — только known baseline-drift, не новый),
  dist-publication-audit ✓.

### Следующее (не тронуто)
Волна 2 (WU-2.2 .bref ×239, WU-2.5 «Коротко», WU-2.6 таблица V, WU-2.7 note/info-box,
WU-2.8 og:alt Части I, N-1 quiz bias 62/64, N-2 глоссарий-safeguarding/senior, N-3 figure-обёртки),
Волна 5 (G-5 approval-пакет: diotrefy migration-freeze + Part I inconsistent-needs-review;
WU-5.0; WU-6.6 полный), WU-1.3 reading-time T1–T2 + links-graph N-4.
