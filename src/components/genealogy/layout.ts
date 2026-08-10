/**
 * layout.ts — dagre layout + golden path + coherent chronology-aware world coordinates.
 */

import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import type { Person, LayoutOptions, PersonNodeData } from './types';
import { getLineStyle, NODE_W, NODE_H } from './theme';

/**
 * Minimum height retained for the chronology axis. The actual world may be taller
 * when Dagre needs more vertical room for the full genealogy.
 */
const MIN_WORLD_HEIGHT = 4200;

interface LayoutResult {
  nodes: Node<PersonNodeData>[];
  edges: Edge[];
  goldenPath: Set<string>;
  worldHeight: number;
}

export function traceGoldenPath(persons: Person[]): Set<string> {
  const path = new Set<string>();
  const christ = persons.find(p => p.role === 'messiah');
  if (!christ) return path;
  let cur: Person | undefined = christ;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    path.add(cur.id); guard.add(cur.id);
    if (cur.id === 'jesus' && cur.mother) cur = persons.find(p => p.id === cur!.mother);
    else cur = cur.father ? persons.find(p => p.id === cur!.father!) : undefined;
  }
  return path;
}

/**
 * Compute the "focus lineage" for a person:
 * - All ancestors (tracing father/mother up to root)
 * - All descendants (tracing children recursively down)
 * Returns a Set of person IDs in the focus lineage.
 */
export function computeFocusLineage(persons: Person[], personId: string): Set<string> {
  const byId = new Map(persons.map(p => [p.id, p]));
  const result = new Set<string>();
  const target = byId.get(personId);
  if (!target) return result;

  // 1. Trace ancestors UP (father/mother → their father/mother → ... → root)
  let cur: Person | undefined = target;
  const upGuard = new Set<string>();
  while (cur && !upGuard.has(cur.id)) {
    result.add(cur.id);
    upGuard.add(cur.id);
    if (cur.id === 'jesus' && cur.mother) cur = byId.get(cur.mother);
    else cur = cur.father ? byId.get(cur.father) : (cur.mother ? byId.get(cur.mother) : undefined);
  }

  // 2. Trace descendants DOWN (recursive)
  const queue: string[] = [personId];
  const downGuard = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (downGuard.has(id)) continue;
    downGuard.add(id);
    result.add(id);
    const p = byId.get(id);
    if (p?.children) {
      for (const childId of p.children) {
        if (byId.has(childId) && !downGuard.has(childId)) {
          queue.push(childId);
        }
      }
    }
  }

  return result;
}

function filterPersons(persons: Person[], opts: LayoutOptions): Person[] {
  if (opts.showLineage === 'all') return persons;
  if (opts.showLineage === 'messianic') return persons.filter(p => p.lineage.startsWith('messianic'));
  return persons.filter(p => p.lineage === opts.showLineage);
}

