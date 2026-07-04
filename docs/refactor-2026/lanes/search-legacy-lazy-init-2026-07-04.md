# Lane: search-legacy-lazy-init-2026-07-04

**Date:** 2026-07-04  
**Mode:** SYSTEM  
**Branch:** `lane/search-legacy-lazy-init-2026-07-04`  
**Base source HEAD:** `6e66797834dfd203ae0111070848adadee5c76b8`

## Goal

Continue reducing `P2-SEARCH-EAGER` on legacy/full-document pages. Previous fix lazy-loaded `search.js` on BaseLayout/Astro-native pages, but legacy pages that still include `<script src=".../js/search.js" defer>` built the full command-palette DOM and requested search data on initial page load.

## Changes

### `js/search.js`

Added a tiny self-lazy bootstrap guard at the top of `search.js`:

- first eager execution installs a `GBSearch` stub and event listeners, then returns without creating `.cp-*` DOM;
- first `Ctrl/⌘+K`, search button click, or `gb:openSearch` event loads/reruns `search.js` for full initialization;
- after full initialization, pending open intent opens the command palette.

This keeps legacy script tags compatible while preventing initial DOM construction and eager `/data/search-manifest.json` / Pagefind work.

### `src/layouts/BaseLayout.astro`

Updated the existing lazy loader so `Ctrl/⌘+K` opens search after the lazy script loads, while generic first click/touch only preloads without opening.

### Cache-bust

Ran `npm run cache-bust`; `js/search.js` hash updated to `fb5cf04f` across root HTML, Astro sources, and `src/lib/asset-version.js`.

## Verification

- `node --check js/search.js` ✅
- `npm run cache-bust` ✅
- `npm run strangler:build:production-like` ✅
- Custom Playwright smoke on production-like `dist` ✅:
  - routes: `/articles/kod-da-vinchi/`, `/about/`, `/`
  - initial `.cp-*` nodes: `0`
  - initial `GBSearch` stub present
  - no initial `/data/search-manifest.json` / Pagefind requests
  - `Ctrl+K` loads full search and opens palette
- `npm run validate:all` ✅ (0 errors; existing SEO warning on hard-texts recommended OG ratio)
- `node scripts/dist-smoke-audit.js --no-build --production-like` ✅
- `npm run audit:premium-controls` ✅ 87/87
- `git diff --check` ✅
- `npm run guard:shared-files` ✅ after lane commit

## Remaining search note

Legacy pages still download the small first-pass `search.js` response because script tags remain. This lane fixes the eager DOM/data work across legacy pages. Full network lazy-loading of legacy script tags would require replacing many legacy footer script tags with a separate loader contract and should be a separate, higher-risk lane.
