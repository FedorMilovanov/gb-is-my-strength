# Grok desktop reader — Stage 2 Hermeneutics pilot (2026-11-07)

**Status: draft / opt-in OFF. Not merged, not released.** This bounded visual pilot is now based on merged Stage 1 PR #2284, Product main `354222d8b6e20538ca275cb4e84cb0dad84adf27`. The last independently witnessed live release before this stage-1 merge was Library V3 `717efc54772edf4224f44254651c102e2af24129`; deployment of the newer main SHA must be independently verified.

## Scope and ownership

- Only the standalone Hermeneutics route `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/` opts into the new tree **at build time** with `PUBLIC_GB_GROK_HERMENEUTICS_PILOT=1`. No environment flag (default) preserves the old TOC markup.
- `GrokReaderTree.astro` renders the `projectStandaloneReaderToc()` hierarchy. The canonical `HERMENEVTIKA_TOC` keeps all historical fragments, labels and section order.
- `ReaderRail.astro` still owns the *one* ReaderState subscription, current heading, progress track and original actions. The new subtree disclosure uses only delegated TOC click, `inert`, `aria-hidden`, `aria-expanded`, focus return before collapse and expansion of the active item's ancestors. It does **not** install a second scrollspy, global history handler, search, localStorage, print, TTS or library engine.
- Existing `SiteSectionsMenu`, `ReaderSettings`, floating right-side four SVG controls, `GBReaderLibrary` V3 and actual article content remain untouched. Gill series, Baptists book and mobile navigation are not opt-in.
- Existing site desktop breakpoint (1200px) is retained; no 781px prototype breakpoint is transplanted.
- Scoped CSS uses muted typography, small solid H2 dots, a 2px active rule, 650ms interruptible disclosure, `prefers-reduced-motion` zero transition, and a compressed 300px-high desktop rail.
- Exact CSS-cascade bug found by a screenshot: `css/site.css` has `li a[href]:not([class]) {text-decoration:underline}`, which outranked the ordinary rail link rule. The shared reader rail now explicitly distinguishes TOC navigation via `.hrail .hrail-toc li a[href]:not([class]) { text-decoration:none }`. No `!important` and no changes to article prose links.

## Evidence captured against opt-in candidate

- Existing Stage 1 projection: 15/15 source contract checks over 7 real series families and 68 page configurations.
- `node scripts/check-engine-contracts.js` and `node scripts/series-reader-facade-regression-test.js`: PASS.
- `npm.cmd run astro:check`: 0 errors / 0 warnings / 7 unrelated preexisting hints (first source check).
- Candidate built via canonical `strangler:build:production-like` after fixing an initially missing JSX closing brace; subsequent production-like build completed with all postbuild passes.
- `node scripts/grok-rail-pilot-browser-test.mjs`: **195/195 PASS**, Chromium/Firefox/WebKit across 390, 1199, 1200, 1440×300 and 1440×900. Explicit checks cover 10 canonical anchor targets, mobile rail nonvisibility, right-side cluster, horizontal overflow, focus-safe inert disclosure, reopen, reduced-motion, short-height navigability, and computed `text-decoration-line:none`.
- Initial 1440×300 rail viewport had only 76px of available TOC; reduced header wrapping to regain usable height. This was caught by metric-based test rather than screenshots alone.
- Additional reproducible browser coverage: H3 permalink, browser Back/Forward with empty-hash restoration, direct H3 load, and seven rapid disclosure reversals across all three engines (27 added checks, included in 195/195).
- Scripture occurrence index: adding `GrokReaderTree.astro` increases scanned source files **529 → 530**. Deterministically refreshed `data/scripture-search-index.json` (only this counter changed): **1368 references, 3474 occurrences, 102 routes** unchanged; both index check and occurrence contract pass locally.
- Screenshots and machine report are generated into `reports/grok-stage2/` and are intentionally untracked build witnesses, not publishable page assets.
- `node scripts/reader-controls-a11y-browser-contract.mjs`: 141/141 PASS, including retained Gill/Hermeneutics controls, Escape/focus and Play.
- `node scripts/hermenevtika-mobile-chrome-visual-contract.mjs`: 84/84 PASS (Chromium/WebKit); mobile navigation unchanged.
- `node scripts/reader-library-premium-browser-contract.cjs`: 8/8 PASS (real Library V3 browser contract).
- Local flag-ON browser evidence: **195/195**; flag-OFF: **120/120** (Chromium/Firefox/WebKit). Reader Controls **141/141**, mobile **84/84**, Library V3 **8/8**; aggregate **548/548 PASS**. These are local candidate checks, not CI or live certification.
- The Night palette initially rendered Grok TOC text dark on dark, while Sepia retained the Light rail surface. Scoped reader-theme tokens in GrokReaderTree.astro fix both without creating another theme engine. The extra grok-stage2-theme-print-audit.mjs verifies settings, three themes, canonical 125% font and print CSS: **54/54 PASS** in Chromium/Firefox/WebKit. Total local browser checks: **602/602 PASS** (not full CI or A4 pagination certification).

