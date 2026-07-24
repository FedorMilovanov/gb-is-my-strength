# Map archaeology imported-source verification — 2026-07-24

| Field | Value |
|---|---|
| Mode | `RESEARCH` |
| Issue | `#241` |
| Pull request | `#244` |
| Lane | `agent/map-archaeology-imported-verification` |
| Base | `main@cb378b1d086156d46d89769d73050dc6f54e2bd3` |
| Product scope | none |

## Goal

Resolve the ten remaining archaeology records whose catalog verification state was `imported`, without treating URL reachability as evidence strength.

## Final decisions

### Verified — 9

- `aig-have-we-found-sodom`: direct article identity, author and publication date resolved; remains YEC interpretation only.
- `creation-chronogenealogies`: canonical web edition and underlying Journal of Creation 17(3), 2003 metadata resolved; remains YEC interpretation only.
- `creation-times-abraham`: canonical web edition and underlying Journal of Creation 2(1), 1986 metadata resolved; remains YEC interpretation only.
- `icr-biblical-age`: direct institutional resource resolved; no unsupported byline or publication date invented.
- `loc-mamre`: stable Library of Congress item `2019705536` / `LC-DIG-matpc-22876`; false single year replaced by the official 1950–1977 range in identifiers.
- `loc-shur-el-raha`: stable Library of Congress item `2019695634` / `LC-DIG-matpc-01946`; raw JPG replaced by the item record and the official c. 1900–1920 range stored in identifiers.
- `wibilex-beersheba`, `wibilex-bethel`, `wibilex-hebron`: direct WiBiLex articles under Deutsche Bibelgesellschaft editorial governance; remain interpretation/reference records.

### Needs review — 1

- `ritmeyer-mamre`: the dated URL redirects without exposing the claimed article, and current independent search did not recover exact publication metadata. It remains a conservative interpretation record, never archaeological evidence.

## Permanent policy

- `verification=imported` is now fail-closed in the base archaeology audit;
- `needs-review` requires an explicit limitation note and cannot carry `high` evidence;
- verification state, evidence tier and access availability remain independent dimensions;
- YEC sources remain interpretation-only and cannot become excavation evidence;
- retractions remain negative evidence only;
- conventional object/site dates are not changed to fit YEC chronology;
- catalog and provenance remain exactly 1:1.

## Guarded transaction

- read-only inventory proved the exact 10-record queue and zero high-evidence imported records;
- writer changed exactly catalog, provenance and the permanent base audit;
- both provenance and 12-category audits passed before the bot commit;
- final state is `9 verified / 1 needs-review / 0 imported`;
- both temporary workflows, the inventory script, two materializers and the `autofix` label were removed.

## Final scope

1. `docs/refactor-2026/lanes/map-archaeology-imported-verification-2026-07-24.md`
2. `karty/_data/archaeology-source-provenance.json`
3. `karty/_data/archaeology-source-registry.json`
4. `scripts/map-archaeology-source-registry-audit.js`

No MapEngine, route JSON, page, reader, editorial, visual runtime or temporary file remains in the diff.
