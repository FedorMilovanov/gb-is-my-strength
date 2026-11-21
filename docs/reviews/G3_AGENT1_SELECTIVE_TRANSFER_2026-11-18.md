# Agent 1 — воспроизводимый public-only selective transfer

Дополнение к [visual/UX handoff](G3_AGENT1_VISUAL_HANDOFF_2026-11-18.md), а не новый дизайн-вариант, новый application bug-fix или разрешение canonical integration. Задача продолжения — превратить пять рекомендаций в проверяемый пакет без захвата #2338 и без обязательного переноса source-only истории.

## Граница

- **Mode / owner:** LANE / Agent 1, та же ветка `arena/a9995426-gb-is-my-strength`, Draft #2340.
- **Start / rollback:** `ab3e23aa24666bf909758778f28688c2f0d081a6`; `main` — `9edef94ece08012223c1364bec7ddcd561cf5713`; exact canonical base #2338 — `b2ae614730b0c2e164d3b07453797074253d9698`.
- **Allowed source changes:** route-local transfer generator и его regression tests; явный `--public-only` режим существующего Journal source contract; этот integration record. Application / CSS / runtime / metadata / source data / routes / package не меняются.
- **Source of truth:** pinned Git objects и fixed 11-file public allowlist, текущие Journal owners / route profiles и неизменённый Research handoff. Source-only история не становится зависимостью public presentation.
- **Overlap:** #2338 остаётся canonical owner. Не переносятся чужие commits, interactive scrollspy, theme/search controls, #2345 date-head, SYSTEM fonts / shared CSS / SW / package. Нет записи peer refs/source/PR, merge, deploy или retarget.
- **Checks:** generator/verifier unit + negative cases; strict/public-only source contract; exact-base patch check/application и полный pinned-file verification **только в новом scratch export**; свежий build и public browser witness этого составного дерева с отдельным provenance. Результаты фиксируются в новом ignored report, не приписываются старому ab3 evidence.

## Подтверждённое препятствие переносу — не дефект приложения

Пробный экспорт 11 public files из `ab3e23aa…` на `b2ae6147…` успешно прошёл `git apply --check`. Но source contract не загрузился: статически импортировал `g3HistoryBibliography.ts`, отсутствующий в canonical и намеренно исключённый из public-only пакета. Получен реальный `ERR_MODULE_NOT_FOUND`; raw negative control сохранён отдельно. Историческая библиография не должна переноситься только для запуска проверки двух публичных страниц.

Теперь `node scripts/journal-editorial-contract.mjs --public-only --probe-hold` пропускает **только** uniqueness-check presentation-библиографии рукописи и не импортирует её. По-прежнему обязательны:

- точные 16 approved public claims / 21 source record и прежний seal;
- все 9 history candidate IDs и `PUBLICATION_HOLD`; modern schema также требует `NOT_ISSUED`, legacy canonical shape не может содержать issued/mixed handoff state;
- оба реальных production guards и отсутствие history activation / route / discovery;
- public canonical/metadata/schema, prepared media, fragment targets и source→DOM word boundaries;
- при `--probe-hold` — реальная production build rejection исходного held component.

Full rehearsal также подтвердил legacy API canonical: `approvalClaimIds` вместо `candidateClaimIds`, без отдельного `handoffStatus`. Только public-only режим явно поддерживает этот неизменённый baseline shape: все 9 IDs остаются кандидатами под обязательным HOLD, старое слово «approval» не означает публикационного допуска. Отсутствующий `handoffStatus` **не** синтезируется в новый факт `NOT_ISSUED`; смешанные схемы / issued field отвергаются. Metadata-файл при этом не переносится и не меняется. Отдельные negative tests защищают и legacy, и modern shape.

Обычный режим без `--public-only` остаётся strict, требует modern metadata и history bibliography. Неизвестные CLI flags теперь отклоняются, а не игнорируются. Regression cases отдельно портят HOLD, handoff state, claim set, production guard и route activation: public-only не должен скрывать ни один из этих сбоев.

## Генерация — без apply и без записи Git

Из репозитория с exact commit objects:

```sh
node scripts/journal-editorial-transfer.mjs \
  --base b2ae614730b0c2e164d3b07453797074253d9698 \
  --source <FULL_40_CHARACTER_SOURCE_COMMIT> \
  --out reports/g3-editorial-wave/<NEW_TRANSFER_DIRECTORY>
```

`HEAD` / branch names запрещены: source явно фиксируется до генерации. Существующий output не перезаписывается; разрешён только новый ignored report/cache каталог без symlink traversal. Generator не выполняет apply/build/commit/push/merge, не меняет index или refs. Разница shared/date/publication owners между base и source останавливает генерацию — не объявляется совместимой автоматически.

Основные выходные файлы:

1. `public-editorial.patch` — ровно 11 allowlisted public presentation/test files, full-index Git diff;
2. `transfer.json` — base/source SHAs, patch SHA-256, before/after Git blob IDs/modes, все остальные tracked files baseline и исключённые source-only изменения;
3. `README.md` — порядок rehearsal, canonical generators, acceptance и ограничения.
4. При отсутствии прямого feature guard — отдельный `history-production-guard.patch`, только safety prerequisite, не перенос рукописи.

