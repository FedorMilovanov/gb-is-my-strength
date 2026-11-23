# Cold Reader PDF regression probe (diagnostic)

This tests #2349 without pre-emulating print media. It is expected to **fail** on PR #2352 `7e2280ede63828f887fe649071e9df3d5b2907dc`; no product changes. The button leg invokes the real Reader click handler but stubs `window.print` and dispatches a synthetic `beforeprint` before calling Playwright `page.pdf()`. The direct leg calls `page.pdf()` only. Neither leg tests Chrome's actual Save as PDF dialog or physical hardware. Treat result as a CDP regression check, not release acceptance.

## Prerequisites / run

Build the **desired exact SHA** independently (e.g. `node scripts/astro-cli.mjs build`, then `node scripts/copy-legacy-to-dist.js --production-like --no-manifest`); serve that dist at `BASE_URL`, with the original asset paths. Install Playwright and an executable Chromium compatible with it; set `CHROMIUM_EXECUTABLE` if Playwright's managed browser is not installed. Python needs `pypdf` (tested 7.1.1). Execute from a location where Node can resolve `playwright`:

```sh
BASE_URL=http://127.0.0.1:8083 CHROMIUM_EXECUTABLE=/path/to/chromium \
  node reports/arena-table-audit/cold-pdf-regression/capture.mjs
python3 reports/arena-table-audit/cold-pdf-regression/check.py /tmp/reader-cold-pdf
```

Optional environment: `WIDTHS=320,390`, `RUNS=3`, `PDF_OUTPUT_DIR=/tmp/reader-cold-pdf`. Default is 3 fresh contexts for each width and method; each emits two PDFs and a manifest. The check verifies the full final-paragraph text from the exact-a77 article fixture, detailed author text, SDG, accuracy text and both links' labels, and exact normalized extracted closing-text parity between first and second PDF. The paragraph fixture must be independently checked against the live DOM if the article changes; otherwise a stale fixture may cause a false failure. It does **not** verify link destinations, PDF visual clipping or document-wide text parity. Failure exits 1. Ignore page-count changes when content is complete; count is diagnostic only. Font status is logged before printing, not proof of which face was used. Retest native UI, failure/timeout UX and other browsers separately.

## Recorded baseline

Exact PR head `7e2280ede63828f887fe649071e9df3d5b2907dc`, separately built, Chromium 153, service workers blocked, `RUNS=3`: [capture manifest](7e2280-manifest.json), [checker output](7e2280-baseline.txt). At both widths and both methods, all 12 fresh-context first PDFs were 12 pages and lacked author/SDG/accuracy body; the paragraph sentinel was present. At 390 all 6 second copies were 13 pages with every asserted item; at 320 all 6 second copies still lacked closing items. Checker exit 1. PDFs remain local test artifacts, not checked in.

Checker sanity control: two independently generated **diagnostic font-preload + screen-layout override** PDFs from the previous `6e80075b` experiment both contained all assertions, had matching extracted tail, and yielded exit 0. This only tests the checker against positive files; it is **not** a green product fix, not an actual first/repeat capture on the new SHA, and the visual override must not be shipped as a remedy. A genuine red/green run of the same scenario against an owner fix remains open.

## Full-paragraph fixture check on a77

Exact `a77fae8467cc787e2f976533dec3a6fbdea5cc2a`, independent build, `RUNS=2`, direct and stubbed button, two widths, first/repeat: [manifest](a77-full-paragraph-manifest.json) and [checker output](a77-full-paragraph.txt). The fixture matches the second of the two live DOM paragraphs containing `каноническим резонансом` on this build and was found in all 16 PDFs by whitespace/case-normalized text extraction. Changing its final words to a nonexistent phrase matched 0/16 (a narrow negative control, not a full checker test). The checker exits 1 because closing material is absent in all 8 first PDFs, all four 320 repeats, and present in the four 390 repeats. Page count alone is not the acceptance condition. This strengthens the prior sentinel check; it does not establish visual completeness, native dialog behavior, or a fix.
