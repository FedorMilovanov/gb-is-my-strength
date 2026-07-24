#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/reader-state.js'), 'utf8');

function loadApi() {
  const storage = new Map();
  const session = new Map();
  const listeners = new Map();
  const documentListeners = new Map();
  const documentElement = {
    clientHeight: 800,
    getAttribute() { return null; },
  };
  const document = {
    readyState: 'complete',
    title: 'Reader test',
    documentElement,
    body: { getAttribute() { return null; } },
    fonts: null,
    visibilityState: 'visible',
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    addEventListener(type, fn) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      documentListeners.set(type, (documentListeners.get(type) || []).filter((item) => item !== fn));
    },
  };
  const makeStore = (map) => ({
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  });
  const window = {
    document,
    SITE_CONFIG: { site: { id: 'reader-test' } },
    location: { pathname: '/article/', hash: '' },
    scrollY: 0,
    pageYOffset: 0,
    innerHeight: 800,
    localStorage: makeStore(storage),
    sessionStorage: makeStore(session),
    matchMedia() { return { matches: false }; },
    getComputedStyle() { return { getPropertyValue() { return '0'; } }; },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) || []).filter((item) => item !== fn));
    },
    dispatchEvent() { return true; },
    setTimeout,
    clearTimeout,
    scrollTo() {},
  };
  class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }
  const context = vm.createContext({
    window,
    document,
    CustomEvent,
    console,
    Date,
    JSON,
    Object,
    Number,
    Math,
    String,
    Array,
    Map,
    Set,
    Promise,
    setTimeout,
    clearTimeout,
    requestAnimationFrame(fn) { return setTimeout(fn, 0); },
    cancelAnimationFrame(id) { clearTimeout(id); },
    ResizeObserver: undefined,
  });
  vm.runInContext(source, context, { filename: 'js/reader-state.js' });
  return { api: window.GBReaderState, storage, listeners };
}


function loadMeasuredApi(seed = {}) {
  const storage = new Map(Object.entries(seed));
  const session = new Map();
  const windowListeners = new Map();
  const documentListeners = new Map();
  const attrs = new Map();
  const window = {
    scrollY: 0,
    pageYOffset: 0,
    innerHeight: 800,
    location: { pathname: '/series/part-one/', hash: '' },
    SITE_CONFIG: { site: { id: 'gb-strength' } },
    addEventListener(type, fn) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      windowListeners.set(type, (windowListeners.get(type) || []).filter((item) => item !== fn));
    },
    dispatchEvent() { return true; },
    matchMedia() { return { matches: false }; },
    getComputedStyle() { return { getPropertyValue() { return '0'; } }; },
    scrollTo(options) { this.scrollY = Number(options && options.top) || 0; this.pageYOffset = this.scrollY; },
    setTimeout,
    clearTimeout,
  };
  const makeStore = (map) => ({
    get length() { return map.size; },
    key(index) { return [...map.keys()][index] || null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  });
  window.localStorage = makeStore(storage);
  window.sessionStorage = makeStore(session);

  const heading = (id, title, absoluteTop) => ({
    id,
    textContent: title,
    hasAttribute() { return false; },
    getAttribute() { return null; },
    getBoundingClientRect() { return { top: absoluteTop - window.scrollY, height: 40 }; },
    scrollIntoView() { window.scrollY = absoluteTop; window.pageYOffset = absoluteTop; },
  });
  const headings = [heading('section-one', 'Section one', 700), heading('section-two', 'Section two', 1500)];
  const root = {
    textContent: Array(2000).fill('word').join(' '),
    offsetHeight: 2400,
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    getBoundingClientRect() { return { top: 400 - window.scrollY, height: 2400 }; },
    querySelectorAll(selector) { return selector === 'img' ? [] : headings; },
    contains(node) { return headings.includes(node); },
  };
  const body = {
    getAttribute(name) {
      if (name === 'data-gbs2-series') return 'test-series';
      return null;
    },
  };
  const document = {
    readyState: 'complete',
    title: 'Measured Reader',
    body,
    documentElement: { clientHeight: 800 },
    visibilityState: 'visible',
    fonts: null,
    querySelector(selector) {
      if (selector === '[data-gill-v16]') return null;
      if (selector === '[data-reading-minutes]') return null;
      return root;
    },
    querySelectorAll() { return []; },
    getElementById(id) { return headings.find((item) => item.id === id) || null; },
    addEventListener(type, fn) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      documentListeners.set(type, (documentListeners.get(type) || []).filter((item) => item !== fn));
    },
  };
  window.document = document;
  class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }
  const context = vm.createContext({
    window,
    document,
    CustomEvent,
    console,
    Date,
    JSON,
    Object,
    Number,
    Math,
    String,
    Array,
    Map,
    Set,
    Promise,
    setTimeout,
    clearTimeout,
    requestAnimationFrame(fn) { fn(); return 1; },
    cancelAnimationFrame() {},
  });
  vm.runInContext(source, context, { filename: 'js/reader-state.js' });
  return { api: window.GBReaderState, window, storage, session, windowListeners, root, headings };
}

