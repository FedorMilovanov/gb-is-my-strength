# Agent1 → Agent8: tests-only `/articles/` coverage contract

## Lane / authority

- **Mode LANE / owner Agent1, functional test support only.** Owner continuation [#2340/7006119813](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2340#issuecomment-7006119813); Agent8 alone owns the selected №8 design and integration ([articles preflight](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338#issuecomment-7008538936)). No second catalog, UI branch, masthead, TOC, runtime or publication authority.
- Main at preflight `9edef94ece08012223c1364bec7ddcd561cf5713`; own rollback `da8780ce439675972a2d9070cee09b4d5c6c9d27`. Source candidate `641fc5c2b256294b5bd1807f375394c24f3a947e`; canonical #2338 still `b2ae614730b0c2e164d3b07453797074253d9698` at preflight. Candidate evidence is **not canonical acceptance**.
- Allowed diff: `scripts/lib/articles-catalog-coverage.mjs`, `scripts/articles-catalog-coverage.mjs`, `scripts/articles-catalog-coverage-test.mjs`, this handoff. No application/shared files, package/hooks/workflows, registries, Research, merge/deploy or foreign ref writes.
- SSOT: `data/search-manifest.json` ∩ `migration/page-ownership.json`, existing owner role policy and literal `ArticlesRefutationsSection.astro`. Existing route/visual guards are not replaced. Agent8's active `/articles/` implementation is adjacent; hand off these opt-in tests, not the old Agent1 visual package.
- Required checks: synthetic positives/negatives, syntax/diff, fresh matching source/build/HTTP/Chromium JS + no-JS witness with real destination statuses. Final integrated acceptance requires the **actual new canonical exact SHA/artifact**; do not relabel this staging build.

## Contract, not another registry

`catalogExpectation` dynamically derives **both articles and series** with exact `production-dist` route ownership; neither manifest-only nor ownership-only entries grant publication. Explicit `PUBLICATION_HOLD` in `status`, `publicationStatus` or `publicationGate` is a veto, not a new positive authority. No counts, route inventory, editorial order or title-based deduplication are frozen. Distinct routes/fragments keep distinct intents even with equal titles (including the two Нагорная series).

`assertCatalogHtml` parses real SSR with parse5 and checks actual native `<a href>`, not marker regex alone: exact membership/multiplicity and type, href/marker agreement, no unmarked external/publication destination hidden from the count, unique native topic targets, complete ordered title/description and article role. Whitespace is **collapsed to one space, never removed**: missing inline separators, repeated/omitted words and punctuation drift fail. Article labels preserve `Автор-редактор:` / `Ред.:` from structured attribution; missing owner editor authority fails closed. Series currently have no byline; if rendered, it must agree with authority.

The existing `#razbor` card is a **curated repeat**, with its own source-owned title/description/attribution. Its unique-publication count is zero. In particular the manifest's `Ред.:` and different marketing title do not overwrite the curated `Автор-редактор:` label/copy. Its expectation is parsed from the pinned Astro source, not copied into a second static registry. Unknown dynamic expressions fail visibly: add a bounded explicit source adapter rather than eval, text exclusion or fallback PASS.

Stable boundary hooks are the existing `data-catalog-source`, `data-catalog-route`, `data-catalog-series`, `data-catalog-role`, `#razbor`. Field extraction uses a sole card h2…h6 and `data-catalog-description` / current `h-article-abstract`, otherwise a sole non-meta paragraph. These are acceptance adapters, **not required legacy styling/classes**. If selected Agent8 markup changes the field structure, adapt this small extractor with positive/negative fixtures; do not reintroduce old header/layout requirements or weaken membership/text checks.

## Runtime witness

The CLI verifies matching catalog HTTP/artifact bytes, every publication destination's real HTTP200/no redirect and artifact bytes, and fragment presence (e.g. Gill series on `/biografii/#…`). It tests JS and **product JavaScript disabled** in separate Chromium contexts, requested light/dark preferences at configurable widths. Actual DOM is rechecked; computed CSS visibility, hidden/inert/disabled/Tab semantics and visible title/description/role are checked for every card. Native `<details>` can be opened by keyboard without JS; hidden/filter-only lists cannot pass. Representative real Tab → Enter → destination → Back smoke supplements, not substitutes for, all-link coverage.

Six disposable no-JS browser fixtures prove rejection of CSS-only display/visibility/opacity/offscreen/clipped hiding. They modify only a test tab, never served files. Same-origin assets are hash-pinned against the artifact; external analytics/network and service workers are blocked for reproducibility. No caller-supplied initialization script enables the catalog.

No line-clamp/typographic quality, full SEO/Pagefind/print/Search, Firefox/WebKit, real-device, screen-reader, physical-print, UI-zoom, deployment or visual Owner signoff is claimed. No-JS color preferences do not fabricate a theme toggle; the actual SSR palette is reported.

## Opt-in use (no package/CI changes)

```sh
node --test scripts/articles-catalog-coverage-test.mjs

# Serve the NEW exact build, not a dev projection or an old receipt.
python3 -m http.server 4339 --bind 0.0.0.0 --directory /absolute/build/dist

CATALOG_CHROMIUM_EXECUTABLE=/path/to/chromium \
node scripts/articles-catalog-coverage.mjs \
  --origin=http://127.0.0.1:4339 \
  --runtime-sha=<EXACT_SHA40_AVAILABLE_IN_GIT> \
  --artifact-root=/absolute/build/dist \
  --provenance=/absolute/new-build-receipt.json \
  --widths=390,1440 \
  --out=reports/g3-editorial-wave/NEW-UNUSED-CATALOG-REPORT
```

`127.0.0.1` here is the test driver's server address, not browser-facing application code. Preview server binds `0.0.0.0`; UI makes no localhost API calls. Existing evidence is never overwritten; out must be a new ignored nonsymlink report directory. Optional widths: 320/390/768/1440. Existing Playwright/parse5 are used; no install or dependency update is needed.

Build receipt (all fields below are required):

```json
{
  "runtimeSourceSha": "<exact SHA40>",
  "scope": "<honest build/candidate/canonical scope>",
  "buildExitCode": 0,
  "artifactRoot": "/absolute/build/dist",
  "catalogHtmlSha256": "<sha256 of dist/articles/index.html>",
  "sourceFiles": {
    "data/search-manifest.json": "<source sha256>",
    "migration/page-ownership.json": "<source sha256>",
    "src/components/articles/ArticlesRefutationsSection.astro": "<source sha256>"
  }
}
```

Hashes must come from the **actual build input**, not reconstructed after the fact from a preferred branch. The CLI compares those three input hashes with the requested Git commit, records runner HEAD/dirty state separately and rejects source/receipt/artifact mismatches. The receipt is caller-provided build provenance, not magic proof of reproduction. For independent full-tree verification, supply optional `sourceRoot` + `sourcePinManifest` (all Git tree names → `{blob,mode,sha256}`) and `artifactPinManifest` (all output names → `{sha256}`). When supplied, all files/modes/tree completeness are independently verified before and after the witness. Missing full seals are explicit, not a full-provenance PASS.

## Exact candidate evidence

The first independent full-641fc build used a Git-isolated `git archive`, fixed `GB_BUILD_INSTANT` from that commit, and unchanged source bytes before/after: **3554 source objects; 1430 output files**. `strangler:build:production-like` and `pagefind:build:dist` both exited0; Astro check0errors. Actual observed catalog: **80 articles +10 series +1 curated repeat**; article roles55editor/24author-editor/1site. These are results, not future assertions.

Development witness `development-641fc5-bounded/acceptance.json`: **4/4 Chromium390 contexts** (both preferences × JS/no-JS),90/90 actual destination200s,6/6 computed-CSS negatives rejected,110 unique served assets pinned,0problems. Full source/output seals reverified unchanged at both ends. **87 catalog unit/negative cases +23 existing Journal helper regressions pass.** These development results explicitly record a dirty runner; the final committed-run JSON/runner HEAD is published separately, not relabelled from development.

Two fresh real PROD imports independently rejected `G3HistoryArticle` and `G3HistoryFeature` with their exact HOLD errors (`production-guards-641fc5.json`); neither produced a public page. All16public claims/21sources and9history approval IDs remain separate authorities. The fresh G3 paragraph test confirms **43/43 exact source→DOM paragraphs**, including repaired `Бьюс — 30 409`, with0unsupported exclusions. The existing finance fix is already in Agent8 `7f9a78242…`; do not apply the old repair twice.

**Preserved harness failures, not product findings:** the first catalog development process timed out waiting on unbounded navigation-sensitive CDP `response.body` jobs and was explicitly stopped (`development-641fc5/INTERRUPTED.json`). New catalog asset evidence fetches bounded actual HTTP bytes before forwarding them unchanged to Chromium;6transport unit cases cover good/bad body/status/timeout/external/document paths. Separately the unchanged older Journal runner completed44TOC/44citation/84direct/44no-JS paths, but its full-build run exited1 due to812CDP resource-pin errors. Its overall status remains **FAIL_HARNESS_RESOURCE_PIN**, not a new overall Journal PASS (`journal-641fc5-summary.json`). Fixing or hiding that failure is not smuggled into this catalog patch.

Ignored raw evidence: `reports/g3-editorial-wave/agent1-catalog-support/`; scratch source/build: `.cache/g3-audit/catalog-support/source-641fc5/`. No old dedb/projection, own UI PASS, alternative design or not-yet-built Agent8 articles phase is inherited. Final acceptance still requires the actual canonical #2338 SHA/build and existing mandatory guards; no publication permission is granted.
