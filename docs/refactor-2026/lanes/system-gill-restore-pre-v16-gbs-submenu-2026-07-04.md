# Lane: system-gill-restore-pre-v16-gbs-submenu-2026-07-04

**Date:** 2026-07-04  
**Mode:** SYSTEM  
**Branch:** `lane/system-gill-restore-pre-v16-gbs-submenu-2026-07-04`  
**Base source HEAD:** `aaaaf7a7805daee271557646913b4657975a523e`  
**Historical reference:** `bcf6389f29ee0c89e9e96e7587e0226ecf251ae0` (`feat(gbs): migrate Gill spravochnik (part five) to series world — series complete`)

## Goal

Restore the historical pre-v16 GBS Gill desktop submenu inside the current Gill v16 shared Astro shell. This is not a redesign and not a rollback of the whole page shell.

## Historical files extracted

```text
articles/dzhon-gill-istoricheskiy-kontekst/index.html
articles/dzhon-gill-chast-1-chelovek/index.html
articles/dzhon-gill-chast-2-uchenyi/index.html
articles/dzhon-gill-chast-3-nasledie/index.html
articles/dzhon-gill-spravochnik/index.html
css/site.css
js/site.js
```

## Implementation summary

### Data/model

- `GillPartTocItem` now stores historical submenu data:
  - `href`
  - `label`
  - `level: 2 | 3`
  - optional `current`
- Desktop submenu rendering no longer assigns fake Roman chapter numbers to H3/submenu rows.
- `subtitle: "Глава N"` is removed from the desktop submenu model.

### DOM

- Restored historical shell shape:
  - `.gbs2-toch`
  - `.gbs2-count`
  - `.gbs2-tocscroll`
  - `.gbs2-track` as sibling before `<ul>`, not inside `<ul>`
  - `.gbs2-toc`
  - `.gbs2-sub` only for historical H3 rows
  - `.gbs2-dot` per item

### CSS

- Ported historical GBS submenu selectors into `css/floating-cluster.css`, scoped to `[data-gill-v16]` for desktop.
- Restored historical line/dot/subitem visual language.
- Restored wider Gill desktop rail: `clamp(272px,24vw,304px)` / grid `minmax(272px,304px)`.

### Runtime

- `js/enhancements.js` no longer rebuilds `.gbs2-toc` on Gill v16 pages.
- `js/floating-cluster-controller.js` now uses the restored historical ordered submenu list for active/passed state and count.
- `N / TOTAL` count format is preserved.
- Active row is kept visible inside `.gbs2-tocscroll`.

### Regression audit

Added:

```text
scripts/gill-pre-v16-submenu-regression-audit.js
npm run gill:pre-v16-submenu:audit
```

Wired to:

```text
.github/workflows/deploy.yml
audit/external-checks/run-local-windows-audit.ps1
scripts/check-workflows.js
```

## Per-route item counts

| Route | Total | Top-level | Subitems |
|---|---:|---:|---:|
| Historical context | 10 | 10 | 0 |
| Part I — Человек | 15 | 3 | 12 |
| Part II — Учёный | 6 | 2 | 4 |
| Part III — Наследие | 16 | 2 | 14 |
| Справочник | 9 | 9 | 0 |

## Anchor mappings changed

Historical hrefs preserved except where current content IDs changed:

| Page | Historical href | Final href | Reason |
|---|---|---|---|
| Part I | `#sec-early-years` | `#part-calling` | current H2 id changed |
| Part I | `#sec-gill-spirituality` | `#sec-family-deep` | closest current family/spiritual life section |
| Part III | `#sec-legacy-main` | `#part-legacy` | current H2 id changed |
| Part III | `#sec-rome-proverbs` | `#sec-church-gov` | current equivalent under church/governance material |
| Part III | `#sec-wesley` | `#sec-toplady-memoir` | current preserved Wesley-related polemic context |
| Part III | `#sec-coffee-house-polity` | `#sec-church-gov` | current church governance equivalent |
| Part III | `#sec-evaluations-map` | `#sec-contemporaries` | current evaluations/contemporaries section |

Every final href is verified by the regression audit to exist exactly once in built HTML.

## Verification

- `node --check js/floating-cluster-controller.js` ✅
- `node --check js/enhancements.js` ✅
- `node --check scripts/gill-pre-v16-submenu-regression-audit.js` ✅
- `npm run cache-bust` ✅
- `npm run strangler:build:production-like` ✅
- `npm run gill:series:data:consistency:audit` ✅
- `npm run gill:pre-v16-submenu:audit` ✅ — 105/105
- `npm run audit:premium-controls` ✅ — 87/87
- `npm run gill:mobile-play:smoke` ✅
- `npm run gill:mobile-layout:audit` ✅
- `node scripts/gill-context-visual-parity-audit.js --require-dist` ✅
- `node scripts/gill-spravochnik-visual-parity-audit.js --require-dist` ✅
- `node scripts/dist-smoke-audit.js --no-build --production-like` ✅
- `npm run workflows:check` ✅
- `npm run validate:static-publication` ✅
- `git diff --check` ✅

## Explicit non-changes

- Did not restore old total reading time or old part numbering.
- Did not restore old thumbnails, old mobile sheet, or old whole-page GBS shell.
- Did not change glossary/tooltip subsystem.
- Did not change current Gill mobile V3 bar or current series overlay architecture.
