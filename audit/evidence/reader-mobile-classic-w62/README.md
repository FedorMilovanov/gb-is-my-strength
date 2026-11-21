# W62 mobile visual correction — actual screenshots

Eight *new* screenshot comparisons are from the rebuilt, real article Gill II #part-controversy. Chromium mobile emulation at 320 and 390 CSS px; light/dark; TOC, Analytics, Library, expanded Scripture. Every screenshot asserts that the temporary swipe-onboarding hint is absent while the sheet is open.

New fixes: floating-cluster-controller.js removes its temporary 'Свайп по статье' hint as soon as TOC, Analytics, or Library opens (also covers first-open race, avoids blocking verse); narrow-only GillMobileMarginalia.astro presents full 'Слушать часть' label without ellipsis at 320; narrow-only highlights-runtime.css makes five Library tabs readable, including full 'Источники'. No desktop visual changes.

Browser QA: Chrome+WebKit at 320 and 390 light and dark for full listen label, source-tab no wrapping/overflow, no pageerrors (8/8); fresh Chrome+WebKit real open-while-tip-visible TOC and Library for both widths (8/8); actual screenshots in this directory. Full Node 22.23.4 npm run strangler:build exit 0 (112 pages, G1–G8). Physical phones still untested.

PR #2352 remains DRAFT/HOLD; frozen W57 assets checked for no drift.