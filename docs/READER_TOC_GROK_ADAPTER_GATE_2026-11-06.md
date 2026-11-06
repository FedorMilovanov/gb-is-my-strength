# Grok desktop reader: Stage 1 adapter and safe pilot boundary (2026-11-06)

## Scope and source authority

This is an **additive, read-only data projection**, not a new reader engine and not an enabled UI redesign.

- Product base: `main@717efc54772edf4224f44254651c102e2af24129` (merged Library V3 PR #2283).
- Design/handoff authority: `FedorMilovanov/AuditRepo/projects/gb-is-my-strength/prototype/grok-desktop-reader/v26/`, plus the earlier V23–V25 historical reference packages.
- Existing `SeriesConfig`, `partToc`, routes and rendered heading IDs remain authoritative.
- No shell, mobile, right SVG cluster, TTS, search, settings, library storage, overlays, scrollspy, print or Service Worker is modified in this lane.
- UI remains **unchanged**: no feature flag is enabled or even added in this first step.

## Added projection contract

`src/components/article-pilots/_shared/series/readerTocProjection.ts` exports:

- `projectSeriesReaderToc(config, activePageId, options?)`
- `projectStandaloneReaderToc(pageHref, headings)`

Data-only output includes immutable hierarchical nodes, unchanged historical hrefs, mark/short-title metadata and the active-page ancestor path. Book: chapter → article → H2/H3; Gill/flat: part/endpaper → H2/H3; standalone: H2/H3. An **optional strict DOM inventory** allows H4–H6 and rejects missing, duplicated or reordered canonical anchors. Do not silently build unseen sections from unrelated page bodies.

The projection deliberately excludes `tier:'satellite'` from desktop top-level navigation; the existing part accordion remains its owner. Only the active article's sections are projected in a book, avoiding eager assembly of every article's contents. Book H2 display labels call the canonical `sectionLabel()` helper rather than implementing a new title-normalization rule.

**Not owned here:** active heading scrollspy, URL/history listeners, keyboard controls, visual animations, localStorage, element positions and responsive breakpoints. Those will be integrated through existing readers during a separate guarded pilot.

## Verification and limitations

The source-level contract test `node scripts/reader-toc-projection-contract-test.cjs` bundles the real TypeScript instances in memory and checks:

- all six current Gill pages and ten published Baptist page configurations;
- Gill historic `#sec-gill-last-pages` anchor, introduction/reference marks and actual order;
- all four Baptist chapters and correct active-article ancestor paths;
- immutable original route/data arrays and one-article-only section hydration;
- H4–H6, duplicates, missing anchors, reorder, bad fragment encodings and invalid hierarchy fail-closed;
- satellite ownership and `sectionLabel()` policy on **synthetic fixtures**, without pretending those titles exist in current articles.

Additional gates run in the isolated source checkout: strict TypeScript compile, `node scripts/check-engine-contracts.js`, `node scripts/series-reader-facade-regression-test.js`. The Gill pre-v16 audit and Reader Library premium browser contract require an actual production-like `dist`; do **not** misclassify their missing-dist failures as regressions.

Library V3 original source E2E (against the same exact base):

- `reader-library-v3-browser-test.cjs`: **8/8 Chromium/WebKit**;
- `reader-library-v3-progress-test.cjs`: **2/2 Chromium/WebKit**;
- `reader-library-browser-test.cjs`: **6/6 Chromium/Firefox/WebKit**;
- `reader-library-premium-browser-contract.cjs`: **not run to completion** in the isolated source-only checkout because it serves `dist`, absent there. Must run on production-like build for UI pilot.

No confirmed Library V3 defect was reproduced. Do not patch its core or localStorage on suspicion.

## Stage 2 (NOT part of this PR): reversible real desktop pilot

1. Recheck current Product head, open PR ownership (print #2269, deps #2268 at this anchor), exact deployed release SHA, `LANE_LOCK_POLICY.md`, AuditRepo MASTER and V26 notes.
2. Capture immutable baseline on **actual** Hermeneutics standalone, Gill historical/part, Baptist article and an unrelated control: same viewport, theme, open/closed, scroll position, active heading, H2/H3, original Gill vertical leather `ВВЕДЕНИЕ`, all four right-side SVGs, existing menu/settings/TTS/library/search and printed A4.
3. Add **one desktop-only component** inside the existing reader rail owner, behind a *narrow* reversible route flag. Keep old markup. Do not create a second search, TTS, library or scroll/event system.
4. Reuse existing `GBReaderPreferences`, `GBSearch`, `PlayEmber`, `GBReaderLibrary` V3, `SiteSectionsMenu`/overlay and ReaderState owners. Only adapt presentation, with theme tokens per series independent of Day/Sepia/Night. Preserve current site breakpoints; do not transplant prototype breakpoints.
5. Mandatory pilot cross-browser matrix: Chromium + WebKit + Firefox, 320/390 mobile **no-change**, 781×300, 900×300, 900×480, 1024, 1480, 1920; full/collapsed; reduced motion; 130% font; rapid reversals; anchored popovers; keyboard focus/inert; Back/Forward including bare URL; source/DOM anchors; scroll position; exact text-axis rectangles; genuine Library V3 save/status/reload/import, and 4 vertical SVGs.
6. Run canonical production-like Astro/dist pipeline and Gill pre-v16/Library premium/print/Pagefind/SW contracts on exact candidate head. Compare pre/post screenshots; do not merge on standalone HTML Chromium evidence.
7. Roll back by disabling only the pilot flag; preserve merged Library V3, print fixes and unrelated branches. Retire old CSS only after consumer inventory = zero.

**Stop-ship:** renamed/missing historical anchor; broken Gill legacy ribbons or numbering; unapproved mobile diff; second scroll/overlay/search/TTS/storage owner; WebKit horizontal overflow or axis shift; invisible focused subtree; unreadable short window; Library V3 data/progress loss; false global-vs-book search; missing release/build proof.
