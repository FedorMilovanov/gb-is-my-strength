# Lane: system-sw-pagefind-bootstrap-2026-07-03

**Date:** 2026-07-03  
**Mode:** SYSTEM  
**Branch:** `lane/system-sw-pagefind-bootstrap-2026-07-03`  
**Base source HEAD:** `8a816ce40c57e916797aa37f275e3518ca757203`

## Goal

Close the hidden GitHub Pages deploy blocker reached after the runtime no-undef fix: `Service Worker deploy-switch readiness` failed because `/pagefind/pagefind.js` was built into `dist/pagefind/` but absent from `sw.js` `PRECACHE_ASSETS` while the deploy switch gate runs with `--require-pagefind`.

## Changes

- `sw.js`: added `/pagefind/pagefind.js` to `PRECACHE_ASSETS`.
- `sw.js`: bumped `CACHE_VERSION` to `gb-v187-pagefind-bootstrap-20260703` to evict stale SW caches after the precache contract change.

## Explicit non-changes

- Did not touch PremiumControls/Gill geometry or visual CSS.
- Did not change Pagefind build order or SW cache strategies.
- Did not precache HTML content pages.

## Verification

- `node --check sw.js` ✅
- `git diff --check` ✅
- `npm run strangler:build:production-like` ✅
- `npm run pagefind:build:dist` ✅
- `npm run sw:dist:audit:deploy-switch` ✅
- `node scripts/dist-smoke-audit.js --no-build --production-like` ✅
- `npm run gill:mobile-layout:audit` ✅
- `npm run audit:premium-controls` ✅
- `npm run validate:static-publication` ✅

## Notes

`validate:static-publication` runs `sw:dist:audit` without `--require-pagefind`; the deploy workflow runs the stricter deploy-switch variant after Pagefind build. This lane fixes the stricter deploy-switch contract.
