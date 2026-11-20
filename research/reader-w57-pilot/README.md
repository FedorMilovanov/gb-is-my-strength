# Reader — W57 integration candidate (draft only)

**Status: research/QA preview. Not published and not merged.**

This folder records the **last visually accepted local W57 source chain** and makes it
reproducible against an Astro `dist/` built from this repository. It is not another
Reader product and does **not** load into production unless the opt-in preview server
is explicitly run. Canonical production Reader remains the existing Astro components.

## Run

1. Build the repository's current branch to `dist/`.
2. Run `python research/reader-w57-pilot/preview.py` (Python 3.11+).
3. Open `http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space`.

**Explicit views (same W57 source, no guesswork):**

- Folded panel / floating vertical actions:
  `http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space&panel=closed`
- Open research panel / inline actions in its heading:
  `http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space&panel=open`

At widths **1280px and above**, the original pilot opens the right panel by default
if `panel` is absent. At **1121–1279px**, it is folded by default. Both
explicit parameters override that initial desktop setting and remain stable
across reloads; the user can still toggle normally. Mobile ignores them.
The reference screenshots for aligned SVGs were taken in the **folded** state.
Resources are served with `Cache-Control: no-store`; differing screenshots
represent different UI states, not different production versions.

4. Compare independent article at `/articles/kod-da-vinchi/?reader-pilot=1&paper=space`.
5. Preview server binds **only** to localhost; it never writes to production, commits, or a live site.

Environment overrides: `READER_W57_DIST` (absolute Astro dist path) and
`READER_W57_PORT` (default `19061`). An ordinary URL without
`?reader-pilot=1` serves the unchanged built site.

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
  `MANIFEST.json`; injection order matches the working local W57 pilot.
- Running the preview is opt-in and does not modify `main`, generated pages,
  canonical styles, or the site service worker.
- To promote: port the *behavior and design* into the existing canonical Reader
  owner, remove duplicate controllers/legacy-specific overrides, complete
  Chromium + WebKit screenshot/interaction tests on 320, 390, 768, 1121,
  1360, 1440 and 1920 widths, run project checks, and obtain visual sign-off.
- **Do not merge PR #2346** until the canonical article contains the genuine
  right research panel and its working fold control, not merely the staged
  preview and existing Gill-specific CSS. Retain Draft/HOLD.

## Historical references

W47 and W51 local screenshots (18 November 2026) show the original behavior:
the panel control belonged to the right panel and appeared at the top when
folded and in the panel header when open. W57 is the latest accepted styling
reference; 'ARGON' is the design prototype name, not the website/Reader brand.
