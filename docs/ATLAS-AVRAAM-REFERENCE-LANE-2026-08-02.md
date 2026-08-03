# AVRAAM REFERENCE MAP — lane charter and first verified gaps

**Opened:** 2026-08-02  
**Mode:** SYSTEM for governance/evidence design; later implementation must split into SYSTEM and route-local LANE PRs  
**Current documentation branch:** `agent/atlas-avraam-reference-contract-20260802`  
**Base / rollback SHA:** `75e2232d907d8078ab6ddd041f51a864fffa944a`  
**Owner:** Фёдор Милованов  
**Reference route:** `/karty/avraam/`

---

## 1. Bounded scope of this documentation lane

Allowed:

- owner-approved Atlas reference-map appendix;
- visual/geometry/interaction marathon protocol;
- current-state findings about missing proof;
- implementation lane split and required checks.

Forbidden:

- changes to `karty/avraam/route.json`;
- changes to `MapEngine`, `sheet-engine`, global CSS/JS or package scripts;
- changes to any other map;
- baseline updates;
- production claims;
- AuditRepo canonical ledger mutation.

Open adjacent work inspected at lane start:

- PR #680 — broad NoteRegistry SYSTEM work; no declared Karty redesign, but shared-surface breadth requires separation;
- PR #755 — one Vosk JS file;
- PR #757 — sitemap contract script.

This documentation lane does not touch their stated files.

---

## 2. Current product truth

### 2.1 Avraam is production-owned

`migration/page-ownership.json` assigns `/karty/avraam/` to Astro with `production-dist`. The route profile is `strict-native-app`.

### 2.2 Current native page uses shared MapEngine

`src/components/karty/avraam/AvraamMap.astro` describes a full-screen native map, loads shared `map-engine.js`, fetches `route.json`, initializes `MapEngine.createMap()` and preserves a complete no-JS text fallback.

Therefore the current product should not be treated operationally as an untouchable legacy-only map.

### 2.3 Avraam remains the published map in the Karty hub

The Karty hub inventory audit currently expects exactly one published slug: `avraam`. This raises the quality bar: the published reference route must have stronger evidence than hidden/audit maps.

---

## 3. First confirmed evidence gaps

These are proof/process gaps. They do not yet authorize visual or data mutations.

### GAP A — default map browser smoke skips Avraam

`scripts/map-browser-smoke.js` currently declares:

```js
const DEFAULT_MAP_ENGINE_MAPS = ['ishod'];
const LEGACY_BESPOKE_MAPS = ['avraam'];
```

Without an explicit environment override, the script prints that Avraam is skipped outside the shared MapEngine contract. This contradicts the current native component description and leaves the published reference route outside default browser evidence.

**Disposition:** `CONFIRMED-CURRENT` evidence gap.  
**Repair lane:** dedicated Avraam evidence lane, not shared redesign.  
**Required result:** Avraam has its own exact-head browser suite; generic smoke classification is reconciled only after the dedicated suite proves current behavior.

### GAP B — `avraam:audit` is primarily static and legacy-coupled

`scripts/avraam-map-audit.js` performs useful checks:

- route validation;
- counts and IDs;
- coordinate parity against legacy inline constants;
- status vocabulary;
- source URL/string guards;
- no-JS/runtime failure contracts;
- MapEngine listener lifecycle markers.

But it also reads `karty/avraam/index.html` and `avraam-app.js`, and it does not systematically prove:

- river/coast geometry;
- labels inside safe bounds;
- label collisions;
- marker/control overlap;
- semantic zoom visibility;
- full place/story/layer click inventory;
- mobile/touch;
- print;
- owner golden screenshots.

**Disposition:** `PARTIAL/NARROWED`: valuable static audit, insufficient visual proof.  
**Rule:** do not delete its useful contracts in the first repair. Separate legacy preservation checks from current-product geometry/browser evidence.

### GAP C — `karty:visual-parity:audit` does not inspect the Avraam map canvas

