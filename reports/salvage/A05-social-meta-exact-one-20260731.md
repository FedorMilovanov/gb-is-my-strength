# A05 — Social metadata exact-one guard

## Baseline

- Current main SHA inspected: `8322662260b1abb68ca89d059b3e67d3f839f844`.
- Historical evidence head: `9aa2ddb163b643fbb9e1e76befa135fa79c52505` (`feat(seo): enforce one social card image per production route`).
- Current owner: `scripts/lib/seo-route-contract.js`, invoked by the registry/dist SEO audit.
- Current scope: 82 production routes, including 73 indexable and 9 explicit noindex routes.

## Historical capability

The historical branch rejected missing, empty, or duplicate values for:

- `og:image`;
- `og:image:width`;
- `og:image:height`;
- `twitter:image`;
- `twitter:site`;
- `twitter:creator`.

That invariant lived in a separate script which is absent from current main.

## Current capability and gap

The modern registry-driven SEO contract is stronger architecturally: it derives generated route obligations from the canonical route registry and validates canonical/noindex consistency. However, the current metadata reader returns only the first matching value. A duplicated social tag can therefore remain invisible as long as the first value is non-empty.

## Decision

`ADD_GUARD_ONLY`

Do not restore the historical standalone audit. Extend the current route/dist owner so every indexable production route must render exactly one non-empty value for each of the six social metadata fields.

## Modernized design

- Parse every matching `<meta>` tag independent of attribute order.
- Preserve the existing first-value `getMeta()` API for current callers.
- Add an indexable-route exact-one audit inside `auditSeoRouteFiles()`.
- Do not impose social-card requirements on explicit noindex routes.
- Add adversarial fixtures for missing, empty, and duplicate values.

## Verification

Focused local verification:

```bash
node --check scripts/lib/seo-route-contract.js
node --check scripts/seo-route-contract-test.js
node scripts/seo-route-contract-test.js
```

Required CI evidence:

- Route Registry Validators;
- Metadata / IndexNow;
- Shared Files Guard;
- production-like dist SEO audit.

## Rollback

Revert the guard commit. No route content, package version, workflow version, dependency, or generated metadata is changed by this patch.
