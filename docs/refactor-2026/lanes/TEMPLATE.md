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

- [ ] `npm run guard:shared-files`
- [ ] `npm run data:consistency` (если менялся контент)
- [ ] `npm run validate:static-publication` (если перед merge)
- [ ] route visual audit, если есть
- [ ] `npm run workflows:check` (если SYSTEM lane)

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
