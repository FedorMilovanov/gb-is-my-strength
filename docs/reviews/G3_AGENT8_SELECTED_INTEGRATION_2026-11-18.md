# Selected Agent 8 — первая интеграционная волна Journal/G3

Это **интеграционная запись выбранного интерфейса**, не новый дизайн-конкурс, Research-план или разрешение публикации. Исторические Agent8 screenshots/failed attempts/exact-dedb receipts остаются в [предыдущем local review](G3_EDITORIAL_LOCAL_2026-11-18.md) и ignored `reports/g3-editorial-local-20261118/reading-resilience/`; они не объявляются приёмкой следующих bytes.

## Owner / scope / rollback

- **Mode: LANE. Интегратор / visual owner: Агент8, Arena7f634191**, по последнему прямому поручению владельца: «Твоя версия теперь главная, ты главный интегратор…». Оно уточняет прежнюю advisor-only роль. GitHub decisions7003938517/7003957615 прочитаны; старый выбор Agent1 отменён. Coordination start: [#2338 comment7004283098](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338#issuecomment-7004283098).
- **Design source / rollback этой волны:** `dedbcdabae01a43b1b0035d940f8c102e99e91e7`. Main `9edef94ece08012223c1364bec7ddcd561cf5713`; canonical Draft#2338 пока `b2ae614730b0c2e164d3b07453797074253d9698`.
- **Только текущая фиксированная ветка** `arena/7f634191-gb-is-my-strength`: commits/push здесь. Arena запрещает запись другой ветки. Новый own combined SHA и gitless public-only rehearsal **не** являются изменившимся HEAD#2338. Не создаётся новый конкурирующий PR; canonical остаётся единой coordination/integration точкой. Для переноса writer#2338 получает exact-base patch/BOM с проверкой каждого сохранённого файла.
- **Allowed delta:** Journal head/routes и runtime-validation helper, scoped SEO contract/fixtures, собственные editorial source/browser witnesses, public-transfer generator/verifier/negative tests, эта запись. Дополнительно один подтверждённый explicit-space separator в public dossier (см. ниже), без изменения фактов/слов/цифр. CSS/layout/датированные metadata objects/held history/shared runtime/fonts/SW/packages/CI/Research не меняются.
- **SSOT:** два current strict-native route profiles; неизменённые `g3PublicationHandoff`, `g3SourceBibliography`, `g3ProductMetadata`, `journalProductMetadata`; Research immutable16claim/21source handoff. Research main e2d7f0a0 / #582 Draft93d6: все шесть relevant rules/authority/handoff files совпали с прежним pin. Девять history candidates — PUBLICATION_HOLD, новых clearance/прослушиваний нет.

## Реальный отбор и подтверждённая проблема

1. **Agent6 #2345, exact `eb8ffc5a43c7923bf3bca75d934b0e767f028d2d` — ADAPT.** На exact-dedb built `/journal/` действительно были оба Article-only OG timestamps, а на обеих страницах отсутствовали social-image alt. `kind`/даты имели implicit fallback. Получен fresh baseline receipt до mutation. Перенесён ровно SEO delta пяти файлов, сохранён наш единственный `JournalFontPreloads`. Required input type дополнен runtime fail-closed assertion для missing/invalid kind/date, невозможной календарной даты, обратной chronology и пустого image/alt. Даты/каноникал из route-owned metadata не меняются. Отдельные negative unit/SEO fixtures, без package/global validate.
2. **Agent1 #2340, exact `1979ef2e7e73ba68c937d4f74beb9bea387ef4fc` — ADAPT TEST/TRANSFER ONLY.** Взята дисциплина full40SHA/new ignored output/fixed allowlist/strict all-other-file verification/отдельный guard-only prerequisite и literal source→compressed DOM word-boundary check. Его opening/masthead/TOC/series/history prose/CSS не импортированы. Наша прежняя проверка37factual paragraphs против b2ae остаётся обязательной. Первый combined83fa прошёл unit/build/Pagefind, но новый literal witness дал actual exit1: первоначально dynamic formatNumber ошибочно сравнивался с ungrouped projection. После исправления классификации (как и у donor, только literal, а currency отдельно exact) обнаружен **один реальный** compression defect `Бьюс —30 409` вместо `Бьюс — 30 409`. Добавлен только Astro explicit-space separator, факты/цифры и даты прежние. Все raw failures/диагностика сохранены; 83fa не принят как final. Новый actual PDF проверяется заново: pixel/glyph-position identity старой полосы после честного space fix не обещается.
3. **QA#2344, exact `259074909f0d1a35aca255adbb12bd40e99b3044` — ADAPT NARROW CHECKS.** Уникальность masthead/nav/mobile-chrome/search/main проверяется по выбранному DOM, не его чужим UI regex/wording. Добавлен actual Pagefind index witness с положительным G3 control и negative held-route/content probes; нулевой результат held-token запроса не выдан за ошибку. Нет copy `package.json`, глобального validate hook или обхода прежних axe/source gates.
4. **Agent9 #2343, exact `86f59f527df1d7e40d552533129de057b6a6acec` — NOT_APPLICABLE для outside-list gutter.** На selected-dedb actual A4 PDF извлечены все21счётчик01…21 по порядку; xMin39.75pt. №8 использует positioned `::before` внутри списка с `list-style:none`, не outside-marker модель №9. `padding-inline-start:2em` без дефекта не переносится. Первое слишком широкое диагностическое условие поймало также finance/count21; failed helper сохранён, затем отбор ограничен настоящим font/size counter. Новый exact combined PDF должен подтвердить сохранность, не наследует этот PASS.
5. **#2339 forced-colors/print — REVIEW ONLY; #2341/#2342 — frozen alternatives.** Нет wholesale88-file font/SW import, второго scrollspy/серии/SVG/navigation owner. Shared Search/OverlayRuntime Escape остаётся открытым SYSTEM dependency: QA#2344 — acceptance/repro owner, shared repair требует отдельного authorized owner/scope; route-specific workaround здесь нет.

## Minimal public visual + compatible SEO BOM

`TRANSFER_FILES` в `scripts/journal-editorial-transfer.mjs` — точный **20-file allowlist**, а не вся ветка:

- **Public presentation:** `G3Dossier`, `JournalArticleHeader`, `JournalContents`, `JournalDataFigure`, `JournalSourceReturn`, `JournalLanding`, `JournalMasthead`, `journalEditorial.css`; `src/data/journal/g3EditorialMedia.ts`.
- **Head:** `JournalDocumentHead`, `JournalFontPreloads`, `journalDocumentMetadata.ts`; два существующих route entrypoints. Один required kind/date/image owner, один набор четырёх hints.
- **Tests only:** `journal-document-metadata-test.mjs`, `journal-editorial-contract.mjs`, `journal-editorial-browser.mjs`, `lib/journal-print-pdf.py`, `lib/seo-route-contract.js`, `seo-route-contract-test.js`.

Dependency order: прежние canonical Shell/Rail/reader/asset owners → existing prepared media/authority data → route-local media + components + CSS → compatible head/helper/hints → existing public route callers → scoped tests. Git patch применяется атомарно, не до половины зависимостей. Shell/Rail и все shared/data authorities должны остаться baseline-exact.

**Исключены:** full `G3HistoryArticle/Feature`, `g3History.css`, все history data/metadata, local review adapter/route, docs, generated indices, fonts/shared JS/CSS/SW/package. Если в base нет прямого feature PROD guard, отдельный patch вставляет только существующий throw в **исходный baseline feature**, не переносит остальную рукопись. Verifier phases `base/applied/guarded` проверяют это по отдельным blob IDs и всем остальным baseline files.

Manifest v2 включает baseline/source SHA, patch hashes, bytes/modes обоих состояний, сохранённые/excluded files и исходные сравниваемые source objects. Source contract проверяет эти comparison strings по baseline Git blob IDs, не принимает их за новые факты. В gitless acceptance `head:null`, base/source/composite указаны явно; browser также сверяет все20 transferred source blobs. Derived Scripture/source count запускается canonical generator отдельно, не копируется из полной ветки.

## Команды и приёмка

После первого recoverable commit — **fresh exact-head**, не dirty development или чужой CI:

```sh
node --test scripts/journal-document-metadata-test.mjs scripts/journal-editorial-transfer-test.mjs
npm run strangler:build:production-like
npm run pagefind:build:dist
node scripts/journal-editorial-contract.mjs --probe-hold --output=reports/g3-editorial-integration-20261118/own
node scripts/seo-route-contract-test.js

node scripts/journal-editorial-transfer.mjs \
  --base b2ae614730b0c2e164d3b07453797074253d9698 \
  --source <FULL_COMMITTED_COMBINED_SHA> --out <NEW_IGNORED_DIRECTORY>
```

Rehearsal: новый gitless exact-b2ae export; не позволять nested Git открыть внешний checkout (ceiling в родительском каталоге, ambient GIT_* очищены, `rev-parse` обязан вернуть nonzero). Проверить `base` → `git apply --check` и public patch → `applied` → отдельный guard patch → `guarded` **до generators**. Проверить red source-contract до отсутствующего feature guard и green после него, не ослаблять условие. Затем Scripture generator, documented `GB_BUILD_INSTANT` из timestamp source commit (не дата статьи), canonical build/Pagefind + targeted checks; public-only source contract с `--transfer=<manifest> --probe-hold`. Runtime root и API только относительные URLs для браузера; localhost используется лишь test driver.

Fresh public Chromium matrix: responsive320/390/768/1440 light/dark, original source/citation/direct return and Back/Forward, JS/noJS compact/short focus, real A4/Letter PDF, axe и screenshots. Для original full/supplemental режимов возможен optional held dev-only fixture; public-only kit его не переносит. Firefox/WebKit без executables — 0cases, не Chromium emulation/PASS. Metadata unit/prod-negative fixtures и exact-one/zero OG assertions не подменяют реальную сборку. Старый full source contract остаётся strict; `--public-only` исключает только проверки непереносимого/неподключённого held presentation (extra manuscript-source module и его stylesheet), а не nine HOLD/authority/guards/no-route/discovery. Default strict по-прежнему проверяет и private CSS; public mode отдельно запрещает его импорт публичными components.

## Что считается сдачей этой волны

Новый combined source SHA, фактические exits, public-only manifest+rehearsal/build/provenance, matched selected-№8 screenshots, actual PDF/SEO/source/HOLD acceptance, own normal push/read-back и координация#2338. Артефакты ignored `reports/g3-editorial-integration-20261118/`, не бинарники в Git. Начальные helper/BOM test failures сохраняются отдельно и не называются Product PASS. Новый source/artifact seal относится только к фактически проверенным bytes.

**Canonical ref пока не записан из-за fixed-branch restriction; новый integration SHA не получает старого green.** Никакого прямого main/foreign push, нового competing PR, merge/deploy/Research write или history release. Owner visual choice№8 уже принят; это не новая подпись владельца под каждой следующей адаптацией или production state.

### QA-only correction перед окончательной приёмкой

Exact7f9a прошёл46unit/build/Pagefind и source-word/actual-index assertions, но новый dual-PROD helper честно отверг ConfigNotFound вместо ожидаемого guard: Astro CLI требует root-relative config option, absolute path не принимается. Исправлен только helper argument, теперь требуется полное точное guard message и сохраняются оба raw build logs. Отдельно public rehearsal корректно не прошёл blanket private-CSS check: исходный held baseline stylesheet содержит `!important` и намеренно не переносится/не подключается публичными pages. Public-only теперь явно проверяет только public CSS и отсутствие private CSS imports; **default strict gate не ослаблен**, отдельные negative tests доказывают оба случая. Новые49unit и development dual-PROD probes проходят; final evidence всё равно требует новый exact committed SHA. Первые два неуспешных source/build receipts и первый несовместимый Python tar-filter helper сохранены как non-acceptance, не переписаны.
