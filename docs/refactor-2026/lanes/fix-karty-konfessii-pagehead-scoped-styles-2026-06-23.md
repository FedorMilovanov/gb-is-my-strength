# Lane: fix scoped PageHead styles for `/karty/` and `/konfessii/`

**Branch:** `lane/fix-karty-konfessii-pagehead-scoped-styles-2026-06-23`
**Scope:** surgical regression fix only — `KartyPageHead.astro` and `KonfessiiPageHead.astro`.

## Problem

After `ba62a41f merge: close remaining non-app routes to strict-native`, the Visual Parity Guard failed for `/karty/` and `/konfessii/` because the legacy inline styles extracted into Astro `PageHead` components were compiled as scoped Astro CSS (`data-astro-cid-*`), while the actual DOM lives in sibling components (`KartyMain`, `KonfessiiPageChrome`, `KonfessiiMain`). The scoped selectors therefore did not match the rendered markup.

## Fix

- `src/components/karty/KartyPageHead.astro`: `<style>` → `<style is:global>`
- `src/components/konfessii/KonfessiiPageHead.astro`: `<style>` → `<style is:global>`

No styles were moved to `site.css`, no design changes, no protected routes touched.

## Results

### Before

- `/karty/` desktop diff: ~21.052%, mobile diff: ~22.844%
- `/konfessii/` desktop diff: ~3.180%, mobile diff: ~10.683%

### After

- `/karty/` desktop diff: **0.000%**, mobile diff: **0.000%**
- `/konfessii/` desktop diff: **0.000%**, mobile diff: **0.000%**

## Checks

- `node -v`: **v22.12.0** ✅
- `npm ci`: **pass** ✅
- `npm run astro:check`: **pass** (0 errors, 0 warnings, 7 pre-existing hints) ✅
- `npm run astro:build`: **pass** (52 pages) ✅
- `node scripts/copy-legacy-to-dist.js --omit-build-only`: **pass** ✅
- `npm run native:runtime:audit:strict`: **pass** — strict-native 38, hybrid-raw-segments 0, full-body-shadow 0, legacy-shadow-app-intentional 14 ✅
- `npm run validate:static-publication`: **pass** ✅
- `npm run visual:parity:guard`: **pass** ✅
- `npm run karty:visual-parity:audit`: **pass** ✅
- `npm run konfessii:visual-parity:audit`: **pass** ✅
- Browser smoke (`/karty/`, `/konfessii/` desktop + mobile): **pass** ✅

## Verdict

**MERGE** — the scoped-style regression is fixed. All targeted routes return to 0.000% visual parity, native runtime taxonomy is unchanged, and no protected routes were modified. Baseline update was **not** required.
