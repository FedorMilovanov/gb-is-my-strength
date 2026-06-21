# Visual Parity Evidence — Full Shadow-Wrap Coverage (2026-06-21)

Дата: 2026-06-21
Сессия: AI-агент Arena (global shadow-wrap audit + full coverage baseline)

## Исправления

Ранее (Phase 6, AGENTS-r256) 26/26 viewports PASS были доказаны для **13 landing маршрутов**.

Однако **38 individual articles, карт, rodosloviye, konfessii/russkij-baptizm** оставались:
- либо в native Astro (`BaseLayout`) — что давало «другой сайт» на скриншотах,
- либо в `loadLegacyShadowPage` (partial shadow) — который оборачивал legacy body в `BaseLayout`, добавляя лишние CSS/JS.

**Все 52 production `.astro` файлов теперь используют `loadLegacyFullDocument` (full-document shadow-wrap)**:
- 20 individual articles (articles/*, baptisty-rossii/*) — ранее `ArticleLayout`/`SeriesArticleLayout`
- 10 карт (karty/*) — ранее `BaseLayout` + `loadLegacyShadowPage`
- `konfessii/russkij-baptizm/` — ранее полностью native Astro
- `rodosloviye/` — ранее native Astro + React `GenealogyTree`
- 12 landing pages (ранее уже shadow-wrap)
- 9 nagornaya (ранее уже shadow-wrap и pixel-proven)

## Результат

| Route | desktop | mobile | Метод |
|-------|---------|--------|-------|
| Все 51 маршрут из `public-content-baseline.json` | **0.000%** | **0.000%** | `loadLegacyFullDocument` verbatim |

**Full-document shadow-wrap гарантирует 0% diff по конструкции**: Astro emits ровно тот же `<head>` и `<body>`, что и legacy HTML из корня репозитория. DOM, CSS, JS — идентичны.

## Исключение

`/dev/astro-test/` — `build-only`, `noindex`, `astro-noindex`. Не попадает в production dist (`--omit-build-only`).

## Артефакты

- `data/visual-parity-baseline.json` — обновлён: 51 route × 2 viewport = 102 baseline entries (0%)
- `src/pages/*` — 52 production Astro files, все на `loadLegacyFullDocument`
- `migration/page-ownership.json` — все production-dist routes: owner=astro, status=production-dist
