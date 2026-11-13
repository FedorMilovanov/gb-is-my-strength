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
  var LEGACY_THEME_CONTROL_SELECTOR = [
    '[data-fc-action="theme"]',
    '[data-gbs2-theme]',
    '.gb-theme-toggle',
    '.gb-fc-theme',
    '#barThemeBtn',
    '#themeToggle',
    '.theme-toggle',
    '.nag-sidebar-theme-btn'
  ].join(',');
  var THEMES = ['light', 'dark', 'sepia'];
  var LINE_HEIGHTS = ['compact', 'normal', 'relaxed'];
  var MEASURES = ['narrow', 'normal', 'wide'];
  var TEXT_MODES = ['rich', 'plain'];
  var MOTIONS = ['system', 'reduced'];
  var LINE_VALUES = { compact: '1.45', normal: '1.6', relaxed: '1.85' };
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
    document.querySelectorAll('[data-gill-v16]').forEach(function (element) {
      if (sepia) element.setAttribute('data-gill-reader-theme', 'sepia');
      else element.removeAttribute('data-gill-reader-theme');
      element.style.setProperty('--gbs2-article-line', line);
    });
    document.querySelectorAll('[data-reader-root]').forEach(function (element) {
      if (sepia) element.setAttribute('data-hm-reader-theme', 'sepia');
      else element.removeAttribute('data-hm-reader-theme');
      element.style.setProperty('--hm-article-line', line);
    });
  }

  function apply(prefs) {
    var state = normalize(prefs);
    root.setAttribute('data-reader-theme', state.theme);
    root.setAttribute('data-reader-text-mode', state.textMode);
    root.setAttribute('data-reader-motion', state.motion);
    root.setAttribute('data-reader-measure', state.measure);
    root.classList.toggle('dark', state.theme === 'dark');
    root.style.setProperty('--gb-reader-font-scale', String(state.fontScale));
    root.style.setProperty('--gb-reader-line-height', LINE_VALUES[state.lineHeight]);
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

  function closestLegacyThemeControl(target) {
    if (!target || typeof target.closest !== 'function') return null;
    try { return target.closest(LEGACY_THEME_CONTROL_SELECTOR); }
    catch (_) { return null; }
  }

  function scheduleLegacyThemeReconcile(event) {
    if (!closestLegacyThemeControl(event && event.target)) return;

    // Legacy controls can still own their visual click handler while migration
    // is in progress. Reconcile only after the complete click dispatch, then
    // persist the resulting html.dark state through the canonical owner. Modern
    // controls already call setTheme(), so this becomes a strict no-op for them.
    var reconcile = function () {
      var theme = root.classList.contains('dark') ? 'dark' : 'light';
      if (current.theme === theme) return;
      commit({ theme: theme }, { source: 'legacy-theme-control' });
    };

    if (typeof global.queueMicrotask === 'function') global.queueMicrotask(reconcile);
    else if (typeof global.Promise === 'function') global.Promise.resolve().then(reconcile);
    else global.setTimeout(reconcile, 0);
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
  document.addEventListener('click', scheduleLegacyThemeReconcile);
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


/*
 * Site-wide Summary Disclosure v1.
 * Shared reader preferences is loaded by both legacy and Astro articles.
 * Only "Коротко" cards are folded; other editorial summary cards stay intact.
 * This owns one native toggle; the older length-based mobile expander sees a
 * compact card and does not duplicate the button.
 */
(function initSiteSummaryDisclosure(global) {
  'use strict';
  if (!global || (global.GBSummaryDisclosure && global.GBSummaryDisclosure.version === 1)) return;
  var sequence = 0;
  function hashTarget() {
    if (!global.location || !global.location.hash || global.location.hash.length < 2) return null;
    try { return document.getElementById(decodeURIComponent(global.location.hash.slice(1))); }
    catch (_) { return null; }
  }
  function revealLinkedSummary() {
    var target = hashTarget();
    var card = target && target.closest('.summary-card[data-gb-summary-owner="1"]');
    if (!card) return;
    var button = card.querySelector('.gb-summary-toggle');
    if (!button) return;
    // Fragment IDs on legacy pages can be created during hydration.
    // Opening the panel is not enough: the browser could not scroll to
    // an ID that did not yet exist during its native fragment navigation.
    if (button.getAttribute('aria-expanded') === 'true') {
      global.requestAnimationFrame(function() {
        if (hashTarget() === target) target.scrollIntoView({block:'start', behavior:'auto'});
      });
      return;
    }
    var panel = card.querySelector('.gb-summary-motion');
    var onDone = function(event) {
      if (event.target !== panel || event.propertyName !== 'grid-template-rows') return;
      panel.removeEventListener('transitionend', onDone);
      if (hashTarget() === target) target.scrollIntoView({block:'start', behavior:'auto'});
    };
    if (panel && !global.matchMedia('(prefers-reduced-motion: reduce)').matches)
      panel.addEventListener('transitionend', onDone);
    button.click();
    if (!panel || global.matchMedia('(prefers-reduced-motion: reduce)').matches)
      global.requestAnimationFrame(function() { target.scrollIntoView({block:'start', behavior:'auto'}); });
  }
  function initialize(root) {
    var cards = (root || document).querySelectorAll('.summary-card');
    Array.prototype.forEach.call(cards, function(card) {
      if (card.dataset.gbSummaryOwner === '1') return;
      var heading = card.querySelector(':scope > .summary-card__head');
      var list = card.querySelector(':scope > .summary-card__body');
      if (!heading || !list || !['коротко', 'краткое содержание'].includes(heading.textContent.trim().toLocaleLowerCase('ru'))) return;
      if (heading.querySelector('button') || list.closest('.gb-summary-motion')) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'gb-summary-toggle';
      var label = document.createElement('span');
      label.className = 'gb-summary-toggle__label';
      while (heading.firstChild) label.appendChild(heading.firstChild);
      label.textContent = 'Коротко';
      // Argon UPDATE: a plain folio summary row, with a small thesis count
      // and a quiet directional glyph. No framed icon or duplicate disclosure.
      var meta = document.createElement('span');
      meta.className = 'gb-summary-toggle__meta';
      var count = list.querySelectorAll(':scope > li').length;
      var countLabel = document.createElement('span');
      countLabel.className = 'gb-summary-toggle__count';
      var teen = count % 100;
      var unit = teen >= 11 && teen <= 14 ? 'тезисов' : count % 10 === 1 ? 'тезис' : count % 10 >= 2 && count % 10 <= 4 ? 'тезиса' : 'тезисов';
      countLabel.textContent = count + ' ' + unit;
      var chevron = document.createElement('span');
      chevron.className = 'gb-summary-toggle__chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '›';
      meta.append(countLabel, chevron);
      button.append(label, meta);
      heading.appendChild(button);
      var panel = document.createElement('div');
      panel.className = 'gb-summary-motion';
      list.before(panel);
      panel.appendChild(list);
      var bodyId = list.id || 'gb-summary-body-' + (++sequence);
      list.id = bodyId;
      button.setAttribute('aria-controls', bodyId);
      card.dataset.gbSummaryOwner = '1';
      function setOpen(open) {
        if (!open && panel.contains(document.activeElement)) button.focus({preventScroll:true});
        card.dataset.gbSummaryOpen = open ? 'true' : 'false';
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-label', open ? 'Свернуть раздел «Коротко»' : 'Развернуть раздел «Коротко»');
        panel.inert = !open;
        panel.setAttribute('aria-hidden', String(!open));
      }
      setOpen(Boolean(hashTarget() && list.contains(hashTarget())));
      // The first-paint parser guard is no longer needed: this canonical
      // disclosure owns the body, including deep links and print.
      delete card.dataset.gbSummaryPending;
      button.addEventListener('click', function() { setOpen(button.getAttribute('aria-expanded') !== 'true'); });
    });
  }
  global.GBSummaryDisclosure = {version:1, initialize:initialize};
  function boot() { initialize(); revealLinkedSummary(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
  global.addEventListener('hashchange', revealLinkedSummary);
  global.addEventListener('pageshow', boot);
})(typeof window !== 'undefined' ? window : null);
