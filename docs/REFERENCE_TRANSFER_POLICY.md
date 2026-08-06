# Reference Transfer Policy — exactness without CI paralysis

**Mode:** SYSTEM  
**Owner:** Fedor Milovanov  
**Purpose:** prevent “1:1 by inspiration”, generic-template substitutions and accidental reference regressions without turning every visual change into a full-site pixel gate.

## 1. The problem this policy solves

A reference may be used in four materially different ways:

1. as an exact implementation target;
2. as an approved adaptive source;
3. as historical evidence for a native replacement;
4. as a legacy surface that must be preserved rather than modernized.

Treating all four as “copy the HTML somehow” creates two opposite failures:

- weak transfer: only headings, rough blocks or visual mood survive while structure, behavior and mobile composition are lost;
- over-enforcement: every old pixel or token becomes a permanent blocking rule and the site becomes impossible to improve.

The repository therefore uses explicit transfer modes and a small blocking budget.

## 2. Transfer modes

### `exact-replica`

Use only when the owner explicitly requires a true 1:1 transfer.

Required evidence:

- a committed immutable reference snapshot;
- SHA-256 of that snapshot;
- named target owners;
- explicit structural markers and order checks;
- desktop and mobile visual review before production promotion;
- a bounded list of permitted differences, normally empty.

A PR may not claim “1:1”, “exact replica” or equivalent merely because title, text, colors or a few class names match.

### `adaptive-approved`

The reference defines the core interaction and visual language, while documented deviations are allowed for accessibility, responsive layout, native framework ownership or owner-approved simplification.

Core invariants may block. Cosmetic differences remain advisory unless the owner promotes a specific route to a reviewed visual baseline.

### `native-contract`

The old HTML/reference is historical evidence, not the current render owner. Correctness is delegated to named native source, browser and visual guards. Legacy-vs-native pixel similarity is diagnostic only.

A route must never be moved to `native-contract` merely to silence a screenshot failure.

### `legacy-preserve`

The surface is intentionally independent or expensive to rewrite. Agents must not “clean it up”, normalize it to a generic component or transplant another route’s UI without an explicit owner-approved SYSTEM lane.

### `performance-target`

A measured future optimization such as chunk splitting, lazy loading or duplicate removal. It is non-blocking until a bounded implementation exists and exact-head measurements prove the threshold is realistic.

### `inventory`

Evidence and counting only. Inventory entries never block a Product PR.

## 3. Blocking budget

`data/reference-transfer-contracts.json` is the registry. Its validator enforces:

- at most eight blocking transfer contracts at a time;
- at most three delegated guards per contract;
- at most twelve required and twelve forbidden markers per checked file;
- no automatic harvesting of every class, selector or HTML token;
- no blocking `performance-target` or `inventory` entry;
- no exact-replica claim without a committed snapshot and verified digest.

This budget is intentional. A new blocking rule must replace a proven gap, not duplicate an existing route guard.

## 4. What blocks and what warns

Blocking is appropriate for:

- missing canonical owner or required structural landmark;
- reintroduced forbidden legacy runtime or duplicate implementation;
- broken same-origin/security boundary;
- exact-replica claim without a real reference snapshot;
- removal of a protected legacy surface;
- malformed or contradictory registry data.

Advisory by default:

- small spacing, color or typography drift without an approved baseline;
- a future bundle target not yet implemented;
- new routes not yet reviewed by the owner;
- historical reference differences on a native-contract route;
- inventory counts.

Warnings may become blocking only after an owner decision, a bounded contract and evidence that the check is stable.

## 5. Workflow for a reference-based change

1. Identify the route and current render owner.
2. Select one transfer mode.
3. Reuse existing route/browser/visual guards; do not create a duplicate mega-check.
4. For `exact-replica`, commit the reference snapshot and digest before implementation.
5. Declare permitted deviations before coding, not after a failed comparison.
6. Run only the checks that can fail because of the changed surface.
7. Promote a warning to blocking only after a real regression escaped the existing suite or the owner explicitly protects the invariant.

## 6. Current Arena-derived dispositions

The Agent Arena evidence is incorporated as follows:

- Home, Search, Karty and Favorite Store: native-contract protection.
- Gill mobile chrome: adaptive-approved; the canonical core remains protected while the current TOC implementation may differ intentionally.
- Nagornaya: legacy-preserve; do not genericize its independent world.
- Baptists 3D app and TTS chunking: performance-target, not premature CI barriers.
- Strangler duplicate counting: inventory only.

The registry stores these dispositions and points to existing guards instead of reimplementing them.

## 7. Non-goals

This policy does not:

- require full-site Playwright for every local edit;
- freeze every legacy pixel forever;
- allow generic Astro cards to replace premium route identity;
- create a second route ownership registry;
- make historical AuditRepo prose override current Product source;
- treat a green token check as production visual proof.
