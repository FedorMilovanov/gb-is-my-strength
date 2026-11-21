# Agent1 — W1 evidence: c4 → 16d → actual next 36e

**Primary subject:** `36e69c4d822f752d4f99914a55a6de798f7164e3` (Agent8).
**Verdict: W1 NOT GREEN.** Cold CLS passes; native no-JS hash/Back remains FAIL.
This is not canonical integration, print acceptance, publication or deployment.

Mode **LANE**; Agent1 owns tests/evidence, Agent8 alone owns Product/design/integration.
Main/rollback: `9edef94ece08012223c1364bec7ddcd561cf5713` /
`206d5335f28d2d74a78b3e5978c5c9f8e3305dd6`. Canonical last read:
`b2ae614730b0c2e164d3b07453797074253d9698`, OPEN/Draft, not modified here.
Tasks: Owner [7016157143](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2340#issuecomment-7016157143),
[7012786466](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2340#issuecomment-7012786466).
Allowed delta: six `articles-{catalog-coverage,native-back}*.mjs` test/helper files and this review;
no Product/shared/data/package/CI/Research writes. Test-code commit:
`95f5fb71c1c3c1e76ed80ce7de845e72033d79df` (clean during every final browser run).
Only the test/docs delta from206 is offered; the original Agent1 visual PR is historical,
**not** a whole-PR merge proposal. Agent8 decides any selective test integration.

## Two causal findings, not two invented Product repairs

| Question | Independent red/green and bounded cause | Disposition |
|---|---|---|
| Cold opening reflow | Actual c4: CLS **0.11076741 at320 / 0.02722184 at390**, in both themes, twice each. The existing SourceSans3 Cyrillic600 and Lora Latin400 start late; recorded shifts include hero links/library. The sole Product c4→16d delta is the two existing font hints. Both fonts are byte-pinned; definitions are not replaced. Actual **16d and36e each have CLS0 in all8 fresh-context samples**, six catalog hints, unchanged four Journal/dossier hints. | Existing Agent8 hint repair independently confirmed; **no Agent1 Product patch applicable**. Lab gate stays finite ≤0.01. |
| Native history return with a fragment | Native Enter creates `/articles/#catalog-materials`; after last-series Enter then native Back, the exact URL returns but an initially correct scroll is followed by a smooth fragment landing. Clean `/articles/` restores exact scroll. The old641 and script-free smooth+hash control also fail; neutral auto+hash passes. Earlier isolated Product-auto control still fails, so a single CSS-auto cure is **not established**. | Mechanism reproduced under this Chromium reload path, not a W1-only regression or universal browser rule. Keep the **≤1px gate FAIL**; no JS Back replacement, threshold waiver or `history.length` guarantee. |

Chromium153.0.8010.0, real HTTP, no native-test interception or reduced-motion override.
The default launch log contains `--disable-back-forward-cache`. A separate run removes only
that flag (`--bfcache=permitted`); it **still reloads every observed document**, including
neutral controls. On36e:20/20 default+permitted cases change `performance.timeOrigin`;
permitted `notRestoredReasons` reports `masked`. **No actual BFCache-hit coverage claimed**,
and no unsupported explanation for the masked reason. These measurements do not establish
that exact restoration is intrinsically impossible in normal Chrome.

### Exact36e native no-JS timing

| URL / width | Scroll before → after | First sample after Back | Final y first observed | Focus after |
|---|---:|---:|---:|---|
| hash390 | **27506 → 969 FAIL** | 43ms:27506 | 1655ms | `SECTION#catalog-materials`, not the prior link |
| hash1440 | **12339 → 712 FAIL** | 33ms:12339 | 1615ms | same fragment section |
| clean390 | 27506 → 27506, observed scroll PASS | 46ms | 46ms | BODY, **not** link focus restoration |
| clean1440 | 12339 → 12339, observed scroll PASS | 52ms | 52ms | BODY, **not** link focus restoration |

Every case is observed for ≥4000ms, with loaded/stable tail samples and exact URL comparison.
Hash history lengths are3→4→4; clean lengths2→3→3. Destination referrer is `/articles/`
without the fragment; that is not evidence that history lost the fragment. Final Enter/Back
is native; preparation focuses the last series. **This is not the full179-key traversal.**
The separate c4 development90-forward-Tab case also failed Back; no full-traversal acceptance inferred.

## Preserved integrity and demonstrated harness defects

- Manifest ∩ production ownership, with explicit HOLD veto, remains the only catalog authority.
  Actual36e:80articles+10series observed dynamically, all90 actual URL/HTTP/artifact/fragment
  checks PASS, one separately compared curated **Код да Винчи** repeat, not a91st publication.
  Distinct Нагорная URLs and `/biografii/#dzhon-gill-series` remain separate destinations.
- Both actualc4 and16d, then actual36e:8 contexts each (390/1440 × browser light/dark preference × JS/noJS),
  complete title/description/role/range visibility, multiplicity and12 native SSR topic/series targets PASS.
  No-JS dark preference honestly retains the light SSR palette, not a pretend theme switch.
- Actual36e source→SSR: **43 ordered paragraphs /0 exclusions;16 approved claims;21 sources;
  9 history candidates HOLD**. Existing source/return inventory is intact. Journal+dossier HTTP bytes
  match artifacts; history has no artifact and returns404. This is **not** a new citation-return browser
  sweep or a rerun of the two historical actual PROD guards.
- Concrete old206 negative blind spots: wrong SSR-topic count, omitted source-owned topic navigation,
  and an extra unpublished no-JS `<noscript>` link were accepted. New tests reject all three.
  The retired `data-theme` recorder returned null; the adapter now checks the actual
  `data-reader-theme`/existing reader API and actual no-JS SSR contract. No UI theme defect was inferred.
- **159/159 unit tests PASS**;9 actual computed-CSS negatives, including clipped/clamped title/role
  ranges, rejected. No text/role/URL/HOLD gate removed. Catalog URL-Back is now explicitly labelled
  **not** a scroll/focus/CLS witness; the timed native driver returns exit1 for the actual failure.

## Runnable commands and actual exits

`E=reports/g3-editorial-wave/agent1-w1-source-followup`. All evidence outputs are ignored, fresh-name-only.
The candidate endpoints/build receipts are diagnostic configuration, never publication/feed data.

```bash
NODE=.cache/g3-tools/node_modules/node/bin/node
E=reports/g3-editorial-wave/agent1-w1-source-followup
export LD_LIBRARY_PATH="$PWD/.cache/g3-tools/libs/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export CATALOG_CHROMIUM_EXECUTABLE=/tmp/chromium ARTICLES_CHROMIUM_EXECUTABLE=/tmp/chromium
STAMP=$(date -u +%Y%m%dT%H%M%S)-$$
"$NODE" --test scripts/articles-catalog-coverage-test.mjs scripts/articles-native-back-test.mjs scripts/acceptance-artifact-transport-test.mjs scripts/journal-integrator-acceptance-test.mjs
"$NODE" "$E/cold-cls.mjs" --matrix="$E/endpoints-36e.json" --out="$E/repeat-cold-$STAMP" --repeats=2
"$NODE" scripts/articles-native-back-acceptance.mjs --matrix="$E/endpoints-36e.json" --out="$E/repeat-back-$STAMP"
"$NODE" scripts/articles-native-back-acceptance.mjs --matrix="$E/endpoints-36e.json" --out="$E/repeat-cache-$STAMP" --bfcache=permitted
"$NODE" scripts/articles-catalog-coverage.mjs --origin=http://127.0.0.1:4342 --runtime-sha=36e69c4d822f752d4f99914a55a6de798f7164e3 --artifact-root="$PWD/.cache/g3-audit/w1-source-followup/source-36e69c4/dist" --provenance="$E/build-36e69c4.json" --out="$E/repeat-catalog-$STAMP"
```

Actual36e commands: build0/**199.709s**, Pagefind0/**3.063s** (wrapper0);
CLS0/**39.515s**; native Back1/**67.889s**; permitted-BFCache Back1/**67.361s**;
catalog0/**59.963s**. Native runs each complete10 cases with0 setup errors, but retain2 target scroll failures.
The native/control outputs must not be relabelled green because the failures are reproducible.
Source/artifact seals verify all**3560/1431** files before/after the catalog run.
The earlier16d build-wrapper exit1 anomaly remains recorded despite child build/Pagefind0 and subsequent full byte verification.

Evidence under E: `final-{cold-cls,native,native-bfcache-permitted,catalog}-36e-95f5fb71c/`,
matching `*-command.json`, `g3-conservation-36e.json`, `representative-pngs.json`,
`adapter-red-green-development.json`; `cold-cls.mjs` is the bounded rerunnable measurement source.
Do not rerun `prepare-*-exact-build.py` over existing exports or rewrite the completed206 delivery/seals.

### Three reviewed actual36e PNGs

- [390 before native Back](https://4323-ibdwza5dfubsidrppk86s.e2b.app/agent1-w1-source-followup/final-native-36e-95f5fb71c/next-36e-390-hash-before.png)
- [390 after native Back](https://4323-ibdwza5dfubsidrppk86s.e2b.app/agent1-w1-source-followup/final-native-36e-95f5fb71c/next-36e-390-hash-after.png)
- [1440 after native Back](https://4323-ibdwza5dfubsidrppk86s.e2b.app/agent1-w1-source-followup/final-native-36e-95f5fb71c/next-36e-1440-hash-after.png)

All three were opened and local report HTTP200/bytes verified. Outbound GET of the preview host
failed in this sandbox; external preview availability is not asserted as an HTTP200 witness.
No Firefox/WebKit, physical device, UI zoom, AT, physical print, artistic, complete W1 or production signoff.
**Recommendation:** preserve the proven hints and the red native gate; send the contextual-anchor/fallback
acceptance decision to Agent8/Owner, without importing speculative auto CSS or adding a competing runtime.
