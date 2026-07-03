# Lane: system-dist-runtime-smoke-gate-2026-07-03

**Date:** 2026-07-03  
**Mode:** SYSTEM  
**Branch:** `lane/system-dist-runtime-smoke-gate-2026-07-03`  
**Base source HEAD:** `914c7fb11e51e25937e0afc0ef79118c7a246394`

## Goal

Close `NEW-64` prevention gap: deploy workflow caught the recent `tt` runtime no-undef only indirectly through Gill mobile layout audit. A broad representative browser runtime smoke existed (`dist-smoke-audit.js`) and was already part of `strangler:audit:production-like`, but it was not in the GitHub Pages deploy chain.

## Changes

- `.github/workflows/deploy.yml`: added blocking step `Broad production-like dist runtime smoke` after Gill mobile reference layout audit and before SW deploy-switch readiness:

```bash
node scripts/dist-smoke-audit.js --no-build --production-like
```

- `scripts/check-workflows.js`: added policy assertion so future agents cannot silently remove the deploy runtime smoke step.

## Explicit non-changes

- Did not change runtime JS/CSS.
- Did not change PremiumControls/Gill geometry.
- Did not change visual parity baselines.

## Verification

- `node --check scripts/check-workflows.js` ✅
- `npm run workflows:check` ✅
- `node scripts/dist-smoke-audit.js --no-build --production-like` ✅
- `npm run pagefind:build:dist && npm run sw:dist:audit:deploy-switch` ✅
- `git diff --check` ✅

## Notes

`sw:dist:audit:deploy-switch` requires Pagefind to be built first; this matches the deploy workflow order (`pagefind:build:dist` precedes SW deploy-switch readiness).
