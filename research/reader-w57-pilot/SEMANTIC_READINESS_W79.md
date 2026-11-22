# W79 — Universal Reader semantic readiness baseline

**Status:** verified read-only research; **not** a Reader-engine migration, visual sign-off, or permission to enable W57 globally. PR #2352 remains Draft/HOLD. Baseline source: `2dd5f4d946d540810054087dabffa89d024a6d41` (22 Nov 2026). Existing accepted W57 desktop visual assets were not modified.

## Reproducible contract

```bash
# After a production-like dist build. No page/source mutation.
node scripts/reader-universal-semantic-readiness.mjs
# Optional: keep report entirely outside the checkout
READER_COVERAGE_REPORT=/tmp/reader-w79.json SOURCE_SHA="$(git rev-parse HEAD)" node scripts/reader-universal-semantic-readiness.mjs
```

The contract loads **one read-only, pure DOM inspector** `reader_universal_contract.js` in a disposable local Chromium session, not the W57 UI/controller. It compares the real rendered article/heading/button structure with occurrences in `data/scripture-search-index.json`. It classifies **candidate pages separately from already-adopted shared-series pages** and checks the explicit Nagornaya / updates / journal exclusions. It does not call external APIs or save/read real user annotations. JSON output is a diagnostic, **not** a green semantic parity certificate.

## Measured facts

| Metric | W79 |
| --- | ---: |
| Built site pages | 113 |
| Existing shared-series Reader routes | 68 |
| Standalone long-form review candidates (not auto-approved) | 6 |
| Browser pages inspected | 74 |
| Browser navigation errors | 0 |
| Explicitly excluded built pages (Nagornaya/news/journal) | 12 |
| Shared-series pages with mobile Analytics markup | 68/68 |
| Pages in shared cohort with any source-index Scripture mentions | 59/68 |
| Pages in shared cohort with `button.bref[data-ref]` | 8/68 |
| Pages with source-index mentions but no `button.bref` | 51/68 |
| Duplicate HTML IDs found | 0 |
| Pages with heading elements lacking ID (all inspected) | 6 |

The source index contains **1,372 references and 3,510 occurrences**; 85 distinct URLs have at least one occurrence. The index's separate 103 `indexedRoutes` statistic measures *all indexed routes*, not routes with Scripture occurrences. Do not confuse the two denominators. An indexed **source occurrence** is not equivalent to a rendered clickable `button.bref` or a distinct Bible passage, so the numeric difference is a **coverage warning**, not proof of missing citations or invalid text.

### Standalone review candidates — not installed Reader routes

| Page | W57 read-only inspector headings | `button.bref` distinct | Source-index occurrence count |
| --- | ---: | ---: | ---: |
| /articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/ | 16 | 154 | 240 |
| /articles/kod-da-vinchi/ | 39 | 7 | 54 |
| /articles/lot-i-sodom/ | 30 | 0 | 85 |
| /articles/steven-lawson-samoobman-i-publichnyy-golos/ | 87 | 0 | 23 |
| /hard-texts/genesis-6/ | 1 | 0 | 2 |
| /hard-texts/otstuplenie-ot-very-iuda-evreyam-6/ | 34 | 0 | 154 |

**Important:** the one-heading Genesis 6 route may be a navigational/index surface rather than a full article. Verify its semantic owner before proposing any adoption. All six lack the existing shared-series mobile Analytics markup, but they may have other legitimate product experiences. Do not cover them by a global CSS selector or reparent their existing controls.

## Actual mobile Analytics visual/interaction QA (separate, not part of the source report)

Chromium and WebKit, mobile 320 dark / 390 light, four built pages: Gill I, «Что Библия называет сердцем», «Сердце: справочник», «20 антисоветов пастору»: **16/16** native open scenarios, with zero document horizontal overflow, zero recorded JS page errors and 44 px first Scripture targets. The current-section citation count is *not* supposed to equal the entire source-index count.

Expanded «Писание» on the two dense pages, Chromium/WebKit × 320/390: **8/8** successful. Important **UX debt**, not code corruption: «Сердце: справочник» renders 109 unique shelf entries with a 4,714 px horizontal rail for a 168 px viewport slot at 320 px (5,306 px rail / 226 px slot at 390). «20 антисоветов» renders 62 entries with a 2,902 px rail / 168 px slot. The 44 px controls and horizontal scroll work, but this long ungrouped shelf is difficult to scan, especially with side arrows reducing available width. Real screenshots are in `%TEMP%\reader-W79-visual`, **outside Git**.

