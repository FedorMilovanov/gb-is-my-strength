# AGENTS-REFERENCE.md — current surface authority router

> **Status:** current supporting reference.  
> **Operational root:** [`AGENTS.md`](AGENTS.md).  
> **Document lifecycle SSOT:** [`data/document-authority.json`](data/document-authority.json).  
> **Pre-split historical snapshot:** [`docs/history/AGENTS-REFERENCE-2026-09-07-pre-split.md`](docs/history/AGENTS-REFERENCE-2026-09-07-pre-split.md).

This file is deliberately a **router**, not a second operational root and not a frozen inventory of the repository. It preserves current cross-surface invariants and points each surface to its real owner. Mutable facts such as framework versions, route counts, CSS/JS counts, workflow counts and implementation snapshots must be read from current source/registries, not maintained here as a second truth.

## 1. How to use this file

1. Read `AGENTS.md` before mutation.
2. Identify the exact surface being changed.
3. Follow the current owner/source listed below.
4. Verify referenced paths and commands against current `main`.
5. If a historical/design document conflicts with current source, route profile, registered normative policy or a newer owner instruction, the historical/design document does not win.

The complete pre-split reference remains byte-preserved for provenance. Do not use that snapshot as current blanket policy.

## 2. Authority routing

| Surface | Current authority / source |
|---|---|
| Work modes and proportional checks | `docs/WORK_MODES.md` |
| Lane ownership / overlap / cleanup | `docs/LANE_LOCK_POLICY.md` |
| Push / PR discipline | `docs/AGENT_PUSH_MODEL.md` |
| Worktree / branch lifecycle | `docs/GIT_WORKTREE_POLICY.md`, `docs/BRANCH_LIFECYCLE_V4.md` |
| Owner-sensitive invariants | `docs/OWNER-INVARIANTS.md` |
| Document lifecycle | `data/document-authority.json`, `docs/DOCUMENT_AUTHORITY.md` |
| Route ownership | `migration/page-ownership.json`, matching `data/route-profiles/*.json` |
| Derived migration matrix | generator/source stack behind `migration/route-migration-matrix.json`; never hand-author route truth in the derived matrix |
| Editorial charter | `docs/ARTICLE-STANDARD-CHARTER.md` |
| Evidence / source policy | `docs/EDITORIAL-SOURCE-POLICY.md` |
| Reader-facing quality | `docs/CONTENT-QUALITY-STANDARD.md` |
| Search/index publication | `docs/SEARCH_INDEX_POLICY.md` and current search registries |
| Reference transfer / visual parity | `docs/REFERENCE_TRANSFER_POLICY.md` |
| Release/live evidence | `docs/RELEASE-LIVE-EVIDENCE.md` |
| External tooling | `audit/external-checks/README.md` |
| Environment capability | live discovery first; `docs/SANDBOX-ENV-2026-06-21.md` is supporting policy, not a universal machine snapshot |
| Reference parser / tooltip capability | `docs/REFERENCE-TOOLTIP-CONTRACT.md` plus current source/guards |
| Home browser behavior | `docs/HOME-BROWSER-CONTRACT.md` plus current browser tests |
| John Gill factual claims | `data/gill-verified-claims.json` + `npm run gill:claims:surface:audit` |
| Maps | current route profile + current map source/registries/guards; dated architecture/design docs are intent/evidence only unless current authority explicitly delegates to them |
| Genealogy / `/rodosloviye/` | current route profile + current `src/**` implementation + applicable guards; old design-before-code engine documents do not override the shipped implementation |
| Reader state/preferences/runtime | current `src/**`/`js/**` ownership and applicable reader guards; do not infer ownership from an old global JS inventory |
| Service worker / publication assets | current source + build/publication contracts and applicable guards |

## 3. Route and runtime ownership

Route families are not governed by one universal legacy transport rule. For any route change:

- resolve the route in `migration/page-ownership.json`;
- read its matching `data/route-profiles/*.json` contract;
- treat `migration/route-migration-matrix.json` as derived output;
- use the runtime/source actually owned by that route profile;
- do not assume root legacy HTML, `enhancements.js`, `site.js`, or any other historical runtime is mounted by every route;
- do not resurrect a legacy mirror merely to satisfy an old prose rule when the current route is strict-native.

