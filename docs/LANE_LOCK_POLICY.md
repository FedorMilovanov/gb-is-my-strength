# Lane Lock Policy — FAST / LANE / SYSTEM

**Updated:** 2026-07-28  
**Policy version:** 4.2

Purpose: prevent parallel agents from editing the same route, shared file, governance surface or release boundary.

Mode selection and checks live in [WORK_MODES.md](WORK_MODES.md). Worktree/checkpoint mechanics live in [GIT_WORKTREE_POLICY.md](GIT_WORKTREE_POLICY.md). Recovery and deletion live in [BRANCH_LIFECYCLE_V4.md](BRANCH_LIFECYCLE_V4.md).

## 1. Lane boundary

One independently mergeable lane has one owner, one canonical branch and one PR.

A broader initiative may have several non-overlapping lanes when each can be reviewed, tested, rolled back and merged independently. Do not create duplicate branches for the same lane. Create a successor only through an explicit replacement record.

Suggested names:

```text
lane/fast-<task>-YYYY-MM-DD
lane/<route-or-feature>-<phase>-YYYY-MM-DD
lane/system-<task>-YYYY-MM-DD
agent/<bounded-lane>
hotfix/<bounded-lane>
```

`agent/**` is accepted for connector/runtime publication only when it is the canonical branch for one PR. Diagnostics remain local/detached unless useful work is promoted.

## 2. Ownership record

Use the minimum declaration from `WORK_MODES.md`. The PR description and actual diff are authoritative; commit messages do not need a special lane prefix.

## 3. Collision rules

1. One route or shared surface has one active owner.
2. A second agent takes a non-overlapping lane or waits.
3. Never reset, rebase, force-push, close or delete another owner’s active branch.
4. Never continue another owner’s lane without explicit handoff or owner decision.
5. A route lane does not absorb unrelated system fixes.
6. A system lane does not absorb route content or visual redesign.
7. Shared data uses a declared shared/system lane.
8. Out-of-lane findings are recorded, not silently repaired.
9. Temporary workflow, trigger, writer or patcher introduced by a lane must not survive that lane.
10. A hygiene report is preliminary and read-only; it never authorizes cleanup.

## 4. Active-work protection

Treat a branch as protected when any condition is true:

- it has an open PR;
- it belongs to a current owner instruction or issue;
- it was recently updated and ownership is unresolved;
- its unique delta is still unknown.

Existing active branches are grandfathered. Do not rename or restructure them merely for policy conformity.

A successor may replace an active lane only after the replacement record in `BRANCH_LIFECYCLE_V4.md` is complete and the owner accepts the handoff.

## 5. Handoff

Before another agent continues a lane, record:

```md
Current owner:
New owner:
Exact head SHA:
Completed:
Known failures or unavailable checks:
Next action:
```

A handoff changes ownership; it does not create a second branch for the same lane.

## 6. Merge safety

Before merge, verify only:

```text
□ actual diff matches the lane scope
□ required checks cover the final PR head
□ unresolved review threads are handled
□ temporary automation introduced by the lane is absent
□ adjacent active-agent branches were not modified
```

Branch disposition and cleanup follow `BRANCH_LIFECYCLE_V4.md`; they are not repeated here.
