#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  adaptPublishableGenealogy,
  adaptPublishableRelationEvidence,
  PUBLISHABLE_RUNTIME_POLICY,
} from '../src/components/genealogy/publishableAdapter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const fail = message => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };

const legacy = readJson('data/genealogy/genealogy.json');
const publishablePersons = readJson('data/genealogy/v2/publishable/persons.json');
const relations = readJson('data/genealogy/v2/publishable/relations.json');
const textualAssertions = readJson('data/genealogy/v2/publishable/textual-assertions.json');

assert(publishablePersons.find(person => person.v1Id === 'joram')?.id === 'jehoram--1ki-22-50',
  'Published Matthew Joram must identify the king of Judah, not the king of Israel');
assert(publishablePersons.find(person => person.v1Id === 'abihud_mt')?.id === 'abiud--mat-1-13',
  'Published Matthew Abiud must not identify the Benjaminite Abihud');

const adapted = adaptPublishableGenealogy({
  persons: publishablePersons,
  relations,
});

assert(adapted.length === legacy.persons.length,
  `Runtime person count drift: ${adapted.length}/${legacy.persons.length}`);

const byId = new Map(adapted.map(person => [person.id, person]));
assert(byId.size === adapted.length, 'Duplicate runtime person ids after publishable adaptation');

const stable = value => JSON.stringify(value ?? null);
const criticalFields = [
  'father',
  'mother',
  'chronology',
  'ref',
  'lineage',
  'significance',
  'era',
  'gender',
  'role',
  'disputed',
];
const criticalNameFields = ['ru', 'he', 'greek', 'birthName', 'altName'];
const parityDrift = [];

for (const source of legacy.persons) {
  const person = byId.get(source.id);
  if (!person) {
    parityDrift.push({ id: source.id, field: 'person', expected: 'present', actual: 'missing' });
    continue;
  }

  for (const field of criticalFields) {
    if (stable(source[field]) !== stable(person[field])) {
      parityDrift.push({
        id: source.id,
        field,
        expected: source[field] ?? null,
        actual: person[field] ?? null,
      });
    }
  }

  for (const field of criticalNameFields) {
    if (stable(source.name?.[field]) !== stable(person.name?.[field])) {
      parityDrift.push({
        id: source.id,
        field: `name.${field}`,
        expected: source.name?.[field] ?? null,
        actual: person.name?.[field] ?? null,
      });
    }
  }
}

assert(parityDrift.length === 0,
  `Publishable runtime parity drift: ${JSON.stringify(parityDrift.slice(0, 20))}`);

const adaptedIds = new Set(adapted.map(person => person.id));
for (const person of adapted) {
  for (const spouse of person.spouse ?? []) {
    assert(adaptedIds.has(spouse), `Runtime spouse escaped publishable subset: ${person.id}->${spouse}`);
    const peer = byId.get(spouse);
    assert(peer?.spouse?.includes(person.id),
      `Runtime spouse relation is not reciprocal: ${person.id}<->${spouse}`);
  }
  for (const child of person.children ?? []) {
    assert(adaptedIds.has(child), `Runtime child escaped publishable subset: ${person.id}->${child}`);
    const childPerson = byId.get(child);
    assert(childPerson?.father === person.id || childPerson?.mother === person.id,
      `Runtime child index lacks materialized parent field: ${person.id}->${child}`);
  }
}

const authorityCounts = relations.reduce((out, relation) => {
  out[relation.authority] = (out[relation.authority] ?? 0) + 1;
  return out;
}, {});
assert(authorityCounts['curated-v1-explicit-field'] === 159,
  'Explicit curated parent authority count drift');
assert(authorityCounts['curated-v1-children-index'] === 12,
  'Evidence-only children-index relation count drift');
assert(authorityCounts['curated-v1-reciprocal-spouse'] === 9,
  'Reciprocal spouse relation count drift');
assert(authorityCounts['explicit-qualified-textual-annotation'] === 1,
  'Legal/textual annotation relation count drift');

const cain = byId.get('cain');
const jesus = byId.get('jesus');
const mary = byId.get('mary');
assert(cain?.mother === null,
  'children-index evidence leaked into current runtime topology (Cain mother)');
