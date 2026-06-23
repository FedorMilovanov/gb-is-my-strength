# Lane Report: `system-final-hybrid-closeout-2026-06-23`

**Branch:** `lane/system-final-hybrid-closeout-2026-06-23`  
**Mode:** SYSTEM  
**Scope:** Retire the remaining non-app hybrid route family and move route wrappers to strict-native Astro where safe.  
**Status:** active  
**Owner:** Arena Agent  
**Started:** 2026-06-23  
**Updated:** 2026-06-23

---

## Completed in this lane so far

### Promoted to strict-native
- `/`
- `/articles/`
- `/biografii/`
- `/hard-texts/`
- `/karty/`
- `/konfessii/`
- `/pastor-series/`
- `/articles/20-antisovetov-pastoru/`
- `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/`
- `/articles/krajne-li-isporcheno-serdce/`
- `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/`

### Protection kept
- `/konfessii/russkij-baptizm/` remains protected as polished interactive iframe/WebGL app route.
- It is documented in matrix as `legacy-shadow-app` with `targetMode=native-wrapper-iframe-app`.

### Route-family status after these changes
- `hybrid-raw-segments`: 0
- `native-with-legacy-head`: 0
- `native-main-with-legacy-chrome`: 0
- `full-body-shadow`: 0
- remaining runtime debt is limited to intentionally protected app-shadow routes

---

## Checks passed

```bash
npm run astro:build
node scripts/home-visual-parity-audit.js
node scripts/articles-visual-parity-audit.js
node scripts/biografii-visual-parity-audit.js
node scripts/hard-texts-visual-parity-audit.js
node scripts/karty-visual-parity-audit.js
node scripts/konfessii-visual-parity-audit.js
node scripts/pastor-series-visual-parity-audit.js
node scripts/check-route-migration-matrix.js --strict
npm run native:runtime:audit:strict
npm run validate:static-publication
```

All green in this session.

---

## Remaining work in lane

No further non-app runtime debt is required inside this lane.

After this batch:
- all non-app content/landing/article routes are strict-native at runtime;
- all remaining non-native routes are intentionally protected app-shadow routes.
