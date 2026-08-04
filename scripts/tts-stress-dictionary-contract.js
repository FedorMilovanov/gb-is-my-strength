#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TERMS_PATH = path.join(ROOT, 'js/vosk-custom-terms.json');
const ENGINE_PATH = path.join(ROOT, 'js/vosk-tts-engine.js');
const terms = JSON.parse(fs.readFileSync(TERMS_PATH, 'utf8'));
const engine = fs.readFileSync(ENGINE_PATH, 'utf8');
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

assert.deepEqual(problems, [], problems.join('\n'));
console.log(`TTS stress dictionary contract: PASS (${Object.keys(terms).length} unconditional forms, context homographs separated).`);
