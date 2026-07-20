# Lane: system-runtime-integrity-2026-07-21

- **Mode:** SYSTEM
- **Rollback point:** `56b1aee07b9948dfe2bcaa28d1ae2e24dd7739a8`
- **Files allowed:** `js/site-utils.js`, `scripts/runtime-integrity-test.js`, this lane report
- **Files forbidden:** production route components/content, CSS, workflows, migration registry
- **Source of truth:** current `main` plus the interrupted agent log and current runtime code

## Restored work

1. One protected, source-aware scroll-lock coordinator now survives the later `site.js` property-copy step.
2. Independent overlay sources cannot unlock each other.
3. Private `site.js` lock lifecycle is bridged through its existing global emergency hooks without rewriting the large minified bundle.
4. Saved highlights are deduplicated by normalized quote text and canonical page URL; the same quote on another page remains valid.
5. Existing duplicates are cleaned on startup and new writes are filtered before reaching localStorage.
6. The saved-quotes dialog starts with `aria-hidden="true"` and `inert`, then tracks its `is-open` class.

## Verification

- `node --check js/site-utils.js` — passed on the authored source.
- `node scripts/runtime-integrity-test.js` — passed in the local Node 22 harness.
- GitHub branch diff is limited to this SYSTEM lane.

## Environment limitation

The execution container has no outbound DNS access and no `gh` binary, so a full checkout and local `npm run validate:static-publication` were not possible. GitHub Actions on the draft PR is therefore the authoritative full barrier for this lane.
