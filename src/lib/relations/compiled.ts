import graphData from '../../../data/links-graph.json';
import seriesData from '../../../data/series.json';
import catalogData from '../../../data/relations.json';
import { compileRelations } from './engine.mjs';

/**
 * Process-local singleton projection.
 *
 * Every Astro surface imports this object instead of compiling the same graph
 * independently. The pure compiler remains separately testable; this module is
 * only the canonical application composition root.
 */
export const compiledRelations = Object.freeze(
  compileRelations({ graphData, seriesData, catalogData, strict: true }),
);

export default compiledRelations;
