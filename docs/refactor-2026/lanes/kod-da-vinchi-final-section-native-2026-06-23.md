# Lane Report: `kod-da-vinchi-final-section-native-2026-06-23`

**Branch:** `lane/kod-da-vinchi-final-section-native-2026-06-23`  
**Mode:** LANE  
**Scope:** `/articles/kod-da-vinchi/` — remove final raw article section fragment after audit compatibility restore  
**Status:** review  
**Owner:** Arena Agent  
**Started:** 2026-06-23  
**Updated:** 2026-06-23

---

## Changed files

- `src/components/article-pilots/kod-da-vinchi/KodDaVinchiArticleBody.astro`
- `src/components/article-pilots/kod-da-vinchi/KodDaVinchiSectionSummaryTitleAuto.astro`
- Deleted `src/components/article-pilots/kod-da-vinchi/_legacy/article-sections/20-summary-title-auto.html`
- Comment-only cleanup in Kod component headers to remove stale `_legacy` / `?raw` wording.

This branch is based on `lane/kod-da-vinchi-audit-compat-2026-06-23`, so it also includes the audit-compat restore commit that makes `astro:audit:article-mdx:strict` pass on current main.

---

## What changed

The final remaining raw visible content fragment for `/articles/kod-da-vinchi/` was promoted to a hand-authored Astro component:

```text
KodDaVinchiSectionSummaryTitleAuto.astro
```

`KodDaVinchiArticleBody.astro` now imports this component directly and no longer uses:

```text
summaryHtml
<Fragment set:html={summaryHtml}>
import.meta.glob('./_legacy/article-sections/*.html')
_legacy/article-sections/*.html
```

Result: all 20 visible Kod Da Vinci article-body sections are Astro components. The route still keeps legacy `<head>` via `loadLegacyFullDocument`; that is a separate future head-native lane.

---

## Checks

- [x] `npm run astro:audit:article-mdx:strict` — passed.
- [x] `node scripts/visual-parity-screenshots.js --routes /articles/kod-da-vinchi/ --threshold 0.5 --out reports/visual-parity-kod-final-section` — passed:
  - desktop `0.000%`
  - mobile `0.016%`
- [x] `npm run validate:static-publication` — passed.
- [x] `npm run guard:shared-files` — passed.

---

## Out-of-lane findings

- `/articles/kod-da-vinchi/` is not strict-native route yet because `src/pages/articles/kod-da-vinchi/index.astro` still uses legacy head/body attributes:
  - `loadLegacyFullDocument`
  - `headHtml`
  - `bodyAttributes`
  - `<Fragment set:html={headHtml}>`
- Suggested future lane: `lane/kod-da-vinchi-native-head-2026-06-23` or broader `lane/system-astro-head-native` if coordinated.

---

## Merge recommendation

`merge` after review. This is route-local, non-Gill, non-Nagornaya, and keeps visual parity.

---

## Rollback

Branch: `lane/kod-da-vinchi-final-section-native-2026-06-23`
