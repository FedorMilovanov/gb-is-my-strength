# lane/system-route-profile-closeout-2026-06-24

**Date:** 2026-06-24  
**Mode:** SYSTEM  
**Scope:** route profile / migration metadata closeout, audit guard hardening  
**Branch:** `lane/system-route-profile-closeout-2026-06-24`

## Goal

Close metadata drift left after the strict-native refactor wave:

- route profiles existed but did not declare a strict-checkable `migrationMode` or `scope`;
- excluded semantic lanes (Gill / Nagornaya / hard-texts) were not explicit in route profiles;
- migration matrix marker warnings were caused by stale marker names and by the matrix checker not following `loadLegacyFullDocument()` targets for intentional app wrappers.

## Changes

### Route profiles

Updated production route profiles with explicit metadata:

- non-excluded production routes now declare `migrationMode` (`strict-native` or `legacy-shadow-app`);
- excluded semantic-lane routes now declare `scope: "excluded-semantic-lane"` and preserve their current `strict-native` runtime mode where applicable.

This closes strict route-profile audit failures without touching route UI/content.

### Migration matrix

Aligned stale required markers with the current public contracts:

- `/konfessii/`: `grid h-reveal` instead of stale `konfessii-grid`;
- `/baptisty-rossii/`: `gbs2-world` and `data-gbs2-series="russian-baptism"` instead of stale landing markers;
- `/karty/pavel/`: temporary noindex placeholder marker `data-content-status="temporary-placeholder"` instead of `data-pagefind-body`.

### Matrix checker

`scripts/check-route-migration-matrix.js` now follows literal `loadLegacyFullDocument('...')` targets when building the source closure. This lets the guard verify real wrapped public markers such as `iframe#appframe` / `./_app/index.html` for protected legacy-shadow app routes, instead of requiring marker-comment hacks in Astro route files.

### Content source checker

`scripts/check-content-source-coverage.js` now treats noindex / Pagefind-ignored temporary placeholder routes as intentionally non-searchable. This removes false warnings for hidden map placeholders (`/karty/pavel/`, `/karty/shoftim/`, etc.) without adding them to public search.

`data/route-profiles/baptisty-rossii.json` now declares `seriesLandingReadTimeMode: "summary-only"`, closing the Russian Baptists landing read-time policy warning.

## Verification

Passed:

```bash
PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH node scripts/check-route-profiles.js --strict
PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH node scripts/check-route-migration-matrix.js --strict
PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH node scripts/check-content-source-coverage.js --strict
PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH npm run data:consistency
PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH npm run workflows:check
PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH npm run validate:static-publication
PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH npm run guard:shared-files
```

## Out-of-lane notes

- `origin/lane/system-script-cleanup-2026-06-24` exists and removes obsolete scripts, but it is a separate system lane and was not merged here.
- This lane intentionally does not change `AGENTS.md`, production route components, CSS, JS runtime, or public content.

## Addendum — obsolete script cleanup integrated

Reviewed `origin/lane/system-script-cleanup-2026-06-24`:

- no textual merge conflict with this lane;
- no overlapping files with the route-profile closeout commit;
- package JSON parses;
- targeted checks for the cleanup branch passed after dependency install;
- standalone cleanup branch still showed old metadata warnings that this lane already closes.

The cleanup changes were integrated into this system lane as a squash-style working-tree application (not as an untagged merge commit), then committed with the current lane tag.

Additional cleanup:

- removed obsolete script files from the active npm surface;
- consolidated `content:parity` on `scripts/check-mdx-html-parity.js`;
- `route:taxonomy` now delegates to `native:runtime:audit`;
- removed stale references to deleted script names from active docs/research notes.

Additional verification:

```bash
PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH npm run content:parity
PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH npm run route:taxonomy
PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH npm run native:runtime:audit:strict
PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH npm run migration:metadata:check
```

## Addendum — Arena FAST/FULL gate documentation

Owner requested that future agents do not waste Arena time by running full Astro gates after every tiny edit, but still keep professional release quality.

Updated:

- `docs/WORK_MODES.md` — added FAST loop vs FULL gate policy and per-mode check strategy;
- `AGENTS.md` — made Arena speed/quality rule visible in the mandatory pre-work contract;
- `docs/SANDBOX-ENV-2026-06-21.md` — added concrete Arena Node 22 / npm ci / fast checks / full barrier workflow;
- `docs/LANE_LOCK_POLICY.md` — added lane-level FAST/FULL discipline;
- `docs/refactor-2026/lanes/TEMPLATE.md` — lane reports now separate FAST iteration checks from FULL barrier checks;
- `README.md` — article checklist now points to the fast relevant gate set during iteration and full barrier before production-impact commit/merge/push.

Rationale:

- FAST loop catches local errors in seconds;
- FULL `validate:static-publication` remains required before production/system/refactor lane release;
- Arena sandbox constraints (2 CPU / ~2 GB RAM, non-persistent `/tmp`, `node_modules`, `dist`) are now documented as operational facts, not tribal knowledge.
