# Summary card scope probe — exact PR #2352 a77fae846

Diagnostic only, not a product fix. Built exact `a77fae8467cc787e2f976533dec3a6fbdea5cc2a` independently; direct Chromium A4 PDF, no print pre-emulation, mobile viewport 320/390, one fresh browser context per route/width/arm, two consecutive PDFs in each context. Page load plus 1200 ms delay; blocked service workers. The experimental arm injects only `.summary-card[data-print-flow="atomic"] { break-inside:auto; page-break-inside:auto }` under print, with important priority. This deliberately sacrifices the atomic-card requirement. PDF text extraction checks full individual summary text paragraphs and selected DOM tail text, not image appearance or the whole document. Missing DOM selectors are N/A, not passes. One context per combination is a small exploratory sample.

| Route | Baseline checked tail | Summary paragraph pages baseline → auto | Page counts baseline → auto |
|---|---|---|---|
| anatomiya-padeniya-pyat-stadiy | 320 both missing; 390 first missing, repeat present (author, SDG, accuracy) | 3,3,3,3,3 → 2,2,2,2,3 | 320 12/12 → 12/12; 390 12/13 → 12/12 |
| dzhon-gill-istoricheskiy-kontekst | author and SDG present all | 2,2,2,2,2 → same | 28/28 → 28/28 both widths |
| dzhon-gill-spravochnik | author and SDG present all | 2,2,2,2,2 → 1,2,2,2,2 | 18/18 → 18/18 both widths |
| myslennaya-zhizn-serdca | SDG and accuracy present all | 1,1,1,1,1 → same | 9/9 → 9/9 both widths |

In anatomy, all three checked tail texts are present in both experimental PDFs at both widths, but the card splits. In the Gill handbook, the experimental override also moves the first summary paragraph onto a different page even though its baseline tail checks already pass. Therefore the previously observed improvement is route-specific and a global override is not safe. Page assignments by text extraction are not a visual assessment; cannot conclude all text is complete, all 39 routes pass, or why the browser dropped content. Native Save as PDF, other engines and real devices remain unverified. This does not change protected Reader UI or the owner's Learning→Analytics work.

Reproduce: serve the independently built exact SHA on 8083 (or set `BASE_URL`), make Playwright resolvable for `capture.mjs`, optionally set `CHROMIUM_PATH` and `OUTPUT_DIR`, then run `node capture.mjs`. The output manifest holds DOM marker text and PDF paths. Use a PDF text extractor per page, normalize whitespace, and compare each marker; absent markers are N/A. The cold-first regression and broader 2-context/both-button matrix are recorded in sibling reports, including `../head-228118-boundary/` and `../print-forced-break-a77/`.
