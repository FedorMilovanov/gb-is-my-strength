# Lane: gill-parts-v16-converge-2026-06-27

**Goal:** Converge ALL Gill series parts (chast-1/2/3 + spravochnik) from the legacy
`gbs2-rail`/`gbs2-sheet`/`gbs2-thumb` chrome to the owner-approved v16 chrome that
gill-context already uses. Fix the long-standing visual bugs the owner kept reporting.

## Owner bugs closed
1. **Thumbnails inside roman-numeral blocks** — legacy `gbs2-thumb` parts showed
   cover images bleeding through the numerals (global `img{display:block}` reset
   overrode `.gbs2-thumb img{display:none}`). v16 has no thumbnails → clean italic-serif
   roman numerals (I–V series / I–N part).
2. **"Колхозная" mobile TOC numerals** — legacy `gbs2-sheet` used dark-red box arabic
   numbers; the v16 part-TOC uses premium italic-serif roman numerals from the reference.
3. **Part-TOC getting WIPED at runtime (newly found)** — `js/enhancements.js`
   (`body.gbs-world` IIFE) did `getElementById("gbs2Toc").innerHTML=""` and rebuilt
   legacy arabic-numbered `<li>` items, destroying the v16 static roman-numeral part-TOC.
   Fixed byte-neutrally: v16 part-TOC list id renamed `gbs2Toc`→`gbs2PartToc` so the
   legacy builder's `if(!article||!toc)return` bails on its own. (No size-ratchet impact
   on enhancements.js, which sits 8 bytes under the 48000 hard cap.)
4. **GILL-F: v16 chrome had no working responsive/layout layer** — the overlays
   (`#seriesTocOverlay`/`#partTocOverlay`) and `.mobile-bottom-bar` were SIBLINGS of
   `[data-gill-v16]`, but every v16 CSS rule used descendant selectors
   `[data-gill-v16] .X`, so NONE matched (broken even on gill-context on main:
   rail showed at mobile, bottom bar/overlays static). Fixed by nesting the overlays +
   bottom-bar inside the `gbs2-world[data-gill-v16]` wrapper (fixed positioning is
   unaffected — no transformed ancestor) + a scoped responsive layer in
   `floating-cluster.css`:
   - desktop ≥64em: 2-col grid (240px rail + content), sticky rail, bottom bar hidden;
   - mobile <64em: rail hidden, bottom bar fixed, overlays usable as popups.

## Files
- `src/components/article-pilots/gill-{context,part1,part2,part3,spravochnik}/*PageChrome.astro`
  — all 5 rewritten/aligned to v16 (context already was; part1 from the proven pilot;
  part2/3/spravochnik generated from the same template with per-part TOC data).
- `css/floating-cluster.css` — appended "v16 LAYOUT + RESPONSIVE LAYER (GILL-F fix)".
- `js/floating-cluster-controller.js` — defensive guard so populateToc never overwrites
  a v16 static part-TOC.

## NOT changed (preserved)
- PlayEmber premium hover-bloom + Russian TTS + working pause (already on main) — kept
  intact; this lane was built fresh off current main, NOT by merging the stale
  `lane/gill-part1-v16-converge` (which predates the PlayEmber merge and would revert it).
- Gill progress % (32/58/95) — confirmed CORRECT cumulative done-min floor per
  arena-surgeon's multi-witness challenge; NOT touched (21/26/5 would be a regression).

## Verification (evidence: production-like dist + headless browser witness)
- Build: 53 pages, `strangler:build:production-like`.
- `scripts/audit-pro.js`: ✅ AUDIT PASSED (161 passed, 0 errors).
- `npm run data:consistency`: ✅ passed.
- Browser witness (390px + 1280px, light + dark):
  - all 5 Gill pages: part-TOC persists with roman numerals, 0 legacy `<li>` injected;
  - desktop grid 240px+content, sticky rail, bottom bar hidden;
  - mobile rail hidden, bottom bar fixed, series + part TOC overlays open as popups;
  - no thumbnails in numerals; dark mode renders premium gold italic-serif numerals.
