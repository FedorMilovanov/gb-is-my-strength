#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V1 = path.join(ROOT, 'data', 'genealogy', 'genealogy.json');
const OUT = path.join(ROOT, 'data', 'genealogy', 'v2', 'publishable');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = message => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };

const v1 = readJson(V1);
const meta = readJson(path.join(OUT, 'meta.json'));
const persons = readJson(path.join(OUT, 'persons.json'));
const relations = readJson(path.join(OUT, 'relations.json'));
const gospels = readJson(path.join(OUT, 'gospel-sequences.json'));

assert(meta.schemaVersion === 1, 'Unexpected publishable meta schema');
assert(meta.status === 'curated-release-candidate', 'Publishable projection must remain an explicit release candidate');
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
for (const relation of relations) {
  assert(ids.has(relation.from) && ids.has(relation.to),
    `Relation endpoint escaped curated projection: ${relation.kind}:${relation.from}->${relation.to}`);
  assert(allowedAuthorities.has(relation.authority),
    `Unapproved relation authority: ${relation.authority}`);
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

const counts = {
  persons: persons.length,
  relations: relations.length,
  parents: relations.filter(relation => relation.kind === 'parent').length,
  spouses: relations.filter(relation => relation.kind === 'spouse').length,
  legalParents: relations.filter(relation => relation.kind === 'legal-parent').length,
  externalRefsOmitted: meta.diagnostics?.externalRefs?.length ?? 0,
  childIndexConflictsOmitted: meta.diagnostics?.childIndexConflicts?.length ?? 0,
  asymmetricSpousesOmitted: meta.diagnostics?.asymmetricSpouses?.length ?? 0,
  orphanAnnotations: meta.diagnostics?.orphanAnnotations?.length ?? 0,
};

assert(meta.counts?.persons === counts.persons, 'meta person count drift');
assert(meta.counts?.relations === counts.relations, 'meta relation count drift');
assert(counts.orphanAnnotations === 0, 'Truth-model annotation could not be attached to curated projection');

console.log(JSON.stringify({ status: 'publishable-projection-ok', counts }, null, 2));
