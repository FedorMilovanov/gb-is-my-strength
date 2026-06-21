# Visual Parity Evidence — Full Shadow-Wrap Coverage (2026-06-21)

Дата: 2026-06-21
Сессия: AI-агент Arena (global shadow-wrap audit + full coverage baseline, post-verification)

## Исправление предыдущей формулировки

Ранее этот файл слишком грубо описывал состояние production как будто:
- все production routes одинаково рендерят `bodyHtml` verbatim,
- и Astro emits «ровно тот же `<head>` и `<body>`» для всех 51 routes без различий.

Это **неточно**.

### Что подтверждено

Да, **все 51 production route** из `data/public-content-baseline.json` используют
`loadLegacyFullDocument`.

### Что уточнено после повторной верификации

Production split'ится на два класса:

| Класс | Count | Как рендерится body |
|---|---:|---|
| **Pure full-body shadow** | **33** | `bodyHtml` вставляется verbatim через `<Fragment set:html={bodyHtml} />` |
| **Componentized / hybrid shadow** | **18** | `<head>` берётся из `loadLegacyFullDocument`, но body собирается из raw `_legacy/*.html` fragments и/или Astro wrappers |

Дополнительно:
- **0** production route используют true hand-authored native Astro/MDX body;
- **1** dev-only route (`/dev/astro-test/`) остаётся единственной native Astro page вне production.

Подробная таксономия вынесена в:
- `research/PRODUCTION_ROUTE_TAXONOMY_2026-06-21.md`
- `scripts/route-shadow-taxonomy.js`

## Что реально произошло в rollback-wave

Ранее (Phase 6, AGENTS-r256) 26/26 viewports PASS были доказаны для **13 landing маршрутов**.

После этого:
- `e116bec6` перевёл 20 individual articles/series routes в pure full-body shadow;
- `87fcc7b2` перевёл 10 карт + `rodosloviye` + `konfessii/russkij-baptizm` в pure full-body shadow.

Но уже существующие Phase 6 hybrid pages **не были обратно сведены к `bodyHtml`-трубе**. Они остались componentized shadow routes.

## Результат visual parity

| Scope | desktop | mobile | Метод |
|---|---:|---:|---|
| Все 51 production route из `public-content-baseline.json` | **0.000%** | **0.000%** | `loadLegacyFullDocument` + legacy body transport |

### Важное уточнение

0% baseline здесь доказывает **визуальную и DOM-практическую эквивалентность output**,
но **не доказывает архитектурную однородность implementation**.

Иными словами:
- visual output может быть одинаковым,
- но implementation внутри `src/pages` уже делится на 33 pure routes и 18 hybrid routes.

## Исключение

`/dev/astro-test/` — `build-only`, `noindex`, `astro-noindex`. Не попадает в production dist (`--omit-build-only`).

## Артефакты

- `data/visual-parity-baseline.json` — 51 route × 2 viewport = 102 baseline entries
- `src/pages/*` — 52 `.astro` page files total, из них 51 production + 1 dev-only
- `migration/page-ownership.json` — production-dist routes: owner=astro, status=production-dist

## Bottom line

Корректная формула состояния на 2026-06-21:

> Все 51 production route используют `loadLegacyFullDocument`, но не образуют один implementation-класс: 33 route — pure full-body shadow, 18 route — componentized/hybrid shadow, true native production routes отсутствуют.
