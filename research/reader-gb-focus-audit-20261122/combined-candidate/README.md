# Combined marker + focus candidate: compiled compatibility receipt

**Base Product SHA:** `f908e289e59b423f98d129b20552e6d6d3092b04` (W109).
**Not integrated, not owner-approved, no Product-branch push.** This research commit adds tests/receipts only, no new Product logic. It does not rebase or replace the main executor's branch.

## Exact construction

A fresh isolated Git archive of the base SHA, then the two EXISTING published artifacts in this order:

1. `../focus-candidate/native-anchor-focus-f908e289.patch`
2. `../marker-candidate/exact-location-25830c64.patch`

Both `git apply --check` steps passed at their respective application point. Although the marker artifact was first authored on25830c64, it applied cleanly on actual W109 AFTER the focus patch; this is tested composition, not an inferred compatibility claim. Patch SHA256 and resulting tracked-file blob IDs are in manifest.json. Do NOT cherry-pick the entire historical research branch.

The only resulting source changes are overlay Astro inline logic, shared controller, its asset helper revision and SW literal. Controller MD5 prefix remains41284ba0. No landscape/CSS parameter experiment, WaveD change, marker parser, CSS/font/sheet geometry or additional source patch is included. On integration with #2348/shared JS/SW, the executor must reconcile latest source and regenerate actual revisions rather than copy41284ba0 blindly.

Build: Node24.22.3, `node scripts/astro-cli.mjs build`, `node scripts/copy-legacy-to-dist.js --omit-build-only --no-manifest`, `node scripts/cache-bust.js` READ-ONLY: all PASS. Served this newly compiled combined dist on8483. No browser Product-code injection or storage mutation by probes.

## Executed probes on this combined dist

| probe | conditions | outcome |
|---|---|---:|
|`repro.mjs`|GillII,390×844/568×320/640×360/844×390|**67/68**, exit1|
|`focus-repro.mjs` default|GillII H3sec-canticles + H2sec-quiz, same4 sizes|**52/52**, exit0|
|`focus-repro.mjs` book override|Baptist book H2baptism-as-boundary + H2police-intervention, same4 sizes|**52/52**, exit0|
|`hierarchy-repro.mjs`|GillII missing+represented ID and Baptist chapter/article/section identity,390×844|**16/16**, exit0|
|`navigation-repro.mjs`|GillII,390×844 +568×320, JS + separate no-JS contexts|**20/20**, exit0|

Counts overlap and MUST NOT be summed into unique product acceptance. Chromium153, mobile/touch emulation, reduced motion, SW blocked. Each viewport has an independent clean context. No viewport resize or persistence recovery scenario.

The broad68-check failure is STILL `Focused list row entirely visible` on568×320. The separate landscape experiment also found focus-outline clipping and78px group-header allocation constraints; those are NOT fully covered by the68-check border-box probe and remain open. Thus67/68 does NOT mean only one total Reader issue remains.

## New browser boundary test

`../navigation-repro.mjs` uses BASE_URL/OUTPUT_DIR and optional PLAYWRIGHT_PACKAGE_JSON/CHROMIUM_PATH as the existing tests:

```sh
BASE_URL=http://127.0.0.1:8483 OUTPUT_DIR=/tmp/reader-navigation \
node research/reader-gb-focus-audit-20261122/navigation-repro.mjs
```

For each of390×844 and568×320:

- Native TOC Tab/Enter first tosec-canticles, then tosec-ordinances. After settling, exact destination owns focus, hash and canonical section agree. Reopen: unique aria-current=location follows the actual destination (marker and focus candidates cooperate).
- Browser Back returns hash/visible section tosec-canticles; reload preserves that authored hash and visible section. **This asserts hash/position only**. Recorded Back focus remainsmobPartTocBtn; reload focus is body. A separate Back-focus policy is NOT accepted or repaired here.
- Tab/Enter Back-to-series, then Enter on a NONcurrent series item performs regular full-route navigation to `/articles/dzhon-gill-istoricheskiy-kontekst/`, new current page label, closed part overlay. It is not intercepted as same-document location.
- Control+Enter on the local anchor opens a real browser tab at#sec-canticles while source hash stays empty and source TOC stays open. No fake popup or internal jump helper.
- Separate javaScriptEnabled:false context: direct authored URL#sec-canticles lands visibly with `GBReaderState` undefined. This is NO-JS DIRECT HASH coverage only, NOT a claim the JS-dependent TOC opener works without JS.

Settling uses driver-side100ms reads (six stable intervals). A preliminary harness attempt that used page setTimeout in no-JS mode stalled; it was stopped, not reported as Product failure. The published test uses a driver clock and completed normally. No unsupported case silently counted as a pass.

## Protected-surface smoke and limits

Additional Day/Night smoke at mobile390×844 and desktop1440×900 uses the real unchanged `preview.py` Handler, only its bind wrapped to0.0.0.0, URL `?reader-pilot=1&paper=space`. Native mobile confirmed without W57; desktopbody.np-w57-ready confirmed; all4 contexts zero page JS errors/document x-overflow. This is only a smoke, not full W57 visual parity, AT or permanent CI.

No fresh WebKit/Firefox/physical device/all68 routes/zoom/notch safe-area/final CI or asset-owner integration acceptance. Missing-row marker policy still requires owner confirmation. Analytics.jumpTo, footnote/strategic-map ownership and WaveD changes are NOT part of these TOC navigation assertions. Draft/HOLD, protected W107 baseline and independent lanes remain unchanged. Executor can review/apply the two exact artifacts together, but must run current full guards and resolve remaining landscape/owner choices before closure.
