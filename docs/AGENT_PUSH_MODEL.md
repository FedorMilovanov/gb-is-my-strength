# Agent Push Model

**Repository:** `FedorMilovanov/gb-is-my-strength`  
**Updated:** 2026-07-28  
**Policy version:** 4.1  
**Current rule:** one canonical branch and pull request per productive task; checkpoint pushes preserve work; direct `main` push only in an explicit owner-approved emergency.

## 1. Authentication truth

- GitHub repository secrets exist only inside GitHub Actions.
- An external runtime does not inherit `GITHUB_TOKEN`, PAT or repository secrets unless it supplies an authenticated connector or secure environment.
- Never request, paste or store a PAT in chat, files, issues, PR descriptions, commits, gists or sample environment files.
- A connector write capability may be used directly when it preserves the same branch/PR and ownership rules.

## 2. Product work is branch-first and checkpointed

Product work starts in a named local branch inside its own worktree. The branch exists from the start of substantive work; the worktree is only the isolated directory that holds it.

Before editing, declare scope, owner, allowed/forbidden files, base SHA, adjacent active PRs and expected checks.

Push the canonical branch early:

```bash
git push -u origin HEAD
```

After the first meaningful bounded diff, commit and push a recoverable checkpoint, then open a draft PR immediately. Do not wait for the whole task to be complete.

```bash
git add <bounded-files>
git commit -m "wip(<scope>): recoverable checkpoint"
git push
```

Continue to push checkpoints after coherent work units and before long-running commands, environment changes, handoffs or session boundaries.

A local worktree, editor buffer or unpushed commit is not durable evidence. If the runtime disappears:

- pushed commits remain on the remote branch;
- the draft PR shows the diff, owner and last exact SHA;
- uncommitted or unpushed work may be lost.

See `docs/GIT_WORKTREE_POLICY.md`.

## 3. Diagnostic execution

Diagnostics, reproduction and temporary experiments that are expected to be disposable use detached HEAD.

Detached work must be promoted immediately when it produces useful product code, content, governance or expensive-to-reproduce evidence:

```bash
git switch -c lane/<scope>-YYYY-MM-DD
git push -u origin HEAD
```

Then commit the useful bounded delta, push it and open the canonical draft PR.

## 4. Remote branch policy

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

## 5. Parallel-agent visibility and write safety

For several productive agents, the expected model is one visible draft PR per task:

```text
agent A -> worktree A -> branch A -> draft PR A
agent B -> worktree B -> branch B -> draft PR B
agent C -> worktree C -> branch C -> draft PR C
```

Each PR records:

```md
Status: active | blocked | ready-for-review
Owner / agent:
Last pushed SHA:
Completed:
In progress:
Next:
Known failing or unavailable checks:
```

Safety rules:

- never force-push another owner’s branch;
- never move another branch ref;
- never close or delete active-agent branches;
- never continue another owner’s branch without explicit handoff or owner decision;
- verify file overlap before creating the governance/product branch;
- record active adjacent PRs and branches in the PR description;
- use a fresh branch from current `main` for selective recovery;
- never merge an old recovery branch wholesale merely to save its name.

## 6. Current write-capable workflows

Do not rely on a static list. Run:

```bash
npm run control-plane:audit
```

Inspect `reports/repository-control-plane-audit.{json,md}` for current writers and permissions. Any new `contents: write` workflow requires an explicit continuing owner and bounded write path.

The branch-hygiene workflow is deliberately read-only and must remain unable to close PRs, update refs or delete branches.

## 7. Verification before checkpoint, review and merge

A checkpoint commit is for durability, not a green claim. It may precede the full check suite, but known failures or unavailable checks must be recorded in the draft PR.

For workflow/system changes, before ready-for-review at minimum:

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

## 8. Post-push evidence

Trust only:

- the remote branch at an exact SHA;
- the GitHub PR head SHA and actual diff;
- exact-head workflow runs and artifacts;
- built `dist` when build output is the claim;
- exact Pages/live witness when production is the claim.

A green check on an earlier commit does not validate a moved head. A merged source commit does not prove production serves the same bytes.

## 9. Emergency direct-main path

Requires all of:

- explicit owner instruction naming the emergency;
- exact pre-push rollback SHA;
- minimal bounded diff;
- immediate exact post-push CI inspection;
- rollback readiness;
- AuditRepo reconciliation when canonical status changes.

This is not a FAST shortcut.

## 10. Branch cleanup

Follow `docs/BRANCH_LIFECYCLE_V4.md`. A closed PR or branch age never authorizes deletion by itself. Active and unknown branches remain protected until owner-approved disposition.
