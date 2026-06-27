# Lane Report: `system-premiumcontrols-reconciliation-2026-06-27`

**Branch:** `lane/system-premiumcontrols-reconciliation-2026-06-27`
**Mode:** SYSTEM
**Scope:** PremiumControls reconciliation & Control plane parity
**Status:** merged
**Owner:** arena-surgical-surgeon
**Started:** 2026-06-27
**Updated:** 2026-06-27

---

## Changed files

- `AGENTS.md` — Reconciled Section 2 inventory (8 CSS / 12 JS + modules). Added Section 3.10 `PremiumControls / Floating Cluster (protected subsystem)` verbatim with core invariants, explicit forbids, and regression history. Added AGENTS-r300.
- `package.json` — Fixed `workflows:check` policy match by updating `dist:jsonld:audit` script to `--root dist`.
- `migration/route-migration-matrix.json` — Reconciled `/izbrannoe/` route contract (`native-with-legacy-head`).
- `scripts/check-content-source-coverage.js` — Reconciled `/izbrannoe/` as excluded/noindex route in coverage checker.
- `scripts/download-fonts.js` — Fixed syntax swallowing bug on `Noto Serif Hebrew`.

---

## Checks

### FAST loop during iteration

- [x] `git diff --check`
- [x] `npm run guard:shared-files`
- [x] `npm run data:consistency`
- [x] `npm run migration:metadata:check`
- [x] `npm run native:runtime:audit:strict`
- [x] `npm run workflows:check`

### FULL barrier before commit/merge/push

- [x] `npm run validate:static-publication`
- [x] `npm run guard:shared-files`

---

## Out-of-lane findings

- `src/components/genealogy/layout.ts`: `resolveParent` algorithm limits genealogy tree to single parent (father priority), dropping maternal lines (Sarah, Rebekah, Bathsheba).
  - Suggested lane: `lane/shared-genealogy-multiparent-layout`
  - Not fixed in this lane (SYSTEM mode restriction).
- `karty/pavel/`, `karty/shoftim/` etc. (8 routes): production-dist status in `page-ownership.json` but excluded from `sitemap.xml` as holding pages.
  - Suggested lane: `lane/shared-karty-sitemap-status-reconciliation`
  - Not fixed in this lane.

---

## Merge recommendation

`merge`

---

## Rollback

Commit: `1a288da5cd9971bc37fb639eb1453e07db81b0a8`
Branch: `main`
