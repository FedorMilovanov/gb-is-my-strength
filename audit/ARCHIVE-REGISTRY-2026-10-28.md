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
| `archive/stale-2026-10-28/content/apostasy-bible-study` | `994b873` | #2145 CLOSED | **ЗАКРЫТО 2026-10-28**: мега-статья опубликована одиночным пилларом `/hard-texts/otstuplenie-ot-very-iuda-evreyam-6/` (PR #2215, решение владельца «пиллар + серия-кластер»). Тег сохранять как provenance. |
| `archive/stale-2026-10-28/content/apostasy-five-part-series-20261003` | `a956975` | #2164 CLOSED | **ЗАКРЫТО 2026-10-28**: серия восстановлена байт-в-байт PR #2210 (merge `d056a19`), все 5 частей в main как `draft:true/noindex:true`. Публикация — отдельный owner-этап. Тег сохранять как provenance. |
| `archive/stale-2026-10-28/dependabot/*` (5 тегов) | `8dfc5b6`, `630d016`, `69a7ed4`, `a112751`, `5690d18` | #2179/#2198/#2196/#2144/#2197 CLOSED | Мусор с предохранителем: dependabot перегенерирует. Хоронить можно, ценности нет. |
| `archive/stale-2026-10-28/deps/npm-non-major-20260906-r2` | `7131246` | #1827 CLOSED | Предок `fix/npm-non-major-security` — уникального нет. |
| `archive/stale-2026-10-28/fix/genealogy-relation-confidence-localization` | `24b9ff5` | без PR | Содержимое влито через #2204. Дубль — хоронить можно. |
| `archive/stale-2026-10-28/fix/home-lifecycle-shortcut-test-sync-20261027` | `838fb97` | #2205 CLOSED | **ЗАКРЫТО 2026-10-28 (superseded, разобран)**: `js/site-utils.js` тега байт-идентичен main (blob совпал); тест `scripts/home-browser-lifecycle-contract.mjs` в main равен финальной версии #2205 (`waitForTimeout(500)`, `retained is-open`, recovery window) и новее на 1 строку (платформенный `shortcutChord` successor-правки). Уникального остатка нет; cache-bust коммит поглощён собственными ревизиями main. Восстанавливать нечего. |
| `archive/stale-2026-10-28/fix/karty-holding-mobile-overflow-2180` | `0f2cb8a` | #2181 CLOSED | Эквивалент main (класс A). |
| `archive/stale-2026-10-28/fix/npm-non-major-security-20260907` | `77fa9fc` | без PR | Морозить (deps-линия сентября; lock перегенерирован). |
| `archive/stale-2026-10-28/fix/quiz-plain-text-payload-20261003` | `39aecaf` | без PR | Морозить: временный CI-workflow, ценности как продукт нет. |
| `archive/stale-2026-10-28/fix/quiz-runtime-namespace-20261003` | `f0eceaf` | #2165 CLOSED | **Решение владельца**: стратегия `#glsQuizNext` против `.gb-quiz-next` (#2157). |
| `archive/stale-2026-10-28/fix/series-taxonomy-projection-20260911` | `6163135` | без PR | Морозить: не влито, нужен продуктовый разбор. |
| `archive/stale-2026-10-28/genealogy/editorial-direct-name-batch-20260924` | `acd4ace` | #2143 CLOSED | **ЗАКРЫТО 2026-10-28**: пакет из 11 имён принят PR #2211 (merge `4b0cc8a`) после независимой сверки форм с Синодальным текстом; по ходу закрыта и поломка пина источника (commit-pin в `scripts/genealogy-build/config.mjs`, upstream переименовал файл 2026-09-24). Тег сохранять как provenance. |
| `archive/stale-2026-10-28/reconcile/baptist-ch01-authority-salvage-20260924` | `71a4f52` | #2142 CLOSED | Морозить: 100% строк уже в main (textual). |
| `archive/stale-2026-10-28/reconcile/ch01-pre-baptist-origins-research-20260911` | `a225133` | без PR | Морозить: fallback к #2142. |
| `archive/stale-2026-10-28/system/fix-article-quiz-next-ownership` | `3120d0f` | #2157 CLOSED | **Решение владельца** (см. quiz-runtime пара). |

