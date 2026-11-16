import type { NodeData, NodeKind } from './types';

export function resolveKind(node: NodeData): NodeKind {
  if (node.kind) return node.kind;
  if (node.id === 'root') return 'root';
  if (node.id === 'vsehb') return 'merger';
  if (node.id === 'spb') return 'revival';
  if (node.id === 'pavlov') return 'mission';
  if (node.id === 'voronin') return 'faith';
  if (node.id === 'kargel') return 'docs';
  if (node.id === 'prokhanov') return 'lineage';
  if (node.id === 'redstock') return 'prism';
  if (node.id === 'zhidkov') return 'place';
  if (node.group === 'split') return 'split';
  if (node.group === 'modern') return 'modern';
  if (node.group === 'union') return 'union';
  if (node.group === 'leader') return 'leader';
  return 'origin';
}