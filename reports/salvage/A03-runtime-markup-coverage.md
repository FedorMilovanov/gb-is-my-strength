# A03 — Runtime↔markup coverage

## Baseline

- Source main SHA: `2ecd004be41002afbdcccf87096600b24a43e749`.
- Evidence branch: `agent/runtime-markup-coverage-20260731`.
- Evidence head SHA: `d8b310e9bed3e65678f358cbb67cd6ae8d4754e3`.
- Pull request: `#612`.
- Exact-head workflow run: `30634107952`.
- Artifact: `8794765274` (`sha256:0a804c74d73b37f3498f0e7c2e01840e95c540c2db049a596609d52a82d3e511`).
- Existing execution owner extended: `scripts/route-semantics-browser-test.mjs`.
- Existing machine report extended in place: `reports/route-semantics-browser.json`.

## Mandate and boundary

This closes the read-only A03 evidence requirement: determine, route by route, whether retained reader runtime has matching markup and whether the production-like route executes cleanly.

This patch does **not** restore an archived feature, add a second runtime owner, edit route content, or delete code. Runtime presence is not treated as proof that a feature is in use.

## Method

1. Build the production-like `dist`.
2. Derive every target from the canonical public-surface registry.
3. Scan built JS/CSS assets for the six retained feature tokens.
4. Open every `production-dist` route in an isolated Chromium context at `390×844`.
5. Block service workers for deterministic route ownership and isolate storage/network lifecycle per route.
6. Record loaded scripts/styles, matching DOM markup, local 4xx/request failures, page errors, and repeated registration of the same listener.
7. Fail closed when:
   - a canonical production route is missed;
   - feature markup exists without its runtime;
   - the document does not return 200;
   - navigation/DOM parsing fails;
   - a local runtime request fails;
   - the page throws;
   - the same listener is registered twice.

## Exact-head evidence

- `1029 / 1029` route-semantics assertions passed.
- `82 / 82` canonical production routes were scanned.
- Route-role census: `application`=13, `landing`=11, `page`=2, `reading`=54, `reference`=2.
- Surface census: `article`=2, `page`=8, `series`=59, `special`=13.
- No navigation errors.
- No non-200 production documents.
- No page errors.
- No local 4xx or failed runtime requests.
- No duplicate registration of the same event listener.
- Existing reader-engine sweep and the full Chromium public-surface matrix also passed on the same head.

## Runtime↔markup result

| Подсистема | Доказанное состояние | Markup | Runtime loaded | Runtime | CSS | Решение сейчас |
|---|---:|---:|---:|---|---|---|
| Offline Series | `runtime-unwired` | 0 routes | 14 routes | `js/site.js` | `css/floating-cluster.css, css/mobile-hotfix.css` | `BLOCKED_PROVENANCE` |
| StoryMap | `runtime-unwired` | 0 routes | 14 routes | `js/site.js` | `css/site.css` | `BLOCKED_PROVENANCE` |
| Juxtapose | `runtime-unwired` | 0 routes | 14 routes | `js/site.js` | `css/site.css` | `BLOCKED_PROVENANCE` |
| «Вы читали» | `runtime-unwired` | 0 routes | 14 routes | `js/site.js` | `—` | `BLOCKED_PROVENANCE` |
| Bible verse popover | `runtime-unwired` | 0 routes | 14 routes | `js/site.js` | `css/site.css` | `BLOCKED_PROVENANCE` |
| Original-word card | `runtime-unwired` | 0 routes | 14 routes | `js/site.js` | `css/site.css` | `BLOCKED_PROVENANCE` |

All six tokens are retained in `js/site.js`, which is loaded by 14 canonical routes. The clean production route state emitted no matching public markup for any of the six features.

### What this proves

- The current default public output does not project these six feature markups on any canonical production route.
- Their retained runtime is not sufficient evidence of feature ownership or product use.
- The current routes do not fail because the retained runtime finds no markup.

### What this does not prove

- It does not prove that a localStorage-, history-, dataset-, or service-worker-seeded conditional path can never create markup.
- It does not prove owner approval to delete a feature.
- It does not prove editorial value for restoring a feature.
- It does not replace the A04 Bible ownership audit or the A13 offline/PWA contract.

## Decision per subsystem

- **Offline Series — `BLOCKED_PROVENANCE`.** Coordinate with A13: prove seeded/service-worker behavior and honest partial-cache semantics before REBUILD_FROM_CURRENT_MAIN or DELETE_DEAD_RUNTIME.
- **StoryMap — `BLOCKED_PROVENANCE`.** Inspect authored Gill/editorial stories and owner approval. Rebuild only for 1–2 proven narratives; otherwise DELETE_DEAD_RUNTIME.
- **Juxtapose — `BLOCKED_PROVENANCE`.** Require a genuine before/after pair and content owner. Without one, DELETE_DEAD_RUNTIME.
- **«Вы читали» — `BLOCKED_PROVENANCE`.** Run a seeded localStorage/history scene before deletion; a fresh profile cannot prove the conditional renderer is unreachable.
- **Bible verse popover — `BLOCKED_PROVENANCE`.** Resolve ownership with A04 and the canonical Bible registry; then REBUILD_FROM_CURRENT_MAIN or DELETE_DEAD_RUNTIME.
- **Original-word card — `BLOCKED_PROVENANCE`.** Resolve lemma/morphology/source ownership with A04; then REBUILD_FROM_CURRENT_MAIN or DELETE_DEAD_RUNTIME.

## Audit decision

`ADD_GUARD_ONLY`

Keep the route-wide census in the existing browser owner. It converts future runtime/markup drift into exact-head evidence without creating another engine or helper workflow.

The implementation disposition of each retained subsystem remains blocked until its conditional state and product owner are proven. Any later deletion or rebuild must be a separate small lane from fresh `main`.

## Rollback

Revert the A03 browser-contract commit. No route content, package version, dependency, workflow version, service-worker policy, or visual baseline is changed by this lane.
