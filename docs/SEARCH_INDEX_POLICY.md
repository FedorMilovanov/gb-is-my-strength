# Search & Index Policy

`data/route-search-policy.json` is the explicit publication contract for every route whose effective owner status is `production-dist`.

The contract deliberately separates editorial scope from publication behavior. Fields such as `scope`, migration lane names, component names and route-name patterns must not decide whether a page is indexed or searchable.

## Required fields

Every production route declares:

- `indexPolicy`: `index` or `noindex`;
- `pagefindPolicy`: `include`, `metadata-only` or `exclude`;
- `searchManifestPolicy`: `include` or `exclude`;
- `sitemapPolicy`: `include` or `exclude`;
- `rssPolicy`: `include` or `exclude`;
- `contentKind`: stable content classification;
- `librarySection`: reader-facing library section;
- `topicCategory`: reader-facing subject category.

A `noindex` route must also be excluded from Pagefind, the search manifest, sitemap and RSS. Personal surfaces must be `noindex`.

## Source of truth and observed state

The policy is checked against the production-like build, not against assumptions about source files. `scripts/search-index-policy-inventory.js` compares every production route with:

- the effective route registry;
- built `dist` robots metadata;
- built Pagefind markers;
- `data/search-manifest.json`;
- `sitemap.xml`;
- `feed.xml`.

The strict check fails when a production route has no policy, a non-production route has a policy, or observed output differs from the declared contract.

## RSS contract

`scripts/rss-route-contract-test.js` requires canonical same-origin URLs, matching links and GUIDs, valid dates, unique registered production routes and exclusion of explicit `noindex` pages. Editorial warnings such as chronology are reported separately from structural failures.

## Search-manifest normalization

`scripts/search-manifest-policy-normalizer.js` can promote an explicitly public RSS article into the internal search manifest. Metadata is extracted from the built native PageHead; it is not handwritten or inferred from a route name.

The normalizer is idempotent, rejects duplicate IDs and URLs, and refuses to create an entry when required built metadata is absent. Its write workflow is same-repository only, label-gated and restricted to:

- `data/route-search-policy.json`;
- `data/search-manifest.json`.

Ordinary validation remains read-only. After any write run, remove the `autofix` label and require a fresh exact-head CI cycle.

## Review sequence

1. Sync with the current `main` and confirm the exact base SHA.
2. Change the explicit policy rather than adding route-specific runtime logic.
3. Run mutation tests and the production-like strict inventory.
4. Inspect the complete diff and generated reports.
5. Require exact-head registry, SEO, browser, route-semantics and shared-file checks before merge.
