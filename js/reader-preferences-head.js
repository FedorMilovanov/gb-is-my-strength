/* GB Reader Preferences — synchronous first-paint bootstrap. */
(function (w, d) {
  'use strict';
  if (!w || !d || !d.documentElement) return;
  var root = d.documentElement;
  var KEY = 'gb:reader-preferences:v1';
  var themes = ['light', 'dark', 'sepia'];
  var lines = ['compact', 'normal', 'relaxed'];
  var measures = ['narrow', 'normal', 'wide'];
  var lineValues = { compact: '1.45', normal: '1.6', relaxed: '1.85' };
  var measureValues = { narrow: '36rem', normal: '43rem', wide: '46rem' };

  function get(key) {
    try { return w.localStorage && w.localStorage.getItem(key); }
    catch (_) { return null; }
  }
  function one(value, list, fallback) { return list.indexOf(value) !== -1 ? value : fallback; }
  function systemTheme() {
    try { return w.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
    catch (_) { return 'light'; }
  }
  function font(value) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) parsed = 1;
    parsed = Math.min(1.25, Math.max(.85, parsed));
    return Math.round(parsed * 20) / 20;
  }
  function legacy(keys, values, fallback) {
    for (var i = 0; i < keys.length; i += 1) {
      var value = get(keys[i]);
      if (values.indexOf(value) !== -1) return value;
    }
    return fallback;
  }

  var stored = null;
  try { stored = JSON.parse(get(KEY) || 'null'); } catch (_) {}
  var legacyTheme = legacy(
    ['gb:gill-reader-theme:v1', 'gb:hm-reader-theme:v1', 'theme'],
    themes,
    systemTheme()
  );
  var state = stored && typeof stored === 'object' ? stored : {
    theme: legacyTheme,
    fontScale: get('gb:font-scale') || 1,
    lineHeight: legacy(['gb:gill-line-height:v1', 'gb:hm-line-height:v1'], lines, 'normal'),
    measure: legacy(['gb:gill-measure:v1', 'gb:hm-measure:v1'], measures, 'normal'),
    textMode: get('gb:reader-text-mode:v1') || 'rich',
    motion: get('gb:reader-motion:v1') || 'system'
  };

  state = {
    version: 1,
    theme: one(state.theme, themes, legacyTheme),
    fontScale: font(state.fontScale),
    lineHeight: one(state.lineHeight, lines, 'normal'),
    measure: one(state.measure, measures, 'normal'),
    textMode: state.textMode === 'plain' ? 'plain' : 'rich',
    motion: state.motion === 'reduced' ? 'reduced' : 'system'
  };

  root.setAttribute('data-reader-theme', state.theme);
  root.setAttribute('data-reader-text-mode', state.textMode);
  root.setAttribute('data-reader-motion', state.motion);
  root.setAttribute('data-reader-measure', state.measure);
  root.classList.toggle('dark', state.theme === 'dark');
  root.style.setProperty('--gb-reader-font-scale', String(state.fontScale));
  root.style.setProperty('--gb-reader-line-height', lineValues[state.lineHeight]);
  root.style.setProperty('--gb-reader-measure', measureValues[state.measure]);
  root.style.setProperty('--gb-reader-theme-ready', '1');
  w.__GB_READER_PREFS_BOOTSTRAP__ = state;
})(window, document);
