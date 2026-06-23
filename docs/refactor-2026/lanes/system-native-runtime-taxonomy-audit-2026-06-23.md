# Lane Report: `system-native-runtime-taxonomy-audit-2026-06-23`

**Branch:** `lane/system-native-runtime-taxonomy-audit-2026-06-23`  
**Mode:** SYSTEM  
**Scope:** Global native-runtime taxonomy audit + Nagornaya native branch verification  
**Status:** review  
**Owner:** Arena Agent  
**Started:** 2026-06-23  
**Updated:** 2026-06-23

---

## Changed files

- `scripts/native-runtime-taxonomy-audit.js` — new global taxonomy script.
- `package.json` — added `native:runtime:audit` and `native:runtime:audit:strict` npm scripts.
- `migration/route-migration-matrix.json` — aligned non-Gill/non-Nagornaya article contracts with current runtime reality.
- `docs/refactor-2026/lanes/system-native-runtime-taxonomy-audit-2026-06-23.md` — this report.

---

## 1. Nagornaya native branch verification

Checked detached worktree from:

```text
origin/lane/visual-fix-nagornaya-native-2026-06-23 @ 40430e86
```

Commands/results:

```bash
grep -RInE "loadLegacyFullDocument|bodyHtml|headHtml|bodyAttributes|set:html|\?raw|_legacy" \
  src/pages/nagornaya src/components/nagornaya
# ✅ no matches

npm run nagornaya:visual-parity:audit
# ✅ /nagornaya/* is 100% native Astro guarded — all 9 routes

npm run validate:static-publication
# ✅ passed (exit 0); non-strict metadata warnings remain pre-existing

node scripts/visual-parity-screenshots.js \
  --routes "/nagornaya/,/nagornaya/chast-1/,/nagornaya/chast-2/,/nagornaya/chast-3/,/nagornaya/chast-4/,/nagornaya/chast-5/,/nagornaya/seriya/,/nagornaya/istochniki/,/nagornaya/nakhodki/" \
  --threshold 0 \
  --out reports/visual-parity-nagornaya-native-check
# ✅ 9 routes × 2 viewports at ≤0%; all 18 pairs diff=0.000%
```

Important integration note:

- `origin/lane/visual-fix-nagornaya-native-2026-06-23` is included in `origin/lane/rollup-v1-v11-final-2026-06-23`.
- Direct branch merge into current `origin/main` is not recommended without the rollup/integrator context, because `origin/main` also contains newer independent commits and rollup includes V7-safe fixes around this lane.

---

## 2. Native runtime taxonomy audit

Added:

```bash
npm run native:runtime:audit
npm run native:runtime:audit:strict
```

Default mode is taxonomy/warn and exits 0. It classifies every production route from `migration/page-ownership.json` into:

```text
strict-native
native-with-legacy-head
native-main-with-legacy-chrome
hybrid-raw-segments
full-body-shadow
legacy-shadow-app-intentional
```

Current `main` taxonomy from this lane:

| Category | Count | % |
|---|---:|---:|
| strict-native | 0 | 0.0% |
| native-with-legacy-head | 11 | 21.2% |
| native-main-with-legacy-chrome | 0 | 0.0% |
| hybrid-raw-segments | 20 | 38.5% |
| full-body-shadow | 7 | 13.5% |
| legacy-shadow-app-intentional | 14 | 26.9% |

Strict mode intentionally fails on current `main` with 3 matrix drift problems:

```text
/articles/20-antisovetov-pastoru/: matrix says mdx-native-article, taxonomy=full-body-shadow
/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/: matrix says mdx-native-article, taxonomy=full-body-shadow
/articles/kod-da-vinchi/: matrix says mdx-native-article, taxonomy=hybrid-raw-segments
```

This confirms the audit catches the drift identified in the owner audit without breaking default validation.

---

## 3. Migration matrix drift fix (non-Gill / non-Nagornaya)

After confirming another agent is working on Gill + Nagornaya, this lane only adjusted non-Gill/non-Nagornaya contracts:

| Route | Before | Now | Why |
|---|---|---|---|
| `/articles/20-antisovetov-pastoru/` | `mdx-native-article` | `full-body-shadow` | Current production source uses `loadLegacyFullDocument(... bodyHtml ...)`; MDX remains the target, not current state. |
| `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/` | `mdx-native-article` | `full-body-shadow` | Current production source uses full body shadow; native MDX promotion needs its own visual lane. |
| `/articles/kod-da-vinchi/` | `mdx-native-article` | `native-main-with-legacy-chrome` | Current source is V7 hybrid/componentized route with legacy head/chrome and `KodDaVinchiMainShell`, not strict MDX-native yet. |

After this update:

```bash
npm run native:runtime:audit:strict
# ✅ passed

node scripts/check-route-migration-matrix.js --strict
# ✅ passed (warnings only; no problems)
```

This keeps the matrix honest: it now records what is actually deployed, while `targetMode: "mdx-native-article"` preserves the intended future direction.

---

## Checks

- [x] `npm run native:runtime:audit` — passed, exits 0.
- [x] `npm run native:runtime:audit:strict` — passed after matrix drift alignment.
- [x] Nagornaya branch grep clean for strict-native forbidden transport.
- [x] Nagornaya branch `npm run nagornaya:visual-parity:audit` — passed.
- [x] Nagornaya branch `npm run validate:static-publication` — passed.
- [x] Nagornaya branch visual screenshots — 18/18 at 0.000% with `--threshold 0`.
- [x] `npm run guard:shared-files` — passed after commit with `[LANE lane/system-native-runtime-taxonomy-audit-2026-06-23]` message.
- [x] `npm run workflows:check` — passed.
- [x] `npm run migration:matrix:check` — passed (warnings only).
- [x] `node scripts/check-route-migration-matrix.js --strict` — passed (warnings only, no problems).
- [x] `npm run migration:metadata:check` — passed (warnings only).
- [ ] Current-branch `npm run validate:static-publication` — attempted, blocked by pre-existing `astro:audit:article-mdx:strict` issue: `kod-da-vinchi article-sections directory missing before full promotion` (not caused by this lane; rollup branch contains a compatibility restore).

---

## Out-of-lane findings

- `origin/lane/visual-fix-nagornaya-native-2026-06-23` is verified clean, but should preferably be consumed through `origin/lane/rollup-v1-v11-final-2026-06-23`, not direct-merged in isolation.
- The 3 non-Gill/non-Nagornaya strict matrix drifts identified by this lane are now aligned in `migration/route-migration-matrix.json` to current runtime reality. Future actual promotion still needs dedicated visual lanes:
  - `lane/mdx-article-promotion-antisovetov-hermenevtika`
  - `lane/visual-fix-kod-da-vinchi-followup` or rollup consumption, depending on owner merge plan.
- Current `main` / this audit lane has a pre-existing blocking audit issue outside this lane: `astro:audit:article-mdx:strict` reports `kod-da-vinchi article-sections directory missing before full promotion`. The final rollup branch contains a compatibility restore for this class of issue.

---

## Merge recommendation

`merge` this SYSTEM audit lane after review. It does not change production route output.

---

## Rollback

Branch: `lane/system-native-runtime-taxonomy-audit-2026-06-23`
