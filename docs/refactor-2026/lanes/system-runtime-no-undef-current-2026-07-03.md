# Lane: system-runtime-no-undef-current-2026-07-03

**Date:** 2026-07-03  
**Mode:** SYSTEM  
**Branch:** `lane/system-runtime-no-undef-current-2026-07-03`  
**Base source HEAD:** `4cbe8e88afb3fe13fd04fdae08c1770122a01952`

## Goal

Close the current browser-runtime no-undef deploy blocker without touching PremiumControls/Gill geometry or visual constants.

## Changes

- `js/site.js`: added a local `tt()` HTML-escape helper inside the backlinks/outlinks IIFE (`§2.4a`) so that `tt(n.title)` is resolved in the same strict-IIFE scope.
- `js/nagornaya-mobile-toc.js`: fixed `safeReady()` to call `window.SiteUtils.ready(fn)` when `SiteUtils` already exists, instead of calling undefined `window.safeReady(fn)`.
- Ran `npm run cache-bust`, synchronizing JS hashes in root HTML, Astro source references, and `src/lib/asset-version.js`.

## Explicit non-changes

- Did not change Gill v16 rail/mobile layout, PlayEmber geometry, PremiumControls CSS, Hermeneutics position, or route migration modes.
- Did not touch P2 search eager DOM, CSS breakpoint debt, visual parity baselines, or security-header infrastructure.

## Verification

Environment: Node `v22.14.0`, Playwright Chromium installed with system deps.

- `for f in js/*.js sw.js; do node --check "$f"; done` ✅
- `npm run cache-bust` ✅
- `git diff --check` ✅
- `npm run strangler:build:production-like` ✅
- `npm run gill:mobile-layout:audit` ✅
- `npm run gill:mobile-play:smoke` ✅
- `node scripts/dist-smoke-audit.js --no-build --production-like` ✅
- `npm run audit:premium-controls` ✅ — 87/87
- `npm run css:layer:validate` ✅
- `npm run tokens:check` ✅
- `npm run validate:static-publication` ✅

## Notes

`npm run guard:shared-files` must be re-run after the lane commit because the guard requires the current commit message to contain `[LANE lane/system-runtime-no-undef-current-2026-07-03]` for shared/system files.
