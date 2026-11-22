# Short-landscape padding budget and actual focus outline: diagnostic A/B

**Exact Product `f908e289e59b423f98d129b20552e6d6d3092b04`, no source patch / no visual approval.** Separate unmodified archive/build, Node24.22.3, Astro → legacy publication copy → READ-ONLY cache-bust PASS. Tracked source checked against Git blobs: zero changes (source-check.json). Neither earlier marker nor focus candidate is included. Plain static native mobile Reader only, not a W57 acceptance view.

Route `/articles/dzhon-gill-chast-2-uchenyi/`. Chromium153 mobile/touch emulation, reduced motion, SW blocked. Each mode/profile has its own clean context; no viewport resize or persistence scenario. Test starts via native opener tap, then focuses Close as keyboard starting point and uses real Tab to `a[href="#sec-canticles"]`. The captured frame is the actual keyboard-focused row, NOT an assertion that it is the active reading section.

## Reproduce

```sh
BASE_URL=http://127.0.0.1:8482 OUTPUT_DIR=/tmp/gb-landscape \
node research/reader-gb-focus-audit-20261122/landscape-probe.mjs
```

As for other probes, optional PLAYWRIGHT_PACKAGE_JSON / CHROMIUM_PATH point to externally installed tools. The script writes observations, comparison.json and one screenshot per executed mode/profile. Exit0 means diagnostic execution completed, NOT all baseline defects passed. This is an A/B **style-parameter experiment**, NOT a compiled CSS implementation. Source remains exact Product throughout.

## Measured fixed budget at568×320

| slot | actual height |
|---|---:|
| fixed85dvh sheet |272px|
| Close handle |28px|
| header (including vertical padding14+12) |79.484375px|
| progress slot |2px|
| tabs (including padding6+7 and44px minimum control) |58px|
| footer (including existing safe-area-aware padding) |79px|
| sheet top border |1px|
| remaining list |**24.515625px**|

Actual section row is34px; outline is2px with2px offset (4px extra each vertical edge). One keyboard-reachable group-header button is78px (budget.json). Do not confuse row height, available scrollport, and visible outline; whole bounding boxes alone were not enough.

## Three modes; no font, target-size, frame or footer edits

1. **baseline:** untouched built page.
2. **compact-trial:** only in landscape height<=340px, simulate changing existing header vertical padding14/12→1/1 and tabs6/7→1/1. Recovers exactly35px, so list becomes**59.515625px**. Existing winning header declarations include!important; diagnostic uses inline parameter overrides solely to test the winning values. Do NOT paste this into production as another!important layer; any future source work must reconcile the canonical owner rule and budget.
3. **compact+focus-inset:** same two padding parameters; additionally list scroll-padding-block:6px in landscape height<=400px. This changes native focus-scroll clearance, not font, row/hitbox size or the outer layout. No custom JS scrolling or target-selection engine.

We deliberately did NOT alter handle, footer padding (including env(safe-area-inset-bottom)), Continue/listen/PDF size, typography, sheet85dvh, bottom bar, Play or CSS source. No proposed production patch in this artifact.

## Actual outcomes

| profile | baseline | padding only | padding + native focus inset |
|---|---|---|---|
|568×320 light/dark|list24.52; row AND outline clipped|list59.52; row fits within1px tolerance, **outline still clipped**|list59.52;34px row AND outline fit|
|640×360 light|list58.52; row fits, outline clipped|no compact allocation applied; same|same list58.52; outline fits|
|844×390 light|list84.02; row fits, outline clipped|no compact allocation applied; same|same list84.02; outline fits|
|390×844 light/dark|normal portrait|no changes applied|no changes applied|

At568 baseline target rect y211.484375..245.484375 is clipped by list216.484375..241. Padding-only changes available area but focus auto-scroll still leaves target bottom at241.484375: the0.484375px row-edge discrepancy is treated as subpixel tolerance, NOT a new row readability defect. Its outline extends4px farther and is genuinely cut. With inset, target becomes y201.484375..235.484375; outline fits inside list181.484375..241. This distinction also explains why earlier640/844 row-bounds checks passed while the focus outline needed a stronger check. Not a new regression claim.

**18 executed mode/profile cases:**390 portrait light/dark,568 landscape light/dark,640 landscape light,844 landscape light ×3modes. All recorded native surface, keyboard row reached, upward real CDP touch scroll moves the list and keeps sheet open; Escape returns opener; Close tap and Continue tap close; zero page JS errors. Every executed mode preserves EXACT sheet/Close/footer/Continue rectangles relative to its baseline. TOC vs Analytics sheet/header/tabs/footer rectangles stay equal in each mode. Title font and tab target height remain unchanged. Read raw observations.json and comparison.json; no blanket all-row accessibility claim.

Portrait390×844 screenshots baseline vs final trial are **PNG-byte-identical** in BOTH themes (SHA256 recorded in comparison.json). This is narrow same-route/profile evidence, not a complete W107 visual gate.

## Hard limit: why this is NOT a full landscape fix

Even removing ALL vertical padding from these two slots reclaims at most26+13=39px:24.515625+39=**63.515625px**. That is STILL shorter than the measured78px chapter-header button, before adding outline clearance. Therefore padding-only changes, while fixing the tested34px section row, cannot honestly certify every list control while keeping the remaining constraints fixed. Owner must decide an additional bounded allocation change (other slot/row treatment or a short-height sheet exception), then require full keyboard/touch/outline matrix. Do not silently switch85dvh to fullscreen, delete actions or redesign approved composition based on this diagnostic.

## Safe area and other limits

Attempted21px bottom-safe-area case was **SKIPPED, not PASS**: this Chromium CDP build reports Emulation.setSafeAreaInsets not found. Script stores three skipped records, excludes them from comparisons and never relabels fallback0px as21px. Existing safe-area padding was not changed, but a physical notched-device outcome is not proved. No WebKit/Firefox/physical phone/AT/200% text zoom or all68 routes. No W57 visual acceptance in this experiment. Owner-controlled geometry remains unmodified; implementation still requires approval and fresh compiled acceptance.

Frames included separately for light/dark baseline and final trial; they are browser screenshots, not generated illustrations or a different build. This artifact only narrows a known defect and supplies a measured design constraint.
