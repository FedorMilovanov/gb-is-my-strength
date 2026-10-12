# Branch cleanup disposition — 2026-10-13

**Политика:** `docs/BRANCH_LIFECYCLE_V4.md` (v4.3): §1 безопасность, §6 классы, §10 порядок чистки.
**Основание:** owner-задача 2026-10-13 — «чистка нужна, но проверять надо все, чтобы работа
оставленная хорошая не ушла».
**Предыдущие реестры:** `audit/BRANCH-CLEANUP-DISPOSITION-2026-09-29.md`,
`audit/LAWSON-BRANCH-CLEANUP-DISPOSITION-2026-10-12.md`.
**База:** `main = d14da74cfe9f45e9b03e383e8e622695b01f8e16`; сессионная ветка
`arena/fbf6f1fd-gb-is-my-strength` (PR #2183) = `6771b8ec95`.
**Область:** только remote refs; ни один PR не закрывался и не мержился, `main` не менялся.

## 1. Методика — четыре независимые проверки, все read-only

1. **Ancestry.** `git rev-list --count origin/main..origin/<b>`: `0` ⇒ в ветке нет ни одного
   коммита сверх `main` (класс `FULLY_REPRESENTED_BY_ANCESTRY`).
2. **Пофайловое представление.** Для каждого файла из `git diff --name-status <merge-base>..origin/<b>`
   сравниваются blob'ы с `main`; если содержимое различается, проверяется, что **все** добавленные
   строки уже есть в `main` **и все** удалённые строки в `main` уже отсутствуют. Файл, прошедший
   обе половины, считается представленным; иначе — частичным (часть строк новая) или
   непредставленным.
   *Почему обе половины:* дельты бывают чисто удаляющими (например, `arena/avraam-preserve-ready-h1-20261002`
   — 19 удалений, 0 добавлений). Первая версия проверки считала такие файлы «представленными»;
   это было исправлено до финального прогона, и именно поэтому PR #2161 не попал ни в один
   батч на удаление — его правка в `main` **отсутствует**.
3. **Карта близнецов.** `git ls-tree -r` по всем 42 remote refs: ветка считается дублем, только
   если **вся** её дельта (по всем путям) байт-в-байт (тот же git-объект) лежит на другой живой
   ветке. Совпадение одного файла — не дубль: старые ветки часто несут одинаково устаревшие
   копии `package.json`/`package-lock.json`/`search-manifest.json`.
4. **Контекст решений.** Сверка с реестрами 2026-09-29 и 2026-10-12: HOLD-записи, «D-evidence»
   набор, снятые с обсуждения refs — учитываются как ограничения, а не как мусор.

Результат по 49 веткам: **8** — ноль коммитов сверх `main`; **7** — полный байт-дубль на другой
ветке; **34** — несут содержимое, которого больше нигде нет.

## 2. Исполненный батч — 8 refs с нулевой работой (`FULLY_REPRESENTED_BY_ANCESTRY`)

Все восемь — указатели на уже существующие коммиты `main` (не «похожие», а те же самые объекты),
без PR, без ссылок в workflow и в содержимом репозитория (проверено grep'ом по `.github/workflows`
и по репозиторию). Удаление не может потерять работу: удалять было нечего.

| Ветка | Head SHA | Коммитов сверх `main` | Коммит, на который указывала ветка | Восстановление |
|---|---:|---:|---|---|
| `arena/quiz-contract-repair-20261002` | `d586aa63f02b569cfe050a63cc9078c044375d8d` | 0 | `d586aa63f0` 2026-09-30 — docs(audit): closure record for branch-cleanup cycle (PR #21 | `git push origin d586aa63f02b569cfe050a63cc9078c044375d8d:refs/heads/arena/quiz-contract-repair-20261002` |
| `arena/quiz-dark-surface-token-20261002` | `d586aa63f02b569cfe050a63cc9078c044375d8d` | 0 | `d586aa63f0` 2026-09-30 — docs(audit): closure record for branch-cleanup cycle (PR #21 | `git push origin d586aa63f02b569cfe050a63cc9078c044375d8d:refs/heads/arena/quiz-dark-surface-token-20261002` |
| `arena/quiz-next-owner-scope-20261002` | `d586aa63f02b569cfe050a63cc9078c044375d8d` | 0 | `d586aa63f0` 2026-09-30 — docs(audit): closure record for branch-cleanup cycle (PR #21 | `git push origin d586aa63f02b569cfe050a63cc9078c044375d8d:refs/heads/arena/quiz-next-owner-scope-20261002` |
| `arena/quiz-next-owner-scope-20261003` | `69d3aa13361063a6aaa6272553c4874866829fa0` | 0 | `69d3aa1336` 2026-10-02 — content(lawson): canonical hardened article + unblocked depl | `git push origin 69d3aa13361063a6aaa6272553c4874866829fa0:refs/heads/arena/quiz-next-owner-scope-20261003` |
| `arena/quiz-plain-text-contract-20261002` | `d586aa63f02b569cfe050a63cc9078c044375d8d` | 0 | `d586aa63f0` 2026-09-30 — docs(audit): closure record for branch-cleanup cycle (PR #21 | `git push origin d586aa63f02b569cfe050a63cc9078c044375d8d:refs/heads/arena/quiz-plain-text-contract-20261002` |
| `noop` | `f7d617d0c8b864e79475f7545c842c5f6c3b93f4` | 0 | `f7d617d0c8` 2026-09-30 — fix(lawson): classify publication as standalone article | `git push origin f7d617d0c8b864e79475f7545c842c5f6c3b93f4:refs/heads/noop` |
| `noop2` | `f7d617d0c8b864e79475f7545c842c5f6c3b93f4` | 0 | `f7d617d0c8` 2026-09-30 — fix(lawson): classify publication as standalone article | `git push origin f7d617d0c8b864e79475f7545c842c5f6c3b93f4:refs/heads/noop2` |
| `fix/serdce-i-duh-mdx-em-20260930` | `d0e04a9c7ac78082f44ad70c4b1e3bbf50b5065b` | 0 | `d0e04a9c7a` 2026-09-24 — Merge PR #2137: bind genealogy editorial evidence to reviewe | `git push origin d0e04a9c7ac78082f44ad70c4b1e3bbf50b5065b:refs/heads/fix/serdce-i-duh-mdx-em-20260930` |

Команда исполнения: `git push origin --delete <branch>` для каждого ref, 2026-10-13.
Проверка после: `git ls-remote --heads origin` → **50 → 42** heads (`main` + 41 ветка).

**Отдельная оговорка про три refs.** `noop`, `noop2` и `fix/serdce-i-duh-mdx-em-20260930` были
перечислены в реестре 2026-09-29 в разделе «Вне scope (активная работа владельца 2026-09-30), не
трогать». Эта запись защищала **ту сессию**, а не содержимое: проверка показывает 0 коммитов
сверх `main`, а сам фикс «сердце и дух» ушёл в `main` через PR #2149 (ветка `-v2` уже удалена).
Запись снимается явно и осознанно, а не «по имени и возрасту»; восстановление каждого ref —
одна команда из таблицы выше.

## 3. Инвентарь 41 оставшейся ветки (срез 2026-10-13)

Колонка «изменено / в main / дубли / только здесь» отвечает на вопрос «сколько файлов ветка
меняет относительно своего merge-base; сколько из них уже в `main`; сколько байт-в-байт
повторяется на других живых ветках; сколько есть только здесь».

| Ветка | Head | PR | ahead/behind | Последний коммит | изменено / в main / дубли / только здесь | Класс | Что делать |
|---|---|---|---|---|---|---|---|
| `arena/01a108e4-gb-is-my-strength` | `fdaabf0c5d` | Open #2168 | 6/85 | 2026-10-05 | 2 / 0 / 0 / 2 | ACTIVE_OR_IN_FLIGHT | открытый PR — не трогать |
| `arena/avraam-preserve-ready-h1-20261002` | `fe7f0bca97` | Open #2161 | 1/91 | 2026-10-03 | 1 / 0 / 0 / 1 | ACTIVE_OR_IN_FLIGHT | открытый PR — не трогать |
| `arena/fbf6f1fd-gb-is-my-strength` | `6771b8ec95` | Open #2183 | 5/0 | 2026-10-12 | 6 / 0 / 0 / 6 | ACTIVE_OR_IN_FLIGHT | открытый PR — не трогать |
| `arena/kod-da-vinchi-timeline-keyboard-20261002` | `45a3ee760c` | Open #2162 | 1/91 | 2026-10-03 | 1 / 0 / 0 / 1 | ACTIVE_OR_IN_FLIGHT | открытый PR — не трогать |
| `content/apostasy-five-part-series-20261003` | `a95697592c` | Open #2164 | 5/91 | 2026-10-03 | 5 / 0 / 0 / 5 | ACTIVE_OR_IN_FLIGHT | открытый PR — не трогать |
| `dependabot/github_actions/github-actions-c673fd7efc` | `aa3f0edacb` | Open #2179 | 1/5 | 2026-10-12 | 74 / 0 / 0 / 74 | ACTIVE_OR_IN_FLIGHT | открытый PR — не трогать |
| `dependabot/npm_and_yarn/npm-non-major-92ac384687` | `a3d4d5282a` | Open #2144 | 1/5 | 2026-10-12 | 2 / 0 / 0 / 2 | ACTIVE_OR_IN_FLIGHT | открытый PR — не трогать |
| `deps/npm-non-major-20260906-r2` | `7131246133` | Closed #1827 | 4/1131 | 2026-09-06 | 3 / 2 / 0 / 1 | ACTIVE_OR_IN_FLIGHT | зависимости: трогать только по явной заявке (AGENTS) |
| `fix/karty-holding-mobile-overflow-2180` | `0f2cb8ab97` | Open #2181 | 1/5 | 2026-10-12 | 1 / 0 / 0 / 1 | ACTIVE_OR_IN_FLIGHT | открытый PR — не трогать |
| `fix/npm-non-major-security-20260907` | `77fa9fc1e7` | — | 5/1131 | 2026-09-07 | 3 / 2 / 1 / 0 | ACTIVE_OR_IN_FLIGHT | зависимости: трогать только по явной заявке (AGENTS) |
| `genealogy/editorial-direct-name-batch-20260924` | `acd4ace420` | Open #2143 | 3/125 | 2026-09-24 | 5 / 0 / 0 / 5 | ACTIVE_OR_IN_FLIGHT | открытый PR — не трогать |
| `reconcile/baptist-ch01-authority-salvage-20260924` | `71a4f5290c` | Open #2142 | 1/130 | 2026-09-24 | 1 / 0 / 1 / 0 | ACTIVE_OR_IN_FLIGHT | открытый PR — не трогать |
| `reconcile/ch01-pre-baptist-origins-research-20260911` | `a22513308d` | — | 3/649 | 2026-09-11 | 1 / 0 / 1 / 0 | HOLD (решение 2026-09-29) | ждёт #2142 — его fallback-близнец (идентичный blob) |
| `agent/antisovetov-title-suffix-20260818` | `60ed203402` | — | 1/1224 | 2026-08-18 | 1 / 0 / 1 / 0 | SQUASH_OR_PATCH_EQUIVALENT | дельта байт-в-байт есть на: repair/antisovetov-title-suffix-20260906 |
| `agent/bible-app-deep-playwright-audit-20260819` | `3899f3d0de` | — | 6/1194 | 2026-08-19 | 3 / 2 / 1 / 0 | SQUASH_OR_PATCH_EQUIVALENT | дельта байт-в-байт есть на: agent/bible-app-deep-playwright-r2-20260819, codex/baptisty-spravochnik-evidence-language |
| `fix/quiz-runtime-namespace-20261003` | `f0eceafea6` | Closed #2165 | 1/90 | 2026-10-04 | 2 / 1 / 1 / 0 | SQUASH_OR_PATCH_EQUIVALENT | дельта байт-в-байт есть на: arena/01a108e4-gb-is-my-strength |
| `repair/antisovetov-title-suffix-20260906` | `f85e002289` | Closed #1813 | 1/1144 | 2026-09-06 | 1 / 0 / 1 / 0 | SQUASH_OR_PATCH_EQUIVALENT | дельта байт-в-байт есть на: agent/antisovetov-title-suffix-20260818 |
| `agent/app-integration-zero-debt-20260820` | `723e82cc10` | — | 2/1181 | 2026-08-20 | 8 / 2 / 0 / 6 | UNIQUE_EVIDENCE | уникальных файлов: 6 — land или archive (решение владельца) |
| `agent/bible-app-deep-playwright-r2-20260819` | `2ed8512e59` | — | 2/1193 | 2026-08-19 | 4 / 2 / 1 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `arena/01a0a1b2-gb-is-my-strength` | `b51452e7e6` | — | 18/291 | 2026-09-15 | 73 / 28 / 14 / 31 | UNIQUE_EVIDENCE | уникальных файлов: 31 — land или archive (решение владельца) |
| `arena/01a0a1b4-gb-is-my-strength` | `b8c7f2c07b` | Closed #2058 | 4/289 | 2026-09-14 | 9 / 3 / -2 / 8 | UNIQUE_EVIDENCE | уникальных файлов: 8 — land или archive (решение владельца) |
| `arena/01a0a1ce-gb-is-my-strength` | `0a1748d271` | — | 7/290 | 2026-09-15 | 152 / 6 / -3 / 149 | UNIQUE_EVIDENCE | уникальных файлов: 149 — land или archive (решение владельца) |
| `arena/01a0f415-gb-is-my-strength` | `5517a8c538` | Closed #2153 | 6/92 | 2026-09-30 | 9 / 5 / -1 / 5 | UNIQUE_EVIDENCE | уникальных файлов: 5 — land или archive (решение владельца) |
| `arena/header-cluster-audit-20261002` | `339bf2e2b6` | Closed #2158 | 1/90 | 2026-10-04 | 5 / 1 / 0 / 4 | UNIQUE_EVIDENCE | уникальных файлов: 4 — land или archive (решение владельца) |
| `arena/header-cluster-repair-20261002` | `7ad067a0ec` | Closed #2160 | 2/92 | 2026-10-02 | 1 / 0 / 0 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `audit/baptisty-total-production-audit-20260911` | `f906fa7989` | — | 2/645 | 2026-09-11 | 1 / 0 / 0 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `book/ch07-mazaev-prokhanov-research-v2` | `2a5687bd64` | — | 2/1146 | 2026-09-06 | 2 / 0 / 0 / 2 | UNIQUE_EVIDENCE | уникальных файлов: 2 — land или archive (решение владельца) |
| `codex/baptisty-spravochnik-evidence-language` | `528d9e5d5d` | — | 5/1169 | 2026-08-20 | 5 / 2 / 0 / 3 | UNIQUE_EVIDENCE | уникальных файлов: 3 — land или archive (решение владельца) |
| `content/apostasy-bible-study` | `994b8735f7` | Closed #2145 | 1/125 | 2026-09-28 | 1 / 0 / 0 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `fix/genealogy-relation-confidence-localization` | `24b9ff5c2a` | — | 1/192 | 2026-09-16 | 1 / 0 / 0 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `fix/quiz-plain-text-payload-20261003` | `39aecaf722` | — | 3/91 | 2026-10-03 | 1 / 0 / 0 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `fix/series-taxonomy-projection-20260911` | `6163135fd4` | — | 1/653 | 2026-09-11 | 7 / 0 / 0 / 7 | UNIQUE_EVIDENCE | уникальных файлов: 7 — land или archive (решение владельца) |
| `lane/baptisty-book-production-status-20260906` | `f95bce556e` | Closed #1795 | 2/769 | 2026-09-10 | 1 / 0 / 0 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `lane/metadata-reconcile-tma-pr518-20260908` | `e486b50449` | Closed #1881 | 6/893 | 2026-09-08 | 1 / 0 / 0 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `lane/metadata-review-decision-rimlyanam7-20260908` | `24cf91ec9e` | Closed #1908 | 1/876 | 2026-09-08 | 1 / 0 / 0 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `lane/metadata-standalone-three-reconciliation-20260908` | `08ae4a42ee` | Closed #1912 | 1/861 | 2026-09-08 | 1 / 0 / 0 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `lane/teen-core-content-clearance-20260908` | `bedb511019` | Closed #1925 | 1/844 | 2026-09-08 | 1 / 0 / 0 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `reconcile/baptisty-book-status-20260911` | `4c24749130` | — | 1/645 | 2026-09-11 | 1 / 0 / 0 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `reconcile/baptisty-media-recovery-20260911` | `a85cd926d3` | — | 1/645 | 2026-09-11 | 1 / 0 / 0 / 1 | UNIQUE_EVIDENCE | уникальных файлов: 1 — land или archive (решение владельца) |
| `repair/source-surface-audit-completeness-20260906` | `38ded86097` | Closed #1828 | 1/1131 | 2026-09-06 | 3 / 1 / 0 / 2 | UNIQUE_EVIDENCE | уникальных файлов: 2 — land или archive (решение владельца) |
| `system/fix-article-quiz-next-ownership` | `3120d0f0ae` | Closed #2157 | 2/92 | 2026-10-02 | 2 / 0 / 0 / 2 | UNIQUE_EVIDENCE | уникальных файлов: 2 — land или archive (решение владельца) |

## 4. Что нельзя удалять (и почему)

* **12 refs класса `ACTIVE_OR_IN_FLIGHT`** — 10 веток с открытыми PR (#2142, #2143, #2144, #2161,
  #2162, #2164, #2168, #2179, #2181, #2183) и 2 npm/dependabot-ветки вне PR
  (`deps/npm-non-major-20260906-r2` — HOLD под #2144; `fix/npm-non-major-security-20260907`);
  зависимости по `AGENTS.md` меняются только по явной заявке владельца.
* **`reconcile/ch01-pre-baptist-origins-research-20260911`** — класс `HOLD (решение 2026-09-29)`:
  «ждёт #2142». Проверка подтверждает, почему: это fallback-близнец ветки PR #2142
  (blob `d3272f65e707` идентичен). Удалять только после судьбы #2142.
* **Набор «D-evidence»** из реестра 2026-09-29 (`agent/*`, аудиты pastor/reader) — сохранён как
  доказательная база с SHA; ни один из них не удаляется этим батчем.
* **24 ветки класса `UNIQUE_EVIDENCE`** — каждая несёт файлы, которых нет ни в `main`, ни на
  другой живой ветке (от 1 до 149 файлов). Это не мусор: это незавершённые лейны.

## 5. Предлагаемый второй батч (доказан байт-сравнением, ждёт решения владельца)

| Ветка | Head | Доказательство | Предложение |
|---|---:|---|---|
| `reconcile/ch01-pre-baptist-origins-research-20260911` | `a22513308d` | дельта = 1 файл, blob `d3272f65e707` идентичен ветке PR #2142 | удалить сразу после merge #2142 (или раньше — по подтверждению владельца) |
| `fix/quiz-runtime-namespace-20261003` | `f0eceafea6` | `css/floating-cluster.css` + `sw.js` байт-в-байт в ветке PR #2168 | удалить после merge #2168 — до этого ref остаётся страховкой |
| `agent/antisovetov-title-suffix-20260818` | `60ed203402` | правка одной строки `AntisovetovPageHead.astro`, идентична `repair/antisovetov-title-suffix-20260906` (PR #1813 закрыт без merge) | свести пару к одному ref (рекомендуется оставить `repair/…` — он новее) |
| `agent/bible-app-deep-playwright-audit-20260819` | `3899f3d0de` | содержимое контракта идентично r2 (`scripts/bible-app-browser-contract.mjs` = blob `0b2173921a` в обеих; то же для `bible-app-browser-contract.yml`), но **журнал не покрыт**: 6 коммитов истории контракта (2026-08-19) есть только на этой ветке, у r2 — 2 своих коммита | оставить r2 как рабочую, удалять первую только если владелец признаёт историю контракта незначимой — иначе обе остаются |

`fix/npm-non-major-security-20260907` (`77fa9fc1e7`) по байт-сравнению тоже целиком повторяется на
других ветках, но это npm-дифф ⇒ решение ждёт ветку зависимостей (#2144).

## 6. Что осталось решить по 24 веткам с уникальным содержимым

* **Baptisty-исследования (5 refs, все — одиночные документы):** `audit/baptisty-total-production-audit-20260911`
  (`147-total-production-audit`, +251), `reconcile/baptisty-media-recovery-20260911`
  (`147-media-container-recovery`, +103), `reconcile/baptisty-book-status-20260911`
  (`148-book-production-reconciliation`, +165), `lane/baptisty-book-production-status-20260906`
  (`84-book-production-status-and-marathon-plan`), `book/ch07-mazaev-prokhanov-research-v2`
  (2 документа гл. 7). В `main` нумерованный ряд обрывается на 99 — это не дубли, а неслитые
  записи. Решение: land (небольшим отдельным PR) или archive-ref.
* **Прошлые сессионные ветки с широкой дельтой:** `arena/01a0a1ce` (149 уникальных файлов —
  reader-audit), `arena/01a0a1b2` (31 — pastor-series аудиты), `arena/01a0a1b4` (8),
  `arena/01a0f415` (5 — quiz-данные), `arena/header-cluster-*` (Header.astro, два разных
  варианта). Это кандидаты на `SELECTIVE_RECOVERY`: переносить нужное с свежего `main`, а не
  мержить целиком.
* **Метаданные/контент:** 3 ветки `lane/metadata-*` (решения ревью), `lane/teen-core-content-clearance`,
  `content/apostasy-bible-study`, `fix/series-taxonomy-projection`, `fix/quiz-plain-text-payload`,
  `system/fix-article-quiz-next-ownership`, `fix/genealogy-relation-confidence-localization`,
  `codex/baptisty-spravochnik-evidence-language`, `repair/source-surface-audit-completeness`,
  `agent/app-integration-zero-debt`.

## 7. Проверка после батча (policy §10.6)

* `git ls-remote --heads origin` = 42 (было 50); список ровно на 8 короче, добавленных ref нет.
* Сверка remote ↔ локальные tracking refs: расхождений **0** (0 stale, 0 missing, 0 sha-mismatch).
* Локальные stale-копии удалённых refs сняты (4 из 8 жили вне узкого fetch-refspec и не
  удалялись `--prune`).
* Восемь удалённых head-SHA достижимы из `main` — сборщик мусора их не заберёт, восстановление
  возможно и через запись в этой таблице.

## 8. Честный статус

* **Сделано:** полный read-only разбор 49 веток (ancestry + пофайлово + карта близнецов + сверка
  с реестрами) и удаление **8 refs с нулевой работой**; записан каждый head SHA и команда
  восстановления; инвентарь перепроверен после батча.
* **Не сделано:** ни одна ветка с уникальным содержимым не удалена — по каждой оставшейся дано
  фактическое состояние (сколько файлов уникально) и решение, которое требуется от владельца.
  Второй батч (4 refs) доказан, но не исполнен: его безопасность зависит от судьбы открытых PR.
* **Ограничение:** это срез на 2026-10-13; при новых пушах в `main` пофайловые вердикты нужно
  пересчитывать (скрипты разбора — воспроизводимые однострочные git-проверки, описанные в §1).
