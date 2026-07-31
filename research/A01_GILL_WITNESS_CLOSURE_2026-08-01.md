# A01 — GillWitness и доказательная поверхность Гилла

**Дата:** 2026-08-01  
**Статус:** `SOURCE_CANDIDATE`  
**Задача:** закрыть исторический GillWitness claim-by-claim, не возвращая целиком редакционную ветку PR #79 и не создавая второй Gill runtime.

## Lane record

```md
Mode: SYSTEM
Lane / owner: agent/a01-gill-witness-closure-20260801 / A01 Gill evidence
Purpose and bounded scope: historical PR #79 delta, witness evidence matrix, StoryMap disposition, zero-public-surface decision
Base / rollback SHA: abf1edba190280e554dfda085bef9fb6594c896d
Allowed repositories: FedorMilovanov/gb-is-my-strength; read-only evidence from FedorMilovanov/Research and FedorMilovanov/AuditRepo
Allowed files: research/A01_GILL_WITNESS_CLOSURE_2026-08-01.md; data/gill-witness-registry.json; scripts/fixtures/gill-witness-registry/**
Forbidden files: routes, article bodies, CSS/JS runtime, package.json, workflows, migration registries, legacy mirrors
Adjacent active work / overlap: no open product PR at lane start; PR #643 and PR #647 merged; current main identical to abf1edba190280e554dfda085bef9fb6594c896d
Source of truth: current main; data/gill-verified-claims.json; research/GILL_VERIFICATION_2026-07-31.md; Research/Джон Гилл/17 and /57
Required checks: JSON parse/schema review; exact diff review; existing gill:claims:surface:audit remains authoritative because no reader-facing Gill surface is changed
Production claim: no
```

## 1. Preconditions

- PR #647 is merged and supplies the current Gill verified-claim registry, six-surface audit and corrected public text.
- PR #643 is merged; its merge commit is the current `main` and exact production authority recorded by AuditRepo at lane start.
- PR #79 was closed without merge. Its complete delta was three files: the new `GillWitness.astro`, a broad rewrite of `GillContextSectionSummaryIntro.astro`, and one Toplady insertion in `GillPart2ArticleBody.astro`.
- No open PR overlapped the declared files at lane start.

## 2. Historical PR #79 → current authority delta

| Historical object | Current comparison | Disposition | Reason |
|---|---|---|---|
| `GillWitness.astro` | Ad-hoc props accept quotation, attribution and source fields without a registry-backed evidence gate | `REFERENCE` | The presentation idea is useful, but the component would permit unverified text to be rendered. Do not restore it as a second Gill engine. A future component, if needed, must consume only `PROMOTE` records from the canonical witness registry and reuse current `manuscript-quote` / disclosure primitives. |
| `GillContextSectionSummaryIntro.astro` rewrite | Current introduction was independently corrected and audited in PR #647 | `SUPERSEDED` | Restoring the closed branch would overwrite newer source-verified prose and reintroduce a broad editorial delta outside A01. |
| Toplady “whole circle of human learning” insertion | Research vol. 17 labels the quotation `Level C, цит. по вторичным`; PR #79 supplied no edition, page, context locator or rights decision | `BLOCKED_PROVENANCE` | Keep out of public projection until an exact source edition/page or visual page witness is acquired. |

## 3. Claim-by-claim matrix

The machine-readable matrix is `data/gill-witness-registry.json`.

### A01-WITNESS-TOPLADY-WHOLE-CIRCLE

- **Original:** preserved from PR #79.
- **Translation:** preserved from PR #79.
- **Attribution:** Augustus Toplady.
- **Edition/page:** not established.
- **Research authority:** vol. 17 records the quotation only as Level C, quoted through secondary literature.
- **Context:** general estimate of Gill's learning; no exact work context established.
- **Rights:** not cleared for a source-page reproduction; short quotation status does not replace provenance.
- **Disposition:** `BLOCKED_PROVENANCE`.
- **Public action:** none.

### A01-WITNESS-SPURGEON-SPILLER-1855

