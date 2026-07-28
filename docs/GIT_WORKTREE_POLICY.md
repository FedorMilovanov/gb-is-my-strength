# Git Worktree Policy

**Policy version:** 1.0  
**Effective:** after merge into `main`  
**Scope:** local execution by humans and agents, diagnostics, experiments and product work.

## 1. Principle

Risk mode and execution mode are separate decisions.

- `FAST`, `LANE`, `SYSTEM` describe the risk and verification boundary.
- `LOCAL_WORKTREE`, `DETACHED_DIAGNOSTIC`, `REMOTE_PR`, `RECOVERY` describe how the work is executed.

A remote branch is not a scratch directory. It is a publication boundary for one canonical PR.

## 2. Product worktree

Create a linked worktree with a local branch when the result may become product code, content or governance:

```bash
git fetch origin main --prune
git worktree add \
  -b lane/<scope>-YYYY-MM-DD \
  ../gb-wt-<scope> \
  origin/main
```

The branch remains local until all of the following are true:

1. the scope and owner are declared;
2. allowed and forbidden files are known;
3. a meaningful diff exists;
4. iteration checks have run;
5. the branch is the single canonical remote branch for the task;
6. a draft PR is ready to be opened immediately after push.

## 3. Detached diagnostic worktree

Use detached HEAD for reproduction, comparison, old-SHA inspection, CI diagnosis, screenshots, temporary builds and hypothesis testing:

```bash
git fetch origin main --prune
git worktree add --detach ../gb-diag-<scope> origin/main
```

Detached diagnostics must not create a remote branch. Capture evidence instead:

```bash
mkdir -p ../diagnostic-evidence
git status --porcelain=v1 > ../diagnostic-evidence/status.txt
git diff --binary > ../diagnostic-evidence/experiment.patch
```

Store short-lived evidence in a GitHub Actions artifact. Store durable conclusions in AuditRepo, a governed patch/bundle, or release evidence.

If the experiment becomes product work, create one local canonical branch from the useful state:

```bash
git switch -c lane/<scope>-YYYY-MM-DD
```

Then review and push that branch only.

## 4. Remote namespaces

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

## 5. Parallel agents

When several agents are active:

- never switch, reset, rebase, force-push, close or delete another owner’s branch;
- one shared surface has one active owner;
- a second agent takes a non-overlapping sub-lane or records an out-of-lane finding;
- current open PRs and recently updated declared branches are protected in-flight work;
- a governance or diagnostic report is read-only and cannot authorize branch deletion;
- a successor branch is created only after the replacement scope is explicit.

## 6. Cleanup

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

## 7. Minimum diagnostic record

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
