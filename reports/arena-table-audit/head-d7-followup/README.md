# Reader independent follow-up at PR #2352 `d7c136761`

Exact detached checkout `d7c1367614f72dd26e61f741fa6c92a3fe908caa`, independently built Astro (112 pages) and copy-legacy production-like/no-manifest. Read comments through W127: W124–W127 change toolbar, preview defaults and study accordion; W107 notes candidate and SYS ownership handoff stay separate. No product edits, no Pagefind indexing/search or quiz acceptance. Chromium CDP, service workers blocked, no physical or native-dialog testing.

## #2349 cold PDF

320/390 × direct and real button handler with stubbed `window.print`/synthetic `beforeprint` × 2 fresh contexts × first/repeat. Last complete article paragraph present 16/16. Author/SDG/accuracy details missing 8/8 first PDFs and 4/4 repeats at 320; present 4/4 repeats at 390. Checker exits 1; [output](cold-check.txt), [manifest](cold-manifest.json), [reproduction](../cold-pdf-regression/). Not a native Chrome Save as PDF test, visual proof or release approval.

## Gill tables #577

320 native, chronology 8×3 and comparison 5×3; all 39 cell texts match whitespace-normalized PDF extraction, 28 pages; wrapper 246/246, document 320/320. PyMuPDF word positions place each of three header labels on pages 5/6 and 7/8 respectively. Static tables have zero focus stops within first 75 Tabs. [DOM/AX/Tab data](d7-gill-table.json), [capture](../head-58f-visual-evidence/gill-320-probe.mjs). Not a new visual or screen-reader signoff.

## Preview URL and boundary

Rebuilt preview.py from this exact checkout, not the previous Python process. [URL-mode probe](url-mode.mjs): 4 widths × normal URL/UTM/explicit `reader-pilot=0`/explicit `reader-pilot=1`, 16 fresh contexts, all 16 match expected mode, zero overflow or page errors. 390 and 1120 native for all modes; 1121 and 1440 default/UTM/opt-in W57 + annotations ready + one notes detail; opt-out native. [Raw](d7-url-mode.json). This is **preview.py behavior only**, not production URL behavior. Desktop readiness is not visual or interaction acceptance.

Additionally, prior [boundary probe](../head-228118-boundary/w57-boundary.mjs) with explicit pilot passes 390/1120 native TOC, Settings, Escape, speed point and play-center hit; 1121/1440 W57 readiness only. [Raw](d7-w57-boundary.json). No WebKit, zoom, resizing, AT or complete W124–W127 acceptance. Draft/HOLD maintained.

Reproduce URL probe with Playwright available to Node, `CHROMIUM_EXECUTABLE=/path/to/chromium W57_BASE_URL=http://127.0.0.1:19063 node url-mode.mjs`. `OUTPUT` overrides its default `/tmp/d7-url-mode.json`.
