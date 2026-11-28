# Reader — canonical Astro W57 integration candidate (draft only)

## SINGLE LOCAL PREVIEW — W136 operator contract (2026-11-23)

**One source / one existing working copy / one port.** The validated Windows
working copy on `DESKTOP-O3FDOA4` is `E:\\GB_READER_W107_PREVIEW_20261123`
and the stable local address is `http://127.0.0.1:19181`. This location is
machine-specific; never create another dated Reader clone for visual review.

1. Connect Remote Desktop Commander through the currently authorized account;
   confirm `DESKTOP-O3FDOA4` online. Check `git status --porcelain` in
   the existing preview repo: **do not switch commits if dirty**. Fetch the
   latest PR #2352 head, verify its exact SHA, then switch/detach **only the
   clean preview working tree**. Never move branches of another agent.
2. Use Node **v22.23.4** process-locally (`C:\\Users\\Fedor\\AppData\\Local\\nvm\\v22.23.4`
   in `PATH`); `node` v22.23.1 fails the Astro contract. Use `npm.cmd` or
   explicit `node.exe ...\\npm-cli.js`, not `npm.ps1` with blocked execution policy.
3. Build the complete production-like site with **`npm run strangler:build`**.
   `npm run astro:build` alone is **not a runnable Reader preview**: it
   omits copied legacy `css/`, `js/`, images and other shared assets.
   **For Reader Search/Pagefind checks, complete the same build with**
   `npm run pagefind:build:dist` **before browser QA**, and confirm
   `dist/pagefind/pagefind.js` exists (HTTP 200 at
   `http://127.0.0.1:19181/pagefind/pagefind.js` once preview is running).
   `strangler:build` alone does not generate that index: the Search palette
   can open while Pagefind stays unavailable, producing misleading browser
   timeouts. Regenerate this index after *each* full rebuild; never diagnose
   Pagefind from an incomplete `dist`.
4. Close only the verified existing listener at `19181` (inspect PID and
   command line first). Run the canonical server (from the existing repo):
   ```powershell
   $env:READER_W57_DIST = "E:\\GB_READER_W107_PREVIEW_20261123\\dist"
   $env:READER_W57_PORT = "19181"
   python research/reader-w57-pilot/preview.py
   ```
   The server now serves canonical static Astro HTML and never injects the
   W57 presentation. A plain static server serves the same built page.
5. Browser-verify the actual compiled page at
   `/articles/dzhon-gill-chast-1-chelovek/?reader-pilot=1&paper=space&panel=open`:
   desktop width >=1121px has `body.np-w57-ready` and a visible
   `#npUResearch` panel. At 390px the same page is native mobile (no W57).
   Confirm CSS/JS 200, no runtime errors/overflow, screenshot **both** states.
   `?reader-pilot=0` is deliberately the **old native desktop comparison**.
   The server must never be represented as already merged production.
6. Verify modal reading-position contract: open Part TOC at a scrolled paragraph,
   press **Продолжить**, and require the **same** `scrollY` (tolerance <=2px).
   A TOC section link, by contrast, must intentionally navigate.

**Disk hygiene:** do not delete any dirty agent worktrees, unique/unpushed
Git commits, untracked evidence or archives, or active server directories.
Inventory first; clean only proven rebuildable unused generated assets and
redundant *clean* copies with no unique content. One preview worktree is enough.
For the reproduction, exact SHA, and release HOLD, see Reader PR #2352
comment `#issuecomment-7113946035`.

---

**Status: canonical Astro integration candidate. Not released or merged.**

This folder records the **last visually accepted local W57 source chain** and makes it
reproducible against an Astro `dist/` built from this repository. It is not another
Reader product. The Astro build hook projects the approved head-tail resources
only into registered reading routes. Existing Reader components remain the
canonical native controls and state owners; Python serves the result without mutation.

## Run

1. Build the repository's current branch to `dist/`.
2. Run `python research/reader-w57-pilot/preview.py` (Python 3.11+).
3. Open `http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/` — W57 loads **by default on desktop (≥1121px)**; native Reader stays on mobile.

**Explicit views (same W57 source, no guesswork):**

- Folded panel / floating vertical actions:
  `http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space&panel=closed`
