# Candidate: native TOC anchor focus, separate from dismissal

**Not integrated / not owner-approved.** Base Product SHA `f908e289e59b423f98d129b20552e6d6d3092b04` (W109). The research branch contains a patch artifact, not a Product implementation commit based on this SHA. Do not cherry-pick the whole research branch.

## Scope

`native-anchor-focus-f908e289.patch` changes two logic files:

1. `GillPartTocOverlay.astro`: plain unmodified left-click/Enter on an existing same-document section link requests `gb:gill-navigation-close`; native browser fragment navigation remains responsible for scrolling. In the next animation frame it focuses the verified-ID destination with `preventScroll`, temporarily adding tabindex=-1 only when absent, and removes its own temporary attribute on blur. Existing authored tabindex is preserved. Missing-target behavior falls back to previous close; modifier/default-prevented actions are not intercepted by this handler.
2. `js/floating-cluster-controller.js`: the EXISTING part-sheet owner handles that scoped cancelable request, closes with reason `navigate`, restoreFocus=false, and acknowledges handling via preventDefault. No second modal/scroll owner, global capture-click handler, or new persistence state. Escape/Close/Continue paths are unchanged. Legacy absence of this handler falls back to the prior close helper.

Two additional source references are synchronized to the actual changed controller MD5 prefix41284ba0: its entry in `src/lib/asset-version.js` and its literal in `sw.js`. No global SW/cache revision or unrelated asset literal changed. These are necessary to BUILD a non-stale candidate, not permission to overwrite the asset owner's current tree. The first isolated revision check correctly refused stale sw.js; after that single literal was updated and the helper synchronized, READ-ONLY cache-bust passed. On any merged controller, regenerate actual hash; never retain this hash blindly. #2348/controller/SW ownership must be reconciled by the main executor.

No CSS, typography, marker state, native hash replacement, scrollIntoView/scrollTo code, TTS, ReaderState or W57 assets are edited. The marker candidate from the adjacent directory is NOT included. Short-landscape layout is NOT changed.

## Build and patch check

Separately archived/built exact W109 baseline, ran focus probe, then edited the isolated source, synchronized only the two needed revision references and rebuilt Astro → copy-legacy publication → READ-ONLY cache-bust. Build and final guard PASS. JS syntax check PASS. A complete tracked-file comparison against the base lists exactly the four patch files. `git apply --check` passed against separately materialized exact-base originals.

Apply only after checking the executor's current SHA/diff/collision map:

```sh
git apply --check /path/to/native-anchor-focus-f908e289.patch
git apply /path/to/native-anchor-focus-f908e289.patch
```

## Repro commands

`../focus-repro.mjs` supports BASE_URL, OUTPUT_DIR and the same optional PLAYWRIGHT_PACKAGE_JSON/CHROMIUM_PATH as earlier probes.

```sh
BASE_URL=http://127.0.0.1:8480 OUTPUT_DIR=/tmp/focus-gill \
node research/reader-gb-focus-audit-20261122/focus-repro.mjs

BASE_URL=http://127.0.0.1:8480 OUTPUT_DIR=/tmp/focus-book \
ROUTE=/baptisty-rossii/dva-sezda-1884/ \
ANCHOR_IDS=baptism-as-boundary,police-intervention \
node research/reader-gb-focus-audit-20261122/focus-repro.mjs
```

The server must serve YOUR separately built dist, not an older preview. Each fixture uses four independent fixed viewport contexts:390×844,568×320,640×360,844×390. Chromium153, mobile/touch emulation, reduced-motion, SW blocked, no Product JS injection, storage edits, forced click or viewport resize. Explicit keyboard start at opener, then Tab/Enter/Escape; scroll settling requires six consecutive100ms intervals after action start. Tests record both final focus and all focusin events, plus canonical overlay-close reasons.

## Executed results

- **Exact baseline GillII:28/52 PASS, exit1.** For H3sec-canticles and H2sec-quiz across four sizes: final focus at opener, transient opener focus present, close reason handle. Native landing, temporary-attribute baseline, Escape/Close/Continue controls pass.
- **Compiled focus candidate GillII:52/52 PASS, exit0.** Same tests unchanged. Final focus EXACT destination heading; no transient opener focus; canonical close reason navigate; hash/settled visible target correct; temporary tabindex restored after next Tab; Escape/Close/Continue keep prior opener-return behavior.
- **Compiled focus candidate Baptist book:52/52 PASS, exit0**, source H2baptism-as-boundary and H2police-intervention, same four viewports. This is candidate-only coverage, not a separately executed baseline A/B on that route.
- **Existing broad68-check probe on focus candidate:55/68 PASS, exit1.** Four anchor-focus failures are gone. Twelve static marker failures and one568×320 clipping failure remain visible. Not a complete Reader acceptance and not combined with marker patch.
- Additional same-route Day/Night candidate smoke at390×844 and1440×900 using real unchanged preview.py Handler (only bind wrapper), `?reader-pilot=1&paper=space`: native mobile remains native; desktop has body.np-w57-ready; all four contexts have zero JS page errors/document x-overflow. It is NOT full W57 visual before/after acceptance.

Raw JSON in this directory preserves all observations (compact encoding). Tests are source links in the parent directory. No fresh WebKit/Firefox/physical device/AT, all-renderer-route, nested-lock/resize, Back/noJS or complete W109 invariant acceptance. Main executor must run permanent contracts, asset-owner reconciliation and protected surface gates before adoption. Do not equate52/52 focused checks with release approval.
