# ETCBC SyrNT — provenance and rights boundary

Status: **TEXT INGESTION BLOCKED pending explicit text-level rights confirmation**.

This record closes the engineering verification task from issue #1753 for `ETCBC/syrnt`: the upstream repository and provenance are identified, but the currently available public evidence is not strong enough to treat the SEDRA-derived New Testament text itself as cleared for Product ingestion. This file therefore establishes a fail-closed boundary rather than inventing permission.

## Immutable source identity

- Corpus: **Syriac New Testament** (`ETCBC/syrnt`).
- Upstream DOI advertised by the repository: **`10.5281/zenodo.1464787`**.
- Canonical upstream repository: `ETCBC/syrnt` on GitHub.
- Upstream status note: the Text-Fabric SyrNT app was archived at Zenodo on 2018-10-17.
- Corpus provenance: SEDRA database export by George A. Kiraz and James W. Bennett, database version **3.0 (March 1996)**.
- ETCBC explicitly treats SyrNT separately from the Old Testament `ETCBC/peshitta` corpus.

## What public evidence proves

The `ETCBC/syrnt` repository contains an MIT `LICENSE` file, copyright 2019 Dirk Roorda. The repository README describes SyrNT as a research environment whose plain Peshitta text was converted to Text-Fabric and points to the Zenodo DOI above.

The repository's `docs/about.md` separately states that the **source data** is a SEDRA database export and that the SEDRA New Testament data is based on manuscripts from the Ancient Biblical Manuscript Center.

These facts prove repository identity, software/repository licensing metadata, and textual provenance. They do **not**, by themselves, establish that the MIT software licence is an explicit grant covering every right in the underlying SEDRA-derived Scripture text.

## Why the project stays fail-closed

The OT decision in `docs/BIBLE-TEXT-PROVENANCE-PESHITTA-OT.md` cannot be copied across: ETCBC itself treats OT Peshitta and SyrNT as separate corpora with different source trails.

For SyrNT, the current public files do not provide a separate text-data rights statement that clearly says the underlying SEDRA-derived New Testament text may be redistributed/embedded in this Product under the MIT terms. Because issue #1753 requires **text-level rights** rather than merely repository-code licensing, ambiguity must resolve to no ingestion.

## Product contract

Until explicit text-level permission or an authoritative rights statement is obtained:

1. do not ingest or commit the SyrNT corpus text into Product data, indexes, generated artifacts, or public Git history;
2. do not infer SyrNT rights from the OT Peshitta CC-BY-NC decision;
3. do not infer underlying text rights solely from the repository-level MIT licence;
4. code may reference the public repository/DOI as provenance metadata without copying the corpus;
5. any future approval must identify the exact corpus/release, the rights holder or authoritative grant, attribution requirements, redistribution/storage boundary, and commercial/non-commercial scope;
6. after approval, record exact acquired bytes and a cryptographic hash before transformation.

## Closure disposition for issue #1753

Engineering verification of `ETCBC/syrnt` is **complete**: the safe answer is currently **BLOCKED**, not "licensed". The remaining action is an external rights/permission gate, not additional Product implementation work.

This record contains no Bible corpus text and changes no runtime behavior.