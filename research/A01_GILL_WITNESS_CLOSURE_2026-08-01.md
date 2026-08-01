# A01 — GillWitness и доказательная поверхность Гилла

**Дата:** 2026-08-01  
**PR:** #652  
**Production claim:** `no`

## Lane record

```md
Mode: SYSTEM
Lane / owner: agent/a01-gill-witness-closure-20260801 / A01 Gill evidence
Purpose and bounded scope: historical PR #79 delta, witness evidence matrix, executable negative fixtures, StoryMap disposition, zero reader-facing delta
Base / rollback SHA: abf1edba190280e554dfda085bef9fb6594c896d
Allowed repositories: FedorMilovanov/gb-is-my-strength; read-only evidence from FedorMilovanov/Research and FedorMilovanov/AuditRepo
Allowed files: research/A01_GILL_WITNESS_CLOSURE_2026-08-01.md; data/gill-witness-registry.json; scripts/gill-witness-registry-contract-test.js; scripts/fixtures/gill-witness-registry/**
Forbidden files: routes, article bodies, CSS/JS runtime, package.json, workflows, migration registries, legacy mirrors
Adjacent active work / overlap: no open product PR at lane start; PR #643 and PR #647 merged; current main identical to abf1edba190280e554dfda085bef9fb6594c896d
Source of truth: current main; data/gill-verified-claims.json; research/GILL_VERIFICATION_2026-07-31.md; Research/Джон Гилл/17 and /57
Required checks: node scripts/gill-witness-registry-contract-test.js; exact changed-file review; GitHub exact-head checks
```

## 1. Preconditions

- PR #647 is merged and owns the current Gill verified-claim registry, six-surface audit and corrected public text.
- PR #643 is merged; its merge commit was current `main` and exact production authority at lane start.
- PR #79 was closed without merge. Its complete delta was three files: `GillWitness.astro`, a broad rewrite of `GillContextSectionSummaryIntro.astro`, and one Toplady insertion in `GillPart2ArticleBody.astro`.
- No open product PR overlapped the declared A01 files at lane start.

## 2. PR #79 → current authority delta

| Historical object | Disposition | Decision |
|---|---|---|
| `GillWitness.astro` | `REFERENCE` | Do not restore its free-form quote props. A lawful future component must accept a stable registry id, render `PROMOTE` only and reuse current `manuscript-quote` / disclosure primitives. |
| `GillContextSectionSummaryIntro.astro` rewrite | `SUPERSEDED` | PR #647 independently corrected and audited the current introduction. Wholesale restoration would overwrite newer authority. |
| Toplady “whole circle of human learning” insertion | `BLOCKED_PROVENANCE` | Research vol. 17 labels it Level C through secondary literature; PR #79 supplied no exact work, edition, page/locator, visual page verification or rights decision. |

## 3. Claim-by-claim evidence

The machine-readable authority is `data/gill-witness-registry.json`.

### A01-WITNESS-TOPLADY-WHOLE-CIRCLE

- original and Russian translation: preserved from PR #79;
- attribution: Augustus Toplady;
- exact work / edition / page: not established;
- Research authority: vol. 17, Level C, quoted through secondary literature;
- context: general estimate of Gill's learning; exact source context unresolved;
- rights: not cleared;
- visual source page: not verified;
- disposition: `BLOCKED_PROVENANCE`;
- public projection: none.

### A01-WITNESS-SPURGEON-SPILLER-1855

- original: “my daily labour is to revive the old doctrines of Gill, Owen, Calvin, Augustine and Christ”;
- translation: A01 editorial translation, labelled in the registry;
- document: C. H. Spurgeon to Charles Spiller, 13 February 1855, 75 Dover Road;
- first known print: *The Baptist Times*, 17 January 1963, according to Iain Murray;
- exact issue page and manuscript location: unresolved;
- context: early London ministry and controversy; evidence of conscious doctrinal inheritance, not identity with Gill's whole system;
- rights: `REFERENCE_ONLY`;
- visual source page: not verified;
- disposition: `REFERENCE`;
- public projection: none.

The existing `data/gill-verified-claims.json` remains the public claim authority and already requires Murray or *Baptist Times* provenance near “Спиллер”. A01 does not duplicate that engine.

