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
