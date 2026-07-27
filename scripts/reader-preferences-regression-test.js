#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function createBrowser(seed = {}) {
  const storage = new Map(Object.entries(seed));
  const attrs = new Map();
  const styles = new Map();
  const classes = new Set();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const microtasks = [];

  const classList = {
    add(value) { classes.add(value); },
    remove(value) { classes.delete(value); },
    contains(value) { return classes.has(value); },
    toggle(value, force) {
      if (force === true) classes.add(value);
      else if (force === false) classes.delete(value);
      else if (classes.has(value)) classes.delete(value);
      else classes.add(value);
      return classes.has(value);
    },
  };

  const documentElement = {
    classList,
    style: {
      setProperty(name, value) { styles.set(name, String(value)); },
      getPropertyValue(name) { return styles.get(name) || ''; },
    },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    removeAttribute(name) { attrs.delete(name); },
  };

  const document = {
    documentElement,
    querySelectorAll() { return []; },
    addEventListener(name, listener) {
      if (!documentListeners.has(name)) documentListeners.set(name, []);
      documentListeners.get(name).push(listener);
    },
    removeEventListener(name, listener) {
      const list = documentListeners.get(name) || [];
      documentListeners.set(name, list.filter((item) => item !== listener));
    },
    dispatchEvent(event) {
      for (const listener of documentListeners.get(event.type) || []) listener(event);
      return true;
    },
    createEvent() {
      return {
        initCustomEvent(type, _bubbles, _cancelable, detail) {
          this.type = type;
          this.detail = detail;
        },
      };
    },
  };

  class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  const window = {
    document,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    matchMedia() { return { matches: false }; },
    addEventListener(name, listener) {
      if (!windowListeners.has(name)) windowListeners.set(name, []);
      windowListeners.get(name).push(listener);
    },
    queueMicrotask(callback) { microtasks.push(callback); },
  };

  const context = vm.createContext({
    window,
    document,
    CustomEvent,
    console,
    JSON,
    Object,
    Number,
    Math,
    String,
    Array,
    Map,
    Set,
  });

  function run(relative) {
    vm.runInContext(read(relative), context, { filename: relative });
  }

  function flushMicrotasks() {
    while (microtasks.length) microtasks.shift()();
  }

  return { window, document, storage, attrs, styles, classes, run, flushMicrotasks };
}

// Legacy Gill/HM values become one canonical first-paint state.
const browser = createBrowser({
  'gb:gill-reader-theme:v1': 'sepia',
  'gb:hm-line-height:v1': 'relaxed',
  'gb:gill-measure:v1': 'wide',
  'gb:font-scale': '1.1',
});
browser.run('js/reader-preferences-head.js');
assert.strictEqual(browser.attrs.get('data-reader-theme'), 'sepia');
assert.strictEqual(browser.attrs.get('data-reader-text-mode'), 'rich');
assert.strictEqual(browser.attrs.get('data-reader-measure'), 'wide');
assert.strictEqual(browser.classes.has('dark'), false);
assert.strictEqual(browser.styles.get('--gb-reader-font-scale'), '1.1');
assert.strictEqual(browser.styles.get('--gb-reader-line-height'), '1.85');
assert.strictEqual(browser.styles.get('--gb-reader-measure'), '46rem');
assert.strictEqual(browser.window.__GB_READER_PREFS_BOOTSTRAP__.theme, 'sepia');

browser.run('js/reader-preferences.js');
const api = browser.window.GBReaderPreferences;
assert(api && api.version === 1, 'global preference API must mount');
assert.strictEqual(api.get().theme, 'sepia');
assert.strictEqual(JSON.parse(browser.storage.get('gb:reader-preferences:v1')).measure, 'wide');

api.setTheme('dark', { source: 'test' });
assert.strictEqual(browser.attrs.get('data-reader-theme'), 'dark');
assert.strictEqual(browser.classes.has('dark'), true);
assert.strictEqual(browser.storage.get('theme'), 'dark');

api.set({ theme: 'light', lineHeight: 'compact', measure: 'narrow', fontScale: 9 });
assert.deepStrictEqual(
  { theme: api.get().theme, lineHeight: api.get().lineHeight, measure: api.get().measure, fontScale: api.get().fontScale },
  { theme: 'light', lineHeight: 'compact', measure: 'narrow', fontScale: 1.25 },
);
assert.strictEqual(browser.styles.get('--gb-reader-line-height'), '1.45');
assert.strictEqual(browser.styles.get('--gb-reader-measure'), '36rem');
assert.strictEqual(browser.classes.has('dark'), false);

