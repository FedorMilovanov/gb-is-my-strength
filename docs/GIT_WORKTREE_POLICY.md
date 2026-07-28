# Git Worktree Policy

**Policy version:** 1.2  
**Effective:** after merge into `main`  
**Scope:** local execution by humans and agents, diagnostics, experiments and product work.

## 1. Principle

Risk mode and execution mode are separate decisions.

- `FAST`, `LANE`, `SYSTEM` describe the risk and verification boundary.
- `LOCAL_WORKTREE`, `DETACHED_DIAGNOSTIC`, `REMOTE_PR`, `RECOVERY` describe how the work is executed.

A worktree is an isolation mechanism, not durable storage. Product work uses a named branch from the beginning, and useful progress is pushed to the one canonical remote branch throughout the task.

A remote branch is not a scratch directory. It is the durable publication boundary for one canonical task and one canonical PR.

## 2. Product worktree and branch

Create a linked worktree attached to a named branch when the result may become product code, content or governance:

```bash
git fetch origin main --prune
git worktree add \
  -b lane/<scope>-YYYY-MM-DD \
  ../gb-wt-<scope> \
  origin/main
```

Before substantive edits, record:

1. scope and owner;
2. allowed and forbidden files;
3. base and rollback SHA;
4. adjacent active PRs and overlap decision;
5. expected checks.

Push the named branch early so the task has a visible durable ref:

```bash
git push -u origin HEAD
```

A branch that still equals `main` cannot open a PR yet, but it establishes the canonical remote destination. After the first meaningful and reviewable checkpoint:

```bash
git add <bounded-files>
git commit -m "wip(<scope>): first recoverable checkpoint"
git push
```

Open a draft PR immediately after that first pushed checkpoint. Do not wait for the full task to be complete.

## 3. Durable checkpoint protocol

Uncommitted or unpushed work is volatile. An agent runtime, container, editor session or temporary filesystem may disappear without preserving it.

Checkpoint pushes are **event-driven, not time-driven**. Do not push after every edit, file, command, or by a mechanical timer. Do not create empty or near-empty commits merely to signal activity.

For productive work, push a recoverable checkpoint only when at least one of these is true:

- a coherent and reviewable implementation unit is complete;
- a real risk boundary is next: long-running build, migration, generation, destructive command, environment change, handoff or session boundary;
- the current unpushed delta would be materially expensive to reproduce.

Small local edits that belong together should normally be grouped into one meaningful checkpoint. Pure status updates belong in the PR body or a PR comment, not in empty commits.

Checkpoint commits may be marked `wip(...)` because the final PR is expected to use squash merge. A checkpoint may be incomplete, but it must remain within the declared file boundary and must never contain secrets, credentials, private data, accidental generated bulk or unrelated files.

Every meaningful pushed checkpoint must update the draft PR or task record with:

```md
Status: active | blocked | ready-for-review
Last pushed SHA:
Completed:
In progress:
Next:
Known failing or unavailable checks:
```

If an agent stops unexpectedly:

- pushed commits and the remote branch remain recoverable;
- the draft PR shows ownership, scope and last known progress;
- another agent may continue only after an explicit handoff or owner decision;
- uncommitted and unpushed changes are not assumed recoverable.

No productive agent should accumulate a large unpushed working set merely to keep the branch history tidy. Squash merge provides clean final history; economically meaningful checkpoint pushes provide durability without commit noise.

## 4. Detached diagnostic worktree

Use detached HEAD only for reproduction, comparison, old-SHA inspection, CI diagnosis, screenshots, temporary builds and hypotheses that are expected to be disposable:

```bash
git fetch origin main --prune
git worktree add --detach ../gb-diag-<scope> origin/main
```

Detached diagnostics must not create a remote branch merely to preserve temporary noise. Capture evidence instead:

```bash
mkdir -p ../diagnostic-evidence
git status --porcelain=v1 > ../diagnostic-evidence/status.txt
git diff --binary > ../diagnostic-evidence/experiment.patch
```

Store short-lived evidence in a GitHub Actions artifact. Store durable conclusions in AuditRepo, a governed patch/bundle, or release evidence.

The moment a diagnostic produces useful product code, content, governance or a result expensive to reproduce, promote it to a named branch and follow the durable checkpoint protocol:

```bash
git switch -c lane/<scope>-YYYY-MM-DD
git push -u origin HEAD
```

Then commit the useful bounded delta, push it and open the canonical draft PR.

## 5. Remote namespaces

Normal canonical PR branches may use:

```text
lane/**
agent/**
hotfix/**
release/**
```

`agent/**` is allowed only when a connector/runtime creates the one canonical PR branch. The namespace itself is not permission to create parallel refs.

The following namespaces are diagnostic execution labels and must not normally be pushed:

```text
diag/**
probe/**
snapshot/**
witness/**
tmp/**
temp/**
materializer/**
carrier/**
memory/**
experiment/**
```

Existing in-flight branches are grandfathered during transition. They are not renamed, force-pushed, closed or deleted merely because their names do not match the new policy.

## 6. Parallel agents

When several agents are active:

- each productive agent has one named worktree branch and one canonical remote branch;
- open a draft PR after the first meaningful checkpoint so the owner can see actual progress;
- use economically meaningful checkpoints rather than push-by-timer churn;
- never switch, reset, rebase, force-push, close or delete another owner’s branch;
- one shared surface has one active owner;
- a second agent takes a non-overlapping sub-lane or records an out-of-lane finding;
- current open PRs and recently updated declared branches are protected in-flight work;
- a governance or diagnostic report is read-only and cannot authorize branch deletion;
- a successor branch is created only after the replacement scope is explicit.

For three agents, the expected visible shape is:

```text
agent A -> worktree A -> branch A -> draft PR A -> meaningful checkpoints
agent B -> worktree B -> branch B -> draft PR B -> meaningful checkpoints
agent C -> worktree C -> branch C -> draft PR C -> meaningful checkpoints
```

The owner can determine who did what from the PR scope, commits, changed files, status block and exact head SHA.

## 7. Cleanup

Before removing a worktree:

```bash
git status --short
git log --oneline --decorate origin/main..HEAD
git diff --stat origin/main...HEAD
```

Remove only after uncommitted changes and unique commits are accounted for:

```bash
git worktree remove ../gb-diag-<scope>
git worktree prune
```

`--force` is forbidden until unique work is preserved or explicitly rejected with evidence.

## 8. Minimum diagnostic record

```md
Diagnostic ID:
Base SHA:
Command:
Environment:
Result:
Generated files:
Artifact or evidence:
Product impact: none | candidate
Disposition: removed | promoted to <branch>
```
