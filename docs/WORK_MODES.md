# Work Modes — FAST / LANE / SYSTEM

**Updated:** 2026-07-24  
**Current policy version:** 3.0

Purpose: keep iteration proportionate without letting small changes bypass ownership, review or permanent contracts.

## 1. Authority before mode

Before choosing a mode, inspect:

1. open issues and pull requests;
2. current `main` and the exact files being changed;
3. `docs/refactor-2026/lanes/README.md` for navigation;
4. AuditRepo for verified backlog and production-witness boundaries.

A branch name, old lane report or closed PR description is not current authority by itself.

All repository changes use a branch and PR. `FAST` means a small verification scope, **not direct mutation of `main`**. An emergency direct-main operation requires an explicit owner decision and immediate post-push verification/reconciliation.

## 2. Verification layers

### FAST loop

Run the smallest checks that directly cover the current risk while iterating:

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

Do not run every command after every edit. Record why the selected checks cover the touched surface.

### Final barrier

Before a production, shared, refactor or system PR is merged:

```bash
npm run validate:static-publication
npm run guard:shared-files
```

Add current route/browser/visual contracts for the affected surface. A docs-only PR may use a narrower barrier when its scope cannot affect build/runtime; the PR must state that boundary and still pass Shared Files Guard.

A failed or unavailable check is never silently omitted: record the exact blocker and do not convert it into a green claim.

## 3. Modes

### FAST

Use for one bounded, low-risk change with no shared runtime ownership:

- typo or factual wording correction;
- one current documentation file;
- route-local text with no metadata/schema impact;
- a small test expectation that does not weaken coverage.

Branch example:

```text
lane/fast-<task>-YYYY-MM-DD
```

Minimum:

```bash
git diff --check
# plus one targeted contract when applicable
```

FAST must not change workflows, package files, global CSS/JS, migration registries, shared layouts or broad data.

### LANE

Use for route/feature work, multi-file refactors or any surface that needs a named owner.

Branch example:

```text
lane/<route-or-feature>-<phase>-YYYY-MM-DD
```

Declaration:

```md
Lane: <branch>
Issue/PR: <number>
Routes: <bounded list>
Files allowed: <bounded list>
Files forbidden: <list>
Source of truth: <files / exact SHA>
Required checks: <commands / browser profiles>
Rollback point: <exact main SHA>
```

A route lane does not absorb unrelated shared/system fixes. Record those as out-of-lane findings.

### SYSTEM

Use for shared/global/control-plane work, including:

```text
AGENTS.md
package.json / package-lock.json
.github/workflows/**
astro.config.* / tsconfig.*
sw.js
migration/**
scripts that define repository or release policy
src/layouts/**
shared reader/overlay services
css/** / js/**
karty/_engine/**
```

Branch example:

```text
lane/system-<task>-YYYY-MM-DD
```

SYSTEM work must remain separate from route content and visual redesign. It must run:

```bash
npm run guard:shared-files
npm run workflows:check
npm run control-plane:audit
npm run workflows:lint
```

and the final barrier appropriate to the changed control plane.

## 4. Shared data and documents

Shared data/documents include, at minimum:

```text
docs/WORK_MODES.md
docs/LANE_LOCK_POLICY.md
docs/AGENT_PUSH_MODEL.md
data/series.json
data/search-manifest.json
data/public-content-baseline.json
scripts/guard-shared-files.js
scripts/check-data-consistency.js
scripts/audit-pro.js
scripts/repository-control-plane-audit.mjs
```

Change them only in a declared shared/system lane. A docs file is not automatically safe merely because it cannot execute: stale governance can direct later agents into destructive operations.

## 5. Out-of-lane findings

Do not opportunistically repair a different owner’s surface.

```md
## Out-of-lane finding

Observed in: <file / route / exact SHA>
Evidence: <what proves it>
Not changed because: <ownership boundary>
Proposed lane: <name>
```

For a likely lost branch or file, add it to the forensic/recovery register before deleting or recreating anything.

## 6. Branch and PR lifecycle

### Before work

- inspect open PRs/issues and current branches;
- choose a unique owner and bounded scope;
- declare allowed/forbidden files and rollback SHA;
- identify current tests, not historical tests from the old branch.

### Before merge

- confirm the PR diff contains only declared scope;
- verify exact head, not an earlier commit;
- resolve review threads;
- preserve source authority separately from deployed/live authority;
- ensure no temporary workflow, trigger, writer or patcher remains.

### Before branch deletion

Do **not** delete a branch solely because its PR closed or a newer PR says “superseded”. First classify its actual content:

- byte-equivalent or fully represented in `main`;
- diagnostic/trigger-only and intentionally disposable;
- superseded with a verified replacement chain;
- unique prototype/evidence worth archiving;
- selective recovery candidate.

For unique material that should not enter `main`, create an explicit `archive/forensic-*` ref or preserve it in governed AuditRepo evidence. Archive refs are never merged wholesale.

## 7. Current commands by mode

```bash
# FAST
git diff --check

# LANE
git diff --check
npm run guard:shared-files
npm run data:consistency
npm run migration:metadata:check
# plus route/browser/visual checks

# SYSTEM
git diff --check
npm run guard:shared-files
npm run workflows:check
npm run control-plane:audit
npm run workflows:lint
npm run validate:static-publication
```

The current lane index is `docs/refactor-2026/lanes/README.md`. The current architecture/recovery summary is `docs/refactor-2026/REFRACTOR_AUDIT_LIVING.md`.

## Historical policy

Version 2.0 remains available in Git history at blob `4d934372cae4c3deb3f0df10cfb5d20a74cdbe6e`. It reflected the June 2026 sandbox and permitted direct-main FAST work; that permission is retired by this version.
