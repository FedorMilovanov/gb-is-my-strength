# Search source/fallback independent receipt

Exact Product SHA **52782ce400d988b78f9b6ef2827f84f828fef3ad**. Isolated git archive at /tmp/reader-gb-527/product; Astro112 pages, canonical legacy copy/postbuild (explicit GB_BUILD_INSTANT from commit timestamp), real Pagefind103 pages/28838 words. Unchanged preview.py Handler on8500; cache-bust read-only PASS, handoff unit7/7 PASS. All3758 tracked blobs/symlink match exact SHA after build. Product not patched.

**22/22 browser checks PASS**. Chromium only, two fresh contexts:390×900 native touch and1440×900 genuine W57, light/reduced-motion/SWblocked. Ordinary desktop URL ?paper=space&panel=open, no opt-in; actual np-w57-ready verified. Gill II route `/articles/dzhon-gill-chast-2-uchenyi/`.

Each context uses actual topbar search and actual Pagefind results; input/ArrowDown/Enter selects GillII. Same-context sequence: `беспрецедентным` → `беспрецедентный` → `беспрецедентным`. Before repeat search, actual article-centre mouse wheel upward reveals header; no force-click, injected visibility or disabling auto-hide. Real search results and6 landings recorded in fallback.json. `audit-search-events` is observer-only sessionStorage recording, not Product state injection.

| viewport | exact focus/top/scrollY | lemma focus/top/scrollY |
|---|---|---|
|390|P /279.69 /5517|H1 /72.06 /236|
|1440|P /519.56 /3743|H1 /132.08 /485|

Both exact landings select literal word and emit source-focused; lemma is absent literally, empty selection, H1 focus and fallback event reason literal-occurrence-not-found/fallbackFocused=true. All6 pending entries consumed, surface retained, one quiz. Reload after final exact does not replay a consumed event. Zero uncaught page errors. Screenshots are lemma landing evidence, not global visual acceptance.

Narrow closure of my7104291402 finding on64ea5d5f: no longer BODY/article-top with unresolved pending. The accepted implementation is **honest article-level fallback**, NOT precise morphological source location. Repeated occurrences, full source semantics, all routes/themes, WebKit/Firefox/AT/physical devices and landscape are not covered; global Reader controls CI/Draft/HOLD not cleared. Does not supersede other agents' geometry/notes/print/SYS ownership.

Reproduce:
```
PLAYWRIGHT_PACKAGE_JSON=/tmp/arena-browser/package.json CHROMIUM_PATH=/tmp/chromium LD_LIBRARY_PATH=/tmp/arena-browser/libs/lib BASE_URL=http://127.0.0.1:8500 OUTPUT_DIR=/tmp/search-fallback node research/reader-gb-focus-audit-20261122/search-fallback-repro.mjs
```
