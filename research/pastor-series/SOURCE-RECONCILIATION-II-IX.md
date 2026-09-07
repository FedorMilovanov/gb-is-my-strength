# Тёмная сторона кафедры — source reconciliation Parts II–IX

Статус: **ACTIVE EDITORIAL RECONCILIATION / NO PUBLICATION PROMOTION**
Дата: 2026-09-07
Product anchor / rollback: `2a5bad736ff76651b1dcf26371ea8872862d1d66`
Original reconciliation base: `066be4fb24089a549ae3b3089700332586585850`
Current Research root authority anchor: `FedorMilovanov/Research@56fca4d5a3dbbc4ddb68d4ed5708e91649be8086`
Part II evidence snapshot remains pinned in its receipt at: `FedorMilovanov/Research@e8e6b98787019d43a2ffd10eb55bdde04ebfb747`
Канон серии: `research/pastor-series/MASTER-PLAN.md`
Внешняя evidence authority: `FedorMilovanov/Research` → stable `CURRENT_AUTHORITY.md`, current control-plane/root files и corpus-specific authorities, выбранные ими на соответствующем exact Research anchor. Исторический exact snapshot не переписывается задним числом только потому, что root entrypoint продвинулся.

## 1. Назначение и граница

Этот файл закрывает только **карту источников и оставшегося source debt** для уже существующих content-only manuscripts Parts II–IX.

Он **не**:

- делает manuscript опубликованным;
- снимает `draft:true` или `noindex:true`;
- создаёт public route;
- подтверждает live/production state;
- переносит Research case closure автоматически в reader wording;
- разрешает новую прямую цитату без первичного locator;
- заменяет jurisdiction/safety, cross-link, christological или release pass из `MASTER-PLAN.md`; для частей, где отдельный exegesis gate уже закрыт receipt, этот факт фиксируется явно и не распространяется на соседние части.

Publication gate остаётся fail-closed до отдельного доказательства для каждой части.

## 2. Governing evidence rules

### 2.1. Иерархия

Для этой серии действует следующий порядок:

1. **Писание** — первичная богословская authority для библейских и нравственных тезисов.
2. **Current Research authority / machine-ledger** — authority для современных кейсов, маршрутизации, claim boundary и quote-safe статуса.
3. **Первичный публичный источник конкретного утверждения** — обязателен для сильного factual claim и прямой цитаты, когда он доступен.
4. **Качественная вторичная литература** — служит экзегетическим, историческим или pastoral support, но не повышает силу утверждения выше доказательств.
5. **Google Drive copies / учебные конспекты** — discovery/support only. Они не становятся reader authority только потому, что доступны в Drive.

### 2.2. Research closure ≠ article source closure

Current OSK corpus уже имеет закрытую case routing/evidence основу, но это не означает, что любое предложение Parts II–IX автоматически готово к публикации.

Перед release каждая reader-facing factual формулировка должна быть сопоставлена с:

- типом утверждения: biblical / exegetical / historical / contemporary-case / prudential;
- допустимым evidence level;
- точным source ID или публичным URL;
- locator, когда источник длинный;
- корректным процессуальным статусом (`alleged`, `reported`, `investigated`, `found`, `adjudicated`, `admitted`, `disputed` и т. п.);
- permitted wording;
- quote-safe статусом для прямой цитаты.

### 2.3. Drive boundary

В Google Drive не найден отдельный master-документ серии по точным названиям «Тёмная сторона кафедры», «20 антисоветов» или «антисоветы». Найденные материалы являются поддерживающим слоем:

- John MacArthur / Grace to You Q&A (`GTY135`) — релевантен границам пастырской власти, Евр. 13:17, подотчётности и вопросу stay/leave; **перед reader citation требуется проверить публичный первичный GTY locator**, а не цитировать Drive-копию как authority;
- учебный курс «Служение пастора II» — широкий компилятивный ecclesiology/pastoral background; пригоден только как discovery/B-support и требует возврата к первичным авторам;
- Wolfgang Klippert, «От текста к проповеди» — полезен как методологический support для экзегезы, включая различение этимологии и значения слова; не является case authority.

Приватные Drive URLs/IDs намеренно не переносятся в публичный репозиторий.

## 3. Матрица Parts II–IX