- **Original:** “my daily labour is to revive the old doctrines of Gill, Owen, Calvin, Augustine and Christ”.
- **Translation:** registry translation, explicitly editorial.
- **Document:** letter from C. H. Spurgeon to Charles Spiller, 13 February 1855, 75 Dover Road.
- **First known print:** *The Baptist Times*, 17 January 1963, according to Iain Murray.
- **Page/manuscript:** exact issue page and current manuscript location remain unknown.
- **Context:** early London ministry and controversy; evidence of conscious doctrinal inheritance, not identity with Gill's whole system.
- **Rights:** `REFERENCE_ONLY` until the issue/facsimile and publication status are acquired.
- **Disposition:** `REFERENCE`.
- **Public action:** no new A01 projection; the current verified-claim registry already enforces the required Murray/Baptist Times provenance near “Спиллер”.

## 4. Reusable component decision

A new runtime component is **not** added in this lane. The historical implementation would be a second uncontrolled quotation surface. The approved design contract for any later `GillWitness` component is:

1. accept only a stable registry `id`, never free-form quote props;
2. render only records with `disposition: PROMOTE`;
3. put the Russian translation first;
4. keep the original outside default Pagefind/TTS;
5. require attribution, work, edition, page/locator, context and rights fields;
6. reuse current `manuscript-quote` and disclosure primitives; add no new Gill engine, controller, CSS file or workflow;
7. fail closed when the registry record is absent, blocked, reference-only or superseded.

At this closure point the registry has no `PROMOTE` record, so adding a dormant component would create code without a lawful public input. The component is therefore `DESIGNED_NOT_MATERIALIZED`.

## 5. StoryMap disposition

**Disposition:** `DELETE_DEAD_RUNTIME` / no-op.

Evidence:

- PR #79 changed exactly three files and contained no StoryMap implementation.
- Current repository search found no Gill StoryMap owner or runtime to preserve.
- No 1–2 narrative candidate has sufficient registry status for public promotion.

Therefore A01 must not invent a StoryMap. No file deletion is performed because no current runtime file exists; the disposition prevents future resurrection of an unowned historical concept.

## 6. Mutation fixtures

Permanent negative fixtures live under `scripts/fixtures/gill-witness-registry/`:

1. `blocked-record-with-public-projection.json` — a blocked record must never name a public projection.
2. `promote-record-missing-page.json` — a promoted record must fail closed without page/locator evidence.

They document the two regressions A01 is designed to prevent. They are data-only fixtures and introduce no temporary writer, workflow or runtime.

## 7. Zero Gill surface audit

A01 changes no Astro route, article body, MDX twin, legacy mirror, search manifest, route profile, CSS, JS, print or TTS runtime. Consequently:

- no closed PR #79 prose is restored;
- no English quotation is added to Russian reader text;
- no second Gill component/runtime owner is created;
- the existing six-surface audit remains the blocking authority for public claims;
- public-surface delta in A01 is exactly zero.

The latest current-main Gill verification already records `0` blocking findings and `0` strict-legacy warnings after PR #647. A01 does not weaken or bypass that gate.

## 8. Closure verdict

| Required result | Result |
|---|---|
| A01 report | this file |
| witness registry/matrix | `data/gill-witness-registry.json` |
| StoryMap disposition | `DELETE_DEAD_RUNTIME` / no-op |
| zero Gill surface audit | zero public-surface files changed |
| reusable current component | contract designed; intentionally not materialized while no record is `PROMOTE` |
| historical PR #79 | `REFERENCE` / `SUPERSEDED` / `BLOCKED_PROVENANCE`, never wholesale restore |

## 9. Final report fields

```md
Status: SOURCE_CANDIDATE
Base SHA: abf1edba190280e554dfda085bef9fb6594c896d
Final PR head: pending
Merge commit: pending
Main verification SHA: pending
Changed repositories: FedorMilovanov/gb-is-my-strength
Exact changed files: this report; data/gill-witness-registry.json; two JSON mutation fixtures
Closed defects: uncontrolled resurrection path for PR #79; missing canonical A01 disposition; ambiguous StoryMap fate
Remaining blockers: Toplady exact edition/page; Spurgeon Baptist Times issue page and manuscript location
Exact test names and counts: pending exact-head validation
Warnings: no production claim; no visual page verification added
Artifacts and digests: Git commit/PR evidence
Review threads: pending
Branch disposition: pending guarded merge
Production boundary: source-only; public routes unchanged
Next unblocked task: acquire exact source pages before changing any witness record to PROMOTE
```
