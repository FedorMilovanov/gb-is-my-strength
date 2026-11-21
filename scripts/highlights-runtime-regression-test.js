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
const context = { URL, location: { origin: 'https://gospod-bog.ru' }, window: {} };
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
// Colour marks: the same phrase highlighted in two places must stay two records,
// while a quote and its colouring stay one record (no duplicate in the library).
const markFirst = { id: 'mark-1', kind: 'marker', color: 'amber', text: 'Господь благ', url: '/articles/a/',
  before: 'первый контекст', after: 'конец первый' };
const markSecond = { id: 'mark-2', kind: 'marker', color: 'rose', text: 'Господь благ', url: '/articles/a/',
  before: 'второй контекст', after: 'конец второй' };
const twoMarks = plain(api.add(api.add([], markFirst), markSecond));
assert.deepEqual(twoMarks.map((x) => x.id), ['mark-2', 'mark-1'],
  'same phrase in two different places is two colour marks, not a duplicate');
assert.equal(plain(api.add(twoMarks, { ...markFirst, id: 'mark-1-repeat' })).length, 2,
  're-applying the same colour to the same place does not multiply records');
const quoteThenColour = plain(api.add([{ id: 'q', text: 'Господь благ', url: '/articles/a/', before: 'первый контекст', after: 'конец первый' }],
  { ...markFirst, id: 'mark-1' }));