| Part | Product manuscript | Прямой Research backbone | Что уже есть | Открытый source gate | Текущий статус |
| --- | --- | --- | --- | --- | --- |
| **II** | `src/content/articles/anatomiya-padeniya-pyat-stadiy.mdx` | historical dossier 28 + current OSK routing + `research/pastor-series/PART-II-SOURCE-RECEIPT.md` | Bounded wording; public source projection; exact-count defect removed; manuscript blob `3bdd78ab9e9c928e36c3e32acca41b445b63c0f3` | **Нет открытого source gate.** Scripture/exegesis, cross-link, christological, technical/release gates остаются отдельными | `SOURCE_PASS / OTHER_GATES_OPEN` |
| **III** | `src/content/articles/teksty-pisaniya-kotorymi-manipuliruyut.mdx` | historical dossier 31 + active Research correction overlay `31A_SCRIPTURE_TEXTS_MANIPULATED_EXEGESIS_CORRECTIONS_2026-09-07.md` + первичные библейские тексты + `research/pastor-series/PART-III-SOURCE-EXEGESIS-RECEIPT.md` | 23/23 bounded exegesis verdicts; Мф. 18:15 textual note; disputed Greek claims checked; Синодальные reader quotes checked; exact reader-safe public bibliography; manuscript blob `94d9c7a707a4d3e6e0c17faa9aeaba1099f854f1` | **Нет открытого source/exegesis gate.** Jurisdiction/safeguarding application, cross-link, christological, technical/release gates остаются отдельными | `SOURCE_EXEGESIS_PASS / OTHER_GATES_OPEN` |
| **IV** | `src/content/articles/sem-tipov-razlichenie-uchiteley.mdx` | `.../30_TEACHER_TAXONOMY_MASTER_AND_CUNNING_AXIS.md` + current OSK case-routing authorities | Семь категорий и редакционный принцип «сила утверждения не сильнее доказательств» | Для каждого современного примера проверить current routing/decision authority; не превращать taxonomy в психиатрический диагноз или окончательный приговор без evidence | `DIRECT_DOSSIER / CASE_ROUTING_RECHECK_OPEN` |
| **V** | `src/content/articles/cerkovnaya-disciplina-vlast-granicy-zashchita.mdx` | `.../32_CHURCH_DISCIPLINE_THEOLOGY.md` + Писание + точные конфессиональные/первичные источники | Положительное богословие власти, дисциплины, совести и подотчётности | Проверить 1689 LBCF по первичному тексту и locator; Leeman/9Marks/GRACE/Kruger — public locators; не использовать этимологию `κατά` как аргумент; Drive GTY135 — только discovery до первичной проверки | `DIRECT_DOSSIER / CONFESSION_AND_PRIMARY_LOCATOR_PASS_OPEN` |
| **VI** | `src/content/articles/kogda-uhodit-kogda-ostavatsya.mdx` | `.../33_WHEN_TO_LEAVE_WHEN_TO_STAY.md` + `.../43_WAVE10_FAITHFUL_WITNESS_UNDER_PRESSURE_2026-08-01.md` | Decision framework и документированные pathways членов/служителей под давлением | Сопоставить practical claims с первичными case locators; отдельно не смешивать source verification с jurisdiction/safeguarding pass; Drive GTY135 может быть secondary support после проверки оригинала | `DIRECT_DOSSIER / PATHWAY_LOCATOR_PASS_OPEN` |
| **VII** | `src/content/articles/vernye-i-neizvestnye-zdorovoe-pastyrstvo.mdx` | Писание + Wave 10 как supporting positive/accountability corpus | Сильный библейский каркас: 1 Тим. 3; Тит. 1; Деян. 20; 1 Пет. 5; Евр. 13; реальные positive/accountability pathways доступны в Research | Нет отдельного numbered dossier и нет явного reader source-map; сначала классифицировать каждое внешнее/историческое утверждение, затем привязать только нужные claims к W10/current primary source. Не создавать новый case roster | `BIBLICAL_BACKBONE_READY / CLAIM_MAP_OPEN` |
| **VIII** | `src/content/articles/priznaki-zdorovoy-cerkvi.mdx` | Писание + dossier 32 + Wave 10; OSK governance evidence как support | Библейские нормы + institutional safeguards: plurality, complaint path, due process, conflicts, finance, confidentiality | Явно разделить **библейскую норму** и **prudential control**. Для финансовых, governance и safeguarding best-practice claims нужен соответствующий public support; не выдавать разумную процедуру за прямую заповедь стиха | `BIBLICAL_AND_GOVERNANCE_BACKBONE / PRUDENTIAL_SOURCE_MAP_OPEN` |
| **IX** | `src/content/articles/nesovershennyy-chelovek-v-nesovershennoy-cerkvi.mdx` | Писание + dossier 30 + dossier 33 + Wave 10 | Финальный двусторонний guardrail: эпизод ≠ система, боль ≠ доказанный мотив, твёрдость ≠ автоматически abuse | Термин `gaslighting` либо получить узкий reader-safe источник/определение, либо оставить только наблюдаемые библейские категории поведения; проверить, что современные психологические термины нигде не становятся нравственной authority | `DISCERNMENT_BACKBONE_READY / TERMINOLOGY_AND_CLAIM_MAP_OPEN` |

