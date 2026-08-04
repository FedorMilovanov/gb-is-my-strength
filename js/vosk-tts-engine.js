/*
 * Thin browser client for the persistent Vosk TTS worker.
 *
 * The document owns only user consent, status UI and audio playback. The
 * worker owns model download, integrity verification, extraction, IndexedDB,
 * ONNX sessions and inference. This keeps the reader responsive without
 * intercepting global fetch or monkey-patching decompression libraries.
 */
(function () {
  'use strict';

  var VERSION = 2;
  var WORKER_SRC = '/js/vosk-tts-worker.js';
  var NOTICE_CSS_URL = '/css/tts-download-notice.css?v=b9ef192f';
  var MODEL_DOWNLOAD_OPTOUT_KEY = 'gbx-vosk-warmup';

  if (window.VoskTTSEngine && window.VoskTTSEngine.version === VERSION) return;

  var state = {
    worker: null,
    ready: false,
    loading: null,
    loadSequence: 0,
    speakSequence: 0,
    loadRequests: new Map(),
    speakRequests: new Map(),
    audio: null,
    audioHandleId: null,
    objectUrl: null,
    notice: null,
    noticeTimer: 0,
    status: { phase: 'idle', ready: false, loading: false, optedOut: false }
  };

  function modelDownloadOptedOut() {
    try { return localStorage.getItem(MODEL_DOWNLOAD_OPTOUT_KEY) === 'off'; }
    catch (_) { return false; }
  }

  function setModelDownloadOptOut(disabled) {
    try {
      if (disabled) localStorage.setItem(MODEL_DOWNLOAD_OPTOUT_KEY, 'off');
      else localStorage.removeItem(MODEL_DOWNLOAD_OPTOUT_KEY);
    } catch (_) {}
  }

  function createError(payload, fallback) {
    var error;
    var message = payload && payload.message ? payload.message : fallback || 'Vosk worker failed';
    try {
      error = payload && payload.name === 'AbortError'
        ? new DOMException(message, 'AbortError')
        : new Error(message);
    } catch (_) {
      error = new Error(message);
      if (payload && payload.name) error.name = payload.name;
    }
    if (payload && payload.name) error.name = payload.name;
    if (payload && payload.userCancelled) error.userCancelled = true;
    return error;
  }

  function createCancelledError(message) {
    return createError({ name: 'AbortError', message: message || 'enhanced voice cancelled', userCancelled: true });
  }

  function dispatchStatus(phase, detail) {
    var next = Object.assign({
      phase: phase,
      ready: !!state.ready,
      loading: !!state.loading,
      optedOut: modelDownloadOptedOut()
    }, detail || {});
    state.status = next;
    try { window.dispatchEvent(new CustomEvent('gb:vosk-status', { detail: next })); } catch (_) {}
    return next;
  }

  function getStatus() {
    return Object.assign({}, state.status, {
      ready: !!state.ready,
      loading: !!state.loading,
      optedOut: modelDownloadOptedOut()
    });
  }

  function ensureNoticeStyles() {
    if (document.querySelector('link[data-gb-tts-download-notice]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = NOTICE_CSS_URL;
    link.setAttribute('data-gb-tts-download-notice', 'true');
    document.head.appendChild(link);
  }

  function setNoticeAction(element, mode, label, ariaLabel) {
    var action = element.querySelector('.gb-tts-download-notice__action');
    if (!action) return;
    action.hidden = !mode;
    action.dataset.action = mode || '';
    action.textContent = label || '';
    action.setAttribute('aria-label', ariaLabel || label || '');
  }

  function bindNoticeAction(element) {
    var action = element && element.querySelector('.gb-tts-download-notice__action');
    if (!action || action.dataset.gbTtsActionBound === 'true') return;
    action.dataset.gbTtsActionBound = 'true';
    action.addEventListener('click', function () {
      var mode = action.dataset.action || '';
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
        if (!retryDetail.handled) void retryLoading({ clearOptOut: true });
      }
    });
  }

  function getNotice() {
    if (state.notice && document.documentElement.contains(state.notice)) return state.notice;
    var existing = document.querySelector('.gb-tts-download-notice');
    if (existing) {
      state.notice = existing;
      bindNoticeAction(existing);
      return existing;
    }
    var element = document.createElement('div');
    element.className = 'gb-tts-download-notice';
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.setAttribute('aria-atomic', 'true');
    element.innerHTML =
      '<span class="gb-tts-download-notice__icon" aria-hidden="true"></span>' +
      '<span class="gb-tts-download-notice__copy">' +
        '<strong class="gb-tts-download-notice__title"></strong>' +
        '<span class="gb-tts-download-notice__meta"></span>' +
      '</span>' +
      '<button class="gb-tts-download-notice__action" type="button" hidden></button>';
    document.body.appendChild(element);
    state.notice = element;
    bindNoticeAction(element);
    return element;
  }

  function hideNotice(delay) {
    clearTimeout(state.noticeTimer);
    state.noticeTimer = setTimeout(function () {
      if (!state.notice) return;
      state.notice.classList.remove('is-visible');
      var doomed = state.notice;
      setTimeout(function () {
        if (doomed.parentNode) doomed.parentNode.removeChild(doomed);
        if (state.notice === doomed) state.notice = null;
      }, 360);
    }, Math.max(0, Number(delay) || 0));
  }

  function showStatus(name, options) {
    options = options || {};
    ensureNoticeStyles();
    clearTimeout(state.noticeTimer);
    var element = getNotice();
    var title = '';
    var meta = '';
    var action = null;
    var actionLabel = '';
    var actionAria = '';
    var stateName = name;

    if (name === 'browser') {
      title = 'Сейчас системный голос';
      meta = 'Улучшенный голос проверяется в фоне';
    } else if (name === 'preparing' || name === 'dependencies-ready') {
      stateName = 'preparing';
      title = 'Проверяем улучшенный голос';
      meta = 'Системный голос уже работает';
    } else if (name === 'loading') {
      title = 'Улучшенный голос загружается';
      meta = 'Системный голос уже работает · около 280 МБ';
      action = 'cancel';
      actionLabel = 'Не загружать';
      actionAria = 'Остановить загрузку улучшенного голоса';
    } else if (name === 'verifying') {
      stateName = 'initializing';
      title = 'Проверяем модель';
      meta = 'Контроль целостности выполняется локально';
    } else if (name === 'extracting') {
      stateName = 'initializing';
      title = 'Распаковываем улучшенный голос';
      meta = 'Работа выполняется вне основного потока';
    } else if (name === 'cache-hit') {
      stateName = 'initializing';
      title = 'Улучшенный голос найден';
      meta = 'Запускаем сохранённую модель';
    } else if (name === 'initializing') {
      title = 'Запускаем улучшенный голос';
      meta = 'Создаём голосовые сессии в фоновом потоке';
    } else if (name === 'ready' || name === 'success') {
      stateName = 'ready';
      title = 'Улучшенный голос готов';
      meta = 'Можно включить без перезагрузки страницы';
      action = 'switch';
      actionLabel = 'Включить сейчас';
      actionAria = 'Перейти на улучшенный голос с текущего места';
    } else if (name === 'selected') {
      title = 'Работает улучшенный голос';
      meta = 'Локальная модель · текст никуда не отправляется';
    } else if (name === 'disabled') {
      title = 'Улучшенный голос отключён';
      meta = 'Сейчас используется системный голос';
      action = 'enable';
      actionLabel = 'Включить';
      actionAria = 'Снова разрешить загрузку улучшенного голоса';
    } else if (name === 'save-data') {
      title = 'Включена экономия трафика';
      meta = 'Системный голос работает · модель около 280 МБ';
      action = 'manual';
      actionLabel = 'Загрузить';
      actionAria = 'Загрузить улучшенный голос несмотря на экономию трафика';
    } else if (name === 'cancelled') {
      title = 'Загрузка остановлена';
      meta = 'Системный голос продолжает работать';
    } else if (name === 'cache-unavailable') {
      stateName = 'initializing';
      title = 'Хранилище браузера недоступно';
      meta = 'Голос работает в текущей вкладке без постоянного кэша';
    } else {
      stateName = 'error';
      title = 'Улучшенный голос не запустился';
      meta = 'Системный голос продолжает работать';
      action = 'retry';
      actionLabel = 'Повторить';
      actionAria = 'Повторить запуск улучшенного голоса';
    }

    if (options.title) title = options.title;
    if (options.meta) meta = options.meta;
    if (options.actionMode !== undefined) action = options.actionMode;
    if (options.actionLabel !== undefined) actionLabel = options.actionLabel;
    if (options.actionAria !== undefined) actionAria = options.actionAria;

    element.dataset.state = stateName;
    var titleNode = element.querySelector('.gb-tts-download-notice__title');
    var metaNode = element.querySelector('.gb-tts-download-notice__meta');
    if (titleNode) titleNode.textContent = title;
    if (metaNode) metaNode.textContent = meta;
    setNoticeAction(element, action, actionLabel, actionAria);
    element.classList.add('is-visible');
    dispatchStatus(stateName, {
      title: title,
      message: meta,
      action: action,
      reason: options.reason || null
    });
    if (options.autoHide) hideNotice(options.autoHide);
    return element;
  }

  function finishStatus(name) {
    var autoHide = name === 'selected' ? 1800 : name === 'cancelled' ? 1900 : 0;
    return showStatus(name, { autoHide: autoHide });
  }

  function getAudio() {
    if (state.audio && state.audio.isConnected) return state.audio;
    var audio = document.createElement('audio');
    audio.hidden = true;
    audio.preload = 'auto';
    audio.setAttribute('data-gb-vosk-audio', 'true');
    document.body.appendChild(audio);
    state.audio = audio;
    return audio;
  }

  function revokeObjectUrl() {
    if (!state.objectUrl) return;
    try { URL.revokeObjectURL(state.objectUrl); } catch (_) {}
    state.objectUrl = null;
  }

  function stopAudio() {
    var audio = state.audio;
    if (audio) {
      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch (_) {}
    }
    state.audioHandleId = null;
    revokeObjectUrl();
  }

  function settleLoad(id, error) {
    var pending = state.loadRequests.get(id);
    if (!pending) return;
    state.loadRequests.delete(id);
    if (error) pending.reject(error);
    else pending.resolve(true);
  }

  function settleAllLoads(error) {
    Array.from(state.loadRequests.keys()).forEach(function (id) { settleLoad(id, error); });
  }

  function failSpeak(id, error) {
    var entry = state.speakRequests.get(id);
    if (!entry) return;
    state.speakRequests.delete(id);
    if (!entry.handle.cancelled && typeof entry.onerror === 'function') entry.onerror(error);
  }

  function failAllSpeaks(error) {
    Array.from(state.speakRequests.keys()).forEach(function (id) { failSpeak(id, error); });
  }

  function terminateWorker(error) {
    if (state.worker) {
      try { state.worker.terminate(); } catch (_) {}
    }
    state.worker = null;
    state.ready = false;
    state.loading = null;
    if (error) {
      settleAllLoads(error);
      failAllSpeaks(error);
    }
  }

  function handleWorkerMessage(message) {
    var type = message.type;
    if (type === 'status') {
      if (message.phase === 'ready') state.ready = true;
      showStatus(message.phase || 'preparing', {
        reason: message.reason || null,
        meta: message.message || undefined
      });
      return;
    }
    if (type === 'ready') {
      state.ready = true;
      settleLoad(message.id);
      finishStatus('ready');
      return;
    }
    if (type === 'load-error') {
      var loadError = createError(message, 'Vosk model failed to load');
      settleLoad(message.id, loadError);
      if (loadError.name === 'AbortError') finishStatus('cancelled');
      else showStatus('error', { reason: loadError.message });
      return;
    }
    if (type === 'synth-progress') {
      try {
        window.dispatchEvent(new CustomEvent('gb:vosk-synthesis-progress', {
          detail: { id: message.id, value: Math.max(0, Math.min(1, Number(message.value) || 0)) }
        }));
      } catch (_) {}
      return;
    }
    if (type === 'audio') {
      var entry = state.speakRequests.get(message.id);
      if (!entry || entry.handle.cancelled) return;
      stopAudio();
      var audio = getAudio();
      state.audioHandleId = message.id;
      state.objectUrl = URL.createObjectURL(new Blob([message.wav], { type: 'audio/wav' }));
      audio.src = state.objectUrl;
      audio.playbackRate = 1;
      audio.onended = function () {
        var current = state.speakRequests.get(message.id);
        state.speakRequests.delete(message.id);
        state.audioHandleId = null;
        revokeObjectUrl();
        if (current && !current.handle.cancelled && typeof current.onend === 'function') current.onend();
      };
      audio.onerror = function (event) {
        failSpeak(message.id, event instanceof Error ? event : new Error('Vosk audio playback failed'));
      };
      try {
        var playback = audio.play();
        if (playback && playback.catch) playback.catch(function (error) { failSpeak(message.id, error); });
      } catch (error) {
        failSpeak(message.id, error);
      }
      return;
    }
    if (type === 'synth-error') {
      failSpeak(message.id, createError(message, 'Vosk synthesis failed'));
      return;
    }
    if (type === 'warning') {
      console.warn('[vosk-tts-worker]', message.message || message);
    }
  }

  function ensureWorker() {
    if (state.worker) return state.worker;
    if (!isSupported()) throw new Error('Persistent Vosk worker is not supported by this browser');
    var worker = new Worker(WORKER_SRC, { name: 'gb-vosk-tts' });
    worker.onmessage = function (event) { handleWorkerMessage(event.data || {}); };
    worker.onerror = function (event) {
      var error = new Error(event.message || 'Persistent Vosk worker crashed');
      console.error('[VoskTTSEngine]', error);
      showStatus('error', { reason: error.message });
      terminateWorker(error);
    };
    worker.onmessageerror = function () {
      var error = new Error('Persistent Vosk worker returned an unreadable message');
      showStatus('error', { reason: error.message });
      terminateWorker(error);
    };
    state.worker = worker;
    return worker;
  }

  function isSupported() {
    return typeof Worker === 'function'
      && !!window.indexedDB
      && !!window.WebAssembly
      && typeof window.fetch === 'function'
      && typeof window.TextDecoder === 'function';
  }

  function isReady() {
    return !!state.ready;
  }

  function ensureLoaded() {
    if (state.ready) return Promise.resolve(true);
    if (modelDownloadOptedOut()) {
      showStatus('disabled', { reason: 'optout' });
      return Promise.reject(createCancelledError('enhanced voice download disabled by user'));
    }
    if (state.loading) return state.loading;

    var id = ++state.loadSequence;
    showStatus('preparing');
    state.loading = new Promise(function (resolve, reject) {
      state.loadRequests.set(id, { resolve: resolve, reject: reject });
      try { ensureWorker().postMessage({ type: 'ensure', id: id }); }
      catch (error) {
        state.loadRequests.delete(id);
        reject(error);
      }
    }).finally(function () {
      state.loading = null;
    });
    return state.loading;
  }

  function clearModelDownloadOptOut() {
    setModelDownloadOptOut(false);
    dispatchStatus('enabled');
  }

  function retryLoading(options) {
    options = options || {};
    if (options.clearOptOut !== false) clearModelDownloadOptOut();
    if (!state.worker && state.loading) state.loading = null;
    return ensureLoaded();
  }

  function cancelLoading(options) {
    var persist = !options || options.persist !== false;
    if (persist) setModelDownloadOptOut(true);
    var error = createCancelledError('enhanced voice download cancelled by user');
    if (state.worker) {
      try { state.worker.postMessage({ type: 'cancel-load' }); } catch (_) {}
    }
    terminateWorker(error);
    finishStatus('cancelled');
    try { window.dispatchEvent(new CustomEvent('gb:vosk-model-download-cancelled')); } catch (_) {}
    return true;
  }

  function speak(text, rate, speakerId, onend, onerror) {
    var id = ++state.speakSequence;
    var handle = { engine: 'vosk', id: id, cancelled: false };
    state.speakRequests.set(id, { handle: handle, onend: onend, onerror: onerror });
    try {
      ensureWorker().postMessage({
        type: 'speak',
        id: id,
        text: String(text || ''),
        rate: Number(rate) || 1,
        speakerId: Number(speakerId) || 0
      });
    } catch (error) {
      failSpeak(id, error);
    }
    return handle;
  }

  function cancel(handle) {
    if (handle) handle.cancelled = true;
    var id = handle && handle.id;
    if (id && state.worker) {
      try { state.worker.postMessage({ type: 'cancel', id: id }); } catch (_) {}
    }
    if (id) state.speakRequests.delete(id);
    if (!id || state.audioHandleId === id) stopAudio();
  }

  window.VoskTTSEngine = Object.freeze({
    version: VERSION,
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
  });
})();