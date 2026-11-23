# Следующий шаг унификации: общие панели поверх существующих владельцев

**Source-only исследование.** Exact PR2352 SHA `643c619e3d15699ebe275e632ad504c8b7e1a747`, прочитаны327comments, включая W137–W140, W93 и W94. Нового dist/server/клона Git не создавал: обновлён только существующий временный source archive. Product, workflow, чужие процессы и canonical Windows preview не изменены. Работа — продолжение модели «книга / серия / одиночная статья», а не ещё один план с нуля.

## 1. Свежие закрытия, которые нельзя снова объявлять долгом

Собственные source-прогоны на643c619e:
- `overlay-runtime-contract-test.js`: **PASS** — retired Learning expectation исправлено W137. Наш прежний finding закрыт на этом SHA.
- `check-engine-contracts.js`: **PASS** — source location и rectangular hitbox contract уже исправлены.
- `reader-toc-projection-contract-test.cjs`: **15/15 PASS**.

W93/W138 разделили native и настоящий W57 preview origins; 50/50 Chromium/WebKit — результат владельцев, не наш новый browser-run. W139 print-lock6/6 не закрывает cold PDF2349. W140 правильный preview не auto-updater. W94 Listen выбирает native Play по85em, но требует отдельного browser/TTS witness. Не создавать повторный patch к этим изменениям.

`ci-snapshot.json`: exact643c619e, несколько jobs ещё IN_PROGRESS; полный green/release не заявляется. Cosmetic Product commits во время CI freeze не нужны. Наши commits только в собственной research-ветке, не перезапускают CI владельца2352.

## 2. Четыре реальных маршрута: profile → composition → state

`owner-map.json` получен существующим `buildPublicSurfaceRegistry()`, не самодельным resolver. Сохранены четыре canonical registry entries и24 проверенных source anchors с path/line/excerpt/hash. Это **карта исходников**, не browser/DOM readiness proof.

| Представитель | Истина структуры | Левая панель / TOC | Состояние чтения | Правая панель |
|---|---|---|---|---|
|Одиночная Hermenevtika `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/`|Profile article; authored `HERMENEVTIKA_TOC`; `projectStandaloneReaderToc`|HermenevtikaRail → ReaderRail; Grok nodes по существующему флагу; mobile owner `hermenevtika-toc`|ReaderRail подписан на GBReaderState/ReaderState; configure headingSelector, derived active row|Desktop W57 research — только injected pilot; наличие series quiz на standalone не предполагается|
|Серия Gill II `/articles/dzhon-gill-chast-2-uchenyi/`|Profile series/flat; GILL_SERIES; currentPage отдельно от section|SeriesReaderChrome → GillSeriesRail; native series/part overlays; часть+headings|floating controller подписан на тот же ReaderState через renderReaderState|Native Analytics внутри part overlay; single GillAnalyticsStudy переносится по host readiness; W57 research host|
|Книга Baptist `/baptisty-rossii/noch-na-kure/`|Profile series/book; BAPTIST_SERIES; chapter→published article→headings|Тот же SeriesReaderChrome/GillSeriesRail, другая конфигурация дерева и тема|Тот же ReaderState; chapter group не отдельный published document|Тот же capability host/controller; данные книги/статьи, не второй notes/quiz store|
|Спутник Genesis6 `/hard-texts/kniga-enoha-kotoroy-ne-bylo-kak-raznye-proizvedeniya-stali-korpusom/`|Config actualPageId=corpus, parent=enoch; satellite не четвёртый вид публикации|Видимая core-строка parent; собственный part accordion. Не подставлять headings enoch в corpus|Route identity остаётся corpus; active heading его реального документа|Те же capability owners; отдельная source/provenance identity спутника|

Это дополняет соседний browser witness7114500154 (33 реальных DOM targets на44544605), не выдаётся за его повторение на новом HEAD. Ни одному контроллеру нельзя делать вывод «книга» только из цвета/обложки или URL.

