# ETCBC Peshitta OT — provenance and rights pin

Status: **approved for non-commercial engineering use, attribution required; no critical apparatus**.

This record closes the repository-side provenance prerequisite for any future ingestion of the Old Testament Peshitta from ETCBC. It does **not** import Scripture text, accept provider terms, grant commercial rights, or authorize the separate Syriac New Testament corpus.

## Immutable source pin

- Corpus: **Old Testament Peshitta** (`ETCBC/peshitta`).
- Pinned release/citation: **Version 0.3 (2018-10-17)**.
- Persistent identifier: **Zenodo DOI `10.5281/zenodo.1464757`**.
- Canonical upstream repository: `ETCBC/peshitta` on GitHub.
- Citation requested by the upstream project: Willem Th. van Peursen, Geert Jan Veldman, Constantijn Sikkel, Hannes Vlaardingerbroek, and Dirk Roorda, *ETCBC/peshitta*, Version 0.3, Zenodo, DOI `10.5281/zenodo.1464757`.

The DOI is the ingestion pin. Do not silently ingest mutable `master`/`main` data in place of this pinned release. A later release requires a new provenance review and an explicit pin update.

## Rights boundary

Upstream documents the **plain text of the Old Testament Peshitta converted to Text-Fabric** under **CC BY-NC** terms. Non-commercial use is permitted with attribution. Commercial use requires separate permission from ETCBC or Brill.

The **critical apparatus is copyrighted by Brill and is not included in the ETCBC repository**. It is outside the permitted ingestion boundary for this project unless separately licensed.

The conversion software has a separate MIT licence; that software licence must not be confused with the text-data rights.

## Textual provenance

ETCBC states that the electronic Old Testament text derives from *The Old Testament in Syriac according to the Peshitta Version* / Vetus Testamentum Syriace prepared by the Peshitta Institute and published by Brill. For books already published in VTS, the edition's main text is used; for remaining books, Codex Ambrosianus is the stated principal source. The repository does not include the printed critical apparatus.

## Product ingestion contract

Any future importer or runtime integration MUST:

1. identify the corpus as **Old Testament only**;
2. pin input to DOI `10.5281/zenodo.1464757` / Version 0.3 unless this record is intentionally revised;
3. retain the citation and CC BY-NC attribution beside the integration and in any user-facing attribution surface required by the implementation;
4. exclude the Brill critical apparatus and any separately protected ancillary data;
5. remain non-commercial unless separate commercial permission is documented;
6. record exact received bytes/hash before transforming data into a product index or database;
7. keep the Peshitta OT rights decision separate from `ETCBC/syrnt` or any other Syriac New Testament dataset.

## Explicit non-authorizations

This record does **not** establish rights for:

- `ETCBC/syrnt` or another Syriac New Testament corpus;
- Brill's critical apparatus;
- commercial distribution or commercial application use;
- any protected translation owned by another publisher;
- bulk import of data from a mutable upstream branch without an immutable release pin.

## Evidence

Repository issue #1753 records the project licensing/provenance decision and the direct ETCBC correspondence already received. Public upstream documentation independently states the Old Testament scope, CC BY-NC plain-text licence, requested Version 0.3 citation/DOI, and exclusion of the copyrighted Brill critical apparatus.

This file is provenance metadata only. It contains no Bible corpus text.