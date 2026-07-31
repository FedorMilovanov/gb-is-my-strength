# Git Worktree Policy

**Policy version:** 1.3  
**Effective:** after merge into `main`  
**Scope:** local execution by humans and agents, diagnostics, experiments and product work.

## 1. Principle

Risk mode and execution mode are separate decisions.

- `FAST`, `LANE`, `SYSTEM` describe risk and verification.
- `LOCAL_WORKTREE`, `DETACHED_DIAGNOSTIC`, `REMOTE_PR`, `RECOVERY` describe execution.

A worktree isolates files; it is not durable storage. A remote branch and draft PR preserve useful work and make ownership visible.

## 2. Default productive path

Create one named local branch in a dedicated worktree:

```bash
git fetch origin main --prune
git worktree add \
  -b lane/<scope>-YYYY-MM-DD \
  ../gb-wt-<scope> \
  origin/main
```

Before substantive edits, record only the minimum needed to prevent collisions:

```md
Owner:
Lane / scope:
Base and rollback SHA:
Allowed files or surfaces:
Adjacent active PRs and overlap decision:
Expected checks:
```

Work locally without stopping for publication after every edit. When the first coherent and recoverable unit exists:

```bash
git add <bounded-files>
git commit -m "wip(<scope>): first recoverable checkpoint"
git push -u origin HEAD
```

Open one draft PR immediately after that first meaningful push. Do not create an empty remote branch that still equals `main` merely to reserve a name.

Continue working after a checkpoint; do not wait for full CI after every intermediate push. Exact-head checks matter before ready-for-review and merge.

## 3. Economical checkpoints

Checkpoint pushes are event-driven, not time-driven. Push when at least one condition is true:

- a coherent, reviewable implementation unit is complete;
- a handoff, pause, environment change or session boundary is approaching;
- a destructive or state-changing operation is next;
- the current unpushed delta would be materially expensive to reproduce.

A long-running read-only build or test is not by itself a reason to create a checkpoint. Small related edits should be grouped. Do not push after every file or command, and do not create empty or near-empty commits to signal activity.

Checkpoint commits may use `wip(...)`; the final PR is normally squash-merged. A checkpoint may be incomplete, but it must stay inside the declared scope and must not contain secrets, credentials, unrelated files or accidental generated bulk.

GitHub already records the PR head SHA, commits, diff and checks. Update the PR progress summary only when useful state changes, such as:

- scope or owner changes;
- the lane becomes blocked or unblocked;
- a handoff or pause occurs;
- a material test failure changes the plan;
- the PR becomes ready for review.

Do not manually rewrite the status block after every push merely to copy information GitHub already shows.

If an agent stops unexpectedly, pushed commits and the draft PR remain recoverable. Uncommitted or unpushed changes are not assumed recoverable.

## 4. Detached diagnostics

Use detached HEAD only for reproduction, comparison, old-SHA inspection, CI diagnosis, screenshots, temporary builds and disposable hypotheses:

```bash
git fetch origin main --prune
git worktree add --detach ../gb-diag-<scope> origin/main
```

Detached diagnostics do not need a remote branch. Capture short-lived evidence in an Actions artifact or a local patch:

```bash
git status --porcelain=v1 > status.txt
git diff --binary > experiment.patch
```

When the work produces useful product material or evidence expensive to reproduce, promote it before further substantive work:

```bash
git switch -c lane/<scope>-YYYY-MM-DD
git add <bounded-files>
git commit -m "wip(<scope>): promote useful diagnostic result"
git push -u origin HEAD
```

Then open the canonical draft PR.

## 5. Lane and initiative boundaries

One **independently mergeable lane** has one owner, one canonical branch and one PR.

A broader initiative may have several explicit, non-overlapping lanes when they can be reviewed, tested, rolled back and merged independently. This is safe decomposition, not branch proliferation.

Do not create parallel branches for the same lane. Do not continue another owner’s branch without an explicit handoff or owner decision.

Normal canonical PR namespaces:

```text
lane/**
agent/**
hotfix/**
release/**
```

Diagnostic labels such as `diag/**`, `probe/**`, `snapshot/**`, `witness/**`, `tmp/**`, `materializer/**` and `experiment/**` are not normal remote branches.

Existing in-flight branches remain grandfathered. Do not rename, rebase, close or delete them merely for policy conformity.

## 6. Worktree cleanup

Inspect before removal:

```bash
git worktree list --porcelain
git status --porcelain=v1
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
git worktree prune --dry-run
```

Remove only after uncommitted changes and unique commits are accounted for:

```bash
git worktree remove ../gb-wt-<scope>
git worktree prune
```

Use `git worktree lock --reason "<reason>" <path>` for a worktree stored on a temporarily unavailable drive or share. `--force` is forbidden until unique work is preserved or explicitly rejected with evidence.

## 7. Minimum diagnostic record

```md
Diagnostic ID:
Base SHA:
Command and environment:
Result:
Artifact or evidence:
Product impact: none | candidate
Disposition: removed | promoted to <branch>
```
