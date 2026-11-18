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
- все 9 history candidate IDs, `PUBLICATION_HOLD` / `NOT_ISSUED`;
- оба реальных production guards и отсутствие history activation / route / discovery;
- public canonical/metadata/schema, prepared media, fragment targets и source→DOM word boundaries;
- при `--probe-hold` — реальная production build rejection исходного held component.

Обычный режим без `--public-only` остаётся strict и требует history bibliography. Неизвестные CLI flags теперь отклоняются, а не игнорируются. Regression cases отдельно портят HOLD, handoff state, claim set, production guard и route activation: public-only не должен скрывать ни один из этих сбоев.

## Генерация — без apply и без записи Git

Из репозитория с exact commit objects:

```sh
node scripts/journal-editorial-transfer.mjs \
  --base b2ae614730b0c2e164d3b07453797074253d9698 \
  --source <FULL_40_CHARACTER_SOURCE_COMMIT> \
  --out reports/g3-editorial-wave/<NEW_TRANSFER_DIRECTORY>
```

`HEAD` / branch names запрещены: source явно фиксируется до генерации. Существующий output не перезаписывается; разрешён только новый ignored report/cache каталог без symlink traversal. Generator не выполняет apply/build/commit/push/merge, не меняет index или refs. Разница shared/date/publication owners между base и source останавливает генерацию — не объявляется совместимой автоматически.

Три выходных файла:

1. `public-editorial.patch` — ровно 11 allowlisted public presentation/test files, full-index Git diff;
2. `transfer.json` — base/source SHAs, patch SHA-256, before/after Git blob IDs/modes, все остальные tracked files baseline и исключённые source-only изменения;
3. `README.md` — порядок rehearsal, canonical generators, acceptance и ограничения.

11 files: `G3Dossier`, `JournalArticleOpening`, `JournalBibliography`, `JournalContents`, `JournalLanding`, `JournalMasthead`, `JournalSeriesNav`, `journalEditorial.css`, `g3EditorialPresentation.ts` и два существующих Journal acceptance scripts. `JournalEditorialShell/Rail` — неизменённые зависимости canonical, не второй комплект owners.

**Не входят:** `G3HistoryArticle/Feature`, `g3History.css`, history metadata/bibliography, `JournalDocumentHead`, публичные route entrypoints/registries, shared CSS/JS/fonts/assets, package, generated Scripture index, docs и сам transfer tool. Series pending-manuscript label не имеет href. Shared Journal CSS может повлиять на будущий dev-only manuscript; этот public-only пакет не заявляет его визуальную приёмку.

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

Verifier ничего не пишет: проверяет digest patch, bytes/modes переносимых файлов, **каждый** сохранённый tracked file baseline и отсутствие исключённых новых файлов. Изменение `JournalDocumentHead`, скрытый перенос history data, неполный allowlist, symlink вместо файла или испорченный patch дают failure. Это exact-state rehearsal, не permission интегрировать на произвольный более новый SHA.

Если scratch находится внутри checkout, Git может найти внешнюю `.git`: для `git apply` очистить `GIT_DIR` / `GIT_WORK_TREE` / `GIT_INDEX_FILE` / `GIT_COMMON_DIR`, поставить `GIT_CEILING_DIRECTORIES` в **родительский** каталог scratch и сначала получить nonzero от `git rev-parse --show-toplevel`. Ceiling, равный самому cwd, недостаточен. Не применять patch в рабочем дереве Agent 1; не использовать `--3way`, reset, clean или force.

После verification, **до build**, запустить существующий Scripture occurrence generator: четыре новых Astro presentation-компонента меняют лишь `stats.scannedSourceFiles`; этот derived delta фиксируется отдельно, а не переносится вручную из полного proposal. Затем canonical production-like build / cache-bust flow, source contract `--public-only --probe-hold`, соответствующие generated-output contracts и fresh public browser/screenshot/print witness. Защищённые source/metadata bytes перепроверяются после генераторов; actual derived diff не скрывается.

Составное дерево — `exact base + exact public patch + recorded generated delta`, **не** полный Git tree Agent 1 и не новый commit #2338. Browser runner HEAD обозначает источник witness/переносимых файлов; runtime-under-test provenance обязан отдельно называть base, source и manifest. Не выдавать его за whole-branch / canonical CI.

## Что остаётся за владельцем

Выбор одного layout/navigation owner, отдельный date safeguard #2345 и shared ownership, проверка на новом integrated canonical SHA. Firefox/WebKit, реальные устройства/UI zoom, screen reader, physical print и Owner art-direction не становятся PASS из успешного rehearsal. Все 9 Research gates HOLD; новый Research→Product handoff по истории не выдавался. Без merge/deploy/public history route.
