#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TERMS_PATH = path.join(ROOT, 'js/vosk-custom-terms.json');
const ENGINE_PATH = path.join(ROOT, 'js/vosk-tts-engine.js');
const WORKER_PATH = path.join(ROOT, 'js/vosk-tts-worker.js');
const MARKER_PATH = path.join(ROOT, 'js/vosk-stress-marker.bin');
const LOOKUP_PATH = path.join(ROOT, 'js/vosk-stress-lookup.js');
const terms = JSON.parse(fs.readFileSync(TERMS_PATH, 'utf8'));
const engine = fs.readFileSync(ENGINE_PATH, 'utf8');
const worker = fs.readFileSync(WORKER_PATH, 'utf8');
delete terms._comment;

const vowels = new Set('аеёиоуыэюя');
const problems = [];

for (const [word, marked] of Object.entries(terms)) {
  if (word !== word.toLowerCase()) problems.push(`${word}: key must be lowercase`);
  if (!/^[а-яё]+$/.test(word)) problems.push(`${word}: key contains a non-Cyrillic character`);
  if (typeof marked !== 'string') {
    problems.push(`${word}: value must be a string`);
    continue;
  }
  const plusCount = (marked.match(/\+/g) || []).length;
  if (plusCount !== 1) problems.push(`${word}: expected exactly one primary stress marker, got ${plusCount}`);
  if (marked.replace('+', '') !== word) problems.push(`${word}: removing the marker does not reproduce the key`);
  const plusIndex = marked.indexOf('+');
  const stressed = marked[plusIndex + 1];
  if (!vowels.has(stressed)) problems.push(`${word}: marker is not immediately before a vowel`);
}

const forbiddenHomographs = ['господа'];
for (const word of forbiddenHomographs) {
  if (Object.prototype.hasOwnProperty.call(terms, word)) {
    problems.push(`${word}: context-dependent homograph must not live in the unconditional dictionary`);
  }
}

const normative = {
  мария: 'мар+ия',
  марии: 'мар+ии',
  бенджамин: 'б+енджамин',
  бенджамина: 'б+енджамина',
};
for (const [word, expected] of Object.entries(normative)) {
  if (terms[word] !== expected) problems.push(`${word}: expected ${expected}, got ${terms[word] || '<missing>'}`);
}

if (!/function normalizeContextText\(/.test(engine)) {
  problems.push('engine: case-sensitive context normalization layer is missing');
}
if (!/Господа[\s\S]{0,80}Г\+оспода/.test(engine)) {
  problems.push('engine: divine Господа is not normalized to Г+оспода');
}
if (!/text:\s*normalizeContextText\(String\(text \|\| ''\)\)/.test(engine)) {
  problems.push('engine: context normalization is not applied before worker synthesis');
}


/* ============ spoken vocabulary: citations + theological terms ============ */

const { StressLookup } = require(LOOKUP_PATH);
const markerBuffer = fs.readFileSync(MARKER_PATH);
// Marker layer only: the custom dictionary is passed explicitly to the checks
// below, so a mutation that drops an entry cannot be masked by the same entry.
const markerOnlyLookup = new StressLookup({
  customTerms: new Map(),
  markerDictBuffer: markerBuffer.buffer.slice(markerBuffer.byteOffset, markerBuffer.byteOffset + markerBuffer.byteLength),
});

// Stress of these book names is disputed in Russian usage, so an unstressed
// form is deliberately preferred over a wrong one. Remove an entry from this
// list only together with a source that settles the stress.
const STRESS_PENDING = new Map([
  ['авдия', 'Авдий/Авдия — традиция двоится'],
  ['захарии', 'Захария/Захария — традиция двоится'],
  ['малахии', 'Малахия/Малахия — традиция двоится'],
]);

const DOMAIN_STEMS = [
  'христоцентрич', 'христоцентризм', 'христологич', 'христотелич',
  'сотериологич', 'экклезиологич', 'тринитар', 'импликац', 'эйзегез', 'межтекстуальн',
];

function vowelCount(word) {
  return (word.match(/[аеёиоуыэюя]/g) || []).length;
}

function parseWordTable(source, name) {
  const start = source.indexOf(`var ${name} = [`);
  if (start < 0) return null;
  const end = source.indexOf('];', start);
  if (end < 0) return null;
  const block = source.slice(start, end);
  return [...block.matchAll(/\['([^']+)',\s*'([^']+)'\]/g)].map((match) => [match[1], match[2]]);
}

function buildExpander(source) {
  const start = source.indexOf('var SCRIPTURE_BOOKS');
  const end = source.indexOf('function synthChunk');
  if (start < 0 || end < 0) return null;
  try {
    // eslint-disable-next-line no-new-func
    return new Function(`${source.slice(start, end)}\nreturn expandSiteAbbreviations;`)();
  } catch (_) {
    return null;
  }
}

const CONTENT_ROOTS = ['src/content', 'src/components'].map((relative) => path.join(ROOT, relative));

function collectContentFiles(directory, out) {
  if (!fs.existsSync(directory)) return out;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) collectContentFiles(full, out);
    else if (/\.(mdx|astro)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function validateVocabulary(workerSource, termMap, files) {
  const issues = [];
  const books = parseWordTable(workerSource, 'SCRIPTURE_BOOKS');
  const units = parseWordTable(workerSource, 'CITATION_UNITS');
  if (!books || !books.length) {
    issues.push('worker: SCRIPTURE_BOOKS table is missing');
    return issues;
  }
  if (!units || !units.length) issues.push('worker: CITATION_UNITS table is missing');

  const table = [...(books || []), ...(units || [])];
  const seen = new Set();
  for (const [abbreviation, expansion] of table) {
    if (!abbreviation.endsWith('.')) issues.push(`${abbreviation}: abbreviation must end with a dot`);
    if (seen.has(abbreviation)) issues.push(`${abbreviation}: duplicate abbreviation`);
    seen.add(abbreviation);
    if (!/^[А-ЯЁа-яё]/.test(expansion)) issues.push(`${abbreviation}: expansion must be spoken words`);
    if (/[+.,;]/.test(expansion)) issues.push(`${abbreviation}: expansion must be plain speech`);
  }
  for (const [abbreviation, expansion] of books || []) {
    const spoken = expansion.split(' ').pop();
    // A book name is a proper name: its head word must stay capitalised so a
    // sentence never starts with a lower-case fragment of the citation.
    if (!/^[А-ЯЁ]/.test(spoken)) issues.push(`${abbreviation}: book name must be capitalised ("${expansion}")`);
    if (vowelCount(spoken.toLowerCase()) < 2) continue; // monosyllables need no stress marker
    if (STRESS_PENDING.has(spoken.toLowerCase())) continue;
    const covered = termMap[spoken.toLowerCase()] || markerOnlyLookup.getPlusForm(spoken.toLowerCase());
    if (!covered) issues.push(`${abbreviation}: "${spoken}" has no stress source (custom terms or marker dictionary)`);
  }

  // Every scripture citation in the content must resolve to a spoken book name.
  const referencePattern = /([1-3]\s*)?([А-ЯЁ][а-яё]{1,7})\.\s?(?=\d+\s*:\s*\d+)/g;
  const unmapped = new Map();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(referencePattern)) {
      const label = `${match[1] ? `${match[1].replace(/\s+/g, '')} ` : ''}${match[2]}.`;
      if (!seen.has(label)) unmapped.set(label, (unmapped.get(label) || 0) + 1);
    }
  }
  for (const [label, count] of [...unmapped.entries()].sort((a, b) => b[1] - a[1])) {
    issues.push(`${label}: ${count} citation(s) expand to nothing — add it to SCRIPTURE_BOOKS`);
  }

  // Domain terminology must never fall through to the unstressed G2P fallback.
  const uncovered = new Map();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const word of text.match(/[а-яё]{4,}/g) || []) {
      if (!DOMAIN_STEMS.some((stem) => word.startsWith(stem))) continue;
      if (termMap[word] || markerOnlyLookup.getPlusForm(word)) continue;
      uncovered.set(word, true);
    }
  }
  for (const word of [...uncovered.keys()].sort()) {
    issues.push(`${word}: domain term without a stress source`);
  }
  return issues;
}

