# Agent 02 — Editorial Metadata v3

**Дата:** 2026-08-01  
**Статус:** `SOURCE_CONTRACT_DONE_WITH_EDITORIAL_REVIEW_BLOCKERS`  
**Production claim:** `no`

## Итог

Существующий `data/editorial-metadata.json` закреплён как единственный владелец
редакционных дат. Второй registry не создан.

Направление зависимости теперь определено так:

```text
approved editorial decision → final dist projections
unapproved registry record → frozen observations, drift blocked
technical build clock → RSS channel lastBuildDate only
```

## Найденная граница безопасности

В canonical registry находятся 49 eligible records:

- `approved`: **0**;
- `inconsistent-needs-review`: **43**;
- `migration-freeze-unverified`: **6**.

Поэтому Agent 02 не повышает ни одну кандидатную дату до публичной canonical
даты без editorial approval. Это предотвращает массовую тихую замену дат,
полученных прежним observation-priority алгоритмом.

## Контракт v3

- `null` — явная семантика «дата неизвестна»;
- Git commit, file mtime, cache-bust, asset revision и build timestamp запрещены
  как источники editorial publication/modification dates;
- approved record блокируется, если modification предшествует publication;
- future dates, missing fields, duplicate identities и duplicate PageHead date
  tags являются blocking defects;
- projector получает только records со статусом `approved`;
- unapproved records обязаны сохранять frozen observation surface без drift;
- RSS item `pubDate` остаётся editorial;
- RSS channel `lastBuildDate` использует отдельный deterministic technical clock.

## Подготовленные проекции для approved records

Projector синхронизирует:

- `article:published_time` и `article:modified_time`;
- Article/ScholarlyArticle JSON-LD;
- существующие semantic dateline `<time>` без создания нового видимого UI;
- Pagefind metadata;
- `dist/data/search-manifest.json`;
- sitemap `lastmod`;
- RSS item `pubDate`.

Production-like postbuild вызывает canonical registry CLI, а не библиотеку
напрямую. Approval-gate закреплён отдельным regression test.

## Подтверждённый production-like результат

На проверочном exact head:

- registry records: **49**;
- approved/projected: **0**;
- blocked pending editorial review: **49**;
- HTML matched/changed: **0 / 0**;
- search manifest matched/changed: **0 / false**;
- sitemap matched/changed: **0 / 0**;
- RSS item matched: **0**;
- RSS channel technical clock: обновлён;
- editorial drift между frozen и observed snapshots: **0**;
- единственный machine diff: `sourceCommit` boundary.

## Артефакты и owners

- schema: `data/editorial-metadata.schema.json`;
- migration inventory: `data/editorial-metadata-migration-inventory.json`;
- semantic validator/projector: `scripts/lib/editorial-metadata-v3.js`;
- canonical CLI: `scripts/editorial-metadata-registry.js`;
- approval gate: `scripts/editorial-metadata-v3-approval-gate-test.js`;
- production hook: `scripts/astro-cache-bust-postbuild.js`;
- dedicated workflow owner: `.github/workflows/editorial-metadata-v3.yml`.

## Параллельная работа

PR #669 владел Karty inventory/audit files. Metadata-v3 lane не касалась ни
одного Karty path.

## Downstream handoff для Agent 05

Agent 05 может считать canonical owners перечисленными выше. Он не должен:

- создавать второй date registry;
- поднимать unapproved records до canonical dates;
- использовать Git/build/cache timestamps как editorial dates;
- удалять source PageHead dates до отдельной approved migration lane.

## Production boundary

Source contract и production-like candidate проверяются CI. Live deployment
этим отчётом не заявляется. Editorial approval 49 записей остаётся отдельной
содержательной работой владельца, а не техническим auto-fix.
