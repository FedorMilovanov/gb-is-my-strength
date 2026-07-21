# Deploy cache-bust reconciliation — 2026-07-21

## Verified blocker

The special overlay implementation was squash-merged as `39f6c3ac5851b6ded164f4de42b4e9dba1ca72e7` and its immutable runtime blobs remain in current `main`. Production-like publication is nevertheless blocked before build because asset references were not reconciled after shared JavaScript changes.

Current read-only results:

- `node scripts/cache-bust.js`: 62 stale source files;
- `npm run validate:static-publication`: 113 cache-bust mismatch errors;
- affected current hashes include `js/site.js?v=5c949bf2`, `js/site-utils.js?v=30ed46cf`, and `js/floating-cluster-controller.js?v=f746adb1`;
- both `indexnow.yml` and `deploy.yml` currently run the checker without `--write`.

## Scope

1. Run the script's documented explicit migration bridge:
   `node scripts/cache-bust.js --write`.
2. Commit only machine-generated asset revision changes.
3. Prove idempotency with a subsequent read-only `node scripts/cache-bust.js`.
4. Run static publication validation and the production-like strangler build.
5. Confirm the special overlay runtime blobs themselves are unchanged.
6. Merge only after permanent CI and deployment gates are green.

## Generated transaction evidence

The one-shot reconciliation published generated commit `e7d73870edfde2d24f893dbcc9c1f3b81ac6c674` only after all transaction barriers completed successfully:

- changed paths were restricted to HTML, Astro and `src/lib/asset-version.js`;
- the MindMap application remained identical after removing revision query strings;
- the read-only cache-bust check was idempotently green;
- static publication, production-like build, ownership, contract extraction/comparison, JSON-LD and special-overlay writer checks completed;
- `js/site.js` and `karty/_engine/map-engine.js` remained byte-identical to the special-overlay merge.

The generated commit was authored by `github-actions[bot]`, so its standard pull-request workflows did not execute normally. This documentation commit intentionally retriggers the permanent PR checks without changing production behavior. The temporary reconciliation workflow has been removed from `main` in commit `8d9205ff5b6dacd45005e467db8b4e00c1c42531`.

## Non-goals

- no content rewriting;
- no visual redesign;
- no runtime behavior changes;
- no replacement of the cache-bust system with the future generated manifest;
- no relaxation of publication gates.
