/**
 * Genealogy layout engine — dagre hierarchical layout with chronological Y-axis.
 *
 * Nodes are positioned horizontally by dagre's tidy-tree algorithm, and
 * vertically (Y) by birthAM (Anno Mundi year) when available. This produces
 * a tree where overlapping lifetimes are spatially visible (e.g. Methuselah
 * and Noah coexist near the Flood band).
 */

import type { Node, Edge, MarkerType as _MT } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import type { Person, LayoutOptions, PersonNodeData } from './types';
import { getLineStyle, NODE_W, NODE_H } from './theme';

const Y_SPAN = 4200; // px height for the full AM timeline

interface LayoutResult {
  nodes: Node<PersonNodeData>[];
  edges: Edge[];
  goldenPath: Set<string>;
}

/**
 * Trace the golden (messianic) path from Christ back to Adam.
 * Jesus → Mary (mother) → Heli → ... → Adam (father chain).
 */
export function traceGoldenPath(persons: Person[]): Set<string> {
  const path = new Set<string>();
  const christ = persons.find(p => p.role === 'messiah');
  if (!christ) return path;

  let cur: Person | undefined = christ;
  const guard = new Set<string>();

  while (cur && !guard.has(cur.id)) {
    path.add(cur.id);
    guard.add(cur.id);
    // Jesus has no father; follow mother (Mary). Otherwise follow father.
    if (cur.id === 'jesus' && cur.mother) {
      cur = persons.find(p => p.id === cur!.mother);
    } else {
      cur = cur.father ? persons.find(p => p.id === cur!.father!) : undefined;
    }
  }
  return path;
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

  // Compute AM range for Y-axis positioning
  const withAM = filtered.filter(p => p.chronology?.mt?.birthAM != null) as Array<
    Person & { chronology: { mt: { birthAM: number } } }
  >;
  let amMin = Infinity, amMax = -Infinity;
  for (const p of withAM) {
    const am = p.chronology.mt.birthAM;
    if (am < amMin) amMin = am;
    if (am > amMax) amMax = am;
  }
  const amRange = Math.max(1, amMax - amMin);
  const yForAM = (am: number | undefined): number | undefined =>
    am != null ? ((am - amMin) / amRange) * Y_SPAN : undefined;

  // Build dagre graph for X positioning (and fallback Y for those without AM)
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 90, nodesep: 36, marginx: 60, marginy: 80 });

  for (const p of filtered) {
    const h = NODE_H + (p.chronology?.mt?.lifespan ? 14 : 0);
    g.setNode(p.id, { width: NODE_W, height: h });
  }
  for (const p of filtered) {
    const parent = resolveParent(p, ids);
    if (parent) g.setEdge(parent, p.id);
  }

  dagre.layout(g);

  // Build React Flow nodes
  const nodes: Node<PersonNodeData>[] = filtered.map(p => {
    const pos = g.node(p.id);
    const yAM = yForAM(p.chronology?.mt?.birthAM);
    const isGolden = goldenPath.has(p.id);
    return {
      id: p.id,
      type: 'person',
      position: { x: pos.x - NODE_W / 2, y: yAM ?? (pos.y - NODE_H / 2) },
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
        golden: isGolden,
      },
    };
  });

  // Build React Flow edges
  const edges: Edge[] = [];
  for (const p of filtered) {
    const parentId = resolveParent(p, ids);
    if (!parentId) continue;

    const isGoldenEdge = goldenPath.has(p.id) && goldenPath.has(parentId);
    const ls = getLineStyle(p.lineage);

    edges.push({
      id: `${parentId}->${p.id}`,
      source: parentId,
      target: p.id,
      type: 'smoothstep',
      animated: isGoldenEdge,
      style: {
        stroke: isGoldenEdge ? '#ffd700' : ls.border,
        strokeWidth: isGoldenEdge ? 3.5 : p.lineage.startsWith('messianic') ? 2.2 : 1.4,
        opacity: isGoldenEdge ? 0.95 : p.lineage.startsWith('messianic') ? 0.7 : 0.35,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isGoldenEdge ? '#ffd700' : ls.border,
        width: 14,
      },
    });
  }

  return { nodes, edges, goldenPath };
}

/** Resolve the parent ID that exists in the current filtered set. */
function resolveParent(p: Person, ids: Set<string>): string | null {
  if (p.father && ids.has(p.father)) return p.father;
  if (p.mother && ids.has(p.mother)) return p.mother;
  return null;
}
