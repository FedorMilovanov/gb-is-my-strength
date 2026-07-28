# Agent Push Model

**Repository:** `FedorMilovanov/gb-is-my-strength`  
**Updated:** 2026-07-28  
**Policy version:** 4.0  
**Current rule:** one canonical branch and pull request; direct `main` push only in an explicit owner-approved emergency.

## 1. Authentication truth

- GitHub repository secrets exist only inside GitHub Actions.
- An external runtime does not inherit `GITHUB_TOKEN`, PAT or repository secrets unless it supplies an authenticated connector or secure environment.
- Never request, paste or store a PAT in chat, files, issues, PR descriptions, commits, gists or sample environment files.
- A connector write capability may be used directly when it preserves the same branch/PR and ownership rules.

## 2. Local execution before publication

Product work starts in a local branch worktree. Diagnostics, reproduction and temporary experiments use detached HEAD.

A remote branch is created only when:

1. the scope is bounded;
2. overlap with active agents is checked;
3. the diff exists and iteration checks ran;
4. the branch is the single canonical remote branch for the task;
5. a draft PR is opened immediately.

See `docs/GIT_WORKTREE_POLICY.md`.

## 3. Remote branch policy

Normal canonical PR namespaces:

```text
lane/**
agent/**
hotfix/**
release/**
```

`agent/**` is allowed for connector/runtime publication but does not authorize multiple parallel refs for one task.

Diagnostic names such as `diag/**`, `probe/**`, `snapshot/**`, `witness/**`, `tmp/**`, `materializer/**` and `experiment/**` are local execution labels, not normal remote branches.

Existing in-flight branches are grandfathered during transition and must not be renamed, force-pushed, closed or deleted for policy compliance.

Protected destinations:

```text
main
gh-pages
release
production
```

## 4. Parallel-agent write safety

- never force-push another owner’s branch;
- never move another branch ref;
- never close or delete active-agent branches;
- verify file overlap before creating the governance/product branch;
- record active adjacent PRs and branches in the PR description;
- use a fresh branch from current `main` for selective recovery;
- never merge an old recovery branch wholesale merely to save its name.

## 5. Current write-capable workflows

Do not rely on a static list. Run:

```bash
npm run control-plane:audit
```

Inspect `reports/repository-control-plane-audit.{json,md}` for current writers and permissions. Any new `contents: write` workflow requires an explicit continuing owner and bounded write path.

The branch-hygiene workflow is deliberately read-only and must remain unable to close PRs, update refs or delete branches.

## 6. Verification before push and merge

For workflow/system changes, at minimum:

```bash
git diff --check
npm run guard:shared-files
npm run workflows:check
npm run control-plane:audit
npm run workflows:lint
```

For production/shared/refactor changes, the final barrier normally includes:

```bash
npm run validate:static-publication
npm run guard:shared-files
```

Add route/browser/visual/source contracts for the touched surface. Record failed or unavailable checks instead of converting them into a green claim.

## 7. Post-push evidence

Trust only:

- the remote branch at an exact SHA;
- the GitHub PR head SHA and actual diff;
- exact-head workflow runs and artifacts;
- built `dist` when build output is the claim;
- exact Pages/live witness when production is the claim.

A green check on an earlier commit does not validate a moved head. A merged source commit does not prove production serves the same bytes.

## 8. Emergency direct-main path

Requires all of:

- explicit owner instruction naming the emergency;
- exact pre-push rollback SHA;
- minimal bounded diff;
- immediate exact post-push CI inspection;
- rollback readiness;
- AuditRepo reconciliation when canonical status changes.

This is not a FAST shortcut.

## 9. Branch cleanup

Follow `docs/BRANCH_LIFECYCLE_V4.md`. A closed PR or branch age never authorizes deletion by itself. Active and unknown branches remain protected until owner-approved disposition.
