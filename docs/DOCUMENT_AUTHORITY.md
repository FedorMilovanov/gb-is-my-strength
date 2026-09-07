# Document Authority — current vs historical documentation

**Machine SSOT:** [`../data/document-authority.json`](../data/document-authority.json)  
**Validator:** [`../scripts/document-authority-audit.mjs`](../scripts/document-authority-audit.mjs)

## Rule

A Markdown filename is not an authority signal. Words such as `CURRENT`, `FINAL`, `READY`, a recent-looking date, or a historically important owner quote do not outrank the registered current contract.

This registry governs **repository-wide authority and explicitly classified high-risk documents**. It is not intended to enumerate every route-local guide, design note or surface runbook in the repository.

Authority order remains:

1. current owner instruction;
2. current Product tree, relevant open PR/issues and exact-head evidence;
3. current machine/source owners;
4. documents registered here as `status=current` with `authority=normative`;
5. current supporting contracts;
6. historical/provenance material.

An unregistered document is `surface-local-non-overriding` by default. It may still be a valid local contract when a current owner, current source contract or registered current document explicitly delegates that surface to it. It cannot independently override registered repository-wide authority or promote itself to a global policy merely by filename, age or wording.

This distinction prevents two opposite failures: a forgotten migration plan cannot silently become global policy, and a legitimate route-local guide such as a series-engine contract is not accidentally invalidated merely because the repository-wide registry does not enumerate every surface document.

## Lifecycle fields

Each managed document declares:

- `type` — policy/contract/navigation/snapshot/etc.;
- `status` — `current`, `historical`, `superseded` or `draft`;
- `authority` — `normative`, `supporting`, `informational` or `provenance-only`;
- `required` — whether the current control plane must retain the path;
- optional `supersededBy`;
- optional provenance fields such as `sourceBlobSha` and `snapshotDerivation`.

`reconciliationState` may be used only for a **currently real, bounded documentation debt**. It must be removed in the same reconciliation transaction that closes that debt; completed work may not remain machine-labelled `pending-*`.

## Current operational entrypoints

- `AGENTS.md` — operational root;
- `README.md` — repository navigation;
- `docs/DOCUMENT_AUTHORITY.md` — documentation lifecycle/index.

`AGENTS-REFERENCE.md` is a current supporting **surface router**, not a second operational root or mutable repository census. It delegates each surface to current machine/source owners and narrow policies. The complete pre-split monolith is preserved byte-identically at `docs/history/AGENTS-REFERENCE-2026-09-07-pre-split.md` under original Git blob `96521c8c79bd626c1ca8d09a628b0d5dee2f93d1`; that snapshot is historical/provenance-only.

Current governance routes to `WORK_MODES`, `LANE_LOCK_POLICY`, branch/worktree lifecycle and owner invariants. Release-state claims route to `docs/RELEASE-LIVE-EVIDENCE.md`. External-tool decisions route through `audit/external-checks/README.md`; environment capabilities are discovered live, with `docs/SANDBOX-ENV-2026-06-21.md` acting only as a current supporting capability policy that explicitly rejects its own older Arena/E2B snapshot as universal truth.

The dated filename of `SANDBOX-ENV-2026-06-21.md` is therefore not a lifecycle signal. Its current text was reconciled in commit `03276e321eaffd6c136c37a223f054804f2637b1`; the original environment snapshot remains provenance under blob `9349b0868f6e9a8fdf4ba50de19b70c8cbf43936`.

## Surface-local delegation

A route/surface guide that is not explicitly listed in the repository-wide registry is usable only inside its delegated scope. Before treating it as current:

1. identify the current owner/source that delegates to it;
2. verify the referenced paths/commands against current `main`;
3. apply registered repository-wide policy first if there is a conflict;
4. treat mutable counts, versions, implementation snapshots and old migration state as evidence to recheck, not as self-authenticating truth.

For Maps, Genealogy and other historically design-heavy surfaces, design intent and current implementation truth must remain separate. Current route profiles/source/guards own implementation reality; dated design documents may support owner intent only after their assumptions are revalidated.

## Machine consumption

`required:true` is consumed by `scripts/repository-control-plane-audit.mjs`. The control-plane audit must not maintain a second handwritten `requiredDocs` list. Its `--no-report` mode is the read-only CI path used when document authority itself is being validated.

This means changing whether a repository-wide governance document is required is one registry transaction, not two prose/code edits that can silently drift apart.

`scripts/document-authority-audit.mjs` also fail-closes the `AGENTS-REFERENCE` split: the current router may not reintroduce stale fixed asset counts, Astro-6 current-platform wording, blanket legacy-root ownership or a universal `enhancements.js` fallback, and the historical snapshot must hash to the registered original Git blob.

## Historical material

Historical does **not** mean useless or deletable. Owner messages, migration plans, incident reports and forensic snapshots may be essential evidence. Their role is provenance: they inform current decisions but do not independently override current owners.

Known high-risk examples explicitly classified as historical include:

- `OWNER-REQUIREMENTS.md` — direct owner-message provenance; current interpretation lives in `OWNER-INVARIANTS` + `REFERENCE_TRANSFER_POLICY`;
- `ASTRO-PREMIUM-MIGRATION-ROADMAP.md` — migration-era visual transfer plan;
- `CURRENT_RECHECK_2026-06-22_FIXES.md` — June snapshot, not current status;
- `dependency-migrations/ASTRO_7_SATTERI.md` — package set at migration time;
- `RELEASE-LIVE-EVIDENCE-CONTRACT-2026-08-06.md` — compatibility pointer; current policy is `RELEASE-LIVE-EVIDENCE.md`, with normalized incident provenance under `docs/history/incidents/`;
- `refactor-2026/REFRACTOR_AUDIT_LIVING.md` — recorded forensic/source boundary;
- `history/AGENTS-REFERENCE-2026-09-07-pre-split.md` — byte-identical pre-split surface-reference snapshot.

## Mutable facts

Route counts, exact dependency versions, workflow counts, asset counts, search membership and similar source-derived values should be generated or read from registries/current trees. They must not be maintained as a second independent prose truth.

## Migration rule

Do not mass-move `docs/**` merely to make the tree look tidy. First classify the document, inspect references/guards/workflows, redirect consumers, then move it in a separate bounded transaction if the move still adds value.
