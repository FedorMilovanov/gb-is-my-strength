# Lane index and current-work policy

This file is the **navigation contract for current work**, not a permanent backlog and not a substitute for GitHub state.

**Forensic baseline examined:** `main@5636a6a1911c7eb0e7637406e87e749dd65dbaaf` (PR #205, 2026-07-24). Always query the current default-branch SHA before starting work.

## Sources of truth

Use these in order:

1. open pull requests and issues in `FedorMilovanov/gb-is-my-strength`;
2. the exact current `main` tree and its CI artifacts;
3. `FedorMilovanov/AuditRepo` for verified backlog, source authority and production-witness boundaries;
4. this file only as a compact navigation aid.

A branch name alone does not prove that work is active, correct, mergeable or still needed.

## Status vocabulary

| Status | Meaning |
|---|---|
| `active` | Work has a current owner, bounded scope and an open issue or PR. |
| `review` | Implementation is complete and waiting for exact-head checks or review. |
| `blocked` | Work is intentionally waiting for a named dependency or owner decision. |
| `merged` | The lane reached `main`; it is historical, not active. |
| `superseded` | A newer PR or implementation replaced this lane. |
| `archived` | Preserved for provenance or possible selective recovery; never merge wholesale. |
| `abandoned` | Explicitly rejected or disposable work with no recovery value. |

## Active lanes

The current active-lane register is the repository's **open pull-request and issue state**. Do not copy a static PR count or branch table into this file: it becomes false as soon as another lane opens, merges or closes.

A remote branch is not active merely because it exists. It enters active ownership only when its current scope, owner and tracking issue/PR are explicit.

## Recent baseline closures

| PR | Merge | Result |
|---|---|---|
| #203 | `0461faa8` | Map failures render a recovery surface instead of a black screen. |
| #204 | `f11749ee` | Removed the surviving temporary Gill writer workflow and added a filesystem-derived control-plane audit. |
| #205 | `5636a6a1` | Converged long-lived workflow linting and removed stale editorial branch triggers. |
| #200 | `c8b47201` | Added all-route Android and WebKit browser coverage. |
| #199 | `0d352415` | Closed route-owned iPhone 320 overflow in Nagornaya Part III. |

These are historical baseline entries, not a claim that no later work exists. Query GitHub and the current tree for the live boundary.

## Forensic archive refs — not active lanes

These refs preserve unique closed-PR heads against eventual PR-ref garbage collection. They are evidence and selective-recovery sources only.

| Archive ref | Original work | Disposition |
|---|---|---|
| `archive/forensic-pr-79-gill-witness-2026-07-24` | Parked Gill editorial phase, including `GillWitness.astro` | Re-evaluate component separately; do not restore the old article rewrite wholesale. |
| `archive/forensic-pr-52-gill-image-polish-2026-07-24` | Gill image/crop/rail experiments | Requires fresh visual verification against current owner preferences. |
| `archive/forensic-pr-66-submenu-showcase-2026-07-24` | Five long-series submenu prototypes | Design provenance only; choose and rebuild from current shared series engine if needed. |

AuditRepo also preserves `archive/forensic-pr-3-vosk-tts-report-2026-07-24`; the Vosk runtime itself remains in source history and current code.

## Opening a lane

Before changing code, record:

```md
Lane: <branch>
Issue/PR: <number>
Routes: <bounded list>
Files allowed: <bounded list>
Files forbidden: <list>
Source of truth: <files / exact SHA>
Required checks: <commands / browser profiles>
Rollback point: <exact main SHA>
```

Rules:

- one route owner at a time unless the owners explicitly coordinate;
- no stale branch is merged wholesale merely because it contains unique files;
- replacement claims must be verified against current blobs, not PR descriptions;
- temporary workflow, trigger or writer files must be removed inside the same transaction;
- after merge, close or update the tracking PR/issue and record the merge SHA in the relevant durable audit surface.

## Historical note

The former table mixed active and merged work from June 2026 and even defined three different states as `merged`. Its full text remains available in Git history at blob `f225fb76e1ed5c495340145b7f025960916b3e91`; it is not current operational guidance.
