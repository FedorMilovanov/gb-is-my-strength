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

## Follow-up in same lane: dist-publication Gill marker drift

After enabling 4 GiB swap and re-running `strangler:audit:production-like`, the build completed but `dist-publication-audit.js` failed on four Gill routes because it still expected legacy `gbs2-rail` markers for v16-converged Gill pages.

That was stale guard truth: current Gill v16 dist uses `data-gill-v16` + `gbs-rail`. The audit was updated to require those v16 markers for all five Gill routes.

## Final verification after swap-backed full dist gate

Arena RAM mitigation used:

```bash
sudo fallocate -l 4G /swapfile-arena
sudo chmod 600 /swapfile-arena
sudo mkswap /swapfile-arena
sudo swapon /swapfile-arena
```

This changed effective memory from ~1.9 GiB RAM / 0 swap to ~1.9 GiB RAM + 4 GiB swap. With Node 22 in PATH and Playwright deps already installed, the full production-like dist barrier completed.

Final gates:

```text
npm run validate:static-publication        ✅ PASS
npm run strangler:audit:production-like    ✅ PASS
node scripts/dist-publication-audit.js --require-pagefind --forbid-dev ✅ PASS
npm run workflows:check                    ✅ PASS
npm run guard:shared-files                 ✅ PASS after commit
```

PremiumControls dist gate result inside `strangler:audit:production-like`:

```text
PremiumControls rollout audit: 39/39 passed
✅ PremiumControls rollout contract OK.
```
