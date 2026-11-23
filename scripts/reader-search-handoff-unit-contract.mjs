import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const KEY = 'gb-reader-pagefind-hit-v1';
const source = readFileSync(new URL('../src/runtime/reader-search-handoff.js', import.meta.url), 'utf8');

function harness({
  entry = null,
  pathname = '/articles/gill-ii/',
  search = '',
  hash = '',
  articleExists = true,
  selectedHref = '/articles/gill-ii/',
  selectedIndex = '0',
  clickIndex = selectedIndex,
  query = 'беспрецедентный',
  literalOccurrence = false,
} = {}) {
  const origin = 'https://reader.test';
  const storage = new Map();
  if (entry) storage.set(KEY, JSON.stringify(entry));
  const documentListeners = new Map();
  const windowListeners = new Map();
  const events = [];
  const ranges = [];
  const selection = {
    cleared: false,
    selectedRanges: [],
    removeAllRanges() { this.cleared = true; this.selectedRanges.length = 0; },
    addRange(range) { this.selectedRanges.push(range); },
  };
  let document;

  class FakeHTMLElement {
    constructor() { this.attributes = new Map(); this.scrolled = false; }
    hasAttribute(name) { return this.attributes.has(name); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    addEventListener() {}
    getClientRects() { return [this]; }
    scrollIntoView() { this.scrolled = true; }
    focus() { document.activeElement = this; }
  }

  const heading = new FakeHTMLElement();
  const exactBlock = new FakeHTMLElement();
  exactBlock.closest = () => null;
  const exactText = 'Перед словом беспрецедентный после.';
  const textNode = { nodeValue: exactText, parentElement: { closest() { return null; } } };
  const main = {
    querySelector(selector) { return selector === 'h1' ? heading : null; },
    contains(node) { return node === heading; },
  };
  const article = articleExists ? {
    querySelector(selector) { return selector === 'h1' ? null : null; },
    querySelectorAll() { return literalOccurrence ? [exactBlock] : []; },
    closest(selector) { return selector === 'main' ? main : null; },
  } : null;
  const input = {
    value: query,
    matches(selector) { return selector.includes('.cp-input'); },
  };
  const selectedItem = { dataset: { idx: selectedIndex } };
  const clickedItem = { dataset: { idx: clickIndex } };
  const link = { getAttribute() { return selectedHref; }, href: new URL(selectedHref, origin).href };
  const palette = {
    querySelector(selector) {
      if (selector === '.cp-input') return input;
      if (selector === '#cp-listbox .cp-item[aria-selected="true"]') return selectedItem;
      if (selector === '#cp-read-btn') return link;
      return null;
    },
  };
  const location = {
    origin,
    pathname,
    search,
    hash,
    href: `${origin}${pathname}${search}${hash}`,
    replaced: null,
    replace(value) { this.replaced = value; },
  };
  const history = {
    state: null,
    replaced: null,
    replaceState(_state, _title, value) {
      this.replaced = value;
      const next = new URL(value);
      location.pathname = next.pathname;
      location.search = next.search;
      location.hash = next.hash;
      location.href = next.href;
    },
  };

  document = {
    readyState: 'complete',
    activeElement: null,
    querySelector(selector) {
      if (selector === 'article.article-body' || selector === 'article[data-pagefind-body]') return article;
      if (selector === '.cp-backdrop.is-open') return palette;
      if (selector === '.cp-backdrop.is-open .cp-input') return input;
      if (selector === '.cp-backdrop.is-open #cp-listbox .cp-item[aria-selected="true"]') return selectedItem;
      if (selector === '.cp-backdrop.is-open #cp-listbox .cp-item') return selectedItem;
      return null;
    },
    addEventListener(type, listener) { documentListeners.set(type, listener); },
    dispatchEvent(event) { events.push(event); return true; },
    createTreeWalker() {
      let visited = false;
      return { nextNode() {
        if (!literalOccurrence || visited) return null;
        visited = true;
        return textNode;
      } };
    },
    createRange() {
      const range = {
        start: null,
        end: null,
        setStart(node, offset) { this.start = { node, offset }; },
        setEnd(node, offset) { this.end = { node, offset }; },
      };
      ranges.push(range);
      return range;
    },
  };
  const window = {
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    getSelection() { return selection; },
  };
  const context = {
    document, window, location, history, URL, URLSearchParams, Date, HTMLElement: FakeHTMLElement,
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    sessionStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
      removeItem(key) { storage.delete(key); },
    },
    NodeFilter: { SHOW_TEXT: 4 },
    getComputedStyle() { return { display: 'block', visibility: 'visible' }; },
  };
  vm.runInNewContext(source, context, { filename: 'reader-search-handoff.js' });
  return { storage, document, documentListeners, windowListeners, events, selection, ranges, heading, exactBlock, location, input, selectedItem, clickedItem, palette };
}

function entry(path = '/articles/gill-ii/', extra = {}) {
  return { query: 'беспрецедентный', path, timestamp: Date.now(), pilot: false, paper: null, panel: null, ...extra };
}

