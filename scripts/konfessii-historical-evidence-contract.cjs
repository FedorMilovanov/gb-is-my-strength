#!/usr/bin/env node
'use strict';

/**
 * Public 3D historical evidence regression gate.
 * Prevent a future source update from reintroducing claims already disproved
 * or classified as unsupported by the canonical Baptist research dossiers.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const src = path.join(root, '_build-tools/konfessii-baptizm/reconciled-app/src');
const read = p => fs.readFileSync(path.join(src, p), 'utf8');
const keep = (p, token) => assert.ok(read(p).includes(token), p + ': missing checked claim: ' + token);
const reject = (p, token) => assert.ok(!read(p).includes(token), p + ': stale/disproved claim: ' + token);

const congress = 'data/history/congresses.ts';
keep(congress, "place: 'Санкт-Петербург'");
keep(congress, "place: 'Ново-Васильевка, Таврическая губерния'");
keep(congress, '33 депутата');
reject(congress, "place: 'Тифлис'");
reject(congress, "date: '1909'");
reject('components/Congresses.tsx', '7 000–10 000 документов');
reject(congress, 'Итонский колледж');
reject('components/Archives.tsx', 'Микрофильмы в:');

const people = 'data/history/persons.ts';
keep(people, 'Кальвейтом 6 октября 1869 года');
keep(people, '11 июня 1869 года');
reject(people, 'Крещение от Н. И. Воронина в Тифлисе (по pravenc.ru)');
reject(people, "name: 'Ефим Цымбал'");

keep('data/quizData.ts', "id: 'v6-kargel-1'");
keep('data/quizData.ts', "correctIndex: 0, explanation: 'Валькевич");
keep('data/quizData.ts', 'С указанием года, источника');
reject('data/quizData.ts', "options: ['5 лет', '8 лет'") // this can be restored only with case-level primary evidence
  ;
reject('data/quizData.ts', '66 732');
reject('data/history/unions.ts', '66 732');
reject('components/Comparison.tsx', '66 732');
reject('data/timeline.ts', '66 732');
reject('components/ParallelTimelines.tsx', "year: '1946', text: 'Присоединение пятидесятников'");
keep('components/ParallelTimelines.tsx', '24 августа');
keep('data/history/legal.ts', "year: '1894'");
reject('data/history/legal.ts', "title: 'Указ о штундистах'");
reject('data/history/persecution.ts', '~22 000');
reject('data/history/persecution.ts', '90%+');
reject('components/PersecutionHeatmap.tsx', 'более 90% пресвитеров');
keep('components/PersecutionHeatmap.tsx', 'не численный индекс');

const app = path.join(root, '_build-tools/konfessii-baptizm/reconciled-app');
assert.ok(!fs.existsSync(path.join(src, 'components/AiAssistant.tsx')));
assert.ok(!fs.existsSync(path.join(src, 'services/gemini.ts')));
reject('App.tsx', 'AiAssistant');
const pkg = fs.readFileSync(path.join(app, 'package.json'), 'utf8');
const lock = fs.readFileSync(path.join(app, 'package-lock.json'), 'utf8');
assert.ok(!pkg.includes('@google/generative-ai'), 'Remove obsolete Gemini client dependency');
assert.ok(!lock.includes('@google/generative-ai'), 'Remove obsolete Gemini from lockfile');
console.log('PASS: dated/source-bounded Russian Baptist historical claims; no browser AI dependency');
