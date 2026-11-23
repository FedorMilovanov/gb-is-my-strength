# 68-route normal-motion A/B of combined TOC candidates

**Tested source:79ad7c941f07a81e4a976217845a347f8e29a3e5**. NOT current-head acceptance: PR moved to2c11c550ac00bcfbdad0cd8c224de2902bb05988 during execution, comments read through240 including owner's satellite acknowledgement. New269px bar/test changes NOT tested in this receipt. No release or integration claim.

## Construction and execution

Fresh separate Git archives of79ad7c94 baseline and candidate; baseline0 changed tracked blobs. Candidate applies the EXACT existing `focus-candidate/native-anchor-focus-f908e289.patch` THEN `marker-candidate/exact-location-25830c64.patch` from this research directory, apply-check before each apply. Both clean without manual edits. Manifest records resulting four tracked-file changes (overlay/controller/asset helper/SW literals), not a wholesale checkout or copied Gill-context markup. Input patch digests remain in combined-candidate/manifest.json. No satellite fix or inline landscape CSS, no source parser or browser Product-code injection.

Both Node24 Astro→copy-legacy --omit-build-only --no-manifest→cache-bust READ-ONLY builds PASS. Candidate served8491, baseline8492. Existing research dependency node_modules symlink only; no Product root or PR branch edited.

`../route-sweep.mjs` extended to:
- separate nonempty local-TOC presence from target uniqueness (previous initial diagnostic combined the two);
- set REDUCED_MOTION=no-preference for both runs;
- after real Enter + settled scroll, reopen native TOC and compare unique aria-current=location against live ReaderState section, or require no location marker if that ID has no local authored row.

Three workers, independent fresh context for every route. **Chromium153,390×844 native mobile/touch, light, SW blocked, normal-motion preference.** Driver samples100ms and requires6 stable intervals after250ms, bounded6s; no fixed500ms assumption for long smooth scrolls. Hash and exact focus asserted separately. This tests normal-motion user preference (not a claim every authored route uses smooth CSS). All68 route executions completed without JS errors. No render/heading replacement or feature rollout.

```sh
BASE_URL=http://127.0.0.1:8491 \
DIST_DIR=/tmp/reader-gb-w114/candidate/dist \
REDUCED_MOTION=no-preference OUTPUT_DIR=/tmp/reader-route-sweep \
node research/reader-gb-focus-audit-20261122/route-sweep.mjs
```

Optional PLAYWRIGHT_PACKAGE_JSON/CHROMIUM_PATH for sandbox browser. Test exit1 intentionally retained for2 satellite failures; not hidden/skipped/waived. Baseline exit1 as well.

## Results (same source, same updated probe)

| assertions / evidence | baseline | combined candidate |
|---|---:|---:|
|route count|68|68|
|local href count, all uniquely resolved|814|814|
|real keyboard first/last local-anchor samples|132|132|
|exact target owns focus|0/132|**132/132**|
|reopen marker accurately reflects LIVE represented/unrepresented section|32/132|**132/132**|
|native hash matches after settled navigation + panel closed|132/132|132/132|
|keyboard reaches boundary link|132/132|132/132|
|current-page aria list preserved on reopen|132/132|132/132|
|Escape restores opener|132/132|132/132|
|total assertions (overlapping)|898/1132|1130/1132|
|probe exit|1|1|

132 samples = first and last local TOC href per each66 nonempty routes, not all814 links activated.8 samples have non-ASCII/Cyrillic destination IDs, exercising URI decoding.100 samples have live ReaderState section represented by a local row (candidate one exact location);32 have unrepresented live section (candidate no unrelated exact marker). This is not an assertion every clicked target always equals ReaderState section: e.g. near article end or non-heading boundary the live reading section differs. Candidate marker explicitly follows actual reading state, while focus follows clicked authored target. Neither is papered over as the other.

Marker check on baseline intentionally finds no aria-current=location for100 represented reading sections.32 unrepresented cases already have no location marker and pass; do NOT read32/132 as baseline has32 working dynamic markers. Current-page preservation compares BEFORE/AFTER only, not independently correct identity. These are semantic checks, not screenshot geometry assertions.

## Still red and what NOT to infer

The only failures in THIS bounded candidate sweep are **2 local-TOC presence assertions** on previously reported Enoch corpus/audit satellites. Local rows remain absent; parent-only hrefs cannot be fixed by marker/focus logic. Their previous screenshots/source analysis in w112-route-sweep remain the handoff; owner acknowledged in7089052308. No repaired satellite claim.

1130/1132 does NOT mean only2 Reader bugs remain: this390px test does not assert clipping, outline clearance, short-landscape78px group controls,269px bar, Play hit tradeoff, notes/Scripture, cold PDF, concurrency, zoom/AT or complete CI. No Night/WebKit/Firefox/physical/W57 acceptance here, and no resize-persistence lane. Permanent typed browser contracts/integration/revision regeneration belong to executor/shared-asset owner. Four source files are unintegrated candidates, not a Product release. Protected W107/Draft/HOLD unchanged.
