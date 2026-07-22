#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.resolve(__dirname, '..', 'js', 'highlights.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const start = source.indexOf('function gbHighlightPath');
const end = source.indexOf('function f(){', start);
assert.ok(start >= 0 && end > start, 'pure highlight helpers must be embedded in production runtime');

const context = {
  URL,
  window: { location: { origin: 'https://gospod-bog.ru' } },
};
vm.createContext(context);
vm.runInContext(
  `${source.slice(start, end)};this.api={path:gbHighlightPath,text:gbHighlightText,key:gbHighlightKey,dedupe:gbDedupeHighlights,add:gbAddHighlight};`,
  context,
);
const api = context.api;
const plain = (value) => JSON.parse(JSON.stringify(value));

const existing = [
  { id: 'newest', text: '  Одна   цитата ', url: 'https://gospod-bog.ru/articles/a/#one', savedAt: 30 },
  { id: 'older', text: 'одна цитата', url: 'https://gospod-bog.ru/articles/a/#two', savedAt: 20 },
  { id: 'other-page', text: 'Одна цитата', url: 'https://gospod-bog.ru/articles/b/#one', savedAt: 10 },
];

const compacted = plain(api.dedupe(existing));
assert.deepEqual(
  compacted.map((item) => item.id),
  ['newest', 'other-page'],
  'old duplicates compact while preserving newest stable order and cross-page quote',
);

const samePage = plain(api.add(compacted, {
  id: 'duplicate-attempt',
  text: 'одна\nцитата',
  url: '/articles/a/?from=test#another',
  savedAt: 40,
}));
assert.deepEqual(
  samePage.map((item) => item.id),
  ['newest', 'other-page'],
  'same-page duplicate is not inserted or reordered',
);

const crossPage = plain(api.add(compacted, {
  id: 'third-page',
  text: 'ОДНА ЦИТАТА',
  url: '/articles/c/#one',
  savedAt: 40,
}));
assert.deepEqual(
  crossPage.map((item) => item.id),
  ['third-page', 'newest', 'other-page'],
  'same quote on another path remains valid and is inserted first',
);

const many = Array.from({ length: 205 }, (_, index) => ({
  id: `item-${index}`,
  text: `quote ${index}`,
  url: `/articles/${index}/`,
}));
assert.equal(
  api.add(many, { id: 'fresh', text: 'fresh quote', url: '/fresh/' }).length,
  200,
  '200-item cap remains enforced',
);

assert.match(source, /i\.length!==t\.length&&C\(i\)/, 'read path persists compacted legacy data');
assert.match(source, /c=gbAddHighlight\(c,\{id:/, 'save path uses canonical duplicate guard');
assert.doesNotMatch(source, /c\.unshift\(\{id:/, 'legacy unconditional quote insertion is removed');
assert.match(source, /aria-modal","true"\),l\.setAttribute\("aria-hidden","true"\)/, 'dialog starts hidden from accessibility APIs');
assert.match(source, /classList\.add\("is-open"\),l\.setAttribute\("aria-hidden","false"\)/, 'open path exposes dialog');
assert.match(source, /classList\.remove\("is-open"\),l\.setAttribute\("aria-hidden","true"\)/, 'close path hides dialog');

console.log('✅ highlights runtime dedupe + ARIA regression passed');
