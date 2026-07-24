# Lane Lock Policy — FAST / LANE / SYSTEM

**Updated:** 2026-07-24  
**Policy version:** 3.0  
See also: [WORK_MODES.md](WORK_MODES.md).

## 1. Purpose

Lane lock prevents parallel agents from overwriting the same route, shared file or release boundary. It also prevents a closed branch from being deleted before its unique content is understood.

A lane is an ownership transaction, not merely a branch-name convention.

## 2. Modes and branch boundary

- **FAST** — one small low-risk change; still uses a short-lived branch and PR.
- **LANE** — route/feature/refactor work with bounded file ownership.
- **SYSTEM** — shared/global/control-plane work isolated from route content.

Direct changes to `main` are not a normal FAST path. An emergency direct-main operation requires an explicit owner decision, exact post-push CI inspection and AuditRepo reconciliation where applicable.

Suggested names:

```text
lane/fast-<task>-YYYY-MM-DD
lane/<route-or-feature>-<phase>-YYYY-MM-DD
lane/system-<task>-YYYY-MM-DD
lane/shared-<data-fix>-YYYY-MM-DD
```

Archive refs use a separate namespace:

```text
archive/forensic-<origin>-<purpose>-YYYY-MM-DD
```

An archive ref is provenance only and must not be treated as an active lane or merged wholesale.

## 3. Lane declaration

Record this in the issue or PR before substantive work:

```md
Lane: <branch>
Issue/PR: <number>
Routes: <bounded list>
Files allowed: <bounded list>
Files forbidden: <list>
Source of truth: <files / exact SHA>
Required checks: <commands / browser profiles>
Rollback point: <exact main SHA>
Dependencies: <issues / PRs / owner decisions>
```

Commit messages should identify the lane when multiple agents are active:

```text
[LANE <branch>] <type>(<scope>): <message>
```

The PR description and actual diff are authoritative if an old commit message contains a stale declaration.

## 4. Ownership rules

1. One route or shared surface has one active owner at a time.
2. A second agent either takes a non-overlapping sub-lane or waits.
3. A route lane does not change system files.
4. A system lane does not absorb route content or visual redesign.
5. Shared data uses a declared shared/system lane.
6. Out-of-lane findings are recorded, not silently repaired.
7. “Superseded” is a claim to verify against current blobs, not permission to delete a branch.
8. No temporary workflow, trigger, writer or patcher survives the transaction that needed it.

## 5. Verification discipline

### Iteration loop

```bash
git diff --check
npm run guard:shared-files
npm run data:consistency
npm run migration:metadata:check
npm run native:runtime:audit:strict
```

Select only relevant commands while iterating, then add the route-specific browser/visual/source contracts.

### System/control-plane loop

```bash
git diff --check
npm run guard:shared-files
npm run workflows:check
npm run control-plane:audit
npm run workflows:lint
```

### Final barrier

Production, shared, refactor and system lanes require:

```bash
npm run validate:static-publication
npm run guard:shared-files
```

A docs-only PR may use a narrower barrier when it cannot affect runtime/build, but Shared Files Guard and reference integrity remain mandatory. Record the exact-head run IDs or artifacts.

## 6. Out-of-lane finding

```md
## Out-of-lane finding

Observed at: <exact SHA / file / route>
Evidence: <source, test or artifact>
Not changed because: <ownership boundary>
Proposed lane: <name>
Recovery risk: <none / possible unique branch material>
```

Do not copy code from an old branch until its replacement history and current owner contracts are understood.

## 7. Lane index and current truth

Use this order:

1. open GitHub issues and pull requests;
2. current `main` and exact-head CI;
3. AuditRepo canonical matrix and reverify evidence;
4. `docs/refactor-2026/lanes/README.md` as navigation.

The lane index is not an independent backlog. A branch does not become active merely because it exists remotely.

## 8. Pre-work checklist

```text
□ Search open PRs/issues for overlapping scope
□ Inspect current main and exact rollback SHA
□ Inspect branch/archive refs relevant to the task
□ Read the current lane index and audit index
□ Declare allowed and forbidden files
□ Choose targeted iteration checks
□ Plan the final exact-head barrier
□ Separate source completion from production witness
```

## 9. Merge and cleanup

### Merge acceptance

```text
□ Actual diff matches declared scope
□ Exact PR head passed required checks
□ Review threads are resolved
□ Temporary automation is absent from the final tree
□ Production is not claimed without an exact deploy/live witness
□ AuditRepo update is prepared when canonical status changed
```

### Branch disposition before deletion

Inspect actual content, not only merge status:

| Classification | Action |
|---|---|
| Fully present in `main` | Safe to delete after recording replacement SHA. |
| Trigger/probe/diagnostic only | Safe to delete when its intended result and cleanup are verified. |
| Superseded | Verify the replacement file-by-file, then delete or archive. |
| Unique evidence/prototype | Preserve in AuditRepo or an `archive/forensic-*` ref. |
| Selective recovery candidate | Keep/archive; rebuild only the justified delta from fresh `main`. |
| Unknown | Do not delete. Add to the forensic register. |

Never automatically run `git push origin --delete <branch>` immediately after merge without this disposition.

## 10. Current forensic lesson

The 2026-07-24 audit found `_temp-gill-source-marathon-orchestrator.yml` still on `main` after its owning transaction, with `contents: write` and a call to a deleted script. It also found useful closed heads that were not represented in `main`. The permanent control-plane audit and archive-ref procedure exist to prevent both failure modes.

The previous policy remains in Git history at blob `d49ffa0887eabbf39f0dcba8212d7b11c06dd8b2`; its direct-main FAST permission and unconditional branch-deletion recipe are retired.