assert(jesus?.father === null && jesus?.mother === 'mary',
  'Jesus runtime topology must preserve non-biological/legal distinction');
assert(mary?.father === 'heli_lk' && mary?.disputed?.level === 'genealogical',
  'Mary/Heli harmonization must remain explicit and disputed in current runtime');

assert(PUBLISHABLE_RUNTIME_POLICY.materializedParentAuthorities.length === 1 &&
  PUBLISHABLE_RUNTIME_POLICY.materializedParentAuthorities[0] === 'curated-v1-explicit-field',
'Runtime parent policy unexpectedly broadened');

const runtimeRelations = adaptPublishableRelationEvidence({
  persons: publishablePersons,
  relations,
  textualAssertions,
});
assert(runtimeRelations.length === relations.length,
  `Runtime relation evidence count drift: ${runtimeRelations.length}/${relations.length}`);

const josephJesus = runtimeRelations.find(relation =>
  relation.kind === 'legal-parent' && relation.from === 'joseph_nt' && relation.to === 'jesus');
assert(josephJesus, 'Joseph→Jesus runtime legal relation missing');
assert(josephJesus.evidence.directScripture === true &&
  josephJesus.evidence.biology === 'non-biological',
'Joseph→Jesus runtime evidence lost direct/non-biological qualification');
assert(josephJesus.textualAssertions.length === 2,
  'Joseph→Jesus should retain both Matthew and Luke textual adjacencies');

const heliMary = runtimeRelations.find(relation =>
  relation.kind === 'parent' && relation.from === 'heli_lk' && relation.to === 'mary');
assert(heliMary, 'Heli→Mary runtime relation evidence missing');
assert(heliMary.evidence.assertion === 'editorial-harmonization' &&
  heliMary.evidence.directScripture === false &&
  heliMary.evidence.confidence === 'disputed',
'Heli→Mary runtime evidence lost harmonization/disputed qualification');
assert(heliMary.textualAssertions.length === 0,
  'Heli→Mary must not gain a Gospel textual adjacency');

const abrahamIsaac = runtimeRelations.find(relation =>
  relation.kind === 'parent' && relation.from === 'abram' && relation.to === 'isaac');
assert(abrahamIsaac, 'Abraham->Isaac runtime relation evidence missing');
assert(abrahamIsaac.evidence.refsStatus === 'editorially-reviewed' &&
  abrahamIsaac.evidence.directScripture === true &&
  abrahamIsaac.evidence.assertion === 'explicit-genealogical-text',
'Abraham->Isaac must expose the certified Matthew genealogical-text evidence');
assert(abrahamIsaac.textualAssertions.length >= 1,
  'Abraham->Isaac should expose Gospel textual adjacency context');

// Keep a real pending relation as the fail-closed runtime witness. Adam->Seth
// has Gospel adjacency context, but no relation-level annotation has qualified
// that adjacency as direct family evidence.
const adamSeth = runtimeRelations.find(relation =>
  relation.kind === 'parent' && relation.from === 'adam' && relation.to === 'seth');
assert(adamSeth, 'Adam->Seth runtime relation evidence missing');
assert(adamSeth.evidence.refsStatus === 'relation-level-review-pending' &&
  adamSeth.evidence.directScripture === null,
'Pending Adam->Seth evidence was over-promoted');
assert(adamSeth.textualAssertions.length >= 1,
  'Adam->Seth should retain Gospel textual adjacency context without treating adjacency as proof');

console.log(JSON.stringify({
  status: 'genealogy-publishable-runtime-parity-ok',
  persons: adapted.length,
  materializedParentRelations: authorityCounts['curated-v1-explicit-field'],
  evidenceOnlyParentRelations: authorityCounts['curated-v1-children-index'],
  reciprocalSpouseRelations: authorityCounts['curated-v1-reciprocal-spouse'],
  nonTopologicalLegalRelations: authorityCounts['explicit-qualified-textual-annotation'],
  runtimeRelationEvidence: runtimeRelations.length,
  josephJesusTextualAssertions: josephJesus.textualAssertions.length,
  abrahamIsaacTextualAssertions: abrahamIsaac.textualAssertions.length,
  adamSethTextualAssertions: adamSeth.textualAssertions.length,
}, null, 2));
