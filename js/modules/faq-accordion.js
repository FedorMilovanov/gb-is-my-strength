/**
 * faq-accordion.js — РЕФАКТОРИНГ 6.0 Phase 3
 * 
 * Self-contained FAQ accordion module.
 * Extracted from site.js (lines 2786-2793 in prettified version).
 * 
 * No dependencies on site.js config object.
 * Uses AbortController for cleanup.
 */
(function () {
  'use strict';

  var controller = new AbortController();
  var signal = controller.signal;

  function init() {
    var questions = document.querySelectorAll('.faq-accordion__q');
    questions.forEach(function (q) {
      q.addEventListener('click', function () {
        var accordion = q.closest('.faq-accordion');
        // Skip if enhanced version is active (data-gb-faq-enhanced)
        if (accordion && accordion.getAttribute('data-gb-faq-enhanced')) {
          return;
        }
        var item = q.closest('.faq-accordion__item');
        if (item) {
          var isOpen = item.classList.contains('open');
          item.classList.toggle('open', !isOpen);
          q.setAttribute('aria-expanded', String(!isOpen));
        }
      }, { signal: signal });
    });
  }

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // Public API for cleanup
  window.__gbFaqAccordion = {
    destroy: function () {
      controller.abort();
    },
    reinit: function () {
      controller = new AbortController();
      signal = controller.signal;
      init();
    }
  };
})();
