# Cold PDF environmental probe — exact #2352 `52782ce40`

W128 reports a different outcome in four fresh Windows Chromium direct-print contexts: 13 pages and closing material present first/repeat on 320/390. That observation is not dismissed; exact versions, capture options and environment were not specified in that comment. This Linux probe tests a few possible factors, **not a reconciliation of the two environments** or an owner-approved fix.

Independently built detached PR head `52782ce400d988b78f9b6ef2827f84f828fef3ad` (Astro 112 pages + copy-legacy production-like/no-manifest), served dist on 8083. Linux 6.1.158+, Node 22.22.3, headless Chromium 153.0.8010.0, Playwright, service workers blocked. Direct `page.pdf({format:'A4', printBackground:true})`, no pre-emulation, wait load + 1200 ms. Each width/arm has 2 fresh browser contexts; each emits first and immediate repeated PDF = 40 PDFs. DOM text normalized for case/whitespace; checked full final-paragraph fixture, editorial-principle statement, SDG and accuracy body. Capture confirms `matchMedia('print') === false` before PDFs. [Manifest](manifest.json), [individual extraction checks](results.txt).

| Context arm | 320 first / repeat | 390 first / repeat |
|---|---|---|
| mobile, DPR 1, 2 or 3 | closing absent 6/6 / 6/6 | absent 6/6 / present 6/6 |
| non-mobile, DPR 1, same viewport | absent 2/2 / 2/2 | absent 2/2 / present 2/2 |
| mobile DPR 1, deliberately load all declared FontFace objects before print | absent 2/2 / 2/2 | present 2/2 / 2/2 |

Full final paragraph present 40/40. All failing PDFs have 12 pages; passing 390 PDFs have 13. Page count is not the assertion. Immediately before printing, the baseline contexts showed 12 loaded / 49 unloaded FontFace objects; preloaded contexts showed 61 loaded. Explicit preloading is an expensive diagnostic intervention, not proof those faces were used, not an asynchronous beforeprint solution, and **not a fix at 320**. DPR and `isMobile` did not change this particular outcome; different actual font installations/browser versions/layout timing may still matter. No global CSS, atomicity or product UI changed.

Reproduce with Playwright resolvable from `capture.mjs`, serve the independently built exact SHA; set `BASE_URL`, `CHROMIUM_EXECUTABLE`, optional `OUTPUT_DIR`; run `node capture.mjs`, then `python3 check.py /tmp/527-variance` with `pypdf`. Checker prints diagnostics and does not signal acceptance by exit code. This does not test the real Reader button, native print dialog, physical devices, Windows, WebKit/Firefox, visual clipping or full document parity. Ask the other witness for exact Chromium build/OS, viewport/DPR/isMobile, font inventory, load/wait sequence, print options, server/build and raw output before comparing like-for-like. #2349 remains open.
