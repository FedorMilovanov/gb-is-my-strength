export const RELATION_SCHEMA_VERSION: 1;
export const RELATION_ENGINE_VERSION: string;

export type RelationDirection = 'directed' | 'undirected';
export type RelationAtlasKind = 'series' | 'cluster' | 'structure' | 'bridge';
export type RelationOrigin = 'catalog' | 'series-registry' | 'legacy-import';

export interface RelationNode {
  id: string;
  title: string;
  url: string;
  group: string;
  atlasGroup: string;
  readingTime?: number;
  cover?: string;
  desc?: string;
  tags: string[];
  isHub: boolean;
  seriesId?: string;
  seriesTitle?: string;
  seriesIndex?: number;
  source: 'graph' | 'series-registry';
}

export interface CompiledRelation {
  id: string;
  source: string;
  target: string;
  kind: string;
  direction: RelationDirection;
  label: string;
  inverseLabel: string;
  rationale: string;
  weight: number;
  editorialStatus: 'verified';
  origin: RelationOrigin;
  atlasKind: RelationAtlasKind;
}

export interface RelationProjectionEntry {
  edgeId: string;
  targetId: string;
  kind: string;
  atlasKind: RelationAtlasKind;
  orientation: 'outgoing' | 'incoming' | 'undirected';
  label: string;
  rationale: string;
  weight: number;
  origin: RelationOrigin;
  score?: number;
}

export interface CompiledRelations {
  schemaVersion: 1;
  engineVersion: string;
  nodes: RelationNode[];
  edges: CompiledRelation[];
  groups: Array<{ id: string; label: string; color: string; count: number }>;
  edgeKinds: Array<{ id: RelationAtlasKind; label: string; count: number }>;
  projections: { byNode: Record<string, { neighbors: RelationProjectionEntry[]; article: RelationProjectionEntry[] }> };
  relationTypes: Record<string, unknown>;
  stats: {
    nodes: number;
    edges: number;
    groups: number;
    articlePanels: number;
    orphanNodes: number;
    orphanIds: string[];
    atlasKinds: Record<RelationAtlasKind, number>;
    semanticKinds: Record<string, number>;
    origins: Record<string, number>;
    catalogDrafts: number;
    catalogDeprecated: number;
    seriesRelations: number;
    legacyImported: number;
    legacySuppressed: number;
    errors: string[];
  };
}

export const RELATION_TYPES: Readonly<Record<string, {
  direction: RelationDirection;
  label: string;
  inverseLabel: string;
  articlePriority: number;
  defaultWeight: number;
  articleVisible: boolean;
}>>;

export const GROUP_META: Readonly<Record<string, { label: string; color: string }>>;
export function normalizeUrl(value: unknown): string;
export function compileRelations(input?: {
  graphData?: unknown;
  seriesData?: unknown;
  catalogData?: unknown;
  strict?: boolean;
}): CompiledRelations;
