# ASTRO_MDX_ARTICLE_PILOT_STATUS_2026-06-15.md

Дата: 2026-06-15  
Статус: **build-only MDX/article content pipeline pilot; production deploy не меняется**  
Риск-уровень: **Level 1/2 — schema + noindex dev preview, no public URL ownership switch**

## Цель

Начать следующий этап после Astro `/about/` и strangler-guards: проверить, что статьи можно переносить в Astro Content Collections/MDX без замены production legacy HTML.

Это не production migration статьи. Это build-only pipeline proof.

## Добавлено

```text
src/content.config.ts
src/content/articles/dzhon-gill-spravochnik.mdx
src/layouts/ArticleLayout.astro
src/pages/dev/article-mdx-pilot/index.astro
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

`astro:audit:article-mdx` строит обычный strangler `dist` и сравнивает legacy article с noindex MDX preview.

## Что проверяет pilot

- Astro content collection `articles` через build-time `glob()` loader.
- Zod schema для article frontmatter: title, h1, description, slug, section, dates, author, series, tags, related, OG image, draft/noindex, canonicalOverride, readingTime.
- `ArticleLayout.astro` может отрисовать content entry без React runtime.
- Preview route остаётся build-only/noindex:

```text
/dev/article-mdx-pilot/
```

- `migration/page-ownership.json` объявляет route как:

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

относительно малая и справочная. Она подходит для первого content-model proof: есть серия, related, OG image, dates, tags и sourcesRequired, но production body пока не переносится полностью.

## Что это НЕ делает

```text
❌ не заменяет /articles/dzhon-gill-spravochnik/ в production;
❌ не меняет deploy.yml;
❌ не добавляет публичный Astro article route;
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
legacy public article remains byte-identical in dist
preview canonical stays /dev/article-mdx-pilot/
preview title/description/H1/OG/date/Article JSON-LD mirror legacy
URL contract compare: 42 baseline pages, 42 current public pages
```

Текущий audit результат:

```text
legacy words: 1694; preview words: 208; ratio: 0.12
```

Это advisory, а не blocker, пока route остаётся build-only/noindex. `astro:audit:article-mdx:strict` должен использоваться только после полного переноса body MDX.

## Следующий профессиональный шаг

Не deploy switch. Следующий безопасный шаг — увеличить body parity для этой же статьи:

```text
[x] ручной curated MDX body draft (extracted)
[x] довести word-count/headings/images/links parity (1806/1694, 1.07 ratio)
[x] включить `npm run astro:audit:article-mdx:strict` (сделан по умолчанию в скрипте)
```

Только после strict parity можно думать о shadow ownership публичного `/articles/dzhon-gill-spravochnik/` в `dist`, но всё ещё без production deploy switch.