// Canonical state always wins over conflicting legacy values.
const canonical = createBrowser({
  'gb:reader-preferences:v1': JSON.stringify({ version: 1, theme: 'dark', fontScale: 1, lineHeight: 'normal', measure: 'normal', textMode: 'plain', motion: 'reduced' }),
  'gb:gill-reader-theme:v1': 'sepia',
  theme: 'light',
});
canonical.run('js/reader-preferences-head.js');
assert.strictEqual(canonical.attrs.get('data-reader-theme'), 'dark');
assert.strictEqual(canonical.attrs.get('data-reader-text-mode'), 'plain');
assert.strictEqual(canonical.attrs.get('data-reader-motion'), 'reduced');

// Same-document legacy controls must reconcile their final html.dark state
// through the canonical store. Storage events do not fire in the same tab, so
// without this bridge the page looks dark until reload and then reverts.
const legacyClick = createBrowser({
  'gb:reader-preferences:v1': JSON.stringify({ version: 1, theme: 'light', fontScale: 1, lineHeight: 'normal', measure: 'normal', textMode: 'rich', motion: 'system' }),
  theme: 'light',
});
legacyClick.run('js/reader-preferences.js');
const legacyThemeButton = {
  closest(selector) { return selector.includes('#themeToggle') ? this : null; },
};
legacyClick.document.addEventListener('click', (event) => {
  if (event.target !== legacyThemeButton) return;
  const dark = legacyClick.classes.has('dark');
  if (dark) legacyClick.classes.delete('dark');
  else legacyClick.classes.add('dark');
  legacyClick.storage.set('theme', dark ? 'light' : 'dark');
});
legacyClick.document.dispatchEvent({ type: 'click', target: legacyThemeButton });
legacyClick.flushMicrotasks();
assert.strictEqual(legacyClick.window.GBReaderPreferences.get().theme, 'dark');
assert.strictEqual(legacyClick.attrs.get('data-reader-theme'), 'dark');
assert.strictEqual(legacyClick.storage.get('theme'), 'dark');
assert.strictEqual(JSON.parse(legacyClick.storage.get('gb:reader-preferences:v1')).theme, 'dark');

// Modern controls already commit through the canonical API. The compatibility
// bridge observes the same final state and must not emit or persist twice.
const modernClick = createBrowser({
  'gb:reader-preferences:v1': JSON.stringify({ version: 1, theme: 'light', fontScale: 1, lineHeight: 'normal', measure: 'normal', textMode: 'rich', motion: 'system' }),
});
modernClick.run('js/reader-preferences.js');
let modernChanges = 0;
modernClick.window.GBReaderPreferences.subscribe(() => { modernChanges += 1; });
const modernThemeButton = {
  closest(selector) { return selector.includes('[data-fc-action="theme"]') ? this : null; },
};
modernClick.document.addEventListener('click', (event) => {
  if (event.target === modernThemeButton) {
    modernClick.window.GBReaderPreferences.setTheme('dark', { source: 'modern-control' });
  }
});
modernClick.document.dispatchEvent({ type: 'click', target: modernThemeButton });
modernClick.flushMicrotasks();
assert.strictEqual(modernClick.window.GBReaderPreferences.get().theme, 'dark');
assert.strictEqual(modernChanges, 1);

const component = read('src/components/reader-platform/ReaderPreferencesHead.astro');
assert(component.includes("assetUrl('js/reader-preferences-head.js')"));
assert(component.includes("assetUrl('js/reader-preferences.js')"));
assert(component.includes("assetUrl('js/reader-state.js')"));
assert(component.includes("assetUrl('css/reader-preferences.css')"));

const assetList = read('scripts/cache-bust-assets.js');
for (const asset of ['css/reader-preferences.css', 'js/reader-preferences-head.js', 'js/reader-preferences.js', 'js/reader-state.js']) {
  assert(assetList.includes(`'${asset}'`), `${asset} must be cache-bust managed`);
}

function hasRealHead(source) {
  return /^\s*<head(?:\s|>)/im.test(source);
}
function importsPageHead(source) {
  return /<[A-Z][A-Za-z0-9]*PageHead\b/.test(source);
}

