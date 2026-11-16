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
  маркли: 'м+аркли', // owner-confirmed first-syllable stress, Adam Markley
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
// Site terminology is allowed to disagree with the general dictionary only when
// the reason is written down here. Empty today: every shared word agrees.
const STRESS_OVERRIDES = new Map();

// Empty on purpose since 2026-11-03: the owner settled the three names that used
// to live here (Зах+ария, Мал+ахия, +Авдия), so they are ordinary dictionary
// entries now and the contract demands coverage for them like for any other book.
const STRESS_PENDING = new Map();

const DOMAIN_STEMS = [
  'христоцентрич', 'христоцентризм', 'христологич', 'христотелич',
  'сотериологич', 'экклезиологич', 'тринитар', 'импликац', 'эйзегез', 'межтекстуальн',
];

function vowelCount(word) {
  return (word.match(/[аеёиоуыэюя]/g) || []).length;
}

// Index of the stressed vowel inside the bare word. A "marked" spelling only
// inserts "+" before the vowel, so the position of "+" is the vowel position.
function stressVowelIndex(marked) {
  return String(marked).indexOf('+');
}

// Spoken forms that the corpus actually needs, checked against real Russian
// rather than against whatever the worker table happens to say.
const KNOWN_CITATION_FORMS = {
  'гл.': { prep: 'главе', acc: 'главу' },
  'ст.': { prep: 'стихе', acc: 'стих' },
};

function parseWordRows(source, name) {
  const start = source.indexOf(`var ${name} = [`);
  if (start < 0) return null;
  const end = source.indexOf('];', start);
  if (end < 0) return null;
  const block = source.slice(start, end);
  return [...block.matchAll(/\[([^\]]*)\]/g)]
    .map((match) => [...match[1].matchAll(/'([^']*)'/g)].map((cell) => cell[1]))
    .filter((row) => row.length > 1);
}

