# Map archaeology coverage + provenance v2 — 2026-07-24

| Field | Value |
|---|---|
| Mode | `SYSTEM` |
| Pull request | `#233` |
| Lane | `agent/map-archaeology-registry-expansion` |
| Canonical foundation | PR `#230` / `83a13a0755b37296ccec053987654ceefbca349e` |
| Archived stale tree | `archive/pr233-stale-archaeology-7765a4c` |
| Routes | none in this data-only phase |

## Purpose

Rebuild the useful 12-category source corpus from the archived first #233 tree on top of the canonical catalog ↔ provenance architecture introduced by PR #230. The old head is preserved, but the active draft PR now contains the provenance-v2 replacement tree.

## Permanent scope

- `karty/_data/archaeology-source-registry.json`
- `karty/_data/archaeology-source-provenance.json`
- `scripts/map-archaeology-source-registry-audit.js`
- `scripts/map-archaeology-category-coverage-audit.js`
- `.github/workflows/map-archaeology-source-registry.yml`
- this lane record

No temporary writer, inventory workflow, materializer script or write permission remains in the final exact-head tree.

## Forbidden scope

- `karty/_engine/map-engine.js`
- route JSON and generated pages
- reader/PDF/editorial files
- visual styling or panel runtime
- direct mutation of `main`

## Data model decisions

1. `publicationYear` records when a source was published; it never stores an artefact's ancient date.
2. Ancient object/site dating is stored separately as `subjectDate` with explicit conventional labels.
3. Avraam `places` remain strict route-linked IDs checked against the route collections.
4. Cross-map archaeological locations are explicit `topic` records until a route-specific contract binds them to concrete markers.
5. Runtime categories are governed evidence bundles, not claims that a dedicated route already exists or that every biblical event has archaeological proof.
6. YEC remains the project worldview and interpretive framework; YEC sources have `evidenceUse=interpretation|none` and cannot replace excavation, object, field-report or peer-reviewed evidence.
7. Retractions remain negative evidence only. The Tall el-Hammam notice retains canonical DOI `10.1038/s41598-025-99265-5` and PMID `40275027`.
8. Every catalog ID requires exactly one explicit provenance record. Missing and orphan records fail closed.
9. `disputed` and `candidate` claims require explicit limitations in the data, not merely a visual badge.

## Materialized corpus

- catalog sources: `94`
- provenance records: `94`
- imported expansion decisions: `40`
- governed claims: `23`
- runtime evidence categories: `12`
- topic vocabulary entries: `23`
- route/runtime scopes: `14` including `avraam`
- YEC sources: `6`
- YEC interpretation records: `5`
- negative/retraction witnesses: `2`

## Transaction evidence

- fixed stale corpus inventory: `40` additions, `12` ancient-date field errors, `52` existing-record regressions;
- writer changed exactly catalog, provenance and the multiscope base audit;
- independent base provenance audit passed;
- independent 12-category coverage audit passed;
- boundary finalizer changed exactly catalog and provenance and pinned both to PR #230 foundation SHA;
- the initial stale head remains recoverable from the archive branch and commit `7765a4cb216509d9462f6c7ac4fa0999909a424b`.

## Acceptance

- [x] every imported ID has explicit provenance;
- [x] 12 categories have governed source bundles and claims with limitations;
- [x] ancient dates are separated from publication years;
- [x] topic-only locations are not presented as route markers;
- [x] catalog/provenance coverage is exactly 1:1;
- [x] Tall el-Hammam retraction identity is preserved;
- [x] all temporary write/inventory machinery is removed;
- [ ] final read-only registry, Shared Files and Visual Parity exact-head checks;
- [ ] merge with exact-head protection.
