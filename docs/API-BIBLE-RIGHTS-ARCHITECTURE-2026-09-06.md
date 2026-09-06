# API.Bible rights-safe integration architecture

Date: 2026-09-06  
Owner policy: **free-only / individual non-commercial project**  
Tracking issue: #1753

## Purpose

Define the implementation boundary for API.Bible before any protected Russian Bible edition is enabled in Product.

This document is an engineering/rights contract. It does **not** redistribute Scripture text, record private correspondence, publish API keys, or claim edition-specific permission beyond what has been confirmed.

## Controlling provider boundary

Current human support guidance recorded in #1753 establishes the following operational rules for the individual non-commercial project:

1. API.Bible exposes Russian Bible translations that may be used through the API subject to edition/provider terms.
2. The former `500 consecutive verses` cache ceiling is no longer the controlling cache rule.
3. An application may cache as much API-delivered Bible content as needed, including an entire translation, provided cached content is refreshed from API.Bible at least once every **30 days**.
4. Cache permission is **not** permission to redistribute a protected corpus independently.
5. Protected full-text search must remain **API-backed** where the provider requires that route; do not build an independent local protected-text search corpus/index.
6. Public Git may contain integration code, non-secret configuration, provider/edition identifiers and rights metadata, but must not contain API keys or protected Scripture corpora unless an edition licence explicitly permits redistribution.

If future provider guidance conflicts with this document, the newer authoritative edition/provider instruction wins and this contract must be updated before deployment.

## Architecture

```text
browser / reader UI
        |
        v
application Bible service
        |
        +---- metadata/rights registry (public, no protected text)
        |
        +---- API.Bible search proxy ----------> API.Bible search endpoint
        |
        +---- passage/content fetch -----------> API.Bible content endpoint
                          |
                          v
                 controlled private cache
                 TTL / refresh <= 30 days
```

### Non-negotiable separation

`cache != redistributed corpus`

The controlled cache exists to serve the application under the provider's API/cache permission. It must not be exposed as a bulk dump, repository asset, downloadable corpus, static archive, or independent public dataset.

`API-backed search != local protected-text index`

Do not generate Lucene/SQLite/JSON/JS/static-site indexes containing a protected edition's full text merely because the same text may be cached for application rendering.

## Edition registry

Each API.Bible edition must be represented by metadata before it can be enabled.

Minimum fields:

```ts
type BibleEditionRights = {
  provider: 'api.bible';
  apiBibleId: string;
  language: string;
  displayName: string;
  abbreviation: string;
  copyrightNotice: string;
  attribution: string;
  sourceUrl?: string;

  rightsStatus: 'disabled' | 'metadata-only' | 'api-render' | 'api-render-with-cache';
  searchMode: 'disabled' | 'api-backed';
  cacheMaxAgeDays: number | null;
  publicCorpusRedistribution: false;
  publicFullTextIndex: false;

  verifiedAt: string;
  evidenceScope: string;
};
```

Protected editions must default to:

```text
rightsStatus = disabled
searchMode = disabled
publicCorpusRedistribution = false
publicFullTextIndex = false
```

They may move to an enabled state only after exact edition ID, copyright/attribution text and edition-specific boundary are verified.

## Cache contract

For an edition allowed to use the current API.Bible cache boundary:

- `cacheMaxAgeDays <= 30`;
- persist `fetchedAt` and `sourceEditionId` with each cached object or cache generation;
- stale content must be refreshed before being treated as current application content;
- refresh failures must fail safely: do not silently extend an expired rights TTL indefinitely;
- cache storage must be outside public repository history;
- no endpoint may provide bulk export of the protected cache;
- cache invalidation must be possible per edition;
- edition removal/revocation must permit purge of its cached content without affecting other editions.

A deployment may choose a shorter TTL.

## Search contract

For protected API.Bible editions:

- search requests go to the documented API-backed search route;
- application code may cache ordinary request/response results transiently where permitted, but must not construct a complete reusable local full-text index;
- no generated static search payload may contain the protected corpus;
- no client bundle may embed the full protected edition;
- no CI artifact intended for public distribution may include the full protected text.

