# Governance v4 implementation record

**Status:** historical implementation record / provenance-only
**Current authority:** current `AGENTS.md`, `docs/WORK_MODES.md`, `docs/LANE_LOCK_POLICY.md`, `docs/GIT_WORKTREE_POLICY.md`, `docs/BRANCH_LIFECYCLE_V4.md` and current GitHub state

This file records one Governance v4 implementation transaction. Its branch names, adjacent PRs, rollback SHA, validation results and statements about repository state describe that transaction only; they are not present-day operational status.

**Lane:** `agent/governance-v4-worktree-lifecycle-2026-07-28`
**Mode:** `SYSTEM`
**Execution:** connector-backed canonical PR branch
**Initial rollback SHA:** `52cfa6ac60bc164d76707f2a78e0424ad3cf5725`

## Scope

This transaction changed governance, issue/PR intake, Dependabot configuration and a read-only branch inventory workflow.

It did not change product routes, content, Atlas/runtime code, publication state, repository merge settings, branch refs, open PR state or any other agent branch.

## Active adjacent work observed at the time

- PR #425 — Atlas/navigation work; no overlapping files in this transaction.
- Genesis 6 provenance work advanced `main` during this transaction; the added commit had no overlapping files.

These observations are historical and must not be used as a current branch/PR inventory.

## Safety decisions in that transaction

- Existing open, recently active and unknown branches were explicitly protected.
- Review timers triggered investigation, never deletion.
- The hygiene script set `deletion_blocked: true` for every row and had read-only permissions.
- No automatic branch deletion or merge-setting mutation was introduced.
- Cleanup remained a later owner-approved forensic operation.

Any still-current equivalent rule must be read from the current governance contracts, not inferred solely from this implementation record.

## Validation performed before PR creation

- Python syntax: `python3 -m py_compile scripts/branch-hygiene-report.py` — passed on the authored copy.
- YAML parse: Dependabot, workflow and issue forms — passed on the authored copies.
- GitHub compare: governance files only; no product/content/Atlas files.
- Current-main delta inspected separately; no file overlap.

Exact-head repository CI was authoritative for that transaction. Those historical results do not certify a present-day head.