- Open research panel / inline actions in its heading:
  `http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space&panel=open`

The right research panel is **folded by default at all desktop widths**,
with no query parameter needed. Users may open it with the right rail button. Both
explicit parameters override that initial desktop setting and remain stable
across reloads; the user can still toggle normally. Mobile ignores them.
The reference screenshots for aligned SVGs were taken in the **folded** state.
Resources are served with `Cache-Control: no-store`; differing screenshots
represent different UI states, not different production versions.

4. Compare independent article at `/articles/kod-da-vinchi/?reader-pilot=1&paper=space`.
5. Preview server binds **only** to localhost; it never writes to production, commits, or a live site.

Environment overrides: `READER_W57_DIST` (absolute Astro dist path) and
`READER_W57_PORT` (default `19061`). An ordinary Reader URL now loads the
W57 preview on desktop, even with `utm_source`; it no longer silently falls
back to the old desktop design. Add `?reader-pilot=0` to deliberately compare
the native desktop. All mobile widths remain native (CSS and JS desktop-gated).
These defaults are owned by the built document, not the localhost server.
With JavaScript disabled, or `?reader-pilot=0`, desktop presentation styles stay inactive.

## Scrollbar-safe single-axis positioning

All floating actions share **one CSS right-side containing block**.
The 40px reading toolbar uses `right:5vw`, and the 44px Library and
fold controls use `right:calc(5vw - 2px)`. Their visible centers coincide,
even in Windows browsers with a classic 16–17px scrollbar.
Never reintroduce mixed `left:calc(95vw ...)` or JS-measured X coordinates.
The desktop research panel starts **closed** on first load.

## Baseline and visual contract

- On desktop with research panel **folded**, the original panel toggle and
  ordinary reading actions are on a shared horizontal axis but form two visual
  groups; a discreet **20×1 px hairline** separates them. No hover fill.
- The Library is the original **book SVG**, no frame, gradient, circular disk
  or shadow, with an invisible **44×44 px** interaction target.
- The Library shares the exact X axis with Theme/Search/Play/Bookmark and remains
  fixed through library modal open/close, page scroll and repeat fold/unfold.
- The ordinary-article legacy toolbar and the Gill-series toolbar use one
  **viewport-derived axis**, not a measurement of one another (formerly a
  positive feedback loop that made the controls drift horizontally).
- The real research panel retains working collapse/restore and editorial
  controls. Mobile remains the existing native flow, not a duplicate toolbar.
- Preserve hover focus and keyboard focus; all touch targets >=44 px where
  applicable. Check both light/dark and short viewport heights.

These are acceptance criteria, **not** permission to copy pilot injection into
production. Tests of canonical code must assert the presence of functional panel
and toggle, and compare screenshots in **both states**. Geometry tests alone
missed a major feature-parity regression in PR #2346.

## Source and release gates

- `assets/` contains the 12 real W57 CSS/JS files, with SHA-256 checksums in
  `MANIFEST.json`; canonical head and runtime order match the accepted W57 reference.
- Running the static preview does not modify `main`, generated pages,
  canonical styles, or the site service worker.
- Before release: verify the canonical build integration, remove duplicate
  controllers/legacy-specific overrides only after parity, complete
  Chromium + WebKit screenshot/interaction tests on 320, 390, 768, 1121,
  1360, 1440 and 1920 widths, run project checks, and obtain visual sign-off.
- **Do not merge PR #2346** until the canonical article contains the genuine
  right research panel and its working fold control, not merely the staged
  preview and existing Gill-specific CSS. Retain Draft/HOLD.

## Historical references

W47 and W51 local screenshots (18 November 2026) show the original behavior:
the panel control belonged to the right panel and appeared at the top when
folded and in the panel header when open. W57 remains the **LOCKED desktop visual and functional reference**.
Owner correction on 2026-11-21: apply Classic styling ONLY to MOBILE Analytics.
The W58 desktop Classic styling was reverted. Do not alter desktop again. See
[`docs/READER-ARGON-CLASSIC-VISUAL-SOURCE-2026-11-21.md`](../../docs/READER-ARGON-CLASSIC-VISUAL-SOURCE-2026-11-21.md).
'ARGON' is a design prototype name, not the website/Reader brand.
