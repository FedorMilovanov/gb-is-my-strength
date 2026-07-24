# Owner governance reconciliation — 2026-07-24

Mode: SYSTEM  
Lane: `agent/owner-governance-reconcile-2026-07-24`  
Issue: #219  
Routes: none  
Rollback point: `main` at branch creation  

## Allowed files

- `AGENTS.md`
- `docs/OWNER-INVARIANTS.md`
- this lane declaration
- temporary transaction files under `scripts/_temp-owner-governance-*` and `.github/workflows/_temp-owner-governance-*`

## Forbidden files

- runtime source, route content and generated HTML
- package files
- migration/data registries
- permanent workflows
- CSS/JS and UI components

## Decision

Reconcile governance around one current model: FAST / LANE / SYSTEM, ordinary branch+PR mutation, live GitHub ownership discovery, source registries over derived route matrices, live environment discovery, checksum-verified actionlint, and separate iteration / exact-head / production evidence.

Owner-sensitive UI/content/data protections remain. Historical implementation snapshots are provenance unless the current owner contract or current exact-head guard still makes them normative.

## Required final evidence

- final diff contains no runtime or permanent workflow changes;
- temporary writer/workflow removed;
- `git diff --check`;
- Shared Files Guard;
- workflow/control-plane checks applicable to the final exact head;
- issue #219 closed only after merge.
