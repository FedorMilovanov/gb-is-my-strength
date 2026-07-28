# Work Modes — FAST / LANE / SYSTEM

**Updated:** 2026-07-28  
**Current policy version:** 4.1

Purpose: keep verification proportionate while preserving ownership, current source authority, recoverable progress and exact-head evidence.

Canonical companion policies:

- [GIT_WORKTREE_POLICY.md](GIT_WORKTREE_POLICY.md) — branch-attached worktrees, durable checkpoints and detached diagnostics;
- [BRANCH_LIFECYCLE_V4.md](BRANCH_LIFECYCLE_V4.md) — active-branch protection, recovery and deletion;
- [LANE_LOCK_POLICY.md](LANE_LOCK_POLICY.md) — ownership and parallel-agent boundaries;
- [OWNER-INVARIANTS.md](OWNER-INVARIANTS.md) — owner-sensitive requirements;
- [AGENT_PUSH_MODEL.md](AGENT_PUSH_MODEL.md) — authenticated publication, checkpoint pushes and exact remote evidence.

## 1. Authority before mode

Before any mutation inspect:

1. open issues and pull requests;
2. current `main` and exact rollback SHA;
3. active branches and file overlap, including work that may not yet have a PR;
4. `docs/refactor-2026/lanes/README.md` for navigation;
5. AuditRepo for verified backlog and production-witness boundaries;
6. current primary route sources: `migration/page-ownership.json` and `data/route-profiles/*.json`.

A branch name, historical lane report, closed PR, saved artifact or previous agent statement is not current authority by itself.

All repository changes use a branch and PR. Direct `main` mutation is reserved for an explicit owner-approved emergency with rollback SHA, exact post-push verification and reconciliation.

## 2. Two independent decisions

### Risk mode

| Mode | Use | Minimum iteration boundary |
|---|---|---|
| `FAST` | one bounded low-risk change without shared runtime ownership | `git diff --check` plus targeted contract |
| `LANE` | route, feature or multi-file refactor with named owner | targeted data/route/browser/visual checks |
| `SYSTEM` | shared/global/control-plane/governance | shared/control-plane checks and exact-head barrier |

### Execution mode

| Execution | Use | Remote branch |
|---|---|---:|
| `LOCAL_WORKTREE` | productive work in a named branch-attached worktree | push early; becomes the canonical `REMOTE_PR` branch |
| `DETACHED_DIAGNOSTIC` | disposable reproduction, audit, snapshot, old-SHA or temporary experiment | forbidden until promoted |
| `REMOTE_PR` | the one canonical durable branch for the productive task | yes, with checkpoint pushes |
| `RECOVERY` | selective recovery from an existing branch | fresh branch from current `main` |

Diagnostic work does not become a fourth risk mode. It uses the relevant risk mode with `DETACHED_DIAGNOSTIC` execution. Once a diagnostic creates useful or expensive-to-reproduce product material, promote it immediately to a named branch and push a checkpoint.

## 3. Required declaration

Record before substantive mutation, then copy or update it in the draft PR after the first meaningful pushed checkpoint:

```md
Mode: FAST | LANE | SYSTEM
Execution: LOCAL_WORKTREE -> REMOTE_PR | DETACHED_DIAGNOSTIC | RECOVERY
Lane: <named branch or detached SHA>
Owner: <agent/human>
Issue/PR: <number or pending draft>
Status: active | blocked | ready-for-review
Last pushed SHA: <exact SHA or none-yet>
Completed: <bounded summary>
In progress: <bounded summary>
Next: <bounded next action>
Routes: <bounded list or none>
Files allowed: <bounded list>
Files forbidden: <list>
Source of truth: <current files / exact SHA>
Required checks: <commands / browser profiles>
Known failing or unavailable checks: <list or none>
Rollback point: <exact main SHA>
Dependencies: <open PRs / active branches / owner decisions>
```

## 4. Durability and checkpointing

A worktree isolates files; it does not guarantee persistence. Productive agents must not rely on one runtime surviving until task completion.

Required sequence:

1. create a named branch in a dedicated worktree;
2. declare scope and overlap;
3. push the canonical branch early;
4. commit and push the first meaningful recoverable checkpoint;
5. open a draft PR immediately after that checkpoint;
6. push later checkpoints after coherent work units and before long-running commands, handoffs, environment changes or session boundaries;
7. keep the PR progress block and exact last pushed SHA current.

