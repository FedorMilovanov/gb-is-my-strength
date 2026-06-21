/**
 * img-loaded.js — РЕФАКТОРИНГ 6.0 Phase 3
 * 
 * Image load state tracker.
 * Adds 'img-loaded' class when images finish loading,
 * allowing CSS shimmer animation to stop.
 * 
 * Extracted from site.js (lines 2797-2803 in prettified version).
 * No dependencies on site.js config object.
 */
(function () {
  'use strict';

  function init() {
    var images = document.querySelectorAll(
      '.article-figure img, .related-articles__img, .card-cover, .article-hero img'
    );
    images.forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add('img-loaded');
      } else {
        img.addEventListener('load', function () {
          img.classList.add('img-loaded');
        });
        img.addEventListener('error', function () {
          img.classList.add('img-loaded'); // Remove shimmer even on error
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
