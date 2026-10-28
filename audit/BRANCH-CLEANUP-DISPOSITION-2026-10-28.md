# Branch cleanup disposition — 2026-10-28

**Repository:** FedorMilovanov/gb-is-my-strength
**Snapshot main:** 0e83c2adc10c053ed25146fa191f232f2e4a9ae9
**Policy:** docs/BRANCH_LIFECYCLE_V4.md, v4.3
**Scope:** remote branch refs and preservation of closed/no-PR work. No source code was changed by this cleanup.

## Method and result

Before cleanup, GitHub’s branches API and git ls-remote --heads origin agreed on 35 heads: main plus 34 topic branches. The live open-PR list contained six branch owners. Those six heads were excluded from deletion. Each of the other 28 heads was matched against an existing archive ref or first copied to a date-stamped archive ref at the exact same commit SHA. Archive refs were verified live before branch deletion. Deletions ran as four batches of seven; after every batch, ls-remote confirmed that each deleted head was absent.

The audit also found six heads that had disappeared since the 2026-10-13 inventory without an exact archive ref. Their commits remained available from GitHub and were preserved under archive/stale-2026-10-28/. Four other disappeared evidence heads already had exact 2026-09-30 archive refs. The source branch of merged PR #2183 is represented by its merge in main and was not re-archived.

After cleanup, GitHub’s branches API and ls-remote agree on seven heads: main plus the six open PR branches below. Main remains at 0e83c2adc10c053ed25146fa191f232f2e4a9ae9. There are 38 archive tags in the 2026-09-30 and 2026-10-28 branch-snapshot namespaces; each archived head below points to its exact recorded commit. Branches can be restored from their archive tag without reconstructing or cherry-picking commits.

## Current live branches and open PR disposition

| PR | Live branch and head SHA | Live status | Checks / disposition |
|---|---|---|---|
| #2143 | genealogy/editorial-direct-name-batch-20260924 — acd4ace4207d78aa3a249c81a9c28ce19429d7ca | Open, draft; behind main by 361 commits; GitHub reports mergeable | 14 success, 1 skipped. Owner-authored genealogy batch remains an unapproved draft. |
| #2164 | content/apostasy-five-part-series-20261003 — a95697592c58ef6494ac9e5182ebb851c77cba95 | Open, draft; behind main by 327 commits; GitHub reports mergeable | 17 success, 4 skipped. Owner-authored editorial series remains an unapproved draft. |
| #2179 | dependabot/github_actions/github-actions-c673fd7efc — 8dfc5b630cf57b51db8ea5d422e8ef3cc2d59df7 | Open; behind main by 41 commits; GitHub reports mergeable | 84 success, 12 failure, 7 skipped. Failures: guard, history-forensic, validate, Chromium WebKit Atlas focus lifecycle, native-source-contract, Machine writer lease and workflow CAS contract, exact-pins, validate-draft, Consent/assets/release source contract, npm-audit, contract, Regenerate pinned v2 corpus. Dependabot also reports missing dependencies/github-actions labels. |
| #2196 | dependabot/npm_and_yarn/npm-non-major-69a9df4a08 — 69a7ed4488d33fca6aa690d0e4cdad6c9075452a | Open; behind main by 41 commits; GitHub reports mergeable | 12 success, 19 failure, 2 skipped. Failures: metadata-ssot-closure, Chromium WebKit reduced-motion contract, production-like-contract, Bible App webkit deep clicks, Chromium WebKit Intro focus lifecycle, public-surface-browser-matrix, Hermenevtika chrome contract, Bible App chromium deep clicks, Native owners + Chromium WebKit, public-surface chromium and webkit touch/scroll, native-source-contract, reader semantic projection, cold bootstrap, built-index-contract, Home Chromium WebKit contract, production-like candidate build, Atlas focus lifecycle, Binary header + JSON-LD mutation contract. |
| #2197 | dependabot/npm_and_yarn/pixelmatch-8.0.0 — 5690d18b7345339490cdaebe9879d9b643da68af | Open; behind main by 41 commits; GitHub reports mergeable | 30 success, 2 failure, 1 skipped. guard and npm-audit fail. |
| #2198 | dependabot/npm_and_yarn/astrojs/react-7.1.1 — 630d016f92007d3db772ea08d7dd784065690d49 | Open; behind main by 41 commits; GitHub reports mergeable | 10 success, 21 failure, 2 skipped. Failures: built-index-contract, Chromium WebKit reduced-motion and Atlas focus lifecycle, npm-audit, Native owners + Chromium WebKit, Binary header + JSON-LD mutation contract, metadata-ssot-closure, production-like-contract and candidate build, reader semantic projection, public-surface chromium and webkit touch/scroll, cold bootstrap, guard, Home Chromium WebKit contract, Bible App chromium and webkit deep clicks, Chromium WebKit Intro focus lifecycle, public-surface-browser-matrix, native-source-contract. This is a major version jump from 6.0.4 to 7.1.1. |

