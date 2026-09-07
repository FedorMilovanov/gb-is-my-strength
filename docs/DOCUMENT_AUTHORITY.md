# Document Authority — current vs historical documentation

**Machine SSOT:** [`../data/document-authority.json`](../data/document-authority.json)  
**Validator:** [`../scripts/document-authority-audit.mjs`](../scripts/document-authority-audit.mjs)

## Rule

A Markdown filename is not an authority signal. Words such as `CURRENT`, `FINAL`, `READY`, a recent-looking date, or a historically important owner quote do not outrank the registered current contract.

Authority order remains:

1. current owner instruction;
2. current Product tree, relevant open PR/issues and exact-head evidence;
3. current machine/source owners;
4. documents registered here as `status=current` with `authority=normative`;
5. current supporting contracts;
6. historical/provenance material.

Unregistered documentation is non-normative by default until deliberately classified. This prevents a forgotten migration plan or lane report from silently becoming policy.

## Lifecycle fields

Each managed document declares:

- `type` — policy/contract/navigation/snapshot/etc.;
- `status` — `current`, `historical`, `superseded` or `draft`;
- `authority` — `normative`, `supporting`, `informational` or `provenance-only`;
- `required` — whether the current control plane must retain the path;
- optional `supersededBy`;
- optional `reconciliationState` for bounded migration debt that is not yet safe to rewrite in the same PR.

`reconciliationState` is not permission to ignore a contradiction. It identifies the exact next documentation lane while preserving a truthful current classification.

## Current operational entrypoints

- `AGENTS.md` — operational root;
- `README.md` — repository navigation;
- `docs/DOCUMENT_AUTHORITY.md` — documentation lifecycle/index.

Current governance then routes to `WORK_MODES`, `LANE_LOCK_POLICY`, branch/worktree lifecycle and owner invariants. Release-state claims route to `docs/RELEASE-LIVE-EVIDENCE.md`; external-tool/environment assumptions route through `audit/external-checks/README.md` plus live discovery, not through a dated sandbox snapshot.

## Machine consumption

`required:true` is consumed by `scripts/repository-control-plane-audit.mjs`. The control-plane audit must not maintain a second handwritten `requiredDocs` list. Its `--no-report` mode is the read-only CI path used when document authority itself is being validated.

This means changing whether a governance document is required is one registry transaction, not two prose/code edits that can silently drift apart.

## Historical material

Historical does **not** mean useless or deletable. Owner messages, migration plans, incident reports and forensic snapshots may be essential evidence. Their role is provenance: they inform current decisions but do not independently override current owners.

Known high-risk examples now explicitly classified as historical include:

- `OWNER-REQUIREMENTS.md` — direct owner-message provenance; current interpretation lives in `OWNER-INVARIANTS` + `REFERENCE_TRANSFER_POLICY`;
- `ASTRO-PREMIUM-MIGRATION-ROADMAP.md` — migration-era visual transfer plan;
- `CURRENT_RECHECK_2026-06-22_FIXES.md` — June snapshot, not current status;
- `dependency-migrations/ASTRO_7_SATTERI.md` — package set at migration time;
- `RELEASE-LIVE-EVIDENCE-CONTRACT-2026-08-06.md` — compatibility pointer for a mixed dated release/incident document; current policy is `RELEASE-LIVE-EVIDENCE.md`, original incident-era content is preserved under `history/incidents/`;
- `refactor-2026/REFRACTOR_AUDIT_LIVING.md` — recorded forensic/source boundary.

## Mutable facts

Route counts, exact dependency versions, workflow counts, search membership and similar source-derived values should be generated or read from registries. They must not be maintained as a second independent prose truth.

## Migration rule

Do not mass-move `docs/**` merely to make the tree look tidy. First classify the document, inspect references/guards/workflows, redirect consumers, then move it in a separate bounded transaction if the move still adds value.
