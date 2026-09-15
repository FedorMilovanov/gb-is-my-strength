#!/usr/bin/env node
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V1 = path.join(ROOT, 'data', 'genealogy', 'genealogy.json');
const V2 = path.join(ROOT, 'data', 'genealogy', 'v2');
const OUT = path.join(V2, 'publishable');
const readText = file => fs.readFileSync(file, 'utf8');
const readJson = file => JSON.parse(readText(file));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };

const expectedProjectionFiles = new Set([
  'gospel-sequences.json',
  'meta.json',
  'persons.json',
  'relations.json',
  'textual-assertions.json',
]);
const actualProjectionFiles = fs.readdirSync(OUT, { withFileTypes: true });
assert(actualProjectionFiles.every(entry => entry.isFile()),
  'Publishable projection must not contain nested or non-file entries');
const actualProjectionNames = actualProjectionFiles.map(entry => entry.name).sort();
assert(actualProjectionNames.length === expectedProjectionFiles.size &&
  actualProjectionNames.every(name => expectedProjectionFiles.has(name)),
  `Unexpected publishable projection file set: ${actualProjectionNames.join(', ')}`);

const v1Raw = readText(V1);
const rawPersonsText = readText(path.join(V2, 'persons.json'));
const rawGospelText = readText(path.join(V2, 'gospel-sequences.json'));
const rawAnnotationsText = readText(path.join(V2, 'edge-annotations.json'));
const rawMetaText = readText(path.join(V2, 'meta.json'));
const v1 = JSON.parse(v1Raw);
const rawAnnotations = JSON.parse(rawAnnotationsText);
const rawMeta = JSON.parse(rawMetaText);
const meta = readJson(path.join(OUT, 'meta.json'));
const persons = readJson(path.join(OUT, 'persons.json'));
const relations = readJson(path.join(OUT, 'relations.json'));
const gospels = readJson(path.join(OUT, 'gospel-sequences.json'));
const textualAssertions = readJson(path.join(OUT, 'textual-assertions.json'));

const expectedSourceHashes = {
  curatedV1: sha256(v1Raw),
  v2Persons: sha256(rawPersonsText),
  v2GospelSequences: sha256(rawGospelText),
  v2EdgeAnnotations: sha256(rawAnnotationsText),
  v2Meta: sha256(rawMetaText),
};
assert(JSON.stringify(meta.sourceHashes) === JSON.stringify(expectedSourceHashes),
  `Publishable source provenance drift: ${JSON.stringify({ expected: expectedSourceHashes, actual: meta.sourceHashes })}`);
assert(meta.rawCorpusStatus === (rawMeta.status ?? null), 'Raw corpus status provenance drift');
assert(meta.rawPipelineVersion === (rawMeta.pipelineVersion ?? null), 'Raw pipeline version provenance drift');

assert(meta.schemaVersion === 1, 'Unexpected publishable meta schema');
assert(meta.status === 'curated-subset-release-candidate',
  'Publishable projection must remain an explicit curated-subset release candidate');
assert(meta.scope?.type === 'closed-curated-subset', 'Publishable scope type drift');
assert(meta.scope?.curatedPersons === v1.persons.length, 'Publishable scope curated-person count drift');
assert(meta.scope?.excludesRawOnlyIdentities === true, 'Publishable scope must exclude raw-only identities');
assert(meta.scope?.excludesRawOnlyRelations === true, 'Publishable scope must exclude raw-only relations');
assert(meta.scope?.completeness === 'partial-by-design', 'Publishable scope completeness marker drift');
assert(persons.length === v1.persons.length, `Publishable identity count drift: ${persons.length}/${v1.persons.length}`);

const ids = new Set();
const byV1 = new Map();
for (const person of persons) {
  assert(person.id && !ids.has(person.id), `Duplicate publishable person id: ${person.id}`);
  ids.add(person.id);
  assert(person.v1Id && !byV1.has(person.v1Id), `Duplicate curated v1 identity: ${person.v1Id}`);
  byV1.set(person.v1Id, person);
  assert(person.names?.ru, `Missing Russian label: ${person.v1Id}`);
  assert(person.identity?.authority === 'curated-v1-to-tipnr', `Wrong identity authority: ${person.v1Id}`);
  assert(person.identity?.russianLabelReview === false, `Unreviewed Russian label leaked into publishable projection: ${person.v1Id}`);
}

for (const source of v1.persons) {
  assert(byV1.has(source.id), `Curated v1 identity missing from projection: ${source.id}`);
}
assert(byV1.size === v1.persons.length, 'Publishable projection contains raw-only identity');

