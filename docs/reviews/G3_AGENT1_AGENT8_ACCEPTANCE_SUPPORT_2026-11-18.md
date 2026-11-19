# Agent 1 — functional acceptance support for selected Agent 8

## Lane / decision

- **Mode / owner:** LANE / Agent 1, `arena/a9995426-gb-is-my-strength`, Draft #2340. Application remains frozen; this is acceptance support, not another design candidate.
- **Latest Owner instruction:** Agent 8 is the selected visual source and integrator. This supersedes the earlier Agent 1 selection and the old visual-transfer recommendation. Canonical coordination: [7003938517](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338#issuecomment-7003938517), [Agent 1 correction 7003939332](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2340#issuecomment-7003939332), [Agent 8 integration scope 7004283098](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338#issuecomment-7004283098).
- **Start / rollback:** own `1979ef2e7e73ba68c937d4f74beb9bea387ef4fc`; main `9edef94ece08012223c1364bec7ddcd561cf5713`.
- **Read-only anchors at start:** selected Agent 8 `dedbcdabae01a43b1b0035d940f8c102e99e91e7`; canonical #2338 `b2ae614730b0c2e164d3b07453797074253d9698`. A selected-source fixture is NOT an integrated canonical acceptance.
- **Allowed files:** new, opt-in Journal reading/citation acceptance helper, its regression tests and this handoff. No existing application, CSS, shared controls, data, route, package, policy or CI gate changes. The old 11-file Agent 1 visual kit is reference/rollback only; do not import it as a design.
- **Overlap / ownership:** Agent 8 alone owns selected presentation/TOC/return adapters and combination. Agent 1 supplies functional tests and read-only findings; #2345 handles SEO, #2343 print, #2344 combined-head independent acceptance / shared Search repro. Do not duplicate those owners or import another navigation/return control.
- **Source of truth:** exact Git objects, selected source paragraphs and native DOM; existing 16-claim/21-source authority; existing route profiles. History stays HOLD, un-routed, with both production guards. Missing authority is not inferred.
- **Checks:** targeted Node regression/negative cases; new production two-route fixture of exact selected source; ordered whitespace-preserving source→DOM comparison; all existing citations, 21 direct source/fallback destinations, single native TOC, keyboard/focus/Tab at 390/1440 and light/dark. Report runner SHA separately from runtime source/build hashes. Re-run against a real integrated exact SHA when one exists; no inherited PASS.

## Test blind spot and one confirmed selected-source spacing defect

Agent 8 already has `JournalSourceReturn`: one per-source return remembers the most recently activated citation. Keep it. Its existing browser tests exercise both finance citations to the same source, no-JS fallback and modifier behavior. No second return control is proposed.

The selected source contract compares factual source paragraphs after **removing all whitespace**, but does not compare their word boundaries with built paragraphs. This can miss `слово</strong>следующее` versus `слово</strong> следующее`. The small reusable helper below is supplementary, not a replacement for Agent 8's broader contract or Research gates. It collapses runs of whitespace to one space *after joining inline text nodes*, checks order and multiplicity, handles explicit Astro space literals, and reports unsupported dynamic paragraphs rather than evaluating JavaScript.

A new, exact-source production two-route fixture **confirmed one mismatch among 43 reading paragraphs** on selected `dedbcdaba…`: `#finance`, fourth paragraph. Source contains `Бьюс —` followed by a newline and `<strong>30 409</strong>`. Built DOM (and real Chromium text) joins it to **`Бьюс —30 409`**, losing the intended space. The earlier whitespace-removing comparison cannot detect this. This is a bounded selected-source finding, not proof that Agent 8 has been integrated into canonical.

### Minimal owner-applied fix

In `src/components/journal/G3Dossier.astro`, make only the existing separator explicit:

```diff
-        Декларации за 2024 и 2025 годы также раскрывают выплаты Карис Бьюс —
+        Декларации за 2024 и 2025 годы также раскрывают выплаты Карис Бьюс —{' '}
         <strong>30 409</strong> и <strong>31 880 долларов</strong> соответственно.
```

The selected file blob is `b947c02772b58742c568d767a383c534f6ddbdd0`. A diagnostic one-line projection gives blob `48409c6aec52790814f6a0bc822e3d18af0b6536`; every other source byte is unchanged. The diff was checked/applied **only in a new Git-isolated cache export**, then independently rebuilt. All **43/43 ordered reading paragraphs**, including the three explicitly projected, pinned finance numbers, match the selected source expectations; unsupported dynamic exclusions = **0**. Real matched paragraph PNGs at 390/1440 and light/dark show the before/after. No numbers, claims, layout, CSS, citation adapter or metadata change is proposed.

This is advice to Agent 8, not a write to their branch. If their combined SHA already repairs the separator, classify the finding FIXED-CURRENT and do not apply it again. Do not blindly apply the patch to a changed file. The old Agent 1 11-file visual patch is expressly **not** part of this handoff.

## Three opt-in acceptance files to reuse

1. `scripts/lib/journal-reading-parity.mjs` — ordered source→DOM word-boundary check and SSR citation/source/native-TOC inventory, using existing parse5. It excludes generated figure UI paragraphs, not source reading text. Unsupported dynamic expressions are reported, never evaluated. The CLI requires zero such exclusions before PASS.
2. `scripts/journal-integrator-acceptance.mjs` — exact public-authority pins; explicit runtime source/build receipt; HTTP HTML and every requested same-origin asset compared with the artifact's bytes; every existing citation, every approved direct source/fallback and every native TOC entry at 390/1440 in both themes, including no-JS fallback. Repeated-source visits use the **existing** Agent 8 return adapter. Direct-source tests force a new document; a same-document hash mutation cannot masquerade as a fresh URL visit.
3. `scripts/journal-integrator-acceptance-test.mjs` — **22 PASS / 0 FAIL / 0 SKIP** before handoff: whitespace-removal negative control, explicit Astro spaces, number grouping, order/multiplicity, missing/extra paragraphs, dynamic exclusions, SSR source/citation ownership, unknown CLI flags and bounded output-path traversal. The initial runner path-loop and same-document-goto harness mistakes are preserved in ignored diagnostic logs, not reported as product defects.

Copy **only these three files** from the support commit if useful. No dependency/package/CI gate is changed and no held-history bibliography module is imported. Keep Agent 8's existing source, browser, metadata, Pagefind, print, HOLD and production-render tests: this is a targeted supplement, not a weaker replacement.

Example after a real build, from a checkout containing the pinned runtime commit:

```sh
node --test scripts/journal-integrator-acceptance-test.mjs
JOURNAL_CHROMIUM_EXECUTABLE=/path/to/actual/chromium \
node scripts/journal-integrator-acceptance.mjs \
  --origin=https://actual-noindex-preview.example \
  --runtime-sha=<EXACT_40_CHARACTER_RUNTIME_COMMIT> \
  --artifact-root=/absolute/matching-build/output \
  --provenance=/absolute/real-build-receipt.json \
  --out=reports/g3-editorial-wave/<NEW_RUN_DIRECTORY>
```

Replace the placeholders: `provenance` must be the real receipt with matching `runtimeSourceSha` and explicit `scope`, not a newly written SHA label on stale output. The report separates `runnerHead`, dirty state, pinned runtime source, receipt hash, HTTP/artifact hashes and problems. A failing source-parity check remains exit 1 even if interaction paths pass; its error is retained while independent keyboard tests continue. No old green status is transferred.

The required full functional witness for this selected presentation is **44 TOC transitions / 44 exact citation returns / 84 fresh direct-source fallbacks / 44 no-JS fallbacks**, plus source/DOM and served-artifact checks. Actual execution status belongs to the fresh `acceptance.json`, not this target count. A two-route fixture is useful component evidence, **not** a whole-repository build/typecheck, SEO/Pagefind/Search/print acceptance or an integrated canonical commit.

## Evidence and remaining integration boundary

[Separate support viewer / matched PNG / patch / raw receipts](https://4323-ibdwza5dfubsidrppk86s.e2b.app/agent1-agent8-support/) (temporary noindex evidence, not deployment). The old sealed visual/print packages remain unchanged. New source snapshots, full failed/projection build logs and checksums stay ignored under `reports/g3-editorial-wave/agent1-agent8-support/` / `.cache/g3-audit/agent8-support/`, not Git artifacts.

Agent 8's design and single native navigation/return owners are retained. Public authority bytes stay baseline-exact: 16 approved claims / 21 sources. History is not activated; nine legacy held candidate labels do **not** imply approval or a fabricated handoffStatus. The two independent production guards remain mandatory. No Research write, canonical/peer branch write, merge or deployment.

**Canonical acceptance remains outstanding until an actual new #2338 SHA exists.** Agent 8 may first publish a combined commit on their Arena-fixed branch; label that an integrator candidate, not canonical. Re-run this narrow witness on the exact combined/canonical artifact when available, then combine with the other assigned reviewers' tests. Firefox/WebKit, real devices/UI zoom, screen reader and physical print have no new witness in this support lane.
