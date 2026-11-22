# PR #2352 head `25830c64e` — independent Reader/Table audit

> Correction: §3.3–3.5 conclusions about fonts and the recommended print fix are superseded by [the follow-up](pr2352-head-f908e289e-reader-followup.md). Loading unused font faces before pagination changes the 390px result; this does not fix 320px. Print-media timing alone is not established as root cause.

Date: 2026-11-22
Auditor: Arena agent (independent lane, pilot branch `arena/49cd0103-gb-is-my-strength`)
Owner surface: PR #2352 `arena/e317bc5a-gb-is-my-strength`
Head under test: `25830c64e996a70c8e550fabb89911e37becc64b` ("fix(reader): fit analytics label and stabilize lock test")
Base: `fix/reader-library-no-count-dot-20261119`
Build: `node scripts/astro-cli.mjs build` → 112 pages + `copy-legacy-to-dist.js --production-like --no-manifest`; served read-only on `:8083`.

Nothing in this report mutates PR #2352. No Nagornaya / NEWS / G3 / JOURNAL route was touched.

---

## 1. Surface check — which Reader is actually rendered

### 1.1 Native mobile Reader (320 / 390)

`/articles/dzhon-gill-istoricheskiy-kontekst/` and `/articles/anatomiya-padeniya-pyat-stadiy/`

- `html[data-gill-v16]` present, `body` carries `gbs-world gb-cluster-series-active …`.
- 7 `table[data-responsive-layout="stacked-prose"]` opt-in tables.
- `.reader-mobile-action--pdf` present (`data-reader-pdf="save"`).
- No `reader-pilot` marker, no W57 nodes, no W57 stylesheet — the W57 pilot is **not** injected on the native mobile surface.

### 1.2 Desktop W57 via `research/reader-w57-pilot/preview.py` + `?reader-pilot=1`

Server: `READER_W57_DIST=/tmp/gb-pr2352/dist READER_W57_PORT=19061 python3 research/reader-w57-pilot/preview.py`.
Opt-in only (`?reader-pilot=1`, desktop `min-width:1121px`).

| viewport | `body.np-w57-ready` | W57 CSS links | bootstrap | `#npUniversalDemo` | `article[data-reader-projection]` | page overflow |
|---|---|---|---|---|---|---|
| 1121 | yes | 6 | yes | yes | yes | 1121/1121 |
| 1280 | yes | 6 | yes | yes | yes | 1280/1280 |
| 1440 | yes | 6 | yes | yes | yes | 1440/1440 |

Body class: `… np-u-preview np-u-argon-shell np-u-legacy-chrome-docked np-u-native-product-actions np-u-native-series-rail np-u-hide-right np-u-w55-context-actions np-w57-ready`.

W57 PDF (`page.pdf()`, 1280, A4): **26 pages, all closing blocks present** (`SOLI DEO GLORIA`, `ФМ`, accuracy footer, `Проверь себя`). The cold-first-PDF truncation of #2349 does **not** reproduce on the W57 surface.

---

## 2. Tables — one chronological, one text comparison

Route: `/articles/dzhon-gill-istoricheskiy-kontekst/` (Gill Historical Context).
All 7 tables are `table.compare-table[data-responsive-layout="stacked-prose"]` inside `.table-scroll`.

### 2.1 Chronological table

- Section: «I. От пуританского спора к устойчивому миру диссента»
- Heads: `Год` / `Событие` / `Что менялось`
- 8 data rows (9 `<tr>` incl. header)

### 2.2 Text-comparison table

- Section: «II. Партикулярные и генеральные баптисты: две традиции, а не две монолитные партии»
- Heads: `Вопрос` / `Партикулярные баптисты` / `Генеральные баптисты`
- 5 data rows (6 `<tr>` incl. header)

### 2.3 Phone-column readability (320 / 390 / 600)

| measure | 320 | 390 | 600 |
|---|---|---|---|
| `.table-scroll` width | 246.4 | 310.8 | 504.0 |
| `table` width | 246.4 | 310.8 | 504.0 |
| `table` computed `min-width` | `0px` | `0px` | `0px` |
| `table` computed `display` | `block` | `block` | `block` |
| wrapper `scrollWidth − clientWidth` | 0 | 0 | 0 |
| document `scrollWidth − clientWidth` | 0 | 0 | 0 |
| clipped `<td>` | 0 | 0 | 0 |
| body cell `font-size` | 14px | 14.4px | 16px |
| cell `line-height` | 1.58 | 1.58 | 1.58 |

- Card layout is active: `tbody { display:grid }`, one card per row, `td { display:block }`, label rendered above the value by `td::before` (`content: attr(data-label)`, 12px/650), first-cell label suppressed.
- No horizontal scroll surface: `overflow-x: visible`, `scrollWidth == clientWidth`.
- No page-level horizontal overflow at any of the three widths.

### 2.4 Known detector false positive (not a defect)

