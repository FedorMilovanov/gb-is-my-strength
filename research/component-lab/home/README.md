# Home component lab

**Boundary:** `NON_PRODUCTION_COMPONENT_LAB`  
**Authority:** `data/home-component-lab-inventory-2026-08-01.json`

This directory preserves bounded Home interaction and information-architecture specimens. It is not a route, package, asset source, shared component library or fallback implementation.

## Rules

- Production code must not import, fetch, copy or link this directory.
- No file here may be registered in route ownership, Pagefind, sitemap, RSS, service worker, cache-bust or deployment inputs.
- A specimen must use the `.html.txt` suffix: repository-wide reader contracts intentionally classify every real `.html` file as a reader surface.
- Specimens are explanatory reductions, not canonical markup.
- Any promotion requires a new owner-approved Home lane built from current `main`, not a copy operation from this lab.
- Accessibility and reduced-motion boundaries remain mandatory even for visual experiments.

## Specimens

`specimen.html.txt` contains four isolated references. Save a temporary local copy with an `.html` suffix only when manually viewing it outside the repository:

1. `sacred-word-inline-flip` — semantic source/translation disclosure;
2. `legacy-functional-index` — the useful information-density idea from the legacy preamble;
3. `five-direction-gateway` — the current route-gateway composition as an abstract specimen;
4. `route-card-tilt-motion` — optional depth with a mandatory reduced-motion fallback.

The real production owners remain under `src/components/home/`; this lab deliberately imports nothing from them.
