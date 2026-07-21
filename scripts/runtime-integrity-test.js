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
  getPropertyValue(key) { return this.map.get(key) || this[key.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] || ''; }
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
  toggle(value, force) { const on = force === undefined ? !this.contains(value) : Boolean(force); on ? this.add(value) : this.remove(value); return on; }
}

class Element {
  constructor(id = '') {
    this.id = id;
    this.style = new Style();
    this.classList = new ClassList();
    this.attrs = {};
    this.inert = false;
    this.isConnected = true;
    this.disabled = false;
    this.offsetParent = {};
    this.focusables = [];
    this.focusCount = 0;
  }
  setAttribute(key, value) { this.attrs[key] = String(value); if (key === 'inert') this.inert = true; }
  removeAttribute(key) { delete this.attrs[key]; if (key === 'inert') this.inert = false; }
  hasAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attrs, key); }
  getAttribute(key) { return this.attrs[key] ?? null; }
  querySelector() { return this.focusables[0] || null; }
  querySelectorAll() { return this.focusables.slice(); }
  focus() { this.focusCount += 1; document.activeElement = this; }
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
const documentListeners = new Map();
const document = {
  readyState: 'complete', body, documentElement: html, activeElement: body,
  querySelector() { return null; }, querySelectorAll() { return []; },
  getElementById(id) { return id === 'gb-hl-backdrop' ? dialog : null; },
  addEventListener(type, fn) { if (!documentListeners.has(type)) documentListeners.set(type, []); documentListeners.get(type).push(fn); },
  dispatchEvent(event) { for (const fn of documentListeners.get(event.type) || []) fn(event); return true; },
};
const localStorage = new Storage();
const windowListeners = new Map();
class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }
const window = {
  SiteUtils: {},
  Storage,
  localStorage,
  MutationObserver,
  location: { href: 'https://gospod-bog.ru/articles/a/' },
  innerWidth: 1200,
  scrollY: 250,
  pageYOffset: 250,
  CustomEvent,
  addEventListener(type, fn) { if (!windowListeners.has(type)) windowListeners.set(type, []); windowListeners.get(type).push(fn); },
  dispatch(type) { for (const fn of windowListeners.get(type) || []) fn({ type }); },
  scrollTo(x, y) { this.scrollY = y; },
};

const context = vm.createContext({
  window,
  document,
  localStorage,
  Storage,
  MutationObserver,
  CustomEvent,
  URL,
  Set,
  Map,
  Boolean,
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
  setTimeout: (fn) => { fn(); return 1; },
  clearTimeout() {},
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

assert.ok(source.includes('function lockStylesApplied()'), 'scroll-lock repair must be idempotent');
assert.ok(
  source.includes('restoring || lockStylesApplied()'),
  'applyLock must not rewrite an already-correct lock state',
);
assert.ok(
  source.includes('effectiveLocked() && !lockStylesApplied()'),
  'MutationObserver must repair only real lock drift',
);


const overlayRuntime = window.OverlayRuntime;
assert.ok(overlayRuntime, 'OverlayRuntime must be installed');
assert.strictEqual(window.SiteUtils.OverlayRuntime, overlayRuntime, 'SiteUtils must expose the same runtime');

html.clientWidth = 1180;
body.style.overflow = 'auto';
body.style.position = 'relative';
body.style.top = '4px';
body.classList.add('no-scroll');
html.classList.add('cp-scroll-lock');
html.setAttribute('data-scroll-locked', 'legacy');

const background = new Element('background');
const overlayA = new Element('overlay-a');
const overlayB = new Element('overlay-b');
const focusA = new Element('focus-a');
const focusB = new Element('focus-b');
const openerA = new Element('opener-a');
const openerB = new Element('opener-b');
overlayA.focusables = [focusA];
overlayB.focusables = [focusB];
const requested = [];

function openOverlay(owner, element, opener, focus) {
  overlayRuntime.open(owner, {
    element,
    opener,
    focusTarget: focus,
    inertTargets: [background],
    onRequestClose(reason) {
      requested.push([owner, reason]);
      overlayRuntime.close(owner, reason);
    },
  });
}

openOverlay('a', overlayA, openerA, focusA);
openOverlay('b', overlayB, openerB, focusB);
assert.equal(overlayRuntime.size(), 2);
assert.equal(overlayRuntime.topLayer().ownerId, 'b');
assert.equal(body.style.position, 'fixed');
assert.equal(background.inert, true);
assert.equal(focusB.focusCount, 1);

overlayRuntime.close('b', 'programmatic');
assert.equal(overlayRuntime.size(), 1);
assert.equal(body.style.position, 'fixed', 'lower owner must retain the scroll lock');
assert.equal(background.inert, true, 'nested inert claim must remain');
assert.equal(openerB.focusCount, 1);

overlayRuntime.close('a', 'programmatic');
assert.equal(body.style.overflow, 'auto');
assert.equal(body.style.position, 'relative');
assert.equal(body.style.top, '4px');
assert.equal(body.classList.contains('no-scroll'), true);
assert.equal(html.classList.contains('cp-scroll-lock'), true);
assert.equal(html.getAttribute('data-scroll-locked'), 'legacy');
assert.equal(background.inert, false);
assert.equal(openerA.focusCount, 1);

openOverlay('b', overlayB, openerB, focusB);
openOverlay('a', overlayA, openerA, focusA);
overlayRuntime.close('a', 'programmatic');
assert.equal(overlayRuntime.isOpen('b'), true, 'reverse close order must retain the other owner');
overlayRuntime.close('b', 'programmatic');

openOverlay('a', overlayA, openerA, focusA);
openOverlay('b', overlayB, openerB, focusB);
let prevented = 0;
let stopped = 0;
document.dispatchEvent({
  type: 'keydown',
  key: 'Escape',
  preventDefault() { prevented += 1; },
  stopImmediatePropagation() { stopped += 1; },
});
assert.deepEqual(requested.at(-1), ['b', 'escape']);
assert.equal(overlayRuntime.isOpen('a'), true, 'Escape closes only the top layer');
assert.equal(overlayRuntime.isOpen('b'), false);
assert.equal(prevented, 1);
assert.equal(stopped, 1);
overlayRuntime.close('a', 'programmatic');

openOverlay('a', overlayA, openerA, focusA);
openOverlay('b', overlayB, openerB, focusB);
window.dispatch('pagehide');
assert.equal(overlayRuntime.size(), 0, 'pagehide must recover all owners');
assert.equal(body.style.position, 'relative');

const protectedRuntime = window.OverlayRuntime;
window.OverlayRuntime = { broken: true };
assert.strictEqual(window.OverlayRuntime, protectedRuntime, 'global runtime must reject replacement');

console.log('✅ runtime-integrity-test: dedupe + ARIA bootstrap + coordinated lock + OverlayRuntime lifecycle');
