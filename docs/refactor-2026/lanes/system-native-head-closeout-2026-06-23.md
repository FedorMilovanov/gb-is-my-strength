# Lane Report: `system-native-head-closeout-2026-06-23`

**Branch:** `lane/system-native-head-closeout-2026-06-23`  
**Mode:** SYSTEM  
**Scope:** Remove the last two `native-with-legacy-head` routes (`/about/`, `/articles/kod-da-vinchi/`) from legacy head/body transport and push current runtime taxonomy further toward strict-native.  
**Status:** review  
**Owner:** Arena Agent  
**Started:** 2026-06-23  
**Updated:** 2026-06-23

---

## Changed files

### About
- `src/pages/about/index.astro`
- `src/components/about/AboutPageChrome.astro`
- `src/components/about/AboutMain.astro`
- `src/components/about/AboutArticle.astro`
- `src/components/about/AboutAccuracyBlock.astro`
- removed `AboutFrameBefore.astro`, `AboutFrameAfter.astro`, and `src/components/about/_legacy/**`
- `scripts/about-visual-parity-audit.js`

### Kod Da Vinci
- `src/pages/articles/kod-da-vinchi/index.astro`
- `src/components/article-pilots/kod-da-vinchi/KodDaVinchiPageHead.astro`
- `scripts/article-mdx-pilot-audit.js`

### Contracts / audits
- `migration/route-migration-matrix.json`
- `scripts/native-runtime-taxonomy-audit.js`
- `scripts/check-route-migration-matrix.js`

### Docs / lane registry
- `docs/refactor-2026/lanes/README.md`
- `docs/refactor-2026/lanes/system-native-head-closeout-2026-06-23.md`

---

## What this lane closes

### `/about/`
- Removes `loadLegacyFullDocument` head/body transport.
- Switches to balanced native `AboutPageChrome + AboutMain`.
- Retires unbalanced frame split and `_legacy` transport.
- Keeps visual contract via updated `about-visual-parity-audit`.

### `/articles/kod-da-vinchi/`
- Removes `loadLegacyFullDocument` head/bodyAttributes transport.
- Adds native `KodDaVinchiPageHead.astro`.
- Keeps native PageChrome/MainShell/PageFooter stack.
- Leaves route strict-native at runtime after the final summary section promotion.

### Runtime taxonomy
- Pushes `strict-native` count from 14 → 16 on current `main`.
- Eliminates `native-with-legacy-head` category completely.

---

## Checks passed locally

```bash
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
npm run astro:build
node scripts/about-visual-parity-audit.js
node scripts/article-mdx-pilot-audit.js --require-content-parity
npm run native:runtime:audit:strict
node scripts/check-route-migration-matrix.js --strict
npm run validate:static-publication
```

All passed in this sandbox session.

---

## Resulting runtime taxonomy snapshot

```text
strict-native                    16
native-with-legacy-head          0
native-main-with-legacy-chrome   0
hybrid-raw-segments              18
full-body-shadow                  4
legacy-shadow-app-intentional    14
```

---

## Out-of-lane findings

- Biggest remaining non-app migration debt is still the `baptisty-rossii` cluster (`hybrid-raw-segments`).
- Full-body-shadow standalone articles still remain:
  - `20-antisovetov-pastoru`
  - `hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki`
  - `krajne-li-isporcheno-serdce`
  - `rimlyanam-7-veruyushchiy-ili-neveruyushchiy`
- Non-blocking warnings remain in migration/data checks for some maps/search-manifest coverage and some route marker expectations.

---

## Merge recommendation

`merge` — production gate is green after this lane.
