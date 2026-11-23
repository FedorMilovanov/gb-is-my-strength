# Книга, серия, одиночная статья — один core, разные структуры

**Прямое уточнение владельца:** публикации будут трёх видов: книга, серия, одиночная статья. Общие TOC/левая/правая панели и движок; skin и представление адаптируются. Это уточняет предыдущий [план унификации](../unification-ce08ef67/UNIFICATION-PLAN.md), не вводит четвёртый runtime для книги.

## Точная база и изменения с прошлого исследования

PR2352 exact **445446050ebb8cebee612d2ea5c195ddc954a60a**,317comments на момент чтения. Прочитаны новые handoff W136, W38, W92c и panel witness7113696532; не конкурируем с их search/preview/CSS работами. Изолированный source archive, без нового dist/server/browser-build. Node22.22.3; используются зависимости существующего sandbox. Никаких правок Product или чужих worktrees.

Новое относительноce08:
- W136 удалил у «Продолжить» принудительный scrollIntoView; ожидаемая семантика — закрыть overlay и восстановить точное место. Выбор конкретной строки TOC по-прежнему навигация. Это общий panel contract для всех трёх моделей.
- `check-engine-contracts.js` на44544605 **PASS**. Source ownership speed badge исправлен; engine-sweep source теперь различает painted chip и прямоугольный hitbox. Прежние замечания по этим двум source assumptions закрыты; свежий browser225/225 у владельца не выдаю за свой прогон.
- `reader-toc-projection-contract-test.cjs` **15/15 PASS** на этом SHA.
- `overlay-runtime-contract-test.js` по-прежнему **FAIL** на требовании retiredgill-learning; прежний owner handoff остаётся актуальным, не повторное открытие Product-дефекта.
- CI snapshot на44544605 содержит ещё in-progress/queued jobs и не содержит completedfailure на момент получения; это НЕ fullgreen. MapEngine infra исправлялась отдельным владельцем. W57 на generic static dist не монтируется: W38 установил server-wiring причину старого Search gate, не keyboard product failure. Native production и injected W57 нужны как отдельные acceptance paths.

## 1. Нормативная модель публикаций

| Свойство | Одиночная статья | Серия | Книга |
|---|---|---|---|
|Существующее представление|Standalone article adapter|`SeriesConfig`, shape flat/omitted|`SeriesConfig`, `shape:'book'`|
|Смысл|Один самостоятельный документ|Самостоятельные опубликованные части, связанные порядком|Цельное произведение: главы-группы и опубликованные материалы внутри|
|Левое дерево|H2→H3→H4… текущего документа|Серия→часть/форзац→headings активной статьи|Книга→глава→опубликованная статья→headings активной статьи|
|Навигационный контекст|Только document/heading|Текущая часть отдельно от activeheading|Глава, текущая статья и activeheading — разные identities|
|Prev/next|Нет выдуманных частей; relatedlinks не становятся sequence|По каноническому publication order|По опубликованным материалам в chapter/book order; chapter не обязан иметь свой URL|
|Прогресс|Чтение документа|Документ+collection по existingowner|Документ+book по existingowner; отдельно согласовать chapteraggregate, не выдумывать реализованную метрику|
|Research справа|Доступные capabilities статьи|Те же controllers, данные текущей части/серии|Те же controllers, контекст текущей статьи/главы/книги|
|Quiz/notes/search/TTS|Canonical owners|Те же owners, иной data context|Те же owners, иной data context|
|Дизайн|Тема статьи/издания|Тема серии|Тема книги, обложка/типографика/оформление глав|

`page` и `special` остаются классами **поверхностей сайта**, не четвёртым/пятым видом литературной публикации. Хаб книги — landing с собственной политикой chrome, а не автоматически «ещё одна статья книги».

Текущая книжная реализация — **multi-route book**. Если появится цельная книга одним URL, EPUB-издание, тома или самостоятельные chapterURL, это будущие требования к content/adapter model. Их нельзя обещать как уже поддержанные. Нужен отдельный bounded design, сохраняющий core и существующие anchors/notes; не надо заранее переписывать всё в гиперуниверсальный движок.

