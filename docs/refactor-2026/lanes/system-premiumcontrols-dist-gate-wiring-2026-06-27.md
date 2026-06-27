# Lane report — system-premiumcontrols-dist-gate-wiring-2026-06-27

**Date:** 2026-06-27  
**Branch:** `lane/system-premiumcontrols-dist-gate-wiring-2026-06-27`  
**Base:** current `origin/main` after PremiumControls bulletproof guards (`23f283d4`)  
**Mode:** SYSTEM / guard wiring only

## Why

A 55-check current-main reverify showed the PremiumControls rollout audit exists as `npm run audit:premium-controls`, and `dist:jsonld:audit` is already rooted to `dist`, but the PremiumControls dist audit was not yet wired into the production-like dist barrier or deploy workflow.

This left a second-order gap: the smart/bulletproof audit can pass manually but still be skipped by `strangler:audit:production-like` and GitHub Pages deploy.

## Change

- `package.json`: run `npm run audit:premium-controls` inside `strangler:audit:production-like` after `dist:jsonld:audit` and before browser dist smoke.
- `.github/workflows/deploy.yml`: run `npm run audit:premium-controls` after dist JSON-LD parse audit.
- `scripts/check-workflows.js`: policy now requires PremiumControls rollout audit in both production-like dist gate and deploy workflow.

## Non-goals

- No visual/position/speed-pill retuning.
- No controller split.
- No CSS architecture decision.
- No changes to route content.

## Verification

```text
npm run workflows:check       ✅ PASS
npm run guard:shared-files    ✅ PASS after commit
node -e package wiring check  ✅ PASS
```

Full dist build was already proven green earlier in the session on the prior wiring branch; current Arena later hit OOM exit 137 when trying to rebuild after many audit processes. This lane is wiring-only and does not alter build output.
