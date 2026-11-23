# #2349 — short summary-card atomicity interaction, experimental only

2026-11-22. Owner handoff. Exact PR #2352 head **`030d2e066082e7c4eae8d2c3084c312264d8fbac`**, separately built (112 pages + legacy copy), no product source modifications. Before it, instrumented event observations on **`32461d4ac2f8af19086272150b6d87d90691921f`**; the only diff from that SHA to `030d2e066` is `scripts/reader-controls-a11y-browser-contract.mjs`. Do not claim verification of later PR heads. Chromium 153 CDP, native mobile/touch, SW blocked, A4, route `/articles/anatomiya-padeniya-pyat-stadiy/`.

## Trace: what changed in print layout

On `32461d4ac`, instrumentation of `reader-preferences-head.js` (served only via request interception; no source edit) recorded each call to `classifyCandidates` and a later print-media change listener. The trace itself can affect timing and is observational, not the A/B outcome below. Raw traces: [320 base](324-auto-trace-320-base.json), [320 CSS override](324-auto-trace-320-summary-auto.json), [390 base](324-auto-trace-390-base.json), [390 CSS override](324-auto-trace-390-summary-auto.json).

In the `matchMedia('print')` preparation, both base and override reported 22 candidates / 7 atomic / 0 splittable / 1 closing group. At both viewports, `.summary-card` was marked `data-print-flow="atomic"`. Its computed `break-inside` was `avoid` in base and `auto` in the injected-CSS arm; measured print box was roughly 632×611 vs 632×645 CSS px, respectively. `data-gb-print-monolith` was absent on that element in the observed print-media change listener. These are sampled runtime states, not proof of the physical PDF snapshot or a complete account of other nodes. Geometry and timing can both differ.

## Same-procedure A/B on `030d2e066`

No pre-emulated print. For the diagnostic arm **only**, before generating the PDF inject a print-only stylesheet:

```css
@media print {
  html body .summary-card[data-print-flow="atomic"] {
    break-inside: auto !important;
    page-break-inside: auto !important;
  }
}
```

The selector is more specific than the current print-contract rule. The experiment does not alter tracked CSS, JS, HTML, or screen media; it intentionally changes print fragmentation for marked summary cards. This is **not an approved patch**: it overrides an existing atomicity guarantee, globally applies to matching cards, and has not passed other-route regression, visual/AT or native-browser testing.

3 fresh contexts × 320/390 × direct `page.pdf()` or actual Reader PDF click with a `window.print` stub and synthetic `beforeprint`; first and repeated PDF in each context. Checker searches a last-paragraph sentinel plus author statement, SDG, accuracy body and Email/Telegram labels, then compares extracted closing text across the pair; it does not check whole-document parity or link destinations.

| arm | first PDF | repeat PDF | checker |
|---|---|---|---|
| baseline, both methods, 320 | 12 pages, tail absent in 6/6 | 12, absent in 6/6 | exit 1 |
| baseline, both methods, 390 | 12 pages, tail absent in 6/6 | 13, present in 6/6 | exit 1 |
| `summary-auto`, both widths and methods | 12 pages, all asserted tail text present in 12/12 | 12, present in 12/12; extracted tail parity 12/12 | exit 0 |

[Complete baseline results](030-baseline.txt); [override results](030-summary-auto.txt). Each full DOM text of the five `.summary-card__text` paragraphs was found after whitespace normalization in all 24 PDFs per arm. In the baseline all five appeared on p3; in override items 1–4 appeared on p2, item 5 on p3 (24/24 per arm, pypdf extraction). No individual paragraph spanned pages in this one test; the card **does split**, which is a real change to the existing keep-together policy. This text check cannot certify visual clipping, heading or list-label placement, other cards, or reading order.

Conclusion: in this bounded Chromium CDP reproduction, allowing this marked card to fragment changes cold-final-content outcome without font preload or screen layout changes. This is stronger isolation than the earlier classifier-exclusion test; it is still not proof of the low-level browser cause or a safe fix. The owner should decide whether a bounded keep-together threshold, a reflow/settlement approach or another solution preserves semantic pagination, and retest summary fragmentation across real routes as well as native Chrome Save as PDF, other browsers, cleanup and font failures. Preserve the current screen/UI and established print rules unless accepted. #2349 remains open.

## Reproduce

Build and serve the exact tested SHA at :8083. Install Playwright and a compatible Chromium, Python pypdf 7.1.1; capture compares HEAD_SCRIPT to served bootstrap bytes. PDFs stay outside repo.

```sh
BASE_URL=http://127.0.0.1:8083 HEAD_SCRIPT=/tmp/gb-pr2352/js/reader-preferences-head.js \
CHROMIUM_EXECUTABLE=/path/to/chromium node reports/arena-table-audit/print-summary-fragmentation/capture.mjs
python3 reports/arena-table-audit/cold-pdf-regression/check.py /tmp/reader-summary-auto/baseline      # exit 1
python3 reports/arena-table-audit/cold-pdf-regression/check.py /tmp/reader-summary-auto/summary-auto  # exit 0 in tested environment
```
