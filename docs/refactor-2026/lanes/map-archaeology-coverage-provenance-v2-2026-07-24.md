# Map archaeology coverage + provenance v2 — 2026-07-24

| Field | Value |
|---|---|
| Mode | `SYSTEM` |
| Lane | `agent/map-archaeology-coverage-provenance-v2` |
| Supersedes | PR #233 after provenance foundation PR #230 |
| Routes | none in this data-only phase |
| Source boundary | `main@b845568e4119ef5c63179893d5c5111094a4ca1d` |

## Purpose

Rebuild the useful 12-category source corpus from PR #233 on top of the canonical catalog ↔ provenance architecture introduced by PR #230.

## Permanent allowed files

- `karty/_data/archaeology-source-registry.json`
- `karty/_data/archaeology-source-provenance.json`
- `scripts/map-archaeology-source-registry-audit.js`
- `.github/workflows/map-archaeology-source-registry.yml`
- this lane record

## Temporary transaction files

- `scripts/_temp-map-archaeology-coverage-materialize.mjs`
- `.github/workflows/_temp-map-archaeology-coverage-materialize.yml`

Both temporary files must be absent from the final exact-head diff.

## Forbidden scope

- `karty/_engine/map-engine.js`
- route JSON and generated pages
- reader/PDF/editorial files
- visual styling or panel runtime
- direct mutation of `main`

## Data model decisions

1. `publicationYear` records when a source was published; it must not contain an artefact's ancient date.
2. Ancient object/site dating is stored separately as `subjectDate` with explicit conventional labels.
3. A place vocabulary entry is either `route-linked` and resolves against a real route collection, or `topic` with an explicit concept and category scope.
4. Runtime categories are governed evidence bundles, not automatically claims that a dedicated route already exists.
5. YEC remains the project worldview and interpretive framework; YEC sources have `evidenceUse=interpretation|none` and cannot replace excavation, object, field-report or peer-reviewed evidence.
6. Retractions remain negative evidence only. The Tall el-Hammam notice retains canonical DOI `10.1038/s41598-025-99265-5` and PMID `40275027`.
7. Every new catalog ID requires exactly one explicit provenance record. Missing or orphan records fail closed.

## Acceptance

- all useful new source IDs from PR #233 are explicitly classified or deliberately rejected with a reason;
- 12 runtime categories have governed source bundles and claims with limitations;
- no ancient date is stored as publication year;
- no topic-only location is falsely presented as a resolved route marker;
- catalog/provenance 1:1 coverage;
- direct retraction identity preserved;
- read-only permanent CI, clean tree, Shared Files and Visual Parity;
- old PR #233 closed only after the replacement PR exists.