No open PR branch was rebased, force-pushed, closed, or deleted. The four Dependabot PRs are not merge-ready with their current red checks. The two author drafts have green checks but still need the owner’s content/review decision. All six remain live and visible.

## Archived heads removed from the live branch list

The first 15 entries use exact archive refs created on 2026-09-30. The remaining 13 use exact archive refs created and checked on 2026-10-28.

| Removed branch | Exact head SHA | Preserved archive ref |
|---|---|---|
| agent/antisovetov-title-suffix-20260818 | 60ed2034028f36a030d0ba2732b15d74619a01ef | archive/stale-2026-09-30/agent/antisovetov-title-suffix-20260818 |
| agent/app-integration-zero-debt-20260820 | 723e82cc10491c2fc7e4a139628c1841899577d0 | archive/stale-2026-09-30/agent/app-integration-zero-debt-20260820 |
| agent/bible-app-deep-playwright-audit-20260819 | 3899f3d0decdc764b4b0eec99a765de298c389fb | archive/stale-2026-09-30/agent/bible-app-deep-playwright-audit-20260819 |
| agent/bible-app-deep-playwright-r2-20260819 | 2ed8512e59e0abe88c977eac51ed6c070885e9ec | archive/stale-2026-09-30/agent/bible-app-deep-playwright-r2-20260819 |
| arena/01a0a1b2-gb-is-my-strength | b51452e7e6f5dcfe2225623750a926499c7e83b1 | archive/stale-2026-09-30/arena/01a0a1b2-gb-is-my-strength |
| arena/01a0a1b4-gb-is-my-strength | b8c7f2c07bb5c88a3936cd5b03635d807727a7ed | archive/stale-2026-09-30/arena/01a0a1b4-gb-is-my-strength |
| arena/01a0a1ce-gb-is-my-strength | 0a1748d2717ee6f8a7fd45c64917216aab742350 | archive/stale-2026-09-30/arena/01a0a1ce-gb-is-my-strength |
| arena/01a0f415-gb-is-my-strength | 5517a8c5382449c20ebf836284585da26b63f8c6 | archive/stale-2026-10-28/arena/01a0f415-gb-is-my-strength |
| arena/header-cluster-audit-20261002 | 339bf2e2b646c2db2315423e379d2af5043cc65b | archive/stale-2026-10-28/arena/header-cluster-audit-20261002 |
| arena/header-cluster-repair-20261002 | 7ad067a0ec120244493dcfdd1aab530744952181 | archive/stale-2026-10-28/arena/header-cluster-repair-20261002 |
| arena/kod-da-vinchi-timeline-keyboard-20261002 | 45a3ee760c31a118fce378acd4dd4a3d6652b4ba | archive/stale-2026-10-28/arena/kod-da-vinchi-timeline-keyboard-20261002 |
| book/ch07-mazaev-prokhanov-research-v2 | 2a5687bd647027af4a5f5549f2e394d285b9916e | archive/stale-2026-09-30/book/ch07-mazaev-prokhanov-research-v2 |
| codex/baptisty-spravochnik-evidence-language | 528d9e5d5de4689cd558f948659d278c4fc23b13 | archive/stale-2026-09-30/codex/baptisty-spravochnik-evidence-language |
| content/apostasy-bible-study | 994b8735f79383c860ee6502ed36a9bcd9531886 | archive/stale-2026-10-28/content/apostasy-bible-study |
| deps/npm-non-major-20260906-r2 | 7131246133919e68ecb6ca72622219e2d5df17a4 | archive/stale-2026-10-28/deps/npm-non-major-20260906-r2 |
| fix/home-lifecycle-shortcut-test-sync-20261027 | 838fb9768c0432924e4e79a50827b98ab13d7be6 | archive/stale-2026-10-28/fix/home-lifecycle-shortcut-test-sync-20261027 |
| fix/npm-non-major-security-20260907 | 77fa9fc1e747594eebfb944a8be5746f17a98aca | archive/stale-2026-10-28/fix/npm-non-major-security-20260907 |
| fix/quiz-plain-text-payload-20261003 | 39aecaf722c0275631aa8e43bd917a78dc9fc3d0 | archive/stale-2026-10-28/fix/quiz-plain-text-payload-20261003 |
| fix/quiz-runtime-namespace-20261003 | f0eceafea6d7561116a3ba83771c2981b6c81dd7 | archive/stale-2026-10-28/fix/quiz-runtime-namespace-20261003 |
| fix/series-taxonomy-projection-20260911 | 6163135fd4cb0f72d0df4b47588fa6599abae051 | archive/stale-2026-10-28/fix/series-taxonomy-projection-20260911 |
| lane/metadata-reconcile-tma-pr518-20260908 | e486b50449e3d381c2ba95826bd43f3d8b633ea4 | archive/stale-2026-09-30/lane/metadata-reconcile-tma-pr518-20260908 |
| lane/metadata-review-decision-rimlyanam7-20260908 | 24cf91ec9e25631630f6460a1184114e90da5c0e | archive/stale-2026-09-30/lane/metadata-review-decision-rimlyanam7-20260908 |
| lane/metadata-standalone-three-reconciliation-20260908 | 08ae4a42ee0762ece15e84f345da1f7eb094320f | archive/stale-2026-09-30/lane/metadata-standalone-three-reconciliation-20260908 |
| lane/teen-core-content-clearance-20260908 | bedb511019f118df9fa16e054080c7e337381ee8 | archive/stale-2026-09-30/lane/teen-core-content-clearance-20260908 |
| reconcile/baptist-ch01-authority-salvage-20260924 | 71a4f5290c269e4130c310b62bae41c940662d62 | archive/stale-2026-10-28/reconcile/baptist-ch01-authority-salvage-20260924 |
| repair/antisovetov-title-suffix-20260906 | f85e0022891782435095178f33ca612eee58366c | archive/stale-2026-09-30/repair/antisovetov-title-suffix-20260906 |
| repair/source-surface-audit-completeness-20260906 | 38ded860973285c5a7379c8e3a0ed137e09d4d35 | archive/stale-2026-09-30/repair/source-surface-audit-completeness-20260906 |
| system/fix-article-quiz-next-ownership | 3120d0f0ae9ec0121c607ba7c153b186276d2ef3 | archive/stale-2026-10-28/system/fix-article-quiz-next-ownership |

