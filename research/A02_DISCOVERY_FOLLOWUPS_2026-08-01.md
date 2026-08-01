# A02 — discovery follow-ups: scripture Pagefind, noindex и RSS

**Дата:** 2026-08-01  
**Исполнитель:** Agent 15  
**Статус:** `SOURCE_CONTRACT_IMPLEMENTED`  
**Production claim:** `no`

> `A02` — идентификатор отчёта discovery-аудита. Это не Agent 02, которому по общей очереди принадлежат editorial/date decisions.

## Цель

Закрыть четыре узких результата из очереди Agent 15 без изменения читательского текста, дат, визуальной иерархии или Karty-runtime:

1. повторно проверить Nagornaya после Astro 7;
2. сделать scripture-поиск проверяемым реальным Pagefind-запросом;
3. доказать отсутствие `noindex`-маршрутов в физическом Pagefind-индексе;
4. превратить RSS warning semantics в явные policy dispositions.

## Найденный source-дефект

Канонический `data/search-manifest.json` содержит scripture fixtures для всех пяти частей серии. В native Astro source:

- части 1–3 уже имели `data-pagefind-meta="scripture"`;
- части 4–5 не имели scripture-метаданных вообще.

Изменение добавляет ровно по одному скрытому canonical marker для частей 4 и 5:

| Route | Canonical scripture |
|---|---|
| `/nagornaya/chast-4/` | `Мф 5:18, Ин 14:26, 2 Тим 3:16` |
| `/nagornaya/chast-5/` | `Мф 7:21–23, Рим 3:20` |

Читательский текст, `<title>`, OG, даты, стили и TTS не меняются.

## Новый fail-closed contract

`scripts/discovery-followups-browser-test.mjs` выполняется только после production-like build и физической сборки Pagefind.

### Scripture query guard

- fixtures выводятся из canonical `data/search-manifest.json`, а не дублируются в тесте;
- обязательны ровно пять `/nagornaya/chast-N/` fixtures;
- Chromium загружает реальный `dist/pagefind/pagefind.js`;
- для каждого canonical scripture строятся запросы только из самого scripture locator;
- хотя бы один реальный запрос обязан вернуть соответствующий canonical route;
- result metadata обязана содержать scripture; у восстановленных частей 4–5 значение обязано буквально совпасть с manifest.

### Noindex leakage guard

- список `noindex` выводится из `data/route-search-policy.json`;
- каждый такой route обязан одновременно иметь `pagefind/searchManifest/sitemap/rss = exclude`;
- browser API выполняет filter-only Pagefind enumeration (`search(null)`);
- пересечение физического индекса с canonical noindex set обязано быть пустым;
- встроенная отрицательная fixture доказывает, что синтетическая утечка блокирует тест.

### RSS disposition

Для каждого production route формируется один из трёх статусов:

- `INCLUDED_BY_POLICY`;
- `EXCLUDED_BY_POLICY`;
- `BLOCKING_POLICY_DRIFT`.

Обычное исключение route из RSS больше не трактуется как неопределённое warning: оно является нормальным `EXCLUDED_BY_POLICY`. Любое расхождение feed с `rssPolicy` блокирует contract. Отрицательная fixture добавляет запрещённый route в RSS set и обязана получить `BLOCKING_POLICY_DRIFT`.

## CI ownership

Новый contract встроен в существующий `.github/workflows/search-manifest-policy.yml`; отдельный workflow или второй search owner не создаётся. Job:

1. делает immutable `npm ci`;
2. собирает production-like `dist`;
3. строит физический Pagefind index;
4. запускает current search/index inventory strict;
5. запускает Nagornaya source/visual contracts;
6. выполняет Chromium Pagefind queries;
7. публикует JSON/MD evidence artifact.

## Границы

Не изменены:

- Karty data/schema/runtime;
- editorial dates и historical claims;
- route policy и search manifest membership;
- RSS feed contents;
- CSS/JS reader runtime;
- Pagefind implementation или ranking;
- production deployment.

## Definition of done

Agent 15 закрыт, когда exact PR head проходит:

- Search Manifest Policy — оба обязательных jobs;
- Shared Files Guard;
- production-like deploy candidate contract;
- применимые route/visual checks;
- review threads = 0;
- guarded merge в `main`;
- отдельный handoff-MD фиксирует точные PR/head/merge/main SHA и оставшуюся очередь.
