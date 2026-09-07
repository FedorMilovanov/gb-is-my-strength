# GB is My Strength — refactor forensic snapshot

**Status:** historical forensic/source snapshot / provenance-only
**Recorded source boundary:** `b81780312e82f51d584251581d31745f01903867` (`main`, PR #211, 2026-07-24)
**Former tracking reference:** `FedorMilovanov/AuditRepo#40`
**Current authority:** current Product `main`, current open PR/issues and the current AuditRepo `verified/MASTER_BUG_MATRIX.md`

The filename retains `LIVING` only for link/history compatibility. This document is **not** a living backlog or current architecture inventory anymore. All route counts, active-work lists, branch dispositions, “open work” and accepted-state claims below are observations at the recorded source boundary unless independently reverified.

## Authority model recorded by this snapshot

This document was a source-repository navigation layer. It did not independently declare production deployment.

- **Current source truth:** exact `gb-is-my-strength/main` tree and exact-head CI.
- **Verified backlog and closure counters:** `AuditRepo/projects/gb-is-my-strength/verified/MASTER_BUG_MATRIX.md`.
- **Production truth:** the applicable immutable AuditRepo production witness; never infer it from a source merge alone.
- **Active work:** current open GitHub issues and pull requests, then current lane navigation if applicable.

Those principles remain useful, but the concrete values recorded below are historical. When surfaces disagree, recheck current state rather than copying the newest-looking text.

## Architecture state at the recorded boundary

### Public surface

At the recorded boundary:

- 75 production routes were registry-owned.
- Every public route had production-like Chromium coverage.
- All routes additionally had Android/Chromium and iPhone/desktop WebKit coverage through PR #200.
- Maps and special applications remained explicit capability adapters rather than a fourth reader engine.
- Reader progress/resume was unified through ReaderState R6 (PR #191).

These counts and coverage statements are snapshot facts, not present-day generated facts.

### Control plane

PR #204 introduced a filesystem-derived repository audit that checked:

- npm and workflow references to local files;
- local `uses: ./...` targets;
- `_temp-*` workflows on the default branch;
- required governance documents;
- duplicated inline actionlint installers;
- write-capable workflows and stale one-off branch triggers.

The audit found and removed a real residue: `_temp-gill-source-marathon-orchestrator.yml` had survived its transaction, retained `contents: write` and called a deleted script. PR #205 reduced the report to three bounded warnings. PR #211 then closed all three, exposed canonical local npm commands and converted every settled warning class into a hard failure.

At `main@b8178031`, the accepted model was zero control-plane issues, zero warnings and exactly two same-repository label-gated autofix writers. Re-run the current control-plane audit instead of treating that recorded result as permanent state.

### Recent verified closures at the snapshot

| Area | PR / merge | Recorded result |
|---|---|---|
| Control-plane warning closure | #211 / `b8178031` | Canonical npm interfaces, final stale branch trigger removed, settled drift fails closed. |
| Map recovery | #203 / `0461faa8` | Black-screen failures receive a recoverable error UI. |
| Control-plane integrity | #204 / `f11749ee` | Dead writer workflow removed; local-reference audit made permanent. |
| Workflow convergence | #205 / `5636a6a1` | Stale editorial branch triggers and duplicated actionlint installers reduced. |
| Cross-browser routes | #200 / `c8b47201` | Android 1828/1828 and WebKit 2660/2660 contracts passed on exact head. |
| Nagornaya narrow layout | #197 and #199 | iPhone 320 overflow closed with route-owned responsive geometry. |
| Reader state | #191 / `a4372707` | Progress, resume and completion unified through ReaderState R6. |

## Forensic recovery register recorded at the snapshot

Closed or deleted branches were not assumed safe merely because a later PR said “superseded”. The marathon compared their actual files with then-current `main`.

### Preserved unique heads

| Archive ref | Unique material | Decision recorded at the snapshot |
|---|---|---|
| `archive/forensic-pr-79-gill-witness-2026-07-24` | `GillWitness.astro` and an older Gill editorial rewrite | Component was a recovery candidate. Article rewrite was stale against later fact-checking and was not to be restored wholesale. |
| `archive/forensic-pr-52-gill-image-polish-2026-07-24` | Alternative panorama crops and rail-cover composition | Fresh Playwright/visual owner review was required before selective recovery. Boxed captions had been intentionally superseded by minimal captions. |
| `archive/forensic-pr-66-submenu-showcase-2026-07-24` | 1717-line five-variant submenu showcase | Prototype provenance, not production code. Any chosen pattern had to be rebuilt against the then-current generic series engine. |
| AuditRepo `archive/forensic-pr-3-vosk-tts-report-2026-07-24` | Full historical Vosk integration report | Runtime was not lost; report was preserved as evidence. |

### Proven replacement chains recorded at the snapshot

- Nagornaya neutral-comparison PR #155 was replaced by merged PR #154 / `f1946b52`.
- SEO dist-contract PR #164 was replaced by merged PR #165 / `3baf6a3f`.
- Nagornaya pastoral PR #121: zero-diff publication failure was rebuilt from its verified artifact and merged as PR #138 / `5650c96b`.
- Gill glossary/source coverage drafts #161, #175, #178 and #180 were replaced by the merged #183/#185/#186 chain.
- Old cross-browser PR #194 was superseded by clean PR #200.
- Old Nagornaya broad CSS proposal #201 was superseded by route-owned PR #199.
- Old route/editorial stack PR #63/#65 was represented by the effective-route registry, metadata library and permanent validators at this boundary.

These chains are provenance. Recheck current source before using one as a present-day disposition.

### Disposable classes recorded by the snapshot

These did not merit recovery branches at that time:

- probe and diagnostic PRs explicitly marked `DO NOT MERGE`;
- trigger-only PRs whose validated result was committed directly to the target SSOT and whose writer removed itself;
- temporary observers that made no source claim;
- stale whole-branch overlays whose useful evidence was already preserved in AuditRepo.

## Machine inventory checkpoint

The first PR #212 history-forensic artifact for `main@5636a6a1` inspected 110 remote branches and all 177 pull requests. It found 31 closed-without-merge PRs, **zero inaccessible closed PR heads**, and 34 introduced paths absent from then-current `main`. Missing paths were review candidates, not automatic evidence of lost production code; most were temporary diagnostics, while #52, #66 and #79 remained deliberate manual-review items.

Those numbers are a historical inventory checkpoint only.

## Historical open-work list

At this snapshot the following work was still listed:

1. Refine PR #212 classifications using closing comments and verified replacement chains; the first pass intentionally over-reported candidates.
2. Complete the equivalent branch/closed-PR inventory for AuditRepo.
3. Reconcile AuditRepo issue #40 and the canonical matrix with the final source merge boundaries.
4. Verify that AuditRepo's one-time `reconcile-source-boundary-5636.yml` writer completes and is removed from `main`.
5. Record owner/integrator review items in `AGENTS.md` and `docs/OWNER-INVARIANTS.md` without changing owner-sensitive policy automatically.
6. Publish an immutable final forensic report and recovery register while keeping source authority separate from the last exact deployed/live authority.

This list is **not current backlog**. Do not execute an item merely because it appears here; resolve current GitHub/AuditRepo state first.

The snapshot rule was that no archived head could be merged wholesale. Any justified recovery had to begin from fresh `main`, copy only the semantic delta and pass current source, browser and visual contracts. That safety principle remains consistent with current governance, but current contracts control its exact implementation.

## Historical June session

The previous version of this file documented the 2026-06-22 recovery around visual-parity diagnostics, stale reading times and lane locking. It later became internally contradictory: the same reading-time item appeared both closed and open, and its “active lanes” remained frozen after completion. The full historical text remains immutable in Git at blob `de164cf3e9b3b37235c48d58f75bb0e156d41596`.

## Former update rule

When this file was still maintained as a living index, each session was supposed to record only durable facts:

- exact source SHA;
- PR/merge SHA;
- exact command or CI artifact;
- what was verified;
- what remained unresolved;
- whether production was actually witnessed.

That update model is retired for this path. Current state belongs in current source registries, GitHub and AuditRepo rather than by reviving this snapshot as another mutable status SSOT.