These snapshots retain the content classes recorded in the prior audit, including UNIQUE_EVIDENCE, dependency/HOLD, and SUPERSEDED_VERIFIED. No dependency changes were merged as part of branch cleanup.

## Heads already missing at the start of this audit

These were absent from the 2026-10-28 live branch inventory. Where no exact archive tag existed, the still-fetchable commit was copied to the archive namespace and verified against its SHA. Four already had an exact archive ref. The #2183 source work was already merged.

| Prior branch | Head SHA | Disposition / evidence |
|---|---|---|
| arena/01a108e4-gb-is-my-strength (#2168, closed unmerged) | fdaabf0c5d3629050c0fe8fe5a7427d5a778b2f5 | Recovered as archive/stale-2026-10-28/arena/01a108e4-gb-is-my-strength |
| arena/avraam-preserve-ready-h1-20261002 (#2161, closed unmerged) | fe7f0bca976175395971ba8ec02213136fbd1128 | Recovered as archive/stale-2026-10-28/arena/avraam-preserve-ready-h1-20261002 |
| dependabot/npm_and_yarn/npm-non-major-92ac384687 (#2144, closed unmerged) | a1127516d84f132ed5e47fd6be5fa4029a574141 | Recovered as archive/stale-2026-10-28/dependabot/npm_and_yarn/npm-non-major-92ac384687; successor dependency PR #2196 remains open |
| fix/karty-holding-mobile-overflow-2180 (#2181, closed unmerged) | 0f2cb8ab978593af131f4277e7aa2288e90fdc43 | Recovered as archive/stale-2026-10-28/fix/karty-holding-mobile-overflow-2180 |
| fix/genealogy-relation-confidence-localization (no open PR; unique owner-sensitive UI finding) | 24b9ff5c2a0f13294c4d48df4928d414106fa113 | Recovered as archive/stale-2026-10-28/fix/genealogy-relation-confidence-localization |
| reconcile/ch01-pre-baptist-origins-research-20260911 (fallback to closed #2142) | a22513308d5d0d798d9ca40289b6a7038f16c697 | Recovered as archive/stale-2026-10-28/reconcile/ch01-pre-baptist-origins-research-20260911; prior audit found its changed content byte-identical to #2142’s one-file fallback |
| arena/fbf6f1fd-gb-is-my-strength (#2183) | 5c28e2e98599c5de451da7fa1c7476135c71ee69 | Already represented by merged PR #2183, merge commit c18cd9621d5d72dd6505bb3b4993533bafa1812c |
| audit/baptisty-total-production-audit-20260911 | f906fa798951caf6b4d6118607c8b422e38f4cae | Existing exact archive tag archive/stale-2026-09-30/audit/baptisty-total-production-audit-20260911 |
| lane/baptisty-book-production-status-20260906 | f95bce556e853fc3c2beb23a6fb2a458ef51ac7b | Existing exact archive tag archive/stale-2026-09-30/lane/baptisty-book-production-status-20260906 |
| reconcile/baptisty-book-status-20260911 | 4c247491304e52af50d6b3c5696cc9015362d49c | Existing exact archive tag archive/stale-2026-09-30/reconcile/baptisty-book-status-20260911 |
| reconcile/baptisty-media-recovery-20260911 | a85cd926d3ee58a3f5cf49b7a98a034b84bdab05 | Existing exact archive tag archive/stale-2026-09-30/reconcile/baptisty-media-recovery-20260911 |

## Reader measure PR sequence

PR #2206 is merged at main SHA 0e83c2adc10c053ed25146fa191f232f2e4a9ae9 from exact tested source head fd7e4e61bd76cde2394191089efec647d05e1d87. The source and merge trees matched exactly at 80953fd87cc71db270bb0dd76a39c68a916c274a. The prior local production-like build, browser, reader-layout, cache, and engine gates are recorded in PR #2206. PR #2205 remains closed unmerged and its exact original head is preserved at archive/stale-2026-10-28/fix/home-lifecycle-shortcut-test-sync-20261027; its tree differs from merged main, so it was archived rather than represented as merged.

No deployment is claimed. This file records branch/tag and PR metadata verification only; it does not assert new tests were run.