`scripts/karty-visual-parity-audit.js` validates the Karty hub's Astro structure, inventory counts and forbidden legacy-wrapper markers. It does not render `/karty/avraam/` or inspect its SVG.

**Disposition:** `CONFIRMED-CURRENT` naming/coverage gap.  
**Rule:** do not inflate this hub audit into a giant map suite. Keep hub inventory validation separate and add a purpose-built Avraam reference suite.

### GAP D — route profile visual parity is unproven

`data/route-profiles/karty-avraam.json` currently contains:

```json
"visualParity": {
  "desktop": 0,
  "mobile": 0
}
```

The published route is therefore not backed by a current owner-approved parity score in this registry.

**Disposition:** `CONFIRMED-CURRENT` readiness signal, not permission to set the values manually.  
**Rule:** only a canonical generator/owner decision may update readiness; no hand-edited green numbers.

### GAP E — existing static checks can pass while the map is visually crooked

Current contracts can detect many structural failures, but a river outside land, text beyond a frame, overlapping labels or poor screen composition can remain green. This is the exact class of defects named by the owner and must be closed through geometry + screenshots + interaction, not prose assertions.

**Disposition:** `CONFIRMED-CURRENT` coverage gap.

---

## 4. Known architecture tension to resolve carefully

The repository currently has at least two relevant render surfaces:

- production native MapEngine route;
- light showcase `sheet-engine` artifact lineage.

The Atlas Contract already says the light sheet renderer is shared and route data should not contain code. The reference-map program must decide, with evidence, whether:

1. the light sheet becomes the visual map projection used by the thin reader; or
2. both projections remain, but consume one effective data model and have explicit separate roles.

It must **not** create a third engine or keep two contradictory factual projections.

No architecture decision is implemented in this documentation lane.

---

## 5. Implementation lane split

### Lane A — Avraam baseline and instrumentation

**Mode:** LANE, with SYSTEM review only if a shared test utility changes.  
**Purpose:** capture current truth without changing rendering.

Allowed initial surfaces:

- a new dedicated Avraam browser/geometry test;
- a new evidence manifest schema/fixture under existing test conventions;
- current Avraam route/page read-only during first pass;
- CI artifact wiring only in a separate SYSTEM commit/PR if needed.

Must produce:

- exact-head environment manifest;
- macro screenshots;
- required micro crops;
- geometry JSON;
- full click inventory results;
- console/network errors;
- defect ledger with object IDs and reproduction states.

### Lane B — canonical Avraam data and research

**Mode:** route-local LANE.  
**Purpose:** verify and repair factual/source/data issues only.

Research checklist by place:

- biblical passages and textual claim;
- accepted geographic identification;
- competing localization(s);
- excavation report or institutional source;
- period/stratigraphy;
- radiocarbon record with sample context and calibration metadata where used;
- conservative interpretation;
- nonconservative/critical interpretation;
- what is observed vs inferred;
- image rights.

No visual engine work belongs in this lane.

### Lane C — shared geometry/semantic zoom primitives

**Mode:** SYSTEM.  
**Purpose:** implement only root causes proved by Lane A.

Potential primitives, each requiring adversarial fixtures:

- deterministic label collision/leader placement;
- safe viewport and edge-aware contextual UI;
- screen-pixel label/target sizing;
- semantic zoom buckets;
- explicit route graph/segments;
- uncertainty-area/alternative localization features;
- effective projection shared by reader/sheet/no-JS/print.

No slug-specific conditionals and no other-map migration.

### Lane D — Avraam visual reference implementation

**Mode:** route-local LANE consuming proven shared primitives.  
**Purpose:** compose and polish Avraam without engine hacks.

Work order:

1. base geography and route truth;
2. overview composition;
3. regional composition;
4. labels and glyphs;
5. contextual UI;
6. sources/archaeology;
7. mobile/touch;
8. accessibility/no-JS;
9. print;
10. owner golden candidates.

