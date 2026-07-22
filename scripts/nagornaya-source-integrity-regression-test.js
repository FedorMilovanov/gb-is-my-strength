#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const sourceFiles = [
  'src/components/nagornaya/istochniki/NagornayaIstochnikiMainShell.astro',
  'nagornaya/istochniki/index.html',
];
const part4Files = [
  'src/components/nagornaya/chast-4/NagornayaChast4MainShell.astro',
  'nagornaya/chast-4/index.html',
];

for (const rel of sourceFiles) {
  const text = read(rel);
  assert.match(text, /Donald E\. Green[\s\S]{0,1200}pp\. 49–68/, `${rel}: Green pages must be 49–68`);
  assert.doesNotMatch(text, /Donald E\. Green[\s\S]{0,1200}pp\. 49–74/, `${rel}: stale Green pages 49–74 returned`);
  assert.match(text, /href="https:\/\/tms\.edu\/wp-content\/uploads\/2021\/09\/tmsj7d\.pdf"[^>]*>Evangelical Responses to the Jesus Seminar<\/a>/, `${rel}: Thomas must link to exact tmsj7d.pdf`);
  assert.match(text, /href="https:\/\/tms\.edu\/wp-content\/uploads\/2021\/09\/tmsj7h\.pdf"[^>]*>The Dispensational View of the Davidic Kingdom<\/a>/, `${rel}: Nichols must link to exact tmsj7h.pdf`);
  assert.doesNotMatch(text, /tmsj7h\.pdf[^<]{0,300}Jesus Seminar|Jesus Seminar[\s\S]{0,300}tmsj7h\.pdf/, `${rel}: Jesus Seminar must never resolve to tmsj7h.pdf`);
  assert.doesNotMatch(text, /Все ссылки верифицированы по первоисточникам/, `${rel}: universal verification claim returned`);
  assert.match(text, /Ключевые библиографические данные и доступные первичные объекты проверены на дату обновления/, `${rel}: bounded verification wording missing`);
  assert.match(text, /Статья в TMSJ представляет аргумент названного автора[^.]+не автоматически официальную позицию TMS/, `${rel}: author\/institution source-role note missing`);
}

const banned = [
  'Жёсткая граница Семинарии Мастерс',
  'Семинария Мастерс предложила последовательную консервативную защиту',
  'Аргументы Дональда Грина и позиции TMS',
  'Позиция Семинарии Мастерс бескомпромиссна',
];
const required = [
  'V. Ipsissima Verba и Ipsissima Vox: Аргумент Дональда Грина',
  'В этой дискуссии Дональд Грин',
  'Аргумент Дональда Грина в этой статье сводится к трём фундаментальным пунктам',
  'Грин проводит строгую границу',
  'В рамках этой серии мы принимаем концепцию',
];
for (const rel of part4Files) {
  const text = read(rel);
  for (const phrase of banned) assert.ok(!text.includes(phrase), `${rel}: institutional overreach returned: ${phrase}`);
  for (const phrase of required) assert.ok(text.includes(phrase), `${rel}: calibrated attribution missing: ${phrase}`);
}

console.log('✅ Nagornaya source integrity contract passed');
