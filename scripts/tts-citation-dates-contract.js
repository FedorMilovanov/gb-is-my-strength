#!/usr/bin/env node
'use strict';

// Contract for the spoken form of year and century citations ("в 1956 г.",
// "около 170–200 гг.", "XVIII в."). The worker declines the noun because a
// citation read without a case sounds like "в тысяча девятьсот пятьдесят шестой г".
//
// The contract checks three things:
//   1. a table of spoken forms that are correct Russian, not merely what the
//      worker happens to print;
//   2. the whole corpus: no year or century abbreviation survives expansion;
//   3. that the rules are load-bearing — five mutations of the worker source must
//      each be caught. A rule nobody can break is a rule nobody enforces.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WORKER_PATH = path.join(ROOT, 'js/vosk-tts-worker.js');
const workerSource = fs.readFileSync(WORKER_PATH, 'utf8');

const problems = [];

function buildExpander(source) {
  const start = source.indexOf('var SCRIPTURE_BOOKS');
  const end = source.indexOf('function synthChunk');
  if (start < 0 || end < 0) return null;
  try {
    // eslint-disable-next-line no-new-func
    return new Function(`${source.slice(start, end)}
return expandSiteAbbreviations;`)();
  } catch (_) {
    return null;
  }
}

const worker = buildExpander(workerSource);
if (!worker) {
  console.log('TTS citation dates contract: FAIL — the worker expander could not be loaded');
  process.exit(1);
}

/* ============ spoken forms ============ */

// Every row is Russian as a reader would say it, not "what the code prints
// today". A row is added only together with the case rule that produces it.
const SPOKEN = [
  ['в 1956 г.', 'в 1956 году'],
  ['с 1950 г.', 'с 1950 года'],
  ['до 1950 г.', 'до 1950 года'],
  ['после 1950 г.', 'после 1950 года'],
  ['к 2016 г.', 'к 2016 году'],
  ['по 1911 г.', 'по 1911 год'],
  ['см. 1689 г., гл. 10', 'смотри 1689 год, глава 10'],
  ['1 ноября 1716 г.', '1 ноября 1716 года'],
  ['по 4 января 1911 г.', 'по 4 января 1911 года'],
  ['28 декабря 1910 г. по 4 января', '28 декабря 1910 года по 4 января'],
  ['Лондонское исповедание 1689 г.', 'Лондонское исповедание 1689 года'],
  ['к 2016 г. признано', 'к 2016 году признано'],
  ['в 587/586 г. до н.э.', 'в 587/586 году до нашей эры'],
  ['около 170–200 гг.', 'около 170–200 годов'],
  ['в 1646–1647 гг.', 'в 1646–1647 годах'],
  ['в 1940-х гг.', 'в 1940-х годах'],
  ['1950-е гг.', '1950-е годы'],
  ['44–96 г. Послания', '44–96 годов Послания'],
  ['500 г. н.э.', '500 года нашей эры'],
  ['(II в.)', '(второй век)'],
  ['с I в. до н.э.', 'с первого века до нашей эры'],
  ['в II в.', 'во втором веке'],
  ['базилика V в.', 'базилика пятого века'],
  ['тексты II–IV вв.', 'тексты второго–четвёртого веков'],
  ['· XVIII в. ·', '· восемнадцатый век ·'],
  ['XIX веке', 'девятнадцатом веке'],
];

// Forms that must survive untouched: the same letters at the end of a word, a
// person, an already expanded phrase. Turning any of these into a year is a
// regression.
const UNTOUCHED = [
  ['Петербург.', 'Петербург.'],
  ['книг.', 'книг.'],
  ['учения г. Пашкова', 'учения г. Пашкова'],
  ['г. Москва', 'г. Москва'],
  ['вторник', 'вторник'],
  ['в 1950 году', 'в 1950 году'],
];

