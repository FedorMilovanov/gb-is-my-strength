# Reader library: post-production hardening (2026-11-06)

Scope is limited to the already-published personal reader library in `gospod-bog.ru`, based on merge `3fe9d4e6390481ebaa5bcea3af3d6f077d6f970b`.

## Evidence and changes
- The live production stress audit covered 24 Chromium, WebKit, and Firefox sessions, including empty, malformed, and 750-entry libraries at 320–1440px. No JavaScript errors, script execution from stored text, or horizontal overflow were observed. All samples were in isolated browser profiles.
- Saved articles can now be removed from the personal library. The change delegates to the canonical `GBFavoriteStore.remove()` and `GBFavoriteStore.add()` APIs, never mutates the favorites key directly, preserves the full metadata on undo, and reports persistence failures instead of falsely claiming success.
- Quote-card PNG export wraps long unbroken strings within the canvas width and clearly marks shortened cards as excerpts. Full text in the library and Markdown export is not changed.
- Regression coverage extends `scripts/reader-library-premium-browser-contract.cjs` with canonical favorite remove/undo, write-failure preservation, and long unbroken Unicode quote-card rendering.

## Non-goals / guardrails
- No change to localStorage schema, cross-device sync behavior, reader navigation layout, footers, or other projects.
- Merge and publish require clean asset revisions, production-like build, browser verification in Chromium and WebKit, full GitHub CI on the exact SHA, protected merge, and live releaseSha/asset comparison.
- This record is not a claim of an unverified test result. See actual run evidence before release.