const relationKeys = new Set();
const allowedAuthorities = new Set([
  'curated-v1-explicit-field',
  'curated-v1-children-index',
  'curated-v1-reciprocal-spouse',
  'explicit-qualified-textual-annotation',
]);
const allowedEvidenceClasses = new Set([
  'curated-source-derived',
  'direct-scripture-qualified',
  'editorial-qualified',
]);
for (const relation of relations) {
  assert(ids.has(relation.from) && ids.has(relation.to),
    `Relation endpoint escaped curated projection: ${relation.kind}:${relation.from}->${relation.to}`);
  assert(allowedAuthorities.has(relation.authority),
    `Unapproved relation authority: ${relation.authority}`);
  assert(relation.evidence && allowedEvidenceClasses.has(relation.evidence.provenanceClass),
    `Missing/invalid relation evidence class: ${relation.kind}:${relation.from}->${relation.to}`);

  if (relation.evidence.refsStatus === 'relation-level-review-pending') {
    assert(relation.evidence.provenanceClass === 'curated-source-derived',
      'Pending relation evidence must remain curated-source-derived');
    assert(relation.evidence.assertion === 'source-derived',
      'Pending relation evidence must remain source-derived');
    assert(relation.evidence.directScripture === null,
      'Pending relation evidence must use directScripture=null, not guess true/false');
    assert(Array.isArray(relation.evidence.refs) && relation.evidence.refs.length === 0,
      'Pending relation evidence must not synthesize Scripture refs');
  } else if (relation.evidence.refsStatus === 'editorially-reviewed') {
    assert(typeof relation.evidence.directScripture === 'boolean',
      'Reviewed relation evidence requires explicit directScripture boolean');
    assert(Array.isArray(relation.evidence.refs) && relation.evidence.refs.length > 0,
      'Reviewed relation evidence requires explicit refs');
    assert(
      relation.evidence.provenanceClass ===
        (relation.evidence.directScripture ? 'direct-scripture-qualified' : 'editorial-qualified'),
      'Reviewed relation provenance class does not match directScripture classification',
    );
  } else {
    fail(`Unknown relation refsStatus: ${relation.evidence.refsStatus}`);
  }

  const key = `${relation.kind}:${relation.from}->${relation.to}:${relation.role ?? ''}`;
  assert(!relationKeys.has(key), `Duplicate publishable relation: ${key}`);
  relationKeys.add(key);
}

for (const conflict of meta.diagnostics?.childIndexConflicts ?? []) {
  assert(conflict.action === 'omitted', 'Conflicting children[] relation was not omitted');
}
for (const spouse of meta.diagnostics?.asymmetricSpouses ?? []) {
  assert(spouse.action === 'omitted', 'Asymmetric spouse assertion was not omitted');
}

const joseph = byV1.get('joseph_nt');
const jesus = byV1.get('jesus');
const heli = byV1.get('heli_lk');
const mary = byV1.get('mary');
assert(joseph && jesus && heli && mary, 'Incarnation truth-model anchors missing');

assert(!relations.some(relation =>
  relation.kind === 'parent' && relation.from === joseph.id && relation.to === jesus.id
), 'Joseph must never be emitted as biological/ordinary parent of Jesus');

const josephLegal = relations.find(relation =>
  relation.kind === 'legal-parent' && relation.from === joseph.id && relation.to === jesus.id
);
assert(josephLegal, 'Qualified Joseph→Jesus legal relation missing');
assert(josephLegal.evidence?.biology === 'non-biological', 'Joseph→Jesus legal relation lost non-biological qualifier');
assert(josephLegal.evidence?.directScripture === true, 'Joseph→Jesus textual evidence classification drifted');
assert(josephLegal.evidence?.assertion === 'explicit-qualified-textual',
  'Joseph→Jesus assertion classification drifted');

const heliMary = relations.find(relation =>
  relation.kind === 'parent' && relation.from === heli.id && relation.to === mary.id
);
assert(heliMary, 'Curated Heli→Mary harmonization relation missing');
assert(heliMary.evidence?.assertion === 'editorial-harmonization',
  'Heli→Mary must remain explicitly editorial/harmonized');
assert(heliMary.evidence?.directScripture === false,
  'Heli→Mary must never be represented as direct Scripture');
assert(heliMary.evidence?.confidence === 'disputed',
  'Heli→Mary disputed confidence marker missing');

for (const sequence of gospels.sequences ?? []) {
  for (const occurrence of sequence.occurrences ?? []) {
    assert(ids.has(occurrence.personId),
      `Gospel occurrence escaped curated projection: ${sequence.id}:${occurrence.occurrenceId}`);
  }
}
const luke = (gospels.sequences ?? []).find(sequence => sequence.id === 'luke');
assert(luke && !luke.occurrences.some(occurrence => occurrence.sourcePersonId === 'mary'),
  'Luke textual sequence improperly inserts Mary');

