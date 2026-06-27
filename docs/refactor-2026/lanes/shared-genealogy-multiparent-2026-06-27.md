# Lane: shared-genealogy-multiparent-2026-06-27

**Goal:** Fix the single-parent restriction in the genealogy layout so matriarchs
connect to their children (multi-parent DAG instead of father-only tree).

## Bug (AuditRepo: DEEP_SURGICAL_PREMIUMCONTROLS_MASTER_ANALYSIS §4.4)
`src/components/genealogy/layout.ts` built both the dagre layout graph and the
visual ReactFlow edges using `resolveParent()` which returns exactly ONE parent
(father priority). Result: 8 matriarchs who are mothers but never a father —
**Сарра, Ревекка, Лия, Вирсавия, Иохаведа, Раав, Руфь, Мария** — had no outgoing
edges and visually hung disconnected. Jesus' dual lineage (Matthew via Joseph /
Luke via Mary) could not be expressed.

## Fix
- Added `resolveParents()` (plural): returns BOTH in-graph parents, primary first.
- dagre graph now receives edges from both parents → matriarchs rank near children.
- Visual edges now drawn for both parents; the secondary (maternal) edge uses a
  softer dashed style (opacity .28, dasharray "5 4") so the messianic golden path
  and primary lineage styling stay dominant.
- `resolveParent()` (primary, used for golden-path + focus tracing) made explicit:
  Jesus → Mary; everyone else → father first, mother fallback.

Verified (node mirror of the logic against `data/genealogy/genealogy.json`):
all 8 matriarchs now appear as edge sources; Jesus primary parent = Mary;
152 parent-edges total. Build passes (TS compiles), audit-pro PASS (0 errors),
data:consistency PASS.

## Status note (evidence-layer honesty)
The `/rodosloviye/` route currently ships a static landing page; the interactive
`GenealogyTree` ReactFlow island (which consumes `layout.ts`) is **not yet mounted
into any built page** (`@xyflow/react` is absent from `dist/`). This fix is therefore
a correct **latent-bug repair**: the source is now right and ready for when the tree
island is wired into `/rodosloviye/`. No live behaviour changes (dist unchanged).
