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
      if (event?.destination?.sameDocument) return;

      const retire = () => retireForDocumentNavigation();
      if (event?.canIntercept && typeof event.intercept === 'function') {
        try {
          event.intercept({ handler: retire });
          return;
        } catch (_) {
          // Fall through to best-effort retirement; pagehide is the final fallback.
        }
      }
      void retire();
    });
  }
})();
