#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { computeFocusLineage, matchesLineage } from '../src/components/genealogy/focusGraph.ts';

export function assertGenealogyFocusContract() {
  const person = (id, father = null, mother = null, children = []) => ({ id, name: { ru: id }, father, mother, children, lineage: 'neutral' });
  const family = [person('grandfather'), person('grandmother'), person('father', 'grandfather'),
    person('mother', null, 'grandmother', ['unrelated']), person('child', 'father', 'mother'),
    person('sibling', 'father', 'mother'), person('grandchild', 'child'), person('unrelated')];
  assert.deepEqual([...computeFocusLineage(family, 'child')].sort(),
    ['child', 'father', 'grandchild', 'grandfather', 'grandmother', 'mother']);
  assert.deepEqual([...computeFocusLineage(family, 'mother')].sort(),
    ['child', 'grandchild', 'grandmother', 'mother', 'sibling'], 'Descendants must follow rendered parent edges, not stale children arrays');
  assert.equal(computeFocusLineage(family, 'unknown').size, 0);
  assert.deepEqual([...computeFocusLineage([person('a', 'b'), person('b', 'a')], 'a')].sort(), ['a', 'b']);
  assert.deepEqual([...computeFocusLineage([person('a', 'missing')], 'a')], ['a']);

  const data = JSON.parse(fs.readFileSync(new URL('../data/genealogy/genealogy.json', import.meta.url), 'utf8'));
  const isaac = computeFocusLineage(data.persons, 'isaac');
  assert.ok(isaac.has('abram'), 'Isaac must retain Abraham');
  assert.ok(isaac.has('sarah'), 'Isaac must retain Sarah');
  const sarah = computeFocusLineage(data.persons, 'sarah');
  assert.ok(sarah.has('isaac') && sarah.has('jacob'), 'Maternal descendants are missing');
  const isaacPerson = data.persons.find(person => person.id === 'isaac');
  assert.equal(matchesLineage(isaacPerson, 'all'), true);
  assert.equal(matchesLineage(isaacPerson, 'messianic'), true);
  assert.equal(matchesLineage(isaacPerson, 'cainite'), false);
  assert.equal(matchesLineage({ ...isaacPerson, lineage: 'messianic-luke' }, 'messianic'), true);
  return { isaacAncestorsAndDescendants: isaac.size, sarahAncestorsAndDescendants: sarah.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Genealogy focus contract: PASS', assertGenealogyFocusContract());
}
