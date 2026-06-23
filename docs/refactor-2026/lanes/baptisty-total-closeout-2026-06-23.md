# Lane Report: `baptisty-total-closeout-2026-06-23`

**Branch:** `lane/baptisty-total-closeout-2026-06-23`  
**Mode:** LANE  
**Scope:** Close the full `baptisty-rossii` route family to strict-native runtime: landing + all 10 series routes.  
**Status:** review  
**Owner:** Arena Agent  
**Started:** 2026-06-23  
**Updated:** 2026-06-23

---

## What this lane does

1. Imports the balanced native body-component work from `origin/lane/baptisty-native-fragments-2026-06-23`.
2. Extends it from native-body-only to **strict-native runtime** by retiring legacy head/body transport.
3. Adds native `PageHead` components for:
   - landing `/baptisty-rossii/`
   - 10 article routes
4. Removes runtime `_legacy/` transport directories and old helper shells.
5. Rewrites Baptisty route audits to strict-native criteria.
6. Updates migration matrix so Baptisty routes are truthfully marked as `strict-native`.

---

## Changed files

### Route pages
- `src/pages/baptisty-rossii/index.astro`
- `src/pages/baptisty-rossii/dva-sezda-1884/index.astro`
- `src/pages/baptisty-rossii/goneniya-i-sovest/index.astro`
- `src/pages/baptisty-rossii/iniciativnaya-gruppa/index.astro`
- `src/pages/baptisty-rossii/noch-na-kure/index.astro`
- `src/pages/baptisty-rossii/peterburgskaya-liniya/index.astro`
- `src/pages/baptisty-rossii/podpolnaya-pechat/index.astro`
- `src/pages/baptisty-rossii/sovetskaya-noch/index.astro`
- `src/pages/baptisty-rossii/spravochnik/index.astro`
- `src/pages/baptisty-rossii/vsehib-1944/index.astro`
- `src/pages/baptisty-rossii/yuzhnaya-shtunda/index.astro`

### Native body/head components
- `src/components/baptisty-rossii/BaptistyRossiiBody.astro`
- `src/components/baptisty-rossii/BaptistyRossii*Body.astro` (10 article bodies)
- `src/components/baptisty-rossii/BaptistyRossiiPageHead.astro`
- `src/components/baptisty-rossii/BaptistyRossii*PageHead.astro` (10 article heads)

### Removed transport layer
- removed `src/components/baptisty-rossii/_legacy/**`
- removed `BaptistyRossiiMain.astro`
- removed `BaptistyRossiiArticleMain.astro`

### Audits / matrix
- `scripts/baptisty-rossii-visual-parity-audit.js`
- `scripts/baptisty-series-shadow-audit.js`
- `migration/route-migration-matrix.json`

---

## Checks passed locally

```bash
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
npm run astro:build
node scripts/baptisty-rossii-visual-parity-audit.js
node scripts/baptisty-series-shadow-audit.js
npm run native:runtime:audit:strict
npm run validate:static-publication
```

All passed in this session.

---

## Result

The whole `baptisty-rossii` route family is now strict-native at runtime:
- no `loadLegacyFullDocument`
- no `headHtml/bodyHtml/bodyAttributes`
- no `?raw`
- no `set:html`
- no `_legacy` transport in route/component closure

---

## Remaining debt after this lane

The biggest remaining non-app migration debt is now:
- `/`
- `/articles/`
- `/biografii/`
- `/hard-texts/`
- `/karty/`
- `/konfessii/`
- `/pastor-series/`

Still full-body-shadow:
- `/articles/20-antisovetov-pastoru/`
- `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/`
- `/articles/krajne-li-isporcheno-serdce/`
- `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/`

Protected intentional app-shadow remains unchanged:
- `/konfessii/russkij-baptizm/`
- `/map/`
- `karty/*` app routes
- `/rodosloviye/`
