import type { Person } from './types';

export interface PublishableRuntimePolicy {
  readonly personIdAuthority: string;
  readonly materializedParentAuthorities: readonly string[];
  readonly ignoredParentAuthorities: readonly string[];
  readonly materializedSpouseAuthorities: readonly string[];
  readonly nonTopologicalKinds: readonly string[];
}

export const PUBLISHABLE_RUNTIME_POLICY: PublishableRuntimePolicy;

export function adaptPublishableGenealogy(input: {
  persons: readonly unknown[];
  relations: readonly unknown[];
}): Person[];
