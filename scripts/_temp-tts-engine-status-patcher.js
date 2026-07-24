#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');

function file(rel) {
  return path.join(ROOT, rel);
}

function read(rel) {
  return fs.readFileSync(file(rel), 'utf8');
}

function write(rel, value) {
  fs.writeFileSync(file(rel), value, 'utf8');
}

function replaceOnce(source, pattern, replacement, label) {
  let count = 0;
  const next = source.replace(pattern, (...args) => {
    count += 1;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one replacement, got ${count}`);
  }
  return next;
}

function md5short(value) {
  return crypto.createHash('md5').update(value).digest('hex').slice(0, 8);
}

const enginePath = 'js/vosk-tts-engine.js';
const controllerPath = 'js/floating-cluster-controller.js';
const cssPath = 'css/tts-download-notice.css';
const workflowPath = '.github/workflows/tts-download-consent.yml';

let engine = read(enginePath);
let controller = read(controllerPath);
let css = read(cssPath);
let workflow = read(workflowPath);

engine = replaceOnce(
  engine,
  "  var modelDownloadCancelled = false;",
  "  var modelDownloadCancelled = false;\n  var modelDownloadNoticeAction = null;\n  var engineStatus = { phase: 'idle', ready: false, loading: false, optedOut: false };",
  'engine status state'
);

engine = replaceOnce(
  engine,
  /  function getModelDownloadNotice\(\) \{[\s\S]*?(?=  function cancelLoading\(options\) \{)/,
`  function dispatchEngineStatus(phase, detail) {
    var next = {
      phase: phase,
      ready: !!state.ready,
      loading: !!state.loading,
      optedOut: modelDownloadOptedOut()
    };
    if (detail) {
      Object.keys(detail).forEach(function (key) { next[key] = detail[key]; });
    }
    engineStatus = next;
    try { window.dispatchEvent(new CustomEvent('gb:vosk-status', { detail: next })); } catch (_) {}
    return next;
  }

  function getStatus() {
    var copy = {};
    Object.keys(engineStatus).forEach(function (key) { copy[key] = engineStatus[key]; });
    copy.ready = !!state.ready;
    copy.loading = !!state.loading;
    copy.optedOut = modelDownloadOptedOut();
    return copy;
  }

  function bindDownloadNoticeAction(el) {
    var action = el && el.querySelector('.gb-tts-download-notice__action');
    if (!action || action.getAttribute('data-gb-tts-action-bound') === 'true') return;
    action.setAttribute('data-gb-tts-action-bound', 'true');
    action.addEventListener('click', function () {
      var mode = action.getAttribute('data-action') || '';
      if (mode === 'cancel') {
        cancelLoading({ persist: true });
        return;
      }
      if (mode === 'switch') {
        var switchDetail = { handled: false };
        try { window.dispatchEvent(new CustomEvent('gb:vosk-switch-request', { detail: switchDetail })); } catch (_) {}
        return;
      }
      if (mode === 'retry' || mode === 'enable' || mode === 'manual') {
        var retryDetail = { mode: mode, handled: false };
        try { window.dispatchEvent(new CustomEvent('gb:vosk-retry-request', { detail: retryDetail })); } catch (_) {}
        if (!retryDetail.handled) retryLoading({ clearOptOut: true });
      }
    });
  }

  function getModelDownloadNotice() {
    if (modelDownloadNotice && document.documentElement.contains(modelDownloadNotice)) {
      bindDownloadNoticeAction(modelDownloadNotice);
      return modelDownloadNotice;
    }
    var existing = document.querySelector('.gb-tts-download-notice');
    if (existing) {
      modelDownloadNotice = existing;
      bindDownloadNoticeAction(existing);
      return existing;
    }
    var el = document.createElement('div');
    el.className = 'gb-tts-download-notice';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.setAttribute('data-state', 'preparing');
    el.innerHTML =
      '<span class="gb-tts-download-notice__icon" aria-hidden="true"></span>' +
      '<span class="gb-tts-download-notice__copy">' +
        '<strong class="gb-tts-download-notice__title">Проверяем улучшенный голос</strong>' +
        '<span class="gb-tts-download-notice__meta">Системный голос уже работает</span>' +
      '</span>' +
      '<button class="gb-tts-download-notice__action" type="button" hidden></button>';
    document.body.appendChild(el);
    modelDownloadNotice = el;
    bindDownloadNoticeAction(el);
    return el;
  }

  function setNoticeAction(el, mode, label, ariaLabel) {
    var action = el.querySelector('.gb-tts-download-notice__action');
    modelDownloadNoticeAction = mode || null;
    if (!action) return;
    action.hidden = !mode;
    action.setAttribute('data-action', mode || '');
    action.textContent = label || '';
    action.setAttribute('aria-label', ariaLabel || label || '');
  }

  function showStatus(stateName, options) {
    options = options || {};
    ensureDownloadNoticeStyles();
    clearTimeout(modelDownloadNoticeTimer);
    var el = getModelDownloadNotice();
    var title = el.querySelector('.gb-tts-download-notice__title');
    var meta = el.querySelector('.gb-tts-download-notice__meta');
    var titleText = '';
    var metaText = '';
    var actionMode = null;
    var actionLabel = '';
    var actionAria = '';

    if (stateName === 'browser') {
      titleText = 'Сейчас системный голос';
      metaText = 'Улучшенный голос проверяется в фоне';
    } else if (stateName === 'preparing') {
      titleText = 'Проверяем улучшенный голос';
      metaText = 'Системный голос уже работает';
    } else if (stateName === 'loading') {
      titleText = 'Улучшенный голос загружается';
      metaText = 'Системный голос уже работает · около 280 МБ';
      actionMode = 'cancel';
      actionLabel = 'Не загружать';
      actionAria = 'Остановить загрузку улучшенного голоса';
    } else if (stateName === 'initializing') {
      titleText = 'Запускаем улучшенный голос';
      metaText = 'Модель получена · подготавливаем в браузере';
    } else if (stateName === 'ready' || stateName === 'success') {
      stateName = 'ready';
      titleText = 'Улучшенный голос готов';
      metaText = 'Можно включить без перезагрузки страницы';
      actionMode = 'switch';
      actionLabel = 'Включить сейчас';
      actionAria = 'Перейти на улучшенный голос с текущего места';
    } else if (stateName === 'selected') {
      titleText = 'Работает улучшенный голос';
      metaText = 'Локальная модель · текст никуда не отправляется';
    } else if (stateName === 'disabled') {
      titleText = 'Улучшенный голос отключён';
      metaText = 'Сейчас используется системный голос';
      actionMode = 'enable';
      actionLabel = 'Включить';
      actionAria = 'Снова разрешить загрузку улучшенного голоса';
    } else if (stateName === 'save-data') {
      titleText = 'Включена экономия трафика';
      metaText = 'Системный голос работает · модель около 280 МБ';
      actionMode = 'manual';
      actionLabel = 'Загрузить';
      actionAria = 'Загрузить улучшенный голос несмотря на экономию трафика';
    } else if (stateName === 'cancelled') {
      titleText = 'Загрузка остановлена';
      metaText = 'Системный голос продолжает работать';
    } else {
      stateName = 'error';
      titleText = 'Улучшенный голос не запустился';
      metaText = 'Системный голос продолжает работать';
      actionMode = 'retry';
      actionLabel = 'Повторить';
      actionAria = 'Повторить запуск улучшенного голоса';
    }

    if (options.title) titleText = options.title;
    if (options.meta) metaText = options.meta;
    if (options.actionMode !== undefined) actionMode = options.actionMode;
    if (options.actionLabel !== undefined) actionLabel = options.actionLabel;
    if (options.actionAria !== undefined) actionAria = options.actionAria;

    el.setAttribute('data-state', stateName);
    if (title) title.textContent = titleText;
    if (meta) meta.textContent = metaText;
    setNoticeAction(el, actionMode, actionLabel, actionAria);
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
    dispatchEngineStatus(stateName, {
      title: titleText,
      message: metaText,
      action: actionMode,
      reason: options.reason || null
    });
    if (options.autoHide) hideModelDownloadNotice(options.autoHide);
    return el;
  }

  function hideModelDownloadNotice(delay) {
    clearTimeout(modelDownloadNoticeTimer);
    modelDownloadNoticeTimer = setTimeout(function () {
      if (!modelDownloadNotice) return;
      modelDownloadNotice.classList.remove('is-visible');
      var doomed = modelDownloadNotice;
      setTimeout(function () {
        if (doomed.parentNode) doomed.parentNode.removeChild(doomed);
        if (modelDownloadNotice === doomed) modelDownloadNotice = null;
      }, 360);
    }, delay || 0);
  }

  function showModelDownloadNotice() {
    return showStatus('loading');
  }

  function finishModelDownloadNotice(stateName) {
    var autoHide = stateName === 'cancelled' ? 1900 : stateName === 'selected' ? 1800 : 0;
    return showStatus(stateName, { autoHide: autoHide });
  }

`,
  'engine notice lifecycle'
);

engine = replaceOnce(
  engine,
  /  function cancelLoading\(options\) \{[\s\S]*?\n  \}\n\n  function fetchStressLookup/,
`  function clearModelDownloadOptOut() {
    try { localStorage.removeItem(MODEL_DOWNLOAD_OPTOUT_KEY); } catch (_) {}
    modelDownloadCancelled = false;
    dispatchEngineStatus('enabled');
  }

  function cancelLoading(options) {
    var persist = !options || options.persist !== false;
    if (persist) {
      try { localStorage.setItem(MODEL_DOWNLOAD_OPTOUT_KEY, 'off'); } catch (_) {}
    }
    modelDownloadCancelled = true;
    var aborted = false;
    if (modelDownloadController && !modelDownloadController.signal.aborted) {
      try { modelDownloadController.abort(); aborted = true; } catch (_) {}
    }
    finishModelDownloadNotice('cancelled');
    dispatchEngineStatus('cancelled', { reason: 'user' });
    try { window.dispatchEvent(new CustomEvent('gb:vosk-model-download-cancelled')); } catch (_) {}
    return aborted;
  }

  function retryLoading(options) {
    options = options || {};
    if (options.clearOptOut !== false) clearModelDownloadOptOut();
    modelDownloadCancelled = false;
    state.loading = null;
    showStatus('preparing');
    return ensureLoaded();
  }

  function fetchStressLookup`,
  'engine cancellation and retry'
);

engine = replaceOnce(
  engine,
  /  function fetchModelFiles\(\) \{[\s\S]*?\n  \}\n\n  function sliceBuf/,
`  function fetchModelFiles() {
    return idbGet(MODEL_URL).catch(function (err) {
      console.warn('[vosk-tts] IndexedDB read unavailable, continuing without warm cache:', err);
      dispatchEngineStatus('cache-unavailable', { reason: 'indexeddb-read' });
      return null;
    }).then(function (cached) {
      if (cached) {
        dispatchEngineStatus('cache-hit');
        showStatus('initializing', { meta: 'Модель найдена в браузере · запускаем' });
        return cached;
      }
      if (modelDownloadOptedOut()) {
        showStatus('disabled', { reason: 'optout' });
        throw createDownloadCancelledError('enhanced voice download disabled by user');
      }

      modelDownloadCancelled = false;
      modelDownloadController = typeof AbortController !== 'undefined'
        ? new AbortController()
        : null;
      try { window.dispatchEvent(new CustomEvent('gb:vosk-model-download-start')); } catch (_) {}
      suppressLegacyDownloadToast();
      showModelDownloadNotice();

      var fetchOptions = modelDownloadController
        ? { signal: modelDownloadController.signal }
        : undefined;

      return fetch(MODEL_URL, fetchOptions).then(function (resp) {
        if (!resp.ok) throw new Error('model download HTTP ' + resp.status);
        return resp.arrayBuffer();
      }).then(function (buf) {
        return verifyModelIntegrity(buf).then(function () {
          var files = extractZip(new Uint8Array(buf));
          return idbSet(MODEL_URL, files).catch(function (err) {
            console.warn('[vosk-tts] model cache write unavailable; current session can still use the model:', err);
            dispatchEngineStatus('cache-unavailable', { reason: 'indexeddb-write' });
          }).then(function () { return files; });
        });
      }).then(function (files) {
        modelDownloadController = null;
        showStatus('initializing');
        try { window.dispatchEvent(new CustomEvent('gb:vosk-model-download-complete')); } catch (_) {}
        return files;
      }).catch(function (err) {
        modelDownloadController = null;
        if (modelDownloadCancelled || (err && err.name === 'AbortError')) {
          finishModelDownloadNotice('cancelled');
          throw createDownloadCancelledError('model download cancelled by user');
        }
        throw err;
      });
    });
  }

  function sliceBuf`,
  'engine model lifecycle'
);

engine = replaceOnce(
  engine,
  /  function ensureLoaded\(\) \{[\s\S]*?\n  \}\n\n  function i64/,
`  function ensureLoaded() {
    if (state.ready) {
      finishModelDownloadNotice('ready');
      return Promise.resolve(true);
    }
    if (state.loading) return state.loading;
    modelDownloadCancelled = false;
    showStatus('preparing');
    state.loading = Promise.all([
      window.VoskTTSCore ? Promise.resolve() : loadScript(CORE_SRC),
      window.VoskStressLookup ? Promise.resolve() : loadScript(STRESS_LOOKUP_SRC),
      window.fflate ? Promise.resolve() : loadScript(FFLATE_SRC),
      window.ort ? Promise.resolve() : loadScript(ORT_SRC)
    ]).then(function () {
      ort.env.wasm.numThreads = 1;
      dispatchEngineStatus('dependencies-ready');
      return Promise.all([fetchModelFiles(), fetchStressLookup()]);
    }).then(function (results) {
      var files = results[0];
      state.stressLookup = results[1];
      var td = new TextDecoder('utf-8');
      state.config = JSON.parse(td.decode(files['config.json']));
      state.dic = VoskTTSCore.parseDictionary(td.decode(files['dictionary']));
      var hasBert = files['bert/model.onnx'] && files['bert/vocab.txt'];
      showStatus('initializing');
      return Promise.all([
        ort.InferenceSession.create(sliceBuf(files['model.onnx']), { executionProviders: ['wasm'] }),
        hasBert
          ? ort.InferenceSession.create(sliceBuf(files['bert/model.onnx']), { executionProviders: ['wasm'] })
          : Promise.resolve(null)
      ]).then(function (sessions) {
        state.sess = sessions[0];
        state.bertSess = sessions[1];
        if (state.bertSess) state.tok = new VoskTTSCore.WordPieceTokenizer(td.decode(files['bert/vocab.txt']));
        state.ready = true;
        state.loading = null;
        finishModelDownloadNotice('ready');
        dispatchEngineStatus('ready');
        try { window.dispatchEvent(new CustomEvent('gb:vosk-model-ready')); } catch (_) {}
        return true;
      });
    }).catch(function (err) {
      state.loading = null;
      if (err && err.userCancelled) {
        if (modelDownloadOptedOut() && !modelDownloadCancelled) {
          showStatus('disabled', { reason: 'optout' });
        } else if (modelDownloadCancelled) {
          finishModelDownloadNotice('cancelled');
        }
      } else {
        showStatus('error', { reason: (err && err.message) || String(err) });
        try {
          window.dispatchEvent(new CustomEvent('gb:vosk-model-download-error', {
            detail: { message: (err && err.message) || String(err) }
          }));
        } catch (_) {}
      }
      throw err;
    });
    return state.loading;
  }

  function i64`,
  'engine ensureLoaded lifecycle'
);

engine = replaceOnce(
  engine,
  /  window\.VoskTTSEngine = \{[\s\S]*?\n  \};/,
`  window.VoskTTSEngine = {
    isSupported: isSupported,
    isReady: isReady,
    getStatus: getStatus,
    showStatus: showStatus,
    ensureLoaded: ensureLoaded,
    retryLoading: retryLoading,
    clearModelDownloadOptOut: clearModelDownloadOptOut,
    cancelLoading: cancelLoading,
    speak: speak,
    cancel: cancel
  };`,
  'engine public API'
);

controller = replaceOnce(
  controller,
  /  var _voskEngineScriptPromise = null;[\s\S]*?\n  \}\n\n  \/\/ Прогревает Vosk/,
`  var _voskEngineScriptPromise = null;
  var VOSK_ENGINE_SRC = '/js/vosk-tts-engine.js?v=__ENGINE_HASH__';
  var TTS_NOTICE_CSS_SRC = '/css/tts-download-notice.css?v=__CSS_HASH__';
  var fallbackTtsNoticeTimer = null;

  function ensureFallbackTtsNoticeStyles() {
    if (document.querySelector('link[data-gb-tts-download-notice]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = TTS_NOTICE_CSS_SRC;
    link.setAttribute('data-gb-tts-download-notice', 'true');
    document.head.appendChild(link);
  }

  function getFallbackTtsNotice() {
    var el = qs('.gb-tts-download-notice');
    if (!el) {
      el = document.createElement('div');
      el.className = 'gb-tts-download-notice';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      el.innerHTML =
        '<span class="gb-tts-download-notice__icon" aria-hidden="true"></span>' +
        '<span class="gb-tts-download-notice__copy">' +
          '<strong class="gb-tts-download-notice__title"></strong>' +
          '<span class="gb-tts-download-notice__meta"></span>' +
        '</span>' +
        '<button class="gb-tts-download-notice__action" type="button" hidden></button>';
      document.body.appendChild(el);
    }
    var action = el.querySelector('.gb-tts-download-notice__action');
    if (action && action.getAttribute('data-gb-tts-action-bound') !== 'true') {
      action.setAttribute('data-gb-tts-action-bound', 'true');
      action.addEventListener('click', function () {
        var mode = action.getAttribute('data-action') || '';
        if (mode === 'cancel' && window.VoskTTSEngine) {
          window.VoskTTSEngine.cancelLoading({ persist: true });
        } else if (mode === 'switch') {
          window.dispatchEvent(new CustomEvent('gb:vosk-switch-request', { detail: { handled: false } }));
        } else if (mode === 'retry' || mode === 'enable' || mode === 'manual') {
          window.dispatchEvent(new CustomEvent('gb:vosk-retry-request', { detail: { mode: mode, handled: false } }));
        }
      });
    }
    return el;
  }

  function showFallbackTtsStatus(stateName, options) {
    options = options || {};
    ensureFallbackTtsNoticeStyles();
    clearTimeout(fallbackTtsNoticeTimer);
    var el = getFallbackTtsNotice();
    var title = el.querySelector('.gb-tts-download-notice__title');
    var meta = el.querySelector('.gb-tts-download-notice__meta');
    var action = el.querySelector('.gb-tts-download-notice__action');
    var map = {
      browser: ['Сейчас системный голос', 'Улучшенный голос проверяется в фоне', null, ''],
      preparing: ['Проверяем улучшенный голос', 'Системный голос уже работает', null, ''],
      disabled: ['Улучшенный голос отключён', 'Сейчас используется системный голос', 'enable', 'Включить'],
      'save-data': ['Включена экономия трафика', 'Системный голос работает · модель около 280 МБ', 'manual', 'Загрузить'],
      error: ['Улучшенный голос не запустился', 'Системный голос продолжает работать', 'retry', 'Повторить'],
      selected: ['Работает улучшенный голос', 'Локальная модель · текст никуда не отправляется', null, '']
    };
    var row = map[stateName] || map.error;
    el.setAttribute('data-state', stateName);
    if (title) title.textContent = options.title || row[0];
    if (meta) meta.textContent = options.meta || row[1];
    if (action) {
      var actionMode = options.actionMode !== undefined ? options.actionMode : row[2];
      var actionLabel = options.actionLabel !== undefined ? options.actionLabel : row[3];
      action.hidden = !actionMode;
      action.setAttribute('data-action', actionMode || '');
      action.textContent = actionLabel || '';
      action.setAttribute('aria-label', options.actionAria || actionLabel || '');
    }
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
    if (options.autoHide) {
      fallbackTtsNoticeTimer = setTimeout(function () { el.classList.remove('is-visible'); }, options.autoHide);
    }
    return el;
  }

  function showVoskStatus(stateName, options) {
    if (window.VoskTTSEngine && typeof window.VoskTTSEngine.showStatus === 'function') {
      return window.VoskTTSEngine.showStatus(stateName, options || {});
    }
    return showFallbackTtsStatus(stateName, options || {});
  }

  function loadVoskEngineScript() {
    if (window.VoskTTSEngine) return Promise.resolve();
    if (_voskEngineScriptPromise) return _voskEngineScriptPromise;
    _voskEngineScriptPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = VOSK_ENGINE_SRC;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        _voskEngineScriptPromise = null;
        reject(new Error('vosk-tts-engine.js load failed'));
      };
      document.head.appendChild(s);
    });
    return _voskEngineScriptPromise;
  }

  // Прогревает Vosk`,
  'controller lazy engine and fallback status UI'
);

controller = replaceOnce(
  controller,
  /  var VOSK_WARMUP_OPTOUT_KEY = 'gbx-vosk-warmup';[\s\S]*?(?=  \/\/ Решает, каким движком озвучивать)/,
`  var VOSK_WARMUP_OPTOUT_KEY = 'gbx-vosk-warmup';
  function voskWarmupBlockReason() {
    try { if (localStorage.getItem(VOSK_WARMUP_OPTOUT_KEY) === 'off') return 'disabled'; } catch (_) {}
    try {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c && c.saveData === true) return 'save-data';
    } catch (_) {}
    return null;
  }

  var _voskWarmupPromise = null;

  function warmVoskInBackground(options) {
    options = options || {};
    var manual = options.manual === true;
    var retry = options.retry === true;
    var blockReason = voskWarmupBlockReason();

    if (!manual && blockReason) {
      showVoskStatus(blockReason);
      return Promise.resolve(null);
    }
    if (_voskWarmupPromise && !retry) return _voskWarmupPromise;

    showVoskStatus('preparing');
    _voskWarmupPromise = loadVoskEngineScript().then(function () {
      if (!(window.VoskTTSEngine && window.VoskTTSEngine.isSupported())) {
        throw new Error('enhanced voice is not supported by this browser');
      }
      if (window.VoskTTSEngine.isReady()) {
        showVoskStatus(ttsState.engine === 'webspeech' ? 'ready' : 'selected');
        return 'vosk';
      }
      if ((manual || retry) && typeof window.VoskTTSEngine.retryLoading === 'function') {
        return window.VoskTTSEngine.retryLoading({ clearOptOut: true }).then(function () { return 'vosk'; });
      }
      return window.VoskTTSEngine.ensureLoaded().then(function () { return 'vosk'; });
    }).then(function (result) {
      _voskWarmupPromise = null;
      return result;
    }, function (err) {
      _voskWarmupPromise = null;
      if (err && err.userCancelled) {
        if (voskWarmupBlockReason() === 'disabled') showVoskStatus('disabled');
        return null;
      }
      console.warn('[gbx-tts] background Vosk warm-up failed, staying on Web Speech:', err);
      showVoskStatus('error', { reason: (err && err.message) || String(err) });
      reportTtsIssue('background_warmup: ' + ((err && err.message) || err));
      return null;
    });
    return _voskWarmupPromise;
  }

  function switchCurrentSessionToVosk() {
    if (!(window.VoskTTSEngine && window.VoskTTSEngine.isReady())) {
      warmVoskInBackground({ manual: true, retry: true });
      return;
    }
    if (ttsState.engine === 'webspeech' && ttsState.chunks.length) {
      ttsState.runId += 1;
      ttsState.suppressEnd = true;
      cancelActiveEngine();
      ttsState.utterance = null;
      ttsState.engine = 'vosk';
      ttsState.suppressEnd = false;
      reportTtsOutcome('vosk');
      showVoskStatus('selected', { autoHide: 1800 });
      if (!ttsState.paused && ttsState.chunkIdx < ttsState.chunks.length) {
        setEmberState('playing');
        speakNextChunk();
      }
      return;
    }
    showVoskStatus('selected', { autoHide: 1800 });
  }

  addCleanListener(window, 'gb:vosk-retry-request', function (event) {
    if (event && event.detail) event.detail.handled = true;
    warmVoskInBackground({ manual: true, retry: true });
  });
  addCleanListener(window, 'gb:vosk-switch-request', function (event) {
    if (event && event.detail) event.detail.handled = true;
    switchCurrentSessionToVosk();
  });

`,
  'controller warm-up and retry lifecycle'
);

controller = replaceOnce(
  controller,
  /  function resolveTtsEngine\(\) \{[\s\S]*?\n  \}\n\n  \/\* Russian voice picker/,
`  function resolveTtsEngine() {
    if (window.VoskTTSEngine && window.VoskTTSEngine.isReady()) {
      showVoskStatus('selected', { autoHide: 1800 });
      return Promise.resolve('vosk');
    }
    if ('speechSynthesis' in window) {
      showVoskStatus('browser');
      warmVoskInBackground();
      return Promise.resolve('webspeech');
    }
    showVoskStatus('preparing');
    return warmVoskInBackground({ manual: true }).then(function (engine) {
      if (engine === 'vosk' && window.VoskTTSEngine && window.VoskTTSEngine.isReady()) return 'vosk';
      showVoskStatus('error', { meta: 'В этом браузере нет доступного запасного голоса' });
      return null;
    });
  }

  /* Russian voice picker`,
  'controller engine resolution'
);

css = replaceOnce(
  css,
  '  white-space:nowrap;\n  font-size:13px;',
  '  white-space:normal;\n  overflow-wrap:anywhere;\n  font-size:13px;\n  line-height:1.28;',
  'notice title wrapping'
);
css = replaceOnce(
  css,
  '  white-space:nowrap;\n  font-size:11px;',
  '  white-space:normal;\n  overflow-wrap:anywhere;\n  font-size:11px;\n  line-height:1.32;',
  'notice meta wrapping'
);
css = replaceOnce(
  css,
  /\.gb-tts-download-notice\[data-state="success"\]::after,[\s\S]*?(?=html\.dark \.gb-tts-download-notice\{)/,
`.gb-tts-download-notice[data-state="ready"]::after,
.gb-tts-download-notice[data-state="success"]::after,
.gb-tts-download-notice[data-state="selected"]::after,
.gb-tts-download-notice[data-state="cancelled"]::after,
.gb-tts-download-notice[data-state="disabled"]::after,
.gb-tts-download-notice[data-state="save-data"]::after,
.gb-tts-download-notice[data-state="error"]::after{animation:none}
.gb-tts-download-notice[data-state="ready"] .gb-tts-download-notice__icon,
.gb-tts-download-notice[data-state="success"] .gb-tts-download-notice__icon,
.gb-tts-download-notice[data-state="selected"] .gb-tts-download-notice__icon{
  color:#2f7d4a;
  background:color-mix(in srgb,#2f7d4a 11%,var(--color-surface,#fff));
}
.gb-tts-download-notice[data-state="browser"] .gb-tts-download-notice__icon,
.gb-tts-download-notice[data-state="preparing"] .gb-tts-download-notice__icon,
.gb-tts-download-notice[data-state="initializing"] .gb-tts-download-notice__icon{
  color:var(--color-accent,#7a2e2e);
}
.gb-tts-download-notice[data-state="cancelled"] .gb-tts-download-notice__icon,
.gb-tts-download-notice[data-state="disabled"] .gb-tts-download-notice__icon,
.gb-tts-download-notice[data-state="save-data"] .gb-tts-download-notice__icon,
.gb-tts-download-notice[data-state="error"] .gb-tts-download-notice__icon{
  color:var(--color-text-muted,#6a6a6a);
  background:var(--color-surface-muted,#f4f2ed);
}
.gb-tts-download-notice[data-state="ready"] .gb-tts-download-notice__icon::before,
.gb-tts-download-notice[data-state="success"] .gb-tts-download-notice__icon::before,
.gb-tts-download-notice[data-state="selected"] .gb-tts-download-notice__icon::before,
.gb-tts-download-notice[data-state="cancelled"] .gb-tts-download-notice__icon::before,
.gb-tts-download-notice[data-state="disabled"] .gb-tts-download-notice__icon::before,
.gb-tts-download-notice[data-state="save-data"] .gb-tts-download-notice__icon::before,
.gb-tts-download-notice[data-state="error"] .gb-tts-download-notice__icon::before{
  animation:none;
  box-shadow:none;
}
`,
  'notice state palette'
);
css = replaceOnce(
  css,
  /@media \(max-width:480px\)\{[\s\S]*?\n\}/,
`@media (max-width:480px){
  .gb-tts-download-notice{
    width:calc(100vw - 20px);
    grid-template-columns:30px minmax(0,1fr);
    gap:8px 10px;
    padding:10px;
    border-radius:14px;
  }
  .gb-tts-download-notice__icon{width:28px;height:28px;grid-row:1 / span 2}
  .gb-tts-download-notice__title{font-size:12px}
  .gb-tts-download-notice__meta{font-size:10.5px}
  .gb-tts-download-notice__action{
    grid-column:2;
    justify-self:start;
    min-height:40px;
    padding:0 12px;
    font-size:10.5px;
  }
}`,
  'notice mobile reflow'
);

const staticContract = `#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function validate(engine, controller, css, workflow) {
  const problems = [];
  const checks = [
    ['engine status API', engine, /getStatus:\\s*getStatus[\\s\\S]{0,180}showStatus:\\s*showStatus/],
    ['engine retry API', engine, /retryLoading:\\s*retryLoading/],
    ['engine post-session ready', engine, /InferenceSession\\.create[\\s\\S]*state\\.ready\\s*=\\s*true[\\s\\S]*finishModelDownloadNotice\\('ready'\\)/],
    ['engine cache read fallback', engine, /IndexedDB read unavailable, continuing without warm cache/],
    ['engine cache write fallback', engine, /current session can still use the model/],
    ['all visible states', engine, /'browser'[\\s\\S]*'preparing'[\\s\\S]*'loading'[\\s\\S]*'initializing'[\\s\\S]*'ready'[\\s\\S]*'selected'[\\s\\S]*'disabled'[\\s\\S]*'save-data'[\\s\\S]*'cancelled'/],
    ['versioned engine lazy URL', controller, /VOSK_ENGINE_SRC\\s*=\\s*'\\/js\\/vosk-tts-engine\\.js\\?v=[a-f0-9]{8}'/],
    ['versioned notice CSS URL', controller, /TTS_NOTICE_CSS_SRC\\s*=\\s*'\\/css\\/tts-download-notice\\.css\\?v=[a-f0-9]{8}'/],
    ['retry event contract', controller, /gb:vosk-retry-request[\\s\\S]*warmVoskInBackground\\(\\{ manual: true, retry: true \\}\\)/],
    ['switch event contract', controller, /gb:vosk-switch-request[\\s\\S]*switchCurrentSessionToVosk/],
    ['retryable promise, no one-shot latch', controller, /var _voskWarmupPromise = null/],
    ['system voice disclosed', controller, /showVoskStatus\\('browser'\\)/],
    ['mobile two-row reflow', css, /@media \\(max-width:480px\\)[\\s\\S]*grid-template-columns:30px minmax\\(0,1fr\\)[\\s\\S]*grid-column:2/],
    ['copy can wrap', css, /gb-tts-download-notice__title[\\s\\S]{0,260}white-space:normal[\\s\\S]*gb-tts-download-notice__meta[\\s\\S]{0,260}white-space:normal/],
    ['workflow owns controller', workflow, /js\\/floating-cluster-controller\\.js/],
    ['workflow runs lifecycle browser test', workflow, /tts-engine-lifecycle-browser-test\\.js/],
    ['workflow runs route integration', workflow, /tts-status-route-browser-test\\.js/],
    ['workflow installs WebKit', workflow, /playwright install --with-deps chromium webkit/],
  ];
  for (const [label, source, pattern] of checks) {
    if (!pattern.test(source)) problems.push(label);
  }
  if (/_voskWarmupStarted/.test(controller)) problems.push('obsolete one-shot warm-up latch remains');
  if (/s\\.src\\s*=\\s*'\\/js\\/vosk-tts-engine\\.js'/.test(controller)) problems.push('unversioned lazy engine URL remains');
  return problems;
}

const engine = read('js/vosk-tts-engine.js');
const controller = read('js/floating-cluster-controller.js');
const css = read('css/tts-download-notice.css');
const workflow = read('.github/workflows/tts-download-consent.yml');
assert.deepEqual(validate(engine, controller, css, workflow), []);

const mutations = [
  [engine.replace('retryLoading: retryLoading', 'retryLoading: null'), controller, css, workflow],
  [engine, controller.replace(/vosk-tts-engine\\.js\\?v=[a-f0-9]{8}/, 'vosk-tts-engine.js'), css, workflow],
  [engine, controller.replace('gb:vosk-retry-request', 'gb:vosk-retry-missing'), css, workflow],
  [engine, controller, css.replace('white-space:normal', 'white-space:nowrap'), workflow],
  [engine, controller, css, workflow.replace('chromium webkit', 'chromium')],
];
for (const mutation of mutations) {
  assert.ok(validate(...mutation).length > 0, 'adversarial mutation must be rejected');
}
console.log('TTS engine status contract: PASS (' + mutations.length + ' adversarial mutations rejected).');
`;

const lifecycleBrowser = `#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ENGINE = fs.readFileSync(path.join(ROOT, 'js/vosk-tts-engine.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css/tts-download-notice.css'), 'utf8');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });
const MODEL_URL = 'https://huggingface.co/CurtMil/gb-vosk-tts-model/resolve/main/model-quant.zip';

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/css/tts-download-notice.css')) {
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' });
        res.end(CSS);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main>fixture</main></body></html>');
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: 'http://127.0.0.1:' + server.address().port }));
  });
}

async function reset(page) {
  await page.goto(page.__origin, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    localStorage.removeItem('gbx-vosk-warmup');
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('gb-vosk-tts');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
}

async function installDependencies(page, sessionMode) {
  await page.evaluate((mode) => {
    window.VoskTTSCore = {
      parseDictionary: () => new Map(),
      WordPieceTokenizer: function WordPieceTokenizer() {},
    };
    window.VoskStressLookup = { StressLookup: function StressLookup() {} };
    window.fflate = { unzipSync: () => ({}) };
    window.ort = {
      env: { wasm: {} },
      InferenceSession: {
        create: () => mode === 'reject'
          ? Promise.reject(new Error('fixture session failure'))
          : Promise.resolve({ inputNames: [], outputNames: [] }),
      },
    };
  }, sessionMode);
}

async function putCachedModel(page) {
  await page.evaluate(async (modelUrl) => {
    const enc = new TextEncoder();
    const files = {
      'model.onnx': new Uint8Array([1, 2, 3]),
      'dictionary': enc.encode(''),
      'config.json': enc.encode('{"model_type":"multistream_v1"}'),
    };
    await new Promise((resolve, reject) => {
      const open = indexedDB.open('gb-vosk-tts', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('files');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('files', 'readwrite');
        tx.objectStore('files').put(files, modelUrl);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      };
    });
  }, MODEL_URL);
}

async function cachedFailure(browserType, origin, name) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.__origin = origin;
  try {
    await reset(page);
    await installDependencies(page, 'reject');
    await putCachedModel(page);
    await page.addScriptTag({ content: ENGINE });
    await page.evaluate(() => window.VoskTTSEngine.ensureLoaded().catch(() => null));
    await page.waitForSelector('.gb-tts-download-notice[data-state="error"].is-visible');
    const snap = await page.locator('.gb-tts-download-notice').evaluate((el) => ({
      title: el.querySelector('.gb-tts-download-notice__title').textContent,
      action: el.querySelector('.gb-tts-download-notice__action').textContent,
      status: window.VoskTTSEngine.getStatus(),
    }));
    assert.match(snap.title, /не запустился/i);
    assert.equal(snap.action, 'Повторить');
    assert.equal(snap.status.phase, 'error');
    await page.screenshot({ path: path.join(REPORTS, 'tts-lifecycle-' + name + '-cached-error.png') });
  } finally {
    await browser.close();
  }
}

async function cachedReady(browserType, origin, name) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.__origin = origin;
  try {
    await reset(page);
    await installDependencies(page, 'resolve');
    await putCachedModel(page);
    await page.addScriptTag({ content: ENGINE });
    await page.evaluate(() => window.VoskTTSEngine.ensureLoaded());
    await page.waitForSelector('.gb-tts-download-notice[data-state="ready"].is-visible');
    const before = await page.locator('.gb-tts-download-notice').evaluate((el) => ({
      title: el.querySelector('.gb-tts-download-notice__title').textContent,
      action: el.querySelector('.gb-tts-download-notice__action').textContent,
      width: el.getBoundingClientRect().width,
      viewport: innerWidth,
      status: window.VoskTTSEngine.getStatus(),
    }));
    assert.equal(before.title, 'Улучшенный голос готов');
    assert.equal(before.action, 'Включить сейчас');
    assert.equal(before.status.ready, true);
    assert.ok(before.width <= before.viewport - 18);
    await page.evaluate(() => {
      window.__switchRequested = false;
      addEventListener('gb:vosk-switch-request', () => { window.__switchRequested = true; }, { once: true });
    });
    await page.locator('.gb-tts-download-notice__action').click();
    assert.equal(await page.evaluate(() => window.__switchRequested), true);
    await page.screenshot({ path: path.join(REPORTS, 'tts-lifecycle-' + name + '-mobile-ready.png') });
  } finally {
    await browser.close();
  }
}

(async () => {
  const { server, origin } = await startServer();
  try {
    await cachedFailure(chromium, origin, 'chromium');
    await cachedReady(chromium, origin, 'chromium');
    await cachedFailure(webkit, origin, 'webkit');
    await cachedReady(webkit, origin, 'webkit');
    console.log('TTS engine lifecycle browser contract: PASS (Chromium + WebKit, cached error + ready/switch).');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exit(1); });
`;

const routeBrowser = `#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      let target = path.join(DIST, pathname.replace(/^\\/+/, ''));
      if (pathname.endsWith('/')) target = path.join(target, 'index.html');
      if (!path.extname(target)) target = path.join(target, 'index.html');
      if (!target.startsWith(DIST) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: 'http://127.0.0.1:' + server.address().port }));
  });
}

async function makePage(browser, origin, viewport, saveData) {
  const page = await browser.newPage({ viewport, isMobile: viewport.width <= 430, hasTouch: viewport.width <= 430 });
  await page.addInitScript(({ saveDataValue }) => {
    window.__webSpeechCount = 0;
    window.__modelFetchCount = 0;
    window.__modelFetchAborted = false;
    function FakeUtterance(text) { this.text = text; this.rate = 1; this.lang = 'ru-RU'; }
    try { Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance }); } catch (_) { window.SpeechSynthesisUtterance = FakeUtterance; }
    const speech = {
      getVoices: () => [{ name: 'Fixture Russian', lang: 'ru-RU', localService: true }],
      speak: (u) => { window.__webSpeechCount += 1; window.__lastUtterance = u; },
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech }); } catch (_) { window.speechSynthesis = speech; }
    try { Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: saveDataValue } }); } catch (_) {}
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (url, options) {
      if (String(url).includes('model-quant.zip')) {
        window.__modelFetchCount += 1;
        return new Promise((resolve, reject) => {
          const signal = options && options.signal;
          const abort = () => { window.__modelFetchAborted = true; reject(new DOMException('Aborted', 'AbortError')); };
          if (signal && signal.aborted) abort();
          else if (signal) signal.addEventListener('abort', abort, { once: true });
        });
      }
      return nativeFetch(url, options);
    };
  }, { saveDataValue: !!saveData });
  page.__origin = origin;
  return page;
}

async function resetStorage(page, optout) {
  await page.evaluate(async (off) => {
    if (off) localStorage.setItem('gbx-vosk-warmup', 'off');
    else localStorage.removeItem('gbx-vosk-warmup');
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('gb-vosk-tts');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }, !!optout);
}

async function clickPlay(page) {
  const play = page.locator('.gb-ember:visible').first();
  await play.waitFor({ state: 'visible' });
  await play.click();
  await page.waitForFunction(() => window.__webSpeechCount > 0);
}

async function assertCsp(page) {
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  assert.match(csp || '', /huggingface\\.co/);
  assert.match(csp || '', /\\*\\.aws\\.cdn\\.hf\\.co/);
  assert.match(csp || '', /cdn\\.jsdelivr\\.net/);
}

async function coldScenario(browserType, origin, route, viewport, label) {
  const browser = await browserType.launch({ headless: true });
  const page = await makePage(browser, origin, viewport, false);
  try {
    await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
    await resetStorage(page, false);
    await assertCsp(page);
    await clickPlay(page);
    await page.waitForSelector('.gb-tts-download-notice[data-state="loading"].is-visible');
    const snapshot = await page.locator('.gb-tts-download-notice').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        title: el.querySelector('.gb-tts-download-notice__title').textContent,
        meta: el.querySelector('.gb-tts-download-notice__meta').textContent,
        action: el.querySelector('.gb-tts-download-notice__action').textContent,
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      };
    });
    assert.equal(snapshot.title, 'Улучшенный голос загружается');
    assert.match(snapshot.meta, /Системный голос уже работает/);
    assert.equal(snapshot.action, 'Не загружать');
    assert.ok(snapshot.left >= 0 && snapshot.right <= snapshot.width + 0.5);
    assert.ok(snapshot.top >= 0 && snapshot.bottom <= snapshot.height + 0.5);
    assert.ok(snapshot.scrollWidth <= snapshot.width);
    await page.screenshot({ path: path.join(REPORTS, 'tts-route-' + label + '.png'), fullPage: false });
    await page.locator('.gb-tts-download-notice__action').click();
    await page.waitForFunction(() => window.__modelFetchAborted === true);
  } finally {
    await browser.close();
  }
}

async function blockedScenario(browserType, origin, kind, label) {
  const browser = await browserType.launch({ headless: true });
  const page = await makePage(browser, origin, { width: 1280, height: 760 }, kind === 'save-data');
  try {
    await page.goto(origin + '/articles/dzhon-gill-chast-1-chelovek/', { waitUntil: 'domcontentloaded' });
    await resetStorage(page, kind === 'disabled');
    await clickPlay(page);
    await page.waitForSelector('.gb-tts-download-notice[data-state="' + kind + '"].is-visible');
    assert.equal(await page.evaluate(() => window.__modelFetchCount), 0);
    const expected = kind === 'disabled' ? 'Включить' : 'Загрузить';
    assert.equal(await page.locator('.gb-tts-download-notice__action').textContent(), expected);
    await page.locator('.gb-tts-download-notice__action').click();
    await page.waitForSelector('.gb-tts-download-notice[data-state="loading"].is-visible');
    assert.equal(await page.evaluate(() => window.__modelFetchCount), 1);
    await page.screenshot({ path: path.join(REPORTS, 'tts-route-' + label + '.png') });
  } finally {
    await browser.close();
  }
}

async function scriptFailure(origin) {
  const browser = await chromium.launch({ headless: true });
  const page = await makePage(browser, origin, { width: 1440, height: 900 }, false);
  await page.route('**/js/vosk-tts-engine.js*', (route) => route.abort());
  try {
    await page.goto(origin + '/articles/dzhon-gill-chast-1-chelovek/', { waitUntil: 'domcontentloaded' });
    await resetStorage(page, false);
    await clickPlay(page);
    await page.waitForSelector('.gb-tts-download-notice[data-state="error"].is-visible');
    assert.equal(await page.locator('.gb-tts-download-notice__action').textContent(), 'Повторить');
    await page.screenshot({ path: path.join(REPORTS, 'tts-route-chromium-script-error.png') });
  } finally {
    await browser.close();
  }
}

(async () => {
  const { server, origin } = await startServer();
  try {
    await coldScenario(chromium, origin, '/articles/dzhon-gill-chast-1-chelovek/', { width: 1440, height: 900 }, 'chromium-gill-desktop');
    await coldScenario(chromium, origin, '/articles/dzhon-gill-chast-1-chelovek/', { width: 390, height: 844 }, 'chromium-gill-mobile390');
    await coldScenario(chromium, origin, '/articles/20-antisovetov-pastoru/', { width: 320, height: 568 }, 'chromium-standalone-mobile320');
    await coldScenario(webkit, origin, '/articles/dzhon-gill-chast-1-chelovek/', { width: 1280, height: 760 }, 'webkit-gill-desktop');
    await coldScenario(webkit, origin, '/articles/dzhon-gill-chast-1-chelovek/', { width: 390, height: 844 }, 'webkit-gill-mobile390');
    await blockedScenario(chromium, origin, 'disabled', 'chromium-optout-retry');
    await blockedScenario(chromium, origin, 'save-data', 'chromium-save-data-manual');
    await blockedScenario(webkit, origin, 'disabled', 'webkit-optout-retry');
    await scriptFailure(origin);
    console.log('TTS route status browser contract: PASS (Gill + standalone, Chromium + WebKit, 320/390/desktop, opt-out, Save-Data, script failure).');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exit(1); });
`;

write('scripts/tts-engine-status-contract-test.js', staticContract);
write('scripts/tts-engine-lifecycle-browser-test.js', lifecycleBrowser);
write('scripts/tts-status-route-browser-test.js', routeBrowser);

workflow = workflow.replace('      - "js/vosk-tts-engine.js"\n', '      - "js/vosk-tts-engine.js"\n      - "js/floating-cluster-controller.js"\n', 1);
workflow = workflow.replace('      - "js/vosk-tts-engine.js"\n', '      - "js/vosk-tts-engine.js"\n      - "js/floating-cluster-controller.js"\n', 1);
workflow = workflow.replace('      - "scripts/tts-download-notice-browser-test.js"\n', '      - "scripts/tts-download-notice-browser-test.js"\n      - "scripts/tts-engine-status-contract-test.js"\n      - "scripts/tts-engine-lifecycle-browser-test.js"\n      - "scripts/tts-status-route-browser-test.js"\n', 1);
workflow = workflow.replace('      - "scripts/tts-download-notice-browser-test.js"\n', '      - "scripts/tts-download-notice-browser-test.js"\n      - "scripts/tts-engine-status-contract-test.js"\n      - "scripts/tts-engine-lifecycle-browser-test.js"\n      - "scripts/tts-status-route-browser-test.js"\n', 1);
workflow = workflow.replace(
`          node --check scripts/tts-download-notice-browser-test.js`,
`          node --check scripts/tts-download-notice-browser-test.js
          node --check scripts/tts-engine-status-contract-test.js
          node --check scripts/tts-engine-lifecycle-browser-test.js
          node --check scripts/tts-status-route-browser-test.js`
);
workflow = workflow.replace(
`      - name: Enforce cancellable download contract
        run: node scripts/tts-download-consent-contract-test.js`,
`      - name: Enforce TTS source contracts
        run: |
          node scripts/tts-download-consent-contract-test.js
          node scripts/tts-engine-status-contract-test.js`
);
workflow = workflow.replace('npx playwright install --with-deps chromium', 'npx playwright install --with-deps chromium webkit');
workflow = workflow.replace(
`      - name: Run desktop and mobile cancellation fixture
        run: node scripts/tts-download-notice-browser-test.js`,
`      - name: Run engine lifecycle fixtures
        run: |
          node scripts/tts-download-notice-browser-test.js
          node scripts/tts-engine-lifecycle-browser-test.js

      - name: Build production-like routes
        run: npm run build

      - name: Run real-route status matrix
        run: node scripts/tts-status-route-browser-test.js`
);
workflow = workflow.replace(
`            reports/tts-download-notice-mobile-dark.png`,
`            reports/tts-download-notice-mobile-dark.png
            reports/tts-lifecycle-*.png
            reports/tts-route-*.png`
);

const cssHash = md5short(css);
engine = engine.replace(/DOWNLOAD_NOTICE_CSS_URL = '\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}'/, `DOWNLOAD_NOTICE_CSS_URL = '/css/tts-download-notice.css?v=${cssHash}'`);
const engineHash = md5short(engine);
controller = controller.replace(/__ENGINE_HASH__/g, engineHash).replace(/__CSS_HASH__/g, cssHash);

write(enginePath, engine);
write(controllerPath, controller);
write(cssPath, css);
write(workflowPath, workflow);

for (const rel of [
  'scripts/_temp-tts-engine-status-patcher.js',
  '.github/workflows/_temp-tts-engine-status.yml',
]) {
  try { fs.unlinkSync(file(rel)); } catch (err) { if (err.code !== 'ENOENT') throw err; }
}

console.log(JSON.stringify({ cssHash, engineHash }, null, 2));
