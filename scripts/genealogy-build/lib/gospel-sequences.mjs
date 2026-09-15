/**
 * Resolve the curated Synodal Matthew/Luke occurrence lists into v2 identities.
 *
 * The source file is textual evidence. The v2 person graph is an identity graph.
 * This module bridges them only through the reviewed v1→TIPNR matcher; it never
 * derives Gospel membership by traversing parent edges.
 */

const CLUSTER_BY_SEQUENCE = Object.freeze({
  matthew: 'matthew-1',
  luke: 'luke-3',
});

export function resolveGospelSequences(source, { v1Matches, persons, sourcePath = 'data/genealogy/gospel-sequences.json' }) {
  if (!source || source.schemaVersion !== 1 || !Array.isArray(source.sequences)) {
    throw new Error('Invalid Gospel sequence source schema');
  }
  const byKey = new Map(persons.map(person => [person.key, person]));
  const seenSequenceIds = new Set();

  const sequences = source.sequences.map(sequence => {
    if (seenSequenceIds.has(sequence.id)) throw new Error(`Duplicate Gospel sequence id: ${sequence.id}`);
    seenSequenceIds.add(sequence.id);
    const clusterId = CLUSTER_BY_SEQUENCE[sequence.id];
    if (!clusterId) throw new Error(`Unsupported Gospel sequence: ${sequence.id}`);
    if (!Array.isArray(sequence.entries) || !sequence.entries.length) {
      throw new Error(`Empty Gospel sequence: ${sequence.id}`);
    }

    const seenOccurrenceIds = new Set();
    const seenPersonIds = new Set();
    const occurrences = sequence.entries.map(entry => {
      if (!entry?.id || seenOccurrenceIds.has(entry.id)) {
        throw new Error(`Duplicate or missing Gospel occurrence id in ${sequence.id}: ${entry?.id ?? 'missing'}`);
      }
      seenOccurrenceIds.add(entry.id);

      const key = v1Matches.get(entry.personId);
      if (!key) throw new Error(`Unresolved v1 Gospel identity: ${sequence.id}:${entry.id} → ${entry.personId}`);
      const person = byKey.get(key);
      if (!person) throw new Error(`Resolved Gospel key missing from emitted v2 persons: ${key}`);
      if (seenPersonIds.has(person.id)) {
        throw new Error(`Duplicate v2 identity inside Gospel sequence ${sequence.id}: ${person.id}`);
      }
      seenPersonIds.add(person.id);

      return {
        occurrenceId: entry.id,
        personId: person.id,
        personKey: person.key,
        sourcePersonId: entry.personId,
        name: entry.name,
        sourceForm: entry.sourceForm,
        ref: entry.ref,
      };
    });

    return {
      id: sequence.id,
      clusterId,
      authority: 'explicit-scriptural-sequence',
      sourcePath,
      sourceRef: sequence.sourceRef,
      translation: source.translation,
      direction: sequence.direction,
      notes: sequence.notes ?? [],
      occurrences,
    };
  });

  for (const required of Object.keys(CLUSTER_BY_SEQUENCE)) {
    if (!seenSequenceIds.has(required)) throw new Error(`Missing required Gospel sequence: ${required}`);
  }

  return {
    schemaVersion: 1,
    authority: 'explicit-scriptural-sequences',
    sourcePath,
    translation: source.translation,
    scope: source.scope ?? null,
    sequences,
  };
}

export function gospelSequenceForCluster(resolved, clusterId) {
  return resolved?.sequences?.find(sequence => sequence.clusterId === clusterId) ?? null;
}