function parseWordTable(source, name) {
  const rows = parseWordRows(source, name);
  return rows ? rows.map((row) => [row[0], row[1]]) : null;
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

  // Two independent sources must not contradict each other. Where the general
  // russian-stress-marker dictionary also knows a word, its stress is a second
  // opinion on our entry: either we have a typo, or the override is deliberate
  // and therefore named in STRESS_OVERRIDES with a reason.
  for (const [word, marked] of Object.entries(termMap)) {
    if (STRESS_OVERRIDES.has(word)) continue;
    const reference = markerOnlyLookup.getPlusForm(word);
    if (!reference) continue;
    if (stressVowelIndex(marked) !== stressVowelIndex(reference)) {
      issues.push(`${word}: stress "${marked}" contradicts russian-stress-marker "${reference}"`);
    }
  }

  const books = parseWordTable(workerSource, 'SCRIPTURE_BOOKS');
  const units = parseWordTable(workerSource, 'CITATION_UNITS');
  if (!books || !books.length) {
    issues.push('worker: SCRIPTURE_BOOKS table is missing');
    return issues;
  }
  if (!units || !units.length) issues.push('worker: CITATION_UNITS table is missing');

  // Citation units are spoken through a preposition or a reference verb, so the
  // table must carry all six case forms and the cue table must select them.
  const unitRows = parseWordRows(workerSource, 'CITATION_UNITS') || [];
  const expand = buildExpander(workerSource);
  for (const row of unitRows) {
    const [abbreviation, ...forms] = row;
    if (forms.length !== 6) {
      issues.push(`${abbreviation}: citation unit needs six case forms (nom, gen, dat, acc, ins, pre), got ${forms.length}`);
      continue;
    }
    const [nominative, , , accusative, , prepositional] = forms;
    const stem = nominative.toLowerCase().slice(0, 3);
    for (const form of forms) {
      if (!/^[А-ЯЁа-яё]+$/.test(form)) issues.push(`${abbreviation}: case form "${form}" must be a single spoken word`);
      if (!form.toLowerCase().startsWith(stem)) issues.push(`${abbreviation}: case form "${form}" diverges from stem "${stem}"`);
    }
    const capitalised = /^[А-ЯЁ]/.test(abbreviation);
    if (capitalised && !/^[А-ЯЁ]/.test(nominative)) issues.push(`${abbreviation}: sentence-initial unit must keep a capitalised nominative`);
    if (!capitalised && /^[А-ЯЁ]/.test(nominative)) issues.push(`${abbreviation}: lower-case unit must not carry a capitalised nominative`);
    for (const form of forms.slice(1)) {
      if (/^[А-ЯЁ]/.test(form)) issues.push(`${abbreviation}: oblique form "${form}" must stay lower-case`);
    }
    if (!expand) continue;
    // Known-correct Russian for the units that occur in the corpus: the gate must
    // not accept a table that merely agrees with itself.
    const spoken = KNOWN_CITATION_FORMS[abbreviation] || {};
    const expectedPrepositional = spoken.prep || prepositional;
    const expectedAccusative = spoken.acc || accusative;
    const checks = [
      [`${abbreviation} 3`, `${nominative} 3`, 'bare reference stays nominative'],
      [`в ${abbreviation} 3`, `в ${expectedPrepositional} 3`, 'preposition "в" takes the prepositional case'],
      [`см. ${abbreviation} 3`, `смотри ${expectedAccusative} 3`, 'reference verb "см." takes the accusative case'],
      [`в ${abbreviation} XIV`, `в ${expectedPrepositional} 14`, 'roman-numeral reference keeps the case form'],
    ];
    for (const [input, expected, label] of checks) {
      const actual = expand(input);
      if (actual !== expected) issues.push(`${abbreviation}: ${label} — "${input}" reads as "${actual}", expected "${expected}"`);
    }
  }

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

  // No dotted abbreviation may ever reach the synthesizer: if it survives
  // expansion the voice spells a fragment ("деян", "притч", "матф") instead of
  // a book name. Every table row is driven through a real citation.
  const expanderForLeaks = buildExpander(workerSource);
  if (expanderForLeaks) {
    for (const [abbreviation] of table) {
      const spoken = expanderForLeaks(`${abbreviation} 1:1`);
      if (spoken.toLowerCase().includes(abbreviation.toLowerCase())) {
        issues.push(`${abbreviation}: abbreviation survives expansion ("${spoken}") and would be spoken as a fragment`);
      }
    }
  }

  // Domain terminology must never fall through to the unstressed G2P fallback.
  // Site abbreviations must be replaced at word boundaries. A plain split/join
  // corrupted ordinary words that merely end with the same letters: «порядок.»
  // became «порядоколо» in 84 places across the corpus.
  if (expand) {
    const boundaryCases = [
      ['Это порядок.', 'Это порядок.'],
      ['без ошибок.', 'без ошибок.'],
      ['срок.', 'срок.'],
      ['ок. 1950 года', 'около 1950 года'],
      ['т.е. так', 'то есть так'],
    ];
    for (const [input, expected] of boundaryCases) {
      const actual = expand(input);
      if (actual !== expected) issues.push(`site abbreviation boundary: "${input}" reads as "${actual}", expected "${expected}"`);
    }
  }

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

  // Corpus-level residue. Hand-written cases only prove what someone thought of;
  // the published text proves what actually reaches the synthesizer. A known
  // abbreviation that survives expansion in front of a number is read aloud as a
  // fragment ("гэ-эл три"), whatever the table says.
  const corpusExpander = buildExpander(workerSource);
  if (corpusExpander) {
    const siteTable = parseWordTable(workerSource, 'SITE_ABBREVIATIONS') || [];
    const surfaces = [...new Set([...table.map((row) => row[0]), ...siteTable.map((row) => row[0])])];
    const escapeSurface = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = surfaces.map((surface) => [
      surface,
      new RegExp(`(^|[^А-Яа-яЁёA-Za-z])${escapeSurface(surface)}(?=\\s*\\d)`, 'g'),
    ]);
    const residue = new Map();
    for (const file of files) {
      const text = fs
        .readFileSync(file, 'utf8')
        .replace(/<script[\s\S]*?<\/script>/g, ' ')
        .replace(/<style[\s\S]*?<\/style>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ');
      const expanded = corpusExpander(text);
      for (const [surface, pattern] of patterns) {
        if (pattern.test(expanded)) residue.set(surface, (residue.get(surface) || 0) + 1);
        pattern.lastIndex = 0;
      }
    }
    for (const [surface, count] of [...residue.entries()].sort((a, b) => b[1] - a[1])) {
      issues.push(`${surface}: ${count} published citation(s) still carry the abbreviation before a number`);
    }
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
  ['в гл. 3', 'в главе 3'],
  ['в ст. 5', 'в стихе 5'],
  ['со ст. 5', 'со стиха 5'],
  ['из гл. 2', 'из главы 2'],
  ['к гл. 4', 'к главе 4'],
  ['по ст. 7', 'по стиху 7'],
  ['см. гл. 3', 'смотри главу 3'],
  ['ср. ст. 8', 'сравни стих 8'],
  ['См. гл. 3', 'Смотри главу 3'],
  ['(гл. 3)', '(глава 3)'],
  ['Гл. 3 начинается', 'Глава 3 начинается'],
  ['см. Рим. 5:12', 'смотри Римлянам 5:12'],
  ['т.е. так', 'то есть так'],
  ['Иуд. предал', 'Иуд. предал'],
  ['гл. обр.', 'гл. обр.'],
  // Roman-numeral citations: the numeral is the chapter/verse number, so the unit
  // must still expand and the numeral must survive to the arabic pass.
  ['(гл. XIV)', '(глава 14)'],
  ['в гл. XIV сказано', 'в главе 14 сказано'],
  ['см. гл. III', 'смотри главу 3'],
  ['по ст. V', 'по стиху 5'],
  ['гл. III/IV', 'глава 3/4'],
];
for (const [input, expected] of expansionCases) {
  const actual = expander(input);
  assert.equal(actual, expected, `citation expansion drifted for "${input}"`);
}

// Spoken normalization of numeric slashes. "JETS 53/4" and "pp. 587/586" used to
// reach the model as two numbers run together; a slash between digits is a
// separator and has to survive as a pause, not as an invisible character.
const core = require(path.join(ROOT, 'js/vosk-tts-core.js'));
const spokenCases = [
  ['53/4', 'пятьдесят три , четыре'],
  ['1959/1960', 'тысяча девятьсот пятьдесят девять , тысяча девятьсот шестьдесят'],
  ['3,5', 'три целых пять'],
];
for (const [input, expected] of spokenCases) {
  assert.equal(core.normalizeText(input), expected, `spoken normalization drifted for "${input}"`);
}
assert.ok(
  !/\d\s*\/\s*\d/.test(core.normalizeText('13/1')),
  'numeric slash must not survive into the synthesizer input',
);

const mutationProblems = [
  ['book abbreviation dropped', validateVocabulary(worker.replace("['Мф.', 'Матфея'], ", ''), terms, contentFiles)],
  ['lettered book removed', validateVocabulary(worker.replace("['1 Кор.', 'первое послание Коринфянам'], ", ''), terms, contentFiles)],
  ['book name loses its stress', validateVocabulary(worker, { ...terms, фессалоникийцам: undefined }, contentFiles)],
  ['domain term loses its stress', validateVocabulary(worker, { ...terms, христоцентричной: undefined }, contentFiles)],
  ['citation units removed', validateVocabulary(worker.replace(/var CITATION_UNITS = \[[\s\S]*?\];/, 'var CITATION_UNITS = [];'), terms, contentFiles)],
  ['citation case cues removed', validateVocabulary(worker.replace(/var CITATION_CUE_CASES = \{[\s\S]*?\};/, 'var CITATION_CUE_CASES = {};'), terms, contentFiles)],
  ['citation unit loses its prepositional form', validateVocabulary(worker.replace("['гл.', 'глава', 'главы', 'главе', 'главу', 'главой', 'главе']", "['гл.', 'глава', 'главы', 'главе', 'главу', 'главой', 'глава']"), terms, contentFiles)],
  ['citation unit loses its accusative form', validateVocabulary(worker.replace("['гл.', 'глава', 'главы', 'главе', 'главу', 'главой', 'главе']", "['гл.', 'глава', 'главы', 'главе', 'глава', 'главой', 'главе']"), terms, contentFiles)],
  ['citation pattern drops roman numerals', validateVocabulary(worker.replace(String.raw`(?=\\s*(?:\\d|[IVXLCDM]+\\b))`, String.raw`(?=\\s*\\d)`), terms, contentFiles)],
  ['custom stress contradicts the marker dictionary', validateVocabulary(worker, { ...terms, коринфянам: 'коринф+янам' }, contentFiles)],
  ['site abbreviations fall back to plain split/join', validateVocabulary(worker.replace(/output = output\.replace\(pattern, function \(whole, before\) \{[\s\S]*?\}\);/, "output = output.split(SITE_ABBREVIATIONS[index][0]).join(SITE_ABBREVIATIONS[index][1]);"), terms, contentFiles)],
];
for (const [name, issues] of mutationProblems) {
  assert.ok(issues.length > 0, `${name}: vocabulary mutation must be rejected`);
}

assert.deepEqual(problems, [], problems.join('\n'));
console.log(`TTS stress dictionary contract: PASS (${Object.keys(terms).length} unconditional forms, context homographs separated, ${contentFiles.length} content files scanned for citation/stress coverage, ${mutationProblems.length} vocabulary mutations rejected).`);
