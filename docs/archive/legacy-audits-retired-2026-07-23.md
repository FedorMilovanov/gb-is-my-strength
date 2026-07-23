# Retired legacy audit implementations — 2026-07-23

Current-head inventory at source `83f04647c470a92c340d4d7990485c4e1376836b` proved:

- 75 production routes;
- zero strict-native production routes with legacy runtime markers;
- zero production routes importing `_legacy`, `legacy` or `?raw` sources;
- the three scripts below had no tracked references and duplicated older hardcoded-exclusion logic.

## Removed implementations

| Retired script | Current canonical replacement |
|---|---|
| `scripts/legacy-audits/check-route-profiles-legacy.js` | `scripts/check-route-profiles.js` compatibility command plus `scripts/route-profile-contract-audit.js --strict`, driven by the effective route registry |
| `scripts/legacy-audits/check-route-migration-matrix-legacy.js` | `scripts/check-route-migration-matrix.js` plus `scripts/route-migration-matrix-contract-audit.js --strict` |
| `scripts/legacy-audits/check-content-source-coverage-legacy.js` | `scripts/check-content-source-coverage.js` plus `scripts/content-source-provenance-audit.js --strict` |

The retired scripts remain recoverable from Git history. They were not copied into another executable archive because doing so would preserve a second runnable contract surface.

## Deliberately retained

- `scripts/copy-legacy-to-dist.js` — active strangler/deploy dependency;
- route-profile `legacyPath` values — parity and migration references, not runtime imports;
- current legacy-shadow/parity audit tooling that still has package/document references;
- archival research and historical documentation under existing `archive/` directories;
- `.github/workflows/_temp-gill-source-marathon-orchestrator.yml` — active transaction owner for draft PR #156, to be removed when that lane finishes.
