/**
 * Clear, recoverable TTS engine status for every reader surface.
 *
 * The reader intentionally starts immediately with Web Speech while the local
 * Vosk model warms in the background. This bridge makes that choice visible,
 * explains why enhanced speech is unavailable, and gives the user a direct
 * retry path without clearing browser storage.
 */
(() => {
  'use strict';

  if (window.GBTtsEngineStatus) return;

  const OPT_OUT_KEY = 'gbx-vosk-warmup';
  const ENGINE_SRC = '/js/vosk-tts-engine.js';
  const STYLE_ID = 'gb-tts-engine-status-style';
  const CARD_ID = 'gb-tts-engine-status';
  const READY_POLL_MS = 500;
  const READY_POLL_LIMIT = 240; // two minutes; a cold 280 MB transfer can be slow

  let card = null;
  let hideTimer = 0;
  let readinessTimer = 0;
  let readinessPolls = 0;
  let engineScriptPromise = null;
  let modelState = 'idle';
  let lastError = '';
  let lastRenderedKind = '';

  const css = `
#${CARD_ID}{box-sizing:border-box;position:fixed;right:max(18px,env(safe-area-inset-right,0px));bottom:max(18px,env(safe-area-inset-bottom,0px));z-index:var(--z-toast-high,9997);width:min(370px,calc(100vw - 24px));display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 10px 10px 12px;border:1px solid color-mix(in srgb,var(--color-accent,#7a2e2e) 16%,var(--color-border,#e5e2dc));border-radius:16px;background:color-mix(in srgb,var(--color-surface,#fff) 94%,var(--color-accent-soft,#f6ece8) 6%);color:var(--color-text,#1a1a1a);box-shadow:0 18px 46px -24px rgba(24,18,12,.34),0 2px 8px rgba(24,18,12,.08);font-family:"Source Sans 3",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.25;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(12px) scale(.985);transition:opacity .2s ease,transform .28s cubic-bezier(.22,1,.36,1),visibility 0s linear .28s}
#${CARD_ID}.is-visible{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition-delay:0s}
body.has-bottom-bar #${CARD_ID}{bottom:max(84px,calc(env(safe-area-inset-bottom,0px) + 84px))}
#${CARD_ID} .gb-tts-engine-status__icon{position:relative;width:30px;height:30px;display:grid;place-items:center;border-radius:50%;background:var(--color-accent-soft,#f6ece8);color:var(--color-accent,#7a2e2e);box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 16%,transparent)}
#${CARD_ID} .gb-tts-engine-status__icon::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor}
#${CARD_ID}[data-kind="loading"] .gb-tts-engine-status__icon::before{animation:gb-tts-engine-status-pulse 1.5s ease-out infinite}
#${CARD_ID}[data-kind="ready"] .gb-tts-engine-status__icon{color:#2f7d4a;background:color-mix(in srgb,#2f7d4a 11%,var(--color-surface,#fff))}
#${CARD_ID}[data-kind="error"] .gb-tts-engine-status__icon,#${CARD_ID}[data-kind="disabled"] .gb-tts-engine-status__icon{color:#8a5b16;background:color-mix(in srgb,#b7791f 10%,var(--color-surface,#fff))}
#${CARD_ID} .gb-tts-engine-status__copy{min-width:0;display:flex;flex-direction:column;gap:2px}
#${CARD_ID} .gb-tts-engine-status__title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:760;letter-spacing:.005em;color:var(--color-text,#1a1a1a)}
#${CARD_ID} .gb-tts-engine-status__meta{font-size:11px;font-weight:520;line-height:1.3;color:var(--color-text-muted,#6a6a6a)}
#${CARD_ID} .gb-tts-engine-status__action{min-height:38px;padding:0 12px;border:1px solid color-mix(in srgb,var(--color-accent,#7a2e2e) 24%,var(--color-border,#e5e2dc));border-radius:999px;background:transparent;color:var(--color-accent,#7a2e2e);font:700 11px/1 "Source Sans 3",system-ui,sans-serif;letter-spacing:.01em;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .18s ease,color .18s ease,border-color .18s ease,transform .16s ease}
#${CARD_ID} .gb-tts-engine-status__action:hover{background:var(--color-accent,#7a2e2e);color:#fff;border-color:var(--color-accent,#7a2e2e)}
#${CARD_ID} .gb-tts-engine-status__action:active{transform:scale(.96)}
#${CARD_ID} .gb-tts-engine-status__action:focus-visible{outline:2px solid var(--color-accent,#7a2e2e);outline-offset:2px}
#${CARD_ID} .gb-tts-engine-status__action[hidden]{display:none}
html.dark #${CARD_ID}{background:color-mix(in srgb,var(--color-surface,#161a21) 92%,var(--color-accent,#d4a574) 8%);border-color:color-mix(in srgb,var(--color-accent-strong,#e8b878) 22%,var(--color-border,#232830));box-shadow:0 22px 54px -24px rgba(0,0,0,.72),0 2px 10px rgba(0,0,0,.42)}
html.dark #${CARD_ID} .gb-tts-engine-status__action{color:var(--color-accent-strong,#e8b878);border-color:color-mix(in srgb,var(--color-accent-strong,#e8b878) 28%,var(--color-border,#232830))}
html.dark #${CARD_ID} .gb-tts-engine-status__action:hover{background:var(--color-accent-strong,#e8b878);border-color:var(--color-accent-strong,#e8b878);color:#17120d}
@media(max-width:600px){#${CARD_ID}{right:50%;bottom:max(14px,env(safe-area-inset-bottom,0px));width:calc(100vw - 20px);grid-template-columns:30px minmax(0,1fr) auto;gap:8px;padding:9px 9px 9px 10px;border-radius:14px;transform:translate(50%,12px) scale(.985)}#${CARD_ID}.is-visible{transform:translate(50%,0)}body.has-bottom-bar #${CARD_ID}{bottom:max(82px,calc(env(safe-area-inset-bottom,0px) + 82px))}#${CARD_ID} .gb-tts-engine-status__title{font-size:12px}#${CARD_ID} .gb-tts-engine-status__meta{font-size:10.5px}#${CARD_ID} .gb-tts-engine-status__action{min-height:42px;padding:0 10px;font-size:10.5px}}
@media(pointer:coarse){#${CARD_ID} .gb-tts-engine-status__action{min-height:44px}}
@media(prefers-reduced-motion:reduce){#${CARD_ID},#${CARD_ID} .gb-tts-engine-status__action{transition:none}#${CARD_ID}[data-kind="loading"] .gb-tts-engine-status__icon::before{animation:none}}
@keyframes gb-tts-engine-status-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,currentColor 28%,transparent)}70%,100%{box-shadow:0 0 0 9px transparent}}
`;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function optedOut() {
    try { return localStorage.getItem(OPT_OUT_KEY) === 'off'; }
    catch (_) { return false; }
  }

  function saveDataEnabled() {
    try {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return Boolean(connection && connection.saveData === true);
    } catch (_) { return false; }
  }

  function enhancedReady() {
    try {
      return Boolean(window.VoskTTSEngine && window.VoskTTSEngine.isReady && window.VoskTTSEngine.isReady());
    } catch (_) { return false; }
  }

  function getCard() {
    if (card && document.documentElement.contains(card)) return card;
    ensureStyle();
    const el = document.createElement('div');
    el.id = CARD_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.innerHTML =
      '<span class="gb-tts-engine-status__icon" aria-hidden="true"></span>' +
      '<span class="gb-tts-engine-status__copy">' +
        '<strong class="gb-tts-engine-status__title"></strong>' +
        '<span class="gb-tts-engine-status__meta"></span>' +
      '</span>' +
      '<button class="gb-tts-engine-status__action" type="button" hidden></button>';
    document.body.appendChild(el);
    card = el;
    return el;
  }

  function hide(delay = 0) {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!card) return;
      card.classList.remove('is-visible');
    }, delay);
  }

  function show(options) {
    const el = getCard();
    const title = el.querySelector('.gb-tts-engine-status__title');
    const meta = el.querySelector('.gb-tts-engine-status__meta');
    const action = el.querySelector('.gb-tts-engine-status__action');
    const kind = options.kind || 'info';
    lastRenderedKind = kind;
    el.dataset.kind = kind;
    title.textContent = options.title || '';
    meta.textContent = options.meta || '';
    action.replaceWith(action.cloneNode(true));
    const freshAction = el.querySelector('.gb-tts-engine-status__action');
    if (options.actionLabel && typeof options.onAction === 'function') {
      freshAction.hidden = false;
      freshAction.textContent = options.actionLabel;
      freshAction.setAttribute('aria-label', options.actionAria || options.actionLabel);
      freshAction.addEventListener('click', options.onAction, { once: true });
    } else {
      freshAction.hidden = true;
      freshAction.textContent = '';
      freshAction.removeAttribute('aria-label');
    }
    clearTimeout(hideTimer);
    requestAnimationFrame(() => el.classList.add('is-visible'));
    if (options.timeout !== 0) hide(options.timeout || 4200);
  }

  function showBrowserStatus() {
    if (enhancedReady()) {
      show({
        kind: 'ready',
        title: 'Улучшенный голос включён',
        meta: 'Локальная модель работает в этом браузере',
        timeout: 3600,
      });
      return;
    }

    if (modelState === 'loading') {
      show({
        kind: 'loading',
        title: 'Браузерная озвучка включена',
        meta: 'Улучшенный голос загружается в фоне',
        timeout: 3600,
      });
      return;
    }

    if (optedOut()) {
      show({
        kind: 'disabled',
        title: 'Сейчас звучит браузерный голос',
        meta: 'Улучшенный голос ранее был отключён',
        actionLabel: 'Включить',
        actionAria: 'Включить загрузку улучшенного голоса',
        onAction: retryEnhanced,
        timeout: 0,
      });
      return;
    }

    if (saveDataEnabled()) {
      show({
        kind: 'disabled',
        title: 'Сейчас звучит браузерный голос',
        meta: 'Автозагрузка выключена режимом экономии трафика',
        actionLabel: 'Загрузить',
        actionAria: 'Загрузить улучшенный голос несмотря на экономию трафика',
        onAction: retryEnhanced,
        timeout: 0,
      });
      return;
    }

    if (lastError) {
      show({
        kind: 'error',
        title: 'Сейчас звучит браузерный голос',
        meta: 'Улучшенный голос не загрузился',
        actionLabel: 'Повторить',
        actionAria: 'Повторить загрузку улучшенного голоса',
        onAction: retryEnhanced,
        timeout: 0,
      });
      return;
    }

    show({
      kind: 'info',
      title: 'Браузерная озвучка включена',
      meta: 'Улучшенный голос готовится в фоне · около 280 МБ один раз',
      timeout: 5200,
    });
    watchReadiness();
  }

  function waitForExistingScript(script) {
    return new Promise((resolve, reject) => {
      if (window.VoskTTSEngine) { resolve(); return; }
      let settled = false;
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timeout);
        fn(value);
      };
      const poll = window.setInterval(() => {
        if (window.VoskTTSEngine) done(resolve);
      }, 100);
      const timeout = window.setTimeout(() => done(reject, new Error('vosk engine script timeout')), 15000);
      script.addEventListener('load', () => done(resolve), { once: true });
      script.addEventListener('error', () => done(reject, new Error('vosk engine script failed')), { once: true });
    });
  }

  function loadEngineScript() {
    if (window.VoskTTSEngine) return Promise.resolve();
    if (engineScriptPromise) return engineScriptPromise;
    const existing = Array.from(document.scripts).find((script) => /\/js\/vosk-tts-engine\.js(?:\?|$)/.test(script.src || ''));
    if (existing) {
      engineScriptPromise = waitForExistingScript(existing).catch((error) => {
        engineScriptPromise = null;
        throw error;
      });
      return engineScriptPromise;
    }
    engineScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = ENGINE_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('vosk engine script failed'));
      document.head.appendChild(script);
    }).catch((error) => {
      engineScriptPromise = null;
      throw error;
    });
    return engineScriptPromise;
  }

  function retryEnhanced() {
    try { localStorage.removeItem(OPT_OUT_KEY); } catch (_) {}
    lastError = '';
    modelState = 'loading';
    show({
      kind: 'loading',
      title: 'Запускаем улучшенный голос',
      meta: 'Модель загрузится один раз и сохранится в браузере',
      actionLabel: 'Остановить',
      actionAria: 'Остановить загрузку улучшенного голоса',
      onAction: cancelEnhanced,
      timeout: 0,
    });

    return loadEngineScript().then(() => {
      if (!(window.VoskTTSEngine && window.VoskTTSEngine.isSupported && window.VoskTTSEngine.isSupported())) {
        throw new Error('enhanced voice is not supported by this browser');
      }
      return window.VoskTTSEngine.ensureLoaded();
    }).then(() => {
      modelState = 'ready';
      lastError = '';
      show({
        kind: 'ready',
        title: 'Улучшенный голос готов',
        meta: 'Он включится при следующем запуске озвучки',
        timeout: 5200,
      });
    }).catch((error) => {
      if (error && (error.name === 'AbortError' || error.userCancelled)) {
        modelState = 'cancelled';
        showBrowserStatus();
        return;
      }
      modelState = 'error';
      lastError = (error && error.message) || String(error || 'unknown error');
      show({
        kind: 'error',
        title: 'Улучшенный голос пока недоступен',
        meta: 'Браузерная озвучка продолжает работать',
        actionLabel: 'Повторить',
        actionAria: 'Повторить загрузку улучшенного голоса',
        onAction: retryEnhanced,
        timeout: 0,
      });
    });
  }

  function cancelEnhanced() {
    try {
      if (window.VoskTTSEngine && window.VoskTTSEngine.cancelLoading) {
        window.VoskTTSEngine.cancelLoading({ persist: true });
      } else {
        localStorage.setItem(OPT_OUT_KEY, 'off');
      }
    } catch (_) {}
    modelState = 'cancelled';
    showBrowserStatus();
  }

  function watchReadiness() {
    if (readinessTimer || enhancedReady()) return;
    readinessPolls = 0;
    readinessTimer = window.setInterval(() => {
      readinessPolls += 1;
      if (enhancedReady()) {
        clearInterval(readinessTimer);
        readinessTimer = 0;
        modelState = 'ready';
        lastError = '';
        show({
          kind: 'ready',
          title: 'Улучшенный голос готов',
          meta: 'Он включится при следующем запуске озвучки',
          timeout: 5200,
        });
      } else if (readinessPolls >= READY_POLL_LIMIT) {
        clearInterval(readinessTimer);
        readinessTimer = 0;
      }
    }, READY_POLL_MS);
  }

  window.addEventListener('gb:tts-state', (event) => {
    const state = event && event.detail && event.detail.state;
    if (state === 'playing') showBrowserStatus();
    if (state === 'idle' || state === 'complete') hide(800);
  });

  window.addEventListener('gb:vosk-model-download-start', () => {
    modelState = 'loading';
    lastError = '';
    // The engine owns the richer cancellable download card. Avoid two cards.
    hide(0);
    watchReadiness();
  });

  window.addEventListener('gb:vosk-model-download-complete', () => {
    modelState = 'ready';
    lastError = '';
    show({
      kind: 'ready',
      title: 'Улучшенный голос готов',
      meta: 'Он включится при следующем запуске озвучки',
      timeout: 5200,
    });
  });

  window.addEventListener('gb:vosk-model-download-cancelled', () => {
    modelState = 'cancelled';
    showBrowserStatus();
  });

  window.addEventListener('gb:vosk-model-download-error', (event) => {
    modelState = 'error';
    lastError = (event && event.detail && event.detail.message) || 'model download failed';
    showBrowserStatus();
  });

  window.addEventListener('error', (event) => {
    const target = event && event.target;
    if (!(target instanceof HTMLScriptElement)) return;
    if (!/\/js\/vosk-tts-engine\.js(?:\?|$)/.test(target.src || '')) return;
    modelState = 'error';
    lastError = 'vosk engine script failed';
    showBrowserStatus();
  }, true);

  window.GBTtsEngineStatus = Object.freeze({
    showBrowserStatus,
    retryEnhanced,
    cancelEnhanced,
    getState() {
      return {
        modelState,
        lastError,
        optedOut: optedOut(),
        saveData: saveDataEnabled(),
        enhancedReady: enhancedReady(),
        lastRenderedKind,
      };
    },
  });
})();
