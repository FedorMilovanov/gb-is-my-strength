# Agent 02 — Editorial Metadata v3

**Дата:** 2026-08-01  
**Статус:** `IMPLEMENTATION_IN_PROGRESS`  
**Production claim:** `no`

## Цель

Сделать существующий `data/editorial-metadata.json` единственным владельцем
редакционных дат и развернуть направление зависимости:

```text
editorial registry → final dist projections
```

Вместо прежнего режима, где registry в основном замораживал уже наблюдённые
PageHead/RSS/sitemap/search значения.

## Найденный системный разрыв

Текущий freeze-registry уже правильно отделяет editorial decisions от
observation snapshots и сохраняет решения при refresh. Но финальные поверхности
продолжали получать даты из локальных PageHead и `data/search-manifest.json`.
RSS `lastBuildDate` дополнительно вычислялся из item editorial dates.

Это оставляло два класса риска:

1. техническая сборка могла сдвинуть проекцию, не изменяя editorial decision;
2. registry проверял результат, но не являлся финальным producer.

## Контракт v3

- существующий registry остаётся единственным владельцем;
- отдельный второй registry не создаётся;
- `null` означает «дата неизвестна» и никогда не заменяется Git/build временем;
- technical sources запрещены для editorial fields;
- approved record блокируется, если modification предшествует publication;
- future dates, missing fields, duplicate identities и duplicate PageHead date tags
  являются blocking defects;
- final production-like `dist` получает даты из registry после Astro/legacy copy;
- RSS item `pubDate` — editorial;
- RSS channel `lastBuildDate` — только technical build clock.

## Проекции

Projector синхронизирует:

- `article:published_time` и `article:modified_time`;
- Article/ScholarlyArticle JSON-LD;
- существующие semantic dateline `<time>` без создания нового видимого UI;
- Pagefind metadata;
- `dist/data/search-manifest.json`;
- sitemap `lastmod`;
- RSS item `pubDate`;
- RSS channel `lastBuildDate`.

## Миграционная граница

Hardcoded PageHead dates пока остаются как source fallback и historical
observation. Финальный deploy candidate нормализуется из registry. Это позволяет
не переписывать десятки owner-sensitive PageHead файлов одной транзакцией и не
выдумывать отсутствующие даты.

## Активная параллельная работа

PR #669 владеет только Karty inventory/audit files. Metadata-v3 lane не касается
ни одного Karty path.

## Definition of done

Финальный статус станет `DONE` только после:

- schema/data + adversarial mutation tests;
- production-like build и projection report;
- SEO/JSON-LD/sitemap/RSS/search checks;
- Editorial Dateline и Pagefind checks;
- exact-head CI;
- review threads = 0;
- guarded squash merge;
- merged-main verification и branch cleanup;
- обновлённого переносимого handoff MD.
