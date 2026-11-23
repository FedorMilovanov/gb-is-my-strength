# Book three-level TOC: accordion / page identity / focus exclusion

Exact Product **58fcd0c06944ce067bc27b97b17a431945290782**, fresh isolated git archive,0 changed tracked source blobs (source-check.json). Node24 Astro→copy-legacy --omit-build-only --no-manifest→cache-bust READ-ONLY build PASS. No marker/focus patch, CSS/JS overrides or candidate merge; no Product-branch edits. PR comments read through250 including executor integration mandate7089647252. HEAD remained58fcd0c0 at pre-post read.

## Executed bounded scenario

Route `/baptisty-rossii/dva-sezda-1884/`, native mobile Reader, Chromium153, touch/mobile emulation, normal-motion preference, SW blocked, fresh context per390×844 /568×320 × light/dark. Test `../book-fold-repro.mjs` uses native opener focus+Enter, then real Tab/Enter/Escape throughout, no forced link focus, simulated click or DOM mutation.4 contexts, **48/48 assertions exit0**.

1. Initial chapter current label `Рождение братства` is separate from exact article `aria-current=page` URL. Current article is the only expanded article initially, region non-inert, aria-expanded true.
2. Tab to first other article's chevron in same chapter and Enter. Its region opens, old article region closes and becomes inert; every article open/class/aria/inert state agrees. Opening another article is only accordion exploration: pathname and single current-page marker remain the actual loaded article.
3. From that sibling chevron, traverse full **23-step Tab cycle**, through newly revealed sections, remaining visible TOC controls and footer, back to the same chevron. Every stop stays inside sheet and outside all `[inert]`/`[hidden]` ancestry; at least one stop inside newly expanded region. Identical23 stops in each viewport/theme. Test observes focusability, NOT full painted visibility.
4. Enter collapses sibling, leaving all article-section regions folded/inert with aria-expanded false. Tab to current chapter header, Enter collapses the whole chapter and applies inert+aria correctly without page navigation. Next Tab skips that chapter's entire nested subtree.
5. Escape closes and returns mobPartTocBtn after these nested folds. Zero page JS errors all4 contexts.

Reproduce BASE_URL/OUTPUT_DIR and optional PLAYWRIGHT_PACKAGE_JSON/CHROMIUM_PATH with sibling probe. folds.json includes all states and exact23-step trails, source-check confirms no Product mutations.

## Bounded closure and limits

**Existing three-level accordion exploration/page identity/focus exclusion PASS** under the above conditions. This is retained behavior to protect when executor integrates marker/focus and satellite fixes, not a new source fix. It tests one current chapter with one sibling article, not all book chapters/articles or long collapse/reopen lifecycles. It does not assert sibling navigation destination because no link was activated here (separate cross-route receipt covers one).

Short landscape here proves keyboard focus stays in correct semantic subtree, NOT that rows/outlines fit within the scrollport. Known34px row/78px group-control clipping remains OPEN. No screenshot/contrast/target-size/zoom claim from this test; no resize-persistence, speech/Play/Analytics, AT/physical/WebKit/Firefox or desktop/W57 acceptance. All exact48 checks can pass while unintegrated live-marker/destination-focus defects remain. No existing bug waived and no full Reader/CI acceptance; W107 and Draft/HOLD unchanged.
