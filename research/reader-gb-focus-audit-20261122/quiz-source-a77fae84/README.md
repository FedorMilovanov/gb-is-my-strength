# Existing Learning source-link modifier defect / unified Analytics migration guard

Exact Product **a77fae8467cc787e2f976533dec3a6fbdea5cc2a**; same exact untouched isolated build as handoff-a77fae84 (fresh archive, Astro→copy-legacy→cache-bust READ-ONLY PASS). Source-check copied from that archive identity receipt; no new build or Product mutation by this probe. Re-read PR discussion through265 including W120 button audit, W121 and owner directive7100535185. HEAD remainsa77fae84. This is a defect in CURRENT Learning, not an assertion it exists in the future unimplemented unified quiz.

## Executed test

`../quiz-source-modifiers.mjs`, Chromium153,390×844 dark/touch, normal motion, SW blocked, fresh context per4 cases. Native route `/articles/dzhon-gill-istoricheskiy-kontekst/`; no preview.py/W57 needed. Real Settings→Learning→Quiz→first confidence button→first displayed answer; no requirement the answer is correct. First-page pool naturally gives current-document source. Actual randomly selected question and original source href recorded in modifiers.json. No href/question/storage mutation, no seeded or replaced quiz bank.

After answering, real Tab reaches revealed#glsQuizSource. Activate with Enter / Control+Enter / Control+click / middle click. Listen for actual browser page event (not mocked window.open), wait for native load/settled scroll; record original sheet/hash/focus and real popup URL. Popup support is independently demonstrated by middle-click positive control.

**Final result15/17 assertions, exit1.** Exactly2 failed assertions: modified activation preservation for Control+Enter and Control+click. All4 natural source/current-document and actual Tab checks PASS;0 original-page JS errors.

| activation | actual original page | browser tab | result |
|---|---|---|---|
|Enter|sheet closed, exact target focus/hash, target visible|none|PASS intended current-page jump|
|Control+Enter|sheet CLOSED, original hash/focus changed|NONE|FAIL native new-tab intent suppressed|
|Control+click|sheet CLOSED, original hash/focus changed|NONE|FAIL native new-tab intent suppressed|
|middle click|sheet stays OPEN, original hash unchanged|actual tab at source href|PASS positive control|

Plain Enter also actually unlocks original article: after settling, a real wheel moves it >100px (raw before/after included), not just CSS inference. Initial3-case exploratory run also reproduced Ctrl+Enter; published final4-case run is the acceptance receipt. Both are the same source, not a before/after Product fix.

## Reproduction / expected / root boundary

1. Open context route390×844. Settings→Learning→Quiz, choose confidence then any answer.
2. Tab to real “Перечитать…” anchor (href points into current document).
3. Control+Enter or Control+click.

Expected Chromium native link semantics: new tab at source URL, original question/dialog/hash unchanged. Actual same-document handoff consumes modified click, closes original dialog and scrolls it. This is functional browser/keyboard behavior, not a screenshot/visual defect; no fake Product pixel claim.

`src/components/article-pilots/gill-series/GillLearningSheet.astro:573–627`: `handoffQuizSource` closes/pushes hash/focuses exact target, while source click listener calls it for every click regardless of event.ctrlKey/metaKey/shiftKey/altKey, event.button or defaultPrevented, then preventDefault. Native auxclick/middle bypasses click listener, hence positive control. Other same-document TOC focus candidate ALREADY has a modifier guard, but no claim that unintegrated patch repairs Learning.

## Owner handoff, no competing quiz implementation

Owner7100535185 requires retiring separate Learning only AFTER transferring article/series modes into Analytics. Do NOT copy this unconditional listener into the unified source-navigation adapter. Keep exact-source validation, same/cross-document branching, modal close/unlock and target focus for unmodified primary activation; preserve browser-owned modified/middle link behavior. Canonical identity/fragment resolution should not turn Ctrl+Enter into a silent destructive change of original view. Exact implementation and full source adapter remain executor-owned.

The existing permanent series-quiz-source-handoff contract covers plain navigation/missing target but not modified activation; add this case to its REPLACEMENT as Learning is retired, not a second quiz controller. No Product patch proposed for the obsolete sheet; no permission inferred to bypass source validation or rewrite question data.

Limits: Chromium external-keyboard/mouse input on mobile-emulated viewport, not physical phone or WebKit/Firefox/macOS Meta coverage. No all82 source-link activation, quiz correctness/CBM audit, note migration, Back policy or new quiz acceptance. Middle-click popup checked at URL, not full AT/destination focus. Plain Enter PASS is one fresh shuffled first-page question, not all routes. W107, Draft/HOLD and integration/source owner unchanged.
