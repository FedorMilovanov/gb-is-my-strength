# Agent 13 — Mobile, WebKit and accessibility scene contract

**Date:** 2026-08-01  
**Status:** `DONE_BROWSER_EVIDENCE / SYSTEM_OWNER / NO_PRODUCT_MUTATION`  
**Production claim:** `no`

## Scope

Agent 13 closes the browser-evidence gap for narrow mobile widths, the 1200 px responsive boundary, WebKit touch behavior, focus lifecycle, reduced motion and forced colors.

The permanent product diff is intentionally zero. This lane changes only:

1. the existing Runtime Interactive Audit workflow owner;
2. one machine-readable A13 scene matrix;
3. one read-only Playwright witness;
4. this report.

No product CSS, JavaScript, route, generated HTML, NoteRegistry data, route registry or page content is changed.

## Existing evidence reused

- Runtime Interactive Audit run `30705346893`: 43 pages, 10 series and Chromium/WebKit runtime coverage;
- unchanged-head retry artifact `8820338248` after one Hermenevtika timing flake;
- Home browser artifact `8820197480`;
- Visual Parity run `30705346892`, artifact `8820257280`: 390/1280 and progressive-enhancement scenes;
- Overlay Runtime Browser run `30705346909`: Chromium, Firefox and WebKit focus, Escape, restore, landscape and reduced-motion behavior.

## New exact browser evidence

Passing source SHA: `f584730f1dd62d54242712607386f60301530daa`  
Runtime Interactive run: `30708712900`  
Artifact: `8821238560`  
Artifact digest: `sha256:2f5246cf3d930803115a4aec1926d1fd6dd75fe6907ba597ffcc9d37ba578a95`

Result: **76 assertion records, 6 scenes, 0 failures**.

| Scene | Records |
|---|---:|
| responsive root overflow | 48 |
| WebKit touch scroll | 8 |
| reduced motion | 8 |
| 200% layout-equivalent reflow | 6 |
| forced-colors focus | 4 |
| Home mobile modal lifecycle | 2 |

Browser split: WebKit 40, Chromium 36.  
Route split: Home 21, article 19, series 19, map 17.

## Scene boundary

The witness proves:

- 320, 360 and 390 px narrow widths;
- 1199, 1200 and 1201 px responsive boundaries;
- root horizontal overflow at or below 2 px;
- exactly one visible authored route owner for each surface;
- one visible `main` owner for Home, article and series;
- the authored fullscreen `#stage` owner for `/karty/avraam/`;
- 320 CSS px at device scale 2, equivalent to 640 physical pixels;
- reachable keyboard focus under that reflow;
- Home mobile-menu keyboard open, focus entry, inert background, scroll lock, Escape close, focus return and unlock;
- WebKit touch contexts at 320 and 390 px with vertical scroll progress where the document scrolls;
- operability in `prefers-reduced-motion: reduce` in Chromium and WebKit;
- Chromium forced-colors activation and visible focused-control geometry.

The DPR-2 scene is deliberately called **layout-equivalent reflow**. It is not claimed as literal browser chrome zoom automation.

## Findings corrected during witness construction

The first executable run exposed a Node `undici` parser assertion before any browser scene. Server readiness now uses bounded `node:http` probing, and Playwright installation is capped by a 12-minute command timeout plus 35-minute job timeouts.

The next two runs identified witness-model mistakes rather than product defects:

- Home removes `aria-hidden` while its mobile dialog is open instead of setting it to `false`;
- the legacy fullscreen map has neither `<main>` nor `role="application"`; its authored route owner is `#stage`.

The final matrix records those actual contracts. No product workaround or semantic rewrite was introduced.

## Predecessor and successor record

Predecessor PR/head: `#722` / `f584730f1dd62d54242712607386f60301530daa`  
Successor: created from current `main` after the A13 witness passed.

Unique predecessor material:

- exact four-file A13 evidence transaction;
- passing artifact `8821238560`;
- disclosed direct-main placeholder/revert history;
- failed diagnostic artifacts showing the witness corrections.

Transferred: all four final files and the evidence references.  
Rejected: no product mutation; no waiver for unrelated Diotrophes checks.  
Preserved as evidence: PR #722 discussion and Actions artifacts.  
Final predecessor disposition: `SUPERSEDED_VERIFIED` after the successor PR is real.

## Direct-main correction disclosure

A connector invocation mistakenly created a placeholder A13 matrix directly on `main` at `71a231d4afc6b58494d4dfcce7814091ee052b1c`. It was immediately removed by `75c49df99c3203b0d4dd3a4ab001ba7212fdfc0f` before product work continued. The pair is tree-neutral and remains explicitly documented.

## Closure boundary

A13 is complete when the fresh successor PR passes its exact-head checks, has zero unresolved review threads, preserves the four-file diff and merges without touching #680. Source merge does not establish production deployment.
