# Map archaeology imported-source verification — 2026-07-24

| Field | Value |
|---|---|
| Mode | `RESEARCH` |
| Issue | `#241` |
| Lane | `agent/map-archaeology-imported-verification` |
| Base | `main@cb378b1d086156d46d89769d73050dc6f54e2bd3` |
| Product scope | none |

## Goal

Resolve the remaining archaeology records whose catalog verification state is `imported`. This phase begins with a read-only exact inventory; no source is promoted merely because a URL responds.

## Verification decisions

Each record must receive one of these explicit outcomes:

- `verified`: canonical identity and underlying work metadata were resolved directly;
- `identity-verified-access-limited`: identity is independently resolved, but the public page blocks or intermittently rejects automated access;
- `keep-imported`: identity or underlying work remains insufficiently resolved;
- `replace-canonical-url`: a more stable direct object/publication record is available;
- `remove`: the entry cannot be supported without duplicating or misrepresenting another source.

## Guardrails

- evidence tier, verification state and URL reachability remain separate dimensions;
- a project/department/collection page stays supporting unless the underlying work qualifies independently;
- YEC sources remain interpretation-only and cannot become archaeological evidence;
- retractions remain negative evidence only;
- conventional object/site dates are not changed to fit YEC chronology;
- no MapEngine, route JSON, UI, reader or editorial changes;
- catalog and provenance must remain exactly 1:1.

## Current phase

Temporary read-only inventory files may be used to enumerate the exact queue and produce evidence tables. They must be removed before any final PR merge.
