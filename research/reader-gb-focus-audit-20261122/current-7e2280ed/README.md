# Fresh-head TOC / keyboard revalidation

Exact base: **7e2280ede63828f887fe649071e9df3d5b2907dc**, read232 PR2352 comments including arrow-navigation report/corrected chapter labels and speed-rail corrections. New head changes frontmatter Listen/label fit and corresponding browser/smoke contracts; old receipts on f908e289 are NOT current proof.

Two fresh isolated git archives; unchanged baseline8485 vs compiled candidate8486. Both Node24 Astro→copy-legacy --omit-build-only --no-manifest→cache-bust READ-ONLY builds PASS. Manifest compares every present tracked blob: baseline zero source changes; candidate only the same4 files. Product PR branch untouched. Preexisting working-tree changes untouched.

Candidate construction: exact existing focus-candidate/native-anchor-focus-f908e289.patch THEN marker-candidate/exact-location-25830c64.patch, each apply-check then apply PASS without alteration. Hashes in ../combined-candidate/manifest.json still identify those input patches. This is compatibility validation on new source, not use of stale compiled assets or a claim either patch has been integrated. SW/controller version41284ba0 passes read-only revision guard, but must be regenerated after any owner/shared-JS integration.

| Executed sibling probe | baseline | combined candidate |
|---|---:|---:|
|focus-repro.mjs, GillII,4 viewports|28/52 exit1|52/52 exit0|
|hierarchy-repro.mjs, GillII+book|12/16 exit1|16/16 exit0|
|panel-keyboard-repro.mjs,2 viewports×2 themes|40/40 exit0|40/40 exit0|
|navigation-repro.mjs,2 viewports|not re-run|20/20 exit0|
|repro.mjs broad68 assertions|not re-run|67/68 exit1|

These counts overlap, do not sum. Evidence filenames identify baseline/candidate independently. No JS navigation or CSS overrides injected. Chromium153, touch/mobile emulation, reduced-motion, SW blocked. Four-viewports390×844/568×320/640×360/844×390; two-viewports390×844/568×320. Panel test also light/dark. Fresh context per viewport/theme.

The same bug reproduction remains: open native GillII TOC with keyboard, Tab to local H3sec-canticles or H2sec-quiz, Enter; baseline's native hash reaches destination but focus is not the exact destination. Candidate fixes exact focus and canonical navigate close, without transient opener focus. Marker probe also tests H3sec-canticles, missing authored sec-whitefield and Baptist current page/section semantics. See sibling probe source for exact assertions.

Expanded Analytics retains isolation, trap wraps and Escape/Close/Continue opener restore. Navigation includes native Back/reload hash+visible section (NOT Back-focus policy), true other-page series navigation, Control+Enter real new tab leaving source dialog unchanged, separate no-JS direct authored hash (NOT no-JS TOC opener). These are the same boundaries documented in ../combined-candidate and ../panel-keyboard.

The67/68 red assertion remains focused list-row border visibility at568×320. Additional outline clipping and78px group-control constraints from landscape-experiment also remain OPEN and are not fully covered by68-check probe. No compact CSS trial included, no new geometry acceptance or screenshots claimed. The known visual evidence remains the separately published landscape experiment, not these semantic/navigation receipts.

Fresh protected-surface smoke against THIS candidate uses real unchanged preview.py Handler bound0.0.0.0:8487, query reader-pilot=1&paper=space, mobile390×844 and desktop1440×900 light/dark. All4 have zero JS errors/document x-overflow; mobile stays native, desktop actual body.np-w57-ready. This is a smoke only, not full visual parity.

No all68-route/physical/AT/WebKit/Firefox/safe-area acceptance, no fresh book focus52 rerun, no Analytics.jumpTo/WaveD/navigation-shortcut or speed-rail fix, no resize-persistence lane. Product integration, missing-row policy, shared #2348 asset reconciliation, landscape allocation and complete permanent guards remain executor/owner decisions. Draft/HOLD preserved.