## 3. Карта состояния и событий — что сохранить

| Вид состояния | Текущий владелец / scope | Требование при общей композиции |
|---|---|---|
|Reading progress/current section/resume|`js/reader-state.js`: canonical key `gb:reader-state:v1:` + siteId + normalized route; subscribe API|Не создавать panel-local scrollspy/store и не менять key при выборе skin|
|Native TOC modal lifecycle|`js/site-utils.js` OverlayRuntime; floating controller owner names `gill-series-toc`, `gill-part-toc`, `gill-settings`; standalone `hermenevtika-toc`|Один stack/scroll snapshot/inert/focus owner; общая панель не создаёт второй lock|
|TOC tree identity|ReaderTocNode / SeriesConfig / authored headings|Chapter, published page и active heading — разные keys; ссылки сохраняют canonical href|
|Native rail collapse|Floating controller `gb:rail:toc-collapsed`|Перед переносом согласовать scope; не копировать/переименовать ключ автоматически и не смешивать с «закрыть modal»|
|Research open/follow presentation|W57 root/body classes `np-u-hide-right`, closure `manualRightChoice`; existing preview params|Transient presentation не превращать в новое persistent reading state; pin/follow отдельно от currentPage|
|Quiz attempt|`gb-reader-study-v1:` + location.pathname; signature полного answer bank|Host move сохраняет единственный controller/attempt; book-wide attempt key без migration decision запрещён|
|Research host placement|`reader-analytics-study.js`: moveTo/researchVisible; native marginalia / W57 `.np-u-right-scroll` / inline fallback|Перемещение, не clone; сохранить focus и exact answer state при смене host|
|Theme/text preferences|GBReaderPreferences / ReaderPreferencesHead|Один canonical store, разные theme adapters. Panel DOM не второй writer|
|Saved notes/quotes|Существующие Library/highlights/notes owners|Точный source/route/occurrence; этот audit не меняет схемы и не обещает закрытую atomicity2370|

Close/Continue не являются navigate. W136 это исправил: закрыть overlay, восстановить точный scroll и не менять hash. Heading/article link, наоборот, навигация. W94 Listen — ещё одна отдельная команда: закрыть panel и вызвать действующий transport; не перепутать c Continue.

## 4. Конкретная оставшаяся граница между core и pilot

### A. Canonical publication model и preview inspector пока не одно и то же

В source `reader_universal_preview.js` вызывает `GBReaderContract.inspect(document)`; `reader_universal_contract.js` ещё содержит `inferKind` по pathname/title и `buildGroups`, который может группировать H2 в ограниченное число visual groups. Например, Baptist prefix в inspector возвращает `series-chapter`, тогда как authoritative registry для выбранной Baptist route — `seriesShape:book`.

Это **доказанная source-разница классификаций**, не новый browser defect и не утверждение, что два TOC обязательно видны одновременно. Visual group ≠ настоящая chapter. Уже сохранённый desktop witness наce08 показывает, что некоторые native series rails остаются видимыми вместо W57 outline; количество DOM controllers по этому source audit не устанавливается.

**Реализация должна начинаться с явного mapping**, а не ещё одной heuristic: authoritative route/profile/config → существующий ReaderTocNode / publication identity → presenter slots. Inspector может оставаться исследовательским evidence extractor там, где его policies подтверждены, но не должен переопределять книгу/порядок/anchors на production. Не переносить его pathname heuristics в shared core.

### B. В pilot есть дополнительная геометрическая логика follow

`reader_universal_preview.js` содержит `currentGroupIndex()` (eyeline innerHeight*0.3), собственный passive scroll+rAF и `show()`/`makeSection()` для contextual research. Native ReaderRail/floating controller подписаны на ReaderState.

Это **подтверждённая integration boundary**, не доказательство двух persistent reading writers: у preview listener задача follow/context, в просмотренном участке он не пишет canonical reading storage. Но при production integration нельзя оставить две независимые трактовки active section без явной семантики. Визуальный research group может законно покрывать несколько headings; его identity должна быть производной от canonical section, а не второй конкурирующей active-heading истиной.

