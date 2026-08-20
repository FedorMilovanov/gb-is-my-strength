# «Баптисты России» — evidence-language lane handoff

**Дата:** 2026-08-20
**Lane:** reader-facing content / spravochnik evidence language
**Branch:** `codex/baptisty-spravochnik-evidence-language`
**Base / rollback SHA:** `79d08053ca6c9f95ad6ab797c3ab045656f4e31c`
**Foundation:** merged PR #1765 (`Book Authority v2`)
**PR:** #1766 — `content(baptisty): align spravochnik evidence language`

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

### Durable lane handoff

Commit `1ec73b040ad9a6af182e83ffe986b2cfea227834` добавил этот handoff и стал первым human exact-head checkpoint до canonical generated-projection reconciliation.

## 4. Что намеренно НЕ делалось

- не менялись Research enums / HOLDs;
- не создавался Product source-confidence registry;
- не менялись route slug/canonical/navigation;
- не менялись historical claims, даты событий и библиография;
- не добавлялись media/atlas/quizzes;
- не трогались reading-time значения;
- не открывался отдельный repair для известного Baptist RSS date-collapse;
- не менялся frozen `data/editorial-metadata.json` вручную;
- не вносились runtime/homepage/search-modal правки из-за unrelated browser-server failures старого head.

### Editorial modified date

Это реальное reader-facing изменение, но текущая metadata architecture хранит frozen route record в `data/editorial-metadata.json`. Этот lane **не будет вручную рассинхронизировать** PageHead, search, sitemap, feed и frozen registry одной локальной датой. Если owner решит отражать 2026-08-20 как editorialModifiedAt, это должно быть отдельной согласованной metadata projection operation по существующему registry workflow, а не ручная правка только JSON-LD.

`Editorial Dateline Contract` на human head `1ec73b040ad9a6af182e83ffe986b2cfea227834` завершился `SUCCESS`, то есть эта граница не потребовала локального обхода frozen metadata authority.

## 5. Canonical discovery projection repair

### Первичный fail-closed сигнал

На human head `1ec73b040ad9a6af182e83ffe986b2cfea227834` Search Manifest Policy run `32358374758` остановился на единственном содержательном drift:

```text
/baptisty-rossii/spravochnik/
old: ... уровни источников ...
new: ... типы свидетельств ...
```

Это не было исправлено ручным редактированием большого generated JSON. Репозиторий уже имеет canonical label-gated writer в `.github/workflows/search-manifest-policy.yml`, который строит production-like `dist`, запускает тот же normalizer с `--write`, ограничивает допустимую mutation surface и CAS-push'ит только при действующем writer lease.

### Первый autofix не был обойдён

Первый label-trigger Search Manifest run `32358995314` / #1229 корректно `FAIL CLOSED` на `Snapshot machine writer lease`, потому что ранний PR body ещё не содержал `GB_WRITER_LEASE_V1`.

Сообщение было точным: PR body must contain exactly one writer lease marker.

Вместо отключения проверки или ручного push в PR body добавлен активный Writer Lease v1:

- `laneId`: `baptisty-spravochnik-evidence-language-20260820`;
- `pr`: `1766`;
- `branch`: `codex/baptisty-spravochnik-evidence-language`;
- `ownerToken`: `chatgpt:baptisty-spravochnik-evidence:20260820-g1`;
- `generation`: `1`;
- `acquisitionSha`: `1ec73b040ad9a6af182e83ffe986b2cfea227834`.

После этого `autofix` label был снят и добавлен снова, чтобы новый `labeled` event получил актуальный immutable PR body, а не старый event payload.

### Canonical writer convergence

Search Manifest Policy run `32359333765` / #1230 принял lease:

- `Snapshot machine writer lease` — SUCCESS;
- `Reject stale or foreign writer before mutation` — SUCCESS.

Canonical writer продвинул branch до `eba51e09fc031862589698053d60fa473b944e8c`.

Exact machine-only diff от `1ec73b...` до `eba51e09...`:

- `data/search-manifest.json` — ровно `+1/-1`;
- `feed.xml` — ровно `+1/-1`;
- других файлов — `0`.

Обе projection surfaces теперь несут одну и ту же reader authority:

`Справочник серии: люди, даты, документы, типы свидетельств, спорные факты и исторические связи.`

`autofix` label после convergence снят. Следующий commit этого lane — только финализация handoff; machine mutation больше не разрешается без нового явного lease/handoff процесса.

## 6. Старые browser failures: как их классифицировать

На human head `1ec73b...`:

- Visual Parity Guard run `32358374747` завершился failure после browser-side HTTP 500 на несвязанной home surface;
- Search Modal Contract run `32358374765` также увидел browser/server HTTP 500, а не evidence-language semantic assertion.

Эти результаты **не считаются доказательством Baptist regression и не считаются закрытыми как external flake**. Они принадлежат старому head и должны быть переоценены только по final-head rerun.

Правило:

- если final-head contracts зелёные — старые 500 остаются obsolete-head infrastructure/browser incidents;
- если HTTP 500 повторится на final head — разбирать новый exact run до root cause;
- не вносить unrelated homepage/search/runtime изменения в этот content lane без повторяемого final-head доказательства.

## 7. Verification contract

До merge требуется exact-head CI на финальном PR head. Минимум:

- diff hygiene;
- Shared Files Guard / lane collision;
- Source Authority Contract;
- Deploy Candidate Contract;
- Visual Parity Guard;
- Search Manifest Policy без writer mutation;
- Search Modal Contract;
- Editorial Dateline Contract;
- metadata/index readiness;
- применимые glossary/scripture/native/print contracts.

Не заявлять live production witness только на основании merge.

## 8. Definition of Done для этого lane

- [x] публичная A/B/C/D taxonomy удалена из Body;
- [x] `документы уровня A` удалено;
- [x] reader-facing evidence categories согласованы с Book Authority v2;
- [x] PageHead descriptions согласованы с Body;
- [x] stable anchor `#source-levels` сохранён;
- [x] historical content/source list не расширялись без evidence work;
- [x] canonical search/RSS projections сведены штатным writer, без ручного generated-file patch;
- [x] `autofix` после machine convergence снят;
- [ ] final exact-head CI зелёный;
- [ ] writer lease retired после final admission;
- [ ] PR merged.

## 9. Следующий lane

После merge: **Petersburg Golden Chapter**.

Сначала source-to-section matrix и scope boundary для нынешнего `peterburgskaya-liniya`; только затем редакционное расширение/разделение. Не начинать с красивого prose draft без доказательной матрицы и не смешивать Petersburg route-content с shared runtime/media-system изменениями.

Read-only preflight уже установил важную границу: legacy roadmap указывал исчезнувшую Research branch `work`, поэтому новые переносы обязаны использовать current Research `main` и current authority. Нынешний Petersburg route одновременно питает planned chapters 5–9 и потому не может считаться одной готовой будущей главой. Следующий lane должен документировать READY / VERIFY / HOLD по каждому сильному claim и direct quote до изменения reader prose.