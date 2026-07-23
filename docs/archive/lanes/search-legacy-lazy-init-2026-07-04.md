# Archived lane: search-legacy-lazy-init-2026-07-04

**Archived:** 2026-07-23  
**Original base source HEAD:** `6e66797834dfd203ae0111070848adadee5c76b8`  
**Original branch:** `lane/search-legacy-lazy-init-2026-07-04`

This lane record was moved out of the active `docs/refactor-2026/lanes/` surface after current-head verification showed that it is historical evidence only. The implemented behavior is now guarded by current runtime/publication contracts; this document must not be treated as current operational truth.

## Historical goal

Continue reducing `P2-SEARCH-EAGER` on legacy/full-document pages. Previous work lazy-loaded `search.js` on BaseLayout/Astro-native pages, while legacy pages still included `<script src=".../js/search.js" defer>` and could build command-palette DOM/request search data during initial load.

## Historical changes

### `js/search.js`

A self-lazy bootstrap guard was added:

- first eager execution installed a `GBSearch` stub and event listeners, then returned without creating `.cp-*` DOM;
- first `Ctrl/⌘+K`, search-button click, or `gb:openSearch` event loaded/reran `search.js` for full initialization;
- after initialization, pending open intent opened the command palette.

### `src/layouts/BaseLayout.astro`

The lazy loader was updated so `Ctrl/⌘+K` opens search after script load, while a generic first click/touch only preloads it.

### Historical cache-bust

`js/search.js` hash was updated to `fb5cf04f` across root HTML, Astro sources, and `src/lib/asset-version.js`.

## Historical verification

- `node --check js/search.js` passed;
- `npm run cache-bust` passed;
- production-like strangler build passed;
- Playwright smoke showed zero initial `.cp-*` nodes and no initial manifest/Pagefind request;
- `Ctrl+K` loaded and opened search;
- validation, dist smoke, PremiumControls and shared-file guard passed at that historical head.

## Current status

The lane is complete and no longer belongs in the active refactor queue. Any new search-loading defect must be reproduced against current `main` and registered as a new matrix row with a current immutable witness.
