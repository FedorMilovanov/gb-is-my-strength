(() => {
  'use strict';

  let retiring = false;

  function retireForDocumentNavigation() {
    if (retiring) return;
    const engine = window.VoskTTSEngine;
    if (!engine || typeof engine.cancelLoading !== 'function') return;
    retiring = true;
    try {
      engine.cancelLoading({ persist: false });
    } catch (_) {
      // pagehide in vosk-tts-engine.js remains the fallback retirement path.
    }
  }

  if (window.navigation && typeof window.navigation.addEventListener === 'function') {
    window.navigation.addEventListener('navigate', (event) => {
      if (event?.destination?.sameDocument) return;
      retireForDocumentNavigation();
    });
  }
})();
