# Independent Reader follow-up — PR #2352 `64ea5d5f9`

Read current PR comments through W123. W121 unified quiz and W122/W123 search are owned by other executors and were not modified. This is a narrow independent table/print/boundary audit, not integrated Reader acceptance or merge approval. Exact detached checkout `64ea5d5f985ad12c09b99c1709770311e1ffed13`, independent `astro-cli.mjs build` (112 Astro pages) and `copy-legacy-to-dist.js --production-like --no-manifest`; cache-bust source read-only check also passed. Chromium CDP, fresh contexts, service workers blocked. No Pagefind indexing was performed; no search/quiz acceptance claimed.

## Anatomy cold PDF #2349

320/390 × direct `page.pdf()` / real mobile Reader button with `window.print` stub and synthetic `beforeprint` × 2 fresh contexts × first/repeat, no pre-emulation. Full final paragraph verified against fixture in 16/16 PDFs. Closing author text, SDG and accuracy body missing in all 8 first PDFs; missing in 4/4 320 repeats, present in 4/4 390 repeats. First/repeat tail parity fails all 8 context pairs because first tail absent. Checker exit 1. [Raw checker](cold-check.txt), [manifest](cold-manifest.json); [capture and checker](../cold-pdf-regression/). This is not Chrome's native print dialog, visual completeness, physical device or other engine verification. Fix remains open.

## Gill context #577: native 320

Chronology 8 rows/24 cells, comparison 5 rows/15 cells; wrapper width/scroll 246/246, document 320/320, all 39 full DOM cell texts matched whitespace-normalized PDF extraction (28 pages). PyMuPDF word positions show all three chronology headers at same y on pages 5 and 6, all three comparison headers at same y on pages 7 and 8; this is a text-position check, not a new screenshot review. Static tables contain no focus stop in 75 Tabs. [Screen, AX and Tab raw data](gill-320.json); [capture](../head-58f-visual-evidence/gill-320-probe.mjs). This is not a screen-reader/physical-device signoff.

## W57/native boundary

Real `research/reader-w57-pilot/preview.py`, Gill II `?reader-pilot=1&paper=space`, [probe](../head-228118-boundary/w57-boundary.mjs) and [raw result](w57-boundary.json). At 390 and 1120 native layout, TOC/Settings open+Escape, exposed speed point opens, play center hit; at 1121 and 1440 W57 ready, annotations ready, one notes detail. HTTP 200, zero horizontal overflow and page errors at four widths. Desktop checked readiness only, not interaction/visual approval. Reduced motion, no WebKit, device, zoom, resize, AT or complete Reader acceptance. HOLD remains.