## Go/no-go decisions for the reusable engine

1. **Semantic source first, DOM adapter second.** Provide a versioned `ReaderSemanticSnapshot` with route, section, edition/content fingerprint, canonical Scripture ID, original label and exactly bounded passage, per-occurrence origin/sourceOwner, terms, footnotes and quote ranges. Join to a **verified visible position**; never invent DOM coordinates or claim parity from button counts.
2. **One normalized resolver.** Reuse `bible-reference-core`, published Synodal bounds and source-owned occurrence index for all adopted article types. UI must truthfully show `В текущем разделе` versus `Из всей статьи` and handle repeated references, cross-chapter spans and text-only mentions. Desktop and mobile consume the same snapshot; visual skins remain distinct.
3. **One annotation identity and writer.** Reuse `GBReaderAnchors` + Product Library. Make concurrent note edits detectable (revision or transaction ownership), retain separate identical-text positions, and fail closed for ambiguous legacy/cross-page navigation. Avoid second painter or second localStorage key.
4. **Dense reference navigation.** Replace the 109-entry endless shelf with a **shared query/group model** (book/section/search, distinct occurrence versus passage, keyboard and touch) before globally spreading Analytics. Preserve exact citation labels and one-tap return-to-source. Visual design must be tested across both paper themes and minimum 320 px width.
5. **Anchor provenance.** Inspect unanchored headings by source owner; distinguish intentional subheadings from structural TOC entries. Never insert synthetic `gill-search-p-NNN` anchors or infer a position from matching text alone.
6. **Cohort rollout only after parity.** Pilot Gill page in dual-read/single-write mode; validate against normal articles and historical chapters, then other approved long-form pages. The explicit Nagornaya and news/G3 exceptions remain frozen. Keep W57 desktop layout and mobile Classic typography unchanged until an owner-approved redesign.

**Release HOLD** is still required for new-head CI, semantic parity across all eligible route families, linked-note concurrency, legacy/cross-page citation navigation, dense Analytics UX and visual review. Passing this baseline only closes the **route and semantic inventory measurement** task.

## W80 — immutable source-owned semantic snapshot (22 Nov 2026)

Implementation (read-only): `src/lib/reader-semantic-snapshot.mjs`, tests in `scripts/reader-semantic-snapshot-contract.mjs`. The existing `scripts/reader-universal-semantic-readiness.mjs` now uses this shared module against the actual 74-route browser inventory. It does **not** inject a new Reader, change W57 appearance, select passage text, create an annotation ID, or attach unverified source anchors to DOM elements.

**Confirmed cross-check:** 68 existing shared-series Reader routes contain **2,627** source-index witnesses with source ownership; each survives the snapshot unchanged. **0 provenance-count mismatches** and 0 browser navigation errors across 74 checked pages (68 existing Reader + 6 standalone review candidates). The 6 standalone routes are explicitly reported as `unapproved-route` unless separately added to an inspected allowlist; 12 excluded Nagornaya/news/journal built pages remain outside the adoption cohort.

**Safe contract:** canonical Bible ID/key comes from the prevalidated index, not a second regex; original `raw` and `sourceOwner` are preserved. Repeated references are separate witnesses. A known index anchor is labeled `indexAnchorUnverified` and never promoted to a navigable DOM location. All `verifiedDomPosition`, `rangeSelector` and `verifiedSection` fields remain `null`; `canNavigateToOccurrence=false`. Snapshot collections and nested records are immutable. Missing/invalid source fields are counted and rejected, not rendered as trustworthy citations. Explicit blocked routes and uninspected candidates fail closed; no snippet of licensed verse text is copied into the new snapshot.

**Regression facts:** 1 John 1:5–2:2 and 1:7–2:2 keep their full endpoints and original `1 Ин.` labels; two occurrences of the same cross-chapter citation remain two witnesses. Gill's repeated `Ин 3:16` in different source sections remains distinct. Source-index absence is `source-index-empty-unverified`, not «в статье нет ссылок».

**Next gate:** an independent, verified DOM occurrence locator and section identity must join to this source snapshot without position guessing. Only then may the Product mobile Analytics and desktop W57 consume the same content, first in a dual-read/single-write canary. Dense 109-item Scripture shelves and linked-note concurrency are **not** closed by this module. Keep PR Draft/HOLD; do not enable broad rollout.
