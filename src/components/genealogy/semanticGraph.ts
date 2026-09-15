import type { Edge, Node, Viewport } from '@xyflow/react';
import type { DetailLevel, PersonNodeData } from './types';
import { COSMIC_ANCHORS, KEY_ROLES, NODE_W, NODE_H } from './theme.ts';

export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 3;
export const OVERVIEW_MAX_ZOOM = 0.26;
export const getDetailLevel = (zoom: number): DetailLevel => zoom < 0.3 ? 0 : zoom < 0.7 ? 1 : 2;
export const centerOf = (node: Node) => ({ x: node.position.x + NODE_W / 2, y: node.position.y + NODE_H / 2 });

type Box = { x: number; y: number; width: number; height: number };
export const boxesOverlap = (a: Box, b: Box, gap = 0) =>
  a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

export function fitGenealogyView(nodes: Node[], width: number, height: number, maxZoom = OVERVIEW_MAX_ZOOM): Viewport {
  if (!nodes.length) return { x: width / 2, y: height / 2, zoom: maxZoom };
  const centers = nodes.map(centerOf);
  const minX = Math.min(...centers.map(p => p.x)), maxX = Math.max(...centers.map(p => p.x));
  const minY = Math.min(...centers.map(p => p.y)), maxY = Math.max(...centers.map(p => p.y));
  // Reserve screen pixels for readable overview labels; fitting tiny world boxes
  // alone crops the labels once semantic zoom gives them a readable size.
  const zoom = Math.max(MIN_ZOOM, Math.min(maxZoom,
    Math.max(1, width - 192) / Math.max(1, maxX - minX),
    Math.max(1, height - 64) / Math.max(1, maxY - minY)));
  return { zoom, x: width / 2 - (minX + maxX) / 2 * zoom, y: height / 2 - (minY + maxY) / 2 * zoom };
}

export function overviewIds(nodes: Node<PersonNodeData>[]): Set<string> {
  const anchors = nodes.filter(n => COSMIC_ANCHORS.has(n.id));
  if (anchors.length) return new Set(anchors.map(n => n.id));
  // A filtered family can contain no central-history anchor.
  const ordered = [...nodes].sort((a, b) => a.position.y - b.position.y || a.id.localeCompare(b.id));
  const result = new Set<string>();
  for (let i = 0; i < Math.min(5, ordered.length); i++) {
    result.add(ordered[Math.round(i * (ordered.length - 1) / Math.max(1, Math.min(5, ordered.length) - 1))].id);
  }
  return result;
}

export function projectGenealogy(
  nodes: Node<PersonNodeData>[], edges: Edge[], zoom: number, preferredIds: string[] = [], spineIds: Set<string> = new Set(),
) {
  const level = getDetailLevel(zoom);
  const scale = level === 2 ? 1 : 1 / Math.max(MIN_ZOOM, zoom);
  const width = level === 2 ? NODE_W : 144 * scale;
  const height = level === 2 ? NODE_H : 44 * scale;
  const preferred = new Set(preferredIds);
  const anchors = overviewIds(nodes);
  const priority = (n: Node<PersonNodeData>) => preferred.has(n.id) ? 0 : anchors.has(n.id) ? 1 : (n.data.golden || spineIds.has(n.id)) ? 2 : 3;
  const candidates = nodes.filter(n => level === 2 || preferred.has(n.id) ||
    (level === 0 ? anchors.has(n.id) : n.data.golden || spineIds.has(n.id) || (n.data.role && KEY_ROLES.has(n.data.role)) || n.data.disputed));
  candidates.sort((a, b) => priority(a) - priority(b) || a.position.y - b.position.y || a.id.localeCompare(b.id));
  const visibleIds = new Set<string>();
  const occupied: Box[] = [];
  for (const node of candidates) {
    const center = centerOf(node);
    const box = { x: center.x - width / 2, y: center.y - height / 2, width, height };
    if (level !== 2 && occupied.some(other => boxesOverlap(box, other, level === 0 ? 0 : 8 * scale))) continue;
    occupied.push(box);
    visibleIds.add(node.id);
  }
  return { level, scale, width, height, visibleIds, edges: collapseEdges(nodes, level === 0 && [...visibleIds].some(id => spineIds.has(id))
    ? edges.filter(e => spineIds.has(e.source) && spineIds.has(e.target)) : edges, visibleIds, zoom) };
}

/** A folded edge is a path, never a newly asserted direct parent relation. */
export function collapseEdges(nodes: Node<PersonNodeData>[], edges: Edge[], visible: Set<string>, zoom: number): Edge[] {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const outgoing = new Map<string, Edge[]>();
  for (const edge of edges) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  const result: Edge[] = [];
  for (const source of visible) {
    const queue = (outgoing.get(source) ?? []).map(edge => ({ edge, path: [source, edge.target] }));
    const visited = new Set([source]);
    while (queue.length) {
      const next = queue.shift()!;
      const target = next.edge.target;
      if (visited.has(target)) continue;
      visited.add(target);
      if (visible.has(target)) {
        const hiddenCount = next.path.length - 2;
        const golden = next.path.every(id => byId.get(id)?.data.golden);
        result.push(hiddenCount === 0 ? { ...next.edge,
          style: { ...next.edge.style, strokeWidth: Math.max(1.5 / zoom, Number(next.edge.style?.strokeWidth ?? 1.5)) },
        } : {
          id: `folded:${source}->${target}`, source, target, type: 'smoothstep',
          data: { collapsed: true, hiddenCount, pathIds: next.path },
          ariaLabel: `${byId.get(source)?.data.name} — ${byId.get(target)?.data.name}: через ${hiddenCount} скрытых персон`,
          style: { stroke: golden ? '#d4a857' : '#8d8373', strokeWidth: 2 / zoom,
            strokeDasharray: `${6 / zoom} ${5 / zoom}`, opacity: 0.7 },
          animated: false,
        });
      } else {
        for (const edge of outgoing.get(target) ?? []) queue.push({ edge, path: [...next.path, edge.target] });
      }
    }
  }
  return result;
}
