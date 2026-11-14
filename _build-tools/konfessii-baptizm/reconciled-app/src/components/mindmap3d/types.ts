export type NodeGroup = 'root' | 'origin' | 'ukraine' | 'petersburg' | 'union' | 'modern' | 'split' | 'leader';

export type NodeKind =
  | 'root'
  | 'origin'
  | 'union'
  | 'leader'
  | 'split'
  | 'revival'
  | 'mission'
  | 'place'
  | 'faith'
  | 'docs'
  | 'modern'
  | 'merger'
  | 'lineage'
  | 'prism';

export interface NodeData {
  id: string;
  label: string;
  group: NodeGroup;
  kind?: NodeKind;
  size: number;
  desc: string;
  year?: string;
  isCenter?: boolean;
  x?: number;
  y?: number;
  z?: number;
  stats?: { users: string; year: string; sources: string };
  stages?: { year: string; text: string }[];
}

export interface LinkData {
  id: string;
  source: string | NodeData;
  target: string | NodeData;
  label: string;
  desc: string;
}

export interface MapSelection {
  id: string;
  label: string;
  color: string;
  nodes: string[];
}

export interface MapArea {
  id: string;
  label: string;
  color: string;
  nodes: string[];
  left: number;
  top: number;
  width: number;
  height: number;
  rotate?: number;
  kind: 'country' | 'region';
}

export interface CityMarker {
  id: string;
  label: string;
  lon: number;
  lat: number;
  color: string;
  nodes: string[];
}

export interface RoutePreset {
  id: string;
  label: string;
  color: string;
  nodes: string[];
  linkIds: string[];
  focus: string;
  summary: string;
}