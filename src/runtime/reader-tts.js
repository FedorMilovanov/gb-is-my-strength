(() => {
  'use strict';

  const VERSION = 1;
  if (window.GBReaderTTS?.version === VERSION) return;

  const PLAY_SELECTOR = '[data-fc-action="play"]';
  const RATE_KEY = 'gb:audio:rate';
  const SPEAKER_KEY = 'gb:audio:speaker';
  const ENGINE_SRC = '/js/vosk-tts-engine.js';
  const LOCK_NAME = 'gb-vosk-model-init-v1';
  const MAX_CHUNK = 520;
  const EXCLUDED_BLOCK = [
    'nav', 'aside', 'footer', '[hidden]', '[aria-hidden="true"]',
    '[data-pagefind-ignore]', '[data-no-speech]', '.breadcrumb', '.article-byline',
    '.footnote', '.footnotes', '.sources-block', '.reading-list-section',
    '.series-navigation', '.gb-tts-download-notice', '.gb-fc-toast',
  ].join(',');
  const STRIP_INLINE = [
    'script', 'style', 'noscript', 'button', 'svg', 'audio', 'video',
    '[lang="en"]', '[lang^="en-"]', '.gtip', '.fn-marker', '.tooltip',
    '.footnote-popup', '[aria-hidden="true"]', '[data-no-speech]',
  ].join(',');

  const state = {
    phase: 'idle',
    parts: [],
    index: 0,
    offset: 0,
    totalChars: 0,
    completedChars: 0,
    token: 0,
    engine: null,
    utterance: null,
    voskHandle: null,
    voskAudio: null,
    generatedRate: 1,
    rate: readRate(),
    speaker: readSpeaker(),
    voice: null,
    pausedDuringStart: false,
    progressFrame: 0,
    progressTimer: 0,
    followElement: null,
    engineScriptPromise: null,
    warmPromise: null,
    lastError: null,
  };

  let customWords = new Set();
  const customTermsReady = fetch('/js/vosk-custom-terms.json', { cache: 'force-cache' })
    .then((response) => response.ok ? response.json() : {})
    .then((json) => {
      customWords = new Set(Object.keys(json || {}).filter((key) => key && key !== '_comment').map((key) => key.toLowerCase()));
      return customWords;
    })
    .catch(() => customWords);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readRate() {
    try {
      const value = Number(localStorage.getItem(RATE_KEY));
      return Number.isFinite(value) ? clamp(value, 0.6, 2) : 1;
    } catch {
      return 1;
    }
  }

  function readSpeaker() {
    try {
      const value = Number(localStorage.getItem(SPEAKER_KEY));
      return Number.isFinite(value) ? clamp(Math.round(value), 0, 7) : 3;
    } catch {
      return 3;
    }
  }

  function playButtons() {
    return Array.from(document.querySelectorAll(PLAY_SELECTOR));
  }

  function publicButtonState(phase) {
    if (phase === 'paused') return 'paused';
    if (phase === 'playing' || phase === 'starting') return 'playing';
    if (phase === 'complete') return 'complete';
    return 'idle';
  }

  function labelForPhase(phase) {
    if (phase === 'starting') return 'Подготовка озвучки';
    if (phase === 'playing') return 'Пауза';
    if (phase === 'paused') return 'Продолжить озвучку';
    if (phase === 'complete') return 'Прослушать статью снова';
    if (phase === 'error') return 'Повторить озвучку';
    return 'Озвучить статью';
  }

  function setPhase(phase) {
    state.phase = phase;
    const buttonState = publicButtonState(phase);
    const label = labelForPhase(phase);
    playButtons().forEach((button) => {
      button.dataset.state = buttonState;
      button.dataset.ttsPhase = phase;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', phase === 'playing' || phase === 'paused' || phase === 'starting' ? 'true' : 'false');
      if (phase === 'starting') button.setAttribute('aria-busy', 'true');
      else button.removeAttribute('aria-busy');
    });
    try {
      window.dispatchEvent(new CustomEvent('gb:reader-tts-state', { detail: snapshot() }));
    } catch {}
    updateMediaSession(phase);
  }

  function setProgress(value) {
    const normalized = clamp(Number(value) || 0, 0, 1);
    playButtons().forEach((button) => button.style.setProperty('--p', String(normalized)));
  }

  function progressFor(offset = state.offset) {
    if (!state.totalChars) return 0;
    return clamp((state.completedChars + clamp(offset, 0, currentPart()?.text.length || 0)) / state.totalChars, 0, 1);
  }

  function currentPart() {
    return state.parts[state.index] || null;
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?»])/g, '$1')
      .replace(/([«])\s+/g, '$1')
      .trim();
  }

  function readableText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll(STRIP_INLINE).forEach((node) => node.remove());
    return normalizeText(clone.textContent);
  }

  function splitText(text) {
    if (text.length <= MAX_CHUNK) return [text];
    const sentences = text.match(/[^.!?…]+[.!?…]+(?:[»”"])?|[^.!?…]+$/g) || [text];
    const chunks = [];
    let current = '';
    const pushCurrent = () => {
      const value = normalizeText(current);
      if (value) chunks.push(value);
      current = '';
    };
    for (const sentenceValue of sentences) {
      const sentence = normalizeText(sentenceValue);
      if (!sentence) continue;
      if ((current + ' ' + sentence).trim().length <= MAX_CHUNK) {
        current = (current + ' ' + sentence).trim();
        continue;
      }
      pushCurrent();
      if (sentence.length <= MAX_CHUNK) {
        current = sentence;
        continue;
      }
      let rest = sentence;
      while (rest.length > MAX_CHUNK) {
        let cut = rest.lastIndexOf(' ', MAX_CHUNK);
        if (cut < Math.floor(MAX_CHUNK * 0.55)) cut = MAX_CHUNK;
        chunks.push(normalizeText(rest.slice(0, cut)));
        rest = rest.slice(cut).trim();
      }
      current = rest;
    }
    pushCurrent();
    return chunks;
  }

  function collectParts() {
    const root = document.querySelector('article.article-body, article[data-pagefind-body], main[data-pagefind-body], article, main#main-content, main');
    if (!root) return [];
    const candidates = Array.from(root.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,figcaption,dt,dd'));
    const parts = [];
    for (const element of candidates) {
      if (element.closest(EXCLUDED_BLOCK)) continue;
      if (element.matches('li') && element.querySelector(':scope > p, :scope > ul, :scope > ol')) continue;
      if (element.matches('blockquote') && element.querySelector(':scope > p')) continue;
      const text = readableText(element);
      if (!text) continue;
      for (const chunk of splitText(text)) parts.push({ text: chunk, element });
    }
    return parts;
  }

  function rebuildTotals() {
    state.totalChars = state.parts.reduce((sum, part) => sum + part.text.length, 0);
    state.completedChars = state.parts.slice(0, state.index).reduce((sum, part) => sum + part.text.length, 0);
  }

  function pickRussianVoice() {
    if (!window.speechSynthesis) return null;
    let voices = [];
    try { voices = window.speechSynthesis.getVoices() || []; } catch { return null; }
    const russian = voices.filter((voice) => /^ru(?:[-_]|$)/i.test(voice.lang || '') || /рус|russian/i.test(`${voice.name || ''} ${voice.lang || ''}`));
    return russian.find((voice) => /google/i.test(voice.name || ''))
      || russian.find((voice) => voice.localService === false)
      || russian[0]
      || null;
  }

  function patchCoreDictionary() {
    const core = window.VoskTTSCore;
    if (!core || core.__gbManualOverridePatched || typeof core.parseDictionary !== 'function') return;
    const original = core.parseDictionary;
    core.parseDictionary = function patchedParseDictionary(...args) {
      const dictionary = original.apply(this, args);
      if (dictionary && typeof dictionary.delete === 'function') {
        customWords.forEach((word) => dictionary.delete(word));
      }
      return dictionary;
    };
    core.__gbManualOverridePatched = true;
  }

  function enableOrtProxy() {
    try {
      if (window.ort?.env?.wasm) window.ort.env.wasm.proxy = true;
    } catch (error) {
      console.warn('[GBReaderTTS] ORT proxy activation failed', error);
    }
  }

  function patchVoskEngine() {
    const engine = window.VoskTTSEngine;
    if (!engine || engine.__gbReaderPatched) return;
    const wrapWithLock = (methodName) => {
      const original = engine[methodName];
      if (typeof original !== 'function') return;
      engine[methodName] = function lockedVoskLoad(...args) {
        const invoke = async () => {
          await customTermsReady;
          patchCoreDictionary();
          enableOrtProxy();
          return original.apply(engine, args);
        };
        if (navigator.locks?.request) {
          return navigator.locks.request(LOCK_NAME, { mode: 'exclusive' }, invoke);
        }
        return invoke();
      };
    };
    wrapWithLock('ensureLoaded');
    wrapWithLock('retryLoading');
    Object.defineProperty(engine, '__gbReaderPatched', { value: true });
  }

  function inspectLoadedScript(script) {
    const src = String(script?.src || '');
    if (/onnxruntime/i.test(src)) enableOrtProxy();
    if (/vosk-tts-core/i.test(src)) patchCoreDictionary();
    if (/vosk-tts-engine/i.test(src)) patchVoskEngine();
  }

  document.addEventListener('load', (event) => {
    if (event.target instanceof HTMLScriptElement) inspectLoadedScript(event.target);
  }, true);
  enableOrtProxy();
  patchCoreDictionary();
  patchVoskEngine();

  function ensureVoskScript() {
    if (window.VoskTTSEngine) {
      patchVoskEngine();
      return Promise.resolve(window.VoskTTSEngine);
    }
    if (state.engineScriptPromise) return state.engineScriptPromise;
    state.engineScriptPromise = new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((script) => /vosk-tts-engine\.js/i.test(script.src || ''));
      const script = existing || document.createElement('script');
      const done = () => {
        patchVoskEngine();
        if (window.VoskTTSEngine) resolve(window.VoskTTSEngine);
        else reject(new Error('Vosk engine did not initialize'));
      };
      if (existing) {
        if (window.VoskTTSEngine) done();
        else {
          existing.addEventListener('load', done, { once: true });
          existing.addEventListener('error', () => reject(new Error('Vosk engine script failed')), { once: true });
        }
      } else {
        script.src = ENGINE_SRC;
        script.defer = true;
        script.addEventListener('load', done, { once: true });
        script.addEventListener('error', () => reject(new Error('Vosk engine script failed')), { once: true });
        document.head.appendChild(script);
      }
    }).finally(() => {
      state.engineScriptPromise = null;
    });
    return state.engineScriptPromise;
  }

  function warmVosk({ retry = false } = {}) {
    if (state.warmPromise) return state.warmPromise;
    state.warmPromise = ensureVoskScript()
      .then((engine) => {
        if (!engine.isSupported?.()) return null;
        if (engine.isReady?.()) return engine;
        if (retry && engine.retryLoading) return engine.retryLoading({ clearOptOut: true }).then(() => engine);
        return engine.ensureLoaded().then(() => engine);
      })
      .catch((error) => {
        if (!error?.userCancelled) console.warn('[GBReaderTTS] Vosk warm-up failed; system voice remains available', error);
        return null;
      })
      .finally(() => {
        state.warmPromise = null;
      });
    return state.warmPromise;
  }

  function selectEngine() {
    if (window.VoskTTSEngine?.isReady?.()) return 'vosk';
    if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      void warmVosk();
      return 'webspeech';
    }
    return 'vosk';
  }

  function clearProgressLoop() {
    if (state.progressFrame) cancelAnimationFrame(state.progressFrame);
    if (state.progressTimer) clearTimeout(state.progressTimer);
    state.progressFrame = 0;
    state.progressTimer = 0;
  }

  function findVoskAudio() {
    const audio = Array.from(document.querySelectorAll('audio')).reverse().find((candidate) => /^blob:/.test(candidate.currentSrc || candidate.src || ''));
    return audio || null;
  }

  function watchVoskProgress(operation, startedAt) {
    clearProgressLoop();
    const tick = () => {
      if (operation !== state.token || state.engine !== 'vosk' || state.phase === 'idle' || state.phase === 'complete' || state.phase === 'error') return;
      const audio = findVoskAudio();
      if (audio) {
        state.voskAudio = audio;
        if (state.pausedDuringStart || state.phase === 'paused') {
          try { audio.pause(); } catch {}
          setPhase('paused');
        } else if (state.phase === 'starting') {
          setPhase('playing');
        }
        const ratio = Number.isFinite(audio.duration) && audio.duration > 0 ? clamp(audio.currentTime / audio.duration, 0, 1) : 0;
        setProgress(progressFor(Math.round((currentPart()?.text.length || 0) * ratio)));
      } else {
        const elapsed = performance.now() - startedAt;
        const synthetic = Math.min(0.18, 0.015 + elapsed / 120000);
        setProgress(progressFor(Math.round((currentPart()?.text.length || 0) * synthetic)));
      }
      state.progressFrame = requestAnimationFrame(tick);
    };
    state.progressFrame = requestAnimationFrame(tick);
  }

  function followCurrentElement() {
    const element = currentPart()?.element;
    if (!element || element === state.followElement) return;
    state.followElement = element;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      const rect = element.getBoundingClientRect();
      if (rect.top < innerHeight * 0.2 || rect.bottom > innerHeight * 0.82) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch {}
  }

  function advance(operation) {
    if (operation !== state.token) return;
    clearProgressLoop();
    const part = currentPart();
    if (part) state.completedChars += part.text.length;
    state.index += 1;
    state.offset = 0;
    state.utterance = null;
    state.voskHandle = null;
    state.voskAudio = null;
    state.pausedDuringStart = false;
    if (state.index >= state.parts.length) {
      setProgress(1);
      setPhase('complete');
      return;
    }
    speakCurrent();
  }

  function fail(operation, error) {
    if (operation !== state.token) return;
    clearProgressLoop();
    state.lastError = error instanceof Error ? error.message : String(error || 'unknown error');
    console.error('[GBReaderTTS] playback failed', error);
    if (state.engine === 'vosk' && window.speechSynthesis && window.SpeechSynthesisUtterance) {
      state.engine = 'webspeech';
      state.voskHandle = null;
      state.voskAudio = null;
      speakCurrent();
      return;
    }
    setPhase('error');
  }

  function speakWeb(operation, text, baseOffset) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = state.rate;
    utterance.pitch = 1;
    if (state.voice) utterance.voice = state.voice;
    utterance.onboundary = (event) => {
      if (operation !== state.token) return;
      const charIndex = Number(event.charIndex);
      if (Number.isFinite(charIndex)) {
        state.offset = clamp(baseOffset + charIndex, 0, currentPart()?.text.length || 0);
        setProgress(progressFor());
        followCurrentElement();
      }
    };
    utterance.onend = () => advance(operation);
    utterance.onerror = (event) => {
      if (event?.error === 'canceled' || event?.error === 'interrupted') return;
      fail(operation, event?.error || event);
    };
    state.utterance = utterance;
    state.engine = 'webspeech';
    setPhase('playing');
    followCurrentElement();
    window.speechSynthesis.speak(utterance);
  }

  function speakVosk(operation, text) {
    const engine = window.VoskTTSEngine;
    if (!engine?.isReady?.()) {
      setPhase('starting');
      warmVosk({ retry: false }).then((readyEngine) => {
        if (operation !== state.token) return;
        if (!readyEngine?.isReady?.()) {
          if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
            state.engine = 'webspeech';
            speakCurrent();
          } else {
            fail(operation, new Error('Голосовой движок недоступен'));
          }
          return;
        }
        speakVosk(operation, text);
      });
      return;
    }
    state.engine = 'vosk';
    state.generatedRate = state.rate;
    state.voskAudio = null;
    setPhase(state.pausedDuringStart ? 'paused' : 'starting');
    followCurrentElement();
    const startedAt = performance.now();
    state.voskHandle = engine.speak(
      text,
      state.rate,
      state.speaker,
      () => advance(operation),
      (error) => fail(operation, error),
    );
    watchVoskProgress(operation, startedAt);
  }

  function speakCurrent() {
    if (state.phase === 'paused') return;
    const part = currentPart();
    if (!part) {
      setPhase('complete');
      return;
    }
    state.offset = clamp(state.offset, 0, part.text.length);
    const text = part.text.slice(state.offset).replace(/^\s+/, '');
    if (!text) {
      const operation = state.token;
      advance(operation);
      return;
    }
    const operation = ++state.token;
    const baseOffset = part.text.length - text.length;
    state.offset = baseOffset;
    state.engine = selectEngine();
    if (state.engine === 'webspeech') speakWeb(operation, text, baseOffset);
    else speakVosk(operation, text);
  }

  function beginSession() {
    cancelActive({ invalidate: true });
    state.parts = [];
    state.index = 0;
    state.offset = 0;
    state.completedChars = 0;
    state.totalChars = 0;
    state.lastError = null;
    state.pausedDuringStart = false;
    setProgress(0);
    setPhase('starting');
    const operation = state.token;
    requestAnimationFrame(() => {
      if (operation !== state.token) return;
      state.parts = collectParts();
      rebuildTotals();
      if (!state.parts.length) {
        fail(operation, new Error('На странице не найден текст для озвучки'));
        return;
      }
      if (state.phase === 'paused') return;
      speakCurrent();
    });
  }

  function cancelActive({ invalidate = true } = {}) {
    clearProgressLoop();
    if (invalidate) state.token += 1;
    if (state.utterance && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    if (state.voskHandle && window.VoskTTSEngine?.cancel) {
      try { window.VoskTTSEngine.cancel(state.voskHandle); } catch {}
    }
    if (state.voskAudio) {
      try { state.voskAudio.pause(); } catch {}
    }
    state.utterance = null;
    state.voskHandle = null;
    state.voskAudio = null;
  }

  function pause() {
    if (state.phase === 'starting') {
      state.pausedDuringStart = true;
      setPhase('paused');
      return;
    }
    if (state.phase !== 'playing') return;
    if (state.engine === 'webspeech' && window.speechSynthesis?.pause) {
      try { window.speechSynthesis.pause(); } catch {}
    } else if (state.engine === 'vosk') {
      const audio = state.voskAudio || findVoskAudio();
      if (audio) {
        state.voskAudio = audio;
        try { audio.pause(); } catch {}
      } else {
        state.pausedDuringStart = true;
      }
    }
    setPhase('paused');
  }

  function resume() {
    if (state.phase !== 'paused') return;
    state.pausedDuringStart = false;
    if (!state.parts.length) {
      setPhase('starting');
      beginSession();
      return;
    }
    if (state.engine === 'webspeech' && state.utterance && window.speechSynthesis?.resume) {
      try { window.speechSynthesis.resume(); } catch {}
      setPhase('playing');
      return;
    }
    if (state.engine === 'vosk') {
      const audio = state.voskAudio || findVoskAudio();
      if (audio?.src) {
        state.voskAudio = audio;
        const promise = audio.play();
        if (promise?.catch) promise.catch((error) => fail(state.token, error));
        setPhase('playing');
        return;
      }
    }
    setPhase('starting');
    speakCurrent();
  }

  function stop({ silent = false } = {}) {
    cancelActive({ invalidate: true });
    state.parts = [];
    state.index = 0;
    state.offset = 0;
    state.completedChars = 0;
    state.totalChars = 0;
    state.engine = null;
    state.pausedDuringStart = false;
    state.followElement = null;
    setProgress(0);
    setPhase('idle');
    if (!silent) {
      try { window.dispatchEvent(new CustomEvent('gb:reader-tts-stopped')); } catch {}
    }
  }

  function toggle() {
    if (window.GBAudio?.toggle) {
      window.GBAudio.toggle();
      return;
    }
    if (state.phase === 'playing' || state.phase === 'starting') {
      pause();
      return;
    }
    if (state.phase === 'paused') {
      resume();
      return;
    }
    beginSession();
  }

  function applyRateChange() {
    state.rate = readRate();
    if (state.phase !== 'playing' && state.phase !== 'paused' && state.phase !== 'starting') return;
    if (state.engine === 'vosk') {
      const audio = state.voskAudio || findVoskAudio();
      if (audio) {
        state.voskAudio = audio;
        audio.playbackRate = clamp(state.rate / Math.max(0.1, state.generatedRate), 0.5, 4);
      }
      return;
    }
    if (state.engine === 'webspeech' && state.utterance) {
      const wasPaused = state.phase === 'paused';
      state.token += 1;
      try { window.speechSynthesis.cancel(); } catch {}
      state.utterance = null;
      if (wasPaused) setPhase('paused');
      else {
        setPhase('starting');
        speakCurrent();
      }
    }
  }

  function switchToVosk(event) {
    if (event?.detail) event.detail.handled = true;
    warmVosk({ retry: true }).then((engine) => {
      if (!engine?.isReady?.()) return;
      if (state.engine !== 'webspeech' || !currentPart()) return;
      const wasPaused = state.phase === 'paused';
      state.token += 1;
      try { window.speechSynthesis.cancel(); } catch {}
      state.utterance = null;
      state.engine = 'vosk';
      if (wasPaused) setPhase('paused');
      else {
        setPhase('starting');
        speakCurrent();
      }
    });
  }

  function retryVosk(event) {
    if (event?.detail) event.detail.handled = true;
    void warmVosk({ retry: true });
  }

  function skip(delta) {
    if (!state.parts.length) return;
    cancelActive({ invalidate: true });
    state.index = clamp(state.index + delta, 0, state.parts.length - 1);
    state.offset = 0;
    rebuildTotals();
    if (state.phase === 'paused') setProgress(progressFor());
    else {
      setPhase('starting');
      speakCurrent();
    }
  }

  function updateMediaSession(phase) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = phase === 'playing' || phase === 'starting'
        ? 'playing'
        : phase === 'paused' ? 'paused' : 'none';
    } catch {}
  }

  function installMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => state.phase === 'paused' ? resume() : toggle());
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('stop', () => stop());
      navigator.mediaSession.setActionHandler('seekbackward', () => skip(-1));
      navigator.mediaSession.setActionHandler('seekforward', () => skip(1));
    } catch {}
  }

  function shortcutsEnabled() {
    if (document.body?.matches('[data-fc-shortcuts="true"],[data-gb-shortcuts="true"]')) return true;
    return Boolean(document.querySelector('[data-fc-root][data-fc-shortcuts="true"],[data-fc-root][data-gb-shortcuts="true"]'));
  }

  function claim(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function onClick(event) {
    const button = event.target instanceof Element ? event.target.closest(PLAY_SELECTOR) : null;
    if (!button) return;
    claim(event);
    toggle();
  }

  function onKeydown(event) {
    if (!shortcutsEnabled()) return;
    if (event.target instanceof Element && event.target.matches('input,textarea,select,[contenteditable]')) return;
    if (event.key === 't' || event.key === 'T') {
      claim(event);
      toggle();
    }
  }

  function snapshot() {
    return {
      version: VERSION,
      phase: state.phase,
      engine: state.engine,
      index: state.index,
      partCount: state.parts.length,
      offset: state.offset,
      rate: state.rate,
      progress: progressFor(),
      error: state.lastError,
    };
  }

  state.voice = pickRussianVoice();
  try {
    window.speechSynthesis?.addEventListener?.('voiceschanged', () => {
      state.voice = pickRussianVoice();
    });
  } catch {}

  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('gb:tts-rate-change', applyRateChange);
  window.addEventListener('gb:vosk-switch-request', switchToVosk);
  window.addEventListener('gb:vosk-retry-request', retryVosk);
  window.addEventListener('pagehide', () => stop({ silent: true }));
  window.addEventListener('beforeunload', () => stop({ silent: true }));
  installMediaSession();

  window.GBReaderTTS = Object.freeze({
    version: VERSION,
    toggle,
    play: () => (state.phase === 'paused' ? resume() : beginSession()),
    pause,
    resume,
    stop,
    skip,
    warmVosk,
    getState: snapshot,
  });
  document.documentElement.dataset.gbReaderTtsReady = '1';
  try {
    window.dispatchEvent(new CustomEvent('gb:reader-tts-ready', { detail: { version: VERSION } }));
  } catch {}
})();