## 5. Первый bounded implementation candidate — без смены дизайна

**Предложение владельцу, ещё НЕ Product patch:** пилот адаптера *canonical reading state → existing research follow*, отдельный от большого переноса панелей и от search QA.

1. Записать baseline currentPage/sectionId и preview group на standalone / flat / book / satellite, включая before/after-content и очень длинный H2. Это ещё требуемая browser-работа, не закрыта24source anchors.
2. В существующем W57 presenter адаптировать canonical ReaderState.sectionId в текущий contextual group через уже имеющиеся group.items IDs. Не выводить chapter из visualgroup. Никакого нового parser, geometry loop или storage.
3. Сохранить ручные pin/follow/panel-close states; subscription обновляет derived context только в follow mode. Существующая явная navigate-команда не должна ждать scroll event для focus/source correctness.
4. Под readiness/существующим pilot opt-in использовать только один context-follow источник. Не включать одновременно старую geometry subscription и новую. Rollback — прежний presenter path без storage migration; exact флаг/место выбрать с owner, не добавлять второй production registry.
5. При missing/unknown sectionId не угадывать nearest chapter и не менять currentPage: честно сохранить/present neutral context по согласованному контракту. Для satellites использовать actual route headings, а не parent headings.
6. До production promotion доказать parity; native controls, width, fonts, approved W57 desktop, mobile Classic и стили карточек не менять. Затем отдельной маленькой работой common panel composition; не делать всё одним mega-refactor.

**Почему это первый маленький шаг:** общая картинка панели без общего section/state mapping оставляет два разных «где сейчас читатель». Сначала убираем семантический разрыв, потом безопасно объединяем presenters/lifecycle. Это не значит, что существующий ReaderState нужно переписать.

## 6. Приёмка кандидата, раздельная по книге/серии/статье

- Статья: active H2/H3/H4 обновляет одинаковый contextual group, без фиктивной chapter/series и без потери authored labels.
- Серия: currentPage остаётся part2 при изменении active H2/H3; endpaper и satellite не превращаются в numbered core part.
- Книга: current chapter и current published article сохраняются; visual research group не подменяет настоящую chapter; structural chapter URL может совпадать с первой статьёй, keys не сливаются.
- Спутник: parent core selection и actual satellite route различаются; контекст из текущего документа, не parent.
- Pin/follow: pinned card не меняется от scroll; после unpin догоняет canonical context; no stale selection/duplicate event; user-chosen closed rail не открывается сам.
- Continue/Escape/Close сохраняют scroll/hash; явный target link даёт exact focus/navigation; modifier links не перехватываются как обычный navigate.
- Проверить readiness, transition и TTS owner на1120/1121 и около85em (native breakpoint != W57 injection breakpoint), включая text zoom. W94 source test не заменяет этих реальных кликов.
- Same-dist dual-origin: shipped native отдельно от real preview.py W57; без force-click, без автоскрытия off, без утверждения productionintegration по localhost.
- Mobile/desktop, normal/reduced motion, book/flat/article/satellite, left/right/settings nested lifecycle; short landscape. Resize persistence — у назначенного владельца, не параллельная реализация.
- No schema change; existing quotes/notes/quiz attempt unaffected; protected News/G3/Journal/Nagornaya и special apps не получают новый shell этой волной.

## 7. Что можно делать сейчас, пока CI заканчивается

Read-only browser baseline, согласование интерфейса и source-to-state mapping; не косметические pushes в2352. После exact-head matrix и owner lease — один маленький approved candidate с rollback и screenshots. Notes P0, cold first-print, SYS35min/OG/railCover join, production bootstrap и protected MDX pilot остаются отдельными gate.

Исследование не объявляет общие панели завершёнными. Сохраняется цель владельца: **один core; книга, серия и одиночная статья; общие механизмы TOC/панелей и индивидуальные skins.**
