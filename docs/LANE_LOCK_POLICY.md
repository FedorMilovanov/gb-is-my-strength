# Lane Lock Policy — FAST / LANE / SYSTEM

**Updated:** 2026-08-08  
**Policy version:** 4.3

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

### Automated collision guard

`Shared Files Guard` runs the read-only `scripts/lane-collision-guard.mjs` for pull requests. It supplements this policy; it does not replace the semantic pre-flight above.

The collision boundary is intentionally narrow and stateless:

- open same-repository pull requests are the active machine-readable collision/ownership records; the collision guard itself creates no lock file, TTL, heartbeat or branch mutation;
- branch-writing capability is governed separately by **Writer Lease v1** below; a writer lease never changes file-collision precedence or authorizes a second semantic owner;
- for deterministic simultaneous ownership, the earlier pull-request number has precedence;
- a later PR fails when it overlaps an earlier active same-repository PR on the exact same exclusive file;
- known deterministic projection files are warning-only because shared generated output does not prove that the source owners collide;
- fork pull requests do not claim an internal agent lane;
- an earlier PR stops claiming precedence only after it is closed or explicitly records that the current PR supersedes/replaces it;
- GitHub/API ambiguity fails closed rather than silently declaring a lane free.

Exact-file automation cannot prove that two different files belong to the same logical route or shared surface. Agents must still inspect open work and declare the semantic collision boundary before mutation.

### Machine writer lease — Writer Lease v1

Any same-repository PR that grants a repo-writing applicator/autofix must carry exactly one machine block in its PR body:

```md
<!-- GB_WRITER_LEASE_V1
{
  "version": 1,
  "laneId": "stable-lane-id",
  "pr": 1234,
  "branch": "lane/example",
  "ownerToken": "opaque-agent-session-token",
  "generation": 1,
  "acquisitionSha": "40-hex-head-at-acquisition",
  "status": "active",
  "handoff": null,
  "retirement": null
}
GB_WRITER_LEASE_V1 -->
```

The owner token is public, opaque concurrency identity — **not a credential or secret**, and never inferred from Git author/committer names. Generation starts at 1. The acquisition SHA must be an ancestor of the queued writer head.

Permanent branch writers use `scripts/writer-lease.mjs`: checkout the immutable event head SHA, snapshot the event lease, compare the live PR lease and live head before mutation/commit/push, stamp `Writer-Lease: <owner>@<generation>` into the generated commit, then publish with `git push --force-with-lease=<branch>:<expected-head>`. A queued run fails closed when another actor moves the head or rotates the lease, even when both actors share one GitHub login.

Handoff is explicit only: successor generation is exactly predecessor generation + 1, owner token changes, `acquisitionSha` becomes the exact handoff head, and `handoff` records predecessor/successor token + generation + head. A later timestamp never steals a lease.

Retirement never uses TTL/age. The current owner changes `status` to `retired` without changing owner/generation/acquisition SHA and records exact `retirement.atHead`, a reason, and a final `BRANCH_LIFECYCLE_V4.md` disposition. Retirement ends write authority; it does not by itself authorize branch deletion, rewrite or closure. Read-only auditors do not need a writer lease.

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
