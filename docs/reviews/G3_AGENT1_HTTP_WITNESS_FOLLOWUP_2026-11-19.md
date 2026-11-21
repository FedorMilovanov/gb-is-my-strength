# Agent1 → Agent8: navigation-safe HTTP evidence transport (tests only)

## Bounded lane

- **Mode LANE / owner Agent1, functional test support only.** Latest Owner roadmap [7009140446](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338#issuecomment-7009140446) retains Agent8 as sole design/integration owner and Agent1 as registry/content/URL/no-JS support. This fixes our evidence harness, not Product or the integrator's native-keyboard logic.
- Main `9edef94ece08012223c1364bec7ddcd561cf5713`; own rollback `aeb8deb75a5ef31d9722fd0a54d93590edc1be43`; remote selected source at preflight `641fc5c2b256294b5bd1807f375394c24f3a947e`; canonical #2338 still `b2ae614730b0c2e164d3b07453797074253d9698`, OPEN/Draft.
- Agent8 [7010098917](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338#issuecomment-7010098917) announces local W1 `e3875e3ad3a5e9bb1eb2674606261f77bebea041`. At preflight the advertised remote ref is still641fc and GitHub commit lookup returns422/“No commit found”. **No source/build/acceptance claim for inaccessible e387 or a future catalog/native179-key run.** No request or attempt to write its branch.
- Allowed changes: neutral opt-in test transport and its tests, the two opt-in runners, this record and one pointer in the prior catalog handoff. No application/shared runtime, registry, content/byline/date/media, package/CI/workflow, Research, branch/PR takeover, new UI, merge or deployment.
- Required checks: all existing catalog/Journal helper regressions, new transport lifecycle negatives, syntax/diff and fresh exact-committed runner witnesses on the unchanged sealed641fc artifact. Source/build and runner identities remain separate. Final canonical acceptance requires its actual new SHA/artifact.

## Confirmed harness failure, not an application defect

The previous full641fc Journal witness completed44TOC /44citation /84direct-source /44no-JS return paths and43/43source→DOM paragraphs, but **exited1 for812resource-pin failures**. The original report remains `reports/g3-editorial-wave/agent1-catalog-support/journal-641fc5/acceptance.json`; its `FAIL_HARNESS_RESOURCE_PIN` summary and seal are not edited.

The failed runner's Git blob is `a0e0d42481ab348042c6ac9bf3c494b06e07908f` both atda878 and the currentaeb8 rollback. It requests `Page Response.body()` through CDP after navigation/cache reuse and closes contexts/browser before all evidence jobs have settled. Chromium then reports `Network.getResponseBody: No data found … response … navigated away from`. This is **CONFIRMED_CURRENT_HARNESS**, not812 Product defects and not permission to suppress genuine errors.

The earlier catalog transport already solved byte capture before forwarding with a tested FIFO max6/15s fetch cap. Extracting that neutral implementation avoids a second diverging copy in the Journal runner. Existing catalog exports remain compatible aliases; the aeb8 catalog ZIP/patch remains a valid self-contained historical package with its inline implementation.

## One strict transport for the two opt-in runners

`scripts/lib/acceptance-artifact-transport.mjs`:

1. Intercepts same-origin **assets**, obtains real HTTP bytes with bounded `route.fetch` (15s, no redirects/retries), requires200 and exact artifact SHA256, then forwards those bytes unchanged. It never reads a navigation-sensitive CDP page response body.
2. Caps API fan-out at6 FIFO requests. External analytics/network are blocked, service workers remain blocked by the runners. This is reproducible test-driver transport, not a production network/runtime change.
3. Leaves HTML navigation native. The runners' independent document HTTP/artifact checks remain; asset pinning does not synthesize a successful page, destination, source paragraph or focus result.
4. Installs once before navigation; tracks in-flight jobs and drains before context disposal. Drain also waits for jobs queued during completion and has its own60s fail-closed ceiling. Every original status/body/timeout/path error reaches the report with label and request URL; failure of a secondary abort does not hide it.
5. Has no source/report/ref writes, dependency changes, registry or UI behavior.

Journal's `go/settle/position/visibleTarget/keyboardActivate` and the entire TOC/citation/direct-source interaction loops remain **byte-identical** to rollback. No injected focus restoration, artificial scroll repair, skipped route, optional unchecked asset, whitespace removal, changed test count, revised assertion or Product patch creates a false green. The honest direct/no-JS fallback and exact activated-citation return are unchanged.

Catalog membership/text/role/curated parsing is unchanged. The original90catalog and23Journal helper cases still run;11additional lifecycle controls cover shared installation, in-flight/body/disposal order, actual controller concurrency, wrong-body/404/redirect, primary timeout preservation, native documents/external requests, completion races, bounded drain and invalid/duplicate ownership.

## Opt-in commands / dependencies

```sh
node --test scripts/acceptance-artifact-transport-test.mjs \
  scripts/articles-catalog-coverage-test.mjs \
  scripts/journal-integrator-acceptance-test.mjs

JOURNAL_CHROMIUM_EXECUTABLE=/path/to/chromium \
node scripts/journal-integrator-acceptance.mjs \
  --origin=http://127.0.0.1:PORT --runtime-sha=<ACTUAL_SHA40> \
  --artifact-root=/absolute/exact/dist --provenance=/absolute/build-receipt.json \
  --out=reports/g3-editorial-wave/NEW-UNUSED-JOURNAL-REPORT
```

The catalog CLI/options, stricter source/build receipt schema and dynamic coverage contract are unchanged; see [catalog support](G3_AGENT1_ARTICLES_CATALOG_SUPPORT_2026-11-19.md). Both updated runners now require the neutral transport module. Include it when selectively transferring these tests. A portable test-only kit must include their small helper/test dependencies; **never cherry-pick/merge the donor application or old11-file visual kit**. No global package or CI hook is added.

The test driver may use127.0.0.1; preview servers bind0.0.0.0 and browser-facing Product code gains no localhost API calls. No prior evidence is overwritten. New ignored receipts/PNGs live under `reports/g3-editorial-wave/agent1-catalog-followup/`; the existing build remains `.cache/g3-audit/catalog-support/source-641fc5/dist` with the original full build receipt. It is independently resealed/verified before and after the new witness, not rebuilt or relabelled as another source commit.

## Development verification before the exact committed run

All **124 unit/negative cases pass**:90catalog +23existing Journal helper +11new lifecycle controls. A real Chromium transport smoke replaces the document6times (including2fresh `about:blank` transitions), captures78actual asset responses /20unique assets and drains to0pending each time, with0pin problems. A separate disposable real-HTTP fixture returns200 with deliberately wrong CSS bytes; the transport rejects it, records the original mismatch and creates0asset pins. This proves genuine body drift still fails; it does not change Product files or count as catalog/native focus acceptance.

The original641fc full build is independently reverified:3554source objects match their Git blobs/modes and1430output files match the existing full seal. No rebuild, source projection or new runtime identity is fabricated. New final committed-run results must be read from the new raw receipts, not substituted from these development results or old FAILs.

## Acceptance boundary

This lane closes only the independently re-run harness failure if its new exact-committed receipt actually exits0. Old FAIL receipts stay FAIL. Preserve16public claims/21sources and all9historyHOLD; no public history route or Research mutation. Existing publication/HOLD guards remain mandatory; new tests grant no publication permission.

No claim is made for the inaccessible announced W1 source, actual new `/articles/` layout, native179-key sampling, W2newsroom0/1/10/100 projection, W3updates, W4pixel polish, shared Search/font SYSTEM issues, Firefox/WebKit, physical devices/print, AT/UIzoom, production deployment or Owner visual signoff. New exact staging and canonical sources must receive their own source/artifact acceptance, not inherit this641fc witness.
