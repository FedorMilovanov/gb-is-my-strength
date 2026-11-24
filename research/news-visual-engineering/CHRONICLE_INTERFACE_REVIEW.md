# Shared chronicle interface — engineering review, PRIVATE_REVIEW
24 November 2026. Not an implementation, publication permission, or new source authority.
Reviewed exact ART 969d933ae9b9c5d4e6bfe428cefaf286067718d4:
- research/news-art-direction/source-chronicle-model.mjs
- research/news-art-direction/SourceChronicleSpecimen.astro
- research/news-art-direction/source-chronicle.test.mjs
Reviewed exact MAX0 8f9130a97a916e58c5dbac7ce169ee1b8b93d98f G3Dossier.astro lines 233–265 and journalEditorial.css timeline rules.
## Findings
ART retains the original source object, rejects duplicate/unknown source selection, unsafe URLs and decreasing selected years. This is suitable for a bounded source-selection specimen. The selected year is supplied by the selector, not verified against a date in authority; group labels are free text. Do not promote this contract into a factual timeline without review of admitted date semantics. Existing G3 event list includes a range (8–12 May 2025), month precision, and an archive snapshot, although its range currently uses a single day datetime. Do not change frozen markup.
## Proposed single presentation interface
- A chronicle has a declared axis: event chronology OR document/evidence chronology. Visible title and incomplete-coverage notice. Neither is a numerical time scale.
- Each row has a stable existing anchor, an admitted claim or selected source reference, a visible date role (event, publication, capture, reproduction, or explicitly selected source period), heading/text and limitation. Source-only rows do not imply an event.
- Date descriptor is one of day (YYYY-MM-DD), month (YYYY-MM), year (YYYY), interval (start and end with explicit precision), unknown. Calendar validation, nonreversed intervals. Labels derived from typed dates, not guessed; unknown stays unknown. Do not turn a month/year into January 1 or an interval into only its first day in reader-facing HTML.
- Chronological comparison is based on uncertainty bounds internally; if intervals overlap, order is editorial and must not imply exact precedence. Equal dates preserve source order. Unknown entries are separate, not fabricated positions.
- Source authority remains Research/Product; use exact admitted relation and canonical source-return identity. A selected source has its own boundary. Multiple locators on one claim may describe the same underlying document, not independent witnesses. Preserve canonical bibliography and native fallback. No new ledger.
- HTML native list with explicit list semantics; date intervals use two time elements; source selection period only uses time if authority supports a temporal value. Use a clear role label. No click-only interactions, no forced motion, no axis length implying duration, no arbitrary date interpolation.
## Acceptance cases for joint implementation
| Case | Required result |
| --- | --- |
| 2019-06-06 day | Exact day and event role |
| 2025-05-08…2025-05-12 | Both endpoints visible; interval not one day |
| 2026-08 month | Month only, no day |
| Source selection year 2011 | Explicit selection label, not independently verified event date |
| Archive snapshot 2026-07-21 | Capture role distinct from event |
| Two overlapping intervals | No unsupported before/after inference |
| Unknown date | Visible unknown, no invented sorting date |
| Feb 30 / reversed interval | Reject |
| Existing source with unadmitted locator | Reject in claim projection |
| Two locators of one statement | One bibliography identity, distinct return links |
| Duplicate anchor | Reject or caller collision gate |
| NoJS, 200% Reader scale, A4/Letter | Native reading, visible dates and limitations, no clipping |
## Ownership
ART source chronicle remains private in #2385; AGENT2 does not create a competing model or renderer before joint interface acceptance and MAX0 task assignment. Existing G3 timeline remains unchanged. Next review whether date type/role validation belongs in a small shared pure helper and whether one list presentation can serve both approved forms. This document proposes a contract only.

## W6 — joint chronology intake (proposal, pending ART/GRAPHICS/MAX0)
Re-read ART exact 48ac3b9188eacec4e3b71c08718eae523d3ba904: source-chronicle-model.mjs blob 6aa5b26f now rejects duplicate/overlapping selected years and requires exact coverage by selected rows; SourceChronicleSpecimen explicitly labels "Год выборки". Retain this source-selection contract. It is not a dated event registry.
GRAPHICS #2381 G41 reports corrected 2018 chronology: 2025-05-23 retrospective outside 2018 lanes, distinct source, Ascol and Statement treated as same testimony family. The report is not independent visual certification.
Proposed one owner-aware intake:
- ART owns source-selection grouping and visual hierarchy; GRAPHICS owns the bounded historical spread (existing G39/G41 donor); AGENT2 owns reusable document/evidence projection and test interface. MAX0 assigns the single production component/path before implementation. No second timeline renderer or data registry.
- Use separate temporal roles: event, document, publication, modification, capture, reproduction, retrospective publication, selection period. Retrospective publication is evidence about an earlier event, not a contemporaneous reaction; the model may represent its date as publication with explicit retrospective relationship, not a second date ledger.
- 2018 route: one documentary companion adjacent to existing approved passage G3-HIST-PUB-13, not both a full chronology and repeated evidence grouping. Reuse native bibliography returns and canonical admitted claim/source/locator relation. Keep existing text and exact IDs; no new facts, rights, media, or external links from non-admitted sources.
- Required acceptance: Jan/Feb/June/Sept 2018 dates retain exact role and precision; 2025 retrospective separate; family count not independent witness count; disjoint missing-year selection; month and interval labels preserve precision; no JS required; 320 mobile, native keyboard and 200% Reader text; A4/Letter exact physical sheet check and manual paper review. No extrapolated date or new claim.
- Next: ART and GRAPHICS confirm one presentation choice and source-owner path; AGENT3 reviews exact routed integration only after authorization. This proposal neither changes donor files nor approves publication.

