# Branch Lifecycle v4

**Policy version:** 4.1  
**Effective:** after merge into `main`  
**Goal:** preserve every useful result while preventing remote refs from becoming an unreviewed archive.

## 1. Safety invariant

No branch is closed, rewritten or deleted because of its name, age, closed PR state, or the word `superseded` alone.

Deletion requires an explicit disposition based on actual content, PR history and current `main`.

## 2. Transition while agents are active

This policy is introduced without interrupting current work.

The following are protected until their owner finishes or the repository owner records a disposition:

- branches with an open PR;
- branches updated within the last 7 days that belong to an active agent task;
- branches named in a current issue, PR or owner instruction;
- branches whose ownership or unique delta is still unknown.

During transition:

1. do not rename or rebase active branches for policy compliance;
2. do not close active PRs;
3. do not delete branches automatically;
4. apply the new worktree/remote rules to new work;
5. use the hygiene report only to build an inventory.

## 3. Canonical branch rule

One task has at most one canonical remote product branch and one PR.

Permitted categories:

| Category | Remote | Condition |
|---|---:|---|
| Product PR branch | yes | one bounded scope and one canonical PR |
| Hotfix branch | yes | owner-approved emergency transaction |
| Release branch | rarely | an actual release process requires it |
| Forensic archive ref | exception | owner-approved after content classification |
| Diagnostic/probe/snapshot | no | local detached worktree or Actions artifact |
| Temporary CI trigger | no | use `workflow_dispatch` or an exact PR/SHA |

## 4. Agent durability contract

Productive work is not allowed to depend on one local runtime surviving until the end of the task.

For every productive agent task:

1. create a named local branch in its own worktree before substantive edits;
2. push that canonical branch early;
3. push the first meaningful recoverable commit without waiting for task completion;
4. open a draft PR immediately after the first meaningful pushed commit;
5. continue with bounded checkpoint commits and pushes;
6. keep the PR status block current;
7. record the exact last pushed SHA before handoff, pause or completion.

Expected status record:

```md
Status: active | blocked | ready-for-review
Owner / agent:
Last pushed SHA:
Completed:
In progress:
Next:
Known failing or unavailable checks:
```

A checkpoint is required after a coherent unit of work and before any session, runtime, context or ownership boundary where losing the current delta would be costly.

Consequences of interruption:

- pushed commits are durable and can be resumed from the remote branch;
- the draft PR provides visible ownership, scope, file diff and progress;
- uncommitted or unpushed changes may be lost and are not treated as preserved;
- another agent must not continue on the branch without explicit handoff or owner decision.

Detached worktrees remain valid only for disposable diagnostics. When diagnostic work becomes useful product material or expensive-to-reproduce evidence, it must be promoted immediately to the one canonical branch and pushed.

## 5. Target branch budget

After the current multi-agent wave and forensic cleanup, target:

```text
<= 3 active product branches
0 diagnostic remote branches
0 unknown branches without disposition
0 abandoned branches silently accumulating without a PR or owner
```

This is a target state, not a command to terminate active work.

Three simultaneous productive agents normally produce three visible draft PRs. That is expected active work, not branch clutter.

## 6. Review timers, not deletion timers

| State | Review point | Required action |
|---|---:|---|
| New remote branch without PR | 24 hours | open draft PR, mark active exception, or classify |
| Product branch with no pushed checkpoint | same work session | push recoverable progress or record why no product delta exists |
| Open PR without movement | 7 days | ask owner/agent for next action |
| Open PR without movement | 14 days | decide continue, split, supersede or close |
| Closed unmerged PR | within 7 days | file-level recovery classification |
| Unknown branch | immediately | protect and add to forensic register |
| Detached diagnostic worktree | end of task | preserve evidence, then remove locally |

Passing a review point never authorizes deletion by itself.

## 7. Disposition classes

Every candidate branch receives one class:

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

Actions:

| Classification | Action |
|---|---|
| `ACTIVE_OR_IN_FLIGHT` | do not touch |
| `FULLY_REPRESENTED_BY_ANCESTRY` | record replacement SHA, then owner-approved delete |
| `SQUASH_OR_PATCH_EQUIVALENT` | prove patch/file equivalence, then owner-approved delete |
| `DIAGNOSTIC_DISPOSABLE` | verify evidence and cleanup, then owner-approved delete |
| `SUPERSEDED_VERIFIED` | record exact replacement table before delete |
| `UNIQUE_EVIDENCE` | preserve in AuditRepo, bundle/patch or approved archive ref |
| `SELECTIVE_RECOVERY` | rebuild justified delta from fresh `main` in a new PR |
| `UNKNOWN_PROTECTED` | keep; investigate |

## 8. Successor rule

A successor may replace an older branch/PR only when the record includes:

```md
Predecessor PR and head SHA:
Successor PR and head SHA:
Files or ideas unique to predecessor:
Transferred:
Rejected with reason:
Preserved as evidence:
Final predecessor disposition:
```

Do not close an actively used predecessor until the successor is real and the owner accepts the replacement boundary.

## 9. Large PR decomposition

A decomposition review is required when any threshold is crossed:

- more than 20 changed files;
- more than 1000 added + deleted lines;
- more than 3 protected subsystems;
- product code and governance/workflows are mixed;
- independent rollback is not possible.

A large PR is not automatically invalid, but its description must document review order, rollback units, tests and why a safe split is not yet possible.

Checkpoint commits do not justify an oversized final PR. Durability and decomposition are separate requirements.

## 10. Merge and deletion

Preferred merge model is squash merge after exact-head evidence. Repository settings are changed separately and only with owner approval.

Squash merge allows agents to push frequent recoverability checkpoints without polluting final `main` history.

Automatic deletion of merged branches must not be enabled until the current branch inventory has been reconciled and active-agent exceptions are explicit.

Old squash-merged branches require PR records, `git cherry`, patch equivalence or file-level comparison; `git branch --merged` is insufficient.

## 11. Cleanup waves

When the owner starts cleanup:

1. freeze only creation of new diagnostic refs;
2. export a complete branch inventory;
3. exclude all active/in-flight branches;
4. classify actual content;
5. recover unique deltas from fresh `main`;
6. delete no more than 10 verified branches per wave;
7. rerun inventory after every wave;
8. stop on any unexpected ref or mismatch.

The read-only hygiene workflow never deletes, closes, rebases, labels or comments on branches or PRs.
