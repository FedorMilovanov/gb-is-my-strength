/**
 * back-to-top.js — РЕФАКТОРИНГ 6.0 Phase 3
 * 
 * Back-to-top button scroll visibility.
 * Shows/hides the #back-to-top button based on scroll position.
 * 
 * No dependencies on site.js config object.
 * Uses AbortController for cleanup.
 */
(function () {
  'use strict';

  var controller = new AbortController();
  var signal = controller.signal;
  var SCROLL_THRESHOLD = 600;

  function updateVisibility() {
    var btn = document.getElementById('back-to-top');
    if (!btn) return;
    if (window.scrollY > SCROLL_THRESHOLD) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }

  function init() {
    var btn = document.getElementById('back-to-top');
    if (!btn) return;

    // Click handler
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, { signal: signal });

    // Scroll visibility
    window.addEventListener('scroll', updateVisibility, { passive: true, signal: signal });
    updateVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.__gbBackToTop = {
    destroy: function () {
      controller.abort();
    }
  };
})();
