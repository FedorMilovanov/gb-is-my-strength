#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const clientSource = read('src/components/home/HomeResumeClient.js');
const resumeComponent = read('src/components/home/HomeSections/ResumeMobile.astro');

function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    store: {
      get length() { return map.size; },
      key(index) { return [...map.keys()][index] ?? null; },
      getItem(key) { return map.has(key) ? map.get(key) : null; },
      setItem(key, value) { map.set(key, String(value)); },
      removeItem(key) { map.delete(key); },
    },
  };
}

function runClient({ seed = {}, document, siteConfig }) {
  const storage = makeStorage(seed);
  const window = {
    SITE_CONFIG: siteConfig || { site: { id: 'gb-strength' } },
    localStorage: storage.store,
    GBReaderState: { version: 1, __test: {} },
  };
  const context = vm.createContext({
    window,
    document: document || {
      readyState: 'complete',
      getElementById() { return null; },
      createElement() { return null; },
      addEventListener() {},
    },
    console,
    Date,
    JSON,
    Object,
    Number,
    Math,
    String,
    Array,
    encodeURIComponent,
  });
  vm.runInContext(clientSource, context, { filename: 'src/components/home/HomeResumeClient.js' });
  return { api: window.GBReaderState, storage: storage.map };
}

const now = Date.now();
const prefix = 'gb:reader-state:v1:gb-strength:';
const inventory = runClient({
  seed: {
    [prefix + '/articles/older']: JSON.stringify({ title: 'Older', progress: 31, scrollY: 210, savedAt: now - 5000, source: 'reader-state-v1' }),
    [prefix + '/articles/newer']: JSON.stringify({ title: 'Newer', routePath: '//tampered.example', progress: 64, scrollY: 345, savedAt: now - 1000, sectionId: 'part 2', source: 'reader-state-v1', customField: 'keep-me' }),
    [prefix + '/articles/completed']: JSON.stringify({ title: 'Done', progress: 100, completed: true, savedAt: now }),
    [prefix + '/articles/low']: JSON.stringify({ title: 'Low', progress: 2, savedAt: now }),
    [prefix + '//evil.example']: JSON.stringify({ title: 'Protocol relative', progress: 40, savedAt: now }),
    'gb:reader-state:v1:other-site:/articles/foreign': JSON.stringify({ title: 'Foreign', progress: 50, savedAt: now }),
  },
});

assert.strictEqual(typeof inventory.api.listSaved, 'function', 'homepage adapter must expose bounded listSaved on canonical ReaderState API');
assert.strictEqual(typeof inventory.api.dismissSaved, 'function', 'homepage adapter must expose dismissSaved on canonical ReaderState API');
const invTest = inventory.api.__test.savedInventory;
assert(invTest, 'inventory test hooks must remain available');
assert.strictEqual(invTest.safeRoutePath('/articles/a/'), '/articles/a');
assert.strictEqual(invTest.safeRoutePath('/'), null);
assert.strictEqual(invTest.safeRoutePath('//evil.example'), null);
assert.strictEqual(invTest.safeRoutePath('https://evil.example/a'), null);
assert.strictEqual(invTest.safeRoutePath('/articles\\evil'), null);
assert.strictEqual(invTest.safeRoutePath('/articles/a?x=1'), null);
assert.strictEqual(invTest.safeRoutePath('/articles//a'), null);

const listed = inventory.api.listSaved({ maxItems: 10, now });
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(listed.map((item) => item.routePath))),
  ['/articles/newer', '/articles/older'],
  'inventory must keep only incomplete same-site records and sort newest first',
);
assert.strictEqual(listed[0].routePath, '/articles/newer', 'storage key must own route authority over tampered snapshot.routePath');
assert.strictEqual(listed[0].title, 'Newer');
assert.strictEqual(listed[0].progress, 64);
assert.strictEqual(listed[0].sectionId, 'part 2');

assert.strictEqual(inventory.api.dismissSaved('//evil.example'), false, 'unsafe route dismissal must fail closed');
assert.strictEqual(inventory.api.dismissSaved('/articles/newer'), true, 'canonical route must be dismissible');
const dismissedRaw = JSON.parse(inventory.storage.get(prefix + '/articles/newer'));
assert.strictEqual(dismissedRaw.routePath, '/articles/newer', 'dismissal must repair routePath to storage-key authority');
assert.strictEqual(dismissedRaw.progress, 64, 'dismissal must preserve canonical progress');
assert.strictEqual(dismissedRaw.scrollY, 345, 'dismissal must preserve restore geometry');
assert.strictEqual(dismissedRaw.source, 'reader-state-v1', 'dismissal must preserve canonical source metadata');
assert.strictEqual(dismissedRaw.customField, 'keep-me', 'dismissal must not destructively rewrite unrelated canonical fields');
assert(Number(dismissedRaw.dismissedAt) > 0, 'dismissal must stamp dismissedAt');
const afterDismiss = inventory.api.listSaved({ maxItems: 10, now: dismissedRaw.dismissedAt + 1000 });
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(afterDismiss.map((item) => item.routePath))),
  ['/articles/older'],
  'recently dismissed record must disappear without deleting its canonical state',
);

