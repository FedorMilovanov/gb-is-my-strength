# Work Modes — FAST / LANE / SYSTEM

**Updated:** 2026-07-28  
**Current policy version:** 4.0

Purpose: keep verification proportionate while preserving ownership, current source authority and exact-head evidence.

Canonical companion policies:

- [GIT_WORKTREE_POLICY.md](GIT_WORKTREE_POLICY.md) — local worktrees and detached diagnostics;
- [BRANCH_LIFECYCLE_V4.md](BRANCH_LIFECYCLE_V4.md) — active-branch protection, recovery and deletion;
- [LANE_LOCK_POLICY.md](LANE_LOCK_POLICY.md) — ownership and parallel-agent boundaries;
- [OWNER-INVARIANTS.md](OWNER-INVARIANTS.md) — owner-sensitive requirements;
- [AGENT_PUSH_MODEL.md](AGENT_PUSH_MODEL.md) — authenticated publication and exact remote evidence.

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
| `LOCAL_WORKTREE` | product work on a local branch | only when draft PR is ready |
| `DETACHED_DIAGNOSTIC` | reproduction, audit, snapshot, old-SHA or temporary experiment | forbidden |
| `REMOTE_PR` | the one canonical published branch for the task | yes |
| `RECOVERY` | selective recovery from an existing branch | fresh branch from current `main` |

Diagnostic work does not become a fourth risk mode. It uses the relevant risk mode with `DETACHED_DIAGNOSTIC` execution.

## 3. Required declaration

Record in the issue or PR before substantive mutation:

```md
Mode: FAST | LANE | SYSTEM
Execution: LOCAL_WORKTREE | DETACHED_DIAGNOSTIC | REMOTE_PR | RECOVERY
Lane: <branch or detached SHA>
Owner: <agent/human>
Issue/PR: <number or pending draft>
Routes: <bounded list or none>
Files allowed: <bounded list>
Files forbidden: <list>
Source of truth: <current files / exact SHA>
Required checks: <commands / browser profiles>
Rollback point: <exact main SHA>
Dependencies: <open PRs / active branches / owner decisions>
```

## 4. Parallel-agent safety

- Never reset, rebase, force-push, close or delete another owner’s active branch.
- One route or shared surface has one active owner.
- A second agent takes a non-overlapping sub-lane or records an out-of-lane finding.
- Existing branches with open PRs or current owner activity remain protected during the v4 transition.
- Governance and hygiene tooling must remain read-only toward refs and PRs.
- Do not copy code from an older branch until its current owner, replacement history and unique delta are understood.

## 5. Verification layers

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

## 6. Mode boundaries

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

## 7. Route authority

For route work, primary sources are:

- `migration/page-ownership.json`;
- `data/route-profiles/*.json`.

`migration/route-migration-matrix.json` is derived through:

```bash
node scripts/sync-route-migration-matrix.js --write
```

Do not edit it manually to add or redefine a route. Canonical migration modes remain `strict-native`, `strict-native-app`, `legacy-shadow-app`.

## 8. Out-of-lane findings

```md
## Out-of-lane finding

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
- production is not claimed without deploy/live witness.

Before branch deletion, follow `BRANCH_LIFECYCLE_V4.md`. Never delete solely because a PR is closed or a successor claims the work is superseded.

The lane index is `docs/refactor-2026/lanes/README.md`; it is navigation, not an independent backlog.
