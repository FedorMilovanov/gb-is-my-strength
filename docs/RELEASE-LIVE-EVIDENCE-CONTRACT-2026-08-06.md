# Release live evidence contract

Date: 2026-08-06  
Owner: `release-control-plane`  
Mode: `SYSTEM`  
Rollback base for the repair lane: `main@d4f9ab6afcc36bf4297b660c361d656df1d0f45d`

## Purpose

This contract separates three different proofs that must not be conflated:

1. the immutable release candidate is internally valid and bound to its release SHA, control-plane SHA, workflow run and canonical tree digest;
2. GitHub Pages serves the exact deployed Home bytes and critical assets selected by that candidate;
3. rendered Home geometry satisfies browser-computed contracts after Astro has extracted and ordered component CSS.

A live HTML verifier must not infer CSS ownership by searching serialized HTML for selector text. Astro may extract component styles into linked assets, so correct CSS can govern the rendered page without appearing as literal selector text inside `dist/index.html`.

## Incident evidence

Pages run `31114789389` successfully downloaded and re-verified one immutable candidate, uploaded those exact bytes to Pages and completed deployment. The generic live verifier then rejected its local `dist/index.html` before network comparison because it required this selector-specific CSS fragment inside HTML:

`h-refutation-card ... box-sizing:border-box`

The actual selector-level source owner is `src/components/home/HomeSections/Refutations.astro`, which explicitly declares `box-sizing: border-box` for `#razbor .h-refutation-card`. Astro legitimately emitted the effective CSS through linked stylesheet assets instead of embedding that selector text in `dist/index.html`. Because the invalid assertion ran before report initialization, the generic JSON evidence was absent; its upload failed, the TTS verifier was skipped, and TTS evidence was also absent.

## Candidate and live byte boundary

The generic verifier must retain all of these checks:

- exact repository, release SHA and control-plane SHA;
- exact workflow run ID and attempt;
- exact candidate digest and immutable provenance path;
- exact local-to-live Home byte count and SHA-256;
- approved Home semantic markers, route markers and divider markers;
- rejection of legacy Home owners;
- exact byte count and SHA-256 for every critical asset declared by the immutable manifest.

Removing the CSS-in-HTML assertion does not weaken any byte or identity proof. CSS presentation and geometry are proved by their own source/browser owners instead of by parsing HTML serialization.

## Refutations source and rendered-geometry boundary

Refutations box-model geometry has two permanent owners with different responsibilities:

1. `src/components/home/HomeSections/Refutations.astro` owns the explicit selector-level `box-sizing: border-box` rule for `.h-refutation-card`;
2. `scripts/visual-parity-home-refutations-box-model-browser-test.js` owns the rendered computed-geometry proof against a production-like `dist`.

The browser gate serves the exact built candidate and checks desktop and mobile Chromium for every `.h-refutation-card` under `#razbor`:

- computed `box-sizing` is `border-box`;
- each card retains its `.h-refutation-shell` owner;
- card and shell width and height agree within one CSS pixel;
- every card is visible and has nonzero geometry;
- the page has no horizontal overflow.

The browser contract also reads the canonical `Refutations.astro` source and fails if its explicit selector-level border-box rule disappears.

The same browser gate runs in both locations:

- Visual Parity pull-request/push workflow;
- immutable release readiness after the exact candidate build and Playwright installation.

Visual Parity already tracks `src/**` for both pull requests and pushes, so changes to the real Refutations source owner cannot bypass this computed-geometry contract. No unrelated TTS workflow or global-CSS trigger is used to claim ownership of this geometry.

## Evidence lifecycle

Both generic and TTS live verifiers create their report object before preflight.

Each report uses one of these phases:

- `preflight` — environment, candidate identity or local source validation failed before live probing;
- `live` — deployment existed, but one or more live attempts failed;
- `complete` — all required live checks passed.

Handled failures must write:

- `result: "FAIL"`;
- the active phase;
- `finishedAt`;
- stack-bearing error evidence;
- all attempt evidence accumulated before failure.

A failure remains fatal. Evidence creation is not `continue-on-error` and does not convert a failed verifier into a successful deployment.

## Workflow execution boundary

After `deploy_pages` succeeds:

1. run the generic live verifier;
2. upload generic evidence even if that verifier failed;
3. run the TTS live verifier independently of the generic result;
4. upload TTS evidence independently of the generic result.

The three follow-up steps use `always()` but are additionally bounded to:

`steps.deploy_pages.outcome == 'success'`

This preserves evidence after verifier failures without manufacturing missing-report errors when no deployment occurred.

Both uploads remain fail-closed with `if-no-files-found: error`.

## Verification and merge boundary

The permanent source and browser contracts are part of the repository, but repository mutation is not itself proof that the final head passed them. Exact-head GitHub Actions evidence remains mandatory.

Pre-merge requirements:

- exact-head source, browser, visual and deploy-candidate workflows are registered and terminal green;
- review threads are resolved;
- the branch is not behind current `main`;
- the final diff remains inside the declared SYSTEM/test/documentation scope.

If GitHub Actions does not register a check suite for the exact head, the PR is blocked rather than implicitly green.

Post-merge requirements:

- the canonical push-to-main Pages workflow deploys the squash merge SHA;
- generic live evidence artifact exists with `result: "PASS"` and `phase: "complete"`;
- TTS live evidence artifact exists with `result: "PASS"` and `phase: "complete"`;
- live current pointer and immutable provenance identify the merged release/control-plane SHA, workflow run and candidate digest.

Issue #474 may be closed only after those post-merge proofs are inspected. Merge alone is not production evidence.
