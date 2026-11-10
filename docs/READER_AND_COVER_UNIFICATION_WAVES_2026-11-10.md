# Reader and cover unification — continuous waves

Owner: gb-is-my-strength. Scope: all article families, chapter-based books, standalone articles, reader navigation, historical images, and related/social previews.

| Wave | Objective | Checkpoint at local candidate |
| --- | --- | --- |
| 0 | Inventory HEAD/PR, identify all reader owners and poster sources, protect other agents' work | Source baseline captured; existing 90 uncommitted changes deliberately untouched |
| 1 | Replace text-based poster covers and forbid them from new article publications | 11 archival compositions replace Russian Baptist title cards, heart prior correction retained, source guard added |
| 2 | Make a single visual system for TOC (not a nested card) while keeping semantic reader components | Shared TOC heading extracted for standalone and series rails (historical IDs/classes and native collapse handlers retained); visual acceptance still required |
| 3 | Preserve genuine document provenance, correct image metadata, and maintain unique article thumbnails | Archive sources registered; site search and OG references revised; rights/historical attribution need independent editorial review |
| 4 | Test series navigation, scrollspy, focus, keyboard, collapse, history and embedded chapter hierarchy | Engine contracts pass; full browser acceptance remains gate |
| 5 | Verify every reader family at 320/390/768/1024/1440/1920 in light/dark and Chromium/WebKit/Firefox | Pending full cross-browser matrix; sample browser checks alone do not mean entire site passed |
| 6 | Production-like build, cache-bust, full CI on exact PR HEAD, preserve existing branches, release only after green | Local build passes; GitHub PR/CI required before merging |
| 7 | Verify deployed release SHA, live screenshots, search/index behavior, no old artwork in cache, and monitor regressions | Pending publication |

## Non-negotiable acceptance

Do not create a new competing reader engine. Reuse SeriesReaderChrome, ReaderRail, existing scrollspy and mobile overlay owners. H2/H3/H4 navigation and historical chapter numbering must remain unchanged. Article prose links remain accessible while TOC links remain visually clean. No fake historical artifacts, no duplicated article title inside hero pixels, no synthetic title-card SVG/WebP. All real scans must carry a source and rights status; do not pretend historical attribution is proven by a filename.

## References

- `docs/READER_TOC_GROK_ADAPTER_GATE_2026-11-06.md`
- `docs/EDITORIAL_COVER_POLICY_2026-11-10.md`
- `data/baptist-editorial-cover-sources.json`
- `scripts/editorial-cover-contract.cjs`

## Canonical TOC heading handoff

`src/components/article-pilots/_shared/ReaderTocHeading.astro` owns the presentational label and count in both `ReaderRail` and `GillSeriesRail`. It does not own scroll state or a new overlay; the series reader passes the original native collapse button through its slot. This is a markup deduplication only, not proof that the complete reader-engine or desktop Grok layout is unified. Source assertions live in `scripts/series-reader-facade-regression-test.js`; release approval still requires computed-layout and keyboard/browser witnesses.
