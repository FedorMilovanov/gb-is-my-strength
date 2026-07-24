# GB is My Strength — current refactor audit index

**Recorded source boundary:** `b81780312e82f51d584251581d31745f01903867` (`main`, PR #211, 2026-07-24). Query the current default-branch SHA before using this as operational state.  
**Forensic tracking:** `FedorMilovanov/AuditRepo#40`.  
**Purpose:** record current architecture and unresolved recovery decisions without duplicating the canonical AuditRepo matrix.

## Authority model

This document is a source-repository navigation layer. It does not independently declare production deployment.

- **Current source truth:** exact `gb-is-my-strength/main` tree and exact-head CI.
- **Verified backlog and closure counters:** `AuditRepo/projects/gb-is-my-strength/verified/MASTER_BUG_MATRIX.md`.
- **Last exact production truth:** the latest immutable AuditRepo production witness; never infer it from a source merge alone.
- **Active work:** open GitHub issues and pull requests, then `docs/refactor-2026/lanes/README.md`.

When these surfaces disagree, stop and reconcile them rather than copying the newest-looking text.

## Current architecture state

### Public surface

- 75 production routes are registry-owned.
- Every public route has production-like Chromium coverage.
- All routes additionally have Android/Chromium and iPhone/desktop WebKit coverage through PR #200.
- Maps and special applications remain explicit capability adapters rather than a fourth reader engine.
- Reader progress/resume is unified through ReaderState R6 (PR #191).

### Control plane

PR #204 introduced a filesystem-derived repository audit that checks:

- npm and workflow references to local files;
- local `uses: ./...` targets;
- `_temp-*` workflows on the default branch;
- required governance documents;
- duplicated inline actionlint installers;
- write-capable workflows and stale one-off branch triggers.

The audit found and removed a real residue: `_temp-gill-source-marathon-orchestrator.yml` had survived its transaction, retained `contents: write` and called a deleted script. PR #205 reduced the report to three bounded warnings. PR #211 then closed all three, exposed canonical local npm commands and converted every settled warning class into a hard failure.

At `main@b8178031`, the accepted model is zero control-plane issues, zero warnings and exactly two same-repository label-gated autofix writers. Re-run `npm run control-plane:audit` on the current tree instead of treating this recorded result as permanent state.

### Recent verified closures

| Area | PR / merge | Result |
|---|---|---|
| Control-plane warning closure | #211 / `b8178031` | Canonical npm interfaces, final stale branch trigger removed, settled drift fails closed. |
| Map recovery | #203 / `0461faa8` | Black-screen failures receive a recoverable error UI. |
| Control-plane integrity | #204 / `f11749ee` | Dead writer workflow removed; local-reference audit made permanent. |
| Workflow convergence | #205 / `5636a6a1` | Stale editorial branch triggers and duplicated actionlint installers reduced. |
| Cross-browser routes | #200 / `c8b47201` | Android 1828/1828 and WebKit 2660/2660 contracts passed on exact head. |
| Nagornaya narrow layout | #197 and #199 | iPhone 320 overflow closed with route-owned responsive geometry. |
| Reader state | #191 / `a4372707` | Progress, resume and completion unified through ReaderState R6. |

## Forensic recovery register

Closed or deleted branches are not assumed safe merely because a later PR says “superseded”. The current marathon compares their actual files with current `main`.

### Preserved unique heads

| Archive ref | Unique material | Current decision |
|---|---|---|
| `archive/forensic-pr-79-gill-witness-2026-07-24` | `GillWitness.astro` and an older Gill editorial rewrite | Component is a recovery candidate. Article rewrite is stale against later fact-checking and must not be restored wholesale. |
| `archive/forensic-pr-52-gill-image-polish-2026-07-24` | Alternative panorama crops and rail-cover composition | Fresh Playwright/visual owner review required before selective recovery. Boxed captions were intentionally superseded by minimal captions. |
| `archive/forensic-pr-66-submenu-showcase-2026-07-24` | 1717-line five-variant submenu showcase | Prototype provenance, not production code. Rebuild any chosen pattern against the current generic series engine. |
| AuditRepo `archive/forensic-pr-3-vosk-tts-report-2026-07-24` | Full historical Vosk integration report | Runtime is not lost; report is preserved as evidence. |

### Proven safe replacement chains

- Nagornaya neutral-comparison PR #155 was replaced by merged PR #154 / `f1946b52`.
- SEO dist-contract PR #164 was replaced by merged PR #165 / `3baf6a3f`.
- Nagornaya pastoral PR #121: zero-diff publication failure was rebuilt from its verified artifact and merged as PR #138 / `5650c96b`.
- Gill glossary/source coverage drafts #161, #175, #178 and #180 were replaced by the merged #183/#185/#186 chain.
- Old cross-browser PR #194 was superseded by clean PR #200.
- Old Nagornaya broad CSS proposal #201 was superseded by route-owned PR #199.
- Old route/editorial stack PR #63/#65 is represented by the current effective-route registry, metadata library and permanent validators.

### Disposable classes

These do not merit recovery branches:

- probe and diagnostic PRs explicitly marked `DO NOT MERGE`;
- trigger-only PRs whose validated result was committed directly to the target SSOT and whose writer removed itself;
- temporary observers that made no source claim;
- stale whole-branch overlays whose useful evidence is already preserved in AuditRepo.

## Machine inventory checkpoint

The first PR #212 history-forensic artifact for `main@5636a6a1` inspected 110 remote branches and all 177 pull requests. It found 31 closed-without-merge PRs, **zero inaccessible closed PR heads**, and 34 introduced paths absent from current `main`. Missing paths are review candidates, not automatic evidence of lost production code; most were temporary diagnostics, while #52, #66 and #79 remain deliberate manual-review items.

## Open forensic work

1. Refine PR #212 classifications using closing comments and verified replacement chains; the first pass intentionally over-reports candidates.
2. Complete the equivalent branch/closed-PR inventory for AuditRepo.
3. Reconcile AuditRepo issue #40 and the canonical matrix with the final source merge boundaries.
4. Verify that AuditRepo's one-time `reconcile-source-boundary-5636.yml` writer completes and is removed from `main`.
5. Record owner/integrator review items in `AGENTS.md` and `docs/OWNER-INVARIANTS.md` without changing owner-sensitive policy automatically.
6. Publish an immutable final forensic report and recovery register while keeping source authority separate from the last exact deployed/live authority.

No archived head may be merged wholesale. Any recovery begins from fresh `main`, copies only the justified semantic delta and passes the current source, browser and visual contracts.

## Historical June session

The previous version of this file documented the 2026-06-22 recovery around visual-parity diagnostics, stale reading times and lane locking. It later became internally contradictory: the same reading-time item appeared both closed and open, and its “active lanes” remained frozen after completion. The full historical text remains immutable in Git at blob `de164cf3e9b3b37235c48d58f75bb0e156d41596`; this current file no longer presents that snapshot as live status.

## Update rule

For each new session, change the recorded boundary and add only durable facts:

- exact source SHA;
- PR/merge SHA;
- exact command or CI artifact;
- what was verified;
- what remains unresolved;
- whether production was actually witnessed.

Do not copy temporary run diaries, speculative defects or stale branch tables into this document.