const { api, listeners } = loadApi();
assert(api && api.version === 1, 'GBReaderState v1 API must mount even before a reading root exists');
assert.strictEqual(api.eventName, 'gb:reader-state-change');
const test = api.__test;

assert.strictEqual(test.normalizePath('/a/index.html?x=1#y'), '/a');
assert.strictEqual(test.normalizePath('/'), '/');
assert.strictEqual(test.normalizePath('/a///'), '/a');

const range = test.computeRangeFromBox({ top: 100, height: 2400 }, 400, 800, 80, 0);
assert.deepStrictEqual(JSON.parse(JSON.stringify(range)), { start: 420, end: 2100, height: 1680 });
assert.strictEqual(test.computeProgress(420, range).percent, 0);
assert.strictEqual(test.computeProgress(1260, range).percent, 50);
assert.strictEqual(test.computeProgress(2100, range).percent, 100);
assert.strictEqual(test.computeProgress(99999, range).percent, 100);

const sections = [
  { id: 'one', title: 'One', top: 600 },
  { id: 'two', title: 'Two', top: 1100 },
];
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(test.chooseActiveSection(sections, 500, 2200, 'before-content'))),
  { id: '', title: 'Введение', index: -1, count: 2 },
);
assert.strictEqual(test.chooseActiveSection(sections, 800, 2200, 'active-section').id, 'one');
assert.strictEqual(test.chooseActiveSection(sections, 1300, 2200, 'active-section').id, 'two');
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(test.chooseActiveSection(sections, 2400, 2200, 'after-content'))),
  { id: '', title: 'Завершено', index: 2, count: 2 },
);

const oldBookmark = { version: 4, progress: 42, scrollY: 900, sectionId: 's1', sectionTitle: 'Section', savedAt: 1000 };
const oldSeries = { pc: 55, y: 1200, t: 2000, dismissedAt: 1500 };
const migrated = test.migrateLegacyValues(oldBookmark, oldSeries);
assert.strictEqual(migrated.source, 'series-position');
assert.strictEqual(migrated.progress, 55);
assert.strictEqual(migrated.scrollY, 1200);
assert.strictEqual(migrated.dismissedAt, 1500);
assert.strictEqual(test.migrateLegacyValues(oldBookmark, null).source, 'bookmark-v4');

