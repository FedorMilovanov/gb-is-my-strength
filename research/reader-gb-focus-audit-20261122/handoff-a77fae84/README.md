# Native part↔series modal handoff / focus / unlock baseline

Tested exact Product **a77fae8467cc787e2f976533dec3a6fbdea5cc2a**, fresh isolated archive.0 changed tracked source blobs, no earlier candidate patches or CSS/JS injection. Astro→copy-legacy --omit-build-only --no-manifest→cache-bust READ-ONLY build PASS. Only diff from prior22811811 is test-only external Metrika isolation in W57 two-tab contract; THIS receipt does not execute or accept that two-tab test. Comments read through258, HEAD same at pre-post read. Draft/HOLD retained.

## New bounded coverage

Sibling `../overlay-handoff-repro.mjs` executes actual native keyboard modal transitions, not link navigation. Chromium153, normal-motion preference, SW blocked, light; GillII and Baptist dva-sezda-1884 ×390×844/568×320/1120×800 =6 independent contexts. Touch/isMobile only below600;1120 is desktop-width native context, not a phone emulation. No resize or stored-position restore scenario.

**84/84 assertions exit0** (14×6); raw all states in handoff.json.

1. Real wheel scroll article to1500px. Focus mobPartTocBtn once, Enter opens part TOC with focus INSIDE and only one aria-visible modal.
2. Tab to backToSeries, Enter transfers sole modal/focus ownership to series. Tab to current .toc-item, Enter returns to part (no pathname/hash navigation needed). Repeat full round trip TWICE. At each checkpoint exactly one modal aria-hidden=false, focus inside its owner; no hidden dual modal ownership.
3. Escape closes all; native mobPartTocBtn owns focus and is visibly laid out, viewport-intersecting, non-inert/non-hidden. No hidden series-link focus or body fallback. Article remains1500px, not jumped to top.
4. Real wheel450px on article moves1500→1950 in every context, proving page scroll actually unlocked rather than assuming from a body style string. Records body/html overflow and main inert for diagnosis without pretending one CSS property proves interactivity.
5. Separate terminal path: reopen part→back to series→Escape DIRECTLY from series. All modals closed and visibly usable mobPartTocBtn restored again.
6.0 page JS errors in all6 contexts.

This is a retained working baseline the executor must preserve during marker/focus/satellite integration. No Product fix created. Source probe supports BASE_URL/OUTPUT_DIR and optional PLAYWRIGHT_PACKAGE_JSON/CHROMIUM_PATH.

## Limits

The exclusive-modal check is at settled checkpoints after450ms; it is NOT a frame-by-frame proof of no transient double paint, no AT announcement/VoiceOver claim. It checks known Gill TOC/settings modal selectors, not unrelated site popovers. Wheel scroll is real browser wheel input, not touch-swipe acceptance. Focus visibility tests rectangle/hidden/inert/viewport intersection, NOT outline clearance or elementFromPoint occlusion. Short landscape still has separate row/outline/78px-control clipping; these84 can pass while that remains OPEN.

No dark/physical/WebKit/Firefox/W57 test in this receipt, no Play/TTS/rate, note concurrency, full canonical two-tab/CI, satellite/focus/marker repair or layout approval. Article scroll staying steady under a modal is tested only within one viewport/session, NOT resize/persistence/Back recovery owned elsewhere. W107, existing integration owner, release HOLD unchanged.
