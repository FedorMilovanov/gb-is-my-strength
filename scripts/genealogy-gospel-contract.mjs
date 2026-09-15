#!/usr/bin/env node
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { getGospelComparison, gospelSource } from '../src/components/genealogy/gospelSequences.ts';
import { readGenealogyRuntimePersons } from './genealogy-runtime-fixture.mjs';

// Editorial acceptance fixtures, transcribed against the named Synodal passages.
// They intentionally do not use parent traversal or generated group membership.
const MATTHEW_NAMES = 'Авраам|Исаак|Иаков|Иуда|Фарес|Есром|Арам|Аминадав|Наассон|Салмон|Вооз|Овид|Иессей|Давид|Соломон|Ровоам|Авия|Аса|Иосафат|Иорам|Озия|Иоафам|Ахаз|Езекия|Манассия|Амон|Иосия|Иоаким|Иехония|Салафииль|Зоровавель|Авиуд|Елиаким|Азор|Садок|Ахим|Елиуд|Елеазар|Матфан|Иаков|Иосиф|Иисус Христос'.split('|');
const LUKE_FORMS = 'Иисус|Иосифов|Илиев|Матфатов|Левиин|Мелхиев|Ианнаев|Иосифов|Маттафиев|Амосов|Наумов|Еслимов|Наггеев|Маафов|Маттафиев|Семеиев|Иосифов|Иудин|Иоаннанов|Рисаев|Зоровавелев|Салафиилев|Нириев|Мелхиев|Аддиев|Косамов|Елмодамов|Иров|Иосиев|Елиезеров|Иоримов|Матфатов|Левиин|Симеонов|Иудин|Иосифов|Ионанов|Елиакимов|Мелеаев|Маинанов|Маттафаев|Нафанов|Давидов|Иессеев|Овидов|Воозов|Салмонов|Наассонов|Аминадавов|Арамов|Есромов|Фаресов|Иудин|Иаковлев|Исааков|Авраамов|Фаррин|Нахоров|Серухов|Рагавов|Фалеков|Еверов|Салин|Каинанов|Арфаксадов|Симов|Ноев|Ламехов|Мафусалов|Енохов|Иаредов|Малелеилов|Каинанов|Еносов|Сифов|Адамов'.split('|');

export function assertGospelContract() {
  const persons = readGenealogyRuntimePersons();
  const byId = new Map(persons.map(person => [person.id, person]));
  const [matthew, luke] = gospelSource.sequences;
  assert.equal(gospelSource.translation, 'Синодальный перевод');
  assert.deepEqual(gospelSource.sequences.map(line => line.id), ['matthew', 'luke']);
  assert.deepEqual(matthew.entries.map(entry => entry.name), MATTHEW_NAMES, 'Matthew names/order differ from the Synodal edition');
  assert.deepEqual(luke.entries.map(entry => entry.sourceForm), LUKE_FORMS, 'Luke source forms/order differ from Luke 3:23–38');
  assert.equal(luke.entries.length, 76, 'God is not an extra human person');
  assert.equal(new Set(persons.map(person => person.id)).size, persons.length);

  for (const line of gospelSource.sequences) {
    assert.equal(new Set(line.entries.map(entry => entry.id)).size, line.entries.length);
    for (const entry of line.entries) {
      assert.ok(byId.has(entry.personId), `Unresolved occurrence ${entry.id}`);
      assert.match(entry.ref, line.id === 'matthew' ? /^Мф 1:(?:[2-9]|1[0-6])$/ : /^Лк 3:(?:2[3-9]|3[0-8])$/);
    }
  }
  assert.deepEqual(luke.entries.slice(0, 8).map(entry => entry.personId),
    ['jesus', 'joseph_nt', 'heli_lk', 'matthat_lk2', 'levi_lk2', 'melchi_lk2', 'jannai_lk', 'joseph_lk2']);
  assert.ok(!luke.entries.some(entry => entry.personId === 'mary'));
  assert.equal(byId.get('jesus').father, null, 'Text occurrences must not manufacture biological paternity for Jesus');
  for (const id of ['simeon_lk2', 'judah_lk2', 'joseph_lk3']) {
    assert.ok(!byId.has(id), `Unattested duplicate node remains: ${id}`);
    assert.ok(!persons.some(person => [person.father, person.mother, ...(person.children || [])].includes(id)));
  }

  const repairedMatthew = ['zerubbabel', 'abihud_mt', 'eliakim_mt', 'azor_mt', 'zadok_mt', 'achim_mt', 'eliud_mt', 'eleazar_mt', 'matthan_mt', 'jacob_mt', 'joseph_nt'];
  const repairedLuke = ['levi_lk2', 'matthat_lk2', 'heli_lk'];
  for (const chain of [repairedMatthew, repairedLuke]) {
    chain.slice(1).forEach((id, index) => {
      assert.equal(byId.get(id).father, chain[index], `Broken parent link for ${id}`);
      assert.ok(byId.get(chain[index]).children.includes(id), `Broken child link for ${id}`);
    });
  }
  // Verify all Luke segment links between Heli and David, including homonyms.
  const heliToDavid = luke.entries.slice(2, luke.entries.findIndex(entry => entry.personId === 'david') + 1);
  heliToDavid.slice(0, -1).forEach((entry, index) => {
    assert.equal(byId.get(entry.personId).father, heliToDavid[index + 1].personId, `Luke parent order: ${entry.ref}`);
  });
  assert.notEqual(luke.entries.find(entry => entry.ref === 'Лк 3:24' && entry.name === 'Матфат').personId,
    luke.entries.find(entry => entry.ref === 'Лк 3:29' && entry.name === 'Матфат').personId);
  assert.notEqual(luke.entries.find(entry => entry.name === 'Зоровавель').personId,
    matthew.entries.find(entry => entry.name === 'Зоровавель').personId,
    'A disputed identity must not be merged by matching names');

  const partial = getGospelComparison(persons, 'david');
  assert.deepEqual(partial.lines.map(line => line.entries.length), [29, 43]);
  assert.deepEqual(partial.lines.map(line => line.entries.slice(0, 2).map(entry => entry.personId)),
    [['david', 'solomon'], ['david', 'nathan_prince']]);
  assert.deepEqual([...partial.sharedIds].sort(), ['david', 'jesus', 'joseph_nt']);
  const full = getGospelComparison(persons, 'full');
  assert.deepEqual(full.lines.map(line => line.entries.length), [42, 76]);
  assert.deepEqual(full.lines.map(line => line.entries[0].personId), ['abram', 'adam']);
  assert.deepEqual(full.lines.map(line => line.entries.at(-1).personId), ['jesus', 'jesus']);
  const withoutParentGraph = persons.map(person => ({ ...person, father: null, mother: null, children: [], lineage: 'neutral' }));
  assert.deepEqual(getGospelComparison(withoutParentGraph, 'full').lines, full.lines, 'Comparison depends on an interpretation graph');
  assert.throws(() => getGospelComparison(persons.filter(person => person.id !== 'solomon'), 'full'), /Invalid gospel occurrence/,
    'Missing people must not silently disappear from the comparison');
  return { persons: persons.length, matthew: matthew.entries.length, luke: luke.entries.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Genealogy gospel contract: PASS', assertGospelContract());
}
