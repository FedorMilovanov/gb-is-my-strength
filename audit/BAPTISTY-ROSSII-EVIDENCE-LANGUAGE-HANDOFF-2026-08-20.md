# «Баптисты России» — evidence-language lane handoff

**Дата:** 2026-08-20
**Lane:** reader-facing content / spravochnik evidence language
**Branch:** `codex/baptisty-spravochnik-evidence-language`
**Base / rollback SHA:** `79d08053ca6c9f95ad6ab797c3ab045656f4e31c`
**Foundation:** merged PR #1765 (`Book Authority v2`)

## 1. Что требовалось

После Book Authority v2 публичный `/baptisty-rossii/spravochnik/` продолжал обучать читателя устаревшей внутренней шкале `A/B/C/D`, тогда как long-horizon authority разделяет:

- внутреннюю Research evidence model;
- независимые состояния access / locator / rights / publication;
- reader-facing объяснение происхождения и силы свидетельства.

Задача этого lane — синхронизировать именно публичный язык, не раскрывая внутреннюю бюрократию и не переписывая исторический корпус.

## 2. Что найдено на pre-flight

На base SHA:

- open PR: `0`;
- main совпадал с merge SHA #1765;
- route `/baptisty-rossii/spravochnik/` нативно использует:
  - `src/components/baptisty-rossii/BaptistyRossiiSpravochnikBody.astro`;
  - `src/components/baptisty-rossii/BaptistyRossiiSpravochnikPageHead.astro`;
- Body содержал заголовок `Уровни источников A/B/C/D`, четыре буквенные категории и ниже формулировку `документы уровня A`;
- PageHead повторял старое `уровни источников` в meta description, Twitter, Open Graph и JSON-LD description.

## 3. Что сделано

### PageHead

Commit `528a10c6158be77bdd7457cfe13cbda3b7186e9c`:

- meta description → `типы свидетельств`;
- Twitter description синхронизирован;
- Open Graph description синхронизирован;
- JSON-LD Article.description синхронизирован;
- title/canonical/image/CSP/runtime ownership не менялись.

### Reader body

Commit `883c30b3b415be32f74b83dc4a00c8ccc5a21e19`:

- сохранён стабильный `id="source-levels"`;
- публичный заголовок заменён на `Как различать источники и свидетельства`;
- A/B/C/D удалены как reader-facing taxonomy;
- добавлены понятные читателю категории:
  1. первичный документ;
  2. официальный документ или публикация;
  3. академическая реконструкция;
  4. память участника или позднее свидетельство;
  5. открытый или спорный вопрос;
- явно закреплено правило: сила формулировки не выше силы источника;
- внутренние Research-классификации и технические статусы названы закулисным редакционным инструментом, а не читательской шкалой;
- `документы уровня A` заменено на `первичные и официальные документы`;
- люди, даты, disputed-facts, map backlog, transfer backlog, glossary и source list сохранены по смыслу и структуре.

## 4. Что намеренно НЕ делалось

- не менялись Research enums / HOLDs;
- не создавался Product source-confidence registry;
- не менялись route slug/canonical/navigation;
- не менялись historical claims, даты событий и библиография;
- не добавлялись media/atlas/quizzes;
- не трогались reading-time значения;
- не трогался RSS date-collapse owner lane;
- не менялся frozen `data/editorial-metadata.json` вручную.

### Editorial modified date

Это реальное reader-facing изменение, но текущая metadata architecture хранит frozen route record в `data/editorial-metadata.json`. Этот lane **не будет вручную рассинхронизировать** PageHead, search, sitemap, feed и frozen registry одной локальной датой. Если owner решит отражать 2026-08-20 как editorialModifiedAt, это должно быть отдельной согласованной metadata projection operation по существующему registry workflow, а не ручная правка только JSON-LD.

## 5. Verification contract

До merge требуется exact-head CI на PR branch. Минимум:

- diff hygiene;
- Shared Files Guard / lane collision;
- Source Authority Contract;
- Deploy Candidate Contract;
- Visual Parity Guard;
- metadata/index readiness.

Не заявлять live production witness только на основании merge.

## 6. Definition of Done для этого lane

- [x] публичная A/B/C/D taxonomy удалена из Body;
- [x] `документы уровня A` удалено;
- [x] reader-facing evidence categories согласованы с Book Authority v2;
- [x] PageHead descriptions согласованы с Body;
- [x] stable anchor `#source-levels` сохранён;
- [x] historical content/source list не расширялись без evidence work;
- [ ] exact-head CI зелёный;
- [ ] PR merged;

## 7. Следующий lane

После merge: **Petersburg Golden Chapter**.

Сначала source-to-section matrix и scope boundary для нынешнего `peterburgskaya-liniya`; только затем редакционное расширение/разделение. Не начинать с красивого prose draft без доказательной матрицы и не смешивать Petersburg route-content с shared runtime/media-system изменениями.
