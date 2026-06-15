# ASTRO_MDX_ARTICLE_PILOT_STATUS_2026-06-15.md

Дата: 2026-06-15
Статус: **three public article shadow routes in dist; production deploy не меняется**
Риск-уровень: **Level 2/3 — public Astro shadow route in dist only, root production still legacy**

## Цель

Начать следующий этап после Astro `/about/` и strangler-guards: проверить, что статьи можно переносить в Astro Content Collections/MDX без замены production legacy HTML.

Это не production deploy switch. Это shadow ownership в локальном/CI `dist`: root production всё ещё legacy HTML.

## Добавлено

```text
src/content.config.ts
src/content/articles/dzhon-gill-spravochnik.mdx
src/content/articles/dzhon-gill-istoricheskiy-kontekst.mdx
src/content/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy.mdx
src/layouts/ArticleLayout.astro
src/pages/articles/dzhon-gill-spravochnik/index.astro
src/pages/articles/dzhon-gill-istoricheskiy-kontekst/index.astro
src/pages/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.astro
```

Новые npm-команды:

```bash
npm run astro:pilot:article-mdx
npm run astro:audit:article-mdx
npm run astro:audit:article-mdx:no-build
npm run astro:audit:article-mdx:strict
```

`astro:pilot:article-mdx` выполняет:

```bash
npm run strangler:build
npm run page-ownership:dist
```

`astro:audit:article-mdx` строит обычный strangler `dist` и сравнивает legacy article с public Astro shadow route и noindex MDX preview.

## Что проверяет pilot

- Astro content collection `articles` через build-time `glob()` loader.
- Zod schema для article frontmatter: title, h1, description, slug, section, dates, author, series, tags, related, OG image, draft/noindex, canonicalOverride, readingTime.
- `ArticleLayout.astro` может отрисовать content entry без React runtime.
- Public article route в `dist` теперь Astro-owned shadow route:

```text
/articles/dzhon-gill-spravochnik/
/articles/dzhon-gill-istoricheskiy-kontekst/
/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/
```

- Retired preview route must stay absent:

```text
/dev/article-mdx-pilot/
```

- `migration/page-ownership.json` объявляет public article route как:

```text
owner: astro
status: shadow-pilot
risk: 2
```

- Production-like `dist` удаляет этот route через существующий `copy-legacy-to-dist.js --omit-build-only` + ownership guard.

## Почему выбран `dzhon-gill-spravochnik`

Legacy article:

```text
/articles/dzhon-gill-spravochnik/
```

относительно малая и справочная. Она подходит для первого content-model proof: есть серия, related, OG image, dates, tags и sourcesRequired, и теперь имеет curated MDX body draft для strict parity, но public legacy URL пока остаётся production truth.

## Что это НЕ делает

```text
❌ не заменяет /articles/dzhon-gill-spravochnik/ в production root;
❌ не меняет deploy.yml;
✅ добавляет публичный Astro article route только в `dist` shadow output;
❌ не удаляет legacy article HTML;
❌ не включает React runtime для статей.
```

## Exit criteria текущего шага

Зелёные:

```bash
npm run astro:pilot:article-mdx
npm run astro:audit:article-mdx
npm run strangler:deploy-readiness
npm run ci:check
```

Ключевой ожидаемый результат:

```text
Astro check/build: 0 errors, 0 warnings, 0 hints
/dev/article-mdx-pilot/: Astro noindex route present and guarded
production-like dist: build-only route absent
public article in dist is Astro shadow-owned
repository root legacy article remains production truth
preview canonical stays /dev/article-mdx-pilot/
preview title/description/H1/OG/article meta/date/Article JSON-LD/BreadcrumbList mirror legacy intent
URL contract compare: 42 baseline pages, 42 current public pages
```

Текущий audit результат:

```text
dzhon-gill-spravochnik: legacy words 1694; public shadow words 1611; ratio 0.95; H2 12/12
dzhon-gill-istoricheskiy-kontekst: legacy words 2969; public shadow words 2954; ratio 0.99; H2 13/13
rimlyanam-7-veruyushchiy-ili-neveruyushchiy: legacy words 2600; public shadow words 2419; ratio 0.93; H2 14/14
multi-article strict shadow audit: passed (3 articles)
```

`astro:audit:article-mdx:strict` теперь проходит. Retired preview route `/dev/article-mdx-pilot/` is now absent. Public article URL в `dist` остаётся Astro shadow output; repository root legacy HTML остаётся production truth.

