# Reader GB independent follow-up — PR #2352, `f908e289e`

2026-11-22 · For the #577 / #2349 owner. This is independent diagnostic evidence, not a product patch or merge recommendation.

## Scope and build

Exact head `f908e289e59b423f98d129b20552e6d6d3092b04`, fetched separately and built without product modifications: `node scripts/astro-cli.mjs build` (112 pages), then `node scripts/copy-legacy-to-dist.js --production-like --no-manifest`. The prior experimental change to `reader-actions.js` was removed before this build. Since `25830c64e`, the head changes only `GillSeriesMobileBar.astro` and a Reader controls test. Native mobile Reader exercised below; the desktop W57 result in the earlier report is on `25830c64e`, not claimed as a retest of this SHA. No owner branch or protected surfaces changed.

Chromium via Playwright, mobile/touch contexts, service workers blocked, A4 PDF. Local static dist served on port 8083. Script: `f908-reader-probe.mjs` (requires local Playwright and @sparticuz/chromium). These are CDP PDF results, not a physical phone or an actual native Save as PDF dialog.

## Two tables, Gill Historical Context

Native mobile route `/articles/dzhon-gill-istoricheskiy-kontekst/`, `stacked-prose` cards. Chronology: §I, `Год / Событие / Что менялось`, 8 rows. Text comparison: §II, `Вопрос / Партикулярные баптисты / Генеральные баптисты`, 5 rows.

| viewport | both table widths | wrapper client / scroll | document client / scroll | body font |
|---|---:|---:|---:|---:|
| 320 | 246.4 | 246 / 246 | 320 / 320 | 14px |
| 390 | 310.8 | 311 / 311 | 390 / 390 | 14.43px |
| 600 | 504 | 504 / 504 | 600 / 600 | 16px |

Body cells are stacked with their `data-label` values; neither table requires horizontal scrolling in these measurements. Earlier detailed clipping and print-header probes are for `25830c64e`; they are not presented as new visual/AT testing on `f908e289e`.

## #2349 cold and repeated PDF

Route `/articles/anatomiya-padeniya-pyat-stadiy/`; fresh context per row. Click the actual Reader PDF button, with `window.print` stubbed to count calls and dispatch `beforeprint`, then invoke `page.pdf()` twice on the same page **without pre-emulating print media**. This simulates the entry path, not the native print dialog. Text checks normalize whitespace because PDF extraction splits text.

| viewport / setup | first PDF | repeat | final article paragraph | author + SOLI DEO GLORIA |
|---|---|---|---|---|
| 320, clean head | 12 pages | 12 pages | present in both | missing in both |
| 390, clean head | 12 pages | 13 pages | present in both | missing first, present repeat |
| 320, all unloaded `FontFace`s loaded first | 12 | 12 | present | missing |
| 390, all unloaded `FontFace`s loaded first | 13 | 13 | present | present |
| 320, same fonts plus print-only button max-width/wrapping candidate | 12 | 12 | present | missing |

`window.print` was called once in each row. Baseline had 49 font faces still `unloaded` before PDF; explicit `.load()` on each followed by `document.fonts.ready` left zero unloaded. This single current-head run is consistent with repeated tests on `25830c64e`, not a cross-browser guarantee. The first 12-page PDF retains the last **article paragraph**, but loses closing material after it, including the author card, SDG and the accuracy block body. Avoid conflating the paragraph with these separate closing blocks.

## Correction to previous report and comment

The earlier conclusion “font preloading has no effect” is **wrong**. `document.fonts.ready` alone does not load unused faces. On `25830c64e` at 390, explicit loading of `Source Sans 3` weight 500 with Cyrillic text, or all 49 faces, changed cold output to 13 pages with closing blocks; loading Lora 500 alone did not. An exploratory async font preload inside the Reader print entry likewise produced a complete 390px PDF. This is a candidate, not a complete fix: 320px still fails with all faces loaded. The stronger earlier assertion that print-media timing alone is the lever is not established.

At 320 an emulated-print inspection found two accuracy buttons extend beyond their parent. **Causality is unproven:** a print-only `max-width:100%; white-space:normal` candidate with fonts preloaded still gives 12/12 on the real-button + cold `page.pdf()` procedure above. Tests that first used `emulateMedia('print')` gave 13 pages even without this candidate and therefore cannot establish that the candidate fixes the cold path. Do not ship it based on those emulated-print results.

## Owner handoff / next verification

- Preserve accepted mobile and W57 UI; no rollback requested.
- Reproduce using real Chrome Save as PDF and on physical devices; verify complete closing blocks as well as the final paragraph, first and repeated saves.
- Investigate the separate 320px pagination failure; preloading fonts alone is insufficient. Validate font preload error/fallback behaviour and avoid indiscriminate production changes without regression testing.
- The existing `scripts/print-pagination-contract.mjs` emulates print before `page.pdf()` and can miss the cold-direct failure. Add a no-pre-emulation fresh-context assertion for author and SDG, alongside existing emulated-print checks.
- Direct posting to AuditRepo #577 is blocked by integration 403; this report is linked from #2352 for the #577/#2349 owner. Earlier 25830 evidence and W57 measurements: [prior report](pr2352-head-25830c64e-reader-audit.md).
