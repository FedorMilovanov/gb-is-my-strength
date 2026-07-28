## Purpose

<!-- One independently verifiable result. -->

Closes #

## Core transaction

- Mode: `FAST | LANE | SYSTEM`
- Lane / owner:
- Base / rollback SHA:
- Scope:
- Adjacent active PRs / overlap decision:
- Source of truth:

## Change

<!-- What changed and why. -->

## Verification

```text
command or check -> result
```

- Exact head SHA:
- Failed or unavailable checks: `none | ...`
- Production witness: `not claimed | exact deploy/live evidence`

## Safety

- [ ] Actual diff matches the stated scope.
- [ ] No other owner’s active branch was reset, rebased, force-pushed, closed or deleted.
- [ ] No expensive-to-reproduce work remains only in an unpushed worktree.
- [ ] No temporary workflow, trigger, writer or patcher remains.
- [ ] Review conversations are resolved before merge.

## Progress — only while useful

<!-- Update when status, scope, owner, blocker, handoff or readiness changes. Do not copy the head SHA after every push; GitHub already shows it. -->

- Status: `active | blocked | ready-for-review`
- Completed:
- In progress:
- Next:
- Blocker / handoff:

## Optional: decomposition, recovery or successor

<!-- Delete when not applicable. Numeric diff size alone is not a gate. Explain only when the change mixes rollback units, owners or purposes, or when recovering/replacing an older lane. -->

- Independent lanes or rollback units:
- Why this remains one PR:
- Predecessor / successor PR and head SHA:
- Unique material transferred, rejected or preserved:
- Final predecessor disposition:

## Optional: branch disposition

<!-- Delete when not applicable. Cleanup always follows evidence-backed classification. -->

- After merge or close:
- Replacement or evidence SHA:
