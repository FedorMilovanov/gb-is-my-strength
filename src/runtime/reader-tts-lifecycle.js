(() => {
  'use strict';

  let retiring = null;

  function retireForDocumentNavigation() {
    if (retiring) return retiring;
    const engine = window.VoskTTSEngine;
    if (!engine) return Promise.resolve(true);

    if (typeof engine.retire === 'function') {
      retiring = Promise.resolve(engine.retire('document navigation'))
        .catch(() => false)
        .finally(() => { retiring = null; });
      return retiring;
    }

    if (typeof engine.cancelLoading === 'function') {
      try { engine.cancelLoading({ persist: false }); } catch (_) {}
    }
    return Promise.resolve(false);
  }

  if (window.navigation && typeof window.navigation.addEventListener === 'function') {
    window.navigation.addEventListener('navigate', (event) => {
      // Same-document fragments/history are not document exits.
      if (event?.destination?.sameDocument) return;

      // A cross-document navigation MUST stay native. Intercepting it only to
      // retire the TTS client converts the navigation into a same-document
      // URL/history commit: the destination is never fetched or rendered, so
      // every series rail/overlay/neighbour link changed the address bar while
      // keeping the source H1/body. Retirement is best-effort here and is
      // repeated on pagehide by the engine itself; neither path may own the
      // navigation lifecycle.
      void retireForDocumentNavigation();
    });
  }
})();
