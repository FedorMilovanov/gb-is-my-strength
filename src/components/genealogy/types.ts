/**
 * Genealogy types — strict TypeScript definitions for the biblical genealogy tree.
 *
 * These types model the stable runtime shape consumed by layout, nodes, panels,
 * and search. Production persons are adapted from the certified v2 publishable
 * projection; the legacy curated file remains an editorial/build input.
 */

/** A textual tradition variant (Masoretic / Septuagint / Samaritan). */
export interface TraditionChronology {
  ageAtSon?: number;
  lifespan?: number;
  birthAM?: number;
  deathAM?: number;
}

export interface Chronology {
  mt?: TraditionChronology;
  lxx?: TraditionChronology;
  samaritan?: TraditionChronology;
}

export interface DisputedPosition {
  view: string;
  proponents: string;
  evidence?: string;
}

export interface Disputed {
  level: 'textual' | 'genealogical' | 'theological';
  positions: DisputedPosition[];
}

export type Lineage =
  | 'messianic'
  | 'messianic-matthew'
  | 'messianic-luke'
  | 'messianic-fulfillment'
  | 'cainite'
  | 'rejected'
  | 'neutral';

export type EraId =
  | 'creation'
  | 'antediluvian'
  | 'flood'
  | 'postdiluvian'
  | 'patriarchs'
  | 'kings'
  | 'exile'
  | 'incarnation';

export type Gender = 'm' | 'f' | 'u';

export type Role =
  | 'patriarch'
  | 'matriarch'
  | 'king'
  | 'prince'
  | 'priest'
  | 'prophet'
  | 'governor'
  | 'messiah'
  | 'foster-father'
  | 'person'
  | 'group';

export interface PersonName {
  ru: string;
  he?: string | null;
  translit?: string | null;
  birthName?: string | null;
  altName?: string | null;
  greek?: string | null;
}

export interface Person {
  id: string;
  name: PersonName;
  father: string | null;
  mother?: string | null;
  spouse?: string[];
  children?: string[];
  chronology?: Chronology | null;
  ref?: string;
  parallel?: string | null;
  lineage: Lineage;
  significance?: string;
  era?: EraId;
  gender?: Gender;
  role?: Role;
  disputed?: Disputed | null;
}

export interface Era {
  id: EraId;
  name: string;
  amStart?: number;
  amEnd?: number;
  color: string;
  description?: string;
}

export interface GenealogyData {
  meta: {
    title: string;
    subtitle?: string;
    version: string;
    chronologyBase?: string;
    perspective?: string;
    centralIdea?: string;
  };
  eras: Era[];
  persons: Person[];
  _status?: string;
}

// ── React Flow node/edge data payloads ──

export interface PersonNodeData extends Record<string, unknown> {
  name: string;
  hebrew?: string | null;
  birthName?: string | null;
  altName?: string | null;
  lineage: Lineage;
  chronology?: Chronology | null;
  disputed?: Disputed | null;
  role?: Role;
  significance?: string;
  ref?: string;
  era?: EraId;
  gender?: Gender;
  golden: boolean;
  highlighted?: boolean;
}

export interface LayoutOptions {
  showGolden: boolean;
  showLineage: LineageFilter;
}

export type LineageFilter = 'all' | Lineage | 'messianic';

export type RelationKind = 'parent' | 'spouse' | 'legal-parent';

export interface RelationEvidence {
  provenanceClass: string;
  assertion: string;
  directScripture: boolean | null;
  refsStatus: string;
  refs: string[];
  confidence?: string;
  editorialPosition?: string;
  biology?: string;
  legal?: boolean;
  legalAssertion?: string;
  textualRelation?: string;
}

export interface RuntimeTextualAssertion {
  id: string;
  sequenceId: string;
  position: number;
  fromRef: string | null;
  toRef: string | null;
}

export interface RuntimeGenealogyRelation {
  id: string;
  kind: RelationKind;
  from: string;
  to: string;
  role: string | null;
  authority: string;
  evidence: RelationEvidence;
  note: string | null;
  textualAssertions: RuntimeTextualAssertion[];
}

export type DetailLevel = 0 | 1 | 2;
