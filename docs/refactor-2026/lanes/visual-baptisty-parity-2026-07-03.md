# Lane: visual-baptisty-parity-2026-07-03

**Date:** 2026-07-03  
**Mode:** LANE  
**Branch:** `lane/visual-baptisty-parity-2026-07-03`  
**Base source HEAD:** `d5c65647d57cf3bc83b6543cb58135cdd279013f`

## Goal

Close `NEW-65` / `VIS-BAPTISTY-PARITY`: `/baptisty-rossii/` legacy-root vs production-like dist pixel diff was failing by a single 72.5px rail-foot delta.

## Root cause

The strict-native Astro/dist version of `/baptisty-rossii/` includes the current Baptisty PremiumControls rail footer:

- `data-fc-root data-fc-mode="series-lite" data-fc-variant="baptisty"`
- `gb-ember` Play control
- `gb-save` Save control
- `floating-cluster.css`
- `floating-cluster-controller.js`

The root legacy baseline `baptisty-rossii/index.html` was stale and still had the pre-PremiumControls `gbs2-rfoot`. The browser controller inserted the PlayEmber speed panel only in dist, increasing `.gbs2-rfoot` from 31.5px to 104px and shifting the page by 72.5px.

## Changes

- Synced root `baptisty-rossii/index.html` to the current dist-owned PremiumControls footer contract.
- Added the missing root `floating-cluster.css` stylesheet link and `floating-cluster-controller.js` script for parity with dist.

## Explicit non-changes

- No changes to `src/components/baptisty-rossii/BaptistyRossiiBody.astro`.
- No changes to PremiumControls CSS/JS geometry.
- No changes to article content or series data.

## Verification

- `npm run strangler:build:production-like` ✅
- `node scripts/visual-parity-screenshots.js --routes /baptisty-rossii/ --threshold 1.0` ✅
  - desktop diff: 0.000% (`1280x12956` vs `1280x12956`)
  - mobile diff: 0.000% (`391x10656` vs `391x10656`)
- `npm run owner:ui-guard` ✅
- `npm run audit:premium-controls` ✅ 87/87
- `npm run baptisty-rossii:visual-parity:audit` ✅