## Что дополнительно закрыто

```text
[x] curated MDX body draft для `dzhon-gill-spravochnik`
[x] word-count parity выше strict threshold: 0.96
[x] H2 parity: 12/12
[x] `og:type=article`
[x] `article:published_time` / `article:modified_time` / `article:author`
[x] Article JSON-LD url/mainEntityOfPage/author на intended public canonical
[x] BreadcrumbList JSON-LD на intended public canonical
[x] public Astro route `/articles/dzhon-gill-spravochnik/` в `dist`
[x] public Astro route `/articles/dzhon-gill-istoricheskiy-kontekst/` в `dist`
[x] public Astro route `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/` в `dist`
[x] ownership manifest: 3 article URLs -> `astro` / `shadow-pilot`
[x] production-like `dist`: 42 public pages, 4 explicit Astro baseline routes, dev routes omitted
```


## Deploy-readiness integration update

После public shadow ownership article audit включён в общий dist readiness слой:

```bash
npm run strangler:deploy-readiness
```

теперь выполняет:

```bash
npm run astro:audit:about
npm run astro:audit:article-mdx:strict
npm run strangler:audit:production-like
```

Manual **Dist Strangler Dry Run** также проверяет artifact shape:

```text
[x] dist/articles/dzhon-gill-spravochnik/index.html exists
[x] dist/articles/dzhon-gill-istoricheskiy-kontekst/index.html exists
[x] dist/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.html exists
[x] dist/dev/astro-test/index.html absent
[x] dist/dev/article-mdx-pilot/index.html absent
```

`check-workflows.js` теперь падает, если эти safety rails удалить из `package.json` или dry-run workflow.


## Dist publication audit hardening update

General dist publication audit теперь тоже знает о первом article shadow route:

```text
[x] required dist file: articles/dzhon-gill-spravochnik/index.html
[x] required dist file: articles/dzhon-gill-istoricheskiy-kontekst/index.html
[x] required dist file: articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.html
[x] /articles/dzhon-gill-spravochnik/ is Astro-owned output
[x] /articles/dzhon-gill-spravochnik/ is indexable in dist
[x] /articles/dzhon-gill-spravochnik/ canonical is public URL
[x] /articles/dzhon-gill-spravochnik/ has no pilot/noindex copy
[x] /dev/article-mdx-pilot/ absent from all strangler/article-shadow outputs
[x] sitemap.xml does not include /dev/article-mdx-pilot/
```

Это дополняет `astro:audit:article-mdx:strict`: article-specific audit проверяет глубокий SEO/content contract, а `dist-publication-audit` проверяет общий shape будущего Pages artifact.


## Dev preview retirement update

После того как public shadow route получил strict content/SEO audit и general dist publication guard, отдельный dev preview больше не нужен.

Удалено:

```text
src/pages/dev/article-mdx-pilot/index.astro
migration route: /dev/article-mdx-pilot/
```

Оставшийся contract:

```text
[x] /articles/dzhon-gill-spravochnik/ exists in dist and is Astro shadow-owned
[x] /articles/dzhon-gill-istoricheskiy-kontekst/ exists in dist and is Astro shadow-owned
[x] /articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/ exists in dist and is Astro shadow-owned
[x] repository root legacy article remains production truth
[x] /dev/article-mdx-pilot/ is absent
[x] /dev/astro-test/ remains the only build-only dev Astro route
```

## Progress snapshot

```text
Общий Astro/MDX переход:          ~31%
Safety/gates слой:                ~87%
Build-time strangler readiness:   ~77%
/about/ Astro pilot:              ~85%
MDX/article pipeline:             ~37%
Public shadow ownership:          4/42 baseline pages (~9.5%)
Articles shadow-owned:            3/10 article pages (30%)
Production migration:             ~0–3%, deploy не переключаем
Осталось:                         39/42 baseline pages still legacy-owned in dist
```

## Следующий профессиональный шаг

Не deploy switch. Следующий безопасный шаг — стабилизировать article migration pattern перед второй статьёй:

```text
[ ] manual visual review public shadow article in `dist`
[x] `/dev/article-mdx-pilot/` canary removed after public shadow route became fully guarded
[ ] optionally extract reusable article route helper before second article
[ ] choose fourth low-risk article and repeat MDX strict -> shadow route sequence
[ ] production deploy всё ещё не переключать
```

Production deploy switch — отдельное решение владельца после dist dry-run/manual review/SW cache bump.
