# Lane: security-dist-csp-form-action-2026-07-04

**Date:** 2026-07-04  
**Mode:** SYSTEM  
**Branch:** `lane/security-dist-csp-form-action-2026-07-04`  
**Base source HEAD:** `01ff5ce3f4264510bccc1c4480c720ca22f181c1`

## Goal

Close the current CSP dist regressions tracked as `NEW-68` and `NEW-69`:

- existing CSP meta tags in production-like `dist/` missed `form-action 'self'`;
- Astro-owned `karty/*`/map-like pages in `dist/` missed CSP meta entirely.

## Changes

### `scripts/astro-cache-bust-postbuild.js`

Added a deterministic postbuild CSP hardening pass over `dist/**/*.html`:

- if a page has CSP meta but no `form-action`, append `form-action 'self';`;
- if a page has `<html>/<head>` but no CSP meta, inject a broad site CSP that includes:
  - project/Yandex runtime sources;
  - map/image external hosts already used by karty/map routes;
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.

This runs after Astro build + legacy copy, so it protects the actual Pages artifact while PageHead components remain duplicated.

### `scripts/dist-publication-audit.js`

Added blocking dist checks:

- every dist HTML document must have a CSP meta tag;
- every CSP meta must include `form-action 'self'`.

## Verification

Environment: Node `v22.14.0`, Playwright Chromium/deps installed.

- `node --check scripts/astro-cache-bust-postbuild.js` ✅
- `node --check scripts/dist-publication-audit.js` ✅
- `npm run workflows:check` ✅
- `npm run strangler:build:production-like` ✅
- `npm run pagefind:build:dist` ✅
- `node scripts/dist-publication-audit.js --require-pagefind --forbid-dev` ✅
- `npm run strangler:audit:production-like` ✅
- `npm run validate:static-publication` ✅
- `git diff --check` ✅

Manual dist CSP scan after build:

```text
dist HTML with <html>: 55
missing CSP: 0
CSP without form-action: 0
postbuild CSP files touched: 54 (injected: 16, form-action fixed: 38)
```

## Explicit non-changes

- Did not change runtime CSS/JS behavior.
- Did not change PremiumControls/Gill geometry.
- Did not deduplicate PageHead components in this lane; this is a deploy-artifact hardening layer.
