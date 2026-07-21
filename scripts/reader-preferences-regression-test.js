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

  return { window, document, storage, attrs, styles, classes, run };
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
assert.strictEqual(browser.classes.has('dark'), false);
assert.strictEqual(browser.styles.get('--gb-reader-font-scale'), '1.1');
assert.strictEqual(browser.styles.get('--gb-reader-line-height'), '1.85');
assert.strictEqual(browser.styles.get('--gb-reader-measure'), '50rem');
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

const component = read('src/components/reader-platform/ReaderPreferencesHead.astro');
assert(component.includes("assetUrl('js/reader-preferences-head.js')"));
assert(component.includes("assetUrl('js/reader-preferences.js')"));
assert(component.includes("assetUrl('css/reader-preferences.css')"));

const assetList = read('scripts/cache-bust-assets.js');
for (const asset of ['css/reader-preferences.css', 'js/reader-preferences-head.js', 'js/reader-preferences.js']) {
  assert(assetList.includes(`'${asset}'`), `${asset} must be cache-bust managed`);
}

function hasRealHead(source) {
  return /^\s*<head(?:\s|>)/im.test(source);
}
function importsPageHead(source) {
  return /<[A-Z][A-Za-z0-9]*PageHead\b/.test(source);
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
  assert(source.includes('ReaderPreferencesHead'), `${path.relative(ROOT, file)} must import shared head preferences`);
  assert(source.includes('<ReaderPreferencesHead />'), `${path.relative(ROOT, file)} must render shared head preferences`);
}
assert(astroTargets.length >= 65, `expected broad Astro head coverage, got ${astroTargets.length}`);

const legacyTargets = [];
for (const file of walk(ROOT, '.html', new Set(['node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'audit', '_build-tools', 'src', 'scripts', 'docs', 'migration']))) {
  if (/yandex_[^/]+\.html$/.test(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (!/<html\b/i.test(source) || !/<head\b/i.test(source)) continue;
  legacyTargets.push(file);
  assert(source.includes('js/reader-preferences-head.js?v='), `${path.relative(ROOT, file)} missing first-paint bootstrap`);
  assert(source.includes('css/reader-preferences.css?v='), `${path.relative(ROOT, file)} missing preference tokens`);
  assert(source.includes('js/reader-preferences.js?v='), `${path.relative(ROOT, file)} missing preference runtime`);
}
assert(legacyTargets.length >= 50, `expected broad legacy coverage, got ${legacyTargets.length}`);

const siteRuntime = read('js/site.js');
assert(siteRuntime.includes('window.GBReaderPreferences.setTheme'), 'legacy theme bridge must call canonical API');
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