### Lane E — Atlas Shell

**Mode:** SYSTEM, after Avraam map experience stabilizes.  
**Purpose:** one immersive map switcher/search/settings shell.

The shell must use capabilities/readiness and preserve a clean full-screen resting state.

### Lane F — control map

After owner approval of Avraam, choose exactly one next map to prove that shared primitives are reusable without regressions. «Исход» is a strong candidate because its uncertainty and route geometry expose different failure modes.

---

## 6. First evidence run: mandatory states

### Macro

- overview at 1920×1080, 1440×900, 1366×768;
- mobile overview at 390×844 and 360×800;
- Atlas Shell closed/open if present;
- one selected place with panel/drawer.

### Micro

- Ur/southern Mesopotamia;
- Harran/northern turn;
- Canaan core;
- Egypt edge;
- Hebron/Mamre cluster;
- Sodom alternatives;
- war route north;
- Beersheba/southern edge;
- Moria endpoint;
- all permanent map furniture.

### Interaction

- every current story;
- every place generated from current route inventory;
- every layer;
- scientific/alternative tab for each place that has variants;
- close/Escape/focus restoration;
- reset and deterministic overview;
- keyboard shortcuts inside and outside form fields;
- touch pan/zoom/tap;
- no-JS and runtime failure.

---

## 7. Defect record format

Each finding must include:

```json
{
  "id": "AVR-VIS-...",
  "sourceSha": "...",
  "route": "/karty/avraam/",
  "state": {
    "viewport": "1440x900",
    "browserZoom": "100%",
    "mapZoomBucket": "overview",
    "story": "main",
    "selected": null,
    "layers": []
  },
  "objects": ["..."],
  "type": "geometry|content|interaction|accessibility|print|source",
  "evidence": ["screenshot", "bbox-json", "console"],
  "expected": "...",
  "actual": "...",
  "rootCause": "unknown|bounded description",
  "status": "CONFIRMED-CURRENT|PARTIAL/NARROWED|FIXED-CURRENT|HOLD"
}
```

A screenshot without state, object IDs and source SHA is illustration, not durable evidence.

---

## 8. Required checks by lane

### Documentation lane

- exact diff contains docs only;
- no runtime/package/workflow files;
- internal links and terminology agree;
- Shared Files Guard/exact-head CI when available.

### Baseline evidence lane

- build/serve using production-like route ownership;
- dedicated Avraam browser suite;
- geometry collector;
- screenshot manifest hash validation;
- no rendering mutation.

### Route/data lane

- `npm run maps:validate`;
- `npm run avraam:audit` after separating current/legacy responsibilities where needed;
- source/rights contracts;
- dedicated Avraam browser suite on final head.

### Shared engine lane

- targeted unit/adversarial fixtures;
- all engine contracts;
- Avraam exact-head suite;
- one non-Avraam fixture proving no global regression;
- applicable publication barrier.

### Final reference candidate

- full protocol in `ATLAS-VISUAL-QA-MARATHON-PROTOCOL-2026-08-02.md`;
- owner golden package;
- final exact-head CI;
- separate same-SHA production witness after merge/deploy.

---

## 9. Current stop conditions

Stop and do not mutate rendering when:

- another active PR owns the same shared file;
- current main/exact head cannot be established;
- production-like build is red for an inherited blocker that invalidates evidence;
- source authority for a factual change is missing;
- a design choice requires owner taste approval between materially different options;
- the proposed fix requires a per-slug hack;
- baseline command would overwrite evidence automatically.

Otherwise continue the bounded marathon until its confirmed findings are fixed or explicitly placed on HOLD.

---

## 10. Immediate next action after this docs PR

Create **Lane A — Avraam baseline and instrumentation** from a current exact green or explicitly classified base. Its first commit must add the dedicated test/evidence skeleton and prove that no product rendering files changed. The first run records defects; it does not silently repair them.
