(() => {
  'use strict';

  const VERSION = 2;
  const SAMPLE_RATE = 8000;
  const SILENCE_SECONDS = 2;
  let anchor = null;
  let anchorUrl = '';

  if (window.GBReaderTTSMediaSession?.version === VERSION) return;

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

  function writeAscii(view, offset, value) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  }

  function createSilentWavUrl() {
    const frameCount = SAMPLE_RATE * SILENCE_SECONDS;
    const buffer = new ArrayBuffer(44 + frameCount);
    const view = new DataView(buffer);
    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + frameCount, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, SAMPLE_RATE, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, frameCount, true);
    new Uint8Array(buffer, 44).fill(128);
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  }

  function ensureAnchor() {
    if (anchor?.isConnected) return anchor;
    anchor = document.createElement('audio');
    anchorUrl ||= createSilentWavUrl();
    anchor.src = anchorUrl;
    anchor.loop = true;
    anchor.volume = 0.01;
    anchor.muted = false;
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
