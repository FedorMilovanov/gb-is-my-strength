# Grok desktop reader — Stage 2 Hermeneutics pilot (2026-11-07)

**Status: draft / opt-in OFF. Not merged, not released.** This file describes the bounded visual pilot developed on exact Stage 1 PR #2284 head `ae93e229c3aca79500a4dad8f6f94158484c0c68`. The stable production baseline remains Library V3 `717efc54772edf4224f44254651c102e2af24129`.

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
- `node scripts/grok-rail-pilot-browser-test.mjs`: **168/168 PASS**, Chromium/Firefox/WebKit across 390, 1199, 1200, 1440×300 and 1440×900. Explicit checks cover 10 canonical anchor targets, mobile rail nonvisibility, right-side cluster, horizontal overflow, focus-safe inert disclosure, reopen, reduced-motion, short-height navigability, and computed `text-decoration-line:none`.
- Initial 1440×300 rail viewport had only 76px of available TOC; reduced header wrapping to regain usable height. This was caught by metric-based test rather than screenshots alone.
- Screenshots and machine report are generated into `reports/grok-stage2/` and are intentionally untracked build witnesses, not publishable page assets.
- `node scripts/reader-controls-a11y-browser-contract.mjs`: 141/141 PASS, including retained Gill/Hermeneutics controls, Escape/focus and Play.
- `node scripts/hermenevtika-mobile-chrome-visual-contract.mjs`: 84/84 PASS (Chromium/WebKit); mobile navigation unchanged.
- `node scripts/reader-library-premium-browser-contract.cjs`: 8/8 PASS (real Library V3 browser contract).
- Aggregate local browser checks in this candidate: 168 + 141 + 84 + 8 = **401/401 PASS**. This is local opt-in evidence, not a claim that Stage 2 CI or production release is certified.

## Reproduction

On an isolated worktree based on the final, merged Stage 1 head, with pinned repository dependencies already installed:

```powershell
$env:PUBLIC_GB_GROK_HERMENEUTICS_PILOT = '1'
npm.cmd run strangler:build:production-like
node scripts/grok-rail-pilot-browser-test.mjs
node scripts/reader-controls-a11y-browser-contract.mjs
node scripts/hermenevtika-mobile-chrome-visual-contract.mjs
node scripts/reader-library-premium-browser-contract.cjs
```

Default build (without the flag) must show the original Hermeneutics rail and untouched mobile readers. The CSS-only removal of TOC underlines remains an intentional reader-rail improvement in both modes.

## Remaining gates and stop-ship

1. Stage 1 PR #2284 must reach final CI green at the **exact** PR head; Route Registry WebKit installation/check was still in progress during this audit. Do not merge PR #2284 on partially complete CI.
2. Capture same-state on/off screenshots, actual reader-axis rectangles and per-series theme tokens; compare screen widths and responsive breakpoints with production.
3. Validate URL Back/Forward, direct deep links into previously collapsed descendants, rapid animation reversals (0/90/180/350/650ms), keyboard arrows and focus restoration, Day/Sepia/Night themes, 130% font, A4 print and actual Library V3 save/status/reload/backup.
4. Verify exact CSS/DOM diff with the route flag **off**. Run the canonical release guard on the final staged PR head.
5. No Stage 2 merge or live flag until all checks are green and reviewed. No Gill/Baptists rollout yet. Rollback is exclusively a flag-off build, never a revert of Library V3.

Current local development was isolated in `C:\Users\Fedor\AppData\Local\Temp\gb-grok-pr2284-stage2-20261106`. The existing main workspace and dirty AuditRepo workspace were deliberately not edited.
