# Agent Push Model

**Repository:** `FedorMilovanov/gb-is-my-strength`  
**Updated:** 2026-07-28  
**Policy version:** 4.2  
**Current rule:** one canonical branch and PR per independently mergeable lane; direct `main` push only in an explicit owner-approved emergency.

## 1. Authentication truth

- GitHub repository secrets exist only inside GitHub Actions.
- An external runtime does not inherit `GITHUB_TOKEN`, PAT or repository secrets unless it supplies an authenticated connector or secure environment.
- Never request, paste or store a PAT in chat, files, issues, PR descriptions, commits, gists or sample environment files.
- An authenticated connector may publish directly when it preserves the same branch, PR, ownership and exact-head rules.

## 2. Normal publication path

Execution mechanics and checkpoint criteria are defined once in [GIT_WORKTREE_POLICY.md](GIT_WORKTREE_POLICY.md).

The normal publication path is:

```text
named local branch in dedicated worktree
→ first meaningful recoverable commit
→ push canonical branch
→ open draft PR
→ continue with economical checkpoints
→ exact-head checks
→ squash merge
```

Do not push an empty branch that still equals `main` merely to reserve a name. Do not create multiple remote refs for the same lane.

## 3. Remote branch policy

Normal PR namespaces:

```text
lane/**
agent/**
hotfix/**
release/**
```

`agent/**` is allowed for connector/runtime publication but does not authorize duplicate branches for one lane.

Diagnostic names such as `diag/**`, `probe/**`, `snapshot/**`, `witness/**`, `tmp/**`, `materializer/**` and `experiment/**` are local execution labels, not normal remote branches.

Existing in-flight branches are grandfathered and must not be renamed, force-pushed, closed or deleted for policy compliance.

Protected destinations:

```text
main
gh-pages
release
production
```

## 4. Parallel-agent safety

- one independently mergeable lane has one owner, branch and PR;
- a broader initiative may have several explicit non-overlapping lanes;
- never force-push or move another owner’s branch;
- never close or delete active-agent branches;
- never continue another owner’s lane without explicit handoff or owner decision;
- inspect file overlap before publication;
- use a fresh branch from current `main` for selective recovery;
- never merge an old recovery branch wholesale merely to preserve its name.

GitHub already exposes commits, changed files, checks and exact head SHA. Manually update PR status only when scope, ownership, blocker, handoff or readiness changes.

## 5. Write-capable workflows

Do not rely on a static list. Run:

```bash
npm run control-plane:audit
```

Inspect `reports/repository-control-plane-audit.{json,md}` for current writers and permissions. Any new `contents: write` workflow requires an explicit continuing owner and bounded write path.

The branch-hygiene workflow is read-only and must remain unable to close PRs, update refs or delete branches.

## 6. Verification and evidence

A checkpoint preserves work; it is not automatically a green claim. Full checks may run later, but failures or unavailable checks that affect the plan must be recorded.

For workflow/system changes before ready-for-review:

```bash
git diff --check
npm run guard:shared-files
npm run workflows:check
npm run control-plane:audit
npm run workflows:lint
```

For production/shared/refactor impact, the final barrier normally includes:

```bash
npm run validate:static-publication
npm run guard:shared-files
```

Trust only:

- the remote branch and PR at an exact head SHA;
- checks associated with that exact head;
- built `dist` when build output is the claim;
- exact Pages/live evidence when production is the claim.

A green check on an earlier commit does not validate a moved head. A merged source commit does not prove production serves the same bytes.

## 7. Emergency direct-main path

Requires all of:

- explicit owner instruction naming the emergency;
- exact pre-push rollback SHA;
- minimal bounded diff;
- immediate exact post-push CI inspection;
- rollback readiness;
- AuditRepo reconciliation when canonical status changes.

This is not a FAST shortcut.

## 8. Cleanup

Follow [BRANCH_LIFECYCLE_V4.md](BRANCH_LIFECYCLE_V4.md). A closed PR or branch age never authorizes deletion by itself.