// Morphological result: validated destination + article root, honest H1 focus,
// no guessed text selection, and a consumed one-shot record.
{
  const state = harness({ entry: entry(), hash: '#pagefind-excerpt-anchor' });
  assert.equal(state.storage.has(KEY), false, 'fallback consumes the handoff');
  assert.equal(state.document.activeElement, state.heading, 'article heading receives focus');
  assert.equal(state.location.hash, '', 'morphology does not retain an inferred Pagefind fragment');
  assert.equal(state.heading.scrolled, true, 'article heading is brought into view');
  assert.equal(state.selection.cleared, true, 'fallback does not imply a precise word match');
  const fallback = state.events.find(event => event.type === 'gb:search-source-fallback');
  assert.equal(fallback?.detail?.reason, 'literal-occurrence-not-found');
  assert.equal(fallback?.detail?.targetPath, '/articles/gill-ii/');
  assert.equal(fallback?.detail?.fallbackFocused, true);
  assert.equal(state.events.some(event => event.type === 'gb:search-source-focused'), false);
}

// Exact literal matches keep the source paragraph, range selection and
// focused block; article-heading fallback must not replace this behavior.
{
  const state = harness({ entry: entry(), literalOccurrence: true, hash: '#literal-source-anchor' });
  const expectedStart = 'Перед словом '.length;
  assert.equal(state.storage.has(KEY), false, 'exact handoff is consumed');
  assert.equal(state.document.activeElement, state.exactBlock, 'source paragraph receives focus');
  assert.equal(state.exactBlock.scrolled, true, 'source paragraph is brought into view');
  assert.equal(state.location.hash, '#literal-source-anchor', 'exact hit preserves its source fragment');
  assert.equal(state.ranges.length, 1, 'exact literal creates one range');
  assert.equal(state.ranges[0].start.node.nodeValue, 'Перед словом беспрецедентный после.');
  assert.equal(state.ranges[0].start.offset, expectedStart);
  assert.equal(state.ranges[0].end.offset, expectedStart + 'беспрецедентный'.length);
  assert.equal(state.selection.selectedRanges[0], state.ranges[0]);
  assert.equal(state.events.some(event => event.type === 'gb:search-source-focused'), true);
  assert.equal(state.events.some(event => event.type === 'gb:search-source-fallback'), false);
}

// A stale entry may not focus or hijack a different destination.
{
  const state = harness({ entry: entry('/articles/gill-ii/'), pathname: '/articles/other/' });
  assert.equal(state.storage.has(KEY), false, 'mismatched one-shot is discarded');
  assert.equal(state.document.activeElement, null, 'mismatched destination receives no focus');
  assert.equal(state.events.length, 0, 'mismatch is not reported as a source match/fallback');
}

// Without an article root there is no article-level target; still consume the
// one-shot and make the unresolved destination observable without guessing.
{
  const state = harness({ entry: entry(), articleExists: false });
  assert.equal(state.storage.has(KEY), false);
  assert.equal(state.document.activeElement, null);
  const fallback = state.events.find(event => event.type === 'gb:search-source-fallback');
  assert.equal(fallback?.detail?.reason, 'article-root-not-found');
  assert.equal(fallback?.detail?.fallbackFocused, false);
}

// Keyboard activation records the selected preview's same-origin destination;
// the W57 pilot state stays attached to the exact result handoff.
{
  const state = harness({ search: '?reader-pilot=1&paper=space&panel=open' });
  state.document.activeElement = state.input;
  state.documentListeners.get('keydown')({
    key: 'Enter', defaultPrevented: false,
    ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
  });
  const captured = JSON.parse(state.storage.get(KEY));
  assert.equal(captured.query, 'беспрецедентный');
  assert.equal(captured.path, '/articles/gill-ii/');
  assert.equal(captured.pilot, true);
  assert.equal(captured.paper, 'space');
  assert.equal(captured.panel, 'open');
}

// A clicked item must be the selected preview, and external destinations are
// never accepted as this same-origin article handoff.
{
  const mismatchedClick = harness({ clickIndex: '1', selectedIndex: '0' });
  mismatchedClick.documentListeners.get('click')({
    button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
    target: { closest() { return mismatchedClick.clickedItem; } },
  });
  assert.equal(mismatchedClick.storage.has(KEY), false, 'click on a non-selected preview is not captured');

  const external = harness({ selectedHref: 'https://elsewhere.test/article/' });
  external.documentListeners.get('keydown')({
    key: 'Enter', defaultPrevented: false,
    ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
  });
  assert.equal(external.storage.has(KEY), false, 'cross-origin result is not captured');
}

// A W57 destination redirect is one-shot and preserves its pilot presentation
// before the validated article-level fallback is consumed on the reloaded URL.
{
  const state = harness({ entry: entry('/articles/gill-ii/', { pilot: true, paper: 'space', panel: 'open' }) });
  assert.match(state.location.replaced, /reader-pilot=1/);
  assert.match(state.location.replaced, /paper=space/);
  assert.match(state.location.replaced, /panel=open/);
  assert.equal(state.storage.has(KEY), true, 'keep the handoff across the one W57 opt-in redirect');
  state.location.search = '?reader-pilot=1&paper=space&panel=open';
  state.location.href = `${state.location.origin}${state.location.pathname}${state.location.search}`;
  state.windowListeners.get('pageshow')();
  assert.equal(state.storage.has(KEY), false, 'consume after the validated W57 destination reload');
  assert.equal(state.document.activeElement, state.heading);
}

console.log('reader-search-handoff unit contract: PASS (7 cases)');
