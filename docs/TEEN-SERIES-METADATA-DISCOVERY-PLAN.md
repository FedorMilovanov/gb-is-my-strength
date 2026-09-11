# Teen series — metadata and discovery release plan

Status: **PUBLISHED / POST-RELEASE DISCOVERY REGRESSION PLAN**

The seven teen/adult-child articles are published production routes. This document is retained as the discovery contract and post-release regression checklist; statements below that describe the old Draft/noindex foundation are historical context, not current state.

## 1. Current published state

All seven canonical content records and public routes must remain coherent across the same release surfaces:

- `draft: false`;
- `noindex: false`;
- `sourcesRequired: true`;
- authoritative `publishedAt` plus truthful forward-moving `updatedAt`;
- `contentStatus: "published"` as editorial coordination metadata;
- registered production routes, landing, search, sitemap/feed and relation projection.

`contentStatus` is not by itself a machine publication lock. The effective public boundary is the agreement of canonical frontmatter, route ownership, robots/index policy and discovery projections.

## 2. Publication must be one logical transaction

Do not perform these as unrelated partially merged steps:

1. create route;
2. later add series registry;
3. later remove noindex;
4. later fix search;
5. later add sitemap/feed;
6. later correct OG/date metadata.

A production route is a discovery surface even before every crawler honors `noindex`. The release transaction must prove the complete state together.

## 3. Per-article metadata required at release

For every one of the seven articles verify explicitly:

- exact canonical slug and canonical URL;
- final `title` and `h1`;
- final description without sensational wording;
- author identity resolved through the current site owner;
- actual publication date (`publishedAt`) for the public release;
- truthful modification date (`updatedAt`);
- `draft: false`;
- `noindex: false` or removal according to current schema convention;
- `sourcesRequired: true` retained where policy requires it;
- series identity tied to `teen-double-life` through the current canonical owner;
- final `ogImage` / `ogImageAlt` if the article family consumes frontmatter media;
- related metadata only if it is reconciled with the canonical relation engine;
- tags/categories normalized to the current taxonomy.

The historical 8–9 September draft dates must not become public `datePublished` merely because they were present during content admission.

## 4. Series parity

Release must compare, not merely populate, the following projections:

- `teenSeriesConfig.ts`;
- `data/series.json`;
- content frontmatter series identity;
- public landing page;
- route profiles;
- `migration/page-ownership.json`;
- actual seven article routes;
- series rail order;
- prev/next order;
- relation graph nodes;
- search representation.

Canonical order everywhere:

`I -> II -> III -> A -> B -> C -> D`

Any projection that treats A-D as optional satellites is a release failure.

## 5. Discovery parity

The same exact release candidate must prove:

### Search

- all seven public routes appear exactly once when indexable;
- none appeared while still Draft/noindex;
- titles/descriptions/categories are correct;
- Pagefind/search body does not index hidden UI/tooltip payload as duplicate prose;
- bibliography does not dominate query relevance accidentally;
- series landing is searchable only if current policy intends it.

### Sitemap

- all seven canonical URLs appear exactly once after publication;
- no Draft URL leaked earlier;
- no alternate slash/non-slash duplicate;
- no stale precursor/superseded route.

### Feed

- inclusion follows the current article-feed policy;
- dates are the real publication dates;
- ordering is deterministic;
- description/excerpt does not expose internal draft/HOLD language.

### IndexNow

- only actually public canonical URLs are submitted;
- the release does not submit Draft/noindex candidates;
- submission follows the current release owner rather than article-local code.

## 6. SEO / structured data

For each route verify generated HTML, not just source intent:

- exactly one canonical;
- robots/indexability matches release state;
- one coherent title/description;
- `og:type=article` where current article family uses it;
- final approved image exists and dimensions/alt are truthful;
- `Article` JSON-LD has correct headline, dates, author, publisher and URL;
- `BreadcrumbList` points to the real teen landing and current article;
- `Article.isPartOf` (or current equivalent) identifies the teen series;
- no Pastor-series name/image/category leaks from a reused wrapper;
- no placeholder neutral icon is exposed as article/series primary image.

## 7. Route-family guard

Do not copy `PastorSeriesArticlePage.astro` unchanged and merely swap MDX.

A teen route may reuse the shared reader/series runtime, but must not inherit Pastor-specific:

- series title;
- breadcrumb label/landing;
- OG image;
- Pagefind category;
- `data-gbs2-series` identity;
- JSON-LD `CreativeWorkSeries` name/url;
- article section label or author-card wording where inappropriate.

Use a teen-specific thin wrapper or a safely generalized shared wrapper with explicit configuration. No second reader engine.

## 8. Post-release fail-closed checks

For every post-release change that can affect this series, require script/browser evidence that fails if any one of the following is true:

- fewer/more than seven canonical article routes;
- missing landing;
- wrong series order;
- `draft:true` or `noindex:true` remains on a supposedly published route;
- publication date is still the prepublication placeholder date without explicit approval;
- series registry/config mismatch;
- missing route ownership/profile;
- missing search node, relation graph node or sitemap URL;
- duplicate canonical/discovery URL;
- missing final OG asset;
- an unapproved placeholder/temporary rail cover reaches public HTML;
- internal `draft`, `HOLD`, Research PR coordination language appears in reader-facing content.

## 9. Post-deploy witness

After merge/deploy, verify the live production URLs rather than assuming build output equals edge state:

- HTTP 200 on landing + seven routes;
- canonical/robots/OG/JSON-LD from live HTML;
- final media loads;
- search discovers every intended route;
- sitemap/feed contain intended URLs;
- no Draft version is cached or publicly discoverable;
- series navigation links resolve and preserve the exact seven-step order.

Publication is complete only after this live witness; content admission and build success alone are not publication proof.
