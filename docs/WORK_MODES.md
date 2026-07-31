# Work Modes — FAST / LANE / SYSTEM

**Updated:** 2026-07-28  
**Current policy version:** 4.4

Purpose: choose proportionate verification without turning every change into the same ceremony.

## 0. Operational entrypoint

For every mutation, do only this minimum pre-flight:

1. read the current owner instruction;
2. inspect current `main` and record a rollback SHA;
3. inspect open PRs or active branches that may touch the intended files or surface;
4. choose `FAST`, `LANE` or `SYSTEM`;
5. identify the current source of truth and the checks that directly cover the change.

Do **not** reread all 1,000+ lines of `AGENTS-REFERENCE.md`, its changelog, unrelated architecture sections or every governance document before each task. The historical blanket full-read wording inside `AGENTS-REFERENCE.md` is superseded by the root `AGENTS.md` operational contract and this entrypoint: read the root pre-flight and only the reference sections governing the surface being changed.

Read companion policies only when applicable:

- [GIT_WORKTREE_POLICY.md](GIT_WORKTREE_POLICY.md) — branch/worktree/checkpoint mechanics;
- [LANE_LOCK_POLICY.md](LANE_LOCK_POLICY.md) — parallel agents, shared surfaces or ownership overlap;
- [BRANCH_LIFECYCLE_V4.md](BRANCH_LIFECYCLE_V4.md) — branch recovery, supersession or cleanup;
- [OWNER-INVARIANTS.md](OWNER-INVARIANTS.md) — owner-sensitive content, data or UI;
- [AGENT_PUSH_MODEL.md](AGENT_PUSH_MODEL.md) — authentication, remote publication or deploy evidence.

Inspect environment capabilities only when the planned commands depend on them. A wording-only FAST change does not require a full CPU/RAM/disk/Playwright inventory.

## 1. Authority before mutation

Use this order:

1. current owner instruction;
2. open issues and PRs relevant to the intended surface;
3. current `main`, exact branch heads and exact-head CI;
4. current source-of-truth files;
5. verified historical evidence only when current sources do not answer the question.

For route work, primary sources are `migration/page-ownership.json` and `data/route-profiles/*.json`. The lane index and historical reports are navigation or evidence, not independent authority.

All normal changes use a branch and PR. Direct `main` mutation is reserved for an explicit owner-approved emergency.

## 2. Choose one risk mode

| Mode | Use | Iteration boundary |
|---|---|---|
| `FAST` | one bounded low-risk change without shared runtime ownership | `git diff --check` plus the directly relevant contract |
| `LANE` | route, feature or multi-file refactor with named owner | targeted data/route/browser/visual checks |
| `SYSTEM` | shared/global/control-plane/governance | checks for the touched control-plane surface and exact-head evidence |

Risk mode does not decide when to push. Execution and economical checkpoints are defined in `GIT_WORKTREE_POLICY.md`.

## 3. Minimum declaration

Record only what prevents collision and proves the result:

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

Add status, handoff, recovery, successor or production-witness fields only when applicable. Do not copy the same metadata into multiple documents when the PR already contains the current record.

## 4. Default execution path

```text
named branch in dedicated worktree
→ bounded local work
→ first meaningful recoverable commit
→ push and draft PR
→ continue with economical checkpoints
→ exact-head checks
→ squash merge
```

A larger initiative may use multiple non-overlapping, independently mergeable lanes. One lane must not fan out into duplicate branches.

## 5. Proportionate verification

Run only checks that can fail because of the current diff.

| Change | Minimum evidence |
|---|---|
| wording-only FAST | `git diff --check` plus direct link/content/contract check |
| docs-only governance | `git diff --check`, reference integrity, exact-head Shared Files Guard |
| workflow/control-plane code | shared-files guard, workflow checks/lint and control-plane audit |
| route/content/data | targeted route, schema, content or browser contracts |
| runtime/shared/refactor | targeted contracts plus the applicable final publication barrier |

Useful commands include:

```bash
git diff --check

npm run migration:metadata:check
npm run native:runtime:audit:strict
npm run data:consistency
npm run content:parity
npm run mdx:structure:audit

npm run guard:shared-files
npm run workflows:check
npm run control-plane:audit
npm run workflows:lint

npm run validate:static-publication
```

This is a toolbox, not a command bundle. Do not run workflow lint for a prose-only file, a full production build for an isolated policy wording change, or browser suites for a file that cannot affect a route.

Checkpoint pushes may precede the full suite. Before merge, required checks must cover the final PR head. A green run on an earlier commit is not evidence for a moved head.

A merged source commit does not prove production. Record deployed/live evidence only when production is claimed. Failed or unavailable checks that affect confidence must be stated; irrelevant checks need not be mentioned.

## 6. Mode boundaries

### FAST

Examples: typo or factual wording correction, one current documentation file, route-local text without schema impact, or a small test expectation that does not weaken coverage.

FAST must not change workflows, package files, global CSS/JS, migration registries, shared layouts or broad data.

### LANE

Use for route/feature work, multi-file refactors or any surface requiring a named owner. A route lane does not absorb unrelated shared/system fixes.

### SYSTEM

Includes at minimum:

```text
AGENTS.md
AGENTS-REFERENCE.md
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

## 7. Route authority

`migration/route-migration-matrix.json` is derived through:

```bash
node scripts/sync-route-migration-matrix.js --write
```

Do not edit it manually to add or redefine a route. Canonical migration modes remain `strict-native`, `strict-native-app`, `legacy-shadow-app`.

## 8. Out-of-lane findings

Record only enough to route the finding:

```md
Observed at: <exact SHA / file / route>
Evidence: <source, test or artifact>
Proposed lane: <name>
Recovery risk: <none / possible unique branch material>
```

## 9. Before merge or deletion

Before merge:

- actual diff matches declared scope;
- final SHA passed the checks that apply to the diff;
- unresolved review threads are handled;
- temporary automation introduced by the lane is removed;
- production is not claimed without deploy/live evidence.

Before deletion, follow `BRANCH_LIFECYCLE_V4.md`. Never delete solely because a PR is closed or a successor claims the work is superseded.
