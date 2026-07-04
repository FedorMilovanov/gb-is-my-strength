# Lane: seo-hardtexts-og-dimensions-2026-07-04

**Date:** 2026-07-04  
**Mode:** LANE  
**Branch:** `lane/seo-hardtexts-og-dimensions-2026-07-04`  
**Base source HEAD:** `a434b45ee6d8cefb0ce281039ad683fe9b9589ba`

## Goal

Close the `NEW-59` part of the social/SEO metadata bundle: `/hard-texts/` declared `og:image` dimensions as `1200×630`, but the referenced file `images/og-series-heart.webp` is actually `1360×768`.

## Changes

- `hard-texts/index.html`: updated `og:image:width` / `og:image:height` to `1360` / `768`.
- `src/pages/hard-texts/index.astro`: same update for the Astro source route.

## Verification

- PIL image check: `images/og-series-heart.webp` = `1360×768` ✅
- `npm run validate:strict` ✅ (0 errors, 2 pre-existing warnings)
- `npm run schema:rich-results:audit` ✅
- `node scripts/audit-pro.js` ✅
- `git diff --check` ✅
- `npm run guard:shared-files` ✅ after lane commit

## Explicit non-changes

- Did not change the OG image file.
- Did not change article/page copy or visual layout.
- Did not touch other metadata bundle items (`NEW-54`, `NEW-56`, `NEW-57`, `NEW-58`).
