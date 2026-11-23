# W112 native TOC route sweep / satellite data-boundary finding

Exact Product SHA **56160c157ee8c23f7c2fb790034f0695171b11ff**. Fresh isolated archive, untouched tracked source (source-check.json), Astro build→copy-legacy --omit-build-only --no-manifest→cache-bust READ-ONLY PASS. No earlier patches applied, no CSS/JS browser override. Static8490 is ONLY native-mobile proof, not W57. PR comments read through236, including W112 integration and W111 corrections. Product branch/source untouched; Draft/HOLD remains.

## Executed coverage

`../route-sweep.mjs` enumerates built index.html files containing partTocOverlay (DIST_DIR required), then real browser probes each route. BASE_URL, OUTPUT_DIR, PLAYWRIGHT_PACKAGE_JSON and CHROMIUM_PATH configurable. This artifact has **68 routes**, not an assumed global permanent68-route list. Chromium153,390×844 native touch/mobile, reduced-motion, SW blocked, fresh context per route, three workers.

- **814 local hash links on66 routes**: every link has exactly1 target ID; no missing or duplicate destination, no target inside authored hidden/data-reader-exclude ancestor.
- **2 routes have ZERO local TOC hrefs**, investigated below. Initial sweep integrity assertion intentionally combines non-empty presence with uniqueness; its two failures have empty `data:[]`. These are NOT814 broken links, NOT missing hash destinations, and not a harness timeout.
- Sample first/last local links per non-empty route: **132 keyboard Enter transitions**. All132 reached by Tab, native hash matches, overlay closes; current-page aria attribute list survives reopen and Escape restores opener. The page-marker preservation check compares before/after ONLY: an already-wrong baseline identity can still pass it.
- **132/132 exact-focus assertions FAIL** on unpatched W112, extending prior two-fixture focus defect coverage. This does not prove the previous candidate fixes all132: no W112 candidate sweep was executed. Authored heading visible geometry/section mapping is recorded but NOT asserted by this sweep. Not every814 link activated, only132 boundary samples.
- Total **798/932** assertions, probe exit1. 134 failures =132 exact focus +2 non-empty TOC presence. Counts overlap; not unique product acceptance. Outer shell printed a tail after execution, so its command status0 is NOT the probe status. Source sets exitCode1 when checks fail.
- All68 route executions completed, zero page JS errors, no missing target exception. No cross-route destination integrity sweep (only same-document hrefs).

## New finding: satellite TOC points only at parent

Routes:

1. `/hard-texts/kniga-enoha-kotoroy-ne-bylo-kak-raznye-proizvedeniya-stali-korpusom/` (corpus, excursion A)
2. `/hard-texts/mozhno-li-doveryat-1-enohu-kanonicheskiy-audit/` (audit, excursion B)

`../satellite-toc-repro.mjs` independently reproduces both with real keyboard, captures screenshots and DOM rectangles, then activates the first child link. Diagnostic exit0 means reproduction completed, NOT acceptance.

Steps: open either route at390×844 → focus native mobPartTocBtn → Enter → read the sheet title/current card → Tab to first child “Коротко” → Enter.

Expected: an explicitly named article TOC exposes the current excursion's authored sections. If the parent series group intentionally stays current, its grouping meaning must not substitute the excursion's reading sections or silently turn the “current article” list into parent navigation. Exact owner policy is not inferred here.

Actual:

- sheet label correctly names excursion A/B;
- current group shows “Енох пророчествовал: Иуд.14–15,1 Енох1:9 и4Q204”, “Сейчас читаете”,19min;
- footer Listen reports the CURRENT excursion's38min (A) /42min (B), visibly mixing scopes;
-0 local links despite58 H2/H3 IDs in A and42 in B (all heading IDs, not a demand to render all headings);
- first visible40px link rect x22,y384.34375,width346,height40 at390×844 is `/hard-texts/enoh-prorochestvoval-iuda-14-15-4q204/#коротко`, NOT current excursion `#коротко`;
- actual keyboard activation changes pathname to that parent article in both cases; no JS errors.

Paired route screenshots `corpus-toc.png` and `audit-toc.png` are actual baseline native panels, not generated/mockups. This is a semantic/data mismatch with reader-visible screenshots, not an overlap/clipping report. No size/font/85dvh/footer change proposed.

## Source boundary / owner handoff

`src/components/article-pilots/_shared/series/genesis6SeriesConfig.ts` ALREADY owns corpus/audit local partToc arrays (8 rows each) plus current article chrome data. `genesis6SeriesData.ts` tags both as satellite,parent=enoch. `GillPartTocOverlay.astro` resolves currentPartId=currentRaw.parent??currentRaw.id and current=seriesItems.find(parent), then flat branch renders item page partToc. The two excursion arrays are not rendered as their own local rows in this panel. Shared page-vs-parent selection affects both article identity and reachability; isolated focus/marker logic does not by itself supply absent markup.

Handoff to native series/TOC configuration owner: retain intentional parent grouping if required, but decide an explicit satellite current-page+local-section representation using existing authored arrays. Do not infer permission to flatten series, introduce a parser, copy W57 renderer, remove parent navigation or alter protected mobile geometry. Needs executor integration and permanent satellite regression fixture, not a CSS patch by this lane.

Limits: Chromium-only,390×844 light, no physical/AT/WebKit/Firefox, no W57 acceptance or night/landscape visuals for these satellite screenshots, no resize/persistence. Known landscape row/outline/group allocation remains separate. W112 rate/tooltips changes not evaluated here. No full-site or Product CI acceptance.
