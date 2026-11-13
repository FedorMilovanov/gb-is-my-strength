import type {
  GospelSequenceId,
  Person,
  RelationAuthority,
  RelationConfidence,
  RuntimeGenealogyRelation,
} from './types';

export interface PublishableRuntimePolicy {
  readonly personIdAuthority: string;
  readonly materializedParentAuthorities: readonly string[];
  readonly ignoredParentAuthorities: readonly string[];
  readonly materializedSpouseAuthorities: readonly string[];
  readonly nonTopologicalKinds: readonly string[];
  readonly allowedRelationAuthorities: readonly RelationAuthority[];
  readonly allowedConfidenceValues: readonly RelationConfidence[];
  readonly allowedSequenceIds: readonly GospelSequenceId[];
}

export const PUBLISHABLE_RUNTIME_POLICY: PublishableRuntimePolicy;

export function adaptPublishableGenealogy(input: {
  persons: readonly unknown[];
  relations: readonly unknown[];
}): Person[];

export function adaptPublishableRelationEvidence(input: {
  persons: readonly unknown[];
  relations: readonly unknown[];
  textualAssertions: unknown;
}): RuntimeGenealogyRelation[];