assert(textualAssertions.schemaVersion === 1, 'Unexpected textual assertion schema');
assert(textualAssertions.authority === 'explicit-gospel-occurrence-adjacency',
  'Textual assertion authority drift');
assert(textualAssertions.policy?.familyInference === 'forbidden',
  'Textual assertions must forbid family inference');

const gospelById = new Map((gospels.sequences ?? []).map(sequence => [sequence.id, sequence]));
const textualIds = new Set();
const unmatchedTextualIds = [];
let matchedTextualAssertions = 0;
let reviewedTextualCrosswalks = 0;

for (const assertion of textualAssertions.assertions ?? []) {
  assert(assertion.id && !textualIds.has(assertion.id),
    `Duplicate textual assertion id: ${assertion.id}`);
  textualIds.add(assertion.id);
  assert(assertion.assertion === 'textual-genealogy-adjacency',
    `Unexpected textual assertion class: ${assertion.id}`);
  assert(assertion.familyInference === 'none',
    `Textual assertion attempted family inference: ${assertion.id}`);

  const sequence = gospelById.get(assertion.sequenceId);
  assert(sequence, `Textual assertion references unknown Gospel sequence: ${assertion.id}`);
  const index = assertion.position - 1;
  assert(Number.isInteger(index) && index >= 0 && index < sequence.occurrences.length - 1,
    `Textual assertion position is outside sequence: ${assertion.id}`);

  const from = sequence.occurrences[index];
  const to = sequence.occurrences[index + 1];
  const expectedId = `${sequence.id}:${from.occurrenceId}->${to.occurrenceId}`;
  assert(assertion.id === expectedId, `Textual assertion id/order drift: ${assertion.id}`);
  assert(assertion.source?.fromOccurrenceId === from.occurrenceId &&
    assertion.source?.toOccurrenceId === to.occurrenceId,
  `Textual assertion occurrence crosswalk drift: ${assertion.id}`);
  assert(assertion.source?.fromRef === (from.ref ?? null) &&
    assertion.source?.toRef === (to.ref ?? null),
  `Textual assertion source refs drift: ${assertion.id}`);
  assert(assertion.fromPersonId === from.personId && assertion.toPersonId === to.personId,
    `Textual assertion identity crosswalk drift: ${assertion.id}`);

  const matches = relations.filter(relation =>
    (relation.from === assertion.fromPersonId && relation.to === assertion.toPersonId) ||
    (relation.from === assertion.toPersonId && relation.to === assertion.fromPersonId));
  assert(matches.length <= 1, `Ambiguous textual assertion relation crosswalk: ${assertion.id}`);

  const crosswalk = assertion.relationCrosswalk;
  assert(crosswalk, `Missing textual assertion relation crosswalk: ${assertion.id}`);
  if (matches.length === 0) {
    assert(crosswalk.status === 'no-publishable-relation' &&
      crosswalk.relationKey === null &&
      crosswalk.kind === null &&
      crosswalk.from === null &&
      crosswalk.to === null &&
      crosswalk.role === null &&
      crosswalk.authority === null &&
      crosswalk.evidenceStatus === null &&
      crosswalk.directScripture === null,
    `Unmatched textual assertion must stay relation-free: ${assertion.id}`);
    unmatchedTextualIds.push(assertion.id);
    continue;
  }

  const relation = matches[0];
  const expectedRelationKey =
    `${relation.kind}:${relation.from}->${relation.to}:${relation.role ?? ''}`;
  assert(crosswalk.status === 'matched-publishable-relation',
    `Matched textual assertion lost relation status: ${assertion.id}`);
  assert(crosswalk.relationKey === expectedRelationKey,
    `Textual assertion relation key drift: ${assertion.id}`);
  assert(crosswalk.kind === relation.kind &&
    crosswalk.from === relation.from &&
    crosswalk.to === relation.to &&
    crosswalk.role === (relation.role ?? null) &&
    crosswalk.authority === relation.authority,
  `Textual assertion relation locator drift: ${assertion.id}`);
  assert(crosswalk.evidenceStatus === (relation.evidence?.refsStatus ?? null) &&
    crosswalk.directScripture === (relation.evidence?.directScripture ?? null),
  `Textual assertion relation evidence crosswalk drift: ${assertion.id}`);
  matchedTextualAssertions += 1;
  if (crosswalk.evidenceStatus === 'editorially-reviewed') reviewedTextualCrosswalks += 1;
}