## 2. Что проверено на реальных конфигурациях

Скрипт `../publication-shape-trace.cjs` импортирует **текущие Product functions**, а не реализует новый parser. TypeScript transpilation только для source-research, как в существующем contract. Полная трасса в`publication-trace.json`.

- Семь реальных configs: Gill, Baptist, Heart/hard-texts, Genesis6, Pastor, Apostasy, Teen.
- **68 страниц** из `cfg.pages`: каждую прогнали через `projectSeriesReaderToc`.
- **13 реальных authored headings** из`hermenevtikaToc.ts` прогнали через`projectStandaloneReaderToc` по настоящему canonicalroute.
- **79/79 source checks**:68page identities/unique keys/active-only hydration,7config immutability,1real standalone tree и3negative structural guards.

Это уточняющий trace поверх существующего15casecontract, **не новая независимая browser acceptance68routes** и не доказательство полноты всех site configs. Counts cfg.pages, classified routes и реально смонтированные panels имеют разный scope.

### Конкретные пути

**Серия Gill:**
```
series:dzhon-gill:page:part1
  → /articles/dzhon-gill-chast-1-chelovek/
  → headings только текущей part1
```
Форзацы имеют kindendpaper, остаются labelmarks. Они не становятся numberedparts только ради одинакового счётчика.

**Книга Baptist:**
```
series:russian-baptism:chapter:origins-and-first-brotherhood
  → series:russian-baptism:page:noch-na-kure
  → /baptisty-rossii/noch-na-kure/
  → 6 curated headings этой статьи
```
Корневые строки проекции:4chapter+1endpaper. Chapterlink указывает на первую существующую статью; отдельного `pages[chapterId]` нет. Имена главы/статьи не смешиваются с activeheading.

**Одиночная Hermenevtika:**
```
/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/
  → #sec-definitions / #sec-explanation / вложенные H3/H4 …
```
Все13nodes — heading. Не создаётся фиктивная книга/серия/«ЧастьI» ради общего компонента.

**Реальные satellites Genesis6:**`corpus` и`audit` принадлежат`enoch`. Projectionсохраняет actualPageId/satellitePageId, currentcoreстрока указывает наparent. На desktop rail не гидратируются headings родительской статьи как будто это headings спутника; собственный partaccordion остаётся владельцем satelliteTOC. Это известная adapterграница, не универсально завершённый TOC UI.

Negativeguards проверяют existingProductvalidators:
1. Structuralchapter нельзя выбрать как выдуманную опубликованную страницу.
2. Нельзя убрать`shape:'book'` и тихо сплющить настоящие chapters.
3. Нельзя сделать Gillкнигой, просто поменяв shape без chapters.

## 3. Как сделать панели общими, не стерев эти различия

### Общий TOC/view contract

Reuse`ReaderTocNode`/existingprojection, не новый формат дерева. Publisherconfig определяет порядок и labels; current route и active heading — разные входы. Общий presenter должен уметь показать kindchapter/page/endpaper/heading и вложенность, но не самостоятельно решать, что является главой/частью.

Внутри core операций всего несколько: раскрыть/свернуть узел; перейти по точномуhref; выделитьcurrentpage; показатьactiveheading; открыть/закрыть drawer; «Продолжить» закрывает и возвращает readingposition. Их implementation общий; captions, markers, covers и visual slots задаёт adapter.

**Не смешивать операции:**
- Chapterexpand — раскрытие группы, не обязательно переход.
- Chapterlink — существующий canonicalhref (сегодня может вести к первой статье).
- Articlelink — переход на реальную опубликованную страницу.
- Headinglink — точныйfragment, focus и правильный scrollport.
- Continue/Close — без навигации, hashmutation и принудительного «догоняющего» scroll.

### Левая панель

