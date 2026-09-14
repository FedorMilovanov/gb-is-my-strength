/**
 * layout.ts — stable topological coordinates for a multi-parent genealogy.
 */

import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import type { Person, LayoutOptions, PersonNodeData } from './types';
import { getLineStyle, NODE_W, NODE_H } from './theme.ts';
import { matchesLineage } from './focusGraph.ts';
export { computeFocusLineage } from './focusGraph.ts';


interface LayoutResult {
  nodes: Node<PersonNodeData>[];
  edges: Edge[];
  goldenPath: Set<string>;
  bounds: { x: number; y: number; width: number; height: number };
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

function filterPersons(persons: Person[], opts: LayoutOptions): Person[] {
  return persons.filter(person => matchesLineage(person, opts.showLineage));
}

export function buildLayout(persons: Person[], opts: LayoutOptions): LayoutResult {
  const filtered = filterPersons(persons, opts);
  const ids = new Set(filtered.map(p => p.id));
  const goldenPath = traceGoldenPath(persons);

  // Layout the complete corpus once. Filters retain the same world positions.
  // Years of birth are evidence shown in details, never a replacement for rank.
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 88, nodesep: 56, marginx: 80, marginy: 100 });

  for (const p of persons) g.setNode(p.id, { width: NODE_W, height: NODE_H });
  const allIds = new Set(persons.map(p => p.id));
  for (const p of persons) {
    // Feed BOTH parents (father + mother) into the dagre graph so matriarchs
    // (Sarah, Rebekah, Leah, Bathsheba, Jochebed, Rahab, Ruth, Mary) rank near
    // their children instead of floating disconnected.
    for (const parent of resolveParents(p, allIds)) {
      g.setEdge(parent, p.id);
    }
  }

  dagre.layout(g);

  const nodes: Node<PersonNodeData>[] = filtered.map(p => {
    const pos = g.node(p.id);
    return {
      id: p.id,
      type: 'default',
      position: {
        x: pos.x - NODE_W / 2,
        y: pos.y - NODE_H / 2,
      },
      width: NODE_W,
      height: NODE_H,
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
        golden: opts.showGolden && goldenPath.has(p.id),
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
      const isGoldenEdge = opts.showGolden && isPrimary && goldenPath.has(p.id) && goldenPath.has(parentId);
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
          // Both parents are direct edges here; dashes are reserved for folded paths.
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isGoldenEdge ? '#ffd700' : ls.border,
          width: 14,
        },
      });
    }
  }

  const bounds = { x: 0, y: 0, width: g.graph().width ?? NODE_W, height: g.graph().height ?? NODE_H };
  return { nodes, edges, goldenPath, bounds };
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
