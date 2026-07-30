# Home Browser Contract

## Scope

This contract governs the production-like Chromium and WebKit checks for the home-page shell, mobile navigation, command-palette search, Hebrew interaction, progress indicator, direction artwork and no-JavaScript navigation.

## Canonical search behavior

The search bootstrap opens the command palette synchronously and transfers focus to `.cp-input` on the next browser animation frame. The focus transfer is intentionally asynchronous so the overlay may enter its open state before the input becomes `document.activeElement`.

A browser contract must therefore distinguish two separate readiness conditions:

1. the search input is present and visible;
2. the search input has actually become `document.activeElement`.

The contract waits for the second condition before asserting it. Visibility alone is not sufficient evidence that the animation-frame focus handoff has completed, particularly in WebKit.

## Forbidden test workarounds

The following are not acceptable fixes for focus races:

- changing production search runtime solely to satisfy the test;
- adding a fixed sleep after `Ctrl+K`;
- increasing an arbitrary timeout without a condition;
- removing the final focus assertion;
- treating Chromium success as a substitute for WebKit evidence.

The accepted pattern is a condition-based wait for `document.querySelector('.cp-input') === document.activeElement`, followed by the existing explicit assertion.

## Regression reason

On exact Site head `aebfe45d60b8f7df64ac624e0a0a63a80691ce00`, the WebKit contract reproduced twice with the overlay visibly open while the immediate focus assertion ran before the next animation frame. Chromium passed, and the production runtime already scheduled `E.focus()` through `requestAnimationFrame`. The test was corrected to observe the runtime contract instead of racing it.

## Evidence rule

A final successful run must still prove all browser modes required by `scripts/home-browser-contract.mjs`, including WebKit and no-JavaScript navigation. A retry alone is not closure when the same failure reproduces; the condition must be modeled explicitly.

The five direction PNGs must pass both source and browser evidence. A PNG signature or non-zero `naturalWidth` is insufficient: the source contract fully decodes each file and measures non-transparent pixel coverage, while the browser contract awaits `HTMLImageElement.decode()` and verifies rendered alpha coverage through a same-origin canvas. Direction art loads eagerly at low fetch priority because these small second-screen assets must render deterministically without competing with first-view content.
