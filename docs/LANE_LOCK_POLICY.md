# Lane Lock Policy — FAST / LANE / SYSTEM

**Updated:** 2026-07-28  
**Policy version:** 4.0  
See also: [WORK_MODES.md](WORK_MODES.md), [GIT_WORKTREE_POLICY.md](GIT_WORKTREE_POLICY.md), [BRANCH_LIFECYCLE_V4.md](BRANCH_LIFECYCLE_V4.md).

## 1. Purpose

Lane lock prevents parallel agents from overwriting the same route, shared file, governance surface or release boundary. It also protects active and unknown branches from premature cleanup.

A lane is an ownership transaction, not merely a branch name.

## 2. Branch and execution boundary

Suggested canonical PR names:

```text
lane/fast-<task>-YYYY-MM-DD
lane/<route-or-feature>-<phase>-YYYY-MM-DD
lane/system-<task>-YYYY-MM-DD
agent/<bounded-task>
hotfix/<bounded-task>
```

`agent/**` is accepted for connector/runtime publication only when it is the single canonical branch for one PR.

Diagnostics use a local detached worktree and do not publish `diag/**`, `probe/**`, `snapshot/**` or similar refs.

An `archive/forensic-*` ref is an owner-approved last resort. Prefer AuditRepo, an immutable artifact, patch or bundle for unique evidence that should not enter `main`.

## 3. Lane declaration

```md
Mode: FAST | LANE | SYSTEM
Execution: LOCAL_WORKTREE | DETACHED_DIAGNOSTIC | REMOTE_PR | RECOVERY
Lane: <branch or detached SHA>
Owner: <agent/human>
Issue/PR: <number or pending draft>
Routes: <bounded list>
Files allowed: <bounded list>
Files forbidden: <list>
Source of truth: <files / exact SHA>
Required checks: <commands / browser profiles>
Rollback point: <exact main SHA>
Dependencies: <issues / PRs / active branches / owner decisions>
```

Commit messages should identify the lane when multiple agents are active:

```text
[LANE <branch>] <type>(<scope>): <message>
```

The PR description and actual diff are authoritative when an old commit message is stale.

## 4. Ownership rules

1. One route or shared surface has one active owner.
2. A second agent takes a non-overlapping sub-lane or waits.
3. Never reset, rebase, force-push, close or delete another owner’s active branch.
4. A route lane does not change system files.
5. A system lane does not absorb route content or visual redesign.
6. Shared data uses a declared shared/system lane.
7. Out-of-lane findings are recorded, not silently repaired.
8. `Superseded` is a claim to verify against current blobs, not permission to delete.
9. No temporary workflow, trigger, writer or patcher survives the transaction that needed it.
10. A hygiene report classifies preliminarily; it never mutates refs or authorizes cleanup.

## 5. Active-agent protection

Treat a branch as protected in-flight work when any condition is true:

- it has an open PR;
- it was updated within the last 7 days and belongs to a current task;
- it is named in a live owner instruction, issue or PR;
- the current owner or unique delta is not yet known.

During the v4 transition, existing active branches are grandfathered. Do not rename or restructure them merely for policy conformity.

An owner-approved successor may replace an active branch only after the replacement table in `BRANCH_LIFECYCLE_V4.md` is complete and the owner accepts the handoff.

## 6. Verification discipline

### Iteration

```bash
git diff --check
npm run guard:shared-files
npm run data:consistency
npm run migration:metadata:check
npm run native:runtime:audit:strict
```

Select relevant commands while iterating and add route-specific browser/visual/source contracts.

### System/control plane

```bash
git diff --check
npm run guard:shared-files
npm run workflows:check
npm run control-plane:audit
npm run workflows:lint
```

### Final barrier

```bash
npm run validate:static-publication
npm run guard:shared-files
```

A docs-only SYSTEM PR may use a narrower barrier only when runtime/build cannot be affected. Shared Files Guard, reference integrity and applicable workflow validation remain mandatory. Record exact-head run IDs or artifacts.

## 7. Current truth order

Use this order:

1. current owner instruction;
2. open GitHub issues and PRs;
3. current `main`, exact branch heads and exact-head CI;
4. AuditRepo canonical matrix and reverify evidence;
5. `docs/refactor-2026/lanes/README.md` as navigation.

The lane index is not an independent backlog. A branch does not become active merely because it exists remotely, and it does not become disposable merely because no PR was found.

## 8. Out-of-lane finding

```md
## Out-of-lane finding

Observed at: <exact SHA / file / route>
Evidence: <source, test or artifact>
Not changed because: <ownership boundary>
Proposed lane: <name>
Recovery risk: <none / possible unique branch material>
```

## 9. Merge acceptance

```text
□ Actual diff matches declared scope
□ Exact PR head passed required checks
□ Review threads are resolved
□ Temporary automation is absent from the final tree
□ Production is not claimed without an exact deploy/live witness
□ AuditRepo update is prepared when canonical status changed
□ Adjacent active-agent branches were not modified
```

## 10. Branch disposition

Before deletion, inspect actual content:

| Classification | Action |
|---|---|
| Active or in-flight | do not touch |
| Fully present in `main` | record replacement SHA, then owner-approved delete |
| Squash/patch equivalent | prove equivalence, then owner-approved delete |
| Trigger/probe/diagnostic only | verify evidence and cleanup first |
| Superseded | verify replacement file-by-file |
| Unique evidence/prototype | preserve outside product history or approved archive ref |
| Selective recovery | rebuild justified delta from fresh `main` |
| Unknown | protect and add to forensic register |

Never automatically run `git push origin --delete <branch>` immediately after merge. Follow `BRANCH_LIFECYCLE_V4.md` and remove verified branches in bounded waves only after owner approval.
