# A05 — SEO, search, sitemap, RSS and social metadata

## Baseline

- Current source authority: `main@dfbea0d8342169178b4d3a30b4fb3dd77fd72890`.
- Evidence lane: `agent/a05-discovery-projection-closure-20260801`.
- Mode: LANE, read-only discovery/projection audit.
- Adjacent active work: Baptist landing/evidence PR #634; no file or ownership overlap.
- Canonical owners inspected:
  - effective public-surface registry;
  - `data/route-search-policy.json`;
  - `data/search-manifest.json`;
  - `scripts/lib/seo-route-contract.js`;
  - `scripts/lib/sitemap-route-contract.js`;
  - `scripts/lib/rss-route-contract.js`;
  - `scripts/lib/search-index-policy-contract.js`;
  - production-like `dist` audits and Route Registry Validators.

This report closes the bounded A05 salvage audit. It does not claim that editorial date governance or scripture-specific Pagefind projection is complete when those owners remain separate.

## Verdict

The current discovery architecture is registry-driven and materially stronger than the historical helper branches.

### Closed invariants

1. Every production route has exactly one explicit search/index policy record.
2. `noindex` routes must be excluded from Pagefind, search manifest, sitemap and RSS.
3. Production observation is compared with declared policy for Pagefind markers, search-manifest membership, sitemap membership and RSS membership.
4. Every indexable route must expose exactly one non-empty social metadata set: `og:image`, width, height, `twitter:image`, `twitter:site` and `twitter:creator`.
5. Every indexable sitemap entry is projected from the built page's canonical `og:image` and checked against the physical image bytes.
6. RSS items are checked for canonical local URLs, unique links/guids/routes, valid dates, registered production ownership and exclusion of explicit `noindex` routes.
7. Validators are read-only and run against the exact checked-out head.

### Honest residuals

1. `generatedAt`, RSS `lastBuildDate` and build timestamps are technical observations. They must not become editorial publication/modification authority. Full editorial freshness remains owned by Metadata v3.
2. The search manifest carries structured `scripture` values for relevant records, but the repository does not yet have one generic production assertion proving that scripture metadata survives into the built Pagefind index with the intended query semantics. This requires a small successor guard, not another search engine.

## Historical delta

### Social metadata exact-one

Historical head `agent/seo-dist-registry-contract@9aa2ddb163b643fbb9e1e76befa135fa79c52505` contained a useful exact-one rule but was no longer the architectural owner.

Decision: `ADD_GUARD_ONLY`, completed by PR #606.

The current route contract now rejects missing, empty and duplicate social tags while preserving explicit `noindex` behavior. The old standalone helper is not restored.

### Sitemap image projection

The production audit later exposed 34 warnings:

- 28 missing sitemap image blocks;
- 6 stale/mismatched image projections.

Decision: `REBUILD_FROM_CURRENT_MAIN`, completed by PR #636.

Current projection derives the sitemap image from built canonical `og:image`, inserts or synchronizes it, and verifies WebP/PNG/JPEG headers. The accepted dimensions are explicit 1200×630 Open Graph and 1200×675 editorial 16:9 profiles. Metadata is never fixed by declaring dimensions that disagree with the file bytes.

Final evidence from PR #636:

- 82 production routes;
- 73 indexable and 9 `noindex`;
- 73/73 canonical sitemap image owners;
- 28 images inserted, 6 synchronized, 39 unchanged;
- SEO audit: 0 errors, 0 warnings;
- search/index policy: 82 routes, 82 policies, 0 problems;
- public Chromium matrix: 3776/3776;
- route semantics: 1029/1029;
- Chromium, WebKit, Runtime Interactive Audit and Visual Parity green.

### Route/channel membership

Decision: `KEEP_CURRENT`.

`search-index-policy-contract` is the single membership authority. For every production route it compares the declared values:

- `indexPolicy`;
- `pagefindPolicy`;
- `searchManifestPolicy`;
- `sitemapPolicy`;
- `rssPolicy`;

against actual production observations. A `noindex` route is invalid unless all four discovery channels are excluded. Independent channel inclusion is allowed only when explicitly declared; equality of every list is not assumed.

This is stronger than requiring sitemap, RSS and Pagefind to contain identical routes, because landing pages, tools, articles and personal/noindex routes legitimately have different publication policies.

### RSS

