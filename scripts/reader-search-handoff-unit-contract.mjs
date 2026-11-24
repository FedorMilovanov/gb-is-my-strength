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
  return { storage, document, documentListeners, windowListeners, events, selection, ranges, heading, exactBlock, location, input, selectedItem, clickedItem, palette, prepare: window.GBReaderSearchHandoff.prepare };
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

// The actual result URL is the authority, even if a different preview is
// selected. W57's presentation is included before the one navigation.
{
  const state = harness({ search: '?reader-pilot=1&paper=space&panel=open', selectedHref:'/articles/other/' });
  const href=state.prepare('/articles/gill-ii/?source=test#literal', 'беспрецедентный');
  const url=new URL(href);
  assert.equal(url.pathname,'/articles/gill-ii/');
  assert.equal(url.searchParams.get('source'),'test');
  assert.equal(url.hash,'#literal');
  assert.equal(url.searchParams.get('reader-pilot'),'1');
  assert.equal(url.searchParams.get('paper'),'space');
  assert.equal(url.searchParams.get('panel'),'open');
  const captured=JSON.parse(state.storage.get(KEY));
  assert.equal(captured.query,'беспрецедентный');
  assert.equal(captured.path,'/articles/gill-ii/');
  assert.equal(captured.pilot,true);
  assert.equal(captured.paper,'space');
  assert.equal(captured.panel,'open');
  assert.equal(state.location.replaced,null,'prepare never navigates');
}

// Invalid/external destinations and invalid queries discard stale handoffs.
{
  const state=harness();
  state.prepare('/articles/gill-ii/','беспрецедентный');
  assert.equal(state.storage.has(KEY),true);
  assert.equal(state.prepare('https://elsewhere.test/article/','беспрецедентный'),'https://elsewhere.test/article/');
  assert.equal(state.storage.has(KEY),false);
  state.prepare('/articles/gill-ii/','беспрецедентный');
  state.prepare('/articles/gill-ii/','x');
  assert.equal(state.storage.has(KEY),false);
}

// Single navigation: validated destination already carries presentation.
{
  const state=harness({entry:entry('/articles/gill-ii/',{pilot:true,paper:'space',panel:'open'}),
    search:'?reader-pilot=1&paper=space&panel=open'});
  assert.equal(state.location.replaced,null);
  assert.equal(state.storage.has(KEY),false);
  assert.equal(state.document.activeElement,state.heading);
}

// No second redirect even if a legacy in-flight handoff lacks presentation.
{
  const state=harness({entry:entry('/articles/gill-ii/',{pilot:true})});
  assert.equal(state.location.replaced,null);
  assert.equal(state.storage.has(KEY),false);
  assert.equal(state.document.activeElement,null);
}

// Same-document hash changes are consumed through the same owner.
{
  const state=harness({literalOccurrence:true});
  state.prepare('/articles/gill-ii/#literal','беспрецедентный');
  state.location.hash='#literal';
  state.location.href=state.location.origin+state.location.pathname+'#literal';
  state.windowListeners.get('hashchange')();
  assert.equal(state.storage.has(KEY),false);
  assert.equal(state.document.activeElement,state.exactBlock);
  assert.equal(state.location.hash,'#literal');
}

// Default product does not add an explicit opt-in or change arbitrary params.
{
  const state=harness();
  const url=new URL(state.prepare('/articles/gill-ii/?x=1','беспрецедентный'));
  assert.equal(url.searchParams.get('reader-pilot'),null);
  assert.equal(url.searchParams.get('x'),'1');
  assert.equal(JSON.parse(state.storage.get(KEY)).pilot,false);
}

console.log('reader-search-handoff unit contract: PASS (10 cases)');