function makeElement(tagName = 'div') {
  const listeners = new Map();
  const children = [];
  const element = {
    tagName: String(tagName).toUpperCase(),
    hidden: false,
    className: '',
    textContent: '',
    href: '',
    style: {},
    dataset: {},
    children,
    append(...nodes) { children.push(...nodes); },
    replaceChildren(...nodes) { children.splice(0, children.length, ...nodes); },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeAttribute(name) { if (name === 'href') this.href = ''; },
    __click() { const fn = listeners.get('click'); if (fn) fn({ type: 'click' }); },
  };
  return element;
}

const ids = [
  'resumeReadingBlock', 'resumeReadingTitle', 'resumeReadingMeta', 'resumeReadingProgress',
  'resumeReadingLink', 'resumeReadingDismiss', 'resumeListBlock', 'resumeList',
];
const elements = Object.fromEntries(ids.map((id) => [id, makeElement(id === 'resumeReadingLink' ? 'a' : 'div')]));
elements.resumeReadingBlock.hidden = true;
elements.resumeListBlock.hidden = true;
const uiNow = Date.now();
const uiPrefix = 'gb:reader-state:v1:gb-strength:';
const uiDocument = {
  readyState: 'complete',
  getElementById(id) { return elements[id] || null; },
  createElement(tag) { return makeElement(tag); },
  addEventListener() {},
};
const ui = runClient({
  document: uiDocument,
  siteConfig: {
    site: { id: 'gb-strength' },
    features: { homepageResume: { enabled: true, maxItems: 5 } },
  },
  seed: {
    [uiPrefix + '/articles/one']: JSON.stringify({ title: 'One', sectionId: 'part 1', sectionTitle: 'Part One', progress: 44, scrollY: 120, savedAt: uiNow }),
    [uiPrefix + '/articles/two']: JSON.stringify({ title: 'Two', sectionId: '', sectionTitle: '', progress: 22, scrollY: 80, savedAt: uiNow - 1000 }),
  },
});

assert.strictEqual(elements.resumeReadingBlock.hidden, false, 'real saved progress must reveal primary resume block');
assert.strictEqual(elements.resumeReadingTitle.textContent, 'One');
assert.strictEqual(elements.resumeReadingMeta.textContent, 'Part One · 44% прочитано');
assert.strictEqual(elements.resumeReadingProgress.style.width, '44%');
assert.strictEqual(elements.resumeReadingLink.href, '/articles/one#part%201');
assert.strictEqual(elements.resumeListBlock.hidden, false, 'second real saved item must reveal bounded list');
assert.strictEqual(elements.resumeList.children.length, 1);
assert.strictEqual(elements.resumeList.children[0].href, '/articles/two');
assert.strictEqual(elements.resumeList.children[0].children[0].children[0].textContent, 'Two');

elements.resumeReadingDismiss.__click();
assert.strictEqual(elements.resumeReadingTitle.textContent, 'Two', 'dismissal must immediately advance to next saved item');
assert.strictEqual(elements.resumeReadingLink.href, '/articles/two');
assert.strictEqual(elements.resumeListBlock.hidden, true, 'list must hide when only one saved item remains');
assert(Number(JSON.parse(ui.storage.get(uiPrefix + '/articles/one')).dismissedAt) > 0, 'UI dismissal must persist on the canonical first record');

elements.resumeReadingDismiss.__click();
assert.strictEqual(elements.resumeReadingBlock.hidden, true, 'dismissing final record must hide resume shell');
assert.strictEqual(elements.resumeReadingLink.href, '', 'hidden shell must not retain stale navigation target');

assert(!/\binnerHTML\b/.test(clientSource), 'homepage adapter must never build saved-state UI through innerHTML');
assert(!/\bwindow\.scrollY\b/.test(clientSource), 'homepage adapter must not become a reading-progress geometry owner');
assert(!/addEventListener\s*\(\s*['"]scroll['"]/.test(clientSource), 'homepage adapter must not install a progress scroll loop');
assert(clientSource.includes("var STORAGE_PREFIX = 'gb:reader-state:v1:'"), 'adapter must read only the canonical ReaderState namespace');
assert(clientSource.includes('textContent'), 'homepage must use textContent for saved titles/metadata');
assert(clientSource.includes('encodeURIComponent(item.sectionId)'), 'section fragment must be encoded');
assert(clientSource.includes("link.removeAttribute('href')"), 'hidden state must clear stale href');
assert(clientSource.includes("document.readyState === 'complete'"), 'adapter must not assume an Astro module runs after deferred ReaderState');
assert(clientSource.includes("document.addEventListener('DOMContentLoaded', start, { once: true })"), 'adapter must bind after deferred ReaderState is ready');

assert(resumeComponent.includes("assetUrl('js/reader-state.js')"), 'ResumeMobile must keep canonical ReaderState asset ownership');
assert(resumeComponent.includes("import '../HomeResumeClient.js';"), 'ResumeMobile must load the route-owned adapter through Astro bundling');
assert(!resumeComponent.includes('js/reader-state-inventory.js'), 'temporary public inventory asset must not return');
assert(!resumeComponent.includes('js/home-resume.js'), 'temporary public consumer asset must not return');
assert(!/id=["']resumeReadingLink["'][^>]*href=["']#["']/.test(resumeComponent), 'resume shell must not emit fake href="#"');
assert.strictEqual(fs.existsSync(path.join(ROOT, 'js/reader-state-inventory.js')), false, 'temporary public inventory file must be absent');
assert.strictEqual(fs.existsSync(path.join(ROOT, 'js/home-resume.js')), false, 'temporary public home consumer file must be absent');

console.log('HOMEPAGE RESUME OWNER CONTRACT: PASS');
