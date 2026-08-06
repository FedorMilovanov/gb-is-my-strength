# Legacy shadow retirement readiness

Date: 2026-08-06  
Base: `main@a96cbe43f72a1a0d620f0af37c60047edb1f6e43`

## Purpose

This is the required proof stage between visual-parity authority transfer and any physical move or deletion of the 51 retained Astro root HTML shadows.

It does not move, delete, rewrite or reclassify any reference. It answers one narrower question:

> Is the current repository already safe for one atomic, blob-preserving quarantine move?

## Inputs

The report composes four existing authorities:

1. `scripts/strangler-duplicate-inventory.mjs` — exact current public `index.html` inventory;
2. `data/legacy-reference-ledger/manifest.json` plus four shards — immutable reference identity and dependency decisions;
3. `migration/page-ownership.json` — current render owner for every public route;
4. `data/visual-parity-authority.json` — blocking native/built-app parity authority merged in PR #1086.

## Proofs

For every effective Astro native shadow the audit verifies:

- the primary inventory and immutable ledger reconcile, including governed paths omitted by the inventory;
- an immutable ledger entry exists;
- route and repository path identity agree exactly;
- the current file's Git blob SHA-1 matches the ledger;
- the current byte SHA-256 matches the ledger;
- the reference has an explicit, recognized retirement classification;
- visual parity no longer depends on the root copy.

Every recorded dependency is then grouped into:

- nonblocking fixture/dist/comment use;
- mechanical repoint to the explicit legacy-reference API;
- obsolete reader to remove or repoint;
- owner decision required;
- unknown impact.

## Fail-closed boundary

The report can authorize a later physical move only when all of these are zero:

- unknown reference classifications;
- unexpected or non-retirable reference classifications;
- mechanical reader repoints;
- obsolete readers;
- dependency owner decisions;
- unknown dependency impacts;
- immutable identity failures;
- inventory coverage failures;
- parity-authority failures.

Until then the verdict remains:

`NOT_YET_SAFE_TO_MOVE_OR_DELETE`

The audit itself remains successful so CI can publish the complete work queue. Safety is represented by `summary.deletionReady` and `summary.physicalMoveAuthorized`, not by hiding or weakening unresolved evidence.

## Independent built app

`konfessii/russkij-baptizm/_app/index.html` is an explicit independent built app and is not part of the 51-shadow retirement. PR #1086 measured it and selected no urgent split. This report must always preserve that boundary.

## Eventual move shape

The ledger already stores the exact Git blob SHA-1 for every reference. Once readiness reaches zero blockers, the physical quarantine can be performed as one atomic Git-tree transaction:

- add each existing blob under `migration/legacy-reference/<route>/index.html`;
- remove the corresponding URL-shaped root path;
- update the ledger's storage path without changing route identity or hashes;
- retain the independent built app in place;
- prove production-like dist, Pagefind, sitemap/RSS, browser routes and no quarantine publication.

No such move is performed by this readiness lane.
