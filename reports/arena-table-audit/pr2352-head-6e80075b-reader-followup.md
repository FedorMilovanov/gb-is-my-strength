# Independent Reader GB follow-up — PR #2352 head `6e80075b`

2026-11-22. Handoff to #577/#2349 owner; diagnostic evidence only, not a product fix or merge approval.

## Build and surface

Fresh fetch of `6e80075b70ce808c1e4e1f5978504cce4e120a0e` in separate `/tmp/gb-pr2352`, no product edits. `node scripts/astro-cli.mjs build` (112 pages) and `node scripts/copy-legacy-to-dist.js --production-like --no-manifest`; static dist on :8083. Diff from `f908e289e`: Gill marginalia, Gill TOC overlay, Gill mobile play smoke (3 files). Mobile tests are on native Reader, not desktop emulation of W57. Chromium via Playwright mobile/touch, service workers blocked, A4; no physical device or native print-dialog testing.

Gill Historical Context chronology (§I, 8 rows) and text comparison (§II, 5 rows) retain stacked cards. At 320 / 390 / 600, widths are 246.4 / 310.8 / 504 px for both tables, each wrapper clientWidth equals scrollWidth (246 / 311 / 504), and document clientWidth equals scrollWidth (320 / 390 / 600). This confirms no measured horizontal overflow, not a new visual/AT certification.

W57: served this exact build through `research/reader-w57-pilot/preview.py`, route `/articles/anatomiya-padeniya-pyat-stadiy/?reader-pilot=1`, 1280×900; `body.np-w57-ready=true`, document clientWidth/scrollWidth 1280/1280. Direct CDP PDF: 26 pages, final article paragraph, author card and SOLI DEO GLORIA present. This one desktop measurement is not a mobile result or a W57 regression sweep.

## Cold PDF, repeated PDF

Route `/articles/anatomiya-padeniya-pyat-stadiy/`. Fresh mobile context per case, load + 1200 ms; actual Reader PDF button clicked, but `window.print` stubbed (counts invocation, dispatches `beforeprint`); then `page.pdf()` twice, without prior `emulateMedia('print')`. First and repeated PDF extract the final article paragraph in every case. Author card / SDG are separate closing blocks.

| viewport / setup | pages first / repeat | author card + SDG first / repeat |
|---|---|---|
| 320, clean | 12 / 12 | absent / absent |
| 390, clean | 12 / 13 | absent / present |
| 320, preload unloaded font faces | 12 / 12 | absent / absent |
| 390, preload unloaded font faces | 13 / 13 | present / present |

Each case invoked `window.print` once; clean screen reported 49 unloaded faces and preload zero. This reproduces previous head's result in this limited harness, not proof of native Save as PDF behaviour.

## New 320px geometry experiment

After font preload and before clicking PDF, an **experimental screen-layout override**, `.page-wrap { padding-left:0!important; padding-right:0!important }`, changes screen article width from 246.4 to 294.4 px (matching the measured print width). No print emulation; fresh context per PDF. Five cold PDFs per arm:

| arm | pages per run | final paragraph | author, SDG and accuracy body |
|---|---|---|---|
| no override, no font preload | 12 × 5 | present × 5 | absent × 5 |
| font preload only | 12 × 5 | present × 5 | absent × 5 |
| font preload + screen padding override | 13 × 5 | present × 5 | present × 5 |

The screen-layout intervention also changes pagination and is not an acceptable ready-to-ship UI fix. It demonstrates a reproducible **interaction** between font state / pre-print screen geometry and this CDP pagination scenario, not a proven causal root or fix in native browsers. An independent single-run screen-padding-only case yielded 12 pages; a separate 12px-padding case yielded 13 even without preload, so no claim that both interventions are universally necessary. A single run inserting the override on the harness's synthetic `beforeprint` also yielded 13 with fonts; because this synthetic event precedes `page.pdf()` and allows layout time, it does not establish that a real synchronous `beforeprint` listener can do this. Avoid visually changing the accepted mobile layout for this diagnostic effect.

All-font preload can itself fail or delay print, and all widths, fonts, subsequent screen restoration, native UI, physical phones and non-Chromium browsers remain unverified. Do not adopt it or the padding override without a targeted owner-designed fix and regression tests. Existing `print-pagination-contract.mjs` pre-emulates print; add a separate cold no-pre-emulation check for the closing blocks.

## Reproduction assets

- [Previous audit and corrections](pr2352-head-f908e289e-reader-followup.md); table/PDF probe [f908-reader-probe.mjs](f908-reader-probe.mjs) was rerun against this exact build.
- [320 five-run probe](6e800-320-repeat.mjs); [screen geometry experiment](6e800-geometry-probe.mjs). These standalone diagnostic scripts use local `playwright` and `@sparticuz/chromium`, hard-coded localhost `:8083` and output `/tmp/arena-browser/pdf/`; provision dependencies and paths before running. Extract PDF text with pypdf and normalize whitespace, then check `каноническимрезонансом`, `редакционныйпринцип`, `solideogloria`, `напишите,исправим`.
- No PR #2352 branch mutation. AuditRepo issue comments previously rejected with 403, so handoff is linked in #2352 instead.
