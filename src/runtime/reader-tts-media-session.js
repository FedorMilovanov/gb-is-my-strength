(() => {
  'use strict';

  const VERSION = 1;
  if (window.GBReaderTTSMediaSession?.version === VERSION) return;

  const SILENCE_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  let anchor = null;

  function pageTitle() {
    return String(
      document.querySelector('meta[property="og:title"]')?.content
      || document.querySelector('h1')?.textContent
      || document.title
      || 'Озвучка статьи'
    ).replace(/\s+/g, ' ').trim();
  }

  function artwork() {
    const source = document.querySelector('meta[property="og:image"]')?.content;
    if (!source) return [];
    try {
      return [{ src: new URL(source, location.href).href }];
    } catch {
      return [];
    }
  }

  function ensureAnchor() {
    if (anchor?.isConnected) return anchor;
    anchor = document.createElement('audio');
    anchor.src = SILENCE_WAV;
    anchor.loop = true;
    anchor.volume = 0;
    anchor.preload = 'auto';
    anchor.playsInline = true;
    anchor.setAttribute('aria-hidden', 'true');
    anchor.setAttribute('data-gb-reader-tts-anchor', 'true');
    anchor.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px';
    document.body.appendChild(anchor);
    return anchor;
  }

  function setMetadata() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata !== 'function') return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: pageTitle(),
        artist: 'Господь Бог — Сила Моя',
        album: 'Озвучка статьи',
        artwork: artwork(),
      });
    } catch {}
  }

  function apply(phase) {
    const playing = phase === 'playing' || phase === 'starting';
    const audio = ensureAnchor();
    if (playing) {
      setMetadata();
      try {
        const result = audio.play();
        result?.catch?.(() => {});
      } catch {}
      return;
    }
    try { audio.pause(); } catch {}
    if (phase === 'idle' || phase === 'complete' || phase === 'error') {
      try { audio.currentTime = 0; } catch {}
    }
  }

  window.addEventListener('gb:reader-tts-state', (event) => apply(event.detail?.phase || 'idle'));
  window.addEventListener('pagehide', () => apply('idle'));
  window.addEventListener('beforeunload', () => apply('idle'));

  window.GBReaderTTSMediaSession = Object.freeze({
    version: VERSION,
    getAnchor: ensureAnchor,
    refresh: () => apply(window.GBReaderTTS?.getState?.().phase || 'idle'),
  });
})();
