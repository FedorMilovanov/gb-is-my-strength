# Petersburg Golden Chapter — Deepening Lane Handoff

**Дата:** 2026-09-02
**Lane:** `lane/baptisty-petersburg-deepening-20260902`
**Mode:** LANE
**Base / rollback SHA:** `0664bdd5fa773a2581fc87e82809ff685a461ff7` (main current)
**Route under edit:** `/baptisty-rossii/peterburgskaya-liniya/`

## 1. Pre-flight

- Branch created: `lane/baptisty-petersburg-deepening-20260902`
- Existing source matrix: `audit/BAPTISTY-ROSSII-PETERSBURG-SOURCE-MATRIX-2026-08-20.md`
- Book Authority: `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md`
- Current Body: `src/components/baptisty-rossii/BaptistyRossiiPeterburgskayaLiniyaBody.astro`

## 2. Current state diagnosis

Article updated 2026-08-20. All P0 HOLDs resolved:
- ✅ Prokhanov birth year: 1869–1935 with attribution
- ✅ Two organisations separated: Russian Evangelical Union 1908 ≠ EC Union 1909–1911
- ✅ 1885 teleology removed: "не доказывает", "не двигались по прямой линии"
- ✅ Fetler not inserted into 1885 scene
- ✅ "Direct predecessor of 1944" phrasing removed
- ✅ "Social alternative in drinking country" attributed carefully

## 3. Scope of this lane

### Allowed
- Deepening existing sections with more evidence
- Adding concrete periodical details
- Strengthening source apparatus
- Adding PBG-18 Pashkov Papers context

### Forbidden
- Creating new routes
- Changing navigation/canonical/title
- Adding media without rights/provenance bridge
- Changing reading time
- Bulk import from Research

## 4. Deepening candidates

From source matrix section 6.2:

### Priority 1: Print expansion (1906–1910)
- Add concrete issue numbers and dates from Research 03
- Strengthen "Христианин" vs "Баптист" distinction
- Add "Утренняя звезда" as separate voice

### Priority 2: Pashkov Papers context
- PBG-18: Add catalogue facts: 3017 items, 1877–1909
- Explain what "archival corpus" means vs opened files

### Priority 3: Radstock/Lieven section
- PBG-03 to PBG-05: Strengthen attribution language
- Add explicit "page locator pending" where needed

## 5. Evidence anchors

Research files referenced:
- `baptists_v120_TRUE_GROUPED/groups/02_HISTORY_NARRATIVE.md`
- `baptists_v120_TRUE_GROUPED/groups/03_PERIODICAL_CORPUS.md`
- `baptists_v120_TRUE_GROUPED/groups/08_INSTRUCTIONAL_LETTER...`
- `baptists_v120_TRUE_GROUPED/groups/09_CONGRESS_EC_1911...`

## 6. Required checks

```bash
npm run data:consistency
npm run migration:metadata:check
git diff --check
```

## 7. Rollback

Rollback point: `0664bdd5fa773a2581fc87e82809ff685a461ff7`
