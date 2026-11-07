# V27 — Product-owned keyboard navigation for the real Grok Reader

Date: 2026-11-07. Base: published Product release `334064cb29386537c25ac13f9d8b63ad87b00174`, verified on the live site.

## Scope and single ownership
This is a progressive enhancement of `ReaderRail.astro`'s existing **route-gated** `grok-toc`. The only feature flag remains `PUBLIC_GB_GROK_HERMENEUTICS_PILOT`; the public article is the real Hermeneutics route. ReaderState continues to own heading selection, history, scroll position and active markers. `GrokReaderTree.astro` owns the server-rendered nested list, disclosure buttons and route-scoped focus styling.

No replacement of ReaderState, no new URL/hash writes, no localStorage keys, no additional search or theme engine, no global listener, no duplicate ARIA tree, no React, no synthetic titles. The existing six-link site menu, GBSearch, Library V3, PlayEmber, all other article routes and the mobile reading controls are unchanged.

A historical **main-push** CI witness ([run 42325740419](https://github.com/FedorMilovanov/gb-is-my-strength/actions/runs/42325740419)) exposed a genuine WebKit/Linux Night theme contrast failure: fallback purple link `rgb(101,75,128)`, only 2.386:1, after the theme transition. The Grok list never explicitly set unvisited/visited anchor colors. This lane now binds both to the existing `--rail-muted` reader palette, leaving active-link text under the existing `--rail-text` rule. The real WCAG contrast suite is unchanged and must pass on Ubuntu WebKit. The theme report's once-hardcoded SHA is replaced by the exact tested Git checkout and additionally asserted against the CI head; the previous `bodyWidth` report field is accurately called `horizontalOverflowPx`.

## Keyboard contract
With focus inside the desktop Grok TOC, **ArrowDown** and **ArrowUp** move between currently visible headings. **Home** and **End** reach the first and final visible heading. **ArrowRight** opens a collapsed branch and, when already open, enters its first child. **ArrowLeft** collapses an open branch or returns from a leaf to its parent. Buttons retain native **Space/Enter** behavior, anchors retain native **Enter**, and **Tab** retains the native link → disclosure-button sequence.

Only currently visible nested headings participate in arrow navigation. A collapsed descendant has `inert`/`aria-hidden` from the existing disclosure owner, and is not keyboard-addressable. Collapsing a branch while focus is inside returns focus to its controlling disclosure; reopening restores ordinary reachability. Native link semantics and real fragment URLs are preserved. A clear `:focus-visible` outline uses the existing themed rail accent.

This is **not** a WAI-ARIA tree widget, because ordinary document headings, links and independent disclosure buttons must remain separately focusable. It is an enhanced navigation list that supplies optional arrow traversal without replacing Tab semantics.

## CI and stop-ship
`scripts/grok-toc-keyboard-browser-contract.mjs` runs against the production-like built real route, in Chromium/Firefox/WebKit, with desktop 1200×800, wide 1440×900 and short 1440×300 viewports. It asserts real headings, focus and visible focus ring; arrows, Home/End, collapsed branch skipping, inert/focus restoration, native Tab, history and ReaderState invariance, no horizontal overflow and zero first-party pageerrors. The existing `grok-hermeneutics-pilot.yml` workflow runs this **after flag-ON compilation**; its existing flag-OFF rollback build and unrelated Product guards remain required.

A passing prototype screenshot is **not** a release witness. Stop before merge on any Astro error, new browser regression or failed exact-head CI; after merge the immutable Pages release and `/deployments/current.json` SHA must be verified, followed by an isolated **public** browser smoke, before claiming live.
