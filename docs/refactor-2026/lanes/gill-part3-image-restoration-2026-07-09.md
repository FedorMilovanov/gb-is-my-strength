# Lane Report: `gill-part3-image-restoration-2026-07-09`

**Branch:** `lane/gill-part3-image-restoration-2026-07-09`  
**Mode:** LANE  
**Scope:** `/articles/dzhon-gill-chast-3-nasledie/` — restore figures omitted from native Astro source  
**Status:** review  
**Owner:** GPT-5.5 Thinking  
**Started:** 2026-07-09  
**Updated:** 2026-07-09

---

## Base and scope

- Current base / rollback point: `08d9fd1ed097f36a8ad0e3b0ff20eb48e3c080cf`.
- Branch was rebuilt on the latest `main` after Gill rail/progress changes landed.
- The intervening main commits changed shared Gill rail controls and numbering, not the Part III article body or its route shell.

## Changed files

- `src/components/article-pilots/gill-part3/GillPart3MainShell.astro`
- `src/components/article-pilots/gill-part3/GillPart3RestoredFigures.astro`
- `docs/refactor-2026/lanes/gill-part3-image-restoration-2026-07-09.md`

No binary asset, shared CSS/JS, layout, migration, workflow, package or shared-data file was changed.

---

## Deep image recheck

### Five-page inventory

| Page | Planned inline/body images | Current native source before repair | Result |
|---|---:|---:|---|
| Historical context | 8 | 8 | no loss |
| Part I — Человек | 6 | 6 | no loss |
| Part II — Учёный | 3 | 3 | no loss |
| Part III — Наследие | 3 | 1 | two confirmed omissions |
| Reference / Справочник | 1 | 1 | no loss; hero/inline duplication is separate |

Hero images are not included in these body counts.

### Confirmed Part III state

- `gill-transatlantic-map` remains in current native source.
- `gill-bunhill-fields` was absent from current native source.
- `gill-spurgeon-succession` was absent from current native source.
- Production still rendered Bunhill and Spurgeon from an older generation, grouped together under the later Spurgeon section; this was stale placement and source↔deployed divergence.
- Both original files and `600w` / `900w` WebP candidates exist.
- `1200w` candidates for Bunhill and Spurgeon do not exist and are not referenced.

### Visual/content assessment

- Bunhill is a tall 1024×1536 stylized engraving/reconstruction with a decorative memento-mori frame. It is not documentary evidence of Gill's actual funeral and must not be full article width.
- Spurgeon succession is a generic symbolic church/pulpit scene, not an identifiable portrait of Spurgeon and not a reliable architectural record of the Metropolitan Tabernacle.
- Captions therefore use `художественная реконструкция` and `символическая иллюстрация`, not categorical historical claims.
- Bunhill is capped at 460 px and uses `92vw` on narrow screens.
- Spurgeon uses the normal wide article treatment and `92vw` on narrow screens.

---

## Placement behavior

- Spurgeon is inserted after the paragraph beginning with `16 августа 1859 года` under `#sec-spurgeon-legacy`.
- Bunhill is inserted immediately after the paragraph containing both `Его похоронили на` and `Банхилл-Филдс`, before the Latin epitaph.
- Duplicate guards remove the route-local copy if either image is later restored directly inside the monolithic article body.
- Without JavaScript, both figures remain visible as a fallback after the article body rather than disappearing.
- The route CSP permits the inline placement script (`script-src 'unsafe-inline'`).
- The figures are far below the initial viewport, lazy-loaded, asynchronously decoded and have explicit intrinsic dimensions; they do not participate in LCP and do not shift the initial viewport.

---

## Checks

### Completed

- [x] Branch rebuilt on current `main` (`08d9fd1`).
- [x] Final PR diff restricted to declared route-local source files plus this report.
- [x] JPEG originals exist.
- [x] `600w` WebP candidates exist.
- [x] `900w` WebP candidates exist.
- [x] Missing `1200w` candidates verified and not referenced.
- [x] Current Part III source anchors verified directly.
- [x] Current production stale placement verified directly.
- [x] Inline script syntax: `node --check` on Node `v22.16.0` — PASS.
- [x] GitHub Actions Shared Files Guard run `28983785098` — PASS.
- [x] Strict shared/system-file guard inside that run — PASS.
- [x] actionlint inside that run — PASS.
- [x] PR is based on current `main` and has no source-file overlap with the intervening Gill rail changes.

### Environment limitation

A local repository checkout could not be obtained because the execution container has outbound GitHub DNS/network access blocked. Therefore these could not honestly be claimed as locally executed:

- [ ] `npm run validate:static-publication`
- [ ] `npm run native:runtime:audit:strict`
- [ ] production-like strangler build
- [ ] fresh branch screenshots at 390 / 768 / 1440

This limitation is explicit. The available GitHub PR checks, source/asset verification, CSP review, syntax check, anchor review and current-production comparison were completed instead.

---

## Merge recommendation

`merge after final PR-head Shared Files Guard passes`.

Post-merge requirements:

1. monitor the main deployment workflow;
2. verify the deployed Part III page contains exactly one Bunhill and one Spurgeon image;
3. verify Bunhill appears before the epitaph and Spurgeon inside its own section;
4. if deployment/build fails, revert the merge rather than leaving main broken.

---

## Out-of-lane findings

- Reference page repeats the five-volume shelf art as hero and immediate inline image.
- Several older Gill `srcset` declarations elsewhere remain malformed or overfetch on mobile.
- The large pastoral succession infographic remains difficult to read on mobile.
- Production/source identity remains a system-level concern outside this route lane.

These were not mixed into this restoration PR.

---

## Rollback

Commit: `08d9fd1ed097f36a8ad0e3b0ff20eb48e3c080cf`  
Branch: `lane/gill-part3-image-restoration-2026-07-09`
