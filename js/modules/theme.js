/**
 * theme.js — РЕФАКТОРИНГ 6.0 Phase 3
 * 
 * Theme toggle module (dark/light mode).
 * Extracted from site.js (lines 524-590 in prettified version).
 * 
 * Dependencies:
 *   - localStorage for persistence (key: 'gb-theme')
 *   - window.matchMedia for prefers-color-scheme
 *   - document.documentElement.classList for 'dark' toggle
 * 
 * Uses AbortController for cleanup.
 */
(function () {
  'use strict';

  // Do not double-mount when the legacy monolith (site.js) already owns theme controls.
  if (window.__gbLegacyThemeMounted) {
    window.__gbTheme = window.__gbTheme || { destroy: function () {}, toggle: function () {} };
    return;
  }

  var THEME_KEY = 'gb-theme';
  var controller = new AbortController();
  var signal = controller.signal;

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(value) {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch (e) { /* quota exceeded */ }
  }

  function updateAriaPressed(isDark) {
    var toggle = document.getElementById('themeToggle') || document.getElementById('hThemeBtn');
    if (toggle) {
      toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    }
    var barBtn = document.getElementById('barThemeBtn');
    if (barBtn) {
      barBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    }
  }

  function updateMetaThemeColor(isDark) {
    var color;
    try {
      var cs = getComputedStyle(document.documentElement);
      color = (cs.getPropertyValue('--h-bg') || cs.getPropertyValue('--bg') || '').trim();
    } catch (e) { /* ignore */ }
    if (!color) {
      color = isDark ? '#171411' : '#f8f5f0';
    }
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    if (metas.length > 1) {
      metas.forEach(function (meta, i) {
        if (i > 0) meta.parentNode.removeChild(meta);
      });
    }
    if (!metas.length) {
      var meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
      return;
    }
    metas[0].removeAttribute('media');
    metas[0].setAttribute('content', color);
  }

  function toggleTheme() {
    var html = document.documentElement;
    var isDark = html.classList.toggle('dark');
    setStoredTheme(isDark ? 'dark' : 'light');
    updateAriaPressed(isDark);
    updateMetaThemeColor(isDark);
  }

  function init() {
    var html = document.documentElement;
    var toggle = document.getElementById('themeToggle') || document.getElementById('hThemeBtn');

    // Apply stored or system preference on load
    var stored = getStoredTheme();
    if (stored === 'dark') {
      html.classList.add('dark');
    } else if (!stored && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('dark');
    }

    // Main toggle button
    if (toggle) {
      toggle.addEventListener('click', toggleTheme, { signal: signal });
    }

    // Bottom bar theme button
    var barBtn = document.getElementById('barThemeBtn');
    if (barBtn) {
      barBtn.addEventListener('click', toggleTheme, { signal: signal });
    }

    // Sync across tabs via storage event
    window.addEventListener('storage', function (e) {
      if (e.key === THEME_KEY) {
        var isDark = e.newValue !== 'light';
        html.classList.toggle('dark', isDark);
        updateAriaPressed(isDark);
        updateMetaThemeColor(isDark);
      }
    }, { signal: signal });

    // Initial state
    updateAriaPressed(html.classList.contains('dark'));
    updateMetaThemeColor(html.classList.contains('dark'));
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // Public API
  window.__gbTheme = {
    destroy: function () {
      controller.abort();
    },
    toggle: toggleTheme,
    isDark: function () {
      return document.documentElement.classList.contains('dark');
    }
  };
})();
