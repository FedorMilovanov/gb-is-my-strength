# ASTRO_MDX_ARTICLE_PILOT_STATUS_2026-06-15.md

Дата: 2026-06-15
Статус: **public shadow ownership in dist; production deploy не меняется**
Риск-уровень: **Level 2/3 — public Astro shadow route in dist only, root production still legacy**

## Цель

Начать следующий этап после Astro `/about/` и strangler-guards: проверить, что статьи можно переносить в Astro Content Collections/MDX без замены production legacy HTML.

Это не production deploy switch. Это shadow ownership в локальном/CI `dist`: root production всё ещё legacy HTML.

## Добавлено

```text
src/content.config.ts
src/content/articles/dzhon-gill-spravochnik.mdx
src/layouts/ArticleLayout.astro
src/pages/dev/article-mdx-pilot/index.astro
src/pages/articles/dzhon-gill-spravochnik/index.astro
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
```

- Preview route остаётся build-only/noindex:

```text
/dev/article-mdx-pilot/
```

- `migration/page-ownership.json` объявляет public article route как:

```text
owner: astro
status: shadow-pilot
risk: 2
```

- Preview route остаётся:

```text
owner: astro-noindex
status: build-only
risk: 1
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
legacy words: 1694; public shadow words: 1611; ratio: 0.95
legacy words: 1694; preview words: 1630; ratio: 0.96
legacy h2 count: 12; public/preview h2 count: 12
strict shadow audit: passed
```

`astro:audit:article-mdx:strict` теперь проходит. Preview остаётся build-only/noindex. Public article URL в `dist` теперь Astro shadow output; repository root legacy HTML остаётся production truth.

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
[x] ownership manifest: `/articles/dzhon-gill-spravochnik/` -> `astro` / `shadow-pilot`
[x] production-like `dist`: 42 public pages, 2 explicit Astro baseline routes, dev routes omitted
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
[x] dist/dev/astro-test/index.html absent
[x] dist/dev/article-mdx-pilot/index.html absent
```

`check-workflows.js` теперь падает, если эти safety rails удалить из `package.json` или dry-run workflow.


## Dist publication audit hardening update

General dist publication audit теперь тоже знает о первом article shadow route:

```text
[x] required dist file: articles/dzhon-gill-spravochnik/index.html
[x] /articles/dzhon-gill-spravochnik/ is Astro-owned output
[x] /articles/dzhon-gill-spravochnik/ is indexable in dist
[x] /articles/dzhon-gill-spravochnik/ canonical is public URL
[x] /articles/dzhon-gill-spravochnik/ has no pilot/noindex copy
[x] /dev/article-mdx-pilot/ absent from production-like dist
[x] sitemap.xml does not include /dev/article-mdx-pilot/
```

Это дополняет `astro:audit:article-mdx:strict`: article-specific audit проверяет глубокий SEO/content contract, а `dist-publication-audit` проверяет общий shape будущего Pages artifact.

## Следующий профессиональный шаг

Не deploy switch. Следующий безопасный шаг — стабилизировать article migration pattern перед второй статьёй:

```text
[ ] manual visual review public shadow article in `dist`
[ ] decide whether `/dev/article-mdx-pilot/` stays as canary or is removed after public shadow route is enough
[ ] optionally extract reusable article route helper before second article
[ ] choose next low-risk article and repeat MDX strict -> shadow route sequence
[ ] production deploy всё ещё не переключать
```

Production deploy switch — отдельное решение владельца после dist dry-run/manual review/SW cache bump.
