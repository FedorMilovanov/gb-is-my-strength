## Purpose

<!-- One verifiable result. -->

Closes #

## Transaction

- Mode: `FAST | LANE | SYSTEM`
- Execution: `LOCAL_WORKTREE -> REMOTE_PR | DETACHED_PROMOTED -> REMOTE_PR | RECOVERY`
- Canonical branch:
- Owner:
- Base / rollback SHA:
- Dependencies / active adjacent PRs:
- Successor of: `none | PR #... at SHA ...`

## Exact scope

### Allowed files

```text
```

### Forbidden files

```text
```

### Protected surfaces touched

- [ ] none
- [ ] governance / workflows
- [ ] shared runtime / layouts / CSS / JS
- [ ] migration / registries / shared data
- [ ] deploy / service worker / publication
- [ ] owner-sensitive content or UI

## Source of truth

<!-- Current files, exact SHA, owner decision or verified sources. -->

## Change

<!-- What changed and why. -->

## Parallel-agent safety

- [ ] I inspected open PRs and known active branches for file overlap.
- [ ] I did not reset, rebase, force-push, close or delete another owner’s branch.
- [ ] Out-of-scope findings were recorded separately.

## Verification

### Iteration

```text
command -> result
```

### Exact-head CI

- Head SHA:
- Required checks:
- Run IDs / artifacts:
- Failed or unavailable checks:

### Production witness

- [ ] Not claimed by this PR
- [ ] Exact deployed SHA and live evidence recorded

## Decomposition decision

- [ ] Within 20 files / 1000 changed lines / 3 protected subsystems
- [ ] Larger transaction justified below

Why this cannot be split:

Independent rollback units and review order:

## Branch disposition

After merge or close:

- [ ] active branch remains protected until owner decision
- [ ] merged branch may be deleted after recorded verification
- [ ] closed-unmerged forensic review required
- [ ] unique evidence materialized at:
- [ ] predecessor replacement table recorded

## Final assertions

- [ ] Actual diff matches declared scope
- [ ] No temporary workflow, trigger, writer or patcher remains
- [ ] Review conversations are resolved
- [ ] No green claim relies on an earlier SHA
- [ ] No publication claim is inferred from source merge alone
