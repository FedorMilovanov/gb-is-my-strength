#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];

function requireText(text, needle, label) {
  if (!text.includes(needle)) failures.push(`${label}: missing ${JSON.stringify(needle)}`);
}

function forbidText(text, needle, label) {
  if (text.includes(needle)) failures.push(`${label}: forbidden ${JSON.stringify(needle)}`);
}

function requireOrder(text, first, second, label) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  if (firstIndex === -1 || secondIndex === -1 || firstIndex >= secondIndex) {
    failures.push(`${label}: expected ${JSON.stringify(first)} before ${JSON.stringify(second)}`);
  }
}

const component = read('src/components/nagornaya/shared/NagornayaClaimComparison.astro');
const projection = read('src/lib/nagornaya-claim-projection.ts');
const browserTest = read('scripts/nagornaya-neutral-comparison-browser-test.mjs');
const part4 = read('src/components/nagornaya/chast-4/NagornayaChast4MainShell.astro');
const part5 = read('src/components/nagornaya/chast-5/NagornayaChast5MainShell.astro');
const shadow4 = read('nagornaya/chast-4/index.html');
const shadow5 = read('nagornaya/chast-5/index.html');
const pkg = JSON.parse(read('package.json'));

for (const layer of [
  'textual-observation',
  'historical-reconstruction',
  'literary-model',
  'doctrinal-synthesis',
  'pastoral-application',
]) {
  requireText(component, layer, 'component epistemic ladder');
  requireText(projection, layer, 'typed projection layers');
}

for (const heading of [
  'Первичные основания',
  'Альтернатива, которую нужно услышать',
  'Предел аргумента',
  'Позиция серии',
  'Что изменит вывод',
]) {
  requireText(component, heading, 'component content contract');
}

requireOrder(component, 'Альтернатива, которую нужно услышать', 'Позиция серии', 'alternative-first DOM order');
requireText(projection, "../../data/nagornaya/source-registry.json", 'canonical registry import');
requireText(projection, 'claimPresentationRu', 'Russian presentation layer');
requireText(projection, 'Дональд Грин защищает ограниченное употребление модели ipsissima vox', 'Green Russian projection');
requireText(projection, 'Роберт Томас критикует Jesus Seminar', 'Thomas Russian projection');
forbidText(component, 'text-red-', 'neutral component palette');
forbidText(component, 'text-emerald-', 'neutral component palette');
forbidText(component, '✓', 'neutral component verdict glyphs');
forbidText(component, '✗', 'neutral component verdict glyphs');

for (const exactIconUrl of [
  'https://gospod-bog.ru/apple-touch-icon.png',
  'https://gospod-bog.ru/icons/icon-192.png',
]) {
  requireText(browserTest, exactIconUrl, 'exact localhost CSP exception');
}
requireText(browserTest, "message.includes('Content Security Policy')", 'CSP-scoped exception');
forbidText(browserTest, "includes('favicon')", 'broad favicon console suppression');

requireText(part4, 'claimId="green-ipsissima-vox-model"', 'Part IV Green projection');
requireText(part4, 'claimId="thomas-jesus-seminar-critique"', 'Part IV Thomas projection');
requireText(part5, 'lordshipPastoralProjection', 'Part V typed pastoral projection');
requireText(part5, '<NagornayaClaimComparison', 'Part V shared comparison component');
forbidText(part5, 'bg-emerald-50 border-2 border-emerald-200', 'Part V answer-key block');

const part4ShadowCount = (shadow4.match(/data-nagornaya-claim-comparison/g) || []).length;
const part5ShadowCount = (shadow5.match(/data-nagornaya-claim-comparison/g) || []).length;
if (part4ShadowCount < 2) failures.push(`Part IV shadow: expected at least 2 comparison blocks, found ${part4ShadowCount}`);
if (part5ShadowCount < 1) failures.push(`Part V shadow: expected at least 1 comparison block, found ${part5ShadowCount}`);

if (!pkg.scripts || pkg.scripts['nagornaya:neutral-comparison:test'] !== 'node scripts/nagornaya-neutral-comparison-regression-test.js') {
  failures.push('package.json: missing nagornaya:neutral-comparison:test script');
}
if (!pkg.scripts?.['engine:contracts']?.includes('nagornaya:neutral-comparison:test')) {
  failures.push('package.json: engine:contracts does not run neutral comparison regression');
}

if (failures.length > 0) {
  console.error('Nagornaya neutral comparison regression FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Nagornaya neutral comparison regression PASS');
console.log(`- Part IV comparison blocks: ${part4ShadowCount}`);
console.log(`- Part V comparison blocks: ${part5ShadowCount}`);
console.log('- canonical registry + Russian projection + exact CSP exceptions + neutral DOM order verified');
