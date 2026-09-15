function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function pushUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

export const PUBLISHABLE_RUNTIME_POLICY = Object.freeze({
  personIdAuthority: 'curated-v1-id',
  materializedParentAuthorities: Object.freeze(['curated-v1-explicit-field']),
  ignoredParentAuthorities: Object.freeze(['curated-v1-children-index']),
  materializedSpouseAuthorities: Object.freeze(['curated-v1-reciprocal-spouse']),
  nonTopologicalKinds: Object.freeze(['legal-parent']),
});

/**
 * Adapt the certified publishable projection to the current GenealogyTree
 * Person shape without importing raw v2 data.
 *
 * The current ReactFlow runtime is still person-centric (father/mother fields),
 * so only parent relations that came from explicit curated v1 father/mother
 * fields are materialized into topology. children-index relations remain
 * evidence-only until the relation-aware Atlas runtime lands. Legal parentage
 * likewise remains non-topological and must never become father.
 */
export function adaptPublishableGenealogy({ persons, relations }) {
  invariant(Array.isArray(persons) && persons.length > 0,
    'Publishable persons are required');
  invariant(Array.isArray(relations),
    'Publishable relations are required');

  const byPublishableId = new Map();
  const byV1Id = new Map();
  const adapted = [];

  for (const person of persons) {
    invariant(person?.id && person?.v1Id,
      'Every publishable person requires id and v1Id');
    invariant(!byPublishableId.has(person.id),
      `Duplicate publishable person id: ${person.id}`);
    invariant(!byV1Id.has(person.v1Id),
      `Duplicate curated v1 id in publishable persons: ${person.v1Id}`);
    invariant(person.names?.ru,
      `Missing publishable Russian name: ${person.v1Id}`);

    const runtimePerson = {
      id: person.v1Id,
      name: {
        ru: person.names.ru,
        he: person.names.he ?? null,
        greek: person.names.greek ?? null,
        ...(person.names.birthName ? { birthName: person.names.birthName } : {}),
        ...(person.names.altName ? { altName: person.names.altName } : {}),
      },
      father: null,
      mother: null,
      spouse: [],
      children: [],
      chronology: person.chronology ?? null,
      ref: person.ref ?? undefined,
      lineage: person.lineage,
      significance: person.significance ?? undefined,
      era: person.era ?? undefined,
      gender: person.gender ?? undefined,
      role: person.role ?? undefined,
      disputed: person.disputed ?? null,
    };

    byPublishableId.set(person.id, { source: person, runtime: runtimePerson });
    byV1Id.set(person.v1Id, runtimePerson);
    adapted.push(runtimePerson);
  }

  const setParent = (child, role, parentV1Id, relation) => {
    invariant(role === 'father' || role === 'mother',
      `Unsupported explicit parent role: ${relation.from}->${relation.to}:${role}`);
    invariant(child[role] === null || child[role] === parentV1Id,
      `Conflicting runtime ${role}: ${child.id}`);
    child[role] = parentV1Id;
  };

  for (const relation of relations) {
    const from = byPublishableId.get(relation.from);
    const to = byPublishableId.get(relation.to);
    invariant(from && to,
      `Publishable runtime relation escaped person projection: ${relation.kind}:${relation.from}->${relation.to}`);

    if (relation.kind === 'parent') {
      if (PUBLISHABLE_RUNTIME_POLICY.materializedParentAuthorities.includes(relation.authority)) {
        setParent(to.runtime, relation.role, from.runtime.id, relation);
        continue;
      }
      invariant(PUBLISHABLE_RUNTIME_POLICY.ignoredParentAuthorities.includes(relation.authority),
        `Unclassified publishable parent authority: ${relation.authority}`);
      continue;
    }

    if (relation.kind === 'spouse') {
      invariant(PUBLISHABLE_RUNTIME_POLICY.materializedSpouseAuthorities.includes(relation.authority),
        `Unclassified publishable spouse authority: ${relation.authority}`);
      pushUnique(from.runtime.spouse, to.runtime.id);
      pushUnique(to.runtime.spouse, from.runtime.id);
      continue;
    }

    if (PUBLISHABLE_RUNTIME_POLICY.nonTopologicalKinds.includes(relation.kind)) {
      continue;
    }

    invariant(false, `Unclassified publishable relation kind: ${relation.kind}`);
  }

  for (const person of adapted) {
    for (const parentId of [person.father, person.mother]) {
      if (!parentId) continue;
      const parent = byV1Id.get(parentId);
      invariant(parent, `Runtime parent missing from adapted projection: ${parentId}`);
      pushUnique(parent.children, person.id);
    }
  }

  for (const person of adapted) {
    person.spouse.sort(compareText);
    person.children.sort(compareText);
  }

  return adapted;
}
