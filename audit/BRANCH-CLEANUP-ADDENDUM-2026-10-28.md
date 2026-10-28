# Branch cleanup addendum — 2026-10-28

**Repository:** `FedorMilovanov/gb-is-my-strength`  
**Main at this addendum's base:** `cdf994b104d7b5eaeef407bf60e341e436efe1df`  
**Policy:** `docs/BRANCH_LIFECYCLE_V4.md`, v4.3  
**Scope:** disposition of the six PR-owned branches left open in the initial 2026-10-28 snapshot.

This addendum updates the earlier point-in-time report in `BRANCH-CLEANUP-DISPOSITION-2026-10-28.md`. The earlier report accurately records the inventory before the six PRs were closed. Each PR below was subsequently closed unmerged. Before removing any still-present branch ref, its exact head was preserved by a date-stamped archive tag. No dependency update from these PRs was merged.

## PR disposition

Check counts below were fetched from GitHub check-runs for the exact PR head SHA after confirming that the PR head had not moved.

| PR | Branch / exact head | Checks at archived head | Disposition | Archive ref |
|---|---|---:|---|---|
| [#2143](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2143) | `genealogy/editorial-direct-name-batch-20260924` / `acd4ace4207d78aa3a249c81a9c28ce19429d7ca` | 14 success, 1 skipped | Closed unmerged while still draft: owner-authored genealogy/editorial content still needed owner review. | `archive/stale-2026-10-28/genealogy/editorial-direct-name-batch-20260924` |
| [#2164](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2164) | `content/apostasy-five-part-series-20261003` / `a95697592c58ef6494ac9e5182ebb851c77cba95` | 17 success, 5 skipped | Closed unmerged while still draft: the five-part editorial series still needed owner review. | `archive/stale-2026-10-28/content/apostasy-five-part-series-20261003` |
| [#2179](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2179) | `dependabot/github_actions/github-actions-c673fd7efc` / `8dfc5b630cf57b51db8ea5d422e8ef3cc2d59df7` | 81 success, 12 failure, 7 skipped | Closed unmerged; required checks failed, including guard, validation, browser/focus, source-contract, exact-pins, and npm-audit gates. | `archive/stale-2026-10-28/dependabot/github_actions/github-actions-c673fd7efc` |
| [#2196](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2196) | `dependabot/npm_and_yarn/npm-non-major-69a9df4a08` / `69a7ed4488d33fca6aa690d0e4cdad6c9075452a` | 12 success, 19 failure, 2 skipped | Closed unmerged; required production-like, browser, reader, source-contract, bootstrap, and validation checks failed. | `archive/stale-2026-10-28/dependabot/npm_and_yarn/npm-non-major-69a9df4a08` |
| [#2197](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2197) | `dependabot/npm_and_yarn/pixelmatch-8.0.0` / `5690d18b7345339490cdaebe9879d9b643da68af` | 30 success, 2 failure, 1 skipped | Closed unmerged; `guard` and `npm-audit` failed for this major dependency update. | `archive/stale-2026-10-28/dependabot/npm_and_yarn/pixelmatch-8.0.0` |
| [#2198](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2198) | `dependabot/npm_and_yarn/astrojs/react-7.1.1` / `630d016f92007d3db772ea08d7dd784065690d49` | 10 success, 21 failure, 3 skipped | Closed unmerged; this major version jump had failed required build, audit, browser, reader, and source-contract gates. | `archive/stale-2026-10-28/dependabot/npm_and_yarn/astrojs/react-7.1.1` |

All six PRs are confirmed closed with `merged=false`; their recorded PR head SHAs match the archive refs exactly. The two owner-authored drafts were retained as recoverable snapshots rather than merged without the required content review. The four Dependabot proposals were not merge-ready because their exact heads had failing checks.

## Branch-ref and archive verification

After the PRs were closed, GitHub's branches API showed three of these source branches still present: #2143, #2164, and #2197. Their heads still matched both the PR records and exact archive tags. Each was then deleted with a SHA-guarded `git push --force-with-lease=<ref>:<expected-sha>`; Git reported each exact ref deleted. The source branches for #2179, #2196, and #2198 were already absent from the branches API after closure. No other branch ref was targeted.

Live GitHub API verification after these deletions showed exactly one branch, `main` at `cdf994b104d7b5eaeef407bf60e341e436efe1df`, and zero open PRs. The archive namespaces contain 19 refs under `archive/stale-2026-09-30/` and 25 under `archive/stale-2026-10-28/`, 44 total. Every archive tag in the latter namespace was enumerated from GitHub; the six refs in the table resolve to their exact recorded PR heads.

The already-tested reader-measure fix remains merged by PR #2206 at `0e83c2adc10c053ed25146fa191f232f2e4a9ae9`; the audit PR #2207 then advanced main to the snapshot recorded above. PR #2205 remains closed unmerged with its exact head archived, as recorded in the original report. This cleanup addendum makes no deployment claim and adds no product-code changes.
