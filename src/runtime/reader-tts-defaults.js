(() => {
  'use strict';

  try {
    if (localStorage.getItem('gb:audio:rate') === null) {
      localStorage.setItem('gb:audio:rate', '1');
    }
    if (localStorage.getItem('gb:audio:speaker') === null) {
      localStorage.setItem('gb:audio:speaker', '3');
    }
  } catch {
    // Storage can be unavailable in hardened/private contexts. The reader
    // runtime still has in-memory fallbacks and must remain usable there.
  }
})();