## Reproduction

On an isolated worktree based on the final, merged Stage 1 head, with pinned repository dependencies already installed:

```powershell
$env:PUBLIC_GB_GROK_HERMENEUTICS_PILOT = '1'
npm.cmd run strangler:build:production-like
node scripts/grok-rail-pilot-browser-test.mjs
node scripts/reader-controls-a11y-browser-contract.mjs
node scripts/hermenevtika-mobile-chrome-visual-contract.mjs
node scripts/reader-library-premium-browser-contract.cjs
node scripts/grok-stage2-theme-print-audit.mjs

# Separate flag-OFF build, after clearing the opt-in environment variable:
Remove-Item Env:PUBLIC_GB_GROK_HERMENEUTICS_PILOT -ErrorAction SilentlyContinue
npm.cmd run strangler:build:production-like
node scripts/grok-rail-pilot-browser-test.mjs --flag-off
```

Default build without the flag passed `node scripts/grok-rail-pilot-browser-test.mjs --flag-off`: **120/120** checks (3 engines × 5 viewports × 8 cases). It renders the flat TOC with 10 canonical links, no Grok DOM elements, unchanged responsive controls and no JS errors. Rebuild with the flag unset before running this. The scoped removal of TOC underlines remains an intentional rail improvement in both modes.

## Remaining gates and stop-ship

1. Stage 1 PR #2284 **MERGED** after exact-head CI success on its second WebKit run (first timed out installing Ubuntu packages). Require full **Stage 2 PR #2285 exact-head CI green** before Stage 2 merge.
2. Capture same-state on/off screenshots, actual reader-axis rectangles and per-series theme tokens; compare screen widths and responsive breakpoints with production.
3. Validate URL Back/Forward, direct deep links into previously collapsed descendants, rapid animation reversals (0/90/180/350/650ms), keyboard arrows and focus restoration, Day/Sepia/Night theme interactions (54/54 additional browser checks now pass), canonical maximum **125%** font and print CSS (both checked). The shared reader preferences API clamps fontScale at 1.25, so 130% is currently unsupported; do not silently broaden this global contract for the pilot. Actual A4 pagination, Day/Sepia/Night cross-route visual parity, and Library V3 save/status/reload/backup still require independent witnesses.
4. Flag-OFF DOM parity passed 120/120; review intentional TOC underline removal in visual comparison and run canonical release guard at the final Stage 2 head.
5. No Stage 2 merge or live flag until all checks are green and reviewed. No Gill/Baptists rollout yet. Rollback is exclusively a flag-off build, never a revert of Library V3.

Current local development was isolated in `C:\Users\Fedor\AppData\Local\Temp\gb-grok-pr2284-stage2-20261106`. The existing main workspace and dirty AuditRepo workspace were deliberately not edited.