A source file may remain in the repository for legacy-shadow/reference routes without becoming the implementation owner of native routes.

## 4. Assets, CSS and JavaScript

There is **no fixed repository-wide CSS/JS file count in this reference**. The tree and current owners are authoritative.

Before adding or moving shared CSS/JS:

- determine the actual route/runtime owner;
- reuse an existing owner only when that owner semantically fits;
- do not place new native behavior into a legacy file simply because an old document named it as a fallback;
- do not duplicate handlers, controls or state owners across native and legacy runtimes;
- preserve generated/cache-bust asset revision flows and run the applicable contract after source changes;
- do not hand-edit generated artifacts when a canonical generator exists.

Shared runtime changes are SYSTEM work and require exact-head evidence appropriate to the affected surfaces.

## 5. Editorial and article invariants

The normative editorial documents named in §2 own detailed policy. Cross-surface invariants that remain protected:

- byline semantics must preserve the owner-approved `Автор-редактор:` / `Редактор:` model; do not silently relabel the editor as plain `Автор:`;
- do not reintroduce article-level AI disclosure when current owner policy keeps AI disclosure on `/about/`;
- Russian reader-facing articles must not expose untranslated English quotations merely because an English source was used;
- source/evidence requirements come from the current evidence policy, not from migration-era duplication rules;
- quiz, metadata, structured data and other semantics must have one current owner per route profile; a legacy mirror is required only when the current route contract explicitly requires it;
- source-derived facts must not be maintained as independent prose counters.

## 6. UI, security and interaction invariants

When applicable to the changed surface:

- preserve safe text/HTML boundaries; do not turn untrusted or data-derived text into unchecked HTML;
- preserve keyboard, pointer and hover semantics rather than testing only one desktop mouse path;
- keep one semantic owner for tooltips, overlays, readers and floating controls;
- preserve owner-approved typography, hierarchy and protected content/data unless the owner explicitly changes them;
- do not add `!important` as a first response to cascade problems; identify layer/specificity/ownership first;
- do not remove stable hooks such as article header/author-card contracts without a bounded owner-approved migration;
- accessibility and browser evidence must be proportional to the actual behavior changed.

## 7. John Gill surfaces

Do not maintain a handwritten fixed list of “six surfaces” as a second source of truth. For a Gill factual correction:

1. read `data/gill-verified-claims.json`;
2. inspect the current surfaces discovered by the Gill audit/source registries;
3. run `npm run gill:claims:surface:audit`;
4. treat the exact-head audit result as evidence for the current tree.

Historical surface inventories remain useful forensic evidence but cannot override the executable registry/guard.

## 8. Maps and genealogy

Maps and genealogy contain valuable historical design documents, but design intent and implementation truth are distinct.

### Maps

Use current route profiles, current map engine/source, current data registries and current guards for implementation truth. A dated map architecture/design document may provide owner intent or UX rationale only after its assumptions are checked against current `main`. Old version numbers, audit counts or statements about which map is “next” are snapshots, not current authority.

### Genealogy

Use the shipped route profile and current implementation as technical truth. Older design-before-code documents may preserve owner UX/interaction intent, but they do not prohibit a framework/runtime that current production already owns. Never rewrite current implementation merely to make it match a superseded design assumption.

## 9. Historical reference

The pre-split monolith is preserved at:

`docs/history/AGENTS-REFERENCE-2026-09-07-pre-split.md`

Its purpose is lossless provenance for old owner statements, inventories, migration notes and surface rationale. It is `historical` / `provenance-only` and must not be cited as the current repository-wide operational contract.

When a unique historical statement still matters:

1. verify that a current owner/source still delegates the surface to that statement;
2. promote the durable rule into the appropriate current narrow contract if necessary;
3. keep the historical snapshot unchanged.

## 10. Anti-drift rules for this router

This current file must not become another mutable repository census. In particular, do not add:

- a hard-coded current Astro/framework major or dependency version;
- a hard-coded total CSS/JS/route/workflow count;
- blanket ownership of all production routes by legacy root HTML/JS;
- a universal fallback directing new behavior into `enhancements.js` or another legacy runtime;
- instructions to run every repository check before every push;
- migration-state prose presented as current implementation truth.

If a fact is mechanically derivable from the current tree, registry, package lock or guard, link to that owner instead of copying the value here.
