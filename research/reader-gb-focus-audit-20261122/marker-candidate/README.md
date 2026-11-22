# Candidate: exact reading-location marker only

**Not integrated or owner-approved.** Base Product SHA: `25830c64e996a70c8e550fabb89911e37becc64b`. Research branch commit contains a patch artifact, NOT a Product-source commit and must not be mistaken for a branch based on this Product SHA.

`exact-location-25830c64.patch` changes only the inline script of `src/components/article-pilots/gill-series/GillPartTocOverlay.astro` (19 added lines). No CSS, typography, chrome, scrolling, persistence or W57 assets change. It reads the existing canonical snapshot on existing `gb:gill-sheet-open`, only when this overlay is actually open. It sets `.active` / `aria-current=location` on exact same-document section links and clears stale local location state when no exact row exists. It does NOT remove `.active` from current article route links or touch `.cur` / `aria-current=page`. No new observer, heading parser, persistent state or writer. Authored H2/H3 IDs, not visual `.h3` class or label equality.

**Deliberately conservative:** omitted headings have no exact row selected; it does not attempt an ancestor fallback because this renderer does not currently provide a verified ancestor association for every row. That policy needs owner confirmation before integration. It does not expand the curated list, redesign the fixed W107 sheet or fix keyboard destination focus/short landscape clipping.

## Apply for executor review

Use the executor's clean checked Product checkout. Confirm current SHA and reconcile if moved; do not overwrite current work or apply the entire research branch.

```sh
git apply --check /path/to/exact-location-25830c64.patch
git apply /path/to/exact-location-25830c64.patch
```

The first command passed against the isolated exact-base original file. Both baseline and candidate were independently compiled with Node24.22.3: Astro build → copy-legacy publication → cache-bust dist; all commands passed. Candidate dist is base plus ONLY this source edit, not browser response interception.

## Executed before / after on compiled pages

Run the published parent-directory probes against each separately compiled version, using BASE_URL and OUTPUT_DIR.

| probe | baseline | candidate |
|---|---:|---:|
| `hierarchy-repro.mjs` (390×844; GillII + Baptist book) |12/16, exit1|**16/16, exit0**|
| `repro.mjs` (390×844,568×320,640×360,844×390; GillII keyboard) |51/68, exit1|**63/68, exit1**|

The remaining five keyboard assertions fail for already reported issues: four anchor-focus returns to chrome, one568×320 clipped row. They are NOT fixed by this patch. Twelve represented H2/H3 marker checks now pass; omitted-heading unrelated marker is cleared; current book article page marker survives all three tested section positions. Positive no-resize keyboard/Close/Escape/Continue controls remain passing. This is not resize/persistence acceptance.

Comparison of JSON metrics: list viewport rectangle and Continue target rectangle are **exactly equal before/after** on all four sizes. Compiled after-candidate W57/mobile smoke on same GillII route with real `preview.py` Handler (only HTTP bind wrapped to0.0.0.0), URL `?reader-pilot=1&paper=space`: mobile390×844 Day/Night has native bar, no W57, and `#sec-ordinances[aria-current=location]` link; desktop1440×900 Day/Night has **body.np-w57-ready**, native top hidden. All four smoke contexts had zero page JS errors/x-overflow. Mobile sheet remains y126.609375/h717.390625 in both themes. This is only a W57 smoke, NOT a full before/after W57 geometry or final owner visual acceptance.

Raw baseline/candidate hierarchy, keyboard and candidate-smoke JSON are next to this README. Chromium153 only; no new WebKit/Firefox/physical device/AT run. Not all68 shared-renderer routes checked. Main executor must reconcile source ownership, run current permanent contracts, check exclusions/other families/desktop and obtain required acceptance; no blanket rollout or CI-green claim.

## Negative control

The exact unpatched build fails the same marker assertions that the compiled one-file candidate passes. Existing unrelated focus/layout failures stay visible in both reports. This prevents treating the patch as a green complete Reader repair.
