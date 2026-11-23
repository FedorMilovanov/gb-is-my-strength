# #2349 print isolation — diagnostic, not a proposed production patch

2026-11-22. Independent owner handoff. Exact PR #2352 `23e7de8c4b80a3913f41aeff3ccb7edf8a3f466e` independently built, 112 pages, legacy copy; no product edits. Print-bootstrap `js/reader-preferences-head.js` SHA-256 `5a91294b4a9d1e1ea39b376f255ebabaf6e677078908fcd910b87052cc580160`. Browser: Chromium 153 via Playwright, mobile/touch, service workers blocked, A4. Fresh context per run, loaded + 1200 ms, no pre-emulation of print. Direct `page.pdf()` and Reader click with `window.print` stub + synthetic `beforeprint`, followed by two PDFs. This does not reproduce the native Chrome dialog or physical devices.

## Isolation evidence

Initial investigation ran on exact `56160c157ee8c23f7c2fb790034f0695171b11ff` (head at the time). On 320 and 390, direct PDF, 3 fresh contexts per cell, first and repeated outputs:

- Normal bootstrap: 320 = 12/12 without the three closing blocks; 390 = 12/13 with blocks only in second.
- Block `reader-preferences-head.js` request: 12/12 **with** final-paragraph sentinel, author, SDG and accuracy text, at both widths, 3/3. JS disabled gives the same sentinel result, but changes other behaviour, and is not a user-path verification.
- Intercept bootstrap and turn `prepare()` into a no-op: same 12/12 presence at both widths, 3/3. This disables the entire print contract and is unsafe as a fix.
- Intercept bootstrap and retain only style installation (no candidate classification), or retain classification without installing its style: same 12/12 presence, 3/3. Removing terminal follower mask, disabling terminal-region marking, or removing heading keep marks individually did **not** restore the missing content. Eliminating candidate classification did; so did excluding all descendants of `.summary-card` from that classification (2/2). This is an intervention on the print machinery, not proof of a single underlying Chromium bug.
- Finer diagnostic: excluding `.summary-card` alone did **not** restore it; excluding `.summary-card__body` alone did **not** restore it; excluding **both together** did, on 320 and 390, 3/3 direct contexts. Rewriting the splittable CSS rule alone, globally or for these two selectors, did **not** restore it. The cause is not established: changes can alter layout, classification, grouping and pagination timing together. Do not infer a one-line safe fix from these tests.

An earlier report asserted pypdf text coordinates proved off-page clipping. That coordinate calculation was not reliable and is retracted. On untouched `56160` cold PDFs both pypdf and PyMuPDF text extraction lack SDG; page count and extracted text demonstrate missing content but not why it was omitted. In the experimental 320 output, PyMuPDF locates SDG and accuracy text within the page 12 media box. This is not a comprehensive visual clipping or accessibility inspection.

## Same-procedure control vs experiment on current `23e7de8c`

Only request-level bootstrap response is modified for `exclude-two`: replace `var candidates = collectCandidates(root);` with `var candidates = collectCandidates(root).filter(function(n){return !n.matches('.summary-card,.summary-card__body')});`. Source checkout and PR unchanged. The baseline has no interception. The bootstrap served by dist is checked against the source bytes before capture. This intervention preserves neither all existing fragmentation guarantees nor proven visual parity and **must not be shipped as-is**.

| width | method | contexts per arm | baseline first / repeat | exclude-two first / repeat |
|---|---|---:|---|---|
| 320 | direct | 3 | missing / missing | all asserted closing text / all asserted closing text |
| 320 | button stub | 3 | missing / missing | all asserted closing text / all asserted closing text |
| 390 | direct | 3 | missing / present | all asserted closing text / all asserted closing text |
| 390 | button stub | 3 | missing / present | all asserted closing text / all asserted closing text |

Each baseline first PDF had 12 pages; 390 repeats had 13 and 320 repeats 12. All exclude-two PDFs had 12. The existing checker returned baseline exit 1 and experiment exit 0: final-paragraph **sentinel**, full author statement, SDG, accuracy message and Email/Telegram labels are present, and extracted closing text is identical across first/repeat within each context. See [baseline](23e-baseline.txt) and [experiment](23e-exclude-two.txt). As an additional text-only check, each of the five `.summary-card__text` DOM paragraphs appears in full after whitespace normalization in all 24 baseline and all 24 experiment PDFs. This does not check visual ordering/fragmentation, other body text, link destinations, or all Reader routes. Indeed, extraction order differs from the 390 baseline repeat despite equal text length; no whole-document parity claim.

The true fix remains with the print owner. Do not globally disable bootstrap, candidate classification or layout guard; investigate why excluding these nested card candidates changes pagination, and test summary-card split/atomic guarantees across routes, heading/terminal behaviour, print restore, font-load failure/timeout, and native Save as PDF. Both #2352 and #2349 remain open; this is diagnostic red/green for a narrow probe, not accepted product fix.

## Reproduce

Build and serve the tested SHA on :8083, install Playwright + Chromium and Python `pypdf` (7.1.1 used). Ensure `HEAD_SCRIPT` points to the exact checkout and the served bootstrap bytes match it. `capture.mjs` requires Node that can resolve Playwright; output is written under `/tmp`, not the repo.

```sh
BASE_URL=http://127.0.0.1:8083 HEAD_SCRIPT=/tmp/gb-pr2352/js/reader-preferences-head.js \
CHROMIUM_EXECUTABLE=/path/to/chromium node reports/arena-table-audit/print-isolation-56160/capture.mjs
python3 reports/arena-table-audit/cold-pdf-regression/check.py /tmp/reader-print-isolation/baseline    # exit 1 on this head
python3 reports/arena-table-audit/cold-pdf-regression/check.py /tmp/reader-print-isolation/exclude-two # exit 0 in this environment
```