Нужны общие navigation slots для publicationidentity/structure, единая model/state semantics, общий OverlayRuntime lifecycle и совместимые rail/drawerpresenters. У singlearticle нет emptyseriesrows. У flatseries нет пустых chaptergroups. У book видна реальная chapterhierarchy. Не клонировать controller при переключении mobile/desktop.

Соседний независимый witness7113696532 уже показал наce08 смешанное presentation: seriesfamilies видят native`gbs2Toc`, standaloneвидит W57outline. Его browserпроверки не повторяем под новымименем: следующий implementationшаг — mappingactualnode/state/owner для объединения composition, не ещё один новый outline.

### Правая панель

Один shared researchhost/lifecycle; actualcapabilities и scopeконтента подставляет adapter. Scripture/glossary/notes/quiz используют canonicalproviders. Bookcontext может показывать названиеглавы и книги, но нельзя подменить route-scopednotes/quizattempts одним bookkey без отдельного решения и migrationproof. «Поиск по сайту», «по книге» и «по статье» — разные promises; scopeUI обязан соответствовать настоящему индексу.

### Визуал

Общие skeleton/interactions/accessibility не означают одинаковые цвета. Series/book/articlethemes задают palette, typographyroles, illustration/cardrendering через existingtokens/slots. Не копировать runtimeвместе с красивой карточкой. Сохранить ownerapprovedmobileClassic и desktopW57; новая структура книги не даёт разрешения на rejecteddesktopW58.

## 4. Следующие bounded implementation packages

1. **Existing sourcecontract reconciliation:** retiredLearningguard в ownerlane; не возвращать удалённый overlayрадиPASS. Speedsource/radiustickets уже закрыты на44544605 — не делать второйpatch.
2. **Trace-to-DOMmatrix четырёх представителей:** standaloneHermenevtika; flatGill; bookBaptist/Heart; satelliteGenesis6. Для каждого profile→config→projectionkeys→leftDOM→activeheading→rightcapabilities→OverlayRuntimeowner. НашsourceJSON закрывает dataчасть, не DOM/runtimeчасть.
3. **Один обратимый panelcompositionpilot:** reuse existingcore и existingOverlayRuntime; productionbootstrap отдельно от injectedpreview. Themes не менять. До начала согласовать owner/routeflag; не повторять уже действующий searchharnesslane.
4. **Browserproof:** bookchapter→article→heading, flatpart→heading, standaloneheading, satelliteparent/actualroute; click/Tab/Enter/Escape/Continue/back; exactscrollrestore, currentpagevsactiveheading. Shortlandscape, mobile/desktop, themes,200%zoom; physical/ATнепроверенное честноSKIP.
5. **Dataandcontentgates:** ссылки/notesanchors/attemptstate/readingresume при изменении themes/presenter, crossrouteidentity, nestedpanels; exactsame-text2Tim2:22две независимыепометки; coldprintиSYSjoinотдельно. Resizepersistenceуназначенногоowner.
6. **Расширение по approvedfamilies:** не по broadprefix/проценту. Booklanding/catalog/specialнеподключать автоматом. ProtectedNews/G3/Journal/NagornayaнеподменятьReaderом этойволной.

Параллельно стандарты статьи S1–S54 остаются общими для всех опубликованныхстатей независимо от publicationkind, но fullbook/series требует также целостного editorialorder/provenance/coverrights. Структурнаявалидность не заменяет фактологию и визуальнуюприёмку.

## 5. Evidence и ограничения

Рядом traceJSON,sourcecontractlogs и CIsnapshot. Повторить:
```
PRODUCT_ROOT=/path/to/exact/archive PRODUCT_SHA=445446050ebb8cebee612d2ea5c195ddc954a60a OUTPUT_DIR=/tmp/publication-trace node research/reader-gb-focus-audit-20261122/publication-shape-trace.cjs
```
Нет Productpatch, no newserver, no install/migration, no globalrollout. Sourcechecks не доказывают, что sharedpanels уже внедренывproduction. Draft/HOLDсохраняется; свежийHEAD/comments/CIпередimplementationобязателен.
