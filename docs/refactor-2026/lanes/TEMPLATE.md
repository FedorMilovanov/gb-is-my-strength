# Lane Report Template

Скопируй этот файл в `docs/refactor-2026/lanes/<lane-name>.md` и заполни.

---

# Lane Report: `<lane-name>`

**Branch:** `lane/<name>`
**Mode:** FAST / LANE / SYSTEM
**Scope:** `<route или task>`
**Status:** active / review / blocked / stale / merged / abandoned
**Owner:** `<agent>`
**Started:** `YYYY-MM-DD`
**Updated:** `YYYY-MM-DD`

---

## Changed files

- `src/...`
- `docs/...`
- `scripts/...`

---

## Checks

### FAST loop during iteration

- [ ] `git diff --check`
- [ ] `npm run guard:shared-files`
- [ ] `npm run data:consistency` (если менялся контент/search/series)
- [ ] `npm run migration:metadata:check` (если менялись route/profile/matrix contracts)
- [ ] `npm run native:runtime:audit:strict` (если refactor/runtime mode)
- [ ] targeted route/content audit: `<command>`
- [ ] `npm run workflows:check` (если SYSTEM/workflows/package scripts)

### FULL barrier before commit/merge/push

- [ ] `npm run validate:static-publication`
- [ ] `npm run guard:shared-files`

If FULL barrier cannot run in sandbox, record the exact blocker and whether CI/owner must verify.

---

## Out-of-lane findings

- `<file>`: `<problem>`
  - Suggested lane: `lane/<name>`
  - Not fixed in this lane.

---

## Merge recommendation

`merge` / `no merge` / `blocked by <lane>`

---

## Rollback

Commit: `<hash>`
Branch: `<branch>`
