# Release live evidence policy

**Status:** current
**Authority:** normative release policy
**Owner:** `release-control-plane`

## Purpose

Source, build candidate, deployment and rendered production are different evidence boundaries. None of them may be inferred from another.

A release claim can require four distinct proofs:

1. **Source identity** — the exact repository commit and current source/control-plane owners.
2. **Candidate identity** — the immutable production-like/release artifact is bound to its release SHA, control-plane SHA, workflow run/attempt and canonical digest/manifest.
3. **Deployed/live bytes** — GitHub Pages serves the expected bytes and critical assets selected by that candidate.
4. **Rendered behavior/geometry** — browser-computed route contracts pass against the exact candidate or deployed surface when the claim depends on runtime rendering.

`merge != candidate != deploy != live/browser proof`.

## Candidate and live byte boundary

A generic release verifier must retain identity and byte-level checks appropriate to the release manifest, including:

- exact repository, release SHA and control-plane SHA;
- exact workflow run ID and attempt;
- exact candidate digest and immutable provenance path;
- local-to-live byte count and SHA-256 for the declared critical HTML/assets;
- approved semantic/route markers where they are part of the release contract;
- rejection of explicitly retired/legacy owners when the current route contract requires it.

Do not infer CSS ownership or rendered geometry by searching serialized HTML for selector text. Astro or another build step may emit valid component CSS into linked assets. Presentation/geometry claims belong to the current source owner plus a browser-computed contract.

## Route-specific rendered contracts

A route-specific visual or geometry invariant has its own semantic/source owner and targeted browser test. It does not become a generic release invariant merely because one historical release incident exposed it.

The release layer proves that the intended candidate/deployment was tested. The route/browser layer proves the rendered property itself.

## Evidence lifecycle

Live verifiers create their report object before preflight and use explicit phases:

- `preflight` — environment, candidate identity or local source validation failed before live probing;
- `live` — deployment existed, but one or more live attempts failed;
- `complete` — all required live checks passed.

Handled failure evidence must remain fatal and record at least:

- `result: "FAIL"`;
- active phase;
- `finishedAt`;
- stack-bearing error evidence;
- attempt evidence accumulated before failure.

Evidence creation must not use `continue-on-error` to turn verifier failure into a successful release claim.

## Workflow execution boundary

After the Pages deployment step succeeds, independent live evidence producers run and upload their own reports even if another verifier fails. Evidence/upload steps may use `always()` only when additionally bounded to successful deployment outcome.

A missing deployment must not manufacture a secondary “missing report” failure. A verifier report that is contractually required for a completed release remains fail-closed: missing required evidence is not success.

## Exact-head merge boundary

Before merge of a release-affecting PR:

- applicable source, browser, visual and deploy-candidate checks are registered for the exact final PR head and terminal green;
- review debt is resolved;
- current `main`/collision state is rechecked;
- the final diff remains inside the declared scope.

If the required check suite never registered for the exact head, that head is unverified. Do not transfer green status from an older SHA.

When the platform loses a trigger, recovery uses a supported rerun of an existing registered run or a legitimate new commit that represents real repository state. Empty/no-op commits, metadata edits or inference from older green runs are not release evidence.

## Post-merge production boundary

When production state is claimed, verify the canonical push-to-main deployment for the merged SHA and inspect every evidence artifact required by the current release contract. Required reports must identify the deployed release/control-plane identity and finish with their success/complete state.

A source merge can close source work. It cannot by itself close a production/live claim.

## Historical incidents

Incident-specific evidence, rollback SHAs, individual workflow runs and one-off geometry failures belong under `docs/history/incidents/`. They may explain why this policy exists, but they do not redefine current release status.
