# TOC / Analytics keyboard isolation non-regression

Exact Product base f908e289e59b423f98d129b20552e6d6d3092b04, unchanged isolated dist8482 vs fresh compiled combined marker+focus dist8483 (construction/patch digests in ../combined-candidate/manifest.json). Neither source was modified for this probe. This is an existing PASS retained, not a newly fixed bug or owner acceptance.

Route /articles/dzhon-gill-chast-2-uchenyi/, Chromium153 touch/mobile emulation, reduced motion, SW blocked,390×844 and568×320, light/dark (clean context each). Both baseline and combined **40/40 exit0** (10 assertions×4 contexts). Counts describe assertions, not unique routes or full Reader acceptance. The identical16-step Tab cycles are raw in baseline.json and combined.json.

Procedure, executed through real keyboard except explicit initial opener focus:

1. Enter native part TOC, Tab to TOC tab, End selects/focuses Analytics; aria-selected and roving tabindex update. TOC panel is hidden+inert, Analytics visible+not inert.
2. Tab to the first real Analytics details summary; Enter expands it. With dynamic content expanded, Tab to Close, Shift+Tab wraps to PDF, Tab wraps back to Close.
3. Return to Analytics tab;16 Tab presses traverse a complete focus cycle, including visible research descendants, footer and Close, back to the active tab. Every stop stays inside dialog and outside hidden/inert TOC. These are focusability checks, not painted-visibility checks.
4. Home returns focus/selection to TOC, swaps hidden+inert correctly; ArrowRight returns to Analytics.
5. Escape, separate Close/Enter and separate Continue/Enter from Analytics each close and restore mobPartTocBtn. No page JS errors.

Reproduce using ../panel-keyboard-repro.mjs with BASE_URL and OUTPUT_DIR; same optional PLAYWRIGHT_PACKAGE_JSON and CHROMIUM_PATH as sibling probes.

**Limits:** only first details expanded, not every Analytics subgroup/action. No Analytics.jumpTo/notes/Scripture navigation claim, no WaveD patch present, no physical keyboard/AT/WebKit/Firefox or safe-area evidence. Day/Night here checks behavior, NOT screenshot or contrast acceptance. Landscape keyboard-reachability does NOT cure the separately reported clipped row/outline/78px group-control allocation; no CSS/geometry was changed or newly approved. Desktop W57 smoke remains the separate combined-candidate receipt, not this mobile test. No resize/persistence tests. Draft/HOLD and integration/asset-owner obligations remain unchanged.