assert.strictEqual((source.match(/addEventListener\(['"]scroll['"]/g) || []).length, 1, 'ReaderState must own exactly one scroll listener');
assert(!source.includes('document.documentElement.scrollHeight - window.innerHeight'), 'ReaderState must never use whole-document progress');
assert(source.includes("'[data-reader-root] article.article-body'"), 'explicit standalone reading range must be supported');
assert(source.includes("'[data-gill-v16] article.article-body'"), 'series/book reading range must be supported');
assert(source.includes("'before-content'"));
assert(source.includes("'after-content'"));
assert(source.includes("'gb:reader-state-change'"));
assert(source.includes("'gb:reader-state:v1:'"));
assert.strictEqual((listeners.get('scroll') || []).length, 0, 'no root means no runtime scroll owner');



const measured = loadMeasuredApi({
  'gb-series-pos:test-series:part-one': JSON.stringify({ y: 1200, pc: 44, t: 2000 }),
});
assert.strictEqual((measured.windowListeners.get('scroll') || []).length, 1, 'measured ReaderState must install exactly one scroll listener');
const firstMigrated = measured.api.getSaved();
assert.strictEqual(firstMigrated.progress, 44, 'legacy series progress must migrate through the route slug key');
assert.strictEqual(firstMigrated.source, 'series-position');
assert.strictEqual(measured.api.getSnapshot().phase, 'before-content');
assert.strictEqual(measured.api.getSnapshot().sectionTitle, 'Введение');
measured.window.scrollY = 900;
measured.window.pageYOffset = 900;
measured.api.measure();
assert.strictEqual(measured.api.getSnapshot().phase, 'active-section');
assert.strictEqual(measured.api.getSnapshot().sectionId, 'section-one');
assert(measured.api.getProgress() > 0 && measured.api.getProgress() < 100);
assert.strictEqual(measured.storage.has('gb:reader-state:v1:gb-strength:/series/part-one'), true, 'legacy migration must materialize canonical storage');
(measured.windowListeners.get('pointerdown') || []).forEach((fn) => fn({ type: 'pointerdown' }));
measured.api.saveSnapshot(true);
const persisted = JSON.parse(measured.storage.get('gb:reader-state:v1:gb-strength:/series/part-one'));
assert.strictEqual(persisted.sectionId, 'section-one');
assert.strictEqual(persisted.source, 'reader-state-v1');
measured.window.scrollY = 2100;
measured.window.pageYOffset = 2100;
measured.api.measure();
assert.strictEqual(measured.api.getSnapshot().progress, 100);
assert.strictEqual(measured.api.getSnapshot().phase, 'after-content');
assert.strictEqual(measured.api.getSnapshot().sectionId, '');
assert.strictEqual(measured.api.getSnapshot().sectionTitle, 'Завершено');

const bookmarkSource = fs.readFileSync(path.join(ROOT, 'js/bookmark-engine.js'), 'utf8');
const mobileBarSource = fs.readFileSync(path.join(ROOT, 'src/components/article-pilots/hermenevtika/HermenevtikaMobileBar.astro'), 'utf8');
const railSource = fs.readFileSync(path.join(ROOT, 'src/components/article-pilots/_shared/ReaderRail.astro'), 'utf8');
const seriesControllerSource = fs.readFileSync(path.join(ROOT, 'js/floating-cluster-controller.js'), 'utf8');
const headSource = fs.readFileSync(path.join(ROOT, 'src/components/reader-platform/ReaderPreferencesHead.astro'), 'utf8');
const cacheAssetsSource = fs.readFileSync(path.join(ROOT, 'scripts/cache-bust-assets.js'), 'utf8');
const auditSource = fs.readFileSync(path.join(ROOT, 'scripts/audit-pro.js'), 'utf8');
const swSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

for (const [name, consumer] of [
  ['BookmarkEngine', bookmarkSource],
  ['HermenevtikaMobileBar', mobileBarSource],
  ['ReaderRail', railSource],
  ['floating-cluster-controller', seriesControllerSource],
]) {
  assert(consumer.includes('GBReaderState'), `${name} must consume GBReaderState`);
  assert(!consumer.includes('document.documentElement.scrollHeight - window.innerHeight'), `${name} must not calculate whole-document progress`);
}
assert(!/addEventListener\(['"]scroll['"]/.test(bookmarkSource), 'BookmarkEngine must not install a scroll owner');
assert(!/addEventListener\(['"]scroll['"]/.test(mobileBarSource), 'mobile bar must not install a scroll owner');
assert(!/addEventListener\(['"]scroll['"]/.test(railSource), 'desktop rail must not install a scroll owner');
assert(!seriesControllerSource.includes("addCleanListener(window, 'scroll'"), 'series/book chrome must not install a scroll owner');
assert(!seriesControllerSource.includes('gb-series-pos:'), 'series/book chrome must not write legacy position keys');
assert(!seriesControllerSource.includes('gb-resume-offered:'), 'series/book chrome must not own a legacy resume-session key');
assert(headSource.includes("assetUrl('js/reader-state.js')"), 'shared reader head must load ReaderState');
assert(cacheAssetsSource.includes("'js/reader-state.js'"), 'ReaderState must be cache-bust managed');
assert(auditSource.includes("'js/reader-state.js'"), 'ReaderState must be in the central JS allowlist');
assert(swSource.includes('"/js/reader-state.js"'), 'ReaderState must be precached');
assert(swSource.includes('gb-v192-reader-state-20260724'), 'ReaderState rollout must bump the SW cache namespace');

console.log('ReaderState regression: core geometry, phases, migration and single-owner contracts passed.');
