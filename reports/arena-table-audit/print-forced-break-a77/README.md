# #2349 · forced-break diagnostic preserving the summary card

2026-11-22. Separate build of exact PR #2352 SHA `a77fae8467cc787e2f976533dec3a6fbdea5cc2a`, Astro + legacy copy; only change since `228118112` is an external-analytics isolation in the W57 two-tab test. Read owner comments including [W117](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2352#issuecomment-7089647252) and [W74](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2352#issuecomment-7099677807); protected W107, owner PR, analytics and unrelated lanes untouched. These experiments are not proposed fixes.

Chromium 153 / CDP A4 / `page.pdf()` **direct**, not Reader button or native Chrome Save as PDF. Route `/articles/anatomiya-padeniya-pyat-stadiy/`; 320×844 / 390×844, SW blocked, fresh context per variant × 2, `load`+1200ms, first and repeat PDF; no print-media pre-emulation or font preload. Before printing, inject a print-only diagnostic CSS rule on `html body .summary-card[data-print-flow="atomic"]`. [Complete measured matrix](results.txt) and [reproducible driver](capture.mjs).

| intervention | atomic keep-together | first PDF / author + SDG + accuracy text, 320 and 390 | summary item pages |
|---|---|---|---|
| baseline | unchanged | 12, missing 2/2 per width | 3/3/3/3/3 |
| force `break-before:page` | unchanged | 12, missing 2/2 | 3/3/3/3/3 |
| force `break-after:page` | unchanged | 12, missing 2/2 | 3/3/3/3/3 |
| force both | unchanged | 12, missing 2/2 | 3/3/3/3/3 |
| `margin-bottom:20mm` | unchanged | 12, missing 2/2 | 3/3/3/3/3 |
| `break-inside:auto` | **removed** | 12, all checked text present 2/2 | 2/2/2/2/3 |
| `auto` + forced break before | removed; forced page | 12, missing 2/2 | 3/3/3/3/3 |
| `auto` + forced break after | removed; forced page | 12, missing 2/2 | 2/2/2/2/3 |
| `auto` + both | removed; forced pages | 12, missing 2/2 | 3/3/3/3/3 |

All rows include the final paragraph sentinel. At 320 all repeat results matched their first's presence/absence; at 390 variants with missing first recovered checked tail at repeat (13 pages), whereas plain `auto` stayed complete at 12. `page` values above locate each whole summary paragraph in pypdf's extracted page text and are **not** a full visual, order, content-parity or accessibility check. The diagnostic `auto` visibly splits the card as already documented on the previous head; do not adopt it based on this table.

The forced-after rule is not merely inert: for 320 run 1, the following heading «Что эта модель утверждает…» moves from page 3 to page 4, while the cold PDF remains 12 pages and the closing text is still missing. On a separately instrumented 320 run the matched print-time computed values were baseline `inside=avoid, before=auto, after=auto`; after `avoid/auto/page`; auto `auto/auto/auto`; autoBefore `auto/page/auto`. Instrumentation reads the print media change listener, not the physical print snapshot; this is not a full causal proof.

**Interpretation:** under this narrow harness, adding a forced break or gap while retaining the existing atomic treatment did not recover the tail. Allowing the card to split alone did, but combining it with a forced break failed again. This narrows a candidate space and illustrates sensitivity to total pagination; it does not establish that page-count caching is the browser's cause or that a global CSS policy is safe. Explicit forced pages could create blank pages and degrade other articles. Need a print-owner solution preserving atomic rules across all routes, same-scenario red/green, real Chrome Save as PDF and font-failure timeout. #2349 remains open.

## Reproduce

Build and serve exact SHA on :8083, `playwright`, compatible Chromium, Python pypdf. `CHROMIUM_EXECUTABLE=/path/to/chromium node reports/arena-table-audit/print-forced-break-a77/capture.mjs`; outputs `/tmp/a77-break-probe` (override with `BASE_URL`, `PDF_OUTPUT_DIR`, `RUNS`). Extract full text and summary page positions as done in [results.txt](results.txt); screenshots and actual PDFs are not committed. This script captures direct PDFs only, not native printing or UI.
