# Native Source Contract v1

Статус: SYSTEM contract для production-маршрутов Astro/strangler.

## 1. Зачем нужен этот контракт

После завершения strict-native миграции на части маршрутов в репозитории сохранились три разные сущности:

1. публичный Astro entrypoint и импортируемые им компоненты;
2. MDX-файл, созданный во время миграции;
3. корневой legacy HTML, использовавшийся до переключения deploy на `dist/`.

Само существование всех трёх файлов допустимо. Недопустимо считать их одновременно production truth.

Production GitHub Pages публикует Astro/strangler `dist/`. Поэтому для Astro-owned strict-native маршрута каноном является фактический import-граф публичного Astro entrypoint и полученный из него production-like `dist`.

MDX и legacy HTML могут оставаться:

- историческим миграционным свидетельством;
- immutable baseline для защиты от потери текста;
- исходным материалом будущей редакционной переработки;
- runtime dependency только у явно объявленного legacy/app маршрута.

Они не могут молча диктовать текущему native route title, даты, schema, H1 или HTML-структуру.

## 2. Термины

### `renderSource`

Публичный entrypoint маршрута. Для Astro-owned route должен совпадать с `migration/page-ownership.json.routes[route].source`.

Пример:

```json
"renderSource": "src/pages/articles/example/index.astro"
```

### `contentSourceMode`

Как public route получает содержимое:

- `astro-native-entry` — native Astro entrypoint и native component graph, без MDX/raw/legacy transport;
- `mdx-native` — public import-граф действительно включает канонический MDX;
- `legacy-runtime` — legacy transport нужен во время выполнения и маршрут не должен объявляться strict-native;
- `native-app-entry` — native Astro app shell/engine, не статья.

### `metadataSourceMode`

Откуда public route получает head/metadata:

- `astro-head-import` — отдельный native `*PageHead.astro` / `*Head.astro`;
- `inline-head` — metadata объявлены непосредственно в entrypoint/layout;
- `content-frontmatter` — каноническая metadata приходит из импортируемого content source;
- `app-manifest` — metadata приложения формируются из app manifest/config.

### `mdxStatus` и `legacyStatus`

- `canonical` — реально участвует в public render contract;
- `reference-only` — хранится для истории/сравнения, но не импортируется public route;
- `runtime-required` — нужен public runtime; несовместимо с обычным `strict-native` content route;
- `absent` — файла/представления нет.

## 3. Контракт strict-native статьи

Минимальный профиль:

```json
{
  "migrationMode": "strict-native",
  "sourceContractVersion": 1,
  "contentSourceMode": "astro-native-entry",
  "renderSource": "src/pages/articles/example/index.astro",
  "metadataSourceMode": "astro-head-import",
  "hasMDX": false,
  "mdxStatus": "reference-only",
  "mdxPath": "src/content/articles/example.mdx",
  "legacyStatus": "reference-only",
  "legacyPath": "articles/example/index.html"
}
```

`hasMDX` — устаревающее совместимое поле. Оно означает только фактическое участие MDX в public render и не должно быть `true` для reference-only файла.

## 4. Что проверяется автоматически

`route-source-contract-audit.js`:

1. согласует page ownership, migration matrix и route profile;
2. проверяет существование public entrypoint;
3. обходит весь локальный transitive import graph;
4. разрешает `@/`, относительные и локальные absolute imports;
5. обнаруживает MDX в любой глубине import graph;
6. обнаруживает native PageHead;
7. запрещает в strict-native graph:
   - `loadLegacyFullDocument(...)`;
   - `headHtml` / `bodyHtml` / `bodyAttributes` transport;
   - `set:html=`;
   - raw imports;
   - `_legacy` imports;
8. проверяет существование reference-only MDX/legacy файлов;
9. запрещает импорт reference-only MDX публичным маршрутом.

`article-native-contract-audit.js` после production-like build проверяет:

- public route существует в `dist`;
- self-canonical;
- title, description, ровно один H1, indexability;
- Pagefind marker;
- required route markers;
- dist не является byte-identical legacy copy;
- JSON-LD URL/date согласованы с public meta;
- BreadcrumbList заканчивается public canonical;
- text floor не падает относительно immutable migration baseline.

## 5. Что больше не является blocking production truth

Архивированы старые реализации:

- `scripts/legacy-audits/article-mdx-pilot-audit-legacy.js`;
- `scripts/legacy-audits/check-mdx-html-parity-legacy.js`;
- `scripts/legacy-audits/baptisty-series-shadow-audit-legacy.js`.

Их можно изучать как историю миграции. Они не должны использоваться в blocking pipeline, потому что сравнивают mutable legacy/reference representations вместо фактического public render source.

Совместимые command entrypoints сохранены, но делегируют native contract audit.

## 6. Immutable baseline и legacy reference — не одно и то же

`data/public-content-baseline.json` может использоваться как замороженный миграционный инвариант:

- URL не исчез;
- H1 не пропал;
- объём содержимого не упал ниже защитного порога.

Он не является live metadata database и не должен автоматически переписываться после каждого изменения.

Корневой legacy HTML — mutable reference-файл. Его Git timestamp, metadata и конкретная DOM-структура не должны принудительно переноситься в strict-native route.

## 7. Глобальные и route-local исправления

Этот контракт является глобальным SYSTEM-слоем.

В него входят:

- ownership и source provenance;
- фактическая import graph проверка;
- native dist contract;
- удаление legacy truth из blocking gates.

В него не входят:

- уникальный дизайн конкретной статьи;
- текстовые редакторские решения;
- конкретные TOC/tooltip/footnote исправления;
- автоматическая смена editorial dates.

Такие изменения выполняются отдельными route или SYSTEM lanes после стабилизации source contract.

## 8. Следующие SYSTEM-контракты

После v1 должны быть отдельными атомарными PR:

1. Metadata Generator v3:
   - `editorialPublishedAt`;
   - `editorialModifiedAt`;
   - `buildGeneratedAt`;
   - запрет CSS/JS/cache-bust обновлять editorial freshness.
2. Unified Scroll Lock:
   - один named/reference-counted store;
   - nested overlay tests.
3. Article Reading Range:
   - явные article start/end;
   - единая формула для bookmarks/progress/time-left/rail.
4. Footnote and Print Notes:
   - уникальные ARIA relationships;
   - canonical note registry;
   - endnotes в PDF.
5. Reader Projection:
   - TTS, speakable, search, summary и print используют явную content policy.

## 9. Merge policy

- только `lane/system-*`;
- никаких route UI-изменений в source-contract PR;
- exact-head CI;
- production-like build;
- squash merge;
- после merge старые legacy audits не возвращаются в blocking pipeline;
- любое будущее изменение source status проходит через profile + actual import verification.
