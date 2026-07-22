#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const registry = JSON.parse(read('data/nagornaya/source-registry.json'));
const nativeSource = read('src/components/nagornaya/istochniki/NagornayaIstochnikiMainShell.astro');
const legacySource = read('nagornaya/istochniki/index.html');
const part4Files = [
  'src/components/nagornaya/chast-4/NagornayaChast4MainShell.astro',
  'nagornaya/chast-4/index.html',
];

const sourceById = new Map(registry.sources.map((source) => [source.id, source]));
const expected = {
  'tmsj-green-ipsissima-vox': {
    author: 'Donald E. Green',
    exactObject: 'tmsj12d.pdf',
    pages: '49–68',
    title: 'Evangelicals and Ipsissima Vox',
  },
  'tmsj-thomas-jesus-seminar': {
    author: 'Robert L. Thomas',
    exactObject: 'tmsj7d.pdf',
    pages: '75–105',
    title: 'Evangelical Responses to the Jesus Seminar',
  },
  'tmsj-nichols-davidic-kingdom': {
    author: 'Stephen J. Nichols',
    exactObject: 'tmsj7h.pdf',
    pages: '213–239',
    title: 'The Dispensational View of the Davidic Kingdom',
  },
};

for (const [id, fields] of Object.entries(expected)) {
  const source = sourceById.get(id);
  assert.ok(source, `registry: missing ${id}`);
  for (const [field, value] of Object.entries(fields)) {
    assert.equal(source[field], value, `registry ${id}: ${field}`);
  }
  assert.equal(new URL(source.resolvedUrl).pathname.split('/').pop(), source.exactObject, `${id}: resolved URL must match exact object`);
  assert.equal(source.attributionLevel, 'author', `${id}: article evidence must remain author-attributed`);
  assert.ok(nativeSource.includes(id), `native source page must resolve ${id} from registry`);
}

assert.match(nativeSource, /import sourceRegistry from ['"]\.\.\/\.\.\/\.\.\/\.\.\/data\/nagornaya\/source-registry\.json['"];/,
  'native source page must import canonical registry');
assert.doesNotMatch(nativeSource, /tmsj12d\.pdf|tmsj7d\.pdf|tmsj7h\.pdf/,
  'native source page must not duplicate pilot PDF objects outside registry');

assert.match(legacySource, /Donald E\. Green[\s\S]{0,1200}pp\. 49–68/, 'legacy source: Green pages must be 49–68');
assert.doesNotMatch(legacySource, /Donald E\. Green[\s\S]{0,1200}pp\. 49–74/, 'legacy source: stale Green pages 49–74 returned');
assert.match(legacySource, /href="https:\/\/tms\.edu\/wp-content\/uploads\/2021\/09\/tmsj7d\.pdf"[^>]*>Evangelical Responses to the Jesus Seminar<\/a>/,
  'legacy source: Thomas must link to exact tmsj7d.pdf');
assert.match(legacySource, /href="https:\/\/tms\.edu\/wp-content\/uploads\/2021\/09\/tmsj7h\.pdf"[^>]*>The Dispensational View of the Davidic Kingdom<\/a>/,
  'legacy source: Nichols must link to exact tmsj7h.pdf');
assert.doesNotMatch(legacySource, /tmsj7h\.pdf[^<]{0,300}Jesus Seminar|Jesus Seminar[\s\S]{0,300}tmsj7h\.pdf/,
  'legacy source: Jesus Seminar must never resolve to tmsj7h.pdf');

for (const [rel, text] of [
  ['native source', nativeSource],
  ['legacy source', legacySource],
]) {
  assert.doesNotMatch(text, /Все ссылки верифицированы по первоисточникам/, `${rel}: universal verification claim returned`);
  assert.match(text, /Ключевые библиографические данные и доступные первичные объекты проверены на дату обновления/, `${rel}: bounded verification wording missing`);
  assert.match(text, /Статья в TMSJ представляет аргумент названного автора[^.]+не автоматически официальную позицию TMS/,
    `${rel}: author/institution source-role note missing`);
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

console.log('✅ Nagornaya source integrity contract passed (registry-native + legacy + Part IV attribution)');
