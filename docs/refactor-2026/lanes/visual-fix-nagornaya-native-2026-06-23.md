# Lane Report — visual-fix-nagornaya-native-2026-06-23

Branch: `lane/visual-fix-nagornaya-native-2026-06-23`  
Mode: LANE  
Scope: 100% native Nagornaya world: `/nagornaya/`, `/nagornaya/chast-1/` … `/chast-5/`, `/seriya/`, `/istochniki/`, `/nakhodki/`  
Date: 2026-06-23

## What I found

Existing Nagornaya work was spread across several branches/commits:

- `lane/nagornaya-pagefind-audit-stabilization` — audit/pagefind stabilization, but it also reintroduced `_legacy` fragments and touches many shared/system files; not used as merge base for this route lane.
- `lane/nagornaya-componentization` commits already merged into `main` — componentized `chast-2..5`.
- Shared history in many visual-fix branches includes Nagornaya componentization commits.

Main still had two visual-native gaps:

1. `/nagornaya/` and `/nagornaya/chast-1/` were the unclosed V9/V8 visual tasks.
2. All Nagornaya routes still used `loadLegacyFullDocument()` for head and several routes still had `_legacy` fragment transport. Some article pages also split an opening `<main>` / accuracy block across separate Astro components, which is unsafe because Astro serializes component roots independently.

## What changed

- All 9 Nagornaya routes now use native `PageHead` components instead of `loadLegacyFullDocument()`.
- All 9 routes now use native Astro markup only: no `?raw`, no `_legacy/`, no `<Fragment set:html>`, no legacy full-document loader.
- All 9 routes use balanced main/body components, so wrappers are not split across component boundaries.
- Retired `src/components/nagornaya/NagornayaPageMain.astro` raw-fragment loader.
- Deleted all `src/components/nagornaya/**/_legacy` fragment directories.
- Fixed an unresolved merge-marker bug in `nagornaya/chast-5/index.html` and the generated native footer.
- Rewrote `scripts/nagornaya-visual-parity-audit.js` to enforce the 100% native Nagornaya contract.

## Checks

- [x] `npm run astro:check` — pass.
- [x] `npm run astro:build` — pass.
- [x] `npm run validate:static-publication` — pass.
- [x] `npm run nagornaya:visual-parity:audit` — pass.
- [x] `npm run guard:shared-files` — pass.
- [x] `npm run data:consistency` — pass.
- [x] Playwright/pixelmatch visual diff for all 9 Nagornaya routes at threshold `0` — pass.

## Visual verification

Command:

```bash
npm run astro:build
node scripts/copy-legacy-to-dist.js --omit-build-only
node scripts/visual-parity-screenshots.js \
  --routes /nagornaya/,/nagornaya/chast-1/,/nagornaya/chast-2/,/nagornaya/chast-3/,/nagornaya/chast-4/,/nagornaya/chast-5/,/nagornaya/seriya/,/nagornaya/istochniki/,/nagornaya/nakhodki/ \
  --threshold 0 \
  --out reports/visual-parity/nagornaya-native-all3-1782226267
```

Result: **18/18 exact**.

- `/nagornaya/`: desktop/mobile `0`, dimensions equal.
- `/nagornaya/chast-1/`: desktop/mobile `0`, dimensions equal.
- `/nagornaya/chast-2/`: desktop/mobile `0`, dimensions equal.
- `/nagornaya/chast-3/`: desktop/mobile `0`, dimensions equal.
- `/nagornaya/chast-4/`: desktop/mobile `0`, dimensions equal.
- `/nagornaya/chast-5/`: desktop/mobile `0`, dimensions equal.
- `/nagornaya/seriya/`: desktop/mobile `0`, dimensions equal.
- `/nagornaya/istochniki/`: desktop/mobile `0`, dimensions equal.
- `/nagornaya/nakhodki/`: desktop/mobile `0`, dimensions equal.

Committed proof:

- `docs/refactor-2026/lanes/visual-fix-nagornaya-native-2026-06-23/visual/summary.json`
- `docs/refactor-2026/lanes/visual-fix-nagornaya-native-2026-06-23/visual/*-diff.png`

## Out-of-lane findings

- `lane/nagornaya-pagefind-audit-stabilization` contains useful audit ideas, but it also changes shared/system files and reintroduces `_legacy` fragments. I did not merge it directly.
- Historical visual verification without production-like asset copy can overstate diffs. This lane uses `copy-legacy-to-dist --omit-build-only` before Playwright screenshots.
- `npm ci` remains not reproducible in this sandbox because `package-lock.json` is not in sync with `package.json`; I did not touch `package.json`/`package-lock.json`.

## Merge recommendation

merge after review of generated native markup size.
