# Legacy shadow retirement readiness

**Status:** historical readiness snapshot / provenance-only
**Snapshot date:** 2026-08-06
**Snapshot base:** `main@a96cbe43f72a1a0d620f0af37c60047edb1f6e43`
**Current authority:** current legacy-reference ledger, route ownership, visual-parity authority and current retirement/readiness audits

This document answers a readiness question at one historical source anchor. Counts such as “51 retained shadows”, blocker totals, dependency classifications and the verdict below must not be reused as current state without rerunning the current source-owned audits.

## Purpose at the snapshot

This was the required proof stage between visual-parity authority transfer and any physical move or deletion of the 51 retained Astro root HTML shadows present at that source anchor.

It did not move, delete, rewrite or reclassify any reference. It answered one narrower question:

> Was the repository at `main@a96cbe43…` already safe for one atomic, blob-preserving quarantine move?

## Inputs at the snapshot

The report composed four then-current authorities:

1. `scripts/strangler-duplicate-inventory.mjs` — public `index.html` inventory at the snapshot;
2. `data/legacy-reference-ledger/manifest.json` plus four shards — immutable reference identity and dependency decisions;
3. `migration/page-ownership.json` — render owner at the snapshot;
4. `data/visual-parity-authority.json` — blocking native/built-app parity authority then associated with PR #1086.

## Proofs at the snapshot

For every effective Astro native shadow the audit verified:

- the primary inventory and immutable ledger reconciled, including governed paths omitted by the inventory;
- an immutable ledger entry existed;
- route and repository path identity agreed exactly;
- the file's Git blob SHA-1 matched the ledger;
- the byte SHA-256 matched the ledger;
- the reference had an explicit, recognized retirement classification;
- visual parity no longer depended on the root copy.

Every recorded dependency was then grouped into:

- nonblocking fixture/dist/comment use;
- mechanical repoint to the explicit legacy-reference API;
- obsolete reader to remove or repoint;
- owner decision required;
- unknown impact.

## Historical fail-closed boundary

The report could authorize a later physical move only when all of these were zero:

- unknown reference classifications;
- unexpected or non-retirable reference classifications;
- mechanical reader repoints;
- obsolete readers;
- dependency owner decisions;
- unknown dependency impacts;
- immutable identity failures;
- inventory coverage failures;
- parity-authority failures.

Until then its historical verdict remained:

`NOT_YET_SAFE_TO_MOVE_OR_DELETE`

The audit itself could remain successful so CI could publish the complete work queue. Safety was represented by `summary.deletionReady` and `summary.physicalMoveAuthorized`, not by hiding or weakening unresolved evidence.

This verdict is not the present-day retirement state. Recompute current readiness before any move/delete operation.

## Independent built app at the snapshot

`konfessii/russkij-baptizm/_app/index.html` was an explicit independent built app and was not part of the 51-shadow retirement set. PR #1086 measured it and selected no urgent split at that time. Current ownership must still be rechecked before acting on that historical boundary.

## Eventual move shape considered by this snapshot

The ledger already stored the exact Git blob SHA-1 for every reference. Once readiness reached zero blockers, the planned physical quarantine shape was:

- add each existing blob under `migration/legacy-reference/<route>/index.html`;
- remove the corresponding URL-shaped root path;
- update the ledger's storage path without changing route identity or hashes;
- retain the independent built app in place;
- prove production-like dist, Pagefind, sitemap/RSS, browser routes and no quarantine publication.

No such move was performed by this readiness document itself. Current source and current contracts decide whether this historical move shape remains applicable.
