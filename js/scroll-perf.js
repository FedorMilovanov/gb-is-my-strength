/**
 * scroll-perf.js — ScrollBus (rAF-throttle) + Hebrew debounce + VisualViewport
 * Подключить ДО enhancements.js, highlights.js, bookmark-engine.js
 * Исправляет: P1-10/11/12/13 — layout thrash, множественные scroll-хендлеры
 */
(function () {
  'use strict';

  var subs = [];
  var ticking = false;
  var pageHidden = document.hidden;

  function run() {
    if (pageHidden) {
      ticking = false;
      return;
    }
    ticking = false;
    var state = {
      y: window.scrollY,
      h: window.innerHeight,
      docH: Math.max(document.body.scrollHeight || 0, document.documentElement.scrollHeight || 0),
      pct: 0
    };
    var maxScroll = state.docH - state.h;
    state.pct = maxScroll > 0 ? Math.min(state.y / maxScroll, 1) : 0;
    subs.forEach(function (fn) {
      try { fn(state); } catch (e) {}
    });
  }

  window.addEventListener('scroll', function (, { passive: true }) {
    if (pageHidden) return;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(run);
    }
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    pageHidden = document.hidden;
    if (pageHidden) ticking = false;
  }, { passive: true });

  window.ScrollBus = {
    subscribe: function (fn) {
      if (typeof fn === 'function') {
        subs.push(fn);
        return function () {
          var idx = subs.indexOf(fn);
          if (idx > -1) subs.splice(idx, 1);
        };
      }
      return function () {};
    }
  };

  var hebrewTimer = 0;
  window.SiteUtils = window.SiteUtils || {};
  window.SiteUtils.scheduleHebrewMeasure = function (fn) {
    clearTimeout(hebrewTimer);
    hebrewTimer = setTimeout(function () {
      requestAnimationFrame(fn);
    }, 120);
  };

  if (window.visualViewport) {
    var vvpTimer;
    var _vvpResizeHandler, _vvpScrollHandler;
    function updateVVP() {
      clearTimeout(vvpTimer);
      vvpTimer = setTimeout(function () {
        var vvh = window.visualViewport.height || window.innerHeight;
        var kh = window.innerHeight - vvh;
        document.documentElement.style.setProperty('--visual-viewport-h', vvh + 'px');
        document.documentElement.style.setProperty('--keyboard-height', Math.max(0, kh) + 'px');
      }, 100);
    }
    _vvpResizeHandler = updateVVP;
    _vvpScrollHandler = updateVVP;
    window.visualViewport.addEventListener('resize', _vvpResizeHandler, { passive: true });
    window.visualViewport.addEventListener('scroll', _vvpScrollHandler, { passive: true });
    updateVVP();

    /* Bug #11: cleanup visualViewport listeners on pagehide to prevent
       accumulation during bfcache restore cycles. */
    window.addEventListener('pagehide', function () {
      clearTimeout(vvpTimer);
      window.visualViewport.removeEventListener('resize', _vvpResizeHandler);
      window.visualViewport.removeEventListener('scroll', _vvpScrollHandler);
    });
  } else {
    document.documentElement.style.setProperty('--visual-viewport-h', window.innerHeight + 'px');
    document.documentElement.style.setProperty('--keyboard-height', '0px');
  }

  /* Bug #11: cleanup hebrewTimer on pagehide */
  window.addEventListener('pagehide', function () {
    clearTimeout(hebrewTimer);
  });
})();