11 files: `G3Dossier`, `JournalArticleOpening`, `JournalBibliography`, `JournalContents`, `JournalLanding`, `JournalMasthead`, `JournalSeriesNav`, `journalEditorial.css`, `g3EditorialPresentation.ts` и два существующих Journal acceptance scripts. `JournalEditorialShell/Rail` — неизменённые зависимости canonical, не второй комплект owners.

**Не входят:** полные `G3HistoryArticle/Feature`, `g3History.css`, history metadata/bibliography, `JournalDocumentHead`, публичные route entrypoints/registries, shared CSS/JS/fonts/assets, package, generated Scripture index, docs и сам transfer tool. Series pending-manuscript label не имеет href. Shared Journal CSS может повлиять на будущий dev-only manuscript; этот public-only пакет не заявляет его визуальную приёмку.

## Обязательный safety prerequisite, не перенос истории

Full public-only contract намеренно не стал принимать canonical `G3HistoryFeature.astro` без собственного production guard. У b2ae article guard есть, прямого feature guard нет. Поэтому generator дополнительно выпускает **отдельный guard-only patch**, если он нужен: вставляет уже существующий в Agent 1 `if (import.meta.env.PROD) throw ... PUBLICATION_HOLD` в исходный baseline feature. Каждая другая строка рукописи / locator / import остаётся baseline-exact. Полный feature из Agent 1 не копируется, history bibliography не требуется, никакой маршрут не появляется.

Порядок: phase `base` → public patch → phase `applied` (все 3532 остальных baseline files) → отдельный safety patch → phase `guarded` (3531 неизменённый файл + один ровно guard-only blob) → generators/build. Это явное усиление fail-closed safety, не исключение из guard contract. Если base уже содержит production guard, отдельный patch не нужен. Regression tests проверяют неизменность исторического текста и запрет использовать prerequisite для другого owner.

## Read-only verification и безопасный rehearsal

```sh
node scripts/journal-editorial-transfer.mjs \
  --verify /absolute/kit/transfer.json \
  --target /absolute/fresh-base-export --phase base

# Только canonical owner решает, применять ли patch.
# После explicit apply в изолированном scratch:
node scripts/journal-editorial-transfer.mjs \
  --verify /absolute/kit/transfer.json \
  --target /absolute/applied-export --phase applied

node --test scripts/journal-editorial-transfer-test.mjs
```

Verifier ничего не пишет: проверяет digest обоих patches, bytes/modes переносимых файлов, **каждый** сохранённый tracked file baseline и отсутствие исключённых новых файлов. После явного guard-only prerequisite использовать `--phase guarded`: только этот файл имеет отдельный ожидаемый blob, все остальные сохранённые owners по-прежнему baseline-exact. Изменение `JournalDocumentHead`, скрытый перенос history data, неполный allowlist, symlink вместо файла или испорченный patch дают failure. Это exact-state rehearsal, не permission интегрировать на произвольный более новый SHA.

Если scratch находится внутри checkout, Git может найти внешнюю `.git`: для `git apply` очистить `GIT_DIR` / `GIT_WORK_TREE` / `GIT_INDEX_FILE` / `GIT_COMMON_DIR`, поставить `GIT_CEILING_DIRECTORIES` в **родительский** каталог scratch и сначала получить nonzero от `git rev-parse --show-toplevel`. Ceiling, равный самому cwd, недостаточен. Не применять patch в рабочем дереве Agent 1; не использовать `--3way`, reset, clean или force.

Для намеренно gitless export перед build установить существующий supported input `GB_BUILD_INSTANT` из `technicalBuildInstant` в manifest — это timestamp source commit, **не** дата статьи. Без него metadata projector закономерно отклоняет сборку; нельзя незаметно дать Git найти внешний checkout или подставить wall-clock time. Значение и инструкция включены в generated README. Если завершились typecheck/Astro/copy, а postbuild остановился из-за этого input, сохранять неуспешный log и проверять нужные build/postbuild stages отдельно, не заявлять exit 0 прежнего wrapper.

После verification, **до build**, запустить существующий Scripture occurrence generator: четыре новых Astro presentation-компонента меняют лишь `stats.scannedSourceFiles`; этот derived delta фиксируется отдельно, а не переносится вручную из полного proposal. Затем canonical production-like build / cache-bust flow, source contract `--public-only --probe-hold`, соответствующие generated-output contracts и fresh public browser/screenshot/print witness. Защищённые source/metadata bytes перепроверяются после генераторов; actual derived diff не скрывается.

Составное дерево — `exact base + exact public patch + recorded generated delta`, **не** полный Git tree Agent 1 и не новый commit #2338. Browser runner HEAD обозначает источник witness/переносимых файлов; runtime-under-test provenance обязан отдельно называть base, source и manifest. Не выдавать его за whole-branch / canonical CI.

## Что остаётся за владельцем

Выбор одного layout/navigation owner, отдельный date safeguard #2345 и shared ownership, проверка на новом integrated canonical SHA. Firefox/WebKit, реальные устройства/UI zoom, screen reader, physical print и Owner art-direction не становятся PASS из успешного rehearsal. Все 9 Research gates HOLD; новый Research→Product handoff по истории не выдавался. Без merge/deploy/public history route.