export function buildLayout(persons: Person[], opts: LayoutOptions): LayoutResult {
  const filtered = filterPersons(persons, opts);
  const ids = new Set(filtered.map(p => p.id));
  const goldenPath = opts.showGolden ? traceGoldenPath(persons) : new Set<string>();

  const withAM = filtered.filter(p => p.chronology?.mt?.birthAM != null) as Array<
    Person & { chronology: { mt: { birthAM: number } } }
  >;
  let amMin = Infinity, amMax = -Infinity;
  for (const p of withAM) {
    const am = p.chronology.mt.birthAM;
    if (am < amMin) amMin = am;
    if (am > amMax) amMax = am;
  }
  const hasChronology = Number.isFinite(amMin) && Number.isFinite(amMax);
  const amRange = hasChronology ? Math.max(1, amMax - amMin) : 1;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 110, nodesep: 44, marginx: 80, marginy: 100 });

  for (const p of filtered) {
    const h = NODE_H + (p.chronology?.mt?.lifespan ? 14 : 0);
    g.setNode(p.id, { width: NODE_W, height: h });
  }
  for (const p of filtered) {
    // Feed BOTH parents (father + mother) into the dagre graph so matriarchs
    // (Sarah, Rebekah, Leah, Bathsheba, Jochebed, Rahab, Ruth, Mary) rank near
    // their children instead of floating disconnected.
    for (const parent of resolveParents(p, ids)) {
      g.setEdge(parent, p.id);
    }
  }

  dagre.layout(g);

  /*
   * World-coordinate contract
   * -------------------------
   * Dagre owns the topology for every person. Its natural Y extent defines the
   * size of the shared world. Both known chronology and topology-only persons
   * are then projected into that SAME normalized 0..1 vertical coordinate:
   *
   *   known birthAM -> normalized AM position
   *   no birthAM    -> normalized Dagre position
   *
   * The old layout mixed absolute 0..4200 AM pixels with unbounded Dagre pixels,
   * creating a sparse envelope whose midpoint could contain no people. This
   * projection keeps chronology meaningful without allowing either source to
   * create a second incompatible Y space.
   */
  const dagreYs = filtered.map(p => g.node(p.id).y as number);
  const dagreMin = dagreYs.length ? Math.min(...dagreYs) : 0;
  const dagreMax = dagreYs.length ? Math.max(...dagreYs) : NODE_H;
  const dagreRange = Math.max(1, dagreMax - dagreMin);
  const worldHeight = Math.max(MIN_WORLD_HEIGHT, Math.ceil(dagreRange + NODE_H));
  const usableWorldHeight = Math.max(1, worldHeight - NODE_H);

  const topologyT = (dagreY: number): number => (dagreY - dagreMin) / dagreRange;
  const chronologyT = (am: number | undefined): number | undefined =>
    hasChronology && am != null ? (am - amMin) / amRange : undefined;

  const nodes: Node<PersonNodeData>[] = filtered.map(p => {
    const pos = g.node(p.id);
    const verticalT = chronologyT(p.chronology?.mt?.birthAM) ?? topologyT(pos.y);
    return {
      id: p.id,
      type: 'default',
      position: {
        x: pos.x - NODE_W / 2,
        y: Math.max(0, Math.min(1, verticalT)) * usableWorldHeight,
      },
      data: {
        name: p.name.ru,
        hebrew: p.name.he,
        birthName: p.name.birthName,
        altName: p.name.altName,
        lineage: p.lineage,
        chronology: p.chronology,
        disputed: p.disputed,
        role: p.role,
        significance: p.significance,
        ref: p.ref,
        era: p.era,
        gender: p.gender,
        golden: goldenPath.has(p.id),
      },
    };
  });

  const edges: Edge[] = [];
  for (const p of filtered) {
    const parents = resolveParents(p, ids);
    if (parents.length === 0) continue;
    // The "primary" parent carries the golden/messianic styling (father first,
    // except Jesus whose canonical lineage is traced through Mary). Additional
    // parent (the matriarch) gets a softer maternal edge so mothers are linked
    // to their children instead of hanging in the void.
    const primary = resolveParent(p, ids);
    const ls = getLineStyle(p.lineage);
    for (const parentId of parents) {
      const isPrimary = parentId === primary;
      const isGoldenEdge = isPrimary && goldenPath.has(p.id) && goldenPath.has(parentId);
      const isMaternal = !isPrimary;
      edges.push({
        id: `${parentId}->${p.id}`,
        source: parentId,
        target: p.id,
        type: 'smoothstep',
        animated: isGoldenEdge,
        style: {
          stroke: isGoldenEdge ? '#ffd700' : ls.border,
          strokeWidth: isGoldenEdge ? 3.5 : p.lineage.startsWith('messianic') ? 2.2 : 1.4,
          opacity: isGoldenEdge ? 0.95 : isMaternal ? 0.28 : p.lineage.startsWith('messianic') ? 0.7 : 0.35,
          strokeDasharray: isMaternal ? '5 4' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isGoldenEdge ? '#ffd700' : ls.border,
          width: 14,
        },
      });
    }
  }

  return { nodes, edges, goldenPath, worldHeight };
}

function resolveParent(p: Person, ids: Set<string>): string | null {
  // Primary parent for golden-path / focus tracing.
  // Jesus' canonical genealogy is traced through Mary; everyone else: father first.
  if (p.id === 'jesus' && p.mother && ids.has(p.mother)) return p.mother;
  if (p.father && ids.has(p.father)) return p.father;
  if (p.mother && ids.has(p.mother)) return p.mother;
  return null;
}

/**
 * All in-graph parents of a person (father AND mother). Order: primary first.
 * Used to draw multi-parent edges so matriarchs connect to their children
 * (multi-parent DAG instead of a father-only tree).
 */
function resolveParents(p: Person, ids: Set<string>): string[] {
  const out: string[] = [];
  const primary = resolveParent(p, ids);
  if (primary) out.push(primary);
  if (p.father && ids.has(p.father) && !out.includes(p.father)) out.push(p.father);
  if (p.mother && ids.has(p.mother) && !out.includes(p.mother)) out.push(p.mother);
  return out;
}