function hasLegacyThemeBootstrap(source) {
  const scripts = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of source.matchAll(scripts)) {
    const body = match[1] || '';
    if (/localStorage\.getItem\(\s*['"]theme['"]\s*\)/.test(body) &&
        /document\.documentElement\.(?:classList\.(?:add|toggle)\(\s*['"]dark['"]|setAttribute\(\s*['"]data-reader-theme['"])/.test(body)) {
      return true;
    }
  }
  return false;
}

const astroTargets = [];
for (const file of walk(path.join(ROOT, 'src'), '.astro')) {
  if (file.endsWith('ReaderPreferencesHead.astro')) continue;
  const source = fs.readFileSync(file, 'utf8');
  const pageHead = file.endsWith('PageHead.astro');
  const fullHead = hasRealHead(source);
  if (!pageHead && !fullHead) continue;
  if (fullHead && !pageHead && importsPageHead(source)) continue;
  astroTargets.push(file);
  assert(!hasLegacyThemeBootstrap(source), `${path.relative(ROOT, file)} must not contain a route-owned theme bootstrap`);
  assert(source.includes('ReaderPreferencesHead'), `${path.relative(ROOT, file)} must import shared head preferences`);
  assert(source.includes('<ReaderPreferencesHead />'), `${path.relative(ROOT, file)} must render shared head preferences`);
  const preferenceIndex = source.indexOf('<ReaderPreferencesHead />');
  const charset = /<meta\s+[^>]*charset\s*=\s*["']?[^>]+>/i.exec(source);
  const csp = /<meta\s+[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/i.exec(source);
  if (charset) assert(preferenceIndex > charset.index + charset[0].length - 1, `${path.relative(ROOT, file)} preferences must follow charset`);
  if (csp) assert(preferenceIndex > csp.index + csp[0].length - 1, `${path.relative(ROOT, file)} preferences must follow CSP`);
}
assert(astroTargets.length >= 65, `expected broad Astro head coverage, got ${astroTargets.length}`);

const legacyTargets = [];
for (const file of walk(ROOT, '.html', new Set(['node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'audit', '_build-tools', 'src', 'scripts', 'docs', 'migration']))) {
  if (/yandex_[^/]+\.html$/.test(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (!/<html\b/i.test(source) || !/<head\b/i.test(source)) continue;
  legacyTargets.push(file);
  assert(!hasLegacyThemeBootstrap(source), `${path.relative(ROOT, file)} must not contain a route-owned theme bootstrap`);
  assert(source.includes('js/reader-preferences-head.js?v='), `${path.relative(ROOT, file)} missing first-paint bootstrap`);
  assert(source.includes('css/reader-preferences.css?v='), `${path.relative(ROOT, file)} missing preference tokens`);
  assert(source.includes('js/reader-preferences.js?v='), `${path.relative(ROOT, file)} missing preference runtime`);
  const preferenceIndex = source.indexOf('js/reader-preferences-head.js?v=');
  const charset = /<meta\s+[^>]*charset\s*=\s*["']?[^>]+>/i.exec(source);
  const csp = /<meta\s+[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/i.exec(source);
  if (charset) assert(preferenceIndex > charset.index + charset[0].length - 1, `${path.relative(ROOT, file)} preferences must follow charset`);
  if (csp) assert(preferenceIndex > csp.index + csp[0].length - 1, `${path.relative(ROOT, file)} preferences must follow CSP`);
}
assert(legacyTargets.length >= 50, `expected broad legacy coverage, got ${legacyTargets.length}`);

const siteRuntime = read('js/site.js');
assert(siteRuntime.includes('window.GBReaderPreferences.setTheme'), 'legacy theme bridge must call canonical API');
const readerRuntime = read('js/reader-preferences.js');
for (const selector of ['[data-fc-action="theme"]', '[data-gbs2-theme]', '.gb-theme-toggle', '#themeToggle', '.nag-sidebar-theme-btn']) {
  assert(readerRuntime.includes(selector), `canonical legacy-control bridge must cover ${selector}`);
}
const gillBar = read('src/components/article-pilots/gill-series/GillSeriesMobileBar.astro');
const standaloneSettings = read('src/components/article-pilots/_shared/ReaderSettings.astro');
assert(gillBar.includes('GBReaderPreferences'));
assert(standaloneSettings.includes('GBReaderPreferences'));
assert(!/localStorage\.setItem\(\s*['"]gb:gill-(?:reader-theme|line-height|measure)/.test(gillBar + read('src/components/article-pilots/gill-series/GillReaderSettingsSheet.astro')));
assert(!/localStorage\.setItem\(\s*['"]gb:hm-(?:reader-theme|line-height|measure)/.test(standaloneSettings));

function walk(start, suffix, skip = new Set()) {
  const result = [];
  if (!fs.existsSync(start)) return result;
  for (const entry of fs.readdirSync(start, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || skip.has(entry.name)) continue;
    const full = path.join(start, entry.name);
    if (entry.isDirectory()) result.push(...walk(full, suffix, skip));
    else if (entry.name.endsWith(suffix)) result.push(full);
  }
  return result;
}

console.log(`✅ reader preference foundation guard passed (${astroTargets.length} Astro heads, ${legacyTargets.length} legacy documents)`);

require('./reader-state-regression-test.js');