assert.deepEqual(quoteThenColour.map((x) => x.id), ['mark-1', 'q'],
  'legacy quote and colour mark of the same fragment remain separate intents');

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
const mobileBarStart = source.indexOf('function mobileSelectionBar()');
const mobileBarEnd = source.indexOf('\n  function hide()', mobileBarStart);
assert.ok(mobileBarStart >= 0 && mobileBarEnd > mobileBarStart, 'mobile selection toolbar owner exists');
const mobileBarSource = source.slice(mobileBarStart, mobileBarEnd);
assert.match(mobileBarSource, /b\.addEventListener\('mousedown',\s*\(event\)\s*=>\s*event\.preventDefault\(\)/,
  'mouse down preserves text selection before toolbar click');
assert.match(mobileBarSource, /b\.addEventListener\('pointerdown',\s*rememberSelection\)/,
  'pointerdown may snapshot selection but must not cancel the native touch gesture');
const rememberStart = source.indexOf('function rememberSelection()');
const rememberEnd = source.indexOf('\n  function selection()', rememberStart);
assert.ok(rememberStart >= 0 && rememberEnd > rememberStart, 'selection snapshot handler exists');
assert.doesNotMatch(source.slice(rememberStart, rememberEnd), /\bpreventDefault\s*\(/,
  'selection snapshot handler must not cancel pointer/touch compatibility clicks');
assert.doesNotMatch(mobileBarSource, /addEventListener\(['"]touchstart['"]/,
  'touchstart must remain uncancelled so mobile compatibility clicks reach toolbar buttons');
assert.match(source, /setAttribute\('aria-hidden', 'false'\)/, 'modal open exposes its dialog');
assert.match(source, /setAttribute\('aria-hidden', 'true'\)/, 'modal close hides its dialog');
assert.match(source, /removeAttribute\('inert'\)/, 'opening modal restores interactions');
assert.match(source, /setAttribute\('inert', ''\)/, 'closed modal is inert');
assert.match(source, /gb-hl-quote.*is-collapsed|is-collapsed/, 'long text collapses');
const css = fs.readFileSync(path.resolve(__dirname, '..', 'css/highlights-runtime.css'), 'utf8');
assert.match(css, /prefers-reduced-motion/, 'reduced-motion users do not get forced animation');
assert.match(css, /#gb-hl-fab-count\s*\{[^}]*display:\s*none;/, 'library count dot must stay visually hidden');
const toastCss = css.match(/#gb-hl-toast\s*\{([^}]*)\}/);
assert.ok(toastCss, 'highlight confirmation toast styles exist');
assert.match(toastCss[1], /z-index:\s*var\(--z-toast-high,\s*9998\)/,
  'highlight toast stays above transient tips and below modal layers');
assert.match(toastCss[1], /width:\s*max-content/,
  'centered highlight toast must not shrink to half the mobile viewport');
assert.match(source, /fab\.setAttribute\('aria-label', 'Моя библиотека — сохранено ' \+ all\(\)\.length\)/, 'accessible library total must stay available');

// Position-safe native painting regression: same phrase on two pages, repeated
// text within one page, a changed source block and W57-owned anchors.
const locateStart = source.indexOf('  const REGEXP_SPECIAL =');
const locateEnd = source.indexOf('\n  function saveMarker(', locateStart);
assert.ok(locateStart >= 0 && locateEnd > locateStart, 'native mark resolver remains a single source owner');
let articleText = 'Начало Бог благ конец. Далее Бог благ снова.';
let savedMarks = [];
const paintRegistry = new Map();
const paintLocation = { origin: 'https://gospod-bog.ru', href: 'https://gospod-bog.ru/articles/a/' };
const painting = {
  location: paintLocation,
  URL,
  normalizeText: (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim(),
  gbHighlightPath: api.path, gbHighlightKey: api.key,
  MARK_COLORS: ['amber', 'sage', 'blue', 'lime', 'rose'],
  quotes: () => savedMarks,
  textIndex: () => ({ raw: articleText, nodes: [{ node: { textContent: articleText }, start: 0 }] }),
  document: {
    querySelector: () => ({ tagName: 'ARTICLE' }),
    createRange: () => ({
      setStart(_node, offset) { this.start = offset; },
      setEnd(_node, offset) { this.end = offset; },
      toString() { return articleText.slice(this.start, this.end); },
    }),
  },
  CSS: { highlights: paintRegistry },
  Highlight: class { constructor(...ranges) { this.ranges = ranges; } },
};
painting.window = { CSS: painting.CSS };
painting.GBReaderAnchors = { resolve: () => null };
vm.createContext(painting);
vm.runInContext(source.slice(locateStart, locateEnd) +
  '\nthis.paintAPI = { locate, paintMarks };', painting);
const paintOnce = (marks, text = 'Начало Бог благ конец. Далее Бог благ снова.', href = 'https://gospod-bog.ru/articles/a/') => {
  articleText = text;
  savedMarks = marks;
  paintLocation.href = href;
  paintRegistry.clear();
  return painting.paintAPI.paintMarks();
};
const firstMark = { id: 'first', kind: 'marker', color: 'amber',
  url: '/articles/a/', text: 'Бог благ', before: 'Начало', after: 'конец.' };
const secondMark = { id: 'second', kind: 'marker', color: 'amber',
  url: '/articles/a/', text: 'Бог благ', before: 'Далее', after: 'снова.' };
assert.equal(paintOnce([firstMark]).painted, 1, 'context resolves one saved mark');
assert.equal(paintRegistry.get('gb-hl-amber').ranges[0].toString(), 'Бог благ',
  'paint the phrase, not its surrounding context');
assert.equal(paintOnce([firstMark, secondMark]).painted, 2,
  'two equal phrases with distinct contexts remain independently placed');
assert.equal(paintOnce([firstMark], undefined, 'https://gospod-bog.ru/articles/b/').painted, 0,
  'stored mark from route A must never paint on route B');
assert.equal(paintRegistry.has('gb-hl-amber'), false, 'old custom highlights removed on route change');
assert.equal(paintOnce([{ ...firstMark, before: '', after: '' }]).painted, 0,
  'ambiguous legacy first-match must remain unresolved');
assert.equal(paintOnce([firstMark], 'Заменено Бог благ конец. Далее Бог благ снова.').painted, 0,
  'changed source context cannot reattach the marker to another quote');
assert.equal(paintOnce([{ ...firstMark, annotation: {
  version: 1, kind: 'marker', color: 'amber',
  anchor: { blockIndex: 0, start: 7, end: 15, exact: 'Бог благ' },
} }]).painted, 0, 'W57 positional annotation is painted only by the W57 resolver');

// Positional W57 anchors must never jump to a coincidental paragraph after the
// identified source changes. In an id-less relocation, accept only a unique
// match whose full original block fingerprint and local context both survive.
const anchorSourceStart = source.indexOf('  function normalizeText(value)');
const anchorSourceEnd = source.indexOf('\n  function gbHighlightPath(item)', anchorSourceStart);
assert.ok(anchorSourceStart >= 0 && anchorSourceEnd > anchorSourceStart,
  'shared positional anchor resolver remains extractable');
function makeAnchorBlock(id, text) {
  const block = {
    id, tagName: 'P', textContent: text,
    closest() { return null; },
  };
  block.firstChild = { nodeType: 3, nodeValue: text, parentElement: block };
  return block;
}
function makeAnchorArticle(blocks) {
  return {
    querySelectorAll() { return blocks; },
    querySelector(selector) {
      const id = selector.startsWith('#') ? selector.slice(1) : '';
      return blocks.find((block) => block.id === id) || null;
    },
  };
}
const anchorDocument = {
  createTreeWalker(block) {
    let visited = false;
    return { nextNode() { if (visited) return null; visited = true; return block.firstChild; } };
  },
  createRange() {
    return {
      setStart(node, offset) { this.startContainer = node; this.startOffset = offset; },
      setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; },
      toString() {
        return this.startContainer === this.endContainer
          ? this.startContainer.nodeValue.slice(this.startOffset, this.endOffset) : '';
      },
    };
  },
};
const anchorContext = {
  URL, location: { origin: 'https://gospod-bog.ru' }, window: {}, document: anchorDocument,
  NodeFilter: { SHOW_TEXT: 4 }, CSS: { escape: (value) => String(value) },
  getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
};
vm.createContext(anchorContext);
vm.runInContext(source.slice(anchorSourceStart, anchorSourceEnd), anchorContext);
const positional = anchorContext.window.GBReaderAnchors;
assert.ok(positional && typeof positional.resolve === 'function', 'shared positional resolver is exposed');
const normalizeAnchorBlock = (value) => String(value).replace(/\s+/g, ' ').trim();
function positionalHash(value) {
  let hash = 2166136261;
  const text = normalizeAnchorBlock(value);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
function makeAnchor(block, start, end, blockIndex = 0, blockId = block.id) {
  const raw = block.firstChild.nodeValue;
  return {
    projection: 'reader-visible-v1', blockId, blockIndex, start, end,
    exact: raw.slice(start, end), prefix: raw.slice(Math.max(0, start - 64), start),
    suffix: raw.slice(end, end + 64), blockHash: positionalHash(raw),
  };
}
const originalContext = 'Начало Бог благ конец.';
const decoy = makeAnchorBlock('repeat-source', 'Начало Бог благ конец. Далее Бог благ снова.');
const changedSource = makeAnchorBlock('changed-source', originalContext);
const changedAnchor = makeAnchor(changedSource, 7, 15, 1);
changedSource.firstChild.nodeValue = changedSource.textContent = 'Измено Бог благ конец.';
assert.equal(positional.resolve(makeAnchorArticle([decoy, changedSource]), changedAnchor), null,
  'changed identified source must fail closed instead of reattaching to another matching paragraph');

const oldPositionText = 'Начало Бог благ конец.';
const reflowed = makeAnchorBlock('reflowed-source', oldPositionText);
const reflowedAnchor = makeAnchor(reflowed, 7, 15);
reflowed.firstChild.nodeValue = reflowed.textContent = 'Дополнение. Начало Бог благ конец.';
const inBlockMove = positional.resolve(makeAnchorArticle([reflowed]), reflowedAnchor);
assert.equal(inBlockMove?.toString(), 'Бог благ',
  'an identified block may relocate its unique text when local context survives');
assert.equal(inBlockMove?.startOffset, 'Дополнение. Начало '.length,
  'in-block relocation resolves to the moved occurrence');

const repeatedText = 'Начало Бог благ конец. Далее Бог благ снова.';
const repeatedBlock = makeAnchorBlock('repeat-source', repeatedText);
const repeatedStart = repeatedText.lastIndexOf('Бог благ');
const repeatedAnchor = makeAnchor(repeatedBlock, repeatedStart, repeatedStart + 'Бог благ'.length, 0, '');
const insertedBefore = makeAnchorBlock('inserted', 'Новый материал перед исходным абзацем.');
const shifted = positional.resolve(makeAnchorArticle([insertedBefore, repeatedBlock]), repeatedAnchor);
assert.equal(shifted?.toString(), 'Бог благ',
  'id-less relocation may resolve a unique occurrence using full-block and local-context fingerprints');
assert.equal(shifted?.startOffset, repeatedStart,
  'repeated text resolves only at the originally captured contextual occurrence');

const movedUnique = makeAnchorBlock('moved-unique', 'Свидетельство: Христос силён и благ навсегда.');
const uniqueStart = movedUnique.firstChild.nodeValue.indexOf('Христос силён');
const uniqueAnchor = makeAnchor(movedUnique, uniqueStart, uniqueStart + 'Христос силён'.length, 0, 'missing-source-id');
const unique = positional.resolve(makeAnchorArticle([movedUnique]), uniqueAnchor);
assert.equal(unique?.toString(), 'Христос силён',
  'a uniquely relocated unchanged block still resolves when its old id disappears');

const duplicateA = makeAnchorBlock('duplicate-a', repeatedText);
const duplicateB = makeAnchorBlock('duplicate-b', repeatedText);
assert.equal(positional.resolve(makeAnchorArticle([duplicateA, duplicateB]), repeatedAnchor), null,
  'identical duplicated blocks remain ambiguous without a stable id');

console.log('✅ Unified reader library helpers, visible positional anchors, storage, ARIA and dedupe regression passed');
