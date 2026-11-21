# Reader Mobile ARGON Classic — W61 verification frames

Eight JPEGs here are real Chromium mobile-emulation screenshots from the built local Reader (2026-11-21), not mockups: 320/390 CSS px, 1x DPR, light/dark, article Gill II #part-controversy. Four surfaces: Toc, Analytics, Library and Scripture expanded. Browser-profile data was isolated; no personal notes were accessed. Physical phones were not tested.

W61 quote-context fix: reader-library-dock.js now reuses GBReaderAnchors.visibleProjection plus the selected DOM Range. Latin s stays intact; hidden glossary tooltip prose is ignored; repeated text uses the selected occurrence. No old saved entries were silently rewritten.

W61 data-integrity fix: highlights.js refuses destructive delete of preexisting duplicate IDs; import/undo collisions preserve both versions through an explicit save-as-copy choice with new ID. Browser QA tested real Library actions in two tabs, Chrome and WebKit, for notes and quotes.

Independent checks: Great Eastcheap, 1729 году, second позволить, прежде вековых времён; two-tab import/undo; W60 mobile typography and desktop W57 guard, Node22 strangler:build. No production merge. Draft/HOLD.

Still open: same-page resume while locked, dynamic paragraph-ID relocation, repeated identical quote dedup, selection-toolbar note quoteId, W57 linked-note concurrency, physical phone QA.