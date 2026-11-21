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
// Range-aware W57 records must survive native library reads and retain their IDs.
const identical = 'Господь благ';
const plainQuote = { id: 'native', text: identical, url: '/articles/a/' };
const markedA = { id: 'w57-a', text: identical, url: '/articles/a/',
  annotation: { version: 1, kind: 'marker',
    anchor: { blockIndex: 2, start: 4, end: 16, exact: identical } } };
const markedB = { id: 'w57-b', text: identical, url: '/articles/a/',
  annotation: { version: 1, kind: 'underline',
    anchor: { blockIndex: 11, start: 4, end: 16, exact: identical } } };
const mixed = plain(api.add(api.add([plainQuote], markedA), markedB));
assert.deepEqual(mixed.map(x => x.id), ['w57-b', 'w57-a', 'native'],
  'same text on different ranges plus native quote must coexist');
assert.deepEqual(plain(api.dedupe(mixed)).map(x => x.id), mixed.map(x => x.id),
  'native library dedupe must not destroy anchored W57 entries');
assert.deepEqual(plain(api.add(mixed, { ...markedA, id: 'repeat-click' })).map(x => x.id),
  mixed.map(x => x.id), 'same anchored range must dedupe');
const unrelated = plain(api.add(mixed, { id: 'new', text: 'Иной отрывок', url: '/articles/a/' }));
assert.deepEqual(unrelated.map(x => x.id), ['new', 'w57-b', 'w57-a', 'native'],
  'unrelated highlight must persist despite pre-existing equal-word ranges');

// The always-installed SiteUtils guard must not undo GBHighlights range identity.
const guardSource=fs.readFileSync(path.resolve(__dirname,'..','js/site-utils.js'),'utf8');
const guardStart=guardSource.indexOf('function canonicalPage(');
const guardEnd=guardSource.indexOf('function syncHighlightDialog(',guardStart);
assert.ok(guardStart>=0&&guardEnd>guardStart,'shared SiteUtils guard exists');
class MockStorage{
 constructor(){this.map=new Map()}
 setItem(k,v){this.map.set(k,String(v))}
 getItem(k){return this.map.has(k)?this.map.get(k):null}
}
const storage=new MockStorage();
const rangeA={...markedA,id:'guard-a'},rangeB={...markedB,id:'guard-b'};
const repeatedRange={...markedA,id:'guard-repeat'};
storage.setItem('gb-highlights-v1',JSON.stringify([
 rangeA,rangeB,repeatedRange,plainQuote,{...plainQuote,id:'legacy-duplicate'}
]));
const guard={URL,console,Storage:MockStorage,localStorage:storage,HIGHLIGHTS_KEY:'gb-highlights-v1',
 window:{location:{href:'https://gospod-bog.ru/articles/a/'},Storage:MockStorage}};
vm.createContext(guard);
vm.runInContext(guardSource.slice(guardStart,guardEnd)+'\ninstallHighlightStorageGuard();',guard);
assert.deepEqual(JSON.parse(storage.getItem('gb-highlights-v1')).map(x=>x.id),
 ['guard-a','guard-b','native'],'initial guard must preserve distinct anchored ranges');
storage.setItem('gb-highlights-v1',JSON.stringify([rangeB,rangeA,plainQuote]));
assert.deepEqual(JSON.parse(storage.getItem('gb-highlights-v1')).map(x=>x.id),
 ['guard-b','guard-a','native'],'future writes preserve both anchored ranges');
storage.setItem('gb-highlights-v1',JSON.stringify([rangeA,repeatedRange,rangeB]));
assert.deepEqual(JSON.parse(storage.getItem('gb-highlights-v1')).map(x=>x.id),
 ['guard-a','guard-b'],'repeated source range still dedupes');
assert.equal(guard.Storage.prototype.__gbHighlightDedupe,true,'guard must stay enabled');

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
assert.match(css, /#gb-hl-fab-count\s*\{[^}]*display:\s*none;/, 'library count dot must stay visually hidden');
assert.match(source, /fab\.setAttribute\('aria-label', 'Моя библиотека — сохранено ' \+ all\(\)\.length\)/, 'accessible library total must stay available');
console.log('✅ Unified reader library helpers, legacy storage, ARIA and dedupe regression passed');