Public-domain/open editions may use a separate explicit rights path and are not automatically constrained by this protected-edition rule.

## Secrets

API keys and credentials:

- never commit to Git;
- never place in public client-side JavaScript if the provider treats the credential as secret;
- inject through the repository/deployment secret mechanism;
- redact from logs and diagnostic artifacts;
- fail closed when the key is absent rather than falling back to an unauthorized scraped/local corpus.

## Attribution / copyright rendering

Before an edition is enabled, Product must have a deterministic way to render the required attribution/copyright notice near the Bible-reading experience or through the provider-approved attribution surface.

Do not invent shortened copyright wording. Store the exact approved/public provider wording in edition metadata once verified.

## Static generation / offline boundary

No protected edition may be copied into generated static HTML, JSON, search data, service-worker precache, offline packs or downloadable assets in bulk merely because the runtime cache permits application storage.

Any offline/static-render capability for a protected edition is **disabled by default** and requires a separately verified edition/provider grant.

## Repository boundary

Allowed in public Git:

- API client/service code;
- tests with synthetic/public-domain fixtures;
- exact public edition IDs;
- attribution and rights metadata;
- cache/search policy code;
- schema and validators.

Not allowed in public Git without explicit redistribution permission:

- protected full Bible text;
- generated protected full-text indexes;
- API secrets;
- private correspondence or contracts;
- provider cache dumps.

## Failure-state contract

Rights ambiguity is a product state, not an invitation to guess.

An edition must remain disabled when any of the following is unknown:

- exact API.Bible edition identity;
- required attribution/copyright wording;
- whether the edition is available to this project/account;
- whether a requested feature exceeds the API/cache/search boundary;
- whether offline/static redistribution is allowed.

UI/engineering must not silently substitute another copyrighted edition.

## Validation / CI acceptance

Before the first protected API.Bible edition is enabled, add permanent checks that fail when:

1. an enabled edition lacks `apiBibleId`, attribution or verification date;
2. `cacheMaxAgeDays > 30` for the current API.Bible cache path;
3. a protected edition declares local/public full-text search;
4. a protected edition declares public corpus redistribution;
5. a protected corpus-like payload is added to public generated search/static assets;
6. an API key-shaped secret is committed through the integration configuration path;
7. an edition is enabled without an explicit rights status.

Tests must use synthetic or clearly redistributable fixtures rather than copying protected provider text into the repository.

## Current implementation disposition

### Safe to implement now

- provider adapter skeleton;
- rights/edition metadata schema;
- fail-closed registry defaults;
- cache TTL enforcement (`<=30 days`);
- API-backed search routing contract;
- secret-only credential plumbing;
- validators/tests using synthetic fixtures.

### Must remain open before enabling named Russian editions

- exact Russian API.Bible edition IDs;
- exact edition display names/abbreviations;
- exact required copyright/attribution wording;
- any edition-specific restrictions that are stricter than the generic API/cache guidance;
- exact static/offline boundary.

## Other provider separation

This contract applies only to API.Bible integrations. It does not grant rights for:

- RBO/SRP/CASS70/local RBO corpora;
- Biblica NIV/Russian New Translation outside their approved route;
- Bible League ERV/RSP;
- Zaoksky/BTI Kulakov;
- ETCBC/SyrNT;
- ESV/THGNT;
- Bible Brain audio/text;
- any other publisher or scholarly apparatus.

Each remains governed by its own rights record in #1753.

## Cost policy

No paid licence, paid corpus acquisition, legal-entity workaround or paid provider tier is a prerequisite for this lane. If a desired edition/capability is available only through a paid or organizational route, leave that edition/capability disabled.

## Definition of Done for this architecture lane

- this rights-safe architecture is merged;
- no protected text or secret is added;
- exact Russian edition identity/attribution discovery is tracked separately;
- the first implementation PR must reference this contract and #1753;
- any divergence from these rules requires an explicit rights-evidence update, not a silent code exception.
