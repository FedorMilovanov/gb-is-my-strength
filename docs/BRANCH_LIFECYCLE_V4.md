# Branch Lifecycle v4

**Policy version:** 4.3  
**Effective:** after merge into `main`  
**Goal:** preserve useful work without turning remote refs into an unreviewed archive.

## 1. Safety invariant

No branch is closed, rewritten or deleted because of its name, age, closed PR state, inactivity or the word `superseded` alone.

Deletion requires an explicit disposition based on actual content, PR history and current `main`.

## 2. Active work remains protected

Treat a branch as protected when any condition is true:

- it has an open PR;
- it belongs to a current owner instruction or active task;
- it was recently updated and ownership has not been resolved;
- its unique delta is still unknown.

Do not rename, rebase, force-push, close or delete active branches merely to satisfy newer naming or workflow guidance.

## 3. Canonical lane rule

One independently mergeable lane has one owner, one canonical remote branch and one PR.

A larger initiative may use multiple explicit non-overlapping lanes when each lane has its own bounded scope, checks and rollback. Do not create duplicate refs for the same lane.

| Category | Remote | Condition |
|---|---:|---|
| Product PR lane | yes | bounded independently mergeable scope |
| Hotfix | yes | owner-approved emergency transaction |
| Release | rarely | actual release process requires it |
| Forensic archive ref | exception | owner-approved after content classification |
| Diagnostic/probe/snapshot | no | detached worktree or Actions artifact |
| Temporary CI trigger | no | use `workflow_dispatch` or an exact PR/SHA |

Publication and checkpoint mechanics live in [GIT_WORKTREE_POLICY.md](GIT_WORKTREE_POLICY.md). A remote product branch should normally gain a draft PR with its first meaningful pushed commit; an empty branch is not created merely to reserve a name.

## 4. Healthy remote state

There is no arbitrary repository-wide cap on active product branches. Healthy state is defined by accountability:

```text
every active product branch has an owner, bounded lane and visible PR or declared short exception
0 remote diagnostic branches created for disposable work
0 unknown branches left without protected investigation
0 abandoned branches silently accumulating without owner or disposition
```

Concurrency is limited by real ownership and file overlap, not a fixed number.

## 5. When review is needed

Review a branch when:

- it has no visible owner or PR;
- its PR was closed without merge;
- a successor or recovery is proposed;
- cleanup is requested;
- its content or relationship to `main` is unknown.

These are investigation triggers, never deletion authority. A scheduled report is not required: run the read-only inventory manually when a real review or cleanup decision exists. Its pull-request trigger only self-tests changes to the report itself.

## 6. Disposition classes

Final disposition uses one of:

```text
ACTIVE_OR_IN_FLIGHT
FULLY_REPRESENTED_BY_ANCESTRY
SQUASH_OR_PATCH_EQUIVALENT
DIAGNOSTIC_DISPOSABLE
SUPERSEDED_VERIFIED
UNIQUE_EVIDENCE
SELECTIVE_RECOVERY
UNKNOWN_PROTECTED
```

| Classification | Action |
|---|---|
| `ACTIVE_OR_IN_FLIGHT` | do not touch |
| `FULLY_REPRESENTED_BY_ANCESTRY` | record replacement SHA, then owner-approved delete |
| `SQUASH_OR_PATCH_EQUIVALENT` | prove patch/file equivalence, then owner-approved delete |
| `DIAGNOSTIC_DISPOSABLE` | verify evidence and cleanup, then owner-approved delete |
| `SUPERSEDED_VERIFIED` | record exact replacement before delete |
| `UNIQUE_EVIDENCE` | preserve in AuditRepo, bundle/patch or approved archive ref |
| `SELECTIVE_RECOVERY` | rebuild justified delta from fresh `main` |
| `UNKNOWN_PROTECTED` | keep and investigate |

The hygiene report emits **preliminary review queues**, not final disposition. Fresh unresolved branches are protected for owner review before ancestry-based cleanup labels are considered. Every report row remains deletion-blocked.

## 7. Successor rule

A successor may replace an older lane only when the record identifies:

```md
Predecessor PR and head SHA:
Successor PR and head SHA:
Unique predecessor material:
Transferred:
Rejected with reason:
Preserved as evidence:
Final predecessor disposition:
```

Do not close an actively used predecessor until the successor is real and the owner accepts the replacement boundary.

## 8. Decomposition signals

Split a change when it contains independently mergeable or reversible units, unrelated purposes, different owners, or mixed product and governance/workflow changes.

File count and line count are review signals, not automatic gates. A large mechanical diff may be one coherent unit; a five-file change may contain two unrelated transactions.

When a safe split is not practical, document review order, rollback units, tests and why the transaction remains together.

## 9. Merge and deletion

Prefer squash merge after exact-head evidence when one PR represents one logical change.

Do not enable automatic deletion of merged branches until the existing branch inventory is reconciled and active-agent exceptions are explicit.

For old squash-merged branches, ancestry alone may be insufficient. Use PR records, patch equivalence or file-level comparison before disposition.

## 10. Cleanup

When cleanup is owner-approved:

1. export an inventory;
2. exclude active and unknown work;
3. classify actual content;
4. recover justified unique deltas from fresh `main`;
5. delete only a small verified batch;
6. rerun inventory after the batch;
7. stop on any unexpected ref or mismatch.

The read-only hygiene workflow never deletes, closes, rebases, labels or comments on branches or PRs.
