/*
 * GB Reader Preferences v1
 *
 * One browser-side source of truth for reading appearance across series,
 * books, standalone articles and ordinary content pages. The tiny early head
 * bootstrap applies the same state before CSS; this runtime owns updates,
 * persistence, cross-tab sync and compatibility with the historical theme and
 * font-scale contracts.
 */
(function (global) {
  'use strict';

  if (!global || !global.document) return;
  if (global.GBReaderPreferences && global.GBReaderPreferences.version === 1) return;

  var document = global.document;
  var root = document.documentElement;
  var STORAGE_KEY = 'gb:reader-preferences:v1';
  var EVENT_NAME = 'gb:reader-preferences-change';
  var THEMES = ['light', 'dark', 'sepia'];
  var LINE_HEIGHTS = ['compact', 'normal', 'relaxed'];
  var MEASURES = ['narrow', 'normal', 'wide'];
  var TEXT_MODES = ['rich', 'plain'];
  var MOTIONS = ['system', 'reduced'];
  var LINE_VALUES = { compact: '1.45', normal: '1.6', relaxed: '1.85' };
  var MEASURE_VALUES = { narrow: '36rem', normal: '43rem', wide: '50rem' };
  var DEFAULTS = Object.freeze({
    version: 1,
    theme: 'light',
    fontScale: 1,
    lineHeight: 'normal',
    measure: 'normal',
    textMode: 'rich',
    motion: 'system'
  });

  function safeGet(key) {
    try { return global.localStorage ? global.localStorage.getItem(key) : null; }
    catch (_) { return null; }
  }

  function safeSet(key, value) {
    try {
      if (global.localStorage) global.localStorage.setItem(key, value);
      return true;
    } catch (_) { return false; }
  }

  function safeRemove(key) {
    try {
      if (global.localStorage) global.localStorage.removeItem(key);
      return true;
    } catch (_) { return false; }
  }

  function oneOf(value, values, fallback) {
    return values.indexOf(value) !== -1 ? value : fallback;
  }

  function normalizeFontScale(value) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULTS.fontScale;
    parsed = Math.min(1.25, Math.max(0.85, parsed));
    return Math.round(parsed * 20) / 20;
  }

  function systemTheme() {
    try {
      return global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_) { return 'light'; }
  }

  function normalize(input) {
    var source = input && typeof input === 'object' ? input : {};
    return {
      version: 1,
      theme: oneOf(source.theme, THEMES, systemTheme()),
      fontScale: normalizeFontScale(source.fontScale),
      lineHeight: oneOf(source.lineHeight, LINE_HEIGHTS, DEFAULTS.lineHeight),
      measure: oneOf(source.measure, MEASURES, DEFAULTS.measure),
      textMode: oneOf(source.textMode, TEXT_MODES, DEFAULTS.textMode),
      motion: oneOf(source.motion, MOTIONS, DEFAULTS.motion)
    };
  }

  function parseStored(raw) {
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return normalize(parsed);
    } catch (_) { return null; }
  }

  function legacyTheme() {
    var values = [
      safeGet('gb:gill-reader-theme:v1'),
      safeGet('gb:hm-reader-theme:v1'),
      safeGet('theme')
    ];
    for (var i = 0; i < values.length; i += 1) {
      if (THEMES.indexOf(values[i]) !== -1) return values[i];
    }
    return systemTheme();
  }

  function legacyChoice(keys, values, fallback) {
    for (var i = 0; i < keys.length; i += 1) {
      var candidate = safeGet(keys[i]);
      if (values.indexOf(candidate) !== -1) return candidate;
    }
    return fallback;
  }

  function readLegacy() {
    return normalize({
      theme: legacyTheme(),
      fontScale: safeGet('gb:font-scale') || DEFAULTS.fontScale,
      lineHeight: legacyChoice(
        ['gb:gill-line-height:v1', 'gb:hm-line-height:v1'],
        LINE_HEIGHTS,
        DEFAULTS.lineHeight
      ),
      measure: legacyChoice(
        ['gb:gill-measure:v1', 'gb:hm-measure:v1'],
        MEASURES,
        DEFAULTS.measure
      ),
      textMode: safeGet('gb:reader-text-mode:v1') || DEFAULTS.textMode,
      motion: safeGet('gb:reader-motion:v1') || DEFAULTS.motion
    });
  }

  function readInitial() {
    var bootstrap = global.__GB_READER_PREFS_BOOTSTRAP__;
    if (bootstrap && typeof bootstrap === 'object') return normalize(bootstrap);
    return parseStored(safeGet(STORAGE_KEY)) || readLegacy();
  }

  function applyReaderRoots(state) {
    var sepia = state.theme === 'sepia';
    var line = LINE_VALUES[state.lineHeight];
    var measure = MEASURE_VALUES[state.measure];
    document.querySelectorAll('[data-gill-v16]').forEach(function (element) {
      if (sepia) element.setAttribute('data-gill-reader-theme', 'sepia');
      else element.removeAttribute('data-gill-reader-theme');
      element.style.setProperty('--gbs2-article-line', line);
      element.style.setProperty('--gbs2-article-measure', measure);
    });
    document.querySelectorAll('[data-reader-root]').forEach(function (element) {
      if (sepia) element.setAttribute('data-hm-reader-theme', 'sepia');
      else element.removeAttribute('data-hm-reader-theme');
      element.style.setProperty('--hm-article-line', line);
      element.style.setProperty('--hm-article-measure', measure);
    });
  }

  function apply(prefs) {
    var state = normalize(prefs);
    root.setAttribute('data-reader-theme', state.theme);
    root.setAttribute('data-reader-text-mode', state.textMode);
    root.setAttribute('data-reader-motion', state.motion);
    root.classList.toggle('dark', state.theme === 'dark');
    root.style.setProperty('--gb-reader-font-scale', String(state.fontScale));
    root.style.setProperty('--gb-reader-line-height', LINE_VALUES[state.lineHeight]);
    root.style.setProperty('--gb-reader-measure', MEASURE_VALUES[state.measure]);
    root.style.setProperty('--gb-reader-theme-ready', '1');
    applyReaderRoots(state);
    return state;
  }

  function persist(state) {
    safeSet(STORAGE_KEY, JSON.stringify(state));
    // Compatibility bridges for still-unconverted controls. Sepia is a light
    // color-scheme variant, so legacy binary toggles must see it as light.
    safeSet('theme', state.theme === 'dark' ? 'dark' : 'light');
    safeSet('gb:font-scale', String(state.fontScale));
  }

  function emit(state, source) {
    var detail = { preferences: Object.assign({}, state), source: source || 'api' };
    try { document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: detail })); }
    catch (_) {
      try {
        var event = document.createEvent('CustomEvent');
        event.initCustomEvent(EVENT_NAME, false, false, detail);
        document.dispatchEvent(event);
      } catch (_) {}
    }
  }

  var current = apply(readInitial());
  persist(current);

  function commit(next, options) {
    options = options || {};
    var candidate = typeof next === 'function' ? next(Object.assign({}, current)) : next;
    current = apply(Object.assign({}, current, candidate || {}));
    if (options.persist !== false) persist(current);
    if (options.emit !== false) emit(current, options.source || 'api');
    return Object.assign({}, current);
  }

  var api = {
    version: 1,
    storageKey: STORAGE_KEY,
    eventName: EVENT_NAME,
    themes: THEMES.slice(),
    get: function () { return Object.assign({}, current); },
    set: function (patch, options) { return commit(patch, options); },
    setTheme: function (theme, options) { return commit({ theme: theme }, options); },
    apply: function (prefs) { current = apply(prefs || current); return Object.assign({}, current); },
    migrate: function () { return commit(readLegacy(), { source: 'migration' }); },
    reset: function () {
      safeRemove(STORAGE_KEY);
      return commit(Object.assign({}, DEFAULTS, { theme: systemTheme() }), { source: 'reset' });
    },
    subscribe: function (listener) {
      if (typeof listener !== 'function') return function () {};
      var handler = function (event) { listener(event.detail.preferences, event.detail); };
      document.addEventListener(EVENT_NAME, handler);
      return function () { document.removeEventListener(EVENT_NAME, handler); };
    }
  };

  global.GBReaderPreferences = api;
  global.__GB_READER_PREFS_BOOTSTRAP__ = Object.assign({}, current);
  emit(current, 'init');

  global.addEventListener('storage', function (event) {
    if (!event) return;
    if (event.key === STORAGE_KEY) {
      var parsed = parseStored(event.newValue);
      if (parsed) commit(parsed, { persist: false, source: 'storage' });
      return;
    }
    // During the compatibility window another tab may still use the old
    // binary theme toggle. Canonical Sepia is intentionally stronger: our own
    // compatibility write (`theme=light`) must never downgrade another tab.
    if (event.key === 'theme' && (event.newValue === 'dark' || event.newValue === 'light')) {
      var canonical = parseStored(safeGet(STORAGE_KEY));
      if (canonical && canonical.theme === 'sepia') return;
      if (canonical && canonical.theme === event.newValue) return;
      commit({ theme: event.newValue }, { source: 'legacy-storage' });
    }
  });
})(typeof window !== 'undefined' ? window : null);
