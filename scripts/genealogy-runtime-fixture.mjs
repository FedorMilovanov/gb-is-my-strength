import fs from 'node:fs';
import { adaptPublishableGenealogy } from '../src/components/genealogy/publishableAdapter.mjs';

const readJson = url => JSON.parse(fs.readFileSync(url, 'utf8'));

export function readGenealogyRuntimePersons() {
  const persons = readJson(new URL('../data/genealogy/v2/publishable/persons.json', import.meta.url));
  const relations = readJson(new URL('../data/genealogy/v2/publishable/relations.json', import.meta.url));
  return adaptPublishableGenealogy({ persons, relations });
}
