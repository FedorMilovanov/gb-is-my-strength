function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function relationKey(relation) {
  return `${relation.kind}:${relation.from}->${relation.to}:${relation.role ?? ''}`;
}

function relationTouchesPair(relation, left, right) {
  return (relation.from === left && relation.to === right) ||
    (relation.from === right && relation.to === left);
}

function relationCrosswalk(relation) {
  if (!relation) {
    return {
      status: 'no-publishable-relation',
      relationKey: null,
      kind: null,
      from: null,
      to: null,
      role: null,
      authority: null,
      evidenceStatus: null,
      directScripture: null,
    };
  }

  return {
    status: 'matched-publishable-relation',
    relationKey: relationKey(relation),
    kind: relation.kind,
    from: relation.from,
    to: relation.to,
    role: relation.role ?? null,
    authority: relation.authority,
    evidenceStatus: relation.evidence?.refsStatus ?? null,
    directScripture: relation.evidence?.directScripture ?? null,
  };
}

/**
 * Build a text-only adjacency layer from the already certified Gospel
 * occurrence sequences.
 *
 * Important: adjacency is not promoted into a family relation here. The
 * crosswalk only tells consumers whether a separately governed publishable
 * relation already connects the same two identities.
 */
export function buildTextualAssertions({ gospelSequences, relations }) {
  invariant(Array.isArray(gospelSequences?.sequences),
    'Resolved Gospel sequences are required for textual assertions');
  invariant(Array.isArray(relations),
    'Publishable relations are required for textual assertion crosswalks');

  const assertions = [];
  const ids = new Set();

  for (const sequence of gospelSequences.sequences) {
    const occurrences = sequence.occurrences ?? [];
    for (let index = 0; index < occurrences.length - 1; index += 1) {
      const from = occurrences[index];
      const to = occurrences[index + 1];

      invariant(from?.occurrenceId && to?.occurrenceId,
        `Missing occurrence id in ${sequence.id} textual adjacency ${index + 1}`);
      invariant(from?.personId && to?.personId,
        `Missing person id in ${sequence.id} textual adjacency ${index + 1}`);

      const matches = relations.filter(relation =>
        relationTouchesPair(relation, from.personId, to.personId));

      invariant(matches.length <= 1,
        `Ambiguous publishable relation crosswalk for ${sequence.id}:${from.occurrenceId}->${to.occurrenceId}`);

      const id = `${sequence.id}:${from.occurrenceId}->${to.occurrenceId}`;
      invariant(!ids.has(id), `Duplicate textual assertion id: ${id}`);
      ids.add(id);

      assertions.push({
        id,
        sequenceId: sequence.id,
        position: index + 1,
        assertion: 'textual-genealogy-adjacency',
        familyInference: 'none',
        source: {
          fromOccurrenceId: from.occurrenceId,
          toOccurrenceId: to.occurrenceId,
          fromRef: from.ref ?? null,
          toRef: to.ref ?? null,
        },
        fromPersonId: from.personId,
        toPersonId: to.personId,
        relationCrosswalk: relationCrosswalk(matches[0] ?? null),
      });
    }
  }

  return {
    schemaVersion: 1,
    authority: 'explicit-gospel-occurrence-adjacency',
    policy: {
      meaning: 'source-order textual adjacency only',
      familyInference: 'forbidden',
      relationCrosswalk: 'informational-only; relation authority remains in publishable relations',
    },
    assertions,
  };
}
