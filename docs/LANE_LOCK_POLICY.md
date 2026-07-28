# Lane Lock Policy — FAST / LANE / SYSTEM

**Updated:** 2026-07-28  
**Policy version:** 4.1  
See also: [WORK_MODES.md](WORK_MODES.md), [GIT_WORKTREE_POLICY.md](GIT_WORKTREE_POLICY.md), [BRANCH_LIFECYCLE_V4.md](BRANCH_LIFECYCLE_V4.md).

## 1. Purpose

Lane lock prevents parallel agents from overwriting the same route, shared file, governance surface or release boundary. It also protects active and unknown branches from premature cleanup.

A lane is an ownership transaction, not merely a branch name.

## 2. Lane boundary

One independently mergeable lane has one owner, one canonical branch and one PR.

A broader initiative may have several non-overlapping lanes when each can be reviewed, tested, rolled back and merged independently. This is preferred over one oversized mixed PR. Do not create duplicate or successor branches for the same lane without an explicit replacement record.

Suggested branch names:

```text
lane/fast-<task>-YYYY-MM-DD
lane/<route-or-feature>-<phase>-YYYY-MM-DD
lane/system-<task>-YYYY-MM-DD
agent/<bounded-lane>
hotfix/<bounded-lane>
```

`agent/**` is accepted for connector/runtime publication only when it is the canonical branch for one PR.

Diagnostics use a local detached worktree and do not normally publish `diag/**`, `probe/**`, `snapshot/**` or similar refs.

An `archive/forensic-*` ref is an owner-approved last resort. Prefer AuditRepo, an immutable artifact, patch or bundle for evidence that should not enter `main`.

## 3. Minimum declaration

```md
Mode: FAST | LANE | SYSTEM
Lane / owner:
Purpose and bounded scope:
Base / rollback SHA:
Allowed files or surfaces:
Adjacent active work and overlap decision:
Source of truth:
Required checks:
```

Add status, handoff, recovery or successor details only when applicable. The current PR description and actual diff are authoritative; commit messages do not need a special lane prefix.

## 4. Ownership rules

1. One route or shared surface has one active owner.
2. A second agent takes a non-overlapping sub-lane or waits.
3. Never reset, rebase, force-push, close or delete another owner’s active branch.
4. Never continue another owner’s lane without explicit handoff or owner decision.
5. A route lane does not absorb unrelated system fixes.
6. A system lane does not absorb route content or visual redesign.
7. Shared data uses a declared shared/system lane.
8. Out-of-lane findings are recorded, not silently repaired.
9. `Superseded` is a claim to verify against current blobs, not permission to delete.
10. No temporary workflow, trigger, writer or patcher survives the transaction that needed it.
11. A hygiene report is preliminary and read-only; it never authorizes cleanup.

## 5. Active-agent protection

Treat a branch as protected in-flight work when any condition is true:

- it has an open PR;
- it belongs to a current owner instruction or issue;
- it was recently updated and ownership is unresolved;
- its unique delta is still unknown.

Existing active branches are grandfathered. Do not rename or restructure them merely for policy conformity.

A successor may replace an active lane only after the replacement record in `BRANCH_LIFECYCLE_V4.md` is complete and the owner accepts the handoff.

## 6. Verification discipline

### Iteration

```bash
git diff --check
# plus checks that directly cover the changed surface
```

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

A docs-only SYSTEM PR may use a narrower barrier when runtime/build cannot be affected. Exact-head Shared Files Guard and reference integrity remain required.

## 7. Current truth order

1. current owner instruction;
2. open GitHub issues and PRs;
3. current `main`, exact branch heads and exact-head CI;
4. AuditRepo canonical matrix and reverify evidence;
5. `docs/refactor-2026/lanes/README.md` as navigation.

The lane index is not an independent backlog. A branch does not become active merely because it exists remotely, and it does not become disposable merely because no PR was found.

## 8. Out-of-lane finding

```md
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
□ Production is not claimed without exact deploy/live evidence
□ Adjacent active-agent branches were not modified
```

## 10. Branch disposition

Before deletion, classify actual content:

| Classification | Action |
|---|---|
| Active or in-flight | do not touch |
| Fully present in `main` | record replacement SHA, then owner-approved delete |
| Squash/patch equivalent | prove equivalence, then owner-approved delete |
| Trigger/probe/diagnostic only | verify evidence and cleanup first |
| Superseded | verify replacement file-by-file |
| Unique evidence/prototype | preserve outside product history or approved archive ref |
| Selective recovery | rebuild justified delta from fresh `main` |
| Unknown | protect and investigate |

Never automatically delete a branch immediately after merge. Follow `BRANCH_LIFECYCLE_V4.md` and remove only small verified batches after owner approval.