const contentFiles = CONTENT_ROOTS.reduce((out, dir) => collectContentFiles(dir, out), []);
const vocabularyProblems = validateVocabulary(worker, terms, contentFiles);
assert.deepEqual(vocabularyProblems, [], vocabularyProblems.join('\n'));

const expander = buildExpander(worker);
assert.ok(expander, 'worker: abbreviation expander must be loadable from source');
const expansionCases = [
  ['Рим. 5:12', 'Римлянам 5:12'],
  ['Мф. 5:3', 'Матфея 5:3'],
  ['1 Кор. 13:4', 'первое послание Коринфянам 13:4'],
  ['2 Тим. 3:16', 'второе послание Тимофею 3:16'],
  ['3 Ин. 1:2', 'третье послание Иоанна 1:2'],
  ['Евр. 11:1', 'Евреям 11:1'],
  ['Отк. 21:4', 'Откровение 21:4'],
  ['Пс. 22:1', 'Псалом 22:1'],
  ['Ис. 53:5', 'Исаии 53:5'],
  ['гл. 3', 'глава 3'],
  ['ст. 8', 'стих 8'],
  ['т.е. так', 'то есть так'],
  ['Иуд. предал', 'Иуд. предал'],
  ['гл. обр.', 'гл. обр.'],
];
for (const [input, expected] of expansionCases) {
  const actual = expander(input);
  assert.equal(actual, expected, `citation expansion drifted for "${input}"`);
}

const mutationProblems = [
  ['book abbreviation dropped', validateVocabulary(worker.replace("['Мф.', 'Матфея'], ", ''), terms, contentFiles)],
  ['lettered book removed', validateVocabulary(worker.replace("['1 Кор.', 'первое послание Коринфянам'], ", ''), terms, contentFiles)],
  ['book name loses its stress', validateVocabulary(worker, { ...terms, фессалоникийцам: undefined }, contentFiles)],
  ['domain term loses its stress', validateVocabulary(worker, { ...terms, христоцентричной: undefined }, contentFiles)],
  ['citation units removed', validateVocabulary(worker.replace(/var CITATION_UNITS = \[[\s\S]*?\];/, 'var CITATION_UNITS = [];'), terms, contentFiles)],
];
for (const [name, issues] of mutationProblems) {
  assert.ok(issues.length > 0, `${name}: vocabulary mutation must be rejected`);
}

assert.deepEqual(problems, [], problems.join('\n'));
console.log(`TTS stress dictionary contract: PASS (${Object.keys(terms).length} unconditional forms, context homographs separated, ${contentFiles.length} content files scanned for citation/stress coverage, ${mutationProblems.length} vocabulary mutations rejected).`);