The visually-hidden `<thead>` is `position:absolute; inline-size:1px; block-size:1px; overflow:hidden; clip-path:inset(50%)`, but its `<th>` children are `white-space:nowrap` at 11px and their boxes extend past the 1px box (e.g. `Генеральные баптисты` reaches x=352.9 on a 320 viewport). They are clipped by `overflow:hidden` + `clip-path`, and the document never overflows (`scrollWidth == clientWidth == 320`). The 20 `<th>` nodes intentionally remain in the DOM/AX tree. Hygiene note only: the clipping relies on `overflow:hidden` on a 1px box while the children are `nowrap`.

---

## 3. #2349 cold-first-PDF scenario on the current head

Route: `/articles/anatomiya-padeniya-pyat-stadiy/`, viewport 390×844, A4, `page.pdf({printBackground:true})`.

### 3.1 Results

| case | pages | closing blocks |
|---|---|---|
| cold direct (fresh context) | **12** | **missing** |
| same page, 2nd `page.pdf()` | **13** | present |
| same page, 3rd / 4th | 13 | present |
| fresh context ×10 | 12 every time | missing |
| `emulateMedia({media:'print'})` then `page.pdf()` | **13** | present |
| emulate print at 320 / 390 / 600 / 768 / 1024 / 1280 | 13 | present |
| real UI: stub `window.print` + click `.reader-mobile-action--pdf`, then `page.pdf()` | **12** | missing |

### 3.2 What is missing from the 12-page PDF

- `section.author-card` — «ФМ / Редакционный принцип / Писание выше личности и системы…»
- `div.article-end-block` — «SOLI DEO GLORIA»
- `.gb-accuracy-block` print footer — «Богословскую или техническую — напишите, исправим. Email Telegram»

Present in the 12-page PDF: the article's final paragraph («1 Ин. 4:18 и 2 Кор. 3:17 здесь служат только осторожным каноническим резонансом…»), the accuracy `h2` «Нашли неточность?», the quiz note and the quiz `h2` «Проверь себя».

### 3.3 Mechanism (measured)

- `page.pdf()` fires `beforeprint` while `window.matchMedia('print').matches === false`. Trace on a cold run: `beforeprint` → `GBPrintPagination.prepare()` ×4 with `printMM=false` → media change to `print` → `prepare()` ×1 with `printMM=true`.
- The last page of the 12-page PDF overflows its page box: extracted text reaches y≈3116 in a content box ≈1828 units tall → the tail is clipped, not reflowed.
- The emulated media at `Page.printToPDF` time decides the stylesheet: no emulation → print CSS, 12 pages; `emulateMedia({media:'print'})` → print CSS laid out up front, 13 pages; `emulateMedia({media:'screen'})` → screen CSS, 15 pages (mobile chrome leaks).

### 3.4 Candidate patches that did **not** change the page count

| patch | DOM effect | pages |
|---|---|---|
| drop `isPrintMedia()` gate at `js/reader-preferences-head.js:564` | closing group 0→1, followers 3→0 | 12 |
| force `isPrintMedia() → true` | closing group 0→1, followers 3→0 | 12 |
| `break-inside: auto` on `[data-print-flow="atomic"]` / `.gb-print-closing-group` | — | 12 |
| eager print-contract `<style>` at load | style present before first print | 12 |
| `document.fonts.ready` awaited / all images complete | — | 12 |
| manual `beforeprint` + `afterprint` dispatch | — | 12 |

Conclusion: the semantic classification marks are **not** the lever. The differentiator is whether the document has already been laid out in print media when `Page.printToPDF` paginates. Font preloading and timing delays are not the cause (consistent with the earlier font-delay matrix).

### 3.5 Proposal

1. **Verify with real Chrome «Save as PDF»** (the issue's second criterion). CDP `page.pdf()` may not reproduce the native dialog path, and the native dialog lays out in print media.
2. If it reproduces in real Chrome, the fix belongs at the print entry (`src/runtime/reader-actions.js` `print()`, L69–103) plus the pagination owner (`js/reader-preferences-head.js`): the print path must guarantee a print-media layout **before** pagination and must re-run `prepare()` after the media switch so the closing group is built under print geometry. Making `prepare()` media-independent alone is not sufficient (measured).
3. Do **not** pursue font preloading / delay fixes — measured no effect.
4. `scripts/print-pagination-contract.mjs` emulates print before `page.pdf()` (L226), so it cannot catch this regression. Add a cold-direct assertion (no `emulateMedia`) that asserts the three closing blocks.

---

## 4. Artefacts

- PDFs: `/tmp/arena-browser/pdf/h25830-*.pdf`, `p2352-final-cold-{direct,emulate}.pdf`
- Probes: `/tmp/arena-browser/pdf-{final2,repeat-clean,fixtest2,trace,hide,followers,breaktest,styletest,forceprint,widths}-*.mjs`
- Dist: `/tmp/gb-pr2352/dist` at `25830c64e`
