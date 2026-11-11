(() => {
  'use strict';

  try {
    if (localStorage.getItem('gb:audio:rate') === null) {
      localStorage.setItem('gb:audio:rate', '1');
    }
    // Retire the earlier Gill-only 0.8× preference without changing the
    // reader's saved selection on any other route.
    if (localStorage.getItem('gb:audio:rate') === '0.8') {
      localStorage.setItem('gb:audio:rate', '0.75');
      localStorage.setItem('gbx-tts-rate', '0.75');
    }
    if (localStorage.getItem('gb:audio:speaker') === null) {
      localStorage.setItem('gb:audio:speaker', '3');
    }
  } catch {
    // Storage can be unavailable in hardened/private contexts. The reader
    // runtime still has in-memory fallbacks and must remain usable there.
  }
})();
