/** Source occurrences are distinct from the atlas's parent/interpretation graph. */
import source from '../../../data/genealogy/gospel-sequences.json' with { type: 'json' };
import type { Person } from './types.ts';

export type ComparisonRange = 'david' | 'full';
export type GospelId = 'matthew' | 'luke';
export type GospelEntry = (typeof source.sequences)[number]['entries'][number];

export const gospelSource = source;

export function getGospelComparison(persons: Person[], range: ComparisonRange) {
  const knownIds = new Set(persons.map(person => person.id));
  const lines = source.sequences.map(sequence => {
    const seen = new Set<string>();
    for (const entry of sequence.entries) {
      if (!knownIds.has(entry.personId) || seen.has(entry.personId)) {
        throw new Error(`Invalid gospel occurrence: ${entry.id} (${entry.personId})`);
      }
      seen.add(entry.personId);
    }
    const ordered = sequence.direction === 'descendants-first'
      ? [...sequence.entries].reverse()
      : [...sequence.entries];
    const start = ordered.findIndex(entry => entry.personId === 'david');
    if (start < 0 || ordered.at(-1)?.personId !== 'jesus') {
      throw new Error(`Incomplete gospel sequence: ${sequence.id}`);
    }
    return { ...sequence, entries: range === 'david' ? ordered.slice(start) : ordered };
  });
  const [matthew, luke] = lines;
  const lukeIds = new Set(luke.entries.map(entry => entry.personId));
  // Name equality alone never establishes that two occurrences are one person.
  const sharedIds = new Set(matthew.entries
    .filter(entry => lukeIds.has(entry.personId))
    .map(entry => entry.personId));
  return { lines, sharedIds };
}
