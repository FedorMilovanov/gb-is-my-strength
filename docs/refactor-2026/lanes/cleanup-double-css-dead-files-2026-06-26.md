# Lane: cleanup-double-css-dead-files-2026-06-26

**Date:** 2026-06-26
**SHA:** `822b42d3` → `3253ea75`
**Agent:** Arena Agent (session 2)

## Changes

### N-REV1-7: Double CSS Load Fix
- **Problem:** Hermenevtika, KodDaVinchi, Antisovetov loaded `floating-cluster.css` externally AND via Astro-bundled `<style is:global>` in SingleArticleCluster (~470 lines)
- **Fix:** Removed `<link>` to `floating-cluster.css` from 3 PageHeads; CSS delivered only via Astro bundle
- **Verification:** `astro build` → checked `dist/` output — Astro bundle `FloatingCluster._SRMcKLI.css` present, no external link

### P2-14: Dead `series-cards.js` Cleanup
- Removed from `sw.js` PRECACHE_ASSETS
- Removed from `scripts/cache-bust.js` ASSETS
- File still physically exists (audit-pro.js references it for validation)

### P1-15/P1-16: GBS2 Controls Wiring
- Added `initGbs2Controls()` to `js/floating-cluster-controller.js` (201 lines)
- Populates sidebar TOC and sheet TOC pane from article headings
- Wires mobile bottom bar, sheet open/close, tab switching, font controls, share, scroll progress
- Uses existing CSS classes from site.css (`gbs2-open`, `gbs2-sheet-toclink`, etc.)

### P1-9: audit-pro CACHE_BUST_ASSETS Sync
- Synced `scripts/audit-pro.js` asset list with `scripts/cache-bust.js` canonical list
- Added missing `js/glossary.js`, removed stale `js/modules/*` entries

## Gate Results
- `astro build`: ✅ 52 pages, 0 errors
- `validate:static-publication`: ✅ 0 errors, 5 warnings (pre-existing)
- `guard:shared-files`: ✅
- `data:consistency`: ✅
