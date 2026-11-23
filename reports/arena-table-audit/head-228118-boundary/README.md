# PR #2352 `228118112` — independent boundary, table and cold-print follow-up

2026-11-22 · exact head `228118112196bd6a65c6a59d6670b91807e12931`, separate clean-source Astro build (112 pages) + legacy copy. Diff from independently tested `58fcd0c0`: only `scripts/reader-w57-browser-visual-qa.mjs`, no product sources. Source bootstrap `preview.py` is the same Git blob `68d76115491029ae34ec92658c79da2d27d28237`. At inspection PR #2352 Draft, #2346 head `62be8caa145fbe18aa099dff89cffa20cd626451`, main `c60b3347dc242b365a93290456601677bba5de8e`; this is **not** a merge candidate or conflict-resolution verification. Owner [W117 directive](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2352#issuecomment-7089647252) says maintain HOLD and test actual native/W57 boundary; new head's contract changed that exact boundary.

Chromium 153, Playwright, service workers blocked, reduced motion for boundary, static dist on :8083, actual `research/reader-w57-pilot/preview.py` on :19061. The browser QA below is an independent narrow probe, not a run/pass of the repository's entire `reader-w57-browser-visual-qa.mjs`; Firefox/WebKit, native print UI, physical devices, full visual/AT and CI are not covered.

## Native / W57 boundary

Route `/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space`. [Raw measurements](w57-boundary.json), [asserting probe](w57-boundary.mjs).

| width | `np-w57-ready` | annotations ready / notes | pilot runtime scripts | overflow | independently exercised |
|---|---|---|---|---|---|
| 390 | false | false / 0 | 0 | 0 | native TOC and Settings open/Escape; exposed speed point opens; Play centre hit |
| 1120 | false | false / 0 | 0 | 0 | same native checks |
| 1121 | true | true / 1 | 2 | 0 | readiness only |
| 1440 | true | true / 1 | 2 | 0 | readiness only |

HTTP 200 and no page JS errors on all four. Mobile/tablet checks use real Playwright click/mouse and keyboard Escape, not a speech-engine test. At desktop widths `controls` keys reflect native controls being hidden/reparented and are **not** a claim desktop Play/TOC interactions were tested. No boundary resize/reload, W57 editor/selection, screenshots, non-reduced motion, browser zoom, WebKit or negative-control mutation. Before correctly waiting for TOC to open and close, an exploratory script produced false negatives/race; the saved probe waits for actual visible/hidden state and passes.

## #577 Gill tables — 320

Native Reader, `/articles/dzhon-gill-istoricheskiy-kontekst/`, 320×844, direct A4 CDP PDF, no pre-emulated print. Chronology has 8 rows / 24 cells; comparison 5 rows / 15 cells. Wrapper client/scroll 246/246, document 320/320; all 39 complete cell texts found after whitespace normalization in 28-page PDF. Chronology headings `Событие/Что менялось` extracted on pages 5 and 6; comparison headings `Партикулярные/Генеральные баптисты` on pages 7 and 8. [Screen/AX/75 Tab results](gill-table-320.json), [probe](../head-58f-visual-evidence/gill-320-probe.mjs). These are static tables without interactive descendants; 0 tab stops inside is not a screen-reader or keyboard accessibility signoff. Actual visual page renders were made on `58fcd0c0` and are not relabelled as fresh `228118112` images. Additional tables, routes, AT and print layouts remain open.

## #2349 cold PDF — unchanged failure

`/articles/anatomiya-padeniya-pyat-stadiy/`, 320 and 390 × direct and Reader-button stub × two fresh contexts each, two CDP PDFs/context, no print emulation. The complete final article paragraph was matched to DOM text extracted on `58fcd0c0` (product source unchanged) after whitespace/case normalization in **16/16** PDFs. First PDFs at both widths: 12 pages, author/SDG/accuracy body missing 8/8. At 320 both repeated copies also miss them (4/4); at 390 repeated copies are 13 pages with asserted closing text (4/4). [Checker output](cold-pdf.txt), checker exit 1. A click is not a native dialog: `window.print` is stubbed and dispatches synthetic `beforeprint`; direct path separately uses `page.pdf()`. This verifies no fix on this SHA under the CDP scenario, not actual Chrome Save as PDF.

Owner action remains: preserve existing summary-card keep-together behaviour while resolving content loss, verify same scenario red/green and real browser print, include font-error/timeout and restore. The prior CSS override is diagnostic only and visibly splits the card. No product or owner PR changes, no claim #2349/#577 resolved.

## Reproduce

Serve the exact build through its preview.py with `READER_W57_DIST` and `READER_W57_PORT=19061`; install compatible Playwright Chromium and Python pypdf. Run `CHROMIUM_EXECUTABLE=/path/to/chromium node reports/arena-table-audit/head-228118-boundary/w57-boundary.mjs`. `W57_BASE_URL` and `OUTPUT` are optional. The table probe linked above writes local `/tmp` output; for cold PDF, run [capture](../cold-pdf-regression/capture.mjs) with `RUNS=2` then [check.py](../cold-pdf-regression/check.py); baseline expected exit 1.
