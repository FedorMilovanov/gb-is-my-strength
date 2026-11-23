# W123 current search: literal success, morphological result handoff gap

Exact Product **64ea5d5f985ad12c09b99c1709770311e1ffed13**. Read276 issue comments, including full W121 implementation, W122/W123 search fixes, SYS integration collision boundary and owner direction. Inline PR comments0, reviews0 independently checked. Pre-post HEAD same. Old Learning selectors/report are historical only: **Learning removed** on this source.

Fresh isolated git archive;0 tracked source differences (source-check.json). Node24 Astro112 pages→copy-legacy --omit-build-only --no-manifest→canonical astro-cache-bust-postbuild→Pagefind→cache-bust READ-ONLY all completed PASS. Initial postbuild attempt in git archive lacked technical build instant; explicitly set GB_BUILD_INSTANT=2026-11-23T13:57:56Z from this commit timestamp and reran postbuild (not a Product failure). Pagefind103 pages/28,838 words, real log included. Index/dist artifacts NOT Git. No notes, source text, search state or href/query handlers injected by this probe.

## Fresh current UI, not obsolete Learning

`../search-morphology-repro.mjs`:
- native390×900 mobile/touch; genuine1440×900 W57 via unchanged preview.py Handler query reader-pilot=1&paper=space&panel=open (binding wrapper0.0.0.0:8498 only);
- Chromium153, light, reduced-motion, SW blocked, four separate fresh contexts;
- mobile actual TOC→Analytics→“Поиск по сайту”; desktop actual visible canonical search control;
- actual Pagefind result list, keyboard ArrowDown selects GillII by cp-input aria-activedescendant, Enter activates it;
- two queries into same published article: exact **беспрецедентным**, Russian citation form **беспрецедентный**.

All4 initial scenes have exactly1gbAnalyticsStudy and0 retired Learning dialogs. Real Pagefind loads/indexes serveHTTP200; GillII is the sole returned article for BOTH queries on this build. No fabricated source-link destination. Query spelling is the only intended independent variable within each viewport.

## Results

| after Enter | native exact | native lemma | W57 exact | W57 lemma |
|---|---:|---:|---:|---:|
|selected text|беспрецедентным|empty|беспрецедентным|empty|
|focus|P|BODY|P|BODY|
|scrollY|5517|0|3666|0|
|actual matching paragraph top|279.69|5796.69|695.78|4361.78|
|paragraph owns focus|yes|no|yes|no|
|pending handoff key|removed|retained|removed|retained|
|desktop W57 ready after result|n/a|n/a|true|true|
|quiz owner count|1|1|1|1|
|page JS errors|0|0|0|0|

The article DOES contain inflected“беспрецедентным” and does NOT contain exact“беспрецедентный”. Pagefind matches morphological form and renders correct article/body snippet. This is not missing Pagefind index, not query absent from search results, not an injected or hidden-only match. **Earlier exact-word gap is independently closed on this SHA**, including keyboard and W57 retention; do not carry a77fae84 blanket search failure forward.

Five actual screenshots: mobile lemma result, both mobile landings, both desktop landings. Rectangles above describe reader-visible consequence: lemma matching paragraph several thousand px below viewport, not just a missing aria property. Diagnostic script exit0 means completed collection, NOT all cases accepted.

## Why the matching models differ

`src/runtime/reader-search-handoff.js` normalize only lowercases and ё→е, then `norm(value).indexOf(needle)`. It does not use Pagefind's actual matched-token location/surface form; citation-form query cannot literally match inflected paragraph text. `consume()` removes pending KEY ONLY if locate(query) succeeds; after failed locate, original query/timestamp/pilot/paper/panel entry remains (20s validity window). The record is not destination-bound.

Confirmed pending key is an OBSERVATION; **no actual later unrelated-page focus hijack or data-loss claim**. Did not force timestamps/storage or pretend the20s retention alone proves harmful cross-route navigation. No suggestion to stem/rewrite article text or add another parser/controller/index.

## Owner handoff and acceptance decision

For a canonical full-text search, article-level results are legitimate. But the new precise source-word handoff cannot be claimed uniformly for morphological results from its own search engine. Owner can either use Pagefind's verified actual matching tokens/locations to resolve a source Range via existing anchor contract, or explicitly treat unresolved matches as article-level fallback and consume/expire the one-shot handoff safely instead of implying an exact passage was reached. Do not highlight a guessed different inflection or automatically pick a different document to satisfy the query. Exact native/W57 keyboard success must remain protected.

This is distinct from repeated-occurrence disambiguation already acknowledged W123: this fixture has ONE actual paragraph occurrence. It does not demand new occurrence chooser UI or a second search modal. Implementation remains shared search executor's lane; no Product patch made.

Reproduce sibling probe with BASE_URL/OUTPUT_DIR, optional PLAYWRIGHT_PACKAGE_JSON/CHROMIUM_PATH; server must be actual preview.py with built Pagefind. No static-only desktop proof.

Limits: one article/morphological pair, Chromium-only, not WebKit/Firefox/AT/physical/dark/zoom/short-landscape; no multiword/typo/ranking/performance or repeated-occurrence coverage. Quiz verified presence/count only, no restored answer or notes acceptance. No resize-persistence or SYS shared-asset integration. Existing marker/focus/satellite/landscape/print/concurrency gates not closed; W107/Draft/HOLD preserved.
