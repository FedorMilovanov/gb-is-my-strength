# Lane Report: `nagornaya-componentization`

**Branch:** `lane/nagornaya-componentization`  
**Mode:** LANE  
**Scope:** Разбить `/nagornaya/chast-2..5/` на named Astro section components (HeaderHero + ArticleBody + SectionI..X/XIII + SectionQuiz + PostContent).  
**Status:** review  
**Owner:** Arena Agent  
**Started:** 2026-06-23  
**Updated:** 2026-06-23

---

## Changed files

- `src/pages/nagornaya/chast-2/index.astro`
- `src/pages/nagornaya/chast-3/index.astro`
- `src/pages/nagornaya/chast-4/index.astro`
- `src/pages/nagornaya/chast-5/index.astro`
- `src/components/nagornaya/chast-2/*` (HeaderHero, ArticleBody, PostContent, SectionSummary, SectionI..X, SectionQuiz)
- `src/components/nagornaya/chast-3/*` (same pattern)
- `src/components/nagornaya/chast-4/*` (same pattern + SectionXI..XIII)
- `src/components/nagornaya/chast-5/*` (same pattern)
- Deleted: `NagornayaChastNMainShell.astro` and `_legacy/main.html`, `_legacy/body-segment-0.html`, `_legacy/body-segment-1.html` for chast-2..5.
- Updated `scripts/nagornaya-visual-parity-audit.js` to accept named per-page components instead of requiring NagornayaPageMain for all pages.

---

## Checks

- [x] `npm run guard:shared-files`
- [x] `npm run data:consistency`
- [x] `npm run validate`
- [x] `npm run nagornaya:visual-parity:audit`
- [ ] `npm run validate:static-publication` — cannot run locally because Astro build requires Node >=22.12.0 (sandbox has Node 20.20.2). Will be verified by CI on GitHub Actions with Node 22.

---

## Out-of-lane findings

- `src/components/nagornaya/index/`, `src/components/nagornaya/seriya/`, `src/components/nagornaya/istochniki/`, `src/components/nagornaya/nakhodki/` still use `NagornayaPageMain` (shared) or `MainShell`. Not fixed in this lane.
- `nagornaya/tw.min.css` and `nagornaya-mobile-toc.css/js` still separate. Lane `nagornaya-css-unification` recommended.
- `loadLegacyFullDocument` still used for `<head>` in all Nagornaya pages. Lane `system-astro-head-native` recommended.

---

## Merge recommendation

`merge` after CI `validate:static-publication` passes on GitHub Actions (Node 22).

---

## Rollback

Commit: `906c0bf`  
Branch: `lane/nagornaya-componentization`