Decision: `KEEP_CURRENT_WITH_METADATA_BOUNDARY`.

The RSS contract blocks:

- empty feeds;
- missing title/link/guid/pubDate/description;
- invalid, foreign or non-canonical URLs;
- duplicate links, guids or routes;
- link/guid mismatch;
- invalid dates;
- `lastBuildDate` older than the newest item;
- unregistered or non-production routes;
- explicit `noindex` routes in the feed.

Cross-channel observations such as an RSS route absent from the search manifest are inventory warnings inside the RSS reader, but the canonical search/index policy contract separately decides whether the difference is intentional. This avoids hard-coding the false rule that RSS and search must always contain the same kinds of pages.

## Required questions

### Does every indexable route have exactly one social metadata owner?

Yes. The exact-one contract and production dist audit fail on missing, empty or duplicate values. The sitemap image must match the built page owner and physical image header.

Decision: `GUARD` — complete.

### Do route registry, sitemap, RSS, search manifest and Pagefind agree?

They agree through explicit per-channel policy, not by forced list equality. Every production route has one policy record, and production observations are compared channel by channel.

Decision: `KEEP_CURRENT` — complete.

### Can a route be indexed by one channel while forbidden by another?

Only if the policy explicitly permits the channel difference. `indexPolicy=noindex` requires exclusion from all discovery channels and is fail-closed.

Decision: `GUARD` — complete.

### Did scripture search semantics survive later migrations?

Partially proven.

- Structured `scripture` metadata remains present in `data/search-manifest.json` for relevant content.
- Pagefind membership and body/metadata marker policy are covered on production `dist`.
- A generic assertion that known scripture queries resolve the intended records from the built Pagefind index is not yet a permanent repository-wide contract.

Decision: `ADD_GUARD_ONLY` — successor task. Add a small registry-derived fixture set containing known scripture references and verify the built Pagefind result identities. Do not create a second search index or duplicate the search manifest.

### Which dates are editorial and which are technical?

- `publishedTime` and `modifiedTime` are editorial projections and must come from controlled editorial metadata.
- `generatedAt`, feed build time and asset/build timestamps are technical.
- RSS `lastBuildDate` may describe feed generation freshness but must not rewrite item editorial dates.
- Git commit time, shared CSS/JS changes and cache-bust time must not imply article modification.

Decision: `REFERENCE_METADATA_V3`. A05 records and enforces the boundary but does not invent editorial dates.

## Permanent execution owner

Route Registry Validators remains the blocking owner. Its registry job runs:

- public-surface registry checks and mutations;
- sitemap route contract tests;
- RSS route contract and normalizer checks;
- SEO exact-one mutations;
- search/index policy mutations;
- read-only verification.

Its production browser job rebuilds `dist`, runs JSON-LD/SEO audit, strict search/index observation and full public-surface browser evidence. No A05-specific helper workflow is needed.

## Successor tasks

### A05-S1 — scripture Pagefind query guard

Mode: FAST or bounded LANE.

- derive a small fixture set from canonical search-manifest records that already contain `scripture`;
- build Pagefind from production-like `dist`;
- issue normalized reference queries;
- assert expected route identities and no `noindex` leakage;
- keep the fixture registry-derived and reject handwritten duplicate metadata.

### Metadata-v3 — editorial freshness authority

Mode: SYSTEM.

- separate editorial publication/modification from technical build/cache times;
- ensure PageHead, JSON-LD, sitemap `lastmod`, RSS items, search manifest and Pagefind metadata read one editorial record;
- keep feed `lastBuildDate` technical;
- make validation read-only.

## Final disposition

- exact-one social metadata: `GUARD`, complete;
- sitemap images: `REBUILD_FROM_CURRENT_MAIN`, complete;
- route/channel membership: `KEEP_CURRENT`, complete;
- RSS canonical/ownership contract: `KEEP_CURRENT`, complete;
- scripture metadata presence: `KEEP_CURRENT`;
- scripture Pagefind query behavior: `ADD_GUARD_ONLY`, open successor;
- editorial freshness: `REFERENCE_METADATA_V3`, separate SYSTEM owner;
- historical standalone helpers: `SUPERSEDED`, do not restore.

A05 is therefore closed as a discovery-projection audit with two explicit successor boundaries. It must not be represented as having completed Metadata v3 or scripture-query behavior until those owners provide exact-head evidence.