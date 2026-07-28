# Governance v4 implementation record

**Lane:** `agent/governance-v4-worktree-lifecycle-2026-07-28`  
**Mode:** `SYSTEM`  
**Execution:** connector-backed canonical PR branch  
**Initial rollback SHA:** `52cfa6ac60bc164d76707f2a78e0424ad3cf5725`

## Scope

This transaction changes governance, issue/PR intake, Dependabot configuration and a read-only branch inventory workflow.

It does not change product routes, content, Atlas/runtime code, publication state, repository merge settings, branch refs, open PR state or any other agent branch.

## Active adjacent work observed

- PR #425 — Atlas/navigation work; no overlapping files in this transaction.
- Genesis 6 provenance work advanced `main` during this transaction; the added commit has no overlapping files.

## Safety decisions

- Existing open, recently active and unknown branches are explicitly protected.
- Review timers trigger investigation, never deletion.
- The hygiene script sets `deletion_blocked: true` for every row and has read-only permissions.
- No automatic branch deletion or merge-setting mutation is introduced.
- Cleanup remains a later owner-approved forensic operation.

## Validation performed before PR creation

- Python syntax: `python3 -m py_compile scripts/branch-hygiene-report.py` — passed on the authored copy.
- YAML parse: Dependabot, workflow and issue forms — passed on the authored copies.
- GitHub compare: governance files only; no product/content/Atlas files.
- Current-main delta inspected separately; no file overlap.

Exact-head repository CI remains authoritative after the draft PR is opened.