## 4. Что НЕ нужно исследовать заново

Следующие блоки уже имеют достаточный backbone, чтобы не открывать новый широкий research marathon:

- Part II — source pass закрыт bounded receipt; новые источники нужны только при добавлении нового конкретного reader claim;
- Part III — source + Scripture/exegesis pass закрыты bounded receipt; новые источники нужны только для нового reader claim или отдельного jurisdiction/safeguarding gate;
- Part IV — teacher taxonomy уже существует;
- Part V — church-discipline theology уже существует;
- Part VI — stay/leave dossier + Wave 10 pathways уже существуют;
- Parts VII–IX могут опираться на Писание и существующие positive/accountability/discernment данные; сначала нужен **claim mapping**, а не сбор ещё сотен ссылок.

Новые источники добавляются только для **конкретной обнаруженной дыры**: отсутствующий primary locator, спорный экзегетический вывод, prudential best-practice claim или современный factual claim, который не покрыт current authority.

## 5. Что осталось по source gate

На этих anchors:

- manuscripts II–IX существуют: **8/8**;
- Parts II–IX с завершённым article-level primary-locator/source-list pass: **2/8** — Parts II–III;
- Parts II–IX с открытым source pass: **6/8** — Parts IV–IX;
- Part III дополнительно имеет отдельный `SCRIPTURE_EXEGESIS_GATE = PASS`; это не переносится автоматически на Part II или Parts IV–IX;
- Parts II–IX publication-ready **в целом**: **0/8** — source/exegesis PASS не закрывает safety/cross-link/christological/technical/release gates;
- case-level OSK Research closure не пересчитывается в «8/8 статей готовы»;
- public core остаётся **1/9** по опубликованным римским частям до отдельных release PR.

Это означает: source publication barrier снят с Parts II–III, но **publication promotion не разрешён ни для одной из восьми unpublished частей**.

## 6. Порядок source-verification pass

Закрытые receipts:

- Part II — `research/pastor-series/PART-II-SOURCE-RECEIPT.md`;
- Part III — `research/pastor-series/PART-III-SOURCE-EXEGESIS-RECEIPT.md`.

Дальнейшая последовательность:

1. **Part IV** — taxonomy + current routing decisions;
2. **Part V** — confession / ecclesiology / primary-source cleanup;
3. **Part VI** — pathway locators; jurisdiction/safety остаётся отдельным gate;
4. **Part VII** — claim classification + minimal positive source map;
5. **Part VIII** — biblical norm vs prudential governance source map;
6. **Part IX** — terminology/discernment source map.

После каждого source pass статья всё ещё остаётся draft/noindex до остальных gate из `MASTER-PLAN.md`.

## 7. Exit criteria этой reconciliation-матрицы

Этот файл можно считать закрытым как planning authority только когда для Parts II–IX существует восемь bounded receipts, каждый из которых фиксирует:

- exact Product manuscript SHA;
- governing Research authority/version;
- список factual/exegetical claims, требующих внешнего evidence;
- source ID / URL / locator / evidence class;
- allowed wording и оставшуюся неопределённость;
- quote-safe решение;
- публично пригодный source-list projection;
- результат source gate: `PASS` или точный `HOLD`.

Текущий счётчик receipts: **2/8**.

До полного source reconciliation канонический статус: **MANUSCRIPTS EXIST / SOURCE PASSES 2/8 / NO PUBLICATION PROMOTION**.
