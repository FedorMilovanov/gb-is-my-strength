# Lane: premiumcontrols-surgical-finish-2026-06-27

**Date:** 2026-06-27
**Branch:** `lane/premiumcontrols-surgical-finish-2026-06-27`
**Base:** `251649fc` (`origin/main`)
**Mode:** HIGH-RISK lane — shared runtime/CSS + cache-bust convergence
**Scope:** surgical completion/stabilization of PremiumControls only. No repositioning, no size redesign, no Gill template migration.

## Why this lane exists

AuditRepo and source history showed that PremiumControls was mostly feature-complete, but still fragile around three thin desync points:

1. **TTS cancel/rate/pause race:** `speechSynthesis.cancel()` can fire `onend`; the old controller could skip chunks or double-start when pausing or changing speed.
2. **Speed pill viewport correction:** JS overwrote `style.transform`, which could desync CSS-owned geometry for left-bloom vs Gill/mobile up-bloom.
3. **Acceptance/guard drift:** canonical PremiumControls rollout audit existed but had no package script; hover CSS opened speed buttons without preserving the intended stagger before JS hydration.

## Changes

### `js/floating-cluster-controller.js`
- Added `ttsState.runId` + `ttsState.suppressEnd` guards.
- Hardened `speakNextChunk()` so stale/cancelled utterance callbacks cannot advance queue or spawn duplicates.
- Hardened `pauseTts()`, `resumeTts()`, `stopTts()`, and live `gb:tts-rate-change` restart path.
- Kept Russian voice picker and canonical `gb:audio:rate` + legacy `gbx-tts-rate` write/read behavior.
- Changed speed panel container role from `group` to `radiogroup`; initial active speed now also has `aria-checked="true"`.
- Changed viewport guard to set only `--gb-ember-shift`; it no longer overwrites inline `transform`.
- Simplified save-state sync to PremiumControls' `gb-favorites` truth with old `fc:saved:<path>` compatibility; removed misleading dependency on BookmarkEngine reading-position engine.

### `css/floating-cluster.css`
- Added `--gb-ember-shift` into the CSS-owned transforms for:
  - desktop left-bloom pill,
  - Gill rail upward pill,
  - mobile upward pill.
- Restored 25ms stagger for pure CSS hover/focus reveal so pre-JS hover still matches premium interaction spec.

### `package.json`
- Added `audit:premium-controls` → `node scripts/premium-controls-rollout-audit.js`.

### Cache-bust
- Ran `npm run cache-bust`; synchronized `floating-cluster.css` and `floating-cluster-controller.js` hashes across root HTML and Astro sources.

## Verification

Environment: Node `v22.12.0` from `/tmp/node-v22.12.0-linux-x64/bin`.

- `node --check js/floating-cluster-controller.js` ✅
- `git diff --check` ✅
- `npm run cache-bust` ✅
- `npm run strangler:build:production-like` ✅ — 53 pages built, copy-legacy complete, postbuild hash drift 0
- `npm run audit:premium-controls` ✅ — 28/28, 26 PremiumControls pages scoped + controller loaded, no double CSS delivery
- `npm run owner:ui-guard` ✅
- `npm run data:consistency` ✅
- Playwright targeted smoke (temporary `.arena/premiumcontrols-smoke.js`, not committed) ✅:
  - Hermeneutics hover opens 6-speed pill, `role=radiogroup`, exactly one `aria-checked=true`.
  - Play starts TTS with mocked `Google русский` voice, `ru-RU` utterance.
  - Speed `1.75×` writes both `gb:audio:rate` and `gbx-tts-rate`, restarts current chunk path.
  - Gill context hover opens upward speed pill above Play.

`guard:shared-files` before commit intentionally failed because shared-file guard requires the current commit message to contain `[LANE lane/premiumcontrols-surgical-finish-2026-06-27]`. Re-run after the lane commit.

## Explicit non-changes

- Did not move `.gb-floater`, `.gb-floater--hermeneutics`, Gill rail geometry, or mobile bottom pill position.
- Did not change Play/Save/icon sizes.
- Did not refactor the monolithic controller into modules.
- Did not touch Gill v16 convergence or GBS2 legacy template migration.
