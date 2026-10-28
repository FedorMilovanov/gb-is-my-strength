# Archive Registry — карта архивных тегов после branch cleanup 2026-10-28

## Lane record

- **Mode:** LANE (docs-only audit registry; без product-кода, без изменения тегов/веток)
- **Lane / owner:** `AUDIT-ARCHIVE-REGISTRY` / сессия `arena/1e61863b-gb-is-my-strength`
- **Purpose and bounded scope:** дать каждому архивному тегу владельца в виде реестра: что сохранено, точный SHA, как восстановить, что с этим делать дальше. Этот файл — карта, а не разрешение на удаление.
- **Base / rollback SHA:** `main@2d5b1474014596860734fd3de45cf9efe401476d` (merge #2208); rollback — предыдущий `cdf994b`.
- **Allowed files:** только этот файл и `audit/APOSTASY-RECOVERY-PLAN-2026-10-28.md`.
- **Adjacent active work / overlap:** открытых PR на момент записи — 0; disposition-история уже в `audit/BRANCH-CLEANUP-DISPOSITION-2026-10-28.md` и `audit/BRANCH-CLEANUP-ADDENDUM-2026-10-28.md` (этот реестр их не дублирует, а даёт индекс восстановления).
- **Source of truth:** `git ls-remote --tags`, точные head SHA закрытых PR, форензика tip/textual против `main`.
- **Required checks:** `git diff --check`; сверка SHA тегов с `ls-remote`.

## Состояние после cleanup (замер 2026-10-28)

- Remote-ветки: **1** (`main`). Открытые PR: **0**.
- Теги: **143**, из них `archive/*` — **52** (этот реестр), `retired/*` — 45, `forensic/*` — 21, `before-*` — 23, `pre-*` — 2.
- По всем 1182 веткам истории PR: ни одного head без учёта (merge / archive-тег / `refs/pull/<PR>/head` — 389 веток восстановимы через pull-ref).

## Правило обращения с тегами

Тег из этого реестра **не удаляется** без обновления этого файла и записи, куда делось содержимое (влито в main с SHA / признано мусором владельцем / перенесено в другое хранилище). Для 111 тегов их цель — единственный именованный ref на коммит.

Восстановление любой ветки из тега:

```bash
git push origin <TAG_SHA>:refs/heads/<original-branch>
# или локально:
git branch <original-branch> <archive-tag>
```

## Реестр archive/* (52)

| Тег | SHA | Исходная ветка / PR | Рекомендация |
|---|---|---|---|
| `archive/pr-20-gill-series-shared-chrome-2026-06-27` | `82f52e3` | снимок PR #20 эпохи | Морозить. Исторический снимок. |
| `archive/stale-2026-06-28/lane/system-current-truth-cleanup-2026-06-27` | `aa9dd52` | lane/system, без PR в текущем реестре | Морозить. |
| `archive/stale-2026-06-28/lane/system-premiumcontrols-*` (6 тегов) | `bce706e`, `3a0939d`, `dfedc0d`, `03b0c5b`, `f1e0122`, `f2bb858` | PremiumControls-июнь | Морозить. Поверхность переписана с тех пор. |
| `archive/stale-2026-09-30/agent/antisovetov-title-suffix-20260818` | `60ed203` | #1705 CLOSED | **Решение владельца** (title-фикс, дважды непринят). См. пару ниже. |
| `archive/stale-2026-09-30/repair/antisovetov-title-suffix-20260906` | `f85e002` | #1813 CLOSED | Тот же blob, что #1705. Одна disposition на обе. |
| `archive/stale-2026-09-30/agent/app-integration-zero-debt-20260820` | `723e82c` | без PR | Морозить (частично superseded bible-app линией). |
| `archive/stale-2026-09-30/agent/bible-app-deep-playwright-audit-20260819` | `3899f3d` | #1729 CLOSED | Морозить: 99% строк уже в main. |
| `archive/stale-2026-09-30/agent/bible-app-deep-playwright-r2-20260819` | `2ed8512` | #1742 CLOSED | Морозить: 99% в main. |
| `archive/stale-2026-09-30/arena/01a0a1b2-gb-is-my-strength` | `b51452e` | без PR | **Разобрать кластером** с `01a0a1b4`/`01a0a1ce` (pastor-волна 09-14/15). Контент есть. |
| `archive/stale-2026-09-30/arena/01a0a1b4-gb-is-my-strength` | `b8c7f2c` | #2058 CLOSED | Тот же кластер. |
| `archive/stale-2026-09-30/arena/01a0a1ce-gb-is-my-strength` | `0a1748d` | без PR | Тот же кластер (reader-refactor, 152 файла). |
| `archive/stale-2026-09-30/audit/baptisty-total-production-audit-20260911` | `f906fa7` | без PR | Морозить: аудит-снимок. |
| `archive/stale-2026-09-30/book/ch07-mazaev-prokhanov-research-v2` | `2a5687b` | без PR | **Сохранять**: уникальный research (source matrix + visual dossier ch07). Кандидат в книгу. |
| `archive/stale-2026-09-30/codex/baptisty-spravochnik-evidence-language` | `528d9e5` | #1766 CLOSED | Морозить: ~89% в main. |
| `archive/stale-2026-09-30/lane/baptisty-book-production-status-20260906` | `f95bce5` | #1795 CLOSED | Морозить. |
| `archive/stale-2026-09-30/lane/metadata-reconcile-tma-pr518-20260908` | `e486b50` | #1881 CLOSED | Морозить до metadata-решения владельца (editorial-metadata). |
| `archive/stale-2026-09-30/lane/metadata-review-decision-rimlyanam7-20260908` | `24cf91e` | #1908 CLOSED | **Сохранять**: decision JSON, в main нет. |
| `archive/stale-2026-09-30/lane/metadata-standalone-three-reconciliation-20260908` | `08ae4a4` | #1912 CLOSED | **Сохранять**: decision JSON, в main нет. |
| `archive/stale-2026-09-30/lane/teen-core-content-clearance-20260908` | `bedb511` | #1925 CLOSED | **Сохранять**: content clearance, в main нет. |
| `archive/stale-2026-09-30/reconcile/baptisty-book-status-20260911` | `4c24749` | без PR | Морозить. |
| `archive/stale-2026-09-30/reconcile/baptisty-media-recovery-20260911` | `a85cd92` | без PR | Морозить. |
| `archive/stale-2026-09-30/repair/source-surface-audit-completeness-20260906` | `38ded86` | #1828 CLOSED | Морозить: частичный остаток аудита. |
| `archive/stale-2026-10-28/arena/01a0f415-gb-is-my-strength` | `5517a8c` | #2153 CLOSED | Морозить: ~85% в main. |
| `archive/stale-2026-10-28/arena/01a108e4-gb-is-my-strength` | `fdaabf0` | #2168 CLOSED | Эквивалент main (класс A). Можно хоронить по решению владельца. |
| `archive/stale-2026-10-28/arena/avraam-preserve-ready-h1-20261002` | `fe7f0bc` | #2161 CLOSED | Эквивалент main (класс A). |
| `archive/stale-2026-10-28/arena/header-cluster-audit-20261002` | `339bf2e` | #2158 CLOSED | Морозить: ~89% в main; поверхность занята #2203-линией. |
| `archive/stale-2026-10-28/arena/header-cluster-repair-20261002` | `7ad067a` | #2160 CLOSED | Морозить: остаток — решение владельца. |
| `archive/stale-2026-10-28/arena/kod-da-vinchi-timeline-keyboard-20261002` | `45a3ee7` | #2162 CLOSED | Морозить: линия доехала в main другим путём (#2188). |
| `archive/stale-2026-10-28/content/apostasy-bible-study` | `994b873` | #2145 CLOSED | **Сохранять**: готовая мега-статья 78 КБ. См. APOSTASY-RECOVERY-PLAN. |
| `archive/stale-2026-10-28/content/apostasy-five-part-series-20261003` | `a956975` | #2164 CLOSED | **Сохранять**: 5 частей серии, 187 КБ, draft-кандидаты. См. план. |
| `archive/stale-2026-10-28/dependabot/*` (5 тегов) | `8dfc5b6`, `630d016`, `69a7ed4`, `a112751`, `5690d18` | #2179/#2198/#2196/#2144/#2197 CLOSED | Мусор с предохранителем: dependabot перегенерирует. Хоронить можно, ценности нет. |
| `archive/stale-2026-10-28/deps/npm-non-major-20260906-r2` | `7131246` | #1827 CLOSED | Предок `fix/npm-non-major-security` — уникального нет. |
| `archive/stale-2026-10-28/fix/genealogy-relation-confidence-localization` | `24b9ff5` | без PR | Содержимое влито через #2204. Дубль — хоронить можно. |
| `archive/stale-2026-10-28/fix/home-lifecycle-shortcut-test-sync-20261027` | `838fb97` | #2205 CLOSED | **ЗАКРЫТО 2026-10-28 (superseded, разобран)**: `js/site-utils.js` тега байт-идентичен main (blob совпал); тест `scripts/home-browser-lifecycle-contract.mjs` в main равен финальной версии #2205 (`waitForTimeout(500)`, `retained is-open`, recovery window) и новее на 1 строку (платформенный `shortcutChord` successor-правки). Уникального остатка нет; cache-bust коммит поглощён собственными ревизиями main. Восстанавливать нечего. |
| `archive/stale-2026-10-28/fix/karty-holding-mobile-overflow-2180` | `0f2cb8a` | #2181 CLOSED | Эквивалент main (класс A). |
| `archive/stale-2026-10-28/fix/npm-non-major-security-20260907` | `77fa9fc` | без PR | Морозить (deps-линия сентября; lock перегенерирован). |
| `archive/stale-2026-10-28/fix/quiz-plain-text-payload-20261003` | `39aecaf` | без PR | Морозить: временный CI-workflow, ценности как продукт нет. |
| `archive/stale-2026-10-28/fix/quiz-runtime-namespace-20261003` | `f0eceaf` | #2165 CLOSED | **Решение владельца**: стратегия `#glsQuizNext` против `.gb-quiz-next` (#2157). |
| `archive/stale-2026-10-28/fix/series-taxonomy-projection-20260911` | `6163135` | без PR | Морозить: не влито, нужен продуктовый разбор. |
| `archive/stale-2026-10-28/genealogy/editorial-direct-name-batch-20260924` | `acd4ace` | #2143 CLOSED | **Сохранять**: зелёный draft, ждёт owner review контента. |
| `archive/stale-2026-10-28/reconcile/baptist-ch01-authority-salvage-20260924` | `71a4f52` | #2142 CLOSED | Морозить: 100% строк уже в main (textual). |
| `archive/stale-2026-10-28/reconcile/ch01-pre-baptist-origins-research-20260911` | `a225133` | без PR | Морозить: fallback к #2142. |
| `archive/stale-2026-10-28/system/fix-article-quiz-next-ownership` | `3120d0f` | #2157 CLOSED | **Решение владельца** (см. quiz-runtime пара). |

## Очередь решений владельца (не удалять до слова владельца)

1. **Контент**: apostasy (мега и/или серия), #2143 genealogy, ch07 research, pastor-кластер.
2. **Продуктовые развилки**: Antisovetov title (1 строка, дважды), quiz-namespace (2 стратегии).
3. **Можно хоронить без потерь** (после записи в этом файле): класс A (`01a108e4`, `avraam`, `karty-holding`), genealogy-дубль #2204, dependabot-теги, `deps/r2`.

## Проверка этого реестра

- SHA сверены с `git ls-remote --tags origin` на `main@2d5b147`.
- Форензика классов — tip/textual сравнение против main (методика: compare API + blob-SHA + присутствие добавленных строк).
- Этот файл ничего не удаляет и не перемещает.
