# GILL pre-v16 submenu — anchor reconciliation report

**Finding:** `UI-GILL-SUBMENU-ANCHOR-02` (P1, functional/navigation)
**Source base HEAD:** `8c318010` (gb-is-my-strength `main`)
**Implementation lane:** `lane/gill-pre-v16-submenu-frame`
**Canonical historical witness:** `bcf6389f29ee0c89e9e96e7587e0226ecf251ae0`
**Date:** 2026-07-05

## 1. The bug

In `src/components/article-pilots/gill-series/gillSeriesData.ts`, Part III
(`part3.partToc`) had **two distinct historical submenu items pointing to the
same in-page anchor** `#sec-church-gov`:

| # | Label | Anchor (before) |
|---|---|---|
| 2 | Гилл и Рим: «безрассудство» ложной традиции | `#sec-church-gov` |
| 7 | Coffee House и права поместной церкви | `#sec-church-gov`  ← DUPLICATE |

These are two different historical concepts (Gill & Rome vs. the Coffee-House
political debate about local-church rights), so sharing one target meant the
second item scrolled to the first section and the visible "active" highlight
was wrong. Worse, the old regression audit (`scripts/gill-pre-v16-submenu-regression-audit.js`,
~17 lines) **hardcoded the same duplicate** in its `EXPECTED`, so it approved
the bug instead of catching it.

## 2. The fix

- Split the duplicate: item 2 stays `#sec-church-gov`; item 7 now targets a new
  distinct anchor `#sec-church-gov-polity`.
- The new anchor was added as a **real, visible sub-anchor** on the
  church-membership paragraph in
  `src/components/article-pilots/gill-part3/GillPart3ArticleBody.astro`
  (`<p class="reveal" id="sec-church-gov-polity">`), not a dummy/empty anchor.
  It is editorially tied to local-church rights/polity.
- The hardened audit now **rejects duplicate hrefs and labels** in its manifest
  sanity check (`checkManifestSanity()`), so a future regression of this kind
  fails loudly instead of being approved.

## 3. Historical parity — the 7 migration renames

The historical witness `bcf6389f…` is the authoritative pre-v16 GBS desktop
submenu design. After extraction it became clear that the **labels, order, and
item counts are byte-for-byte identical** to the current render — only **7
anchor IDs were renamed during the Astro migration**. The labels were
preserved. These renames are recorded in
`data/gill-submenu-anchor-reconciliation.json` (machine map `renames` + a
per-entry human record) and are applied by the audit before any comparison:

| Route | Historical href | → Current href | Current rendered heading |
|---|---|---|---|
| chast-1 | `#sec-early-years` | `#part-calling` | I. Становление и призвание |
| chast-1 | `#sec-gill-spirituality` | `#sec-family-deep` | Семья: дети, зять-издатель и богословие в деталях |
| chast-3 | `#sec-legacy-main` | `#part-legacy` | V. Историческое влияние и память |
| chast-3 | `#sec-rome-proverbs` | `#sec-church-gov` | Управление церковью: единственный пастор, никаких степеней |
| chast-3 | `#sec-wesley` | `#sec-toplady-memoir` | Топлэди о Гилле: Чёрный Принц и Мальборо |
| chast-3 | `#sec-coffee-house-polity` | `#sec-church-gov-polity` | О вступлении в членство (параграф о правах поместной церкви) |
| chast-3 | `#sec-evaluations-map` | `#sec-contemporaries` | Как современники видели Гилла: портрет из первых уст |

After applying this map, the historical reference manifest
(`data/gill-pre-v16-submenu-reference.json`) matches the current source with
**zero duplicate hrefs** and **zero mismatches** (verified statically). Without
the reconciliation the raw historical hrefs would not resolve in the current
build and the audit would false-fail every route — which would have broken the
deploy gate.

## 4. Verification

- `node --check` on `scripts/gill-pre-v16-submenu-regression-audit.js`: PASS.
- Static reconciliation test: reconciled `EXPECTED` == current `gillSeriesData.ts`
  anchors for all 5 routes; `checkManifestSanity()` reports 0 duplicate hrefs.
- Part III now carries 16 distinct items; the two church-government items have
  distinct anchors (`#sec-church-gov`, `#sec-church-gov-polity`).
- **Not yet done in this environment:** the full browser + geometry run
  (`npm run gill:pre-v16-submenu:audit` on a production-like `dist`) and the
  owner visual review of the rounded frame. These run in remote CI once the
  lane is merged to `main`.

## 5. Related artifacts

- `data/gill-pre-v16-submenu-reference.json` — generated historical reference
  manifest (from `bcf6389f…` via `scripts/extract-gill-pre-v16-submenu-reference.js`).
- `data/gill-submenu-anchor-reconciliation.json` — the 7-rename map + records.
- `scripts/extract-gill-pre-v16-submenu-reference.js` — deterministic extractor.
- AuditRepo: `projects/gb-is-my-strength/verified/MASTER_BUG_MATRIX.md`
  (finding `UI-GILL-SUBMENU-ANCHOR-02`, `UI-GILL-HISTORICAL-PARITY-03`).
