# Work Modes — FAST / LANE / SYSTEM

**Updated:** 2026-07-28  
**Current policy version:** 4.2

Purpose: choose proportionate verification without duplicating execution, ownership and cleanup rules.

Canonical companion policies:

- [GIT_WORKTREE_POLICY.md](GIT_WORKTREE_POLICY.md) — the normal branch/worktree/checkpoint path;
- [LANE_LOCK_POLICY.md](LANE_LOCK_POLICY.md) — ownership and overlap;
- [BRANCH_LIFECYCLE_V4.md](BRANCH_LIFECYCLE_V4.md) — remote refs, recovery and cleanup;
- [OWNER-INVARIANTS.md](OWNER-INVARIANTS.md) — owner-sensitive requirements;
- [AGENT_PUSH_MODEL.md](AGENT_PUSH_MODEL.md) — authentication and exact remote evidence.

## 1. Authority before mutation

Inspect:

1. the current owner instruction;
2. open issues and PRs;
3. current `main`, rollback SHA and active branch heads;
4. exact file/surface overlap;
5. current source-of-truth files and applicable checks.

For route work, primary sources are `migration/page-ownership.json` and `data/route-profiles/*.json`. The lane index and historical reports are navigation or evidence, not independent authority.

All normal changes use a branch and PR. Direct `main` mutation is reserved for an explicit owner-approved emergency.

## 2. Choose one risk mode

| Mode | Use | Iteration boundary |
|---|---|---|
| `FAST` | one bounded low-risk change without shared runtime ownership | `git diff --check` plus the directly relevant contract |
| `LANE` | route, feature or multi-file refactor with named owner | targeted data/route/browser/visual checks |
| `SYSTEM` | shared/global/control-plane/governance | shared/control-plane checks and exact-head barrier |

Risk mode does not decide when to push. Execution and economical checkpoints are defined in `GIT_WORKTREE_POLICY.md`.

## 3. Minimum declaration

Record only what is needed to prevent collision and prove the result:

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

A larger initiative may be decomposed into multiple non-overlapping, independently mergeable lanes. One lane must not fan out into duplicate branches.

## 5. Verification layers

### Iteration evidence

Run only checks that directly cover the current edit:

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

Checkpoint pushes may precede the full suite. Do not call a checkpoint green unless the claimed evidence covers its exact SHA.

### Exact-head PR evidence

Before merge, required checks must cover the final PR head. A green run on an earlier commit is not evidence for a moved head.

### Final barrier

For production, shared, refactor or system impact:

```bash
npm run validate:static-publication
npm run guard:shared-files
```

Add current route/browser/visual/source contracts for the touched surface. A docs-only SYSTEM PR may use a narrower barrier when runtime/build cannot be affected, but exact-head Shared Files Guard and reference integrity still apply.

### Production witness

A merged source commit does not prove production. Record exact deployed/live SHA and live evidence separately when production is claimed.

A failed or unavailable check is never silently omitted; record the blocker.

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

```md
Observed at: <exact SHA / file / route>
Evidence: <source, test or artifact>
Not changed because: <ownership boundary>
Proposed lane: <name>
Recovery risk: <none / possible unique branch material>
```

## 9. Before merge or deletion

Before merge:

- actual diff matches declared scope;
- final SHA passed required checks;
- review threads are resolved;
- no temporary workflow, trigger, writer or patcher remains;
- production is not claimed without deploy/live evidence.

Before deletion, follow `BRANCH_LIFECYCLE_V4.md`. Never delete solely because a PR is closed or a successor claims the work is superseded.
