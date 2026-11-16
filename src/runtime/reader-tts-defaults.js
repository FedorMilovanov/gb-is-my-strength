(() => {
  'use strict';

  // One sitewide preference contract for the ReaderSpeedOptions choices,
  // the mobile controller, the a11y keyboard adapter and the TTS engine.
  // Unsupported historical/custom values must never reach speech playback.
  const rates = Object.freeze([0.75, 1, 1.25, 1.5, 1.75, 2]);
  const PRIMARY = 'gb:audio:rate';
  const LEGACY = 'gbx-tts-rate';
  function normalize(raw) {
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    const value = Number(raw);
    if (value === 0.8) return 0.75; // Gill legacy preference.
    return Number.isFinite(value) && rates.includes(value) ? value : null;
  }
  function write(rate) {
    try {
      if (localStorage.getItem(PRIMARY) !== String(rate)) localStorage.setItem(PRIMARY, String(rate));
      if (localStorage.getItem(LEGACY) !== String(rate)) localStorage.setItem(LEGACY, String(rate));
    } catch {
      // Private mode may prohibit storage; in-memory controls still work.
    }
  }
  function read() {
    try {
      const rate = normalize(localStorage.getItem(PRIMARY)) ??
        normalize(localStorage.getItem(LEGACY)) ?? 1;
      write(rate);
      return rate;
    } catch { return 1; }
  }
  function persist(raw) {
    const rate = normalize(raw);
    if (rate === null) return null;
    write(rate);
    window.dispatchEvent(new CustomEvent('gb:tts-rate-change', { detail: { rate } }));
    return rate;
  }
  window.GBReaderRatePolicy = Object.freeze({ version: 1, rates, normalize, read, persist });
  read();

  try {
    if (localStorage.getItem('gb:audio:speaker') === null) {
      localStorage.setItem('gb:audio:speaker', '3');
    }
  } catch {
    // Storage can be unavailable in hardened/private contexts.
  }
})();