## W6.2 — G41/G42 exact intake and source custody (PRIVATE_REVIEW)
Reviewed GRAPHICS PR #2381 exact head 40b78638a7781afe940ef74b2c6db50532a18ff7:
- `research/g3-graphics-max/g3/G39-2018-DOCUMENTARY-SPREAD.json` blob `dac2e40e9aea439eb3c440ca2858016ea74e8fa1`: six 2018 records with date roles and explicit claims/limitations; 2025-05-23 retrospective outside both lanes.
- `G41-ACCESSIBILITY.md` blob `d47ff1490f24292bcf3afd3843770d2afbd6acf9`: 36/36 sandbox states, 540 Tab transitions, 288 computed outlines, 2052 contrast measurements, minimum 5.767; four one-sheet PDFs. These are reported prototype results, not NEWS routed acceptance or browser zoom/assistive-tech certification.
- `G42-NATIVE-INTAKE.json` blob `daaeb87e599098a03dbe47409bfb0372d6f40a76`: 16/16 source occurrences, 15 unique source IDs, no proposed citation-ID collisions; proposed placements `#g3-meaning` (atlas) and `#g3-year-2018` (spread). Exact existing source/runtime blobs: `g3HistorySources.ts` 410b57903b6fe4bb67f2e976253baee5b9591232; `G3HistoryArticle.astro` 9f21afdb08b521fa108afe79e2651a267b5765c9; `G3HistoryFeature.astro` d0063bece78e953e607d48b7e98956ede3cb64f7; `JournalSourceReturn.astro` f3ce414163b60da8560924eaf1cbb18a703332c0.
- Reproducible G41 archive is identified only by owner-chat ZIP SHA256 `a37cfec91d127acd33146efe168b35140a8f520629212a1746f8141e92e2c1e2`; the archive, HTML, QA runner and source assets are not among GRAPHICS PR changed paths. This is an explicit source-custody gap, not proof the archive is lost. GRAPHICS should retain the reproducible source package in its owned research lane before selective production intake.
- ART PR #2385 exact head 48ac3b9188eacec4e3b71c08718eae523d3ba904 still owns the off-route `source-chronicle-model.mjs` and `SourceChronicleSpecimen.astro`; its `year` is a source-selection year, not a verified event date. Do not merge that model into G3 event data or introduce a second renderer.
Single proposed integration contract remains: G3 owns canonical source/claim/anchor truth; GRAPHICS owns the historical-spread composition and evidence asset custody; ART owns editorial art direction; AGENT2 owns reusable document/date/citation projection and fixture QA; MAX0 assigns exact production path and one placement per specimen. Existing 2018 text, source IDs and return anchors remain immutable absent owner-approved intake. 2025 retrospective remains separate; Ascol and statement-history accounts remain one testimony family. No public import or donor merge.

Independent W6.2 crosswalk: parsed all 16 G42 entries against exact canonical-main blobs of `g3HistorySources.ts` (410b5790), `G3HistoryFeature.astro` (d0063bec) and `G3HistoryArticle.astro` (9f21afdb). All 15 source IDs occur in the canonical source/article projection; all 9 distinct return fragments resolve across the two article components; all 16 proposed citation IDs are unique. The earlier single-file probe against G3HistoryArticle alone was incomplete; the actual anchors for 2013–2017 and 2019 live in G3HistoryFeature. No missing-anchor defect is established.

## W6.3/W6.4 — production-route boundary and borrowed G3 focus contract
AGENT3 W10.8 exact-head route review: `src/pages/journal/dossiers/g3/history/index.astro` imports `G3HistoryArticle.astro`; `src/pages/journal/dossiers/g3/index.astro` imports `G3Dossier.astro`. Neither imports `JournalDocumentExhibit.astro`. NEWS exhibit browser/PDF fixtures remain private, synthetic, noindex. The 288/864/28 matrix cannot be presented as public G3 route, Lawson article, or documentary chronology acceptance. MAX0 must assign one actual NEWS route and an admitted source/claim authority before production integration. G3's own exact-head route tests remain separate evidence.
AGENT3 W10.8 mobile harness review was adopted: NEWS focus now requires a >=2px solid :focus-visible outline and width+offset >=2, settles real native smooth scrolling under a bounded driver-side deadline, verifies complete outline against usable viewport and visible shared header, and checks all overflow-clipping ancestors. NEWS component provides scoped 2px solid ink outline/3px offset, system Highlight in forced colors, and suppresses it in print. Additional 2x Reader scale remains a separate token stress, not browser zoom. DOM overlay sampling supplements (does not replace) image inspection, axe, contrast and screen-reader review.