const expectedTextualAssertions = [...gospelById.values()].reduce((sum, sequence) =>
  sum + Math.max(0, (sequence.occurrences ?? []).length - 1), 0);
assert(textualIds.size === expectedTextualAssertions,
  `Textual assertion count drift: ${textualIds.size}/${expectedTextualAssertions}`);

const expectedUnmatchedTextualIds = [
  'luke:luke-3-23-2->luke-3-23-3',
  'luke:luke-3-35-5->luke-3-36-1',
];
assert(JSON.stringify(unmatchedTextualIds.sort()) === JSON.stringify(expectedUnmatchedTextualIds.sort()),
  `Unexpected no-relation Gospel adjacencies: ${JSON.stringify(unmatchedTextualIds)}`);

const counts = {
  persons: persons.length,
  relations: relations.length,
  parents: relations.filter(relation => relation.kind === 'parent').length,
  spouses: relations.filter(relation => relation.kind === 'spouse').length,
  legalParents: relations.filter(relation => relation.kind === 'legal-parent').length,
  relationEvidenceReviewed: relations.filter(relation =>
    relation.evidence?.refsStatus === 'editorially-reviewed').length,
  relationEvidencePending: relations.filter(relation =>
    relation.evidence?.refsStatus === 'relation-level-review-pending').length,
  directScriptureRelations: relations.filter(relation =>
    relation.evidence?.directScripture === true).length,
  textualAssertions: textualIds.size,
  textualAssertionsMatchedRelations: matchedTextualAssertions,
  textualAssertionsWithoutRelations: unmatchedTextualIds.length,
  textualAssertionsReviewedCrosswalks: reviewedTextualCrosswalks,
  externalRefsOmitted: meta.diagnostics?.externalRefs?.length ?? 0,
  childIndexConflictsOmitted: meta.diagnostics?.childIndexConflicts?.length ?? 0,
  asymmetricSpousesOmitted: meta.diagnostics?.asymmetricSpouses?.length ?? 0,
  orphanAnnotations: meta.diagnostics?.orphanAnnotations?.length ?? 0,
};

assert(meta.counts?.persons === counts.persons, 'meta person count drift');
assert(meta.counts?.relations === counts.relations, 'meta relation count drift');
assert(meta.counts?.parentRelations === counts.parents, 'meta parent relation count drift');
assert(meta.counts?.spouseRelations === counts.spouses, 'meta spouse relation count drift');
assert(meta.counts?.legalParentRelations === counts.legalParents, 'meta legal-parent count drift');
assert(meta.counts?.relationEvidenceReviewed === counts.relationEvidenceReviewed,
  'meta reviewed relation-evidence count drift');
assert(meta.counts?.relationEvidencePending === counts.relationEvidencePending,
  'meta pending relation-evidence count drift');
assert(meta.counts?.directScriptureRelations === counts.directScriptureRelations,
  'meta direct-Scripture relation count drift');
assert(meta.counts?.textualAssertions === counts.textualAssertions,
  'meta textual assertion count drift');
assert(meta.counts?.textualAssertionsMatchedRelations === counts.textualAssertionsMatchedRelations,
  'meta matched textual assertion count drift');
assert(meta.counts?.textualAssertionsWithoutRelations === counts.textualAssertionsWithoutRelations,
  'meta unmatched textual assertion count drift');
assert(meta.counts?.textualAssertionsReviewedCrosswalks === counts.textualAssertionsReviewedCrosswalks,
  'meta reviewed textual crosswalk count drift');
assert(counts.relationEvidenceReviewed === (rawAnnotations.annotations ?? []).length,
  'Every editorial edge annotation must correspond to one reviewed publishable relation');
assert(counts.relationEvidencePending + counts.relationEvidenceReviewed === counts.relations,
  'Every publishable relation must be explicitly pending or editorially reviewed');
assert(counts.directScriptureRelations === (rawAnnotations.annotations ?? [])
  .filter(annotation => annotation.set?.directScripture === true).length,
  'Direct-Scripture relation count must match reviewed annotations');
assert(meta.counts?.gospelSequences === (gospels.sequences ?? []).length, 'meta Gospel sequence count drift');
assert(meta.counts?.gospelOccurrences === (gospels.sequences ?? []).reduce((sum, sequence) =>
  sum + (sequence.occurrences ?? []).length, 0), 'meta Gospel occurrence count drift');
assert(counts.orphanAnnotations === 0, 'Truth-model annotation could not be attached to curated projection');

console.log(JSON.stringify({ status: 'publishable-projection-ok', counts }, null, 2));