function checkSpoken(expand, prefix) {
  const failures = [];
  for (const [input, expected] of SPOKEN) {
    const actual = expand(input);
    if (actual !== expected) failures.push(`${prefix}${JSON.stringify(input)} → ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
  for (const [input, expected] of UNTOUCHED) {
    const actual = expand(input);
    if (actual !== expected) failures.push(`${prefix}${JSON.stringify(input)} must stay untouched, got ${JSON.stringify(actual)}`);
  }
  return failures;
}

problems.push(...checkSpoken(worker, ''));

/* ============ tables ============ */

function parseTable(source, name) {
  const start = source.indexOf(`var ${name} = [`);
  if (start < 0) return null;
  const end = source.indexOf('];', start);
  if (end < 0) return null;
  return [...source.slice(start, end).matchAll(/\[([^\]]*)\]/g)]
    .map((match) => [...match[1].matchAll(/'([^']*)'/g)].map((cell) => cell[1]))
    .filter((row) => row.length > 1);
}

for (const table of ['YEAR_FORMS', 'CENTURY_FORMS']) {
  const rows = parseTable(workerSource, table);
  if (!rows || rows.length !== 2) {
    problems.push(`${table}: expected a singular and a plural row`);
    continue;
  }
  for (const row of rows) {
    if (row.length !== 6) problems.push(`${table}: ${row[0]} must carry all six cases, got ${row.length}`);
  }
  const [singular, plural] = rows;
  for (let index = 0; index < 6; index += 1) {
    if (singular[index] === plural[index] && index !== 3) {
      problems.push(`${table}: singular and plural collide in column ${index} (${singular[index]})`);
    }
  }
}

const cueBlock = /var DATE_CUE_CASES = \{([\s\S]*?)\};/.exec(workerSource);
if (!cueBlock) {
  problems.push('DATE_CUE_CASES: cue table is missing');
} else {
  const cases = { nom: 0, gen: 1, dat: 2, acc: 3, ins: 4, pre: 5 };
  for (const match of cueBlock[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) {
    if (!Object.prototype.hasOwnProperty.call(cases, match[2])) {
      problems.push(`DATE_CUE_CASES: «${match[1]}» points at unknown case «${match[2]}»`);
    }
  }
}

/* ============ corpus sweep ============ */

function collectFiles(directory, out) {
  if (!fs.existsSync(directory)) return out;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(full, out);
    else if (/\.(astro|mdx|md|html|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = ['src/content', 'src/components', 'public'].reduce((all, relative) => collectFiles(path.join(ROOT, relative), all), []);
if (files.length < 400) problems.push(`corpus: expected the full site (400+ files), found ${files.length}`);

const YEAR_PATTERN = /(^|[^А-Яа-яЁё\d])(\d{1,4}(?:\s*[–—-]\s*\d{1,4})?(?:[-–][хxе])?)\s*(гг?)\./g;
const CENTURY_PATTERN = /(^|[^А-Яа-яЁё\d])([IVXLCDM]{1,7})(?:\s*[–—-]\s*[IVXLCDM]{1,7})?\s*(вв?)\./g;
// A weight is the only other reading of "г."; the site spells «грамм» out and
// never abbreviates it, so a corpus hit here would mean new content needs its
// own decision instead of a silent "year".
// JS \\b is ASCII-based and cannot close a Cyrillic word; this boundary is Unicode-aware.
const WEIGHT_AFTER = /(^|\s)(соли|муки|сахара|масла|воды|грамм[а-яё]*|кг|мг|специй|дрожжей|мёда|меда|крупы)(?=$|[^\p{L}\p{N}])/u;

let yearTotal = 0;
let centuryTotal = 0;
let yearLeft = 0;
let centuryLeft = 0;
const leftovers = [];
const weights = [];

// Shared predicate for source corpus and negative/positive admission fixtures.
// Do not pronounce mass abbreviations as years; require an editorial decision.
function weightAbbreviations(text) {
  const found = [];
  for (const match of String(text).matchAll(/(\d{1,4})\s*г\.(\s*[а-яё]+)?/gi)) {
    if (match[2] && WEIGHT_AFTER.test(match[2])) found.push(match[0].trim());
  }
  return found;
}
for (const sample of ["200 г. сахара", "50 г. соли", "35 г. муки", "1 г. масла", "100 г. сахара,"]) {
  if (weightAbbreviations(sample).length !== 1)
    problems.push("weight guard: missed " + JSON.stringify(sample));
}
for (const sample of ["г. Москва", "учения г. Пашкова", "в 1956 г.", "1956 г. начался"]) {
  if (weightAbbreviations(sample).length !== 0)
    problems.push("weight guard: false positive " + JSON.stringify(sample));
}

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const expanded = worker(text);
  yearTotal += [...text.matchAll(YEAR_PATTERN)].length;
  centuryTotal += [...text.matchAll(CENTURY_PATTERN)].length;
  for (const match of expanded.matchAll(/\d{1,4}\s*гг?\./g)) {
    yearLeft += 1;
    if (leftovers.length < 5) leftovers.push(`${path.relative(ROOT, file)}: …${expanded.slice(Math.max(0, match.index - 40), match.index + 12)}…`);
  }
  for (const match of expanded.matchAll(/[IVXLCDM]{1,7}\s*вв?\./g)) {
    centuryLeft += 1;
    if (leftovers.length < 5) leftovers.push(`${path.relative(ROOT, file)}: …${expanded.slice(Math.max(0, match.index - 40), match.index + 12)}…`);
  }
  for (const match of weightAbbreviations(text)) {
    if (weights.length < 5) weights.push(path.relative(ROOT, file) + ": " + match);
  }}

if (yearLeft) problems.push(`corpus: ${yearLeft} year abbreviations survive expansion, e.g. ${leftovers.slice(0, 3).join(' | ')}`);
if (centuryLeft) problems.push(`corpus: ${centuryLeft} century abbreviations survive expansion`);
if (weights.length) problems.push(`corpus: "г." is used as a weight and must not become a year: ${weights.join(' | ')}`);
if (yearTotal < 100) problems.push(`corpus: only ${yearTotal} year citations found, the sweep is not seeing the site`);
if (centuryTotal < 20) problems.push(`corpus: only ${centuryTotal} century citations found, the sweep is not seeing the site`);

// Idempotency: the expander runs again on the same text when a chunk is retried.
for (const sample of ['в 1956 г.', 'около 170–200 гг.', 'тексты II–IV вв.', '1 ноября 1716 г.']) {
  const once = worker(sample);
  const twice = worker(once);
  if (once !== twice) problems.push(`idempotency: ${JSON.stringify(sample)} → ${JSON.stringify(once)} → ${JSON.stringify(twice)}`);
}

/* ============ mutations ============ */

const MUTATIONS = [
  ['cue table dropped', 'var column = dateCueCase(head);', 'var column = null;'],
  ['numeral anchor removed', '(\\d{1,4}(?:\\s*[–—-]\\s*\\d{1,4})?(?:[-–][хxе])?)\\s*(гг?)\\.', '(г).?'],
  ['range plural dropped', '/[–—-]\\s*\\d{1,4}$/.test(numeral)', 'false'],
  ['century default case dropped', "column = /\\p{L}\\s*$/u.test(head) ? (plural && /(?:^|\\s)(?:все|эти|те|оба|обе)$/.test(head.trim()) ? 'nom' : 'gen') : (plural ? 'gen' : 'nom');", "column = 'nom';"],
  ['«во» correction dropped', 'output = output.replace(/(^|[^А-Яа-яЁё])([вВ]) (?=втор)/g', 'output = output.replace(/^$/g'],
];

let mutations = 0;
for (const [name, from, to] of MUTATIONS) {
  if (!workerSource.includes(from)) {
    problems.push(`mutation «${name}»: anchor not found, the contract is stale`);
    continue;
  }
  const mutated = buildExpander(workerSource.replace(from, to));
  if (!mutated) {
    problems.push(`mutation «${name}»: mutated worker does not load`);
    continue;
  }
  const caught = checkSpoken(mutated, '');
  if (!caught.length) problems.push(`mutation «${name}»: not caught by the spoken-form table`);
  else mutations += 1;
}

/* ============ result ============ */

if (problems.length) {
  console.log('TTS citation dates contract: FAIL');
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(1);
}

console.log(`TTS citation dates contract: PASS (${SPOKEN.length} spoken forms, ${UNTOUCHED.length} protected forms, ${yearTotal} year and ${centuryTotal} century citations across ${files.length} files expanded with no leftovers, ${mutations} mutations rejected).`);
