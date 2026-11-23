# #577 / #2349 — exact `58fcd0c0` visual and content follow-up

2026-11-22. Independent research for Reader print/table owner, **not** a product fix or merge approval. Read owner W117 instruction [#7089647252](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2352#issuecomment-7089647252) and adjacent updates: keep #2352 Draft/HOLD, protect W107+accepted fixes, verify full final paragraph and first/repeat cold PDF, examine summary-card break visually and check tables 320/header/keyboard/print. Other lanes (TOC, notes race, Play, W57 visual-contract ownership) were not changed or claimed complete.

Separate clean-source checkout of `58fcd0c06944ce067bc27b97b17a431945290782`, `node scripts/astro-cli.mjs build` (112 pages) and legacy copy; :8083. Diff from `030d2e066` affects Gill mobile bar touch action and a11y contract only. Playwright Chromium 153, A4, no pre-emulated print. PyMuPDF 1.27.2 rendered actual PDF pages for visual inspection; not a real printer, a physical phone, or native Chrome Save as PDF.

## #2349 — complete paragraph and card break

Re-ran [cold direct/button A/B](../print-summary-fragmentation/README.md), 3 fresh contexts × 320/390 × direct/button × first/repeat. Button test stubs `window.print` and dispatches synthetic `beforeprint`. **Baseline** first PDFs 12 pages and closing card/SDG/accuracy body missing in all 12 contexts; repeats at 320 still missing (6), at 390 present (6). [Full output](baseline.txt). Existing checker exit 1.

The *entire* final article paragraph (not only a phrase) was obtained from the live DOM and matched with case/whitespace normalized extracted PDF text in all 24 baseline PDFs and all 24 experimental PDFs. DOM search returned two paragraphs; comparison used the second, beginning `1 Ин. 4:18 и 2 Кор. 3:17 здесь служат…` and ending `…стихами-доказательствами.` [DOM text](dom-paragraphs.json). First and repeat both include that full paragraph. This is text-extraction equality, not visual proof for all lines.

**Experimental arm**: print-only override of `break-inside` for `.summary-card[data-print-flow="atomic"]`, not a tracked or acceptable product patch. Closing-text checker exit 0, all 12 first and 12 repeated PDFs have asserted author, SDG and accuracy text and first/repeat closing-text parity. [Full output](experimental.txt). See [prior rationale and reproducible driver](../print-summary-fragmentation/README.md). It overrides the keep-together guarantee; cannot be called a safe solution.

Actual PDF page renders on **one 320 direct cold run**:
- Baseline [page 3](baseline-3.png): whole «Коротко» card together and next heading with following paragraph.
- Experimental [page 2](summary-auto-2.png) and [page 3](summary-auto-3.png): heading and first four items on page 2; page 3 begins with intact fifth item. Card borders continue across the page edge; there is no repeated «Коротко» heading on the continuation. The following heading «Что эта модель утверждает — и чего не утверждает» is on page 3 with its paragraph. This is a real visual trade-off needing owner judgment, not a visual PASS for global pagination. Existing PDFs show all five complete DOM paragraphs by extraction; no physical/other-route visual signoff.

## #577 — native mobile tables at 320 and PDF

Route `/articles/dzhon-gill-istoricheskiy-kontekst/`, no `reader-pilot`, native Reader. One chronological (8 rows) and one comparison table (5 rows), both `data-responsive-layout=stacked-prose`. Both wrappers client/scroll = 246/246; document 320/320; cards width 246.4 px, cells 244.4 px; non-first `td` pseudo-labels correspond to `data-label`. The 39 data cells (24 + 15) all occur in full after whitespace normalization in the direct 320 A4 PDF (28 pages). Raw screen and CDP AX snapshot: [gill-320.json](gill-320.json); driver [gill-320-probe.mjs](gill-320-probe.mjs).

On the inspected PDF, headers are rendered and repeat after the break: chronological [p5](gill-page-5.png) → [p6](gill-page-6.png); comparison [p7](gill-page-7.png) → [p8](gill-page-8.png). All three columns stay inside page margins in these four renders. This is visual evidence for these two tables on this one route and print case, not all tables/routes or devices.

**Keyboard / semantics limit:** the two tables contain no links, buttons or tabindex targets and their wrappers have no tabindex. 75 successive Tabs from page load visited zero table descendants. This is expected for these static, non-scrollable tables, not proof of full keyboard or screen-reader usability. Chromium CDP AX on the first table reports `table`, `columnheader` named «СОБЫТИЕ», and a cell whose accessible name combines «СОБЫТИЕ» with its value. No physical keyboard, NVDA/VoiceOver/TalkBack or cross-browser check; the comparison table's full AT reading order was not verified. Do not claim #577 fully closed.

## Reproduction

- Start from exact SHA and build/serve without service worker cache. [Print A/B driver](../print-summary-fragmentation/capture.mjs), `PDF_OUTPUT_DIR=/tmp/reader-summary-auto-58f`, then run the [pypdf checker](../cold-pdf-regression/check.py) against each output folder.
- Run `CHROMIUM_EXECUTABLE=/path/to/chromium node reports/arena-table-audit/head-58f-visual-evidence/gill-320-probe.mjs`; output `/tmp/58f-gill-table.json` and `/tmp/58f-gill-320.pdf`; requires Playwright and Chromium compatible with it.
- Screenshots are rendered from the diagnostic PDFs, not screenshots from the native Chrome dialog. No candidate CSS or owner PR modifications were made.
