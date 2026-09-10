# Petersburg Golden Chapter — Deepening Lane Handoff

**Дата создания:** 2026-09-02
**Последняя сверка:** 2026-09-06
**Lane:** `lane/baptisty-petersburg-deepening-20260902`
**Mode:** LANE
**Status:** READY FOR EXACT-HEAD VERIFICATION
**Route under edit:** `/baptisty-rossii/peterburgskaya-liniya/`

## 1. Authority and scope

This lane deepens the existing Petersburg chapter. It does not create new routes, change navigation/canonical/title, add unprovenanced media, change reading-time ownership, or bulk-import Research material.

Primary authority/evidence surfaces used by the lane:

- `audit/BAPTISTY-ROSSII-PETERSBURG-SOURCE-MATRIX-2026-08-20.md`
- `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md`
- `src/components/baptisty-rossii/BaptistyRossiiPeterburgskayaLiniyaBody.astro`
- `baptists_v120_TRUE_GROUPED/groups/02_HISTORY_NARRATIVE.md`
- `baptists_v120_TRUE_GROUPED/groups/03_PERIODICAL_CORPUS.md`
- `baptists_v120_TRUE_GROUPED/groups/08_INSTRUCTIONAL_LETTER...`
- `baptists_v120_TRUE_GROUPED/groups/09_CONGRESS_EC_1911...`

## 2. Retained deepening

The lane keeps the following evidence-backed improvements:

1. **Bedeker/Kargel context**
   - Kargel/Lieven household context;
   - Bedeker prison mission;
   - Kargel as translator;
   - explicit separation between memoir-level detail and stronger primary-document claims.

2. **Heier attribution**
   - full title of *Religious Schism in the Russian Aristocracy 1860–1900: Radstockism and Pashkovism*;
   - the no-simple-conversion/denominational-separation claim remains attributed to the study rather than presented as an unqualified fact.

3. **Pashkov Papers context**
   - catalogue scale and composition are stated;
   - catalogue evidence is not treated as proof of every biographical episode;
   - concrete claims still require concrete documents from the corpus.

4. **House of Gospel foundation scene**
   - September 1910 foundation ceremony remains;
   - participation of Fetler, Prokhanov and Kargel remains;
   - the scene is used as evidence of a shared public moment, not as proof of a common causal origin for the building project.

5. **Source apparatus**
   - expanded source notes remain in the article;
   - source classes and evidentiary limits remain explicit.

## 3. 2026-09-06 reconciliation

The first handoff snapshot contained two statements that became stale during review. They are superseded by the reconciled state below.

### Publication metadata

- `datePublished` authority remains **2026-06-04**.
- The visible Body text already said `4 июня 2026`; its machine-readable `<time datetime>` was corrected from `2026-09-02` to **`2026-06-04`** in commit `9b480b6a280d2e0e6284717e69ce227a14c59ab0`.
- Governed `dateModified` remains **2026-08-20**; the branch-local `2026-09-02` value was reverted in commit `46fd5b9a7c7acd701e11f3935aabd8b9522f661b`.
- Therefore the earlier handoff bullets claiming publication/modification dates were intentionally advanced to `2026-09-02` are no longer authoritative.

### House of Gospel causality

The earlier wording said the ceremony showed that the idea of the public house "родилась из съездового единства". That causal inference exceeded the cited support.

Commit `9b480b6a280d2e0e6284717e69ce227a14c59ab0` now keeps the documented ceremony while stating the narrower conclusion: several Petersburg evangelical lines appeared together on one public scene, but the ceremony itself does **not** prove that the House of Gospel concept originated from congress unity or was a common organizational project of all those lines.

### Base synchronization

- Historical fork point: `0664bdd5fa773a2581fc87e82809ff685a461ff7`.
- The phrase `(main current)` attached to that SHA in the first handoff snapshot is obsolete and must not be used as current-state authority.
- After the semantic repairs, the lane was refreshed conflict-free against `main` `a8eca5bea0407242865bab62d14224f19afcd43c` using GitHub's tested merge tree; synchronization commit: `886024907bf0c93dec5fee0ca6dd5cc95247b264`.

## 4. Merge gates

Required before merge:

```bash
npm run data:consistency
npm run migration:metadata:check
git diff --check
```

In addition:

- Source Authority Contract must be green on the final exact head;
- all other required exact-head checks must be green;
- the final PR diff must be reviewed after the last synchronization;
- no new historical claim may be strengthened beyond its cited evidence while closing CI.

## 5. Handoff rule

This lane is content-scoped. Do not use it to start the next Origins wave or to absorb unrelated repository cleanup. Once exact-head verification and final diff review are green, the lane is ready for owner merge; further research should continue in a separate owner-scoped lane.