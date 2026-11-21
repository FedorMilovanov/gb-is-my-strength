# Journal / G3 — bounded editorial proposal

## Lane record

- **Mode:** LANE. **Owner:** **Agent 1**, as explicitly designated by the user, on `arena/a9995426-gb-is-my-strength` (Draft proposal #2340).
- **Purpose:** improve the native Journal presentation and two independently scoped G3 texts; do not create another publication or evidence owner.
- **Product main / rollback:** `9edef94ece08012223c1364bec7ddcd561cf5713`.
- **Integration baseline:** canonical Draft [#2338](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338), `lane/journal-editorial-premium-20261118` at `b2ae614730b0c2e164d3b07453797074253d9698`.
- **Overlap decision:** this Arena branch cannot take over the canonical branch. Its owner was notified in [the scope comment](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338#issuecomment-6986389011). This is one bounded, stacked proposal for that owner to integrate, **not a competing Journal release**. Review the delta after `b2ae6147…`; do not replay the inherited history onto main. No merge, branch rewrite, dependency update, global runtime or Research write is authorized here.
- **Allowed surfaces:** `src/components/journal/**`, source-only history metadata/bibliography and local presentation projections under `src/data/journal/`, two route-local regression witnesses and this note. The canonical Scripture-index generator additionally requires the derived `scannedSourceFiles` count to move 545 → 549 for the four new presentation components; a comparison proved all `references` and all other fields identical. This is a one-field generated housekeeping delta, not a Bible/search-system rewrite. Existing public metadata, September handoff/bibliography, public routes, global reader/search/theme/floating controls and route registries are not changed by this delta.
- **Source of truth:** existing Astro route owners; Product operational/editorial contracts; immutable September publication handoff; Research Draft [#582](https://github.com/FedorMilovanov/Research/pull/582) at `93d6f08a40c7989eb1f6362fd1667094742144d2` for **held candidates only**.

## Confirmed observations and substantive changes

At the integration baseline, 390px screenshots showed the masthead's horizontally clipped navigation. The earlier layout also repeated a long rail after the main text on mobile. Those observations were reproduced against the actual inherited build, not inferred from old reports.

The proposal makes a full-width typographic opening, image/context spread, restrained reading column and compact repeated desktop rail. Mobile has a two-column masthead navigation and single-column article/timeline composition. The rail contains no unique evidence and is omitted at narrow widths; article contents and bibliography remain in the reading order. Both themes use the same hierarchy with explicit paper/ink/source-link palettes.

Reusable presentation owners are `JournalArticleOpening`, `JournalContents`, `JournalBibliography` and `JournalSeriesNav`. Titles, images, series entries, dates and evidence remain inputs; these components cannot grant publication. Contents and source navigation use native HTML rather than a new control handler. The G3 series deliberately has **no history href**.

The crisis dossier retains its canonical route, 16 authorized claim IDs and 21 source objects. Human-readable reference labels replace internal IDs in the reading flow; IDs remain traceable in data attributes and source targets. The bibliography is initially open, contains return links, and preserves inherited class/eligibility values without treating a reader label as a new evidence classification.

Prepared media is reused, not regenerated: the five `public/images/journal/g3-ministries-*` files already existed in Product. Measured covers are 1200×675 and 640×360 (AVIF/WebP); the OG is 1200×630 WebP. No third-party poster, portrait, video frame or original-resolution replacement is added. The cover is explicitly captioned as an illustration, not an archival photograph. This proposal makes no new trademark or third-party media-rights claim. The original publication/modified dates are inherited unchanged; a design check or commit is not a new editorial date (see #2301).

## Source-only history: what changed and what did not

The standalone 2013–2024 manuscript now has its own opening, six-part contents, year anchors, bibliography and source-return navigation. A record of a scheduled speaker is distinguished from a catalogued session, listening, participant memory and independent corroboration. No audio/video was listened to in this lane, and no audio quotation is claimed verified.

Bounded source checks changed actual wording, rather than merely adding references:

- **G3-HIST-PUB-02/03/04:** GNL 2013/2014/2019 catalogs were read for speaker/title correspondence, not sermon content. 2015/2016/2017/2020 catalog details remain inherited from the pinned Research candidate and are not represented as newly listened material.
- **2014 announcement:** Southern Equip names January 23–25 and a church theme, but the fetched body does not state the year. The bibliography now exposes that limit rather than using a media-directory date as proof.
- **G3-HIST-PUB-05:** Aniol's September 1, 2021 announcement is a first-person appointment and plan, not proof that every proposed project had launched. `Sharper Iron`, *Gospel-Grace-Glory: An Examination of G3 Ministries*, chunks 0–1 (Conferences, Ministries and the relevant Fundamentalism paragraphs) was read for the Press/network/journal description and Buice's distinction between conference cooperation and church-network agreement. It is a secondary overview, not the original project register. An exact pre-2024 G3+ launch chronology is not claimed closed.
- **G3-HIST-PUB-07:** the AJC September 6, 2023 article is a pre-event announcement, not a report. Prata's September 22 account is attributed participant testimony about part of the event, not a complete speaker register or an audited attendance count.
- **G3-HIST-PUB-08:** the official statement site failed twice in this lane. The draft retains attributed material from the pinned Research candidate, explicitly pending original-text recheck; this lane does **not** claim to have read it independently.
- **G3-HIST-PUB-09:** October's Ticket Tailor object `1270768` is **publisher registration**, not general attendee registration. Peters' newsletter was published January 15, 2025 and describes 2024 travel; his first-person participation is separate from the organizer's announced dates/venue. A changed venue is not assigned an invented cause.
- The exact 2017 venue-move claim based on Buice's oral interview is omitted pending human audio/context verification. Challies' undated recollection of the move is kept attributed. No retrospective attendance curve is constructed.

These checks stop at the named question and sufficient wording correction. They are not a new discovery campaign or a second Research ledger. Source URLs and reader locators live in the manuscript bibliography; no private research bodies/media are copied.

### Publication boundary — unchanged

- Public authority: evidence `893e952de4e7ae617af02aca1344d385abcdf71b`, seal `298d00ddc4db46522c8ad904016e98a4426c9fcf`, `G3-PUB-001…016`, 21 sources.
- All **nine** `G3-HIST-PUB-01…09` remain candidates on `PUBLICATION_HOLD`; `handoffStatus=NOT_ISSUED`. Research classes `A1/A2/A3/B1/C/D` and separate access/locator/rights/publication dimensions are not redefined here.
- Both history component entrypoints throw in production. `/journal/dossiers/g3/history/` is not registered, built, linked, indexed, added to RSS or added to sitemap. The local review fixture is ignored, noindex and development-only.
- The November legal/name-change/asset overlay is **not** silently projected into the public September dossier. A renamed corporation does not prove a G3+/Press acquisition, completed closing or transaction terms.
- Existing unknowns remain unknown: late-August board continuity; director/resignation mechanics; property/note chain; Buck item-level human audio/source/attribution review; mailing actor/motive; transfer/rights terms; attendance and quantitative content history.

## Agent 1 — multi-agent continuation

The owner's continuation explicitly authorizes isolated alternatives for comparison, not a takeover of another agent's branch. The [continuation scope](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2340#issuecomment-6988378368) starts at `a7ac603b13f12dcde6b76b5dc386f62d3b27dd4a`. Read-only overlap anchors: Agent 4 #2339 `0b9576278d2ec5ea89da804934823d460720501a`, Agent 7 #2341 `0082371b3de1b806f637e73f71877f54a8140f63`, Agent 5 #2342 `336a6782e0a49f965f60f528b63117b884fdac29`; Agent 6's route-date safeguard remains a separate integration review. These are audit snapshots, not claims that those branches remain frozen.

Agent 1 keeps the native-HTML alternative. No other branch, scrollspy, financial projection, head/date work, global font/cache/service-worker change or new runtime is imported. Agent 4 receives discovery credit for the inline-space/identity/footer findings: those were independently reproduced on this branch before the equivalent bounded fixes were applied.

Confirmed at the starting HEAD, then repaired within the existing Journal owners:

- **Compressed reading text:** four factual paragraphs lost word boundaries beside inline tags; the dynamic research-note link also lacked its intended separator. The source change preserves every non-whitespace character. The regression derives expected literal paragraphs from the actual Astro source and compares them with the production DOM, rather than maintaining a second prose fixture. Its new check failed against the old dist before repair.
- **Masthead name:** an overriding `aria-label` omitted visible publication text. The name now comes from the visible text, with the book graphic decorative; the browser checks the computed accessible-name match rather than assuming an axe pass covers it.
- **Safe areas:** Chromium CDP genuinely exposed 44px left/right insets at 844×390, but the article and masthead retained 32px gutters. Local gutter tokens now respect physical safe-area insets across reading content, masthead and footer; tests cover synthetic landscape and narrow portrait insets. This is not a physical iOS/device claim.
- **Landing footer alignment:** at 1440px the reading edge was x=128 while the footer link began at x=160 (also a 32px mismatch at 1920px). The footer now uses the same maximum width and gutter token as the reading container. Every Journal matrix case checks the actual shared edge.

All fixes are presentation/render-integrity only: no new claim, date refresh, evidence/rights decision, history link or publication permission. Existing public metadata and the September source objects remain untouched.

## Local workspace continuation — print pagination

After the sandbox resumed successfully, the owner requested local workspace work while connectivity recovered. This continuation stays on Agent 1's existing branch and proposal; no merge, push, remote comment or publication change is part of this step.

- **Mode / owner:** LANE / Agent 1. **Repair baseline:** `dceed04b4fa42bfff16891759b730118f933f645`; main/rollback and canonical integration base remain those above.
- **Bounded scope:** the print-only blocks of `journalEditorial.css` / `g3History.css`, their existing browser witness and this note. No screen styles, text, metadata, evidence, media, runtime or route changes.
- **Current-head verification:** fresh Chromium A4 output reproduced three detached section-label/heading pairs (two in the public dossier, one in the source-only history) and four history reading paragraphs split between sheets. The prior witness inspected only the first `.prose > p`; it did not cover history-specific reading owners.
- **Root cause / repair:** section labels lacked `break-after: avoid`; history-specific reading paragraphs and heading wrappers lacked the corresponding fragmentation rules. A full history year may still span sheets, while its individual paragraphs stay together. No `!important`, global print override or new handler is introduced.
- **Negative control:** before changing the CSS, the strengthened full browser run completed all 48 screen cases but failed exactly four print assertions against the old presentation. The failed run and fresh baseline PDFs are retained in `reports/g3-editorial-wave/agent1-workspace-review/`; the earlier dceed report remains unchanged historical evidence.
- **Overlap:** main, own PR, canonical PR and Research #582 were checked read-only; the canonical / Research anchors had not moved. Adjacent proposals had moved since the previous report and were not imported or written. Source of truth remains the two native route profiles, existing Journal owners and the unchanged publication handoff.
- **Required checks:** production-like build (including its canonical asset-revision flow), strengthened 48-case browser suite, DOM-derived all-page PDF text/pagination/geometry inspection, exact screen-image comparison and relevant route / publication / source-integrity contracts. Missing engines, device/zoom tests, remote CI and owner visual approval are not converted into local passes.

## Local print follow-up — heading/content and source-note pairs

The owner's next continuation resumes useful sandbox work, still on Agent 1's existing branch and proposal. This step does not merge, deploy, push or change publication authority.

- **Mode / owner / boundary:** LANE / Agent 1; baseline `5d6a4d063de11e64e2e34403858c91b517ea3f86`, with the same main/rollback and canonical integration base above. Only the two existing print-CSS blocks, existing browser witness and this note change. No article markup, screen rules, wording, dates, evidence, media, dependencies, shared runtime or route changes.
- **Confirmed current, not inferred:** fresh non-injected PDFs on clean `5d6a4d0` uniquely matched all 62 main reading paragraphs, 24 source-note/previous-paragraph pairs and 41 heading/first-content pairs. They reproduced `PRINT-VIS-01` (history heading 10 → first item 11) and `PRINT-VIS-02` (dossier source note 2 → 3; history source notes 2 → 3 and 12 → 13). The earlier label/heading and paragraph repairs remain intact.
- **Bounded root cause:** source-note paragraphs lacked keep-with-previous. The first milestone grid row could fragment after its border, despite the heading's existing `break-after: avoid`. Diagnostic `break-before` rules for the list and first item did not fix that internal grid fragmentation. The minimal successful probe adds `break-before: avoid` to source-note paragraphs and `break-inside: avoid` only to the first milestone item; no new wrappers, whole-chapter keep or redundant list rules are required.
- **Negative control:** before CSS mutation, the strengthened full browser run passed all 48 screen cases and failed exactly three new print-rule assertions. These are explicitly computed-style guards, not a substitute for DOM-derived real-PDF pagination checks. Injected diagnostic PDFs remain diagnostic-only, not fixed-source acceptance.
- **Overlap / publication:** main, canonical #2338, own #2340 and Research #582 were read again; canonical/main/Research anchors remained unchanged. Adjacent proposals were inspected read-only and not imported, including their separate metadata/navigation changes. All nine history gates stay HOLD, both production throws remain, and no history public route/link/index entry is created.
- **Verification / evidence:** use fresh exact-head build/canonical asset revisions, browser matrix, all-page paragraph/label/source-note/heading-content PDF inspection, pixel identity and relevant route/publication/source-integrity contracts. New artifacts live under `reports/g3-editorial-wave/agent1-print-followup/`; the prior `agent1-workspace-review` package and its checksums remain immutable. Other engines, physical devices/UI zoom, remote CI and owner art-direction approval must retain their actual statuses.

## Verification and integration

The final exact-head results belong in the proposal PR and `reports/g3-editorial-wave/` (ignored artifacts), not in an invented live/deployment receipt. The checkpoint may precede completion of final acceptance. A source merge or green CI does not issue a history handoff.

Directly applicable commands:

```sh
# Use a Node version meeting package engines; no project dependency changes.
npm run strangler:build:production-like
node scripts/journal-editorial-contract.mjs --probe-hold
node scripts/native-runtime-taxonomy-audit.js --strict --route /journal/
node scripts/native-runtime-taxonomy-audit.js --strict --route /journal/dossiers/g3/
npm run page-ownership:dist:production-like
node scripts/search-manifest-policy-normalizer.js
node scripts/rss-feed-normalizer.js --check
node scripts/sitemap-policy-normalizer.js --check
node scripts/build-scripture-occurrence-index.mjs --check
node scripts/editorial-lint.js --sources --root src/components/journal
# Browser runner variables are documented in its header.
node scripts/journal-editorial-browser-test.mjs
```

The requested visual/browser acceptance is 320/360/390/430/768/1024/1440/1920, both themes, real before/after desktop/mobile views, anchors, keyboard, no-JS reading, overflow, loading, WCAG A/AA axe diagnostics, orientation and print. Reflow-equivalent viewport tests are **not** a claim of testing browser-UI zoom or a real iOS device. Firefox/WebKit downloads failed with TLS `ECONNRESET` in this restricted sandbox; Chromium fallback evidence must not be called a three-engine pass. Final status must explicitly list any checks still unavailable.

**Next meaningful Research step:** original-object/locator and human-audio review of the remaining history candidates, then a new signed Research→Product handoff with the exact authorized text. Do not remove the production guard as part of a design-only integration.
