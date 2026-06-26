# Lane: content-text-corruption-2026-06-26

**Date:** 2026-06-26
**Mode:** LANE (content-only, low-risk)
**Branch:** `lane/content-text-corruption-2026-06-26`
**Goal:** устранить порчу публичного текста, найденную аудитом (AuditRepo: CHV-003, CHV-004; ранее BUG-B1).

## Что исправлено

### CHV-003 — Antisovetov, U+FFFD + потеря блока (P0)
**Файл:** `src/components/article-pilots/antisovetov/AntisovetovBody.astro`

В абзаце про «безопасное извинение» стоял символ-замена `U+FFFD` (�), где два абзаца
были склеены, а целый `note-box` потерян. Текст читался так:
> «…нападение на дело Божье. Настоящая сломленность не прос**�**тематическом искажении фактов перед общиной…»

Восстановлено по чистой legacy-копии (`articles/20-antisovetov-pastoru/index.html`,
которая не была повреждена):
- закрытие абзаца: «…Настоящая сломленность **не просит сохранить трон.**</p>»
- восстановлен `note-box` с kicker «Как это выглядит на практике» и абзацем,
  начинающимся «**Ритуальное извинение:** Пастора ловят на систематическом
  искажении фактов перед общиной…»

Также убран лишний `</div>`, который оставался от склейки (баланс `<div>`/`</div>`
в файле теперь 260/260).

### CHV-004 — Hermenevtika, порча цитат Писания (P1)
**Файлы:** `src/components/article-pilots/hermenevtika/HermenevtikaBody.astro`
(source of truth) + `articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html`
(legacy artifact — была повреждена так же, поэтому правится синхронно).

- **1 Коринфянам 15:12:** «- **кик** говорят некоторые между вами» → «- **как** говорят некоторые между вами»
- **Евреям 9:3:** «скиния, называемая **, .**Святое Святых"» → «скиния, называемая **"**Святое Святых"»
  (битая открывающая кавычка приведена к виду, симметричному соседнему «называется "Святое"»).

## Источник правды / build-mode
Все правки внесены в **Astro source** (он регенерирует `dist/`), а для CHV-004 — также в
legacy HTML (он был повреждён идентично и сравнивается visual-parity). CHV-003 в legacy
уже был чист. MDX-версии обеих статей проверены — чисты.

## Проверки

### FAST / targeted (Node 22.12.0)
- `git diff --check` — ✅
- `npm run data:consistency` — ✅ passed
- `npm run content:parity` — ✅ 0 errors (8 non-blocking semantic warnings, pre-existing)
- `npm run seo-audit` — ✅ 0 errors, 0 warnings
- `npm run mdx:structure:audit` — ✅ 0 errors
- `npm run astro:check` — ✅ 0 errors, 0 warnings (13 pre-existing hints, не связаны с правкой)

### Build / dist witness
- `npm run astro:build` — ✅ 52 pages built
- dist `articles/20-antisovetov-pastoru/index.html`: U+FFFD = 0, есть «не просит сохранить трон» и «Ритуальное извинение»
- dist `articles/hermenevticheskaya-...germenevtiki/index.html`: «кик говорят» = 0, есть «как говорят некоторые», битая кавычка = 0

Multi-witness: source + build + dist — все чисты.

### Repo-wide sweep
- `U+FFFD` в reader-папках (`src`, `articles`, `baptisty-rossii`, `nagornaya`, `karty`, `hard-texts`, `about`): **0**
- «кик говорят»: **0** · «называемая , .Святое»: **0**

### FULL gate
`npm run validate:static-publication` — не прогонялся целиком в этой сессии (≈2-3 мин,
2 CPU / ~2 GB RAM). Все релевантные под-проверки (data/content/seo/mdx/astro:check) зелёные.
Рекомендуется финальный полный прогон на CI перед merge.

## Scope guard
Только 3 файла, только текстовый контент. Не трогались: CSS, JS, миграционные данные,
workflows, cache-bust, другие статьи.