Checkpoint commits may be `wip(...)`; final history remains clean through squash merge. A checkpoint is recoverability evidence, not a green-test claim. Never checkpoint secrets, credentials, unrelated files or accidental generated bulk.

If an agent stops unexpectedly, pushed commits and the draft PR remain recoverable. Uncommitted or unpushed work may be lost and is not considered preserved.

## 5. Parallel-agent safety

- Each productive agent has one named worktree branch and one canonical draft PR.
- Never reset, rebase, force-push, close or delete another owner’s active branch.
- Never continue another owner’s branch without explicit handoff or owner decision.
- One route or shared surface has one active owner.
- A second agent takes a non-overlapping sub-lane or records an out-of-lane finding.
- Existing branches with open PRs or current owner activity remain protected during the v4 transition.
- Governance and hygiene tooling must remain read-only toward refs and PRs.
- Do not copy code from an older branch until its current owner, replacement history and unique delta are understood.

For three simultaneous productive agents, three visible draft PRs are normal and desirable. They show who owns each task, what files changed, the exact last pushed SHA and what remains.

## 6. Verification layers

### Iteration evidence

Run only checks that directly cover the current edit, and record why they are sufficient.

```bash
git diff --check

# route / registry / metadata
npm run migration:metadata:check
npm run native:runtime:audit:strict

# content / MDX / shared data
npm run data:consistency
npm run content:parity
npm run mdx:structure:audit

# system / workflows / shared files
npm run guard:shared-files
npm run workflows:check
npm run control-plane:audit
npm run workflows:lint
```

Checkpoint pushes may happen before the full suite. Record known failures and unavailable checks in the draft PR. Do not call a checkpoint green unless its exact SHA has the claimed evidence.

### Exact-head PR evidence

Before merge, checks must cover the final PR head SHA. A green run on an earlier commit is not evidence for a moved head.

### Final barrier

For production, shared, refactor or system impact:

```bash
npm run validate:static-publication
npm run guard:shared-files
```

Add current route/browser/visual/source contracts for the touched surface.

A docs-only SYSTEM PR may use a narrower barrier only when the diff cannot affect build/runtime. Shared Files Guard, workflow syntax where applicable, link/reference integrity and exact-head CI remain required.

### Production witness

A merged source commit does not prove production. Record exact deployed/live SHA and live evidence separately.

A failed or unavailable check is never silently omitted; record the exact blocker.

## 7. Mode boundaries

### FAST

Examples:

- typo or factual wording correction;
- one current documentation file;
- route-local text without metadata/schema impact;
- a small test expectation that does not weaken coverage.

FAST must not change workflows, package files, global CSS/JS, migration registries, shared layouts or broad data.

### LANE

Use for route/feature work, multi-file refactors or any surface requiring a named owner. A route lane does not absorb unrelated shared/system fixes.

### SYSTEM

Includes at minimum:

```text
AGENTS.md
README.md
package.json / package-lock.json
.github/**
docs/WORK_MODES.md
docs/LANE_LOCK_POLICY.md
docs/OWNER-INVARIANTS.md
docs/AGENT_PUSH_MODEL.md
docs/GIT_WORKTREE_POLICY.md
docs/BRANCH_LIFECYCLE_V4.md
astro.config.* / tsconfig.*
sw.js
migration/**
scripts defining repository or release policy
src/layouts/**
shared reader/overlay services
css/** / js/**
karty/_engine/**
```

SYSTEM work remains separate from route content and visual redesign.

## 8. Route authority

For route work, primary sources are:

- `migration/page-ownership.json`;
- `data/route-profiles/*.json`.

`migration/route-migration-matrix.json` is derived through:

```bash
node scripts/sync-route-migration-matrix.js --write
```

Do not edit it manually to add or redefine a route. Canonical migration modes remain `strict-native`, `strict-native-app`, `legacy-shadow-app`.

## 9. Out-of-lane findings

```md
## Out-of-lane finding

Observed at: <exact SHA / file / route>
Evidence: <source, test or artifact>
Not changed because: <ownership boundary>
Proposed lane: <name>
Recovery risk: <none / possible unique branch material>
```

## 10. Before merge or deletion

Before merge:

- actual diff matches declared scope;
- final SHA passed required checks;
- review threads are resolved;
- no temporary workflow, trigger, writer or patcher remains;
- production is not claimed without deploy/live witness.

Before branch deletion, follow `BRANCH_LIFECYCLE_V4.md`. Never delete solely because a PR is closed or a successor claims the work is superseded.

The lane index is `docs/refactor-2026/lanes/README.md`; it is navigation, not an independent backlog.
