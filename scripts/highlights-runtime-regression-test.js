#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'js/highlights.js'), 'utf8');
const start = source.indexOf('function normalizeText(');
const end = source.indexOf('function read(', start);
assert.ok(start >= 0 && end > start, 'canonical pure quote helpers exist inside shared owner');
const context = { URL, location: { origin: 'https://gospod-bog.ru' } };
vm.createContext(context);
vm.runInContext('const LIMIT_QUOTES = 200;\n' + source.slice(start, end) + '\nthis.api={path:gbHighlightPath,text:gbHighlightText,key:gbHighlightKey,dedupe:gbDedupeHighlights,add:gbAddHighlight}', context);
const api = context.api;
const plain = (value) => JSON.parse(JSON.stringify(value));

const duplicates = [
  { id: 'newest', text: '  Одна   цитата ', url: 'https://gospod-bog.ru/articles/a/#one', savedAt: 30 },
  { id: 'older', text: 'одна цитата', url: 'https://gospod-bog.ru/articles/a/#two', savedAt: 20 },
  { id: 'other-page', text: 'Одна цитата', url: 'https://gospod-bog.ru/articles/b/#one', savedAt: 10 },
];
const compacted = plain(api.dedupe(duplicates));
assert.deepEqual(compacted.map((x) => x.id), ['newest', 'other-page'],
  'legacy dedupe preserves newer matching quote and cross-article quotations');
const repeated = plain(api.add(compacted, {
  id: 'duplicate', text: 'одна\nцитата', url: '/articles/a/?test=1#other', savedAt: 40,
}));
assert.deepEqual(repeated.map((x) => x.id), ['newest', 'other-page'],
  'same-page duplicate does not multiply or change order');
const differentPage = plain(api.add(compacted, {
  id: 'third', text: 'ОДНА ЦИТАТА', url: '/articles/c/#source', savedAt: 40,
}));
assert.deepEqual(differentPage.map((x) => x.id), ['third', 'newest', 'other-page'],
  'identical text from another article is a distinct quotation');
const many = Array.from({ length: 205 }, (_, i) => ({ id: 'i' + i, text: 'quote ' + i, url: '/article/' + i }));
assert.equal(api.add(many, { id: 'recent', text: 'new', url: '/recent/' }).length, 200,
  'preexisting 200-item cap is preserved');

assert.match(source, /const QUOTES_KEY = 'gb-highlights-v1'/, 'existing quote storage key must not change');
assert.match(source, /const FAVORITES_KEY = 'gb-favorites'/, 'canonical favorites key is read, not shadowed');
assert.match(source, /window\.GBFavoriteStore/, 'read articles through native favorite-store API when available');
assert.match(source, /window\.GBHighlights = api/, 'legacy public API is maintained');
assert.match(source, /window\.GBReaderLibrary = api/, 'unified reader library API exposed');
assert.match(source, /setAttribute\('aria-hidden', 'false'\)/, 'modal open exposes its dialog');
assert.match(source, /setAttribute\('aria-hidden', 'true'\)/, 'modal close hides its dialog');
assert.match(source, /removeAttribute\('inert'\)/, 'opening modal restores interactions');
assert.match(source, /setAttribute\('inert', ''\)/, 'closed modal is inert');
assert.match(source, /gb-hl-quote.*is-collapsed|is-collapsed/, 'long text collapses');
const css = fs.readFileSync(path.resolve(__dirname, '..', 'css/highlights-runtime.css'), 'utf8');
assert.match(css, /prefers-reduced-motion/, 'reduced-motion users do not get forced animation');
console.log('✅ Unified reader library helpers, legacy storage, ARIA and dedupe regression passed');
