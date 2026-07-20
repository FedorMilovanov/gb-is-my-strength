#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync(process.argv[2] || 'js/site-utils.js', 'utf8');

class Style {
  constructor() {
    this.map = new Map();
    this.position = '';
    this.top = '';
    this.left = '';
    this.right = '';
    this.width = '';
    this.overflow = '';
    this.overscrollBehavior = '';
    this.paddingRight = '';
    this.scrollBehavior = '';
  }
  setProperty(key, value) {
    this.map.set(key, value);
    this[key.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
  }
  removeProperty(key) {
    this.map.delete(key);
    this[key.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = '';
  }
}

class ClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach((value) => this.values.add(value)); }
  remove(...values) { values.forEach((value) => this.values.delete(value)); }
  contains(value) { return this.values.has(value); }
}

class Element {
  constructor(id = '') {
    this.id = id;
    this.style = new Style();
    this.classList = new ClassList();
    this.attrs = {};
    this.inert = false;
  }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  removeAttribute(key) { delete this.attrs[key]; }
  getAttribute(key) { return this.attrs[key] ?? null; }
}

class Storage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
}

class MutationObserver {
  constructor(callback) { this.callback = callback; }
  observe() {}
}

const html = new Element('html');
const body = new Element('body');
const dialog = new Element('gb-hl-backdrop');
const document = {
  readyState: 'complete',
  body,
  documentElement: html,
  querySelector() { return null; },
  getElementById(id) { return id === 'gb-hl-backdrop' ? dialog : null; },
  addEventListener() {},
};
const localStorage = new Storage();
const window = {
  SiteUtils: {},
  Storage,
  localStorage,
  MutationObserver,
  location: { href: 'https://gospod-bog.ru/articles/a/' },
  innerWidth: 1200,
  scrollY: 250,
  pageYOffset: 250,
  addEventListener() {},
  scrollTo(x, y) { this.scrollY = y; },
};

const context = vm.createContext({
  window,
  document,
  localStorage,
  Storage,
  MutationObserver,
  URL,
  Set,
  Object,
  Array,
  String,
  Number,
  Math,
  JSON,
  console,
  queueMicrotask: (fn) => fn(),
  setInterval: () => 1,
  clearInterval() {},
});
vm.runInContext(source, context, { filename: 'site-utils.js' });

localStorage.setItem('gb-highlights-v1', JSON.stringify([
  { id: '1', text: '  Один   текст ', url: 'https://gospod-bog.ru/a/#x' },
  { id: '2', text: 'Один текст', url: 'https://gospod-bog.ru/a/?q=1' },
  { id: '3', text: 'Один текст', url: 'https://gospod-bog.ru/b/' },
]));
assert.equal(
  JSON.parse(localStorage.getItem('gb-highlights-v1')).length,
  2,
  'dedupe must preserve the same quote on a different page',
);

window.SiteUtils.lockScroll('sheet-a');
window.SiteUtils.lockScroll('sheet-b');
assert.equal(body.style.position, 'fixed');
window.SiteUtils.unlockScroll('sheet-a');
assert.equal(body.style.position, 'fixed', 'the second source must retain the lock');
window.SiteUtils.unlockScroll('sheet-b');
assert.equal(body.style.position, '', 'the final source must release the lock');

const lockFn = window.SiteUtils.lockScroll;
window.SiteUtils.lockScroll = function broken() {};
assert.strictEqual(window.SiteUtils.lockScroll, lockFn, 'site.js must not replace the coordinator');

assert.equal(dialog.getAttribute('aria-hidden'), 'true', 'the quotes dialog must start hidden');
assert.equal(dialog.inert, true, 'the hidden quotes dialog must be inert');

console.log('✅ runtime-integrity-test: dedupe + ARIA bootstrap + coordinated scroll lock');
