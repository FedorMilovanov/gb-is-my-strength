# Reader GB: native mobile section semantics, keyboard, short landscape

Audited Product SHA: `02c984111c6c45358da7aad435294baa84c5153e` (PR #2352, W105).
Route: `/articles/dzhon-gill-chast-2-uchenyi/`.
Date: 2026-11-22. Scope does NOT include resize/persistence (separate agent), W57 desktop, Nagornaya, or a redesign of approved controls.

## Build/surface

An isolated `git archive` of this SHA was built with Node 24.22.3:

```sh
node scripts/astro-cli.mjs build
node scripts/copy-legacy-to-dist.js --omit-build-only --no-manifest
node scripts/cache-bust.js --write
```

All three commands passed. Test base was a static server of that dist at port 8475. This is intentionally the **native mobile** surface: top bar display:flex, no `.np-w57-ready`, no pilot injection or query parameter. This is NOT a W57 desktop acceptance view. Browser: Chromium 153 (Playwright), mobile/touch emulation, reduced motion, isolated context per viewport, service workers blocked. No Product JS interception, storage writes by the test, or force-click. The script explicitly focuses the native opener as its keyboard starting point, then uses Enter/Tab/Shift+Tab/Escape. It scrolls the article without resizing.

## Reproduce

Use a Playwright installation and Chromium browser. Serve the exact built Product dist separately.

```sh
BASE_URL=http://127.0.0.1:8475 \
OUTPUT_DIR=/tmp/reader-gb/repro \
node research/reader-gb-focus-audit-20261122/repro.mjs
```

Optional environment variables for externally installed tools:
`PLAYWRIGHT_PACKAGE_JSON=/absolute/path/to/package.json` (the package whose node_modules contains Playwright), `CHROMIUM_PATH=/absolute/path/to/chromium`.

Exit status **1 is intentional on the audited SHA**: the probe completes all scenarios, writes results.json/screenshots, then fails on reproduced defects. It is not an acceptance test that has been made green by recording incorrect behavior as expected. A geometry tolerance of 1px is used for a fully painted row and 2px for heading landing.

## Executed results

Four independent fixed viewports: 390×844, 568×320, 640×360, 844×390. **51/68 assertions pass; 17 fail** across three defect categories:

1. **Static reading-section marker (12 failures: three headings × four viewports).** Navigate sequentially to represented H3 `sec-canticles`, H3 `sec-ordinances`, H2 `sec-quiz`, 200px into each. Before opening, verify `GBReaderState.getSnapshot().sectionId` equals that exact ID. Enter opens native TOC. Current series page remains correctly “Учёный” / Part II; series dialog correctly uses `aria-current="page"`. But `.gbat-sub.active` always points at `#sec-hebrew`; there is no `aria-current="location"`. Expected: separate current-page state and live reading-section state. These are three represented IDs on the SAME page, not an H2/H3 ancestor-label mismatch.
2. **Keyboard anchor loses destination focus (four failures).** In the dialog use Tab to `a[href="#sec-canticles"]`, Enter. Dialog closes, hash changes correctly; after six consecutive stable 100ms scroll intervals target is at y≈88px, under header. However focus is `#mobPartTocBtn`; next Tab goes to `#gb-hl-fab` (“Моя библиотека”), not destination content. Expected: anchor-navigation close transfers keyboard context to destination, unlike cancel/Escape which should return to opener. No assertion of an incorrect pixel landing.
3. **568×320 list clipping (one failure).** List viewport y216.484..241, height **24.515625px**, while focused target row is **34px** high. Only 24.515625px can be painted. Screenshot `landscape-568x320.png` captures the real focused row. Expected: short-height layout allows a complete list row plus visible focus; not a 24.5px slit. Keyboard can still reach/activate this link: do not report complete inaccessibility. At 640×360 list is58.515625px; at844×390 it is84.015625px. At390×844 it is469.90625px. The focused row at640 is33.515625/34px (within subpixel tolerance), so not counted as the same failure.

### Explicit passing controls

- Native mobile verified at all four viewports.
- Escape from each of the three section checks returns to opener.
- Shift+Tab from initial Close wraps to PDF; Tab wraps back to Close.
- Close activated by Enter restores opener.
- Back-to-series activated through Tab/Enter; current page has `aria-current="page"`; Tab/Enter on current page opens the part dialog without navigating away.
- Anchor lands correctly under sticky header after settling in all four viewports.
- Continue is reached by Tab, entirely inside viewport, Enter closes and restores opener in all four viewports. At568×320 its visible target is x284.90625/y254/w219.09375/h52. Close is x260/y49/w48/h28 (from preliminary geometry run); it is visible, but28px height is below the premium44px target, not automatically an AA violation.

## Bounded handoff, no Product patch

- `GillPartTocOverlay.astro` seeds `.active` from authored `row.current`; controller deliberately skips legacy `.toc-part-item` updates when `[data-gill-parts-nav]` exists. Add a live semantic-ID projection for this existing renderer, preserving current-page `.cur` / `aria-current=page`. When a live heading is omitted from the curated TOC, map only through verified hierarchy; do not compare labels or assume all H2/H3 have their own row.
- Anchor links currently call the generic handle click, which restores opener focus. Separate intentional navigation from dismissal: close without opener restoration, then focus verified heading (temporary tabindex=-1, preventScroll) when navigation settles. Preserve Escape/Close return semantics and canonical scrolling owner; do not add a second scroll engine or weaken the focus trap.
- For short landscape, bound any proposal to height-responsive allocation of the EXISTING sheet: do not remove approved actions/top or bottom bars. A repair must provide a full visible focused row and keep Close/Continue reachable; match same route/theme/viewport before/after. No alternate rejected composition is authorized.

No WebKit/Firefox/physical-device/AT run; no claim of full screen-reader or WCAG certification. No Product source patch, release approval, merge, or persistence validation included. Test/evidence commit only.
