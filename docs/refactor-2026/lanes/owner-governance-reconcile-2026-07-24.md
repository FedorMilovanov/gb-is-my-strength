# Owner governance reconciliation — 2026-07-24

| Field | Value |
|---|---|
| Mode | `SYSTEM` |
| Lane | `agent/owner-governance-reconcile-2026-07-24` |
| Issue | #219 |
| Routes | none |
| Rollback point | `main@c27176bf6cc61dcc4ca3411f38c307ab38002161` |

## Permanent scope

- `AGENTS.md`
- `docs/OWNER-INVARIANTS.md`
- `scripts/check-agents-rev-uniqueness.js`
- this lane declaration

The transaction temporarily used `scripts/_temp-owner-governance-*` and
`.github/workflows/_temp-owner-governance-*`. They must be absent from the final tree.

## Forbidden scope

- runtime source, route content and generated HTML
- package files and dependency locks
- migration/data registries
- permanent workflow changes
- CSS/JS runtime and UI components

## Owner-authorized decision

Use one current operating model: FAST / LANE / SYSTEM, ordinary branch+PR mutation,
live GitHub ownership discovery, source registries over derived route matrices, live
environment discovery, checksum-verified actionlint, and separate iteration /
exact-head / production evidence.

Owner-sensitive UI/content/data protections remain. Historical implementation snapshots
are provenance unless a current owner decision, source contract or exact-head blocking
guard still makes them normative.

## Permanent regression protection

The existing `npm run guard:agents-rev` now also validates governance consistency across:

- `AGENTS.md`
- `docs/WORK_MODES.md`
- `docs/LANE_LOCK_POLICY.md`
- `docs/OWNER-INVARIANTS.md`

It rejects the exact stale mode, direct-main, route-matrix, sandbox and actionlint phrases
removed by issue #219. No new workflow or package script was introduced.

## Final evidence required

- final diff contains no runtime or permanent workflow changes;
- temporary writer/workflow are removed;
- `git diff --check`;
- `npm run guard:shared-files`;
- `npm run workflows:check`;
- `npm run control-plane:audit`;
- `npm run workflows:lint`;
- issue #219 closes only after merge.
