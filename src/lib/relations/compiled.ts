import graphData from '../../../data/links-graph.json';
import seriesData from '../../../data/series.json';
import catalogData from '../../../data/relations.json';
import { compileRelations } from './engine.mjs';

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value as Readonly<T>;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value as Readonly<T>;
}

/**
 * Canonical application composition root for the relation system.
 *
 * Astro surfaces import this one immutable projection instead of compiling the
 * same source graph independently. The pure compiler remains separately
 * testable and is still used directly by build diagnostics.
 */
export const compiledRelations = deepFreeze(
  compileRelations({ graphData, seriesData, catalogData, strict: true }),
);

export default compiledRelations;