## Приложение: остальные классы тегов (97) — учтены 2026-10-28

Полная сверка всех 143 тегов репозитория с документацией: перечисленные ниже теги не являются
открытой работой. Это снапшоты безопасности мая 2026, baseline-снапшоты и provenance-истории
июльских чисток веток (2026-07-30) и июньских SYSTEM-lane. Содержательных недоделов за ними нет;
теги не удаляются (правило §20 выше), действий не требуется.

| Тег | SHA | Диспозиция |
|---|---|---|
| `archive/stale-2026-10-28/dependabot/github_actions/github-actions-c673fd7efc` | `8dfc5b630` | Dependabot-PR, закрыт по красному CI; обновление перегенерируется dependabot. Provenance. |
| `archive/stale-2026-10-28/dependabot/npm_and_yarn/astrojs/react-7.1.1` | `630d016f9` | Dependabot-PR, закрыт по красному CI; обновление перегенерируется dependabot. Provenance. |
| `archive/stale-2026-10-28/dependabot/npm_and_yarn/npm-non-major-69a9df4a08` | `69a7ed448` | Dependabot-PR, закрыт по красному CI; обновление перегенерируется dependabot. Provenance. |
| `archive/stale-2026-10-28/dependabot/npm_and_yarn/npm-non-major-92ac384687` | `a1127516d` | Dependabot-PR, закрыт по красному CI; обновление перегенерируется dependabot. Provenance. |
| `archive/stale-2026-10-28/dependabot/npm_and_yarn/pixelmatch-8.0.0` | `5690d18b7` | Dependabot-PR, закрыт по красному CI; обновление перегенерируется dependabot. Provenance. |
| `archive/stale-2026-06-28/lane/system-premiumcontrols-asset-hash-truth-2026-06-27` | `bce706eaa` | Июньский SYSTEM-lane premiumcontrols; закрыт сверкой в docs/refactor-2026/lanes/system-premiumcontrols-*. Provenance. |
| `archive/stale-2026-06-28/lane/system-premiumcontrols-css-sanitation-2026-06-27` | `3a0939dac` | Июньский SYSTEM-lane premiumcontrols; закрыт сверкой в docs/refactor-2026/lanes/system-premiumcontrols-*. Provenance. |
| `archive/stale-2026-06-28/lane/system-premiumcontrols-dist-gate-wiring-2026-06-27` | `dfedc0d50` | Июньский SYSTEM-lane premiumcontrols; закрыт сверкой в docs/refactor-2026/lanes/system-premiumcontrols-*. Provenance. |
| `archive/stale-2026-06-28/lane/system-premiumcontrols-gill-mobile-toc-2026-06-27` | `03b0c5bce` | Июньский SYSTEM-lane premiumcontrols; закрыт сверкой в docs/refactor-2026/lanes/system-premiumcontrols-*. Provenance. |
| `archive/stale-2026-06-28/lane/system-premiumcontrols-gill-roman-numeral-2026-06-27` | `f1e012237` | Июньский SYSTEM-lane premiumcontrols; закрыт сверкой в docs/refactor-2026/lanes/system-premiumcontrols-*. Provenance. |
| `archive/stale-2026-06-28/lane/system-premiumcontrols-truth-reconciliation-2026-06-27` | `f2bb858e6` | Июньский SYSTEM-lane premiumcontrols; закрыт сверкой в docs/refactor-2026/lanes/system-premiumcontrols-*. Provenance. |
| `before-gb-is-my-strength-2026-05-11_06-11-32` | `fcd72cf56` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-11_06-38-51` | `b323c71dd` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-11_06-52-15` | `5f97f4278` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-11_14-12-15` | `23f7d9ed3` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-11_21-18-38` | `aae5ffc4e` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-11_21-42-55` | `a24abb9ae` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-12_00-36-27` | `3fcac9951` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-12_19-52-53` | `40fdd8a02` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-13_00-49-06` | `bd5c1c48d` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-13_15-09-01` | `af220e116` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-13_18-48-14` | `27fba4638` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-13_19-21-13` | `2b9eba090` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-13_20-16-56` | `846ab4c6b` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-13_21-00-27` | `d725a8eb4` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-13_21-12-21` | `11d4d36a8` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-13_22-23-58` | `19f9fca26` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-14_04-51-26` | `2c7c775ec` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-15_01-53-02` | `5f8cf8360` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-15_03-27-26` | `84cf1c15c` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-15_03-55-03` | `59005af5b` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-15_04-23-22` | `b6bf7c3ad` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-16_18-39-44` | `476034823` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `before-gb-is-my-strength-2026-05-16_18-59-23` | `5c907cbee` | Снапшот безопасности (май 2026, до-агентная эпоха). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-gill-readerstate-submenu-histories-20260728` | `cf2280e85` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-gill-readerstate-submenu-materializers-20260724` | `10a8160bd` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-home-browser-process-isolation-pr402-20260726` | `dec8fa137` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-home-lifecycle-bfcache-histories-20260728` | `023a61662` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-home-pagefind-request-proof-pr388-20260726` | `ed6d645b5` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-live-print-timing-witness-pr288-20260725` | `9139130b3` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-pr-52-gill-image-polish-2026-07-24` | `7e1460080` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-pr-66-submenu-prototypes-2026-07-24` | `1ec622f39` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-pr-79-gill-witness-2026-07-24` | `e9a7ccb42` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-print-decoration-pagination-pr280-20260725` | `d03124a58` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-print-pdf-histories-20260728` | `2d0386d92` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-reader-platform-r1-r6-histories-20260728` | `ae82dcb7c` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-special-overlay-production-smoke-20260721` | `36eef7680` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-tooltip-priority-free-intent-20260725` | `1c36d8b92` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/forensic-webkit-bfcache-control-pr404-20260726` | `f879bec4f` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/pr233-stale-archaeology-7765a4c` | `90bb7e5d5` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/pr370-pre-rebase-6371393-20260726` | `7e4448e35` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/branch-cleanup-20260730/archive/pr374-pre-rebase-8e55ebd-20260726` | `74d2922f1` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/genesis6-enoch-divergent-histories-20260728` | `42123da6d` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/genesis6-footnote-carrier-20260727` | `1b5771221` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `forensic/genesis6-original-visual-set-20260724` | `6e766de74` | Forensic-история июльской чистки веток (2026-07-30). Provenance, содержательной работы нет. |
| `pre-astro-refactor-baseline-2026-06-14` | `13db67f98` | Baseline-снапшот перед рефактором. Provenance, содержательной работы нет. |
| `pre-ba62a41f-live-owner-review-2026-06-23` | `4a075acf6` | Baseline-снапшот перед рефактором. Provenance, содержательной работы нет. |
| `retired/branch-cleanup-20260730/agent/ci-failure-lifecycle-20260725` | `cf23f7adf` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/editorial-baseline-refresh-2026-07-24` | `2114b6a78` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/gill-context-source-authority-2026-07-24` | `ba904a0ab` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/glossary-tooltip-runtime-20260727` | `39413359e` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/map-archaeology-coverage-provenance-v2` | `6da748adc` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/map-archaeology-v2` | `6da748adc` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/nagornaya-bar-asset-contract-2026-07-22` | `43128ef76` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/nagornaya-neutral-comparison-ui-2026-07-22` | `a66fc50f4` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/notifier-ledger-coverage` | `2fa2c73f9` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/notifier-ledger-coverage-v2` | `36d2d0201` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/prod-witness-850fd6b-2026-07-24` | `bd45b3471` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/reconcile-editorial-freeze-2026-07-24` | `56ea9b2d7` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/seo-dist-registry-contract` | `4492f8b3c` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/agent/universal-glossary-contract` | `82fcf3bb2` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/audit/series-capability-trigger-20260725` | `f89a5e6a7` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/backup/font-assets-deterministic-pre-clean-20260725` | `6c1f59da4` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/backup/pr336-pre-clean-20260725` | `3915e9360` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/cleanup/pages-deploy-witness-2026-07-21` | `61c253f8b` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/cleanup/pages-deploy-witness-2026-07-22` | `15cceeb60` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/diagnostic/final-pages-witness-2026-07-22` | `d05683cca` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/diagnostic/gill-mobile-layout-2026-07-22` | `8559c05bb` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/diagnostic/gill-mobile-play-smoke-2026-07-21` | `545fc524a` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/feat/bible-reference-contract-final-2026-07-24` | `4730534e7` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/feat/universal-glossary-final-2026-07-23` | `7561f2026` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/feat/universal-glossary-final-v2-2026-07-24` | `fe2fd3f86` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/fix/_temp-font-face-candidate-integrity-20260725` | `44cfa35cb` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/fix/ci-lifecycle-monotonic-ordering-20260725` | `3fdc3a616` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/fix/content-coverage-source-truth-2026-07-24` | `4757e3c90` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/fix/deployment-witness-concurrency-20260725` | `264e16941` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/fix/highlights-runtime-hardening-clean-2026-07-22` | `0a3dfd1c7` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/fix/nagornaya-pastoral-safety-2026-07-22` | `238e7b92c` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/lane/control-plane-warning-zero-2026-07-24` | `0820d159a` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/lane/exact-production-boundary-observer-2026-07-24` | `8d44272e3` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/lane/highlights-runtime-hardening-2026-07-21` | `6f6a352cd` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/lane/nagornaya-320-grid-conclusion-2026-07-24` | `e2c242256` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/lane/public-surface-webkit-mobile-2026-07-24` | `46ff8c5bb` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/lane/system-editorial-freeze-transaction-2026-07-24` | `2c6841513` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/branch-cleanup-20260730/temp/production-evidence-f5e29998-20260725` | `567201279` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/final-seven-20260730/agent/deployment-provenance-2026-07-25` | `b13e264ec` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/final-seven-20260730/agent/governance-v4-worktree-lifecycle-2026-07-28` | `755906903` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/final-seven-20260730/agent/map-archaeology-native-p0` | `5cacc36a6` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/final-seven-20260730/agent/stateful-ci-notifier-2026-07-25` | `efe3ad52e` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/final-seven-20260730/lane/control-plane-forensic-integrity-2026-07-24` | `70499bc99` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/final-seven-20260730/lane/forensic-governance-doc-truth-2026-07-24` | `1552cf2b1` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |
| `retired/final-seven-20260730/lane/nagornaya-webkit-320-overflow-2026-07-24` | `d59282427` | Выведенная из обращения ветка июльской чистки (2026-07-30), закрыта upstream. Provenance. |

## Очередь решений владельца (не удалять до слова владельца)

1. **Контент**: ch07 research, pastor-кластер. (Апостasy закрыта полностью: серия — PR #2210, мега-статья — PR #2213, обе в main черновиками; #2143 genealogy закрыт PR #2211.)
2. **Продуктовые развилки**: Antisovetov title (1 строка, дважды), quiz-namespace (2 стратегии).
3. **Можно хоронить без потерь** (после записи в этом файле): класс A (`01a108e4`, `avraam`, `karty-holding`), genealogy-дубль #2204, dependabot-теги, `deps/r2`.

## Проверка этого реестра

- SHA сверены с `git ls-remote --tags origin` на `main@2d5b147`.
- Форензика классов — tip/textual сравнение против main (методика: compare API + blob-SHA + присутствие добавленных строк).
- Этот файл ничего не удаляет и не перемещает.