## 4. Reusable component decision

A runtime component is **designed but intentionally not materialized**. The fail-closed contract is recorded in the registry and enforced by the contract test:

1. stable registry `id` only; no free-form quotation props;
2. `PROMOTE` records only;
3. Russian translation first;
4. original outside default Pagefind/TTS;
5. attribution, work, edition, locator, context, rights and source-page verification required;
6. current `manuscript-quote` / disclosure primitives reused;
7. no new Gill engine, controller, CSS file or workflow.

The registry contains zero `PROMOTE` records. Adding dormant UI code without a lawful input would create an unowned second surface.

## 5. StoryMap disposition

**Disposition:** `DELETE_DEAD_RUNTIME` / `NO_OP_NO_CURRENT_RUNTIME`.

- PR #79 contained no StoryMap file.
- Current repository search found no Gill StoryMap owner/runtime.
- No witness record is eligible for `PROMOTE`.

A01 therefore creates no StoryMap and deletes no current file. The registry locks the no-op disposition so an unverified historical concept cannot be resurrected silently.

## 6. Executable mutation fixtures

`node scripts/gill-witness-registry-contract-test.js` validates the canonical registry and two negative fixtures:

1. `blocked-record-with-public-projection.json` — non-`PROMOTE` records cannot name reader-facing projections;
2. `promote-record-missing-page.json` — `PROMOTE` fails closed without locator, cleared rights and source-page verification.

Local exact-content result before final push:

```text
GILL WITNESS REGISTRY CONTRACT: PASS (2 records; 2 negative fixtures; {"BLOCKED_PROVENANCE":1,"REFERENCE":1}; 0 public projections)
JSON PARSE: PASS (3 files)
```

## 7. Zero Gill surface audit

A01 changes no Astro route, article body, MDX twin, legacy mirror, search manifest, route profile, CSS, JS, print or TTS runtime. Therefore:

- no PR #79 prose is restored;
- no English quotation is added to Russian reader text;
- no second Gill runtime owner is created;
- the existing six-surface audit is not changed or weakened;
- reader-facing/public-surface delta is exactly zero.

The current-main verification inherited from PR #647 records zero blocking Gill findings and zero strict-legacy warnings. A01 adds a separate evidence-contract layer without claiming that metadata/OCR equals visual verification.

## 8. Closure verdict

| Required result | Result |
|---|---|
| A01 report | this file |
| witness registry/matrix | `data/gill-witness-registry.json` |
| StoryMap disposition | `DELETE_DEAD_RUNTIME` / no-op |
| zero Gill surface audit | zero reader-facing files changed |
| reusable current component | fail-closed contract designed; not materialized while `PROMOTE = 0` |
| mutation fixtures | two permanent negative fixtures + executable contract |
| historical PR #79 | `REFERENCE` / `SUPERSEDED` / `BLOCKED_PROVENANCE`; never wholesale restore |

## 9. Final report fields

```md
Status: authoritative in PR #652 merge/check state
Base SHA: abf1edba190280e554dfda085bef9fb6594c896d
Final PR head: authoritative in PR #652 metadata (this report participates in the head)
Merge commit: authoritative in PR #652 metadata
Main verification SHA: authoritative in post-merge comparison
Changed repositories: FedorMilovanov/gb-is-my-strength
Exact changed files: this report; data/gill-witness-registry.json; scripts/gill-witness-registry-contract-test.js; two JSON mutation fixtures
Closed defects: uncontrolled PR #79 resurrection path; missing A01 witness disposition; ambiguous StoryMap fate; non-executable witness promotion rules
Remaining blockers: Toplady exact work/edition/page; Spurgeon Baptist Times issue page, facsimile and manuscript location
Exact test names and counts: local witness registry contract 1/1 PASS; JSON parse 3/3 PASS; GitHub checks attached to final PR head
Warnings: source-only; no production or visual-page claim
Artifacts and digests: immutable Git commits and PR #652
Review threads: authoritative in PR #652
Branch disposition: guarded squash merge after exact-head green
Production boundary: reader-facing routes unchanged; source merge is not deployment
Next unblocked task: acquire exact source pages before changing any witness record to PROMOTE
```
