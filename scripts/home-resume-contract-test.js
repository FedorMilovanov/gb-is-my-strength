#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/home-resume.js'), 'utf8');
const component = fs.readFileSync(path.join(ROOT, 'src/components/home/HomeSections/ResumeMobile.astro'), 'utf8');

function load(seed = {}, now = 2_000_000) {
  const storage = new Map(Object.entries(seed));
  const localStorage = {
    get length() { return storage.size; },
    key(index) { return [...storage.keys()][index] || null; },
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
  };
  const document = {
    readyState: 'complete',
    getElementById() { return null; },
    addEventListener() {},
    createElement() { throw new Error('render not expected in inventory contract'); },
  };
  const window = {
    SITE_CONFIG: { site: { id: 'gb-strength' }, features: { homepageResume: { enabled: true, maxItems: 5 } } },
    GBReaderState: { version: 1 },
    localStorage,
    document,
  };
  class FixedDate extends Date { static now() { return now; } }
  const context = vm.createContext({ window, document, Date: FixedDate, JSON, Object, Number, Math, String, Array, console, encodeURIComponent });
  vm.runInContext(source, context, { filename: 'home-resume.js' });
  return { api: window.GBHomeResume, readerState: window.GBReaderState, storage };
}

const prefix = 'gb:reader-state:v1:gb-strength:';
const now = 2_000_000;
const seed = {
  [prefix + '/articles/current']: JSON.stringify({ routePath: '//evil.example/tampered', title: 'Current', progress: 61, savedAt: now - 10 }),
  [prefix + '/articles/older']: JSON.stringify({ title: '<img src=x onerror=alert(1)> Older', progress: 35, savedAt: now - 20 }),
  [prefix + '//evil.example/trap']: JSON.stringify({ title: 'Trap', progress: 90, savedAt: now + 100 }),
  [prefix + '/articles/completed']: JSON.stringify({ title: 'Done', progress: 100, completed: true, savedAt: now + 50 }),
  [prefix + '/articles/low']: JSON.stringify({ title: 'Low', progress: 2, savedAt: now + 40 }),
  [prefix + '/articles/dismissed']: JSON.stringify({ title: 'Dismissed', progress: 30, savedAt: now + 30, dismissedAt: now - 1000 }),
  ['gb:reader-state:v1:other-site:/articles/foreign']: JSON.stringify({ title: 'Foreign', progress: 70, savedAt: now + 200 }),
};

const { api, readerState, storage } = load(seed, now);
assert(api && typeof api.listSaved === 'function' && typeof api.dismissSaved === 'function');
assert.strictEqual(readerState.listSaved, api.listSaved);
assert.strictEqual(readerState.dismissSaved, api.dismissSaved);

const listed = api.listSaved({ maxItems: 5 });
assert.deepStrictEqual(Array.from(listed, (item) => item.routePath), ['/articles/current', '/articles/older']);
assert.strictEqual(listed[0].routePath, '/articles/current', 'storage key must outrank mutable JSON routePath');
assert.strictEqual(listed[1].title, '<img src=x onerror=alert(1)> Older');
assert(!listed.some((item) => item.routePath.startsWith('//')));
assert(!listed.some((item) => item.completed));

assert.strictEqual(api.dismissSaved('//evil.example/nope'), false);
assert.strictEqual(api.dismissSaved('/articles/current'), true);
const persisted = JSON.parse(storage.get(prefix + '/articles/current'));
assert.strictEqual(persisted.dismissedAt, now);
assert.deepStrictEqual(Array.from(api.listSaved({ maxItems: 5 }), (item) => item.routePath), ['/articles/older']);

assert(component.includes("assetUrl('js/reader-state.js')"));
assert(component.includes("assetUrl('js/home-resume.js')"));
assert(component.includes('id="resumeReadingProgressTrack"'));
assert(!component.includes('href="#"'));
assert(!source.includes('innerHTML'));
assert(source.includes('textContent'));
assert(source.includes("value.startsWith('//')"));
assert(source.includes("key.slice(prefix.length)"));

console.log('HOME RESUME CONTRACT: PASS');
