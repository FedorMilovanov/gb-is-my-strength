import { buildTextualAssertions } from './textual-assertions.mjs';

/**
 * Build a closed, publication-safe projection from the curated v1 genealogy
 * and the richer v2 identity graph.
 *
 * Raw v2 remains research/draft data. This projection admits only v1-curated
 * identities, approved Russian labels and relations with an explicit authority.
 */

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function stableObject(value) {
  return value == null ? null : value;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function relationKey(kind, from, to, role = '') {
  return `${kind}:${from}->${to}:${role}`;
}

function pushOmission(list, item) {
  list.push(item);
}

function curatedRelationEvidence() {
  return {
    provenanceClass: 'curated-source-derived',
    assertion: 'source-derived',
    directScripture: null,
    refsStatus: 'relation-level-review-pending',
    refs: [],
  };
}

function validateQualifiedRelationSet(set = {}, context = 'Qualified relation evidence') {
  invariant(typeof set.directScripture === 'boolean',
    `${context} requires explicit directScripture boolean`);
  invariant(typeof set.assertion === 'string' && set.assertion.trim().length > 0,
    `${context} requires assertion classification`);
  invariant(typeof set.confidence === 'string' && set.confidence.trim().length > 0,
    `${context} requires confidence classification`);
  invariant(typeof set.editorialPosition === 'string' && set.editorialPosition.trim().length > 0,
    `${context} requires editorialPosition classification`);
  invariant(Array.isArray(set.refs) && set.refs.length > 0 &&
    set.refs.every(ref => typeof ref === 'string' && ref.trim().length > 0),
  `${context} requires reviewed non-empty refs`);

  if (set.assertion === 'editorial-harmonization') {
    invariant(set.directScripture === false,
      `${context} editorial-harmonization must use directScripture=false`);
  }
}

function qualifiedRelationEvidence(set = {}) {
  validateQualifiedRelationSet(set);
  return {
    provenanceClass: set.directScripture === true
      ? 'direct-scripture-qualified'
      : 'editorial-qualified',
    refsStatus: 'editorially-reviewed',
    ...set,
    refs: [...set.refs],
  };
}

export function validateEdgeAnnotations(edgeAnnotations) {
  invariant(edgeAnnotations && typeof edgeAnnotations === 'object',
    'Edge annotations object is required');
  invariant(Array.isArray(edgeAnnotations.annotations),
    'Edge annotations must contain annotations[]');

  const seen = new Set();
  for (const [index, annotation] of edgeAnnotations.annotations.entries()) {
    const context = `Edge annotation #${index + 1}`;
    invariant(annotation && typeof annotation === 'object',
      `${context} must be an object`);
    invariant(typeof annotation.from === 'string' && annotation.from.length > 0,
      `${context} requires from`);
    invariant(typeof annotation.to === 'string' && annotation.to.length > 0,
      `${context} requires to`);
    invariant(annotation.from !== annotation.to,
      `${context} cannot target the same identity`);
    invariant(typeof annotation.kind === 'string' && annotation.kind.length > 0,
      `${context} requires kind`);
    invariant(annotation.set && typeof annotation.set === 'object' && !Array.isArray(annotation.set),
      `${context} requires set object`);

    const key = `${annotation.kind}:${annotation.from}->${annotation.to}`;
    invariant(!seen.has(key),
      `Duplicate edge annotation target: ${key}`);
    seen.add(key);

    validateQualifiedRelationSet(annotation.set, context);

    if (annotation.set.legal === true) {
      invariant(annotation.kind === 'parent',
        `${context} legal relation must annotate parent kind`);
      invariant(annotation.set.biology === 'non-biological',
        `${context} legal relation requires biology=non-biological`);
      invariant(typeof annotation.set.legalAssertion === 'string' &&
        annotation.set.legalAssertion.trim().length > 0,
      `${context} legal relation requires legalAssertion`);
    }
  }

  return { annotations: edgeAnnotations.annotations.length };
}

export function buildPublishableProjection({
  v1,
  persons,
  gospelSequences,
  edgeAnnotations,
  rawMeta,
  sourceHashes,
}) {
  invariant(Array.isArray(v1?.persons) && v1.persons.length > 0, 'Curated v1 persons are required');
  invariant(Array.isArray(persons) && persons.length > 0, 'v2 persons are required');
  invariant(Array.isArray(gospelSequences?.sequences), 'Resolved v2 Gospel sequences are required');
  validateEdgeAnnotations(edgeAnnotations);

  const v1ById = new Map(v1.persons.map(person => [person.id, person]));
  invariant(v1ById.size === v1.persons.length, 'Duplicate ids in curated v1');

  const mappedByV1 = new Map();
  for (const person of persons) {
    const v1Id = person.skeleton?.v1Id;
    if (!v1Id) continue;
    invariant(v1ById.has(v1Id), `v2 skeleton points outside curated v1: ${v1Id}`);
    invariant(!mappedByV1.has(v1Id), `Duplicate v2 identity for curated v1 id: ${v1Id}`);
    mappedByV1.set(v1Id, person);
  }
  invariant(mappedByV1.size === v1.persons.length,
    `Curated identity mapping incomplete: ${mappedByV1.size}/${v1.persons.length}`);

  const selected = v1.persons.map(source => {
    const person = mappedByV1.get(source.id);
    invariant(person, `Missing v2 identity for ${source.id}`);
    invariant(person.ru?.name, `Missing Russian label for curated identity ${source.id}`);
    invariant(person.ru.review === false, `Curated identity still requires Russian review: ${source.id}`);

    return {
      id: person.id,
      key: person.key,
      v1Id: source.id,
      names: {
        ru: person.ru.name,
        en: person.en,
        he: source.name?.he ?? person.skeleton?.he ?? null,
        greek: source.name?.greek ?? null,
        ...(source.name?.birthName ? { birthName: source.name.birthName } : {}),
        ...(source.name?.altName ? { altName: source.name.altName } : {}),
      },
      gender: source.gender ?? person.gender,
      ref: source.ref ?? null,
      firstRef: person.firstRef ?? null,
      lineage: source.lineage ?? null,
      role: source.role ?? null,
      era: source.era ?? null,
      significance: source.significance ?? null,
      chronology: stableObject(source.chronology),
      disputed: stableObject(source.disputed),
      identity: {
        authority: 'curated-v1-to-tipnr',
        v1Id: source.id,
        tipnrKey: person.key,
        russianLabelReview: false,
      },
    };
  });

  const selectedByV1 = new Map(selected.map(person => [person.v1Id, person]));
  const selectedIds = new Set(selected.map(person => person.id));
  invariant(selectedIds.size === selected.length, 'Duplicate ids in publishable person projection');

  const relations = new Map();
  const diagnostics = {
    externalRefs: [],
    childIndexConflicts: [],
    asymmetricSpouses: [],
    orphanAnnotations: [],
  };

  const addRelation = relation => {
    invariant(selectedIds.has(relation.from), `Relation source outside projection: ${relation.from}`);
    invariant(selectedIds.has(relation.to), `Relation target outside projection: ${relation.to}`);
    const key = relationKey(relation.kind, relation.from, relation.to, relation.role);
    invariant(!relations.has(key), `Duplicate projected relation: ${key}`);
    relations.set(key, relation);
    return relation;
  };

  // Primary parent authority: explicit curated father/mother fields.
  for (const child of v1.persons) {
    const childOut = selectedByV1.get(child.id);
    for (const [field, role] of [['father', 'father'], ['mother', 'mother']]) {
      const parentId = child[field];
      if (!parentId) continue;
      if (!selectedByV1.has(parentId)) {
        pushOmission(diagnostics.externalRefs, {
          sourceV1Id: child.id,
          field,
          targetV1Id: parentId,
          reason: 'outside-curated-subset',
        });
        continue;
      }
      const parentOut = selectedByV1.get(parentId);
      addRelation({
        kind: 'parent',
        from: parentOut.id,
        to: childOut.id,
        role,
        authority: 'curated-v1-explicit-field',
        source: { childV1Id: child.id, field },
        evidence: curatedRelationEvidence(),
      });
    }
  }

  // Secondary parent authority: curated children[] can fill a missing same-role
  // field, but can never override a conflicting explicit father/mother value.
  for (const parent of v1.persons) {
    const parentOut = selectedByV1.get(parent.id);
    const role = parent.gender === 'm' ? 'father' : parent.gender === 'f' ? 'mother' : 'parent';
    for (const childId of parent.children ?? []) {
      if (!selectedByV1.has(childId)) {
        pushOmission(diagnostics.externalRefs, {
          sourceV1Id: parent.id,
          field: 'children',
          targetV1Id: childId,
          reason: 'outside-curated-subset',
        });
        continue;
      }
      const child = v1ById.get(childId);
      const childOut = selectedByV1.get(childId);
      const explicitKey = relationKey('parent', parentOut.id, childOut.id, role);
      if (relations.has(explicitKey)) continue;

      const roleField = role === 'father' ? 'father' : role === 'mother' ? 'mother' : null;
      if (roleField && child?.[roleField] && child[roleField] !== parent.id) {
        diagnostics.childIndexConflicts.push({
          parentV1Id: parent.id,
          childV1Id: childId,
          role,
          explicitV1Id: child[roleField],
          action: 'omitted',
        });
        continue;
      }

      addRelation({
        kind: 'parent',
        from: parentOut.id,
        to: childOut.id,
        role,
        authority: 'curated-v1-children-index',
        source: { parentV1Id: parent.id, field: 'children' },
        evidence: curatedRelationEvidence(),
      });
    }
  }

  // Spouse is emitted only when curated v1 asserts it in both directions.
  const spousePairs = new Set();
  for (const person of v1.persons) {
    for (const spouseId of person.spouse ?? []) {
      if (!selectedByV1.has(spouseId)) {
        pushOmission(diagnostics.externalRefs, {
          sourceV1Id: person.id,
          field: 'spouse',
          targetV1Id: spouseId,
          reason: 'outside-curated-subset',
        });
        continue;
      }
      const spouse = v1ById.get(spouseId);
      if (!(spouse?.spouse ?? []).includes(person.id)) {
        diagnostics.asymmetricSpouses.push({
          leftV1Id: person.id,
          rightV1Id: spouseId,
          action: 'omitted',
        });
        continue;
      }

      const pair = [person.id, spouseId].sort();
      const pairKey = pair.join('~');
      if (spousePairs.has(pairKey)) continue;
      spousePairs.add(pairKey);
      addRelation({
        kind: 'spouse',
        from: selectedByV1.get(pair[0]).id,
        to: selectedByV1.get(pair[1]).id,
        authority: 'curated-v1-reciprocal-spouse',
        source: { v1Ids: pair },
        evidence: curatedRelationEvidence(),
      });
    }
  }

  // Editorial truth-model annotations may qualify an existing relation or add
  // a distinct non-biological/legal relation. They never rewrite biology.
  for (const annotation of edgeAnnotations.annotations) {
    if (!selectedIds.has(annotation.from) || !selectedIds.has(annotation.to)) {
      diagnostics.orphanAnnotations.push({
        from: annotation.from,
        to: annotation.to,
        kind: annotation.kind,
        reason: 'endpoint-outside-projection',
      });
      continue;
    }

    if (annotation.kind === 'parent' &&
        annotation.set?.legal === true &&
        annotation.set?.biology === 'non-biological') {
      addRelation({
        kind: 'legal-parent',
        from: annotation.from,
        to: annotation.to,
        role: 'legal-father',
        authority: 'explicit-qualified-textual-annotation',
        evidence: qualifiedRelationEvidence(annotation.set),
        note: annotation.note ?? null,
      });
      continue;
    }

    const candidates = [...relations.values()].filter(relation =>
      relation.kind === annotation.kind &&
      relation.from === annotation.from &&
      relation.to === annotation.to
    );
    if (candidates.length === 1) {
      candidates[0].evidence = qualifiedRelationEvidence(annotation.set);
      candidates[0].note = annotation.note ?? null;
    } else {
      diagnostics.orphanAnnotations.push({
        from: annotation.from,
        to: annotation.to,
        kind: annotation.kind,
        reason: candidates.length === 0 ? 'no-projected-relation' : 'ambiguous-projected-relation',
      });
    }
  }

  const projectedGospels = {
    schemaVersion: gospelSequences.schemaVersion,
    authority: gospelSequences.authority,
    sourcePath: gospelSequences.sourcePath,
    translation: gospelSequences.translation,
    scope: gospelSequences.scope ?? null,
    sequences: gospelSequences.sequences.map(sequence => ({
      ...sequence,
      occurrences: sequence.occurrences.map(occurrence => {
        invariant(selectedIds.has(occurrence.personId),
          `Gospel occurrence outside curated projection: ${sequence.id}:${occurrence.occurrenceId}`);
        return { ...occurrence };
      }),
    })),
  };

  const luke = projectedGospels.sequences.find(sequence => sequence.id === 'luke');
  invariant(!luke?.occurrences.some(occurrence => occurrence.sourcePersonId === 'mary'),
    'Luke textual sequence must not insert Mary');

  const relationList = [...relations.values()].sort((a, b) =>
    compareText(a.kind, b.kind) ||
    compareText(a.from, b.from) ||
    compareText(a.to, b.to) ||
    compareText(String(a.role ?? ''), String(b.role ?? ''))
  );

  const textualAssertions = buildTextualAssertions({
    gospelSequences: projectedGospels,
    relations: relationList,
  });
  const textualAssertionList = textualAssertions.assertions;

  const meta = {
    schemaVersion: 1,
    status: 'curated-subset-release-candidate',
    scope: {
      type: 'closed-curated-subset',
      curatedPersons: selected.length,
      rawPersons: persons.length,
      excludesRawOnlyIdentities: true,
      excludesRawOnlyRelations: true,
      completeness: 'partial-by-design',
    },
    rawCorpusStatus: rawMeta?.status ?? null,
    rawPipelineVersion: rawMeta?.pipelineVersion ?? null,
    policy: {
      identities: 'all curated v1 persons mapped 1:1 to v2 TIPNR identities; ru.review must be false',
      parents: 'explicit father/mother first; children[] supplements only missing non-conflicting same-role links',
      spouses: 'reciprocal curated v1 assertions only',
      annotations: 'qualify projected relations; legal/non-biological relation remains distinct from biological parent',
      relationEvidence: 'curated topology remains source-derived with directScripture=null until relation-level refs are editorially reviewed',
      textualAssertions: 'Gospel occurrence adjacency is text-only; it never creates or upgrades a family relation',
      rawGraph: 'TIPNR-only persons and raw TIPNR-only edges are excluded',
    },
    counts: {
      persons: selected.length,
      relations: relationList.length,
      parentRelations: relationList.filter(relation => relation.kind === 'parent').length,
      spouseRelations: relationList.filter(relation => relation.kind === 'spouse').length,
      legalParentRelations: relationList.filter(relation => relation.kind === 'legal-parent').length,
      relationEvidenceReviewed: relationList.filter(relation => relation.evidence?.refsStatus === 'editorially-reviewed').length,
      relationEvidencePending: relationList.filter(relation => relation.evidence?.refsStatus === 'relation-level-review-pending').length,
      directScriptureRelations: relationList.filter(relation => relation.evidence?.directScripture === true).length,
      gospelSequences: projectedGospels.sequences.length,
      gospelOccurrences: projectedGospels.sequences.reduce((sum, sequence) => sum + sequence.occurrences.length, 0),
      textualAssertions: textualAssertionList.length,
      textualAssertionsMatchedRelations: textualAssertionList.filter(assertion =>
        assertion.relationCrosswalk.status === 'matched-publishable-relation').length,
      textualAssertionsWithoutRelations: textualAssertionList.filter(assertion =>
        assertion.relationCrosswalk.status === 'no-publishable-relation').length,
      textualAssertionsReviewedCrosswalks: textualAssertionList.filter(assertion =>
        assertion.relationCrosswalk.evidenceStatus === 'editorially-reviewed').length,
    },
    sourceHashes,
    diagnostics,
  };

  return {
    meta,
    persons: selected,
    relations: relationList,
    gospelSequences: projectedGospels,
    textualAssertions,
  };
}
