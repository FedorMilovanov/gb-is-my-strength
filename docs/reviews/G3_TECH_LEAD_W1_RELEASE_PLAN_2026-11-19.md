# G3 — Tech Lead: bounded Back decision, one release transport, W2 contract

## Status and authority

**W1 NOT FROZEN. `AGENT10_CAUSAL_MEMO_PENDING` / `NAV_OWNER_DECISION_PENDING` / `OWNER_BACK_DECISION_PENDING` / `BLOCKED_CANONICAL_WRITE`.**
No Product/UI, publication, Research, canonical/peer/main ref, package, CI or shared-runtime change is made by this checkpoint. This is a decision/engineering handoff, not a second integration PR.

- **Latest addendum, received before publication:** [Owner→Agent1 7018985606](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2340#issuecomment-7018985606) and [Owner audit7019004715](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338#issuecomment-7019004715) appoint existing specialist **Agent10** to the one residual causal investigation and **Agent11** to ON_CALL independent candidate verification. Agent1 does not duplicate either. FF is technically possible; navigation/source safety and release approval remain separate. This addendum is incorporated below, not hidden behind the earlier four/six-case plan.
- The [Owner organization order](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338#issuecomment-7017913219) and [direct Agent1 assignment](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2340#issuecomment-7017965472) explicitly replace Agent1's former tests-only role: **Agent1 technical lead / engineering delivery; Agent8 design director / exclusive frontend UI owner**. They do not grant canonical push permission.
- [Agent8's acknowledgement and bounded UI scope](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338#issuecomment-7018313904): three UI families under review, not yet an approved new source. No Agent4 patch is imported here.
- #2340 remains **SUPPORT / NO WHOLE-PR MERGE**; its historical alternative design is not selected. #2338 is the only canonical Product target. Closed #2342/#2344 are not revived.

| Identity | Exact anchor at decision preflight |
|---|---|
| Agent1 diagnostic runner / own rollback before this docs checkpoint | `8bccc701de78f53b1546672e0104c4b652745702` |
| Selected Agent8 source | `36e69c4d822f752d4f99914a55a6de798f7164e3` |
| Canonical #2338, OPEN/Draft, not integrated | `b2ae614730b0c2e164d3b07453797074253d9698` |
| `main`, read only | `9edef94ece08012223c1364bec7ddcd561cf5713` |
| Canonical writer | **UNASSIGNED**; no authority inferred from a title, GitHub login, or absent machine lease |

```text
Mode: LANE (read-only release rehearsal; the sole tracked edit is this review)
Lane / technical owner: Agent1, per Owner7017965472
Visual owner: Agent8; no presentation edits by Agent1
Allowed: this document; ignored reports/g3-editorial-wave/agent1-tech-lead-w1-release/
         and .cache/g3-audit/tech-lead-w1-release/; exact-source generator in .cache/
Overlap: #2338/#2339/#2340/#2341/#2343/#2345 and new #2347/#2348 files inspected;
         this path overlaps none.
Source of truth: pinned Git objects, existing Agent8 transfer allowlist,
                manifest ∩ production ownership, original publication authorities.
Checks: one bounded native UX decision, exact packet phases/negatives,
        isolated composite build/contracts/HTTP/reading, contract-only W2 fixtures,
        document/pin/command integrity and git diff --check.
```

PR bodies and current heads were inspected; neither target body contained a `GB_WRITER_LEASE_V1` block. That is an observation, **not** permission to acquire or impersonate a writer. Adjacent branches remain untouched.

## 1. Native Back: real observed loss, bounded instrumentation, no waiver

### Executed wave

One decision wave against the already-built exact36e HTTP artifact, HeadlessChrome `153.0.8010.0`, JS disabled, real keyboard Enter and browser Back. No interception, CSS repair, reduced-motion override, history manipulation, focus restoration, or injected Product script. Playwright's `--disable-back-forward-cache` flag was removed; an additional **read-only CDP session** recorded history and cache-miss events.

The original strict protocol ends at the **last series** `/hard-texts/`, not an article. Its four hash/clean controls are retained unchanged. Two bounded scope-completion cases use the last manifest `type: article` entry `/karty/avraam/`, at 390/1440 with hash, so the article wording is not silently represented by series-only evidence. This is six cases, not another browser/CSS matrix. Last-link focus preparation is disclosed; this is **not** a fresh179-key traversal or assistive-technology test.

| Departure / return | Width | Before → after Back, px | Strict scroll result | First native Tab after Back |
|---|---:|---:|---|---|
| hash → `/hard-texts/` → exact hash | 390 | 27506 → 969 | **FAIL** | First catalog article, not the departed series |
| clean → `/hard-texts/` → clean | 390 | 27506 → 27506 | observed-scroll PASS only | `#main-content`, scroll then goes to0 |
| hash → `/hard-texts/` → exact hash | 1440 | 12339 → 712 | **FAIL** | First catalog article, not the departed series |
| clean → `/hard-texts/` → clean | 1440 | 12339 → 12339 | observed-scroll PASS only | `#main-content`, scroll then goes to0 |
| hash → manifest article `/karty/avraam/` → exact hash | 390 | 24610 → 969 | **FAIL** | First catalog article, not the departed entry |
| hash → manifest article `/karty/avraam/` → exact hash | 1440 | 11102 → 712 | **FAIL** | First catalog article, not the departed entry |

Both collectors exit **1 because the strict gate fails**, not because setup failed (zero setup problems). The first collector took 34.468s; article completion 17.689s. Each case observed at least 4000ms; unchanged strict tolerance is **≤1px**. Original historical REDs and the159-unit tests-only delivery remain intact.

**URL/history and page return:** hash cases restore `/articles/#catalog-materials` exactly; clean cases restore `/articles/`. CDP current history indices for the series path are hash2→3→2, clean1→2→1; `history.length` is respectively3→4→4 and2→3→3, not a return-eligibility guarantee. Destination referrer is `/articles/` without its fragment, which is not evidence of a lost history entry. All90 authority entries remain in the returned DOM. The first Tab in hash cases focuses `/articles/dzhon-gill-istoricheskiy-kontekst/`; real Enter opens HTTP200, with H1 and exact built HTML bytes. Thus navigation is usable and not trapped, **but the reader's previous place is lost**.

**Focus and timing:** hash returns focus `SECTION#catalog-materials`; clean returns `BODY`. Neither retains the departed link. In the series hash cases an early exact Y is visible at31/38ms, then the viewport settles at the fragment rather than the previous link. An early sample or loaded fonts cannot turn the ≥4s result green. The actual first Tab confirms the sequential keyboard starting point, rather than inferring it from `activeElement` alone.

**BFCache/harness boundary:** all six measured returns reload the document (`back_forward`, new `timeOrigin`). CDP reports circumstantial `BrowsingInstanceNotSwapped` and `BackForwardCacheDisabledForDelegate`; the web-exposed reason is `masked`. Removing one disable flag therefore did **not** establish a cache hit in this instrumented headless environment. This narrows what the harness proves; it does not establish normal Chrome's cache eligibility, a Product cause, an unfixable universal browser defect, or a BFCache promise. Existing neutral controls are historical support, not new acceptance runs.

**Technical verdict:** `CONFIRMED_CURRENT_OBSERVED_UX_LOSS_ON_NOJS_RELOAD_HISTORY`; not merely a false assertion about focus, not a routing/data loss, and not a proven one-line CSS repair. Clean scroll PASS must not be reported as full keyboard-resume PASS. No gate is removed, weakened or relabelled green.

### Specialist boundary after the new Owner order

Read the exact reports at Agent10 `7d9c3d10b6aa4187fbe3d3bcdc7193abfab8325f` / #2348 and Agent11 `67c89307ed988677cfcd2fa5fa0ef4eeab91d82f` / #2347, plus Agent11's committed raw JSON and nine lab scripts. They are **peer evidence**, not newly executed Agent1 tests or a release verdict. The currently committed Agent11 snapshot contains14 JSON files (1 report +9 scripts +14 JSON =24 files); do not manufacture a fifteenth from an inventory claim. The original six-repeat variation/timing observations are partly report-only, not all committed raw cases.

- Smooth+hash animated takeover has useful actual/toy controls; removing smooth on Product is **not a proven ≤1px repair**. Raw Agent11 `v4` leaves−205px, `v6` still makes the large jump, while a single `v8` sample is0 and the report's repeats are mixed. Agent10's image/font ablation is contradictory. Do not promote those mixtures into “late-resource race proven” or a universal CSS/JS cause.
- Agent11 synthetic variants navigate to `/articles/x89/`; their static server returns404 for absent files and does not assert the destination status. These are `TOY_NONPRODUCTION_DESTINATION` controls, not published-link acceptance. The real `/karty/avraam/` cases and this wave's HTTP-pinned published paths remain distinct.
- BFCache delegate restrictions narrow both specialists' headless evidence. No device/cache guarantee follows. The latest Owner instruction, not an older unconditional `GO/FF` headline, governs release.
- **Agent10 owns the one new unique result**: controlled residual−205px/late-resource discrimination and at most the two already Owner-assigned isolated alternatives, with actual published links and honest strict/residual outcomes. **Agent1 and Agent11 run no replacement A/B/resource matrix.** After that compact memo, Agent1 makes one technical recommendation; Agent8 alone implements an approved route-local correction or Owner explicitly accepts a bounded residual. Shared `css/site.css` remains SYSTEM and untouched.

At this readback, the new unique Agent10 residual memo is not present in the inspected report. The following fallback candidate is therefore **not a request to bypass Agent10 or freeze the unchanged UI**.

### One fallback decision candidate: `BACK-LIMIT-01` — PENDING OWNER, not accepted

Do **not ship** speculative `scroll-behavior:auto`, a second return runtime, referrer routing, or a JS-off restoration script. Agent10's isolated, non-Product controls remain within his separate Owner assignment. Retain this **single explicit fallback tradeoff** for the post-memo technical decision, rather than silently weakening the gate:

> For an explicitly named W1 source/canonical candidate only, accept the observed no-JS, document-reload native-Back limitation of the existing `/articles/` library: exact prior scroll and prior-link keyboard continuation are not promised. With `#catalog-materials`, the observed return is to the catalog section and subsequent Tab starts at its first card; with a clean URL, the observed pre-keyboard scroll is correct but the next Tab starts at the document skip link. This can cost a reader the previously reached place in the long catalog. Exact URL/hash/history navigation, full published membership/text/roles/hrefs, native operable links, visible focus and honest existing SSR destinations remain mandatory. Keep the strict ≤1px/≥4s result **FAIL**, associated with this signed limitation rather than a green test.

The requested exception is limited to that **no-JS reload-history place/continuation behavior**. It does not waive JS-enabled behavior, route/HTTP/link integrity, content or attribution, citation/source-return, accessibility generally, BFCache-hit behavior, other engines/devices, or future regressions. It authorizes no new route, fallback runtime or history mutation. Existing parent/topic destinations are destinations, not an exact-history-return guarantee.

**After the single Agent10 memo and Agent1 recommendation, Owner must explicitly accept or reject any remaining named tradeoff and name the candidate.** Agent8 confirms presentation semantics; Agent7 reviews a specific changed UX only when triggered, not another causal investigation. If rejected, W1 stays blocked pending one newly scoped, Agent8-owned correction; none is claimed or implemented here. An unaccepted limitation cannot silently carry to Agent8's forthcoming polish SHA or to a canonical commit. W1 freezes only on accepted checks or an explicit Owner-signed bounded limitation.

## 2. One transport: Agent8 public35 + separate guard-only prerequisite

This independently verifies **Agent8's existing generator**, not a new transport owner or integration PR. The regenerated packet is useful/reproducible at36e; promotion waits the Agent10→Agent1 Back decision, explicit navigation choice, Agent8's stable approved source and one authorized canonical writer. Agent8's in-progress three-family polish is **not included**.

### Current ancestry: FF technically possible, not release-approved

Fresh local Git **and GitHub compare** agree: exactb2ae is an ancestor of exact36e, **ahead23 / behind0 /47 changed files**. `merge-base --is-ancestor` exits0. There is no technical branch divergence/FF obstacle. The35 allowlisted files account for35 changed paths; the other12 include held history presentation/metadata/`g3HistoryDraftSources.ts`, review tooling/docs and the derived Scripture index. The full FF therefore carries more source than this public-only packet, even if measured dist contains no history leak. No missing-history handoff is issued by ancestry or a negative string scan.

**One current engineering transport choice:** retain the tested **public35 + separately projected guard + separately regenerated index** for source-safety minimization. It produces all1431 public artifact files byte-identical to exact36e without importing the new held manuscript module. Selective transport is **a scope/safety choice, not a technical necessity**. Do not run a second FF path in parallel. If Owner explicitly chooses the full47-file FF scope instead, replace this promotion decision with one reviewed full-source/HOLD/navigation plan and one writer; do not blindly use the specialists' old unconditional push recipe. Either path still requires actual candidate checks and current ancestry/base readback if refs move.

### Pinned packet

| Item | Pin |
|---|---|
| Generator at36e, Git blob | `cda24daa4c90979656679673a79dd2eb28a81360` |
| Generator SHA-256 | `557b312ab5d1bd396dca6d51b9a1c1d73d3cbb2ac6e3282233268c1106da1cb0` |
| `public-editorial.patch`,376089bytes | `e1a717455fef9dff46474ac80b560d695b5cd15609ff9bdb599ff59baed80bed` |
| `history-production-guard.patch`,597bytes | `a99a71d00c17ba964fc4a353f6fb4f63521c7409d999c228b92eea88ec69a33e` |
| `transfer.json`,734314bytes | `dc231f8a5b270bbe3f4b05db53552c1c289d4a876f13b6e445602bbd0f6f82dc` |
| `README.md`,4290bytes | `5f81cef3a6c11cb776dda3a4cb51701957edfefd73e3e6e284013c79bc9afdea` |
| `PACKET_SHA256SUMS` SHA-256 | `03737ea866233ecbc702f717cbf5a0f7909aaecb8367b4648c32f37d5987bb96` |

Packet path (ignored artifact, **not** a committed download): `reports/g3-editorial-wave/agent1-tech-lead-w1-release/packet-b2ae-36e/`. Immutable source to regenerate it: [exact36e transfer generator](https://github.com/FedorMilovanov/gb-is-my-strength/blob/36e69c4d822f752d4f99914a55a6de798f7164e3/scripts/journal-editorial-transfer.mjs). The archive hash reported by Agent8 is peer evidence; it was not downloaded here and is not substituted for these independently generated pins.

**Complete35-file allowlist** (all final modes/blobs are in `transfer.json`, independently checked against36e):

```text
scripts/journal-document-metadata-test.mjs
scripts/journal-editorial-browser.mjs
scripts/journal-editorial-contract.mjs
scripts/lib/journal-print-pdf.py
scripts/lib/seo-route-contract.js
scripts/seo-route-contract-test.js
src/components/journal/G3Dossier.astro
src/components/journal/JournalArticleHeader.astro
src/components/journal/JournalContents.astro
src/components/journal/JournalDataFigure.astro
src/components/journal/JournalDocumentHead.astro
src/components/journal/JournalFontPreloads.astro
src/components/journal/JournalLanding.astro
src/components/journal/JournalMasthead.astro
src/components/journal/JournalSourceReturn.astro
src/components/journal/journalDocumentMetadata.ts
src/components/journal/journalEditorial.css
src/data/journal/g3EditorialMedia.ts
src/pages/journal/index.astro
src/pages/journal/dossiers/g3/index.astro
src/components/journal/JournalEditorialShell.astro
src/components/articles/ArticlesPageChrome.astro
src/components/articles/ArticlesMain.astro
src/components/articles/ArticlesPageFooter.astro
src/components/articles/ArticlesHeroSection.astro
src/components/articles/ArticlesLibrarySection.astro
src/components/articles/ArticlesRefutationsSection.astro
src/components/articles/articlesEditorial.css
src/pages/articles/index.astro
scripts/articles-visual-parity-audit.js
scripts/articles-editorial-contract.mjs
scripts/articles-editorial-contract-test.mjs
scripts/articles-editorial-browser.mjs
scripts/articles-editorial-native-diagnostic.mjs
scripts/lib/articles-print-pdf.py
```

The separate prerequisite changes only `src/components/journal/G3HistoryFeature.astro`: baseline blob `fec0ff57a0fa839a53745c86a90dcc2ce796df2a` → guard-only blob `81adf8be0857cdeacabf80d2827cc3fe9433d651`. Removing precisely the inserted known PROD throw plus its separator restores **every baseline byte**. Do not copy Agent8's whole held feature, historical prose, draft sources/CSS, or review route. Existing `G3HistoryArticle.astro` stays baseline-owned, with its existing guard. Publication remains16claims/21sources/9historyHOLD.

### Executed packet verification and negative tests

- `base`, `applied`, `guarded`: each checks3560 manifest states;35 transfer entries,3518 other baseline files pinned before the guard,3517 after it plus the one prerequisite,7 added source-only files required absent. Each verifier is read-only.
- Six negative cases **all rejected**: unapplied base claiming applied; missing guard claiming guarded; changed preserved date authority; changed selected library source; tampered public patch; actual `main` export substituted for exactb2ae.
- Gitless export's `git rev-parse --show-toplevel` exits128, with parent `.git` discovery blocked. `git apply --check`/apply occurred **only inside ignored exports**, not a Git worktree or canonical branch.
- Preparation attempts retain actual failures: first wrapper1 at buffered `git archive` (`ENOBUFS`) **after packet generation, before apply**; second wrapper1 at a QA-only directory-copy option **after guarded verification**. The corrected streamed, fresh-export verification exits0/4.342s. Neither failure is rewritten as a successful build or hidden.

### Reproducible dry-run commands

Run from an existing repository checkout with Node≥22.23.4 and the pinned Git objects. These commands only produce a **NEW ignored packet and gitless rehearsal**; they do not grant canonical write authority. Use a new output directory, never overwrite evidence.

```bash
set -euo pipefail
ROOT=$(git rev-parse --show-toplevel)
BASE=b2ae614730b0c2e164d3b07453797074253d9698
SOURCE=36e69c4d822f752d4f99914a55a6de798f7164e3
VERIFY="$ROOT/.cache/agent8-transfer-36e-reproduce.mjs"
KIT="$ROOT/reports/g3-editorial-wave/agent1-release-reproduce-kit"
EXPORT="$ROOT/.cache/g3-audit/agent1-release-reproduce-export"
test ! -e "$KIT" && test ! -e "$EXPORT" && test ! -e "$VERIFY"
mkdir -p "$ROOT/.cache"
git show "$SOURCE:scripts/journal-editorial-transfer.mjs" > "$VERIFY"
printf '%s  %s\n' \
  557b312ab5d1bd396dca6d51b9a1c1d73d3cbb2ac6e3282233268c1106da1cb0 \
  "$VERIFY" | sha256sum --check
node "$VERIFY" --base "$BASE" --source "$SOURCE" --out "$KIT"
mkdir -p "$EXPORT"
git archive "$BASE" | tar -x -f - -C "$EXPORT"
(
  cd "$EXPORT"
  unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR
  export GIT_CEILING_DIRECTORIES="$(dirname "$EXPORT")"
  if git rev-parse --show-toplevel; then exit 1; fi
  node "$VERIFY" --verify "$KIT/transfer.json" --target "$EXPORT" --phase base
  git apply --check "$KIT/public-editorial.patch"
  git apply "$KIT/public-editorial.patch"
  node "$VERIFY" --verify "$KIT/transfer.json" --target "$EXPORT" --phase applied
  git apply --check "$KIT/history-production-guard.patch"
  git apply "$KIT/history-production-guard.patch"
  node "$VERIFY" --verify "$KIT/transfer.json" --target "$EXPORT" --phase guarded
  ln -s "$ROOT/node_modules" node_modules  # reuse existing compatible install
  export ASTRO_TELEMETRY_DISABLED=1
  export GB_BUILD_INSTANT=2026-11-19T17:27:27+00:00  # TECHNICAL, never article time
  node scripts/build-scripture-occurrence-index.mjs --write
  npm run strangler:build:production-like
  npm run pagefind:build:dist
  node --test scripts/journal-document-metadata-test.mjs scripts/articles-editorial-contract-test.mjs
  node scripts/journal-editorial-contract.mjs --public-only \
    --transfer="$KIT/transfer.json" --require-dist --probe-hold \
    --output=reports/g3-editorial-wave/release-public-contract
  node scripts/articles-visual-parity-audit.js --require-dist
  node scripts/articles-editorial-contract.mjs --transfer="$KIT/transfer.json"
  node scripts/seo-route-contract-test.js
  node scripts/editorial-metadata-registry-preservation-test.js
  node scripts/sitemap-route-contract-test.js
  node scripts/rss-feed-normalizer-test.js
  npm run page-ownership:dist:production-like
  npm run overlay:runtime:test
  npm run tokens:check
  node scripts/build-scripture-occurrence-index.mjs --check
)
```

Full argv/cwd/exits/logs of the execution here are in `guarded-build.json`, not inferred from the command example. No `--3way`, branch merge, whole-PR cherry-pick, package install or source-side generated-index copy.

**Derived prerequisite is separate from35+guard:** the existing Scripture generator changes only `data/scripture-search-index.json`, `stats.scannedSourceFiles:545→550`. References1372, occurrences3511 and indexedRoutes103 are unchanged. Recorded derived patch SHA-256 `0dc85aaf1754db14ac25359ca3df7fb25a607a57cc7483672abafbb4b6c96905`; before/after blobs `a0a2e074c49b568164c9fe65533e25eccfc31955` / `22f644481eb3c0feadf5154e5cb3034a901cfa6c`. Re-run the **existing generator** and record this deterministic delta; never append it to the selected-public allowlist or edit it manually. The raw all-baseline verifier applies **before** generation; after generation use its recorded single-file delta plus full source pins, not a false claim that every preserved baseline byte still matches. All other3552 composite source files remain unchanged through build/checks.

### New isolated composite results — not canonical acceptance

Ignored target: `.cache/g3-audit/tech-lead-w1-release/guarded-composite-v2/`.

| Check | Actual outcome |
|---|---|
| Scripture derivation / current check | exit0/6.222s; exit0/6.176s |
| Production-like build | exit0/200.387s |
| Pagefind | exit0/3.822s; actual index queried |
| Metadata + catalog units | **81/81 PASS**, exit0 |
| Catalog source/SSR + UI contract | PASS; dynamic80article+10series+separate curated repeat |
| SEO route, date preservation, sitemap, RSS, ownership, runtime/overlay, tokens | all targeted commands exit0 |
| Public Journal source/SSR contract | exit0;37 non-citation source paragraphs unchanged |
| Independent full reading adapter | **43 ordered paragraphs,0 exclusions;16claims/21sources/11citations/9HOLD** |
| Actual production rendering of held Article + Feature | each child exit1, exact respective `PUBLICATION_HOLD` guard; parent contract exit0 |
| Fresh one-shot local HTTP against composite | `/articles/`, `/journal/`, G3 and Pagefind200/exact bytes; public history and local review404 |
| Source/artifact pins |3553 source files;1431 artifact files; **all1431 artifact sizes+SHA-256 equal the independently built exact36e artifacts** |

Full build wrapper exits0/227.600s. The artifact identity is byte evidence, **not** a new full browser/PDF run or canonical CI. No actual canonical candidate was written. Earlier own CI, old canonical workflows, Agent8's print green and the earlier coldCLS runs are not promoted to new integrated acceptance.

### Navigation gate — not automatically accepted by selecting a visual system

`CONFIRMED_CURRENT_NAVIGATION_DELTA`, not an approved loss. Exactb2ae `ArticlesPageChrome.astro` has direct upper links `/#publikacii`, `/#razbor`, `/biografii/`; its `ArticlesMain.astro` mounts the canonical `SiteSectionsMenu` with `/app/` and a **no-JS static projection**. Exact36e removes both consumers and uses the selected Journal masthead. The shared menu source itself is unchanged, but that does not preserve discoverability when it is unmounted. The new local `#razbor` is editorial choice, **not automatically the same destination as `/#razbor`**. Catalog membership remaining90/90 is not navigation parity.

**Agent8 action/Owner decision before promotion:** give one explicit destination/remap table for `/#publikacii`, `/#razbor`, `/biografii/`, `/app/` in the selected single navigation owner, including SSR/noJS and mobile discoverability, or obtain Owner acceptance of the exact public-facing remap/loss. Do not restore a competing old masthead, mount duplicate navigation/Search/OverlayRuntime owners, or let Agent1 redesign it. Agent7 reviews that proposed map when available. This gate applies to selective35 **and** FF47; transport cannot cure or waive it.

### Authorized writer, rollback and post-transfer barrier

**Requested writer: one explicitly named/authorized canonical writer from Owner; none is appointed by this document.** Agent1 supervises the exact handoff, Agent8 signs selected UI; neither current Arena branch permits canonical writing. If no such actor is supplied, the reproducible disposition remains `BLOCKED_CANONICAL_WRITE`, not a side PR or simulated integration.

Only that authorized writer, in their authorized canonical checkout, may execute the write phase after the Agent10→Agent1 Back decision, explicit nav choice and source approval:

1. Read the current Owner decision/lease and actual remote canonical head. Require clean tree and exact `HEAD=BASE=b2ae…`; if moved, **STOP**, regenerate/review an exact-base packet, never3way/force. Verify the generator, manifest and payload pins. The three phased checks above run against their checkout, with ordinary exact `git apply --check`/apply; stage only the35 allowlist paths, the separate guard and the explicitly generated index delta. No Research/held-source expansion or Agent1 historical UI.
2. Review full staged path/mode/blob diff against `transfer.json` and the separate guard/derived receipts. Record before/after pins and rollback anchor. Make one bounded integration commit and ordinary push **only with that writer's explicit canonical authority**, not from Agent1's Arena branch. Re-read actual PR/remote SHA; report the real commit, not the source or gitless export.
3. Before write, rollback is simply **do not promote**. A gitless pre-generation rehearsal can check/reverse the guard patch, then public patch, then verify `base`; with the derived index, account for/reverse its separately recorded delta first. For an already pushed canonical integration, rollback requires the authorized writer and an Owner-approved **revert commit** of the exact integration/deterministic derived delta; never reset/rebase/force-push/main mutation. Source36e and canonicalb2ae remain immutable reference anchors.
4. **Fresh checks on actual transferred canonical SHA are mandatory**: exact-head CI; clean production-like build/Pagefind and full source/artifact pins; HTTP/artifact identity and history/review404; source/publication/HOLD/SEO/feed/sitemap/search/ownership/runtime contracts; responsive light/dark320/360/390/768/1440; cold320/390CLS; strict native Back390/1440 with honest signed disposition; JS/noJS/keyboard/TOC/search/theme/citation/direct+return checks; actual parsed A4/Letter PDFs. Agent8 UI parity/review, Agent11's one independent release GO/NO-GO, Agent9 print and Agent6 SEO must name that same actual candidate, with distinct scopes rather than duplicate baselines. The `/articles/` navigation map is an explicit gate. No inherited green.
5. Agent1's existing support runners can target that commit/artifact using newly generated, validated build receipts and endpoint matrix: `scripts/articles-catalog-coverage.mjs --runtime-sha=SHA40 --artifact-root=DIR --provenance=RECEIPT --origin=ORIGIN --out=NEW_IGNORED_DIR`; `scripts/articles-native-back-acceptance.mjs --matrix=NEW_ENDPOINTS --widths=390,1440 --bfcache=permitted --out=NEW_IGNORED_DIR`. Do not label a gitless composite as an exact source commit to satisfy their guards. Do not fabricate a build receipt.
6. Transferred browser commands retain their existing owners: `journal-editorial-browser.mjs --public-only=true --transfer=KIT/transfer.json --origin=ORIGIN --axe=EXISTING_FILE --output=NEW_DIR` and `articles-editorial-browser.mjs` against the same artifact. Print suites require actual Chromium and the existing Python/PyMuPDF environment (`--suite=print --pdf-python=EXISTING_PYTHON`), not just successful PDF creation. Never pass `--history-origin` for public acceptance. Any unavailable Firefox/WebKit/device/AT/UI-zoom/physical-print check is explicitly NOT RUN. No deploy/live or artistic clearance is implied.

### Small engineering queue (requests, not completed peer work)

- **Agent10 (#2348):** continue only the already [Owner-assigned unique residual/alternative memo](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2348#issuecomment-7018944119); no re-run of accepted70ms/smooth baseline, no writer appointment, no Product/shared fix. Agent1 accepts that one result and makes the technical decision; Agent8 implements approved UI. This handoff does not add a second matrix.
- **Agent8:** return one stable, approved visual SHA and final diff for the three announced families (`JournalMasthead.astro`, `ArticlesLibrarySection.astro`, `articlesEditorial.css`); accept/reject Agent4 polish with actual required before/after. Supply the explicit nav map/Owner choice, take Agent1's post-Agent10 Back recommendation, and review the W2 data/component boundary below. No parallel integration plan or alternative design. A new source triggers only affected checks plus final candidate acceptance, not a repeated old audit.
- **Agent11 (#2347):** [ON_CALL independent verifier](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2347#issuecomment-7018967278). Correct old unconditional FF/GO wording and label toy404 controls; then stop. Activate one read-only source/publication/route/build/HTTP/nav/Back GO/NO-GO only on the first new approved Product/canonical candidate, not another residual investigation. No transfer writer authority.
- **Agent7 (#2341):** review Agent8's concrete navigation remap/SSR discoverability or approved changed behavior when supplied; no causal Back investigation, second router or expanded browser matrix. Owner decides public-facing losses.
- **Agent4 (#2339):** review Agent8's actual new three-family UI delta and performance evidence only when that exact SHA arrives; do not repeat unchanged36e baselines or import SYSTEM font/cache changes.
- **Agent6 (#2345) + Agent9 (#2343):** remain ON_CALL; activate independent SEO/publication and actual-print acceptance only for the new **actual canonical candidate SHA/artifact**, not old reference branches. Reuse Agent11's shared candidate provenance, not duplicate whole suites. No additional agents or revived archived sessions.

## 3. W2 bounded milestone: proposed source/component contract, not Product implementation

**23/23 contract-reference tests PASS**, including isolated **0/1/10/100/1000 in-memory datasets**. This is an ignored, non-shipping acceptance model, not a newsroom, SSR route implementation,1000 published stories, performance proof or agreed component API. Agent8 agreement is **pending**, requested with this handoff. W2 Product implementation waits the W1 decision.

### Source inventory and single-projection proposal

Exact36e has **one published Journal story: G3 dossier; zero NEWS stories**. `/journal/` and `/updates/` are `landing`, not news. Generic manifest `type:article` is not editorial classification or publication permission. The general editorial-date registry currently has no Journal/updates records; do not create a parallel manual ledger to fill that gap.

1. One pure published editorial projection, owned by Agent1, joins existing **search-manifest membership ∩ production ownership ∩ source-owned editorial/publication metadata**. It is a consumer, never a second manually maintained story registry or a new publication authority. G3 uses its existing immutable `g3ProductMetadata.ts` and `g3PublicationHandoff.ts`; no source dates/claims are rewritten.
2. Future `news | dossier | explainer | analysis` is explicit **source-owned semantic kind**, not inferred from `Article`, URL pattern, build time or a visual shell. The current read-only G3 witness combines its existing explicit `kind="dossier"` with the sealed16-claim publication decision; that presentation prop alone is **not** a future publication/type registry. Final normalized-kind adapter placement needs Agent8/route-owner agreement; do not silently extend protected G3 metadata.
3. Publication must be positively established. Any draft/HOLD veto in manifest, route or source wins, including `status`, `publicationStatus`, `publicationGate`. Missing source authority is excluded/diagnosed, not fabricated. Held body/source metadata never becomes a public card.9 history gates stay HOLD; no route/index/discovery.
4. Canonical identity comes from the existing source-owned canonical URL; require same-site clean canonical. Dedup canonical URLs **before** pagination. Identical duplicates collapse; conflicting metadata/roles/dates under one canonical fail closed, not first-wins. This **does not alter** W1's distinct series/fragment links or the separately marked DaVinci curated repeat.
5. Stable sort: explicit editorial publication time DESC, canonical code-point ASC tie-break; never Git/file/build time, locale-random ties or modification-time promotion. Preserve explicit modifiedAt separately; missing/invalid/reversed/future dates have no automatic replacement. Snapshot cutoff is a validation input, not a content date.
6. SSR-first selection/filter/order/page slicing in one engine; page descriptors expose numeric previous/next, total and page items to Astro. No client-only discovery, fake empty public page or new URL from the model. Only separately approved, registered routes can be emitted. Topic/archive is a **view of the same stories**, not another content kind or registry; topics derive from source-approved tags.
7. `/updates/` remains the existing meaningful-corrections ledger (`editorial-updates.ts` + ledger), linked to stories when relevant, never converted into a NEWS stream or duplicate publication event.

### Proposed readonly boundary for Agent8 review

```ts
type EditorialKind = 'news' | 'dossier' | 'explainer' | 'analysis';
interface PublishedEditorialItem {
  readonly canonical: string;
  readonly href: string;                 // existing published destination
  readonly kind: EditorialKind;
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string;          // source-owned, not generated
  readonly modifiedAt: string;
  readonly topics: readonly string[];
  readonly author: string | null;        // distinct roles, never inferred
  readonly editor: string | null;
  readonly translator: string | null;
  readonly media: ApprovedEditorialMedia | null;
}
interface EditorialPage {
  readonly items: readonly PublishedEditorialItem[];
  readonly total: number;
  readonly page: number;
  readonly size: number;
  readonly totalPages: number;
  readonly previousPage: number | null;
  readonly nextPage: number | null;
}
```

`ApprovedEditorialMedia` is intentionally **not invented here**: only an existing approved media/provenance/rights owner may supply it. An image URL, same-origin file or generated illustration does not imply reuse rights; the current reference projection emits `media:null`. Keep G3's existing media owner unchanged. Author/editor/translator stay separate; Agent8's presentation uses the permitted existing attribution semantics (`Автор-редактор:` / `Ред.:`), no author→editor inference.

Agent1 owns source normalization, eligibility, canonical dedup, ordering/pagination, provenance checks and model tests. Agent8 owns every markup/CSS/SVG/card/list/topic/empty-state/responsive/print decision on these props, using the selected shell and current TOC/masthead/theme/Search/source-return owners. No fetch inside presentation components, duplicate sorting registry, second navigation runtime, new dependency, SVG rewrite or alternative site.

| In-memory rows | Logical pages at20/page | Checked in reference model |
|---:|---:|---|
|0|0 (empty first view; no emitted archive route)|empty state/no fake story|
|1|1|single real-shape item|
|10|1|small mixed kinds/topic filter|
|100|5|stable pages/no duplicate or missing canonical|
|1000|50|same eligibility/order/page contract, no public fixture content|

The23 final reference tests additionally reject all nine HOLD-surface and nine raw-draft-surface combinations, non-production/missing membership, generic-article→NEWS inference, landing-as-story, conflicting canonical duplicates, foreign/query/fragment canonicals, untyped/invalid/reversed/future dates and out-of-range pages; preserve independent roles, verify descending publication-time order independently of canonical ties, do not promote modified dates, and do not infer media rights. Synthetic URLs use `fixture-only.invalid` and `__fixture_only__`, remain in memory, and are never written into Product routes, manifests, feeds or assets.

**Next bounded engineering deliverable after W1/contract agreement:** move the agreed pure projection and tests to a declared non-visual Product lane, adapt the one existing G3 publication from its current owners without a manual registry, prove the same0–1000 contract plus real SSR/noJS output, then hand immutable page data to Agent8. Route/data/shared publication changes require their own explicit owner scope; this document does not authorize them.

## Evidence index and limits

All new raw artifacts are ignored under `reports/g3-editorial-wave/agent1-tech-lead-w1-release/` (not GitHub-hosted downloads):

- `preflight.json`, `overlap-readback.json`, `pr-*-start.json`, `decision-point-refresh/`, `before-checkpoint-refresh/`, `new-owner-addendum.json`: authority/head/lease/overlap observations, Agent8's acknowledgement and the newly received specialist orders.
- `current-ancestry-and-scope.json`, `specialists/` exact PR snapshots/source reports/lab code/raw JSON plus `agent11-raw-inventory.json`: local+GitHub23/0/47 and read-only specialist evidence review, not new peer test executions.
- `native-ux-wave{.mjs,.log,-command.json,/report.json}`, `native-ux-summary.json`; `bounded-wave-article-clarification.json`, `native-article-ux-completion{.mjs,.log,-command.json,/report.json}`: original cases, actual URLs/referrers/history/CDP/scroll/focus/first Tab+Enter and actual exits; PNGs are local evidence, not a public-reachability claim.
- `prepare-release-packet{.mjs,.log,-command.json}`, resume/final logs+receipts, `packet-verification.json`, `packet-b2ae-36e/`: unchanged-source packet plus preserved failed attempts, three phases, six negatives and payload/source pins.
- `verify-guarded-build.py`, wrapper log/receipt, `guarded-build.json`, `guarded-*.log`, `guarded-journal-contract/contract.json` and its two real PROD-probe logs, `guarded-catalog-contract/contract.json`.
- `composite-source-pins-{before,after}-derived.json`, `derived-scripture-index.patch`, `composite-artifact-pins.json`, `composite-vs-selected36e-artifacts.json`, `composite-http.json`, `composite-reading-conservation.json` and reading command/log.
- Final `w2-contract-model-v2.test.mjs`, `w2-contract-model-v2{.log,-command.json}`, `w2-contract-milestone-v2.json`: non-shipping model and source facts; component agreement not yet accepted. The first prototype/log/milestone are preserved separately; v2 completes raw draft-veto and independent date-order coverage, not a Product change.

The earlier [Agent1 delivered W1 review](G3_AGENT1_W1_C4_ACCEPTANCE_2026-11-19.md) and [handoff7017250699](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338#issuecomment-7017250699) remain historical completed coldCLS/strict-Back evidence; they are not reposted as this new delivery. No new production, Firefox/WebKit, device, AT, true browser UI-zoom, physical print or artistic clearance claim. No publication/HOLD/Research state changes.
