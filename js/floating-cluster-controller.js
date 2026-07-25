/**
 * floating-cluster-controller.js
 * GB Floating Cluster v16 — контроллер для standalone и series кластеров.
 *
 * Точная реализация логики из gb-floating-cluster-probe-v16.html.
 * CSS живёт в Astro-компонентах (site.css), НЕ инжектируется здесь.
 *
 * Принципы:
 * - Использует window.SiteUtils если доступен
 * - Использует window.BookmarkEngine для save
 * - НЕ создаёт второй search/theme/bookmark
 * - НЕ генерирует UI строками
 * - НЕ инжектирует CSS
 */
(function () {
  'use strict';

  var THEME_KEY = 'theme';
  var toastTimer = null;
  /* True on devices with a real hover pointer (desktop/trackpad). Drives the
     hover-to-open Play speed pill; touch devices fall back to tap. */
  var HOVER_CAPABLE = !!(window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches);

  /* =====================================================
     ЖИЗНЕННЫЙ ЦИКЛ И ОЧИСТКА СОБЫТИЙ (BUG-001 fix)
     ===================================================== */
  if (window._fcCleanupListeners && typeof window._fcCleanupListeners === 'function') {
    try { window._fcCleanupListeners(); } catch (_) {}
  }
  var _registeredListeners = [];
  var abortCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  window._fcAbortController = abortCtrl;

  function addCleanListener(target, type, fn, options) {
    if (!target || !target.addEventListener) return;
    var opts = options;
    if (abortCtrl) {
      if (typeof options === 'boolean') {
        opts = { capture: options, signal: abortCtrl.signal };
      } else if (typeof options === 'object' && options !== null) {
        opts = Object.assign({}, options, { signal: abortCtrl.signal });
      } else {
        opts = { signal: abortCtrl.signal };
      }
    }
    target.addEventListener(type, fn, opts);
    _registeredListeners.push({ target: target, type: type, fn: fn, opts: options });
  }

  window._fcCleanupListeners = window.removeFloatingClusterListeners = function() {
    if (window._fcAbortController && typeof window._fcAbortController.abort === 'function') {
      try { window._fcAbortController.abort(); } catch (_) {}
      window._fcAbortController = null;
    }
    for (var i = 0; i < _registeredListeners.length; i++) {
      var item = _registeredListeners[i];
      if (item.target && item.target.removeEventListener) {
        try { item.target.removeEventListener(item.type, item.fn, item.opts); } catch (_) {}
      }
    }
    _registeredListeners = [];
    cancelScheduledVoskWarmup();
  };

  /* =====================================================
     УТИЛИТЫ
     ===================================================== */
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* =====================================================
     ИНИЦИАЛИЗАЦИЯ EMBER (SVG ring injection для SSR-совместимости)
     Если SSR уже вставил SVG — повторно не вставляем.
     ===================================================== */
  var EMBER_TPL =
    '<svg class="gb-ember__ring-svg" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="gb-ember__ring-track" cx="50" cy="50" r="45"/>' +
      '<circle class="gb-ember__ring-progress" cx="50" cy="50" r="45"/>' +
    '</svg>' +
    '<svg class="gb-ember__glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8v14.4L18.5 12 7 4.8z"/></svg>' +
    '<svg class="gb-ember__pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>' +
    '<svg class="gb-ember__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.1L19 7"/></svg>';

  function initEmbers() {
    qsa('.gb-ember').forEach(function (btn) {
      if (!btn.querySelector('.gb-ember__ring-svg')) {
        btn.insertAdjacentHTML('beforeend', EMBER_TPL);
      }
    });
  }

  /* =====================================================
     THEME
     Использует html.dark + localStorage.theme (контракт сайта)
     ===================================================== */
  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function setTheme(dark) {
    var theme = dark ? 'dark' : 'light';
    if (window.GBReaderPreferences && typeof window.GBReaderPreferences.setTheme === 'function') {
      window.GBReaderPreferences.setTheme(theme, { source: 'floating-cluster' });
    } else {
      document.documentElement.classList.toggle('dark', !!dark);
      document.documentElement.setAttribute('data-reader-theme', theme);
      try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
    }
    syncThemeButtons();
  }

  function toggleTheme() {
    setTheme(!isDark());
  }

  function syncThemeButtons() {
    var dark = isDark();
    qsa('.gb-theme-toggle, [data-fc-action="theme"]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    });
  }

  /* =====================================================
     SEARCH
     Делегирует на существующий command palette сайта.
     НЕ создаёт второй поиск.
     ===================================================== */
  function openSearch(sourceBtn) {
    // Active selectors: data-gbs2-search (GBS2 rail buttons), #gbSearchBtn (search.js injects)
    // Removed dead selectors: [data-search-open], #searchToggle, #searchButton,
    //   #hCpBtnNav (renamed to #gbSearchBtn by search.js), #hSearchBtn, [data-open-search]
    var selectors = [
      '[data-gbs2-search]',
      '#gbSearchBtn'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var el = qs(selectors[i]);
      if (el && el !== sourceBtn && !el.closest('[data-fc-root]')) {
        el.click();
        return;
      }
    }

    // Fallback: dispatch custom event
    document.dispatchEvent(new CustomEvent('gb:openSearch', { bubbles: true }));
  }

  /* =====================================================
     SAVE / BOOKMARK
     Фасад над BookmarkEngine. Если нет engine — localStorage fallback.
     ===================================================== */
  /* =====================================================
     FAVORITES ENGINE — личная коллекция статей
     Отдельно от BookmarkEngine (автосохранение позиции).
     localStorage key: gb-favorites (JSON array)
     ===================================================== */
  var FAV_KEY = 'gb-favorites';

  function getFavorites() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; }
    catch (_) { return []; }
  }

  function setFavorites(list) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch (_) {}
  }

  function isFavorite(path) {
    return getFavorites().some(function(f) { return f.path === path; });
  }

  function getPageMeta() {
    // Extract article metadata from OG tags or document
    var meta = { path: normalizePath(location.pathname), addedAt: Date.now() };
    var ogTitle = qs('meta[property="og:title"]');
    meta.title = ogTitle ? ogTitle.getAttribute('content') : document.title;
    var ogDesc = qs('meta[property="og:description"]');
    meta.description = ogDesc ? (ogDesc.getAttribute('content') || '').substring(0, 120) : '';
    var ogImg = qs('meta[property="og:image"]');
    meta.image = ogImg ? ogImg.getAttribute('content') : '';
    // Section from SITE_CONFIG or breadcrumb
    var crumb = qs('.breadcrumb__link:last-of-type');
    meta.section = crumb ? crumb.textContent.trim() : '';
    return meta;
  }

  function toggleFavorite() {
    var path = normalizePath(location.pathname);
    var favs = getFavorites();
    var idx = -1;
    favs.forEach(function(f, i) { if (f.path === path) idx = i; });

    if (idx >= 0) {
      // Remove from favorites
      favs.splice(idx, 1);
      setFavorites(favs);
      setSaved(false);
      showToast('Убрано из Избранного', false);
    } else {
      // Add to favorites
      var meta = getPageMeta();
      favs.unshift(meta); // newest first
      if (favs.length > 50) favs = favs.slice(0, 50); // cap at 50
      setFavorites(favs);
      setSaved(true);
      showToast('Добавлено в Избранное', true);
    }
  }

  function saveCurrent(btn) {
    toggleFavorite();
  }

  function setSaved(saved) {
    qsa('.gb-save').forEach(function (btn) {
      btn.classList.toggle('is-saved', !!saved);
      btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
    });
  }

  function normalizePath(path) {
    // Strip query, hash, trailing slash, and index.html — mirrors bookmark-engine normalize.
    // Ensures Favorites key matches BookmarkEngine key for the same page.
    var p = String(path || '/').split('?')[0].split('#')[0]
              .replace(/index\.html$/, '').replace(/\/$/, '');
    return p || '/';
  }

  /* =====================================================
     PLAY EMBER
     Управляет data-state и --p переменной.
     В пилоте audioState="none" → idle, кнопка видима но subdued.
     ===================================================== */
  function setEmberState(state, progress) {
    qsa('.gb-ember').forEach(function (btn) {
      btn.dataset.state = state;
      if (typeof progress !== 'undefined') {
        btn.style.setProperty('--p', String(progress));
      }
    });
    updateEmberAriaLabel(state);
    // Broadcast so non-ember Play surfaces (SpeedBloom goo control) can mirror
    // play/pause + progress without being a .gb-ember themselves.
    try {
      window.dispatchEvent(new CustomEvent('gb:tts-state', {
        detail: { state: state, progress: progress },
      }));
    } catch (_) {}
  }

  function updateEmberAriaLabel(state) {
    qsa('.gb-ember').forEach(function (btn) {
      var label =
        state === 'playing'  ? 'Пауза' :
        state === 'paused'   ? 'Продолжить озвучку' :
        state === 'loading'  ? 'Подключение озвучки' :
        state === 'complete' ? 'Прослушано' :
                               'Озвучка';
      btn.setAttribute('aria-label', label);
    });
  }

  /* =====================================================
     TTS — Vosk TTS (нейросеть, js/vosk-tts-engine.js) с автооткатом на Web Speech API
     Per PremiumControls contract (AuditRepo §3): handlePlayClick
     должен запускать реальную озвучку через speechSynthesis,
     применяя сохранённую скорость из localStorage gb:audio:rate (fallback gbx-tts-rate).

     Vosk грузится и кэшируется лениво (только по первому клику «Слушать»,
     js/vosk-tts-engine.js). Пока модель не готова — используем Web Speech
     без задержки; когда Vosk уже прогрет (кэш IndexedDB с прошлого визита),
     он используется сразу. ttsState.engine хранит, какой движок обслуживает
     текущую сессию воспроизведения ('vosk' | 'webspeech').
     ===================================================== */
  // Vosk model's 5 speakers (config.json speaker_id_map): 0=female_0,
  // 1=female_1, 2=female_2, 3=male_0, 4=male_1. male_0 chosen after a
  // real-audio A/B listen (see AuditRepo tts-quality-audit-2026-07-07).
  var VOSK_SPEAKER_ID = 3;
  var ttsState = {
    utterance: null,
    text: '',
    chunks: [],
    chunkIdx: 0,
    totalChars: 0,
    spokenChars: 0,
    paused: false,
    voice: null,
    runId: 0,
    suppressEnd: false,
    engine: null,
  };

  // Не зависит от того, успел ли уже подгрузиться js/vosk-tts-engine.js
  // (он лениво подключается только внутри resolveTtsEngine()) — просто проверяет,
  // есть ли хоть какой-то движок, которым можно озвучить текст.
  function ttsAvailable() {
    return ('speechSynthesis' in window) ||
           !!(window.indexedDB && window.WebAssembly && window.fetch);
  }

  // Vosk load/playback failures were previously silent (console.warn only) —
  // the alphacephei.com CORS outage went unnoticed in production for days
  // until a user manually checked DevTools. Same ym() reachGoal pattern as
  // js/enhancements.js's quiz tracking.
  function reportTtsIssue(reason) {
    try {
      window.ym && window.ym(108353327, 'reachGoal', 'vosk_tts_failed', { reason: reason });
    } catch (_) {}
  }

  // Success-side counterpart to reportTtsIssue: which engine actually started
  // playing this session ('vosk' | 'webspeech'). Without it we could only see
  // failures, never the Vosk-vs-Web-Speech split — which is exactly why the CSP
  // outage stayed invisible for days (a broken Vosk just silently fell back and
  // nothing was logged). See AuditRepo TTS-OUTCOME-TELEMETRY. Fire-and-forget.
  function reportTtsOutcome(engine) {
    try {
      window.ym && window.ym(108353327, 'reachGoal', 'tts_engine_selected', { engine: engine });
    } catch (_) {}
  }

  function cancelActiveEngine() {
    if (ttsState.engine === 'vosk' && window.VoskTTSEngine) {
      window.VoskTTSEngine.cancel(ttsState.utterance);
    } else if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
  }

  var _voskEngineScriptPromise = null;
  var VOSK_ENGINE_SRC = '/js/vosk-tts-engine.js?v=9ca1685a';
  var TTS_NOTICE_CSS_SRC = '/css/tts-download-notice.css?v=475abd4b';
  var fallbackTtsNoticeTimer = null;
  var fallbackTtsNoticeStylesPromise = null;
  var _voskWarmupStartPromise = null;
  var _voskWarmupStartTimer = null;
  var _voskWarmupScheduleId = 0;
  var VOSK_BROWSER_STATUS_DWELL_MS = 800;
  var TTS_NOTICE_STYLE_TIMEOUT_MS = 5000;
  var TTS_NOTICE_PAINT_TIMEOUT_MS = 2200;

  function fallbackTtsNoticeStylesApplied(link) {
    if (!(link && link.sheet)) return false;
    try { return link.sheet.cssRules.length > 0; }
    catch (_) { return true; }
  }

  function ensureFallbackTtsNoticeStyles() {
    var existing = document.querySelector('link[data-gb-tts-download-notice]');
    if (fallbackTtsNoticeStylesApplied(existing)) return Promise.resolve(true);
    if (fallbackTtsNoticeStylesPromise) return fallbackTtsNoticeStylesPromise;

    fallbackTtsNoticeStylesPromise = new Promise(function (resolve) {
      var link = existing || document.createElement('link');
      var settled = false;
      var timeout = null;

      function finish(applied) {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (!applied) fallbackTtsNoticeStylesPromise = null;
        resolve(applied);
      }
      function probe() {
        if (settled) return;
        if (fallbackTtsNoticeStylesApplied(link)) {
          finish(true);
          return;
        }
        setTimeout(probe, 32);
      }

      link.addEventListener('load', probe, { once: true });
      link.addEventListener('error', function () { finish(false); }, { once: true });
      if (!existing) {
        link.rel = 'stylesheet';
        link.href = TTS_NOTICE_CSS_SRC;
        link.setAttribute('data-gb-tts-download-notice', 'true');
        document.head.appendChild(link);
      }
      timeout = setTimeout(function () { finish(false); }, TTS_NOTICE_STYLE_TIMEOUT_MS);
      probe();
    });
    return fallbackTtsNoticeStylesPromise;
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

  function fallbackBrowserStatusPainted() {
    var el = qs('.gb-tts-download-notice[data-state="browser"].is-visible');
    if (!el) return false;
    var style;
    try { style = getComputedStyle(el); } catch (_) { return false; }
    return style.position === 'fixed' &&
      style.visibility === 'visible' &&
      Number.parseFloat(style.opacity || '0') >= 0.99;
  }

  function waitForFallbackTtsNoticePaint() {
    return ensureFallbackTtsNoticeStyles().then(function () {
      return new Promise(function (resolve) {
        var settled = false;
        var timeout = setTimeout(function () { finish(false); }, TTS_NOTICE_PAINT_TIMEOUT_MS);
        function finish(painted) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(painted);
        }
        function probe() {
          if (settled) return;
          if (fallbackBrowserStatusPainted()) {
            requestAnimationFrame(function () { finish(true); });
            return;
          }
          requestAnimationFrame(probe);
        }
        requestAnimationFrame(probe);
      });
    });
  }

  function cancelScheduledVoskWarmup() {
    _voskWarmupScheduleId += 1;
    if (_voskWarmupStartTimer) clearTimeout(_voskWarmupStartTimer);
    _voskWarmupStartTimer = null;
    _voskWarmupStartPromise = null;
  }

  function scheduleVoskWarmupAfterBrowserStatus() {
    if (_voskWarmupPromise || _voskWarmupStartPromise || _voskWarmupStartTimer) return;
    var scheduleId = ++_voskWarmupScheduleId;
    function beginDwell() {
      if (scheduleId !== _voskWarmupScheduleId) return;
      _voskWarmupStartPromise = null;
      _voskWarmupStartTimer = setTimeout(function () {
        if (scheduleId !== _voskWarmupScheduleId) return;
        _voskWarmupStartTimer = null;
        warmVoskInBackground({ preserveBrowserStatus: true });
      }, VOSK_BROWSER_STATUS_DWELL_MS);
    }
    _voskWarmupStartPromise = waitForFallbackTtsNoticePaint().then(beginDwell, beginDwell);
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

  // Прогревает Vosk (скрипт движка + скачивание/разбор модели) в фоне, никогда
  // не блокируя текущее воспроизведение — пока модель не готова, play уже идёт
  // через Web Speech (см. resolveTtsEngine ниже); следующий клик «Слушать»
  // подхватит Vosk сам, если прогрев успел завершиться. Ошибка сети/модели —
  // тихая, просто остаёмся на Web Speech.
  // Пользователь на тарифе с экономией трафика (браузерный сигнал Save-Data)
  // либо явно отказавшийся раньше (localStorage) — не тянем ~280 МБ модель в
  // фоне, честно остаёмся на мгновенном системном голосе. Save-Data — только
  // подсказка (ограниченная поддержка), поэтому это НЕ запрет улучшенного
  // голоса, а лишь отказ от автоматической тяжёлой загрузки без спроса.
  var VOSK_WARMUP_OPTOUT_KEY = 'gbx-vosk-warmup';
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
    var preserveBrowserStatus = options.preserveBrowserStatus === true;
    if (manual || retry) cancelScheduledVoskWarmup();
    var blockReason = voskWarmupBlockReason();

    if (!manual && blockReason) {
      showVoskStatus(blockReason);
      return Promise.resolve(null);
    }
    if (_voskWarmupPromise && !retry) return _voskWarmupPromise;

    if (!preserveBrowserStatus) showVoskStatus('preparing');
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

  // Решает, каким движком озвучивать текущую сессию. Воспроизведение обязано
  // начинаться мгновенно (PremiumControls contract — data-state/speak не ждут
  // сеть): если Vosk уже прогрет (модель скачана и разобрана раньше, из кэша
  // IndexedDB) — используем сразу; иначе играем Web Speech без всякой задержки
  // и прогреваем Vosk в фоне для следующего раза. Ждём загрузку Vosk синхронно
  // только если Web Speech в браузере вообще отсутствует (иначе играть нечем).
  function resolveTtsEngine() {
    if (window.VoskTTSEngine && window.VoskTTSEngine.isReady()) {
      showVoskStatus('selected', { autoHide: 1800 });
      return Promise.resolve('vosk');
    }
    if ('speechSynthesis' in window) {
      showVoskStatus('browser');
      if (voskWarmupBlockReason()) warmVoskInBackground({ preserveBrowserStatus: true });
      else scheduleVoskWarmupAfterBrowserStatus();
      return Promise.resolve('webspeech');
    }
    showVoskStatus('preparing');
    return warmVoskInBackground({ manual: true }).then(function (engine) {
      if (engine === 'vosk' && window.VoskTTSEngine && window.VoskTTSEngine.isReady()) return 'vosk';
      showVoskStatus('error', { meta: 'В этом браузере нет доступного запасного голоса' });
      return null;
    });
  }

  /* Russian voice picker — без него браузер берёт дефолтный (часто английский)
     голос, даже если u.lang='ru-RU'. */
  function pickRuVoice() {
    if (!('speechSynthesis' in window)) return null;
    var voices = [];
    try { voices = window.speechSynthesis.getVoices() || []; } catch (_) { return null; }
    if (!voices.length) return null;
    var ru = voices.filter(function (v) {
      return /^ru(?:[-_]|$)/i.test(v.lang || '') ||
             /рус|russian/i.test(((v.name || '') + ' ' + (v.lang || '')));
    });
    return ru.find(function (v) { return /google/i.test(v.name || ''); }) ||
           ru.find(function (v) { return v.localService === false; }) ||
           ru[0] || null;
  }
  if ('speechSynthesis' in window) {
    ttsState.voice = pickRuVoice();
    try { addCleanListener(window.speechSynthesis, 'voiceschanged', function () { ttsState.voice = pickRuVoice(); }); } catch (_) {}
  }

  // Вставки, которые русский голос не должен читать, будучи вкраплёнными
  // прямо в русский абзац (иначе textContent склеивает их с прозой):
  //   [lang="en"]     — англоязычные оригиналы цитат, названия трудов, термины;
  //   .gtip           — определения глоссария (всплывающая подсказка у .gterm);
  //   .fn-marker/.tooltip — маркеры сносок и их подсказки.
  // Латынь (lang="la") намеренно НЕ трогаем — короткие формулы читаются приемлемо.
  var TTS_STRIP_INLINE = '[lang="en"], [lang^="en-"], .gtip, .fn-marker, .tooltip';

  function readableRuText(el) {
    if (!el.querySelector(TTS_STRIP_INLINE)) {
      return (el.textContent || '').trim();
    }
    // Клонируем узел и вырезаем нечитаемые вставки, затем берём чистый текст.
    var clone = el.cloneNode(true);
    var marked = clone.querySelectorAll(TTS_STRIP_INLINE);
    Array.prototype.forEach.call(marked, function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
    // Схлопнём осевшие двойные пробелы/пробелы перед пунктуацией после выреза.
    return (clone.textContent || '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.;:!?»])/g, '$1')
      .replace(/([«])\s+/g, '$1')
      .trim();
  }

  function collectArticleBlocks() {
    // Соберём читательский текст: только параграфы внутри <article>.
    // Возвращаем ПАРЫ {el, text} — тот же текст озвучки, но с DOM-узлами,
    // чтобы follow-скролл (см. READING FOLLOW ниже) мог вести читателя
    // по странице синхронно с озвучкой.
    var article = qs('article.article-body') ||
                  qs('article') ||
                  qs('main[data-pagefind-body]') ||
                  qs('main');
    if (!article) return [];
    var blocks = article.querySelectorAll('p, h2, h3, li');
    var out = [];
    Array.prototype.forEach.call(blocks, function (el) {
      // Пропускаем: метаданные, сноски, tooltips, notice (copyright/source),
      // и целые англоязычные блоки (оригиналы цитат/карточек, [lang="en"]).
      if (el.closest('.summary-card, .gtip, .fn-marker, .tooltip, .notice, ' +
                     '.original-author-card, .footnote, aside, .sources-block, ' +
                     '.reading-list-section, [hidden], [data-pagefind-ignore], ' +
                     '[lang="en"], [lang^="en-"]')) return;
      var t = readableRuText(el);
      if (t.length > 0) out.push({ el: el, text: t });
    });
    return out;
  }

  function getArticleText() {
    return collectArticleBlocks().map(function (b) { return b.text; }).join('. ');
  }

  /* =====================================================
     READING FOLLOW — плавный автоскролл за озвучкой.
     Просьба владельца: «скроллится вниз текст потихоньку от нажатия PLAY».
     Блоки статьи получают символьные диапазоны в общем TTS-тексте
     (join('. ') → +2 символа между блоками); на каждом продвижении озвучки
     ищем текущий блок и мягко центрируем его. Ручной скролл читателя
     (wheel/touch/клавиши — НЕ наш собственный smooth-scroll) приостанавливает
     follow на 20 секунд, потом ведение возобновляется само.
     ===================================================== */
  var followState = { map: [], lastEl: null, suspendUntil: 0, active: false, bound: false };

  function buildFollowMap() {
    var blocks = collectArticleBlocks();
    var map = [];
    var offset = 0;
    for (var i = 0; i < blocks.length; i++) {
      var len = blocks[i].text.length;
      map.push({ el: blocks[i].el, start: offset, end: offset + len });
      offset += len + 2; // '. ' между блоками
    }
    followState.map = map;
    followState.lastEl = null;
  }

  function suspendFollow() { followState.suspendUntil = Date.now() + 20000; }

  function bindFollowSuspend() {
    if (followState.bound) return;
    followState.bound = true;
    // Только реальные жесты пользователя: наш scrollIntoView их не порождает.
    addCleanListener(window, 'wheel', suspendFollow, { passive: true });
    addCleanListener(window, 'touchmove', suspendFollow, { passive: true });
    addCleanListener(window, 'keydown', function (e) {
      var k = e.key;
      if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'PageUp' ||
          k === 'PageDown' || k === 'Home' || k === 'End' || k === ' ') suspendFollow();
    });
  }

  function followReading(charOffset) {
    if (!followState.active || !followState.map.length) return;
    if (Date.now() < followState.suspendUntil) return;
    var cur = null;
    for (var i = 0; i < followState.map.length; i++) {
      if (charOffset < followState.map[i].end) { cur = followState.map[i]; break; }
    }
    if (!cur || cur.el === followState.lastEl) return;
    followState.lastEl = cur.el;
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
    try {
      cur.el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    } catch (_) { cur.el.scrollIntoView(); }
  }

  function splitTtsChunks(text) {
    // speechSynthesis в Chrome падает на utterances длиннее ~32000 chars.
    // Делим на ~350-символьные куски по границам предложений (было 180 —
    // поднято, т.к. Vosk синтезирует каждый chunk независимо без общего
    // контекста, и граница chunk'а слышна как сброс интонации; более
    // длинные chunk'и = реже такие сбросы, за счёт чуть более долгой
    // паузы перед стартом каждого chunk'а).
    // Без lookbehind (?<=...) — Safari <16.4 его не поддерживает (SyntaxError).
    var parts = text.split(/([.!?]+\s+)/);
    var chunks = [];
    var buf = '';
    for (var i = 0; i < parts.length; i++) {
      buf += parts[i];
      if (buf.length >= 350 && i % 2 === 1) {
        var trimmed = buf.trim();
        if (trimmed) chunks.push(trimmed);
        buf = '';
      }
    }
    var last = buf.trim();
    if (last) chunks.push(last);
    if (!chunks.length && text.trim()) chunks.push(text.trim());
    return chunks;
  }

  function getStoredRate() {
    var r = 1;
    try { r = parseFloat(localStorage.getItem('gb:audio:rate') || localStorage.getItem('gbx-tts-rate')) || 1; } catch (_) {}
    if (isNaN(r) || r < 0.5 || r > 3) r = 1;
    return r;
  }

  function updateProgress() {
    if (!ttsState.totalChars) return;
    var pct = Math.min(1, ttsState.spokenChars / ttsState.totalChars);
    qsa('.gb-ember').forEach(function (btn) {
      btn.style.setProperty('--p', String(pct));
    });
    if (pct >= 0.99) setEmberState('complete');
  }

  function speakNextChunk() {
    var runId = ttsState.runId;
    if (ttsState.chunkIdx >= ttsState.chunks.length) {
      ttsState.utterance = null;
      followState.active = false;
      mediaSessionSet('none');
      setEmberState('complete');
      return;
    }
    var chunk = ttsState.chunks[ttsState.chunkIdx];
    followReading(ttsState.spokenChars);

    function onChunkEnd() {
      // cancel() may still fire a synthetic end. Ignore that,
      // otherwise pause/rate-change can skip chunks or start duplicate utterances.
      if (runId !== ttsState.runId) return;
      if (ttsState.suppressEnd) { ttsState.suppressEnd = false; return; }
      ttsState.spokenChars += chunk.length;
      ttsState.chunkIdx += 1;
      updateProgress();
      if (!ttsState.paused) speakNextChunk();
    }
    function onChunkError(e) {
      if (runId !== ttsState.runId || ttsState.suppressEnd) {
        ttsState.suppressEnd = false;
        return;
      }
      // Если ошибка — стопаем чисто, без infinite loop
      console.warn('[gbx-tts] chunk error:', (e && e.error) || e);
      if (ttsState.engine === 'vosk') reportTtsIssue('chunk_playback: ' + ((e && (e.error || e.message)) || e));
      ttsState.utterance = null;
      setEmberState('idle');
    }

    if (ttsState.engine === 'vosk' && window.VoskTTSEngine) {
      ttsState.utterance = window.VoskTTSEngine.speak(chunk, getStoredRate(), VOSK_SPEAKER_ID, onChunkEnd, onChunkError);
      return;
    }

    var u = new SpeechSynthesisUtterance(chunk);
    u.rate = getStoredRate();
    u.lang = 'ru-RU';
    if (!ttsState.voice) ttsState.voice = pickRuVoice();
    if (ttsState.voice) u.voice = ttsState.voice;
    u.onboundary = function (ev) {
      // Continuous ring: without this the ring only advanced on chunk ends
      // (~every 200 chars), which on a long article reads as "no progress".
      // Vosk plays pre-rendered <audio>, so this only applies to Web Speech.
      if (runId !== ttsState.runId || ttsState.paused) return;
      if (ev && typeof ev.charIndex === 'number' && ttsState.totalChars) {
        var done = ttsState.spokenChars + Math.min(ev.charIndex, chunk.length);
        var pctNow = Math.min(1, done / ttsState.totalChars);
        qsa('.gb-ember').forEach(function (btn) { btn.style.setProperty('--p', String(pctNow)); });
        followReading(done);
      }
    };
    u.onend = onChunkEnd;
    u.onerror = onChunkError;
    ttsState.utterance = u;
    window.speechSynthesis.speak(u);
  }

  function startTts() {
    if (!ttsAvailable()) {
      showToast('Браузер не поддерживает озвучку', false);
      return;
    }
    var text = getArticleText();
    if (!text || text.length < 20) {
      showToast('Текст статьи не найден', false);
      return;
    }
    ttsState.runId += 1;
    var myRun = ttsState.runId;
    ttsState.suppressEnd = false;
    cancelActiveEngine();
    ttsState.text = text;
    ttsState.chunks = splitTtsChunks(text);
    ttsState.chunkIdx = 0;
    ttsState.totalChars = text.length;
    ttsState.spokenChars = 0;
    ttsState.paused = false;
    ttsState.utterance = null;
    ttsState.engine = null;
    resolveTtsEngine().then(function (engine) {
      if (myRun !== ttsState.runId) return; // stopped/replayed/navigated while we waited
      if (!engine) { showToast('Не удалось запустить озвучку', false); setEmberState('idle'); return; }
      ttsState.engine = engine;
      reportTtsOutcome(engine);
      // Пауза, нажатая пока мы ждали загрузку движка, не бампает runId (иначе
      // resumeTts() не смог бы отличить "продолжить с текущего chunk" от
      // "это устаревший запуск"), поэтому проверяем paused отдельно: инженю
      // фиксируем, но воспроизведение не стартуем — resumeTts() подхватит.
      if (ttsState.paused) return;
      setEmberState('playing');
      buildFollowMap();
      bindFollowSuspend();
      followState.active = true;
      followState.suspendUntil = 0;
      mediaSessionMeta();
      mediaSessionSet('playing');
      speakNextChunk();
    });
  }

  function pauseTts() {
    if (!ttsAvailable()) return;
    // Cancel-based pause (no real pause/resume in either engine).
    // Mark paused/suppress BEFORE cancel: some engines synchronously fire onend.
    ttsState.paused = true;
    ttsState.suppressEnd = true;
    cancelActiveEngine();
    ttsState.utterance = null;
    followState.active = false;
    mediaSessionSet('paused');
    setEmberState('paused');
  }

  function resumeTts() {
    if (!ttsAvailable()) return;
    ttsState.paused = false;
    ttsState.suppressEnd = false;
    ttsState.runId += 1;
    followState.active = true;
    followState.suspendUntil = 0;
    mediaSessionSet('playing');
    setEmberState('playing');
    // Restart from saved chunk position (neither engine supports real resume)
    speakNextChunk();
  }

  function stopTts() {
    if (!ttsAvailable()) return;
    cancelScheduledVoskWarmup();
    ttsState.runId += 1;
    ttsState.suppressEnd = true;
    cancelActiveEngine();
    ttsState.paused = false;
    ttsState.utterance = null;
    ttsState.chunkIdx = 0;
    ttsState.spokenChars = 0;
    ttsState.engine = null;
    followState.active = false;
    mediaSessionSet('none');
    setEmberState('idle');
    qsa('.gb-ember').forEach(function (btn) { btn.style.setProperty('--p', '0'); });
  }

  /* =====================================================
     MEDIA SESSION — фоновая озвучка с системными контролами.
     Просьба владельца: PLAY должен жить при свёрнутой вкладке/выключенном
     экране, с красивой обложкой в шторке/на локскрине.

     Как это работает:
     - Web Speech в фоновой вкладке троттлится браузером; чтобы вкладка
       считалась «звучащей» (и не засыпала), на время озвучки играет
       ЯКОРЬ — крошечный зацикленный WAV чистой цифровой тишины
       (blob:, т.к. CSP страниц разрешает media-src 'self' blob:).
       Он же даёт браузеру право показать медиа-уведомление.
     - navigator.mediaSession получает метаданные страницы (заголовок,
       серия, обложка og:image + фирменный SVG /images/tts-artwork.svg)
       и обработчики: play/pause/stop + перемотка по chunk'ам (±).
     - Vosk-ветка играет реальные <audio> — якорь ей не мешает
       (тишина), а метаданные/обработчики те же.
     Закрытая вкладка озвучку не переживает — это предел веб-платформы
     (нужен бы серверный аудиофайл + SW; текст синтезируется на клиенте).
     ===================================================== */
  var msAnchor = null;

  function silentWavUrl() {
    // 0.4с тишины, mono 8kHz 16bit — 6.4KB нулей; собирается на лету.
    var samples = 3200, data = 44 + samples * 2;
    var buf = new ArrayBuffer(data), v = new DataView(buf);
    function str(off, s) { for (var i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, data - 8, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
    v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, samples * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  function ensureAnchor() {
    if (msAnchor) return msAnchor;
    try {
      msAnchor = document.createElement('audio');
      msAnchor.src = silentWavUrl();
      msAnchor.loop = true;
      msAnchor.volume = 0.01; // не muted: muted-аудио не удерживает вкладку «звучащей»
      msAnchor.setAttribute('playsinline', '');
      msAnchor.style.display = 'none';
      document.body.appendChild(msAnchor);
    } catch (_) { msAnchor = null; }
    return msAnchor;
  }

  function skipChunk(delta) {
    if (!ttsState.chunks.length) return;
    var next = Math.max(0, Math.min(ttsState.chunks.length - 1, ttsState.chunkIdx + delta));
    ttsState.runId += 1;
    ttsState.suppressEnd = true;
    cancelActiveEngine();
    ttsState.utterance = null;
    ttsState.chunkIdx = next;
    var spoken = 0;
    for (var i = 0; i < next; i++) spoken += ttsState.chunks[i].length;
    ttsState.spokenChars = spoken;
    updateProgress();
    if (!ttsState.paused) { ttsState.suppressEnd = false; speakNextChunk(); }
  }

  function mediaSessionMeta() {
    if (!('mediaSession' in navigator)) return;
    try {
      var h1 = qs('article h1, main h1, h1');
      var title = (h1 && h1.textContent.trim()) || document.title;
      var seriesLab = qs('.gbs-rail .gbs-series-title, .toc-head-txt .lab');
      var album = (seriesLab && seriesLab.textContent.trim()) || 'Господь Бог — Сила Моя';
      var art = [{ src: '/images/tts-artwork.svg', sizes: 'any', type: 'image/svg+xml' }];
      var og = qs('meta[property="og:image"]');
      if (og && og.content) art.unshift({ src: og.content, sizes: '1200x630', type: 'image/webp' });
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title, artist: 'Господь Бог — Сила Моя', album: album, artwork: art,
      });
      navigator.mediaSession.setActionHandler('play', function () { handlePlayClick(null); });
      navigator.mediaSession.setActionHandler('pause', function () { pauseTts(); mediaSessionSet('paused'); });
      navigator.mediaSession.setActionHandler('stop', function () { stopTts(); });
      navigator.mediaSession.setActionHandler('seekbackward', function () { skipChunk(-1); });
      navigator.mediaSession.setActionHandler('seekforward', function () { skipChunk(1); });
    } catch (_) {}
  }

  function mediaSessionSet(state) {
    var a = state === 'playing' ? ensureAnchor() : msAnchor;
    if (a) {
      if (state === 'playing') { try { a.play().catch(function () {}); } catch (_) {} }
      else { try { a.pause(); } catch (_) {} }
    }
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = state === 'none' ? 'none' : state; } catch (_) {}
    }
  }

  // Применяем новую скорость на лету при выборе из Speed panel
  addCleanListener(window, 'gb:tts-rate-change', function (ev) {
    if (!ttsAvailable()) return;
    if (!ttsState.utterance || ttsState.chunkIdx >= ttsState.chunks.length) return;
    // Останавливаем текущий chunk и перестартуем с того же места.
    // Guard against cancel() firing onend and double-advancing the queue.
    ttsState.runId += 1;
    ttsState.suppressEnd = true;
    cancelActiveEngine();
    ttsState.utterance = null;
    if (!ttsState.paused) {
      ttsState.suppressEnd = false;
      speakNextChunk();
    }
  });

  function currentTtsUiState(clickedEmber) {
    // ttsState is the single source of truth. The clicked ember is only a
    // fallback for external engines / initial SSR state; never read an arbitrary
    // first `.gb-ember`, because Gill v16 renders desktop + mobile embers.
    if (ttsState.paused) return 'paused';
    if (ttsState.utterance) return 'playing';
    if (clickedEmber && clickedEmber.dataset && clickedEmber.dataset.state === 'complete') return 'complete';
    return clickedEmber && clickedEmber.dataset ? (clickedEmber.dataset.state || 'idle') : 'idle';
  }

  function handlePlayClick(clickedEmber) {
    var state = currentTtsUiState(clickedEmber);

    // Внешний движок имеет приоритет
    if (window.GBAudio && typeof window.GBAudio.toggle === 'function') {
      window.GBAudio.toggle();
      return;
    }

    // Vosk TTS (нейросеть) с автооткатом на Web Speech API
    if (ttsAvailable()) {
      if (state === 'playing')      { pauseTts();  return; }
      if (state === 'paused')       { resumeTts(); return; }
      if (state === 'complete')     { stopTts(); startTts(); return; }
      /* idle/none */                 startTts();
      return;
    }

    // Нет TTS вообще
    showToast('Браузер не поддерживает озвучку', false);
  }

  /* =====================================================
     TOAST
     gb-fc-toast — отдельный элемент, не конфликтует с bookmark toast
     ===================================================== */
  function getToast() {
    var el = qs('.gb-fc-toast');
    if (el) return el;

    el = document.createElement('div');
    el.className = 'gb-fc-toast';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>' +
      '<span></span>';
    document.body.appendChild(el);
    return el;
  }

  function showToast(message, showCheck) {
    var toast = getToast();
    var svg = toast.querySelector('svg');
    var span = toast.querySelector('span');
    if (span) span.textContent = message;
    if (svg) svg.style.display = showCheck ? '' : 'none';
    toast.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-open');
    }, 2200);
  }

  /* =====================================================
     SCROLL TO TOP
     Делегирует на SiteUtils если доступен.
     ===================================================== */
  function scrollTop() {
    var utils = window.SiteUtils;
    if (utils && typeof utils.scrollToTop === 'function') {
      utils.scrollToTop();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /* =====================================================
     FONT SIZE
     ===================================================== */
  var FONT_SCALE_KEY = 'gb:font-scale';
  var fontScale = (function() {
    try {
      var prefs = window.GBReaderPreferences && window.GBReaderPreferences.get();
      var s = prefs ? parseFloat(prefs.fontScale) : parseFloat(localStorage.getItem(FONT_SCALE_KEY));
      return (!isNaN(s) && s >= 0.85 && s <= 1.25) ? s : 1;
    } catch (_) { return 1; }
  })();
  function applyFontScale() {
    var article = qs('article.article-body') || qs('.article-main') || qs('main');
    if (article) article.style.fontSize = fontScale === 1 ? '' : (fontScale * 100) + '%';
  }
  function changeFontSize(direction) {
    fontScale = Math.max(0.85, Math.min(1.25, Math.round((fontScale + direction * 0.05) * 100) / 100));
    if (window.GBReaderPreferences && typeof window.GBReaderPreferences.set === 'function') {
      window.GBReaderPreferences.set({ fontScale: fontScale }, { source: 'floating-cluster' });
    } else {
      try { localStorage.setItem(FONT_SCALE_KEY, String(fontScale)); } catch (_) {}
    }
    applyFontScale();
  }

  /* =====================================================
     KEYBOARD SHORTCUTS (аналог референса)
     Opt-in: активируется только если на <body> или любом [data-fc-root]
     есть data-fc-shortcuts="true" (или data-gb-shortcuts="true" — legacy alias).
     Без opt-in — глобальные D/S/T/B НЕ перехватываются.
     ===================================================== */
  function shortcutsEnabled() {
    if (document.body && (document.body.getAttribute('data-fc-shortcuts') === 'true' ||
                          document.body.getAttribute('data-gb-shortcuts') === 'true')) {
      return true;
    }
    var roots = qsa('[data-fc-root]');
    for (var i = 0; i < roots.length; i++) {
      var r = roots[i];
      if (r.getAttribute('data-fc-shortcuts') === 'true' ||
          r.getAttribute('data-gb-shortcuts') === 'true') {
        return true;
      }
    }
    return false;
  }

  function initKeyboard() {
    if (!shortcutsEnabled()) return;
    addCleanListener(document, 'keydown', function (e) {
      var isInput = e.target.matches('input, textarea, select, [contenteditable]');
      if (isInput) return;

      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); toggleTheme(); }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); saveCurrent(); }
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); handlePlayClick(); }
      if (e.key === 'b' || e.key === 'B') { e.preventDefault(); scrollTop(); }
    });
  }

  /* =====================================================
     BODY CLASS — gb-cluster-single-active для скрытия дублей
     ===================================================== */
  function activateSinglePilot() {
    document.body.classList.add('gb-cluster-single-active');
  }

  function activateSeriesPilot() {
    document.body.classList.add('gb-cluster-series-active');
  }

  /* =====================================================
     CLICK DELEGATION
     Один обработчик на весь кластер.
     ===================================================== */
  function dispatchClusterAction(action, btn) {
    if (action === 'theme')     { toggleTheme(); }
    else if (action === 'search')    { openSearch(btn); }
    else if (action === 'play')      { handlePlayClick(btn); }
    else if (action === 'stop')      { stopTts(); }
    else if (action === 'save')      { saveCurrent(btn); }
    else if (action === 'scroll-top'){ scrollTop(); }
    else if (action === 'font-up')   { changeFontSize(1); }
    else if (action === 'font-down') { changeFontSize(-1); }
  }

  function initCluster(root) {
    if (root._gbClusterInit) return; // P1-8: prevent double init
    root._gbClusterInit = true;
    addCleanListener(root, 'click', function (e) {
      // Также обрабатываем GBS2-style theme buttons (data-gbs2-theme)
      if (e.target.closest('[data-gbs2-theme]')) { toggleTheme(); return; }
      if (e.target.closest('[data-gbs2-search]')) { openSearch(e.target.closest('[data-gbs2-search]')); return; }
      var btn = e.target.closest('[data-fc-action]');
      if (!btn) return;
      dispatchClusterAction(btn.getAttribute('data-fc-action'), btn);
    });
  }

  /* =====================================================
     GILL RAIL CONTROLS
     Инициализирует floating-cluster controls в gbs2-rail
     ===================================================== */
  function initGillRail() {
    // FIX (PremiumControls clickability): Gill pages render TWO
    // [data-fc-controls="gill-rail"] containers (desktop rail + mobile bottom
    // bar). Previous qs() grabbed only the first (the hidden one), so the
    // VISIBLE desktop rail theme/search buttons stayed unwired and did not
    // respond to clicks. Per rollout-plan runtime contract #1 ("init every
    // root"), iterate ALL gill-rail containers.
    var railControlsAll = qsa('[data-fc-controls="gill-rail"]');
    if (!railControlsAll.length) return;
    railControlsAll.forEach(function (rail) { initCluster(rail); });
    // Wire gbs2 theme/search buttons that exist outside fc-controls scope
    var gbs2ThemeBtns = qsa('[data-gbs2-theme]');
    gbs2ThemeBtns.forEach(function(btn) {
      addCleanListener(btn, 'click', toggleTheme);
    });
    var gbs2SearchBtns = qsa('[data-gbs2-search]');
    gbs2SearchBtns.forEach(function(btn) {
      addCleanListener(btn, 'click', function() { openSearch(btn); });
    });
    // Expose public API for pages that use gill-rail without data-fc-root
    if (!window.__gbCluster) {
      window.__gbCluster = {
        setTheme: setTheme, toggleTheme: toggleTheme,
        setSaved: setSaved, setEmberState: setEmberState,
        showToast: showToast, openSearch: openSearch,
      };
    }
  }

  /* =====================================================
     SCALABLE SERIES-RAIL (Gill) — TOC-disclosure / demand-scroll
     Desktop-only chrome (rail is display:none <64em). Additive: wires the
     controls on GillSeriesRail.astro. No new framework, uses the same
     qs/qsa/addCleanListener helpers as the rest of the file.
       #gbsTocToggle    → toggle .toc-collapsed on .gbs2-current
                          (persist gb:rail:toc-collapsed)
       .gbs2-rmid       → .is-scrolling while scrolling (fade the scrollbar)
                        + auto-centre the current-part card on load
     (The narrow-spine rail-collapse mode — .rail-narrow, #gbsRailCollapse,
     .gbs-rail-spine — was removed per owner: unclear purpose, not worth
     the complexity.) */
  function initGillRailScalable() {
    var world = qs('.gbs2-world[data-gill-v16]');
    if (!world) return;
    var rail = qs('.gbs-rail', world);
    if (!rail) return;

    var TOC_KEY = 'gb:rail:toc-collapsed';

    var tocToggle = qs('#gbsTocToggle');
    var current = qs('.gbs2-current', rail);
    var rmid = qs('.gbs2-rmid', rail);

    function readFlag(key) {
      try { return localStorage.getItem(key) === '1'; } catch (_) { return false; }
    }
    function writeFlag(key, on) {
      try { localStorage.setItem(key, on ? '1' : '0'); } catch (_) {}
    }

    function applyTocCollapsed(on) {
      if (current) current.classList.toggle('toc-collapsed', on);
      if (tocToggle) {
        tocToggle.setAttribute('aria-expanded', on ? 'false' : 'true');
        tocToggle.setAttribute('aria-label', on ? 'Развернуть оглавление части' : 'Свернуть оглавление части');
      }
    }

    // Apply persisted state with transitions suppressed for one frame (no
    // height-jump animation on first paint), then release the guard.
    var tocCollapsed = readFlag(TOC_KEY);
    world.classList.add('no-anim');
    applyTocCollapsed(tocCollapsed);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { world.classList.remove('no-anim'); });
    });

    if (tocToggle) {
      addCleanListener(tocToggle, 'click', function () {
        tocCollapsed = !tocCollapsed;
        applyTocCollapsed(tocCollapsed);
        writeFlag(TOC_KEY, tocCollapsed);
      });
    }

    if (rmid) {
      // Auto-centre the current-part card within the (possibly scrolling) rich
      // column on load — only if the column actually overflows. Adjusts only
      // rmid.scrollTop via rects, so the page/window never jumps.
      if (current) {
        requestAnimationFrame(function () {
          if (rmid.clientHeight > 0 && rmid.scrollHeight > rmid.clientHeight + 4) {
            var mRect = rmid.getBoundingClientRect();
            var cRect = current.getBoundingClientRect();
            var delta = (cRect.top - mRect.top) - (mRect.height - cRect.height) / 2;
            rmid.scrollTop += delta;
          }
        });
      }

      // Fade the premium scrollbar in while scrolling, out shortly after.
      var scrollTimer = null;
      addCleanListener(rmid, 'scroll', function () {
        rmid.classList.add('is-scrolling');
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function () { rmid.classList.remove('is-scrolling'); }, 900);
      }, { passive: true });
    }
  }

  /* =====================================================
     SYNC SAVE STATE
     Читает BookmarkEngine при старте.
     ===================================================== */
  function syncSaveState() {
    var path = normalizePath(location.pathname);
    var saved = isFavorite(path);
    // Backward compatibility: older floating-cluster builds used fc:saved:<path>.
    // Do not depend on BookmarkEngine here: PremiumControls Favorites are stored
    // in gb-favorites, while BookmarkEngine is reading-position infrastructure.
    try { saved = saved || !!localStorage.getItem('fc:saved:' + path); } catch (_) {}
    setSaved(saved);
  }


  /* =====================================================
     MOBILE FALLBACK CONTROLS
     Some series-rich/GBS2 families keep their canonical controls in the
     desktop rail (`.gbs2-rail` / nagornaya sidebar). On mobile that rail is
     display:none, so the existing Play/Save DOM is correctly scoped but becomes
     0×0 and untappable. Create one mobile-only clone before PlayEmber wrapping
     so initPlayExpand/initCluster wire it like a normal PremiumControls root.
     ===================================================== */
  function hasVisibleEmber() {
    return qsa('.gb-ember').some(function (el) {
      var rect = el.getBoundingClientRect();
      return rect.width >= 30 && rect.height >= 30 &&
             window.getComputedStyle(el).visibility !== 'hidden' &&
             window.getComputedStyle(el).display !== 'none';
    });
  }

  function stripIds(root) {
    qsa('[id]', root).forEach(function (el) { el.removeAttribute('id'); });
  }

  function ensureMobileFallbackControls() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 899px)').matches) return;
    if (qs('.gb-mobile-fallback-controls')) return;
    if (hasVisibleEmber()) return;

    var source = qs('[data-fc-root] .gb-ember') || qs('[data-fc-controls] .gb-ember');
    if (!source) return;
    var sourceRoot = source.closest('[data-fc-root], [data-fc-controls]');
    if (!sourceRoot) return;

    var clone = sourceRoot.cloneNode(true);
    stripIds(clone);
    clone.classList.add('gb-mobile-fallback-controls');
    clone.setAttribute('data-fc-mobile-fallback', 'true');
    clone.setAttribute('aria-label', 'Быстрые действия чтения');
    document.body.appendChild(clone);
  }

  /* =====================================================
     MAIN INIT
     ===================================================== */
  ready(function () {
    // 0. Global delegated listeners for GBS2-style controls (works regardless of DOM hierarchy)
    addCleanListener(document, 'click', function(e) {
      if (e.target.closest('[data-gbs2-theme]')) { e.stopPropagation(); toggleTheme(); }
      if (e.target.closest('[data-gbs2-search]')) { e.stopPropagation(); openSearch(e.target.closest('[data-gbs2-search]')); }

      // Gill TOC overlays are siblings of .mobile-bottom-bar, so their
      // data-fc-action buttons are outside every [data-fc-root]/[data-fc-controls]
      // delegated cluster. Keep the canonical action semantics for those
      // out-of-cluster buttons without double-handling in normal clusters.
      var fcBtn = e.target.closest('[data-fc-action]');
      if (fcBtn && !fcBtn.closest('[data-fc-root], [data-fc-controls]')) {
        dispatchClusterAction(fcBtn.getAttribute('data-fc-action'), fcBtn);
      }
    }, true);  // capture phase — fires before any stopPropagation

    // 1. Inject SVG в ember кнопки (если SSR не вставил)
    initEmbers();
    initTocPopups();
    initActionHandlers();
    ensureMobileFallbackControls();
    initPlayExpand();
    initCustomSlotLongPressStop();
    initGillInlineSpeedRail();

    // 2. Gill rail / non-root cluster controls (работают без data-fc-root)
    initGillRail();
    initGillRailScalable();

    // 2b. GBS2 controls — Баптисты России series UI
    initGbs2Controls();

    // 3. Sync + keyboard + ARIA — run ALWAYS, even on pages without data-fc-root
    //    (Fix R6: early return at line 582 skipped these on gill-rail-only pages)
    syncThemeButtons();
    syncSaveState();
    if (fontScale !== 1) applyFontScale(); // restore persisted font scale
    initKeyboard();

    // Ember ARIA labels
    qsa('.gb-ember').forEach(function (ember) {
      var state = ember.dataset.state || 'idle';
      updateEmberAriaLabel(state);
    });

    // 4. Инициализировать корни с data-fc-root (pilot activation)
    var roots = qsa('[data-fc-root]');
    roots.forEach(function(root) {
      var mode = root.getAttribute('data-fc-mode') || 'single';
      if (mode === 'single') activateSinglePilot();
      if (mode === 'series-lite') activateSeriesPilot();
      if (mode === 'nagornaya') activateSinglePilot();
      if (mode === 'series-rich') activateSeriesPilot();
      initCluster(root);
    });

    // 9. Публичный API (для отладки и интеграций)
    window.__gbCluster = {
      setTheme: setTheme,
      toggleTheme: toggleTheme,
      setSaved: setSaved,
      setEmberState: setEmberState,
      showToast: showToast,
      openSearch: openSearch,
    };
  });


  /* =====================================================
     v16 TOC POPUPS — Series & Part sheets
     ===================================================== */
  function enhanceGillMobileBarMarkup() {
    var bar = qs('.mobile-bottom-bar[data-fc-variant="gill"]');
    if (!bar) return;

    // This is a legacy shim: it upgrades the OLD one-level static root bar
    //   (button#mobTocBtn + div#gbs2MobSec + progress + pct + icon row)
    // to an intermediate structure. The v4 reference bar (GillSeriesMobileBar
    // .astro) already ships the final structure — a section button with
    // .mobile-btoc-section__label ("Сейчас читаете") + __main — and must NOT
    // be touched, or the shim grafts an extra unstyled "Оглавление части"
    // __sub line onto it (real regression caught 2026-07-08). Detect the new
    // markup by its label span and bail; the shim only exists for un-resynced
    // legacy root HTML, which never has that span.
    if (qs('.mobile-btoc-section__label')) return;

    bar.setAttribute('data-gill-mobile-bar', '');

    var tocBtn = qs('#mobTocBtn');
    if (tocBtn) {
      tocBtn.setAttribute('type', 'button');
      tocBtn.setAttribute('aria-label', 'Содержание серии');
      if (!tocBtn.querySelector('.mobile-toc-btn__label')) {
        var tocLabel = document.createElement('span');
        tocLabel.className = 'mobile-toc-btn__label';
        tocLabel.textContent = 'Серия';
        tocBtn.appendChild(tocLabel);
      }
    }

    var partBtn = qs('#mobPartTocBtn');
    var oldSection = qs('#gbs2MobSec');
    if (!partBtn && oldSection) {
      partBtn = document.createElement('button');
      partBtn.type = 'button';
      partBtn.className = 'mobile-btoc-section';
      partBtn.id = 'mobPartTocBtn';
      var sectionText = (oldSection.textContent || 'Оглавление части').replace(/\s+/g, ' ').trim();
      partBtn.setAttribute('aria-label', 'Оглавление текущей части: ' + sectionText);

      var main = document.createElement('span');
      main.className = 'mobile-btoc-section__main';
      main.id = 'gbs2MobSec';
      main.textContent = sectionText;

      var sub = document.createElement('span');
      sub.className = 'mobile-btoc-section__sub';
      sub.textContent = 'Оглавление части';

      partBtn.appendChild(main);
      partBtn.appendChild(sub);
      oldSection.parentNode.replaceChild(partBtn, oldSection);
    } else if (partBtn) {
      partBtn.setAttribute('type', 'button');
      if (!partBtn.querySelector('.mobile-btoc-section__sub')) {
        var partSub = document.createElement('span');
        partSub.className = 'mobile-btoc-section__sub';
        partSub.textContent = 'Оглавление части';
        partBtn.appendChild(partSub);
      }
    }

    var iconRow = bar.querySelector('.mobile-icon-row');
    var meter = bar.querySelector('.mobile-btoc-meter');
    if (!meter) {
      var track = bar.querySelector('.mobile-btoc-progress-track');
      var pct = bar.querySelector('#gbs2MobPct');
      if (track && pct) {
        meter = document.createElement('div');
        meter.className = 'mobile-btoc-meter';
        meter.setAttribute('aria-hidden', 'true');
        bar.insertBefore(meter, iconRow || null);
        meter.appendChild(track);
        meter.appendChild(pct);
      }
    }
  }

  function initTocPopups() {
    enhanceGillMobileBarMarkup();
    var seriesToc = qs('#seriesTocOverlay');
    var partToc = qs('#partTocOverlay');
    var mobTocBtn = qs('#mobTocBtn');
    var mobPartTocBtn = qs('#mobPartTocBtn');
    var backToSeries = qs('#backToSeries');

    [seriesToc, partToc].forEach(function(overlay) {
      if (!overlay) return; // ← guard added
      if (!overlay.classList.contains('is-open')) overlay.setAttribute('aria-hidden', 'true');
      var dialog = overlay.querySelector('.toc-sheet');
      if (dialog) dialog.setAttribute('aria-modal', 'true');
    });

    var GILL_OVERLAY_OWNERS = {
      seriesTocOverlay: 'gill-series-toc',
      partTocOverlay: 'gill-part-toc',
      gillLearningOverlay: 'gill-learning',
      gillSettingsOverlay: 'gill-settings'
    };

    function getOverlayRuntime() {
      return window.OverlayRuntime || null;
    }

    function gillOverlayOwner(el) {
      if (!el) return 'gill-overlay';
      return GILL_OVERLAY_OWNERS[el.id] || ('gill-overlay-' + (el.id || 'sheet'));
    }

    function syncGillOverlayClass() {
      var open = qs('.toc-overlay.is-open, .gill-settings-overlay.is-open');
      document.documentElement.classList.toggle('gb-gill-toc-open', Boolean(open));
    }

    function openOverlay(el, opener, options) {
      if (!el) return;
      options = options || {};
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
      syncGillOverlayClass();
      var owner = gillOverlayOwner(el);
      var runtime = getOverlayRuntime();
      if (runtime && typeof runtime.open === 'function') {
        runtime.open(owner, {
          element: el,
          opener: opener || document.activeElement,
          focusTarget: options.focusTarget || null,
          onRequestClose: options.onRequestClose || function(reason) { closeOverlay(el, reason, true); },
          closeOnEscape: true,
          trapFocus: options.trapFocus !== false,
          lockScroll: true
        });
      } else {
        var utils = window.SiteUtils;
        if (utils && typeof utils.lockScroll === 'function') utils.lockScroll(owner);
      }
      try { document.dispatchEvent(new CustomEvent('gb:gill-sheet-open')); } catch (_) {}
    }

    function closeOverlay(el, reason, restoreFocus) {
      if (!el) return;
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      var owner = gillOverlayOwner(el);
      var runtime = getOverlayRuntime();
      if (runtime && typeof runtime.close === 'function') {
        runtime.close(owner, reason || 'programmatic', { restoreFocus: restoreFocus !== false });
      } else {
        var utils = window.SiteUtils;
        if (utils && typeof utils.unlockScroll === 'function') utils.unlockScroll(owner);
      }
      syncGillOverlayClass();
    }

    // Mobile TOC button opens series
    if (mobTocBtn && seriesToc) {
      addCleanListener(mobTocBtn, 'click', function(e) { e.preventDefault(); closeOverlay(partToc, 'switch', false); openOverlay(seriesToc, e.currentTarget); });
    }

    // Explicit mobile Part TOC button opens the current article/part submenu.
    if (mobPartTocBtn && partToc) {
      addCleanListener(mobPartTocBtn, 'click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeOverlay(seriesToc, 'switch', false);
        openOverlay(partToc, e.currentTarget);
      });
    }

    // Hardening against a stuck-open sheet rendering with the WRONG (mobile
    // vs desktop) chrome after a viewport crossing (window resize/rotate
    // while a sheet is open, or devtools panel toggling layout): close every
    // Gill sheet on breakpoint cross. Cheap and universal — protects every
    // series (Gill/Сердце/Баптисты/pastor) and every future one, not just
    // the two overlays audited today.
    var deskMq = window.matchMedia && window.matchMedia('(min-width:64em)');
    if (deskMq && deskMq.addEventListener) {
      deskMq.addEventListener('change', function () {
        qsa('.toc-overlay.is-open, .gill-settings-overlay.is-open').forEach(function (ov) {
          closeOverlay(ov, 'breakpoint', false);
        });
        qsa('[aria-expanded="true"][data-gill-settings-open], #mobLearningBtn[aria-expanded="true"]')
          .forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
      });
    }

    // Back button in Part TOC → Series TOC
    if (backToSeries && seriesToc && partToc) {
      addCleanListener(backToSeries, 'click', function() {
        closeOverlay(partToc, 'switch', false);
        openOverlay(seriesToc, mobTocBtn || mobPartTocBtn);
      });
    }

    // Click on current series item → open Part TOC; non-current items navigate.
    if (seriesToc) {
      addCleanListener(seriesToc, 'click', function(e) {
        var item = e.target.closest('.toc-item');
        if (!item) return;
        if (item.classList.contains('is-current') && partToc) {
          e.preventDefault();
          e.stopPropagation();
          closeOverlay(seriesToc, 'switch', false);
          openOverlay(partToc, mobTocBtn || mobPartTocBtn);
          return;
        }
        // Non-current items are regular links — let them navigate
      });
    }

    // Close overlay on backdrop click
    [seriesToc, partToc].forEach(function(overlay) {
      if (!overlay) return;
      addCleanListener(overlay, 'click', function(e) {
        if (e.target === overlay) closeOverlay(overlay, 'backdrop', true);
      });
      // Close on handle tap/click (simple version)
      var handle = overlay.querySelector('.toc-sheet__handle');
      if (handle) {
        addCleanListener(handle, 'click', function() { closeOverlay(overlay, 'handle', true); });
      }
    });

    // OverlayRuntime owns Escape globally; fallback keeps legacy pages usable.
    addCleanListener(document, 'keydown', function(e) {
      if (getOverlayRuntime() || e.key !== 'Escape') return;
      if (partToc && partToc.classList.contains('is-open')) closeOverlay(partToc, 'escape', true);
      else if (seriesToc && seriesToc.classList.contains('is-open')) closeOverlay(seriesToc, 'escape', true);
    });

    // Gill v16 mobile bottom-bar dual-progress ring (article % + series %)
    // is driven centrally by updateScrollProgress() below — no separate
    // listener needed here (avoids two writers racing on the same nodes).

    // ── Learning & Settings sheets (Gill mobile v5) ──────────────────────
    // Additive: only present on routes that ship GillLearningSheet.astro /
    // GillReaderSettingsSheet.astro (the 6 Gill mobile routes). Reuses the
    // same openOverlay/closeOverlay primitives as series/part above, so
    // Hermenevtika/GillContext (which use .toc-overlay for OTHER ids) are
    // completely unaffected — these selectors simply don't match there.
    var learningOverlay = qs('#gillLearningOverlay');
    var settingsOverlay = qs('#gillSettingsOverlay');
    var mobLearningBtn = qs('#mobLearningBtn');
    // Settings sheet can now have TWO triggers (mobile bottom-bar gear +
    // desktop rail-foot gear) — both carry [data-gill-settings-open], so we
    // bind every match instead of a single #mobSettingsBtn id. Opening/closing
    // syncs aria-expanded on ALL triggers at once (only one is visible at a
    // given viewport width, but keeping both in sync is free and correct).
    var settingsBtns = qsa('[data-gill-settings-open]');
    var extraOverlays = [learningOverlay, settingsOverlay].filter(function(el) { return !!el; });

    extraOverlays.forEach(function(overlay) {
      if (!overlay.classList.contains('is-open')) overlay.setAttribute('aria-hidden', 'true');
      var dialog = overlay.querySelector('.toc-sheet');
      if (dialog) dialog.setAttribute('aria-modal', 'true');
    });

    function triggersFor(overlay) {
      if (overlay === learningOverlay) return mobLearningBtn ? [mobLearningBtn] : [];
      if (overlay === settingsOverlay) return settingsBtns;
      return [];
    }
    function openGillSheet(overlay, triggers, opener) {
      if (!overlay) return;
      var focusable = overlay.querySelector('input, button:not([data-overlay-close]):not(.toc-sheet__handle)');
      openOverlay(overlay, opener || (triggers && triggers[0]), {
        focusTarget: focusable,
        onRequestClose: function(reason) { closeGillSheet(overlay, true, reason); }
      });
      (triggers || []).forEach(function(t) { t.setAttribute('aria-expanded', 'true'); });
      if (!getOverlayRuntime() && focusable) setTimeout(function() { try { focusable.focus(); } catch(_) {} }, 20);
    }
    function closeGillSheet(overlay, restoreFocus, reason) {
      if (!overlay) return;
      var triggers = triggersFor(overlay);
      closeOverlay(overlay, reason || 'programmatic', restoreFocus !== false);
      triggers.forEach(function(t) { t.setAttribute('aria-expanded', 'false'); });
      if (!getOverlayRuntime() && restoreFocus && triggers[0] && triggers[0].focus) { try { triggers[0].focus(); } catch(_) {} }
    }

    if (mobLearningBtn && learningOverlay) {
      addCleanListener(mobLearningBtn, 'click', function(e) {
        e.preventDefault();
        closeGillSheet(settingsOverlay, false, 'switch');
        openGillSheet(learningOverlay, [mobLearningBtn], e.currentTarget);
      });
    }
    if (settingsBtns.length && settingsOverlay) {
      settingsBtns.forEach(function(btn) {
        addCleanListener(btn, 'click', function(e) {
          e.preventDefault();
          closeGillSheet(learningOverlay, false, 'switch');
          openGillSheet(settingsOverlay, settingsBtns, e.currentTarget);
        });
      });
    }

    extraOverlays.forEach(function(overlay) {
      addCleanListener(overlay, 'click', function(e) {
        // Only a direct hit on the backdrop closes — clicks inside the
        // sheet must never bubble-close it (owner: A-/A+ etc. stay open).
        if (e.target === overlay) closeGillSheet(overlay, true, 'backdrop');
      });
      var handle = overlay.querySelector('.toc-sheet__handle');
      if (handle) addCleanListener(handle, 'click', function() { closeGillSheet(overlay, true, 'handle'); });
      overlay.querySelectorAll('[data-overlay-close]').forEach(function(btn) {
        addCleanListener(btn, 'click', function() { closeGillSheet(overlay, true, 'button'); });
      });
      // Focus trap while this sheet is open.
      addCleanListener(overlay, 'keydown', function(e) {
        if (getOverlayRuntime() || e.key !== 'Tab' || !overlay.classList.contains('is-open')) return;
        var focusable = Array.prototype.slice.call(
          overlay.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')
        ).filter(function(el) { return el.offsetParent !== null; });
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    });

    if (extraOverlays.length) {
      addCleanListener(document, 'keydown', function(e) {
        if (getOverlayRuntime() || e.key !== 'Escape') return;
        if (settingsOverlay && settingsOverlay.classList.contains('is-open')) closeGillSheet(settingsOverlay, true, 'escape');
        else if (learningOverlay && learningOverlay.classList.contains('is-open')) closeGillSheet(learningOverlay, true, 'escape');
      });
    }
  }

  /* v16 action handlers (non-inline) */
  function initActionHandlers() {
    // Rail back button
    var back = qs('.gbs-rail-back');
    if (back) {
      var href = back.closest('[data-home-href]');
      addCleanListener(back, 'click', function() {
        location.href = href ? href.getAttribute('data-home-href') : '../../biografii/';
      });
    }
    // Share button
    qsa('[data-action="share"]').forEach(function(btn) {
      addCleanListener(btn, 'click', function() {
        if (navigator.share) navigator.share({ title: document.title, url: location.href });
      });
    });
    // Print button
    qsa('[data-action="print"]').forEach(function(btn) {
      addCleanListener(btn, 'click', function() { window.print(); });
    });
  }

  /* =====================================================
     PLAY EMBER — Speed Expand Panel
     Click ember → expand speed selector beside it.
     Pick speed → close panel smoothly.
     ===================================================== */
  function initPlayExpand() {
    qsa('.gb-ember').forEach(function(ember) {
      // Speed panel works for embers inside ANY cluster container:
      //   [data-fc-root]      — single / series-lite (hermenevtika, kod-da-vinchi, ...)
      //   [data-fc-controls]  — gill-rail (gill part1/2/3/spravochnik)
      // Previously only [data-fc-root] was accepted, so Gill part1/2/3/spravochnik
      // embers (which live in .gbs-rail-foot under [data-fc-controls="gill-rail"])
      // never received a speed panel — clicking play did nothing there.
      if (!ember.closest('[data-fc-root], [data-fc-controls]')) return;
      if (ember.parentNode.querySelector('.gb-ember-expand')) return;
      if (ember.parentNode.classList && ember.parentNode.classList.contains('gb-ember-wrap')) return;
      // Gill rail topbar owns its own slot-swap speed rail (search icon fades
      // out, speed chips fade into the same slot — mobile reference pattern),
      // not the bloom-pill this function builds. Skip it so there is only
      // ONE speed panel per ember, not two competing ones.
      if (ember.closest('[data-gb-speed-custom]')) return;
      // Gill mobile v5 top bar: no free edge for the bloom-pill (Play sits
      // mid-row between Home and Save), so the "Обучение" trigger slot-swaps
      // to a horizontal .mobile-speedrail instead — see initGillInlineSpeedRail().
      if (ember.closest('[data-fc-speed-mode="inline"]')) return;

      var speeds = [1, 1.25, 1.5, 1.75, 2];
      var currentRate = 1;
      try { currentRate = parseFloat(localStorage.getItem('gb:audio:rate') || localStorage.getItem('gbx-tts-rate')) || 1; } catch(_){}
      var pressTimer = null;
      var suppressNextEmberClick = false;

      // Persistent selected-speed echo next to Play (Gill rail only — see
      // .gbs-rail-spdbadge in floating-cluster.css). Optional: most embers
      // don't have this sibling, so it's just a no-op elsewhere.
      var spdBadge = ember.parentNode && ember.parentNode.querySelector('.gbs-rail-spdbadge');
      if (spdBadge) spdBadge.textContent = currentRate + '×';

      var panel = document.createElement('div');
      var emberUid = 'gb-ember-speed-' + Math.random().toString(36).slice(2,9);
      panel.id = emberUid;
      ember.setAttribute('aria-controls', emberUid);
      ember.setAttribute('aria-haspopup', 'true');
      panel.className = 'gb-ember-expand';
      panel.setAttribute('role', 'radiogroup');
      panel.setAttribute('aria-label', 'Скорость воспроизведения');
      panel.innerHTML = speeds.map(function(s) {
        var active = s === currentRate ? ' is-active' : '';
        return '<button class="gb-ember-expand__btn' + active + '" type="button" role="radio" data-speed="' + s + '" aria-label="Скорость ' + s + '\u00d7" aria-checked="' + (s === currentRate ? 'true' : 'false') + '">' + s + '\u00d7</button>';
      }).join('') + '<button class="gb-ember-expand__btn gb-ember-expand__stop" type="button" data-fc-action="stop" aria-label="Остановить озвучку">■</button>';

      // Wrap ember in a positioned span so the popover anchors exactly to the
      // play circle. Direction is set by CSS, not by JS:
      //   • desktop (article/series-lite/gill-rail) → morph LEFT (gb-ember-expand: right:0)
      //   • mobile bars                              → morph DOWN (see [data-gill-mobile-bar] override)
      // Gill's rail used to force morph-UP here (owner spec, when the ember
      // lived in the old bottom-of-rail footer); it now lives in the fixed
      // top-right corner cluster with open space to its left, so it uses the
      // same left-bloom as everywhere else instead of a bespoke direction.
      // See PremiumControls canonical contract in AuditRepo (PremiumControls/README.md §3.2)
      var parent = ember.parentNode;
      var wrap = document.createElement('span');
      wrap.className = 'gb-ember-wrap';
      parent.insertBefore(wrap, ember);
      wrap.appendChild(ember);
      wrap.appendChild(panel);

      function openPanel() {
        panel.classList.add('is-open');
        ember.setAttribute('aria-expanded', 'true');
        // Runtime viewport guard: после reflow проверяем,
        // не вылез ли pill за край экрана. Если да — сдвигаем
        // через translate. Дополнительная страховка к CSS max-width.
        requestAnimationFrame(function() {
          try {
            var rect = panel.getBoundingClientRect();
            var vw = window.innerWidth;
            var pad = 8;
            var shift = 0;
            if (rect.right > vw - pad) shift = (vw - pad) - rect.right;
            else if (rect.left < pad)  shift = pad - rect.left;
            if (shift) {
              // CSS owns the base transform (left-bloom, Gill-up, mobile-up).
              // Only feed a small viewport correction through a custom property;
              // never overwrite transform inline or the pill loses its anchor.
              panel.style.setProperty('--gb-ember-shift', shift + 'px');
            }
          } catch (_) {}
        });
      }
      function closePanel() {
        panel.classList.remove('is-open');
        ember.setAttribute('aria-expanded', 'false');
        panel.style.removeProperty('--gb-ember-shift');
      }

      addCleanListener(ember, 'pointerdown', function() {
        clearTimeout(pressTimer);
        pressTimer = setTimeout(function() {
          suppressNextEmberClick = true;
          stopTts();
          closePanel();
        }, 600);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(type) {
        addCleanListener(ember, type, function() { clearTimeout(pressTimer); });
      });

      addCleanListener(ember, 'click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (suppressNextEmberClick) {
          suppressNextEmberClick = false;
          return;
        }
        // Click = PLAY/PAUSE only. The speed pill is hover-driven on desktop
        // (see mouseenter below) and tap-driven on touch (handled by the
        // data-state observer below). Keeping click=play/pause means the
        // user can always pause; previously click only toggled the pill so
        // playback got stuck.
        handlePlayClick(ember);
      });
      // On touch devices (no hover) reveal the pill once playback actually
      // starts. startTts() resolves its engine via a Promise before calling
      // setEmberState('playing'), so reading ember.dataset.state right after
      // handlePlayClick() above (synchronously, in the same tick) always saw
      // the PREVIOUS state and left the pill permanently unreachable on
      // touch — the click handler fired before the async flip happened.
      // Watching the attribute directly sidesteps the race regardless of
      // how long engine resolution takes.
      if (!HOVER_CAPABLE) {
        new MutationObserver(function() {
          var st = ember.dataset.state || 'idle';
          if (st === 'playing') openPanel(); else closePanel();
        }).observe(ember, { attributes: true, attributeFilter: ['data-state'] });
      }

      addCleanListener(panel, 'click', function(e) {
        var btn = e.target.closest('[data-speed]');
        if (btn) {
          e.stopPropagation();
          var speed = parseFloat(btn.getAttribute('data-speed'));
          try { localStorage.setItem('gb:audio:rate', speed); try{localStorage.setItem('gbx-tts-rate', speed)}catch(_){}; } catch(_){}
          if (spdBadge) {
            spdBadge.textContent = speed + '×';
            spdBadge.classList.remove('is-bump');
            void spdBadge.offsetWidth;
            spdBadge.classList.add('is-bump');
          }
          panel.querySelectorAll('.gb-ember-expand__btn').forEach(function(b) {
            var isThis = parseFloat(b.getAttribute('data-speed')) === speed;
            b.classList.toggle('is-active', isThis);
            b.setAttribute('aria-checked', isThis ? 'true' : 'false');
          });
          // Live rate change — TTS подхватывает новую скорость со следующего chunk
          try {
            window.dispatchEvent(new CustomEvent('gb:tts-rate-change', {
              detail: { rate: speed }
            }));
          } catch(_) {}
          // Click on a speed = select instantly AND start playback from idle
          // (owner spec: "на клик мышки бы уже сразу 1.75 и т.п.").
          var _st = currentTtsUiState(ember);
          if (_st === 'idle' || !_st || _st === 'complete') { handlePlayClick(ember); }
          // Blur the clicked chip: it just received focus from the click,
          // and :focus-within (the keyboard-a11y keep-open rule) would
          // otherwise hold the panel open indefinitely even after the
          // pointer leaves — reading as a stray leftover mark next to Play
          // instead of a closed pill (owner: "выбрал — и ушли они"). The
          // existing mouseleave timer (below) closes it once the pointer
          // actually leaves; on touch there's no hover, so force-close here.
          try { btn.blur(); } catch (_) {}
          if (!HOVER_CAPABLE) setTimeout(closePanel, 220);
          return;
        }
      });

      // ── Premium open/close ───────────────────────────────────────────────
      // Desktop (hover-capable): the speed pill blooms OUT of the Play circle
      // on hover — smooth, rubbery, deep. Click stays = play/pause.
      // Touch: pill is revealed via the play tap (above) / tap toggle (below).
      var leaveTimer = null;
      if (HOVER_CAPABLE) {
        addCleanListener(wrap, 'mouseenter', function() {
          clearTimeout(leaveTimer);
          openPanel();
        });
        addCleanListener(wrap, 'mouseleave', function() {
          clearTimeout(leaveTimer);
          leaveTimer = setTimeout(closePanel, 260);
        });
        // Keyboard a11y: focusing the ember opens the pill; blur (out of wrap) closes.
        addCleanListener(ember, 'focus', openPanel);
        addCleanListener(wrap, 'focusout', function(e) {
          if (!wrap.contains(e.relatedTarget)) {
            clearTimeout(leaveTimer);
            leaveTimer = setTimeout(closePanel, 120);
          }
        });
      }
      addCleanListener(document, 'click', function(e) {
        if (!wrap.contains(e.target)) closePanel();
      });
      addCleanListener(document, 'keydown', function(e) {
        if (e.key === 'Escape') closePanel();
        // Arrow ←/→ navigation between speed buttons when panel is open
        if (!panel.classList.contains('is-open')) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          var btns = Array.prototype.slice.call(panel.querySelectorAll('.gb-ember-expand__btn'));
          if (!btns.length) return;
          var cur = btns.findIndex(function(b) { return b.classList.contains('is-active'); });
          var next = e.key === 'ArrowRight' ? Math.min(cur + 1, btns.length - 1) : Math.max(cur - 1, 0);
          btns[next].focus();
          btns[next].click();
        }
        // Tab trap inside speed panel
        if (e.key === 'Tab') {
          var focusable = Array.prototype.slice.call(panel.querySelectorAll('button'));
          if (!focusable.length) return;
          var first = focusable[0], last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });
    });
  }

  /* =====================================================
     LONG-PRESS-TO-STOP for custom speed-slot embers
     -----------------------------------------------------
     initPlayExpand() skips [data-gb-speed-custom] embers (Gill desktop
     rail topbar, Gill v4 mobile bar, Hermenevtika mobile bar) because they
     run their own slot-swap speed UI, so the bloom-pill's long-press-stop
     never got wired on them — the v4 mobile Play lost the "hold = stop"
     gesture the old bottom-bar ember had. Restore it here as a small
     dedicated handler (owner: "дополняем на максимум удобный" — better than
     the reference, which has play/pause only). Touch-gated: a mouse hold on
     desktop does NOT stop (avoids accidental stops on click-hold); the
     gesture is a deliberate touch affordance. Click that immediately
     follows a fired long-press is suppressed so it doesn't re-trigger play.
     ===================================================== */
  function initCustomSlotLongPressStop() {
    // Gill mobile v5 top bar (data-fc-speed-mode="inline") also opts its
    // ember out of the bloom-pill (see initPlayExpand()), so it needs this
    // same restored gesture — same selector family as [data-gb-speed-custom].
    qsa('[data-gb-speed-custom] .gb-ember, [data-fc-speed-mode="inline"] .gb-ember').forEach(function (ember) {
      var pressTimer;
      var suppressClick = false;
      addCleanListener(ember, 'pointerdown', function (e) {
        // touch (and pen) only — never a desktop mouse hold
        if (e.pointerType && e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(function () {
          var st = ember.dataset.state || 'idle';
          if (st === 'playing' || st === 'paused') {
            suppressClick = true;
            stopTts();
          }
        }, 600);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
        addCleanListener(ember, type, function () { clearTimeout(pressTimer); });
      });
      // Ember click normally bubbles to the [data-fc-root] delegated handler
      // (→ handlePlayClick). When a long-press-stop just fired, eat the
      // trailing click here (ember is deeper than the root, so its bubble
      // listener runs first) so playback is not immediately restarted.
      addCleanListener(ember, 'click', function (e) {
        if (suppressClick) {
          suppressClick = false;
          e.preventDefault();
          e.stopPropagation();
        }
      });
    });
  }

  /* =====================================================
     GILL MOBILE v5 — inline speed rail
     -----------------------------------------------------
     The Gill mobile top bar has no free edge for the bloom-pill (Play sits
     mid-row between Home and Save), so instead of .gb-ember-expand it
     slot-swaps the "Обучение" trigger for a horizontal .mobile-speedrail in
     the same .mobile-top-slot (data-fc-speed-mode="inline", opted out of
     initPlayExpand() above — see there). Storage stays gb:audio:rate, the
     same key the canonical bloom-pill and the TTS engine already read/write,
     so switching between desktop and mobile mid-session keeps the same rate.
     ===================================================== */
  function initGillInlineSpeedRail() {
    var root = qs('[data-fc-speed-mode="inline"]');
    if (!root) return;
    var slot = root.querySelector('.mobile-top-slot');
    var learningBtn = root.querySelector('.mobile-learning-trigger');
    var rail = root.querySelector('.mobile-speedrail');
    var badge = root.querySelector('.mobile-spdbadge');
    var ember = root.querySelector('.mobile-playwrap .gb-ember');
    if (!slot || !rail || !ember) return;

    var currentRate = 1;
    try { currentRate = parseFloat(localStorage.getItem('gb:audio:rate') || localStorage.getItem('gbx-tts-rate')) || 1; } catch(_){}
    var speedButtons = Array.prototype.slice.call(rail.querySelectorAll('[data-speed]'));

    function syncButtons() {
      speedButtons.forEach(function(btn) {
        var isThis = parseFloat(btn.getAttribute('data-speed')) === currentRate;
        btn.setAttribute('aria-checked', isThis ? 'true' : 'false');
      });
      if (badge) {
        var label = currentRate + '×';
        badge.textContent = label;
        badge.setAttribute('aria-label', 'Скорость озвучки ' + label);
      }
    }
    syncButtons();

    var open = false;
    var offeredOnce = false;
    var closeTimer = null;
    function setOpen(next) {
      open = next;
      root.classList.toggle('speed-open', open);
      rail.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (learningBtn) learningBtn.tabIndex = open ? -1 : 0;
      speedButtons.forEach(function(btn) { btn.tabIndex = open ? 0 : -1; });
      if (open) { try { document.dispatchEvent(new CustomEvent('gb:gill-sheet-open')); } catch(_) {} }
    }
    setOpen(false);
    // Cross-file hook: GillSeriesMobileBar.astro's auto-hide logic and other
    // sheet triggers can force-close the rail without reaching into this
    // closure directly.
    window.__gillCloseSpeedRail = function() { clearTimeout(closeTimer); setOpen(false); };

    if (badge) {
      addCleanListener(badge, 'click', function(e) {
        e.stopPropagation();
        clearTimeout(closeTimer);
        setOpen(!open);
      });
    }
    addCleanListener(rail, 'click', function(e) {
      var btn = e.target.closest('[data-speed]');
      if (!btn) return;
      currentRate = parseFloat(btn.getAttribute('data-speed'));
      try { localStorage.setItem('gb:audio:rate', currentRate); try{localStorage.setItem('gbx-tts-rate', currentRate)}catch(_){}; } catch(_){}
      syncButtons();
      try { window.dispatchEvent(new CustomEvent('gb:tts-rate-change', { detail: { rate: currentRate } })); } catch(_) {}
      var st = currentTtsUiState(ember);
      if (st === 'idle' || !st || st === 'complete') { handlePlayClick(ember); }
      clearTimeout(closeTimer);
      closeTimer = setTimeout(function() { setOpen(false); }, 150);
    });
    addCleanListener(document, 'click', function(e) {
      if (open && !slot.contains(e.target)) setOpen(false);
    });
    addCleanListener(document, 'keydown', function(e) {
      if (!open) return;
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        var idx = speedButtons.indexOf(document.activeElement);
        var next = e.key === 'ArrowRight' ? Math.min(idx + 1, speedButtons.length - 1) : Math.max(idx - 1, 0);
        if (idx === -1) next = 0;
        speedButtons[next].focus();
      }
    });

    // First play from idle: reveal the rail once, briefly, so the reader
    // discovers it exists — never again after that (owner spec, mirrors the
    // mobile reference's one-time speedOffered auto-close pattern).
    new MutationObserver(function() {
      var st = ember.dataset.state || 'idle';
      if (st === 'playing' && !offeredOnce) {
        offeredOnce = true;
        clearTimeout(closeTimer);
        setOpen(true);
        closeTimer = setTimeout(function() { setOpen(false); }, 4500);
      }
    }).observe(ember, { attributes: true, attributeFilter: ['data-state'] });
  }

  /* =====================================================
     GBS2 CONTROLS — Баптисты России series UI wiring
     Handles: TOC population, sheet open/close, tabs,
     font controls, share, progress tracking, bottom bar.
     ===================================================== */
  function initGbs2Controls() {
    var sheet = qs('#gbs2Sheet');
    var bbar = qs('#gbs2Bbar');
    // Gill v16 pages ship neither #gbs2Sheet nor #gbs2Bbar, but their pre-v16
    // desktop submenu scrollspy lives in updateScrollProgress() below — the
    // old gate left the restored submenu permanently frozen at its SSR state
    // (active row 1, counter "1 / N") on every Gill route.  [spec §6.3/§9]
    if (!sheet && !bbar && !qs('[data-gill-v16]')) return; // Not a GBS2/Gill-v16 page

    // --- TOC Population ---
    function populateToc() {
      var article = qs('article.article-body') || qs('#main-content article') || qs('main');
      if (!article) return;
      var headings = qsa('h2[id], h3[id]', article);
      if (!headings.length) return;

      // Sidebar TOC (#gbs2Toc)
      // v16 pages ship a static roman-numeral part-TOC (.toc-part-item) inside
      // #gbs2Toc — never overwrite it with auto-generated legacy <li> items.
      var isV16Page = !!qs('[data-gill-v16]');
      var sidebarToc = qs('#gbs2Toc');
      if (!isV16Page && sidebarToc && !sidebarToc.querySelector('li')) {
        headings.forEach(function(h, idx) {
          var li = document.createElement('li');
          if (h.tagName === 'H3') li.classList.add('gbs2-sub');
          var a = document.createElement('a');
          a.href = '#' + h.id;
          a.textContent = h.textContent.trim();
          addCleanListener(a, 'click', function(e) {
            e.preventDefault();
            var target = document.getElementById(h.id);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
          li.appendChild(a);
          sidebarToc.appendChild(li);
        });
      }

      // Sheet TOC pane
      var sheetTocPane = qs('[data-gbs2-pane="toc"]');
      if (sheetTocPane && !sheetTocPane.querySelector('a')) {
        var h2Count = 0;
        headings.forEach(function(h) {
          var a = document.createElement('a');
          a.className = 'gbs2-sheet-toclink' + (h.tagName === 'H3' ? ' gbs2-sheet-sub' : '');
          a.href = '#' + h.id;
          var span = document.createElement('span');
          if (h.tagName === 'H2') {
            h2Count++;
            span.textContent = String(h2Count).padStart(2, '0');
          }
          a.appendChild(span);
          var textNode = document.createTextNode(h.textContent.trim());
          a.appendChild(textNode);
          addCleanListener(a, 'click', function(e) {
            e.preventDefault();
            closeSheet('navigate', false);
            var target = document.getElementById(h.id);
            if (target) setTimeout(function() {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
          });
          sheetTocPane.appendChild(a);
        });
      }

      // Update count — only for the legacy (non-v16) sidebar TOC. On Gill v16
      // the historical submenu owns its own "N / TOTAL" counter and sets it
      // itself in updateScrollProgress(); overwriting it here would flash the
      // wrong value (e.g. total heading count instead of 1 / 15).  [spec §9.1]
      var countEl = qs('#gbs2Count');
      if (!isV16Page && countEl) countEl.textContent = headings.length;
    }

    // --- Sheet Open/Close ---
    var GBS2_OVERLAY_OWNER = 'gbs2-sheet';
    function openSheet(opener) {
      if (!sheet || sheet.classList.contains('gbs2-open')) return;
      sheet.setAttribute('aria-hidden', 'false');
      sheet.style.display = 'block';
      sheet.classList.add('gbs2-open');
      var runtime = window.OverlayRuntime;
      if (runtime && typeof runtime.open === 'function') {
        runtime.open(GBS2_OVERLAY_OWNER, {
          element: sheet,
          opener: opener || document.activeElement,
          focusTarget: sheet.querySelector('[data-gbs2-close], [data-gbs2-tab], a[href], button'),
          onRequestClose: function(reason) { closeSheet(reason, true); },
          closeOnEscape: true,
          trapFocus: true,
          lockScroll: true
        });
      } else {
        var utils = window.SiteUtils;
        if (utils && typeof utils.lockScroll === 'function') utils.lockScroll(GBS2_OVERLAY_OWNER);
      }
    }
    function closeSheet(reason, restoreFocus) {
      if (!sheet) return;
      sheet.setAttribute('aria-hidden', 'true');
      sheet.classList.remove('gbs2-open');
      sheet.style.display = '';
      var runtime = window.OverlayRuntime;
      if (runtime && typeof runtime.close === 'function') {
        runtime.close(GBS2_OVERLAY_OWNER, reason || 'programmatic', { restoreFocus: restoreFocus !== false });
      } else {
        var utils = window.SiteUtils;
        if (utils && typeof utils.unlockScroll === 'function') utils.unlockScroll(GBS2_OVERLAY_OWNER);
      }
    }

    // Bottom bar opens sheet
    if (bbar && sheet) {
      addCleanListener(bbar, 'click', function(e) { openSheet(e.currentTarget); });
    }

    // Close buttons
    qsa('[data-gbs2-close]').forEach(function(el) {
      addCleanListener(el, 'click', function(e) {
        e.stopPropagation();
        closeSheet('button', true);
      });
    });

    // OverlayRuntime owns Escape globally; fallback keeps legacy pages usable.
    addCleanListener(document, 'keydown', function(e) {
      if (!window.OverlayRuntime && e.key === 'Escape' && sheet && sheet.classList.contains('gbs2-open')) {
        closeSheet('escape', true);
      }
    });

    // --- Tab Switching ---
    var tabs = qsa('[data-gbs2-tab]');
    tabs.forEach(function(tab) {
      addCleanListener(tab, 'click', function() {
        var pane = tab.getAttribute('data-gbs2-tab');
        tabs.forEach(function(t) { t.classList.toggle('gbs2-on', t === tab); });
        qsa('[data-gbs2-pane]').forEach(function(p) {
          p.classList.toggle('gbs2-on', p.getAttribute('data-gbs2-pane') === pane);
        });
      });
    });

    // --- Font Controls ---
    qsa('[data-gbs2-font]').forEach(function(btn) {
      addCleanListener(btn, 'click', function(e) {
        e.stopPropagation();
        var dir = btn.getAttribute('data-gbs2-font') === 'up' ? 1 : -1;
        changeFontSize(dir);
      });
    });

    // --- Share ---
    qsa('[data-gbs2-share]').forEach(function(btn) {
      addCleanListener(btn, 'click', function(e) {
        e.stopPropagation();
        if (navigator.share) {
          navigator.share({ title: document.title, url: location.href });
        } else {
          // Fallback: copy URL
          try {
            navigator.clipboard.writeText(location.href);
            showToast('Ссылка скопирована', true);
          } catch(_) {}
        }
      });
    });

    // --- Gill rail "metro line" geometry (collapsible sub-groups) ---
    // Restored from the pre-v16 enhancements.js geo()/follow(): the track spans
    // the first→last VISIBLE dot (dots inside a collapsed sub-group are skipped)
    // and the fill interpolates continuously between the active dot and the next
    // visible one by scroll progress. railKick() drives a short rAF loop so the
    // spine + fill follow the expand/collapse animation frame-by-frame.
    var _gbs2ActiveGrp = null, _railKickUntil = 0, _railKicking = false;
    function _nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function computeRailFill() {
      var toc = qs('.gbs2-toc'), track = qs('.gbs2-track');
      var fill = track && qs('i', track);
      if (!toc || !track || !fill) return;
      var links = qsa('.gbs2-toc a[href^="#"]');
      if (!links.length) return;
      var dots = links.map(function (a) { return qs('.gbs2-dot', a); });
      var vis = links.map(function (a) { return !a.closest('li.gbs2-collapsed'); });
      var base = toc.getBoundingClientRect();
      var f = -1, l = -1, i;
      for (i = 0; i < dots.length; i++) { if (vis[i] && dots[i]) { if (f < 0) f = i; l = i; } }
      if (f < 0) return;
      var fr = dots[f].getBoundingClientRect(), lr = dots[l].getBoundingClientRect();
      var top = fr.top + fr.height / 2 - base.top;
      var h = Math.max(0, lr.top + lr.height / 2 - base.top - top);
      track.style.setProperty('--gbs2-track-top', top + 'px');
      track.style.setProperty('--gbs2-track-height', h + 'px');
      var ai = -1;
      for (i = 0; i < links.length; i++) { if (links[i].classList.contains('gbs2-active')) { ai = i; break; } }
      if (ai < 0 || !vis[ai]) ai = f;
      var center = function (idx) {
        var d = dots[idx]; if (!d) return 0;
        var r = d.getBoundingClientRect();
        return Math.max(0, Math.min(h, r.top + r.height / 2 - base.top - top));
      };
      var curH = center(ai);
      var ni = ai + 1; while (ni < dots.length && !vis[ni]) ni++;
      var tgt = function (idx) { var id = (links[idx].getAttribute('href') || '').slice(1); return id ? document.getElementById(id) : null; };
      var ta = tgt(ai), tn = ni < dots.length ? tgt(ni) : null;
      if (ta && tn) {
        var secStart = ta.offsetTop, secEnd = tn.offsetTop;
        var secProg = secEnd > secStart ? Math.max(0, Math.min(1, (window.scrollY - secStart + 120) / (secEnd - secStart))) : 0;
        fill.style.height = (curH + (center(ni) - curH) * secProg) + 'px';
      } else {
        fill.style.height = curH + 'px';
      }
    }
    function railKick(ms) {
      _railKickUntil = _nowMs() + (ms || 500);
      if (_railKicking) return;
      _railKicking = true;
      // Historical kick(): drop the fill transition for the whole follow loop so
      // the line tracks the expand/collapse animation frame-by-frame, then hand
      // back to the stylesheet's near-instant `.08s linear` (witness follow()).
      var fillEl = qs('.gbs2-track i');
      if (fillEl) fillEl.style.transition = 'none';
      (function tick() {
        computeRailFill();
        if (_nowMs() < _railKickUntil) { requestAnimationFrame(tick); return; }
        _railKicking = false;
        var f = qs('.gbs2-track i');
        if (f) f.style.transition = '';
      })();
    }

    // --- ReaderState R6: one progress/section/resume owner ---
    // The shared ReaderState service owns geometry, persistence and legacy-key
    // migration. This controller only renders series/book chrome from snapshots.
    var readerState = window.GBReaderState || window.ReaderState || null;

    function maybeOfferResume() {
      if (!readerState || !qs('[data-gill-v16]')) return;
      var saved = readerState.getSaved && readerState.getSaved();
      if (!saved || !(saved.scrollY > 1200) || !(saved.progress >= 8) || saved.progress > 92 || saved.completed) return;
      if ((window.scrollY || 0) > 200) return;
      if (saved.dismissedAt && Date.now() - saved.dismissedAt < 86400000) return;
      if (readerState.isResumeAcknowledged && readerState.isResumeAcknowledged()) return;

      var toast = document.createElement('div');
      toast.className = 'gbs2-resume';
      toast.setAttribute('role', 'status');
      toast.innerHTML = '<span><small>Вы здесь были</small>Вы остановились на ' + Math.round(saved.progress) + '%</span>' +
        '<button type="button" class="gbs2-resume-go">Продолжить</button>' +
        '<button type="button" class="gbs2-resume-x" aria-label="Скрыть">×</button>';
      document.body.appendChild(toast);
      var hideT = null;
      function hide(mute) {
        toast.classList.remove('gbs2-on');
        clearTimeout(hideT);
        if (readerState.markResumeAcknowledged) readerState.markResumeAcknowledged();
        if (mute && readerState.dismissResumeForDay) readerState.dismissResumeForDay();
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
      }
      toast.querySelector('.gbs2-resume-go').addEventListener('click', function () {
        if (readerState.restoreSnapshot) readerState.restoreSnapshot(saved);
        hide(false);
      });
      toast.querySelector('.gbs2-resume-x').addEventListener('click', function () { hide(true); });
      setTimeout(function () { toast.classList.add('gbs2-on'); }, 900);
      hideT = setTimeout(function () { hide(false); }, 6500);
    }

    function renderReaderState(reader) {
      if (!reader) return;
      var pct = Math.max(0, Math.min(100, Math.round(Number(reader.progress) || 0)));
      var phase = reader.phase || 'before-content';

      var doneMin = Number(document.body.getAttribute('data-gbs2-done-min') || 0);
      var partMin = Number(document.body.getAttribute('data-gbs2-part-min') || 0);
      var totalMin = Number(document.body.getAttribute('data-gbs2-total-min') || 0);
      var seriesPc = totalMin > 0
        ? Math.round(((doneMin + (pct * partMin / 100)) / totalMin) * 100)
        : pct;
      var pctSidebar = qs('#gbs2Pct');
      if (pctSidebar) pctSidebar.textContent = seriesPc + '%';
      var curbar = qs('#gbs2Curbar');
      if (curbar) curbar.style.width = pct + '%';
      var ring = qs('#gbs2Ring');
      if (ring) {
        var circ = 2 * Math.PI * 18;
        ring.style.strokeDashoffset = circ - (circ * seriesPc / 100);
      }
      var mobPctEl = qs('#gbs2MobPct');
      if (mobPctEl) mobPctEl.textContent = pct + '%';
      var mobArticleRing = qs('#gbs2MobArticleRing');
      if (mobArticleRing) {
        var articleCirc = 2 * Math.PI * 12.5;
        mobArticleRing.style.strokeDashoffset = articleCirc - (articleCirc * pct / 100);
      }
      var mobSeriesRing = qs('#gbs2MobSeriesRing');
      if (mobSeriesRing) {
        var mobSeriesCirc = 2 * Math.PI * 16;
        mobSeriesRing.style.strokeDashoffset = mobSeriesCirc - (mobSeriesCirc * seriesPc / 100);
      }
      var mobDualBtn = qs('#gbs2DualProgress');
      if (mobDualBtn) mobDualBtn.setAttribute('aria-label', 'Статья ' + pct + '%, серия ' + seriesPc + '%');
      var mobSec = qs('#gbs2MobSec');
      if (mobSec) mobSec.textContent = reader.sectionTitle || (phase === 'after-content' ? 'Завершено' : 'Введение');

      // Historical kinetic visuals remain renderers of the shared scroll snapshot.
      var scrollY = Number(reader.scrollY) || 0;
      var heroImgEl = qs('.gbs2-hero img');
      if (heroImgEl) heroImgEl.style.setProperty('--gbs2-par', String(Math.round(scrollY * 0.035)));
      var kineticEl = qs('.gbs2-kinetic');
      if (kineticEl) kineticEl.style.setProperty('--gbs2-kin-y', Math.round(scrollY * -0.018) + 'px');

      var represented = qsa('.gbs2-toc a[href^="#"]').map(function (a) {
        var id = (a.getAttribute('href') || '').slice(1);
        var target = id ? document.getElementById(id) : null;
        return target ? { a: a, target: target, id: id } : null;
      }).filter(Boolean);
      represented.sort(function (x, y) {
        if (x.target === y.target) return 0;
        return (x.target.compareDocumentPosition(y.target) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });

      if (represented.length) {
        // ReaderState remains the sole scroll/rAF owner, but its global heading
        // selector is intentionally broader than the historical Gill rail: the
        // rail is a curated subset and may target a paragraph. Derive the rail
        // index from its own real targets and the shared scroll snapshot instead
        // of requiring reader.sectionId to be one of the represented rows.
        // 140px is the canonical Gill anchor offset used by rail navigation and
        // the pre-v16 live traversal contract.
        var railLine = scrollY + 140;
        var activeIdx = phase === 'after-content' ? represented.length - 1 : 0;
        if (phase !== 'before-content' && phase !== 'after-content') {
          for (var ri = 0; ri < represented.length; ri++) {
            var targetTop = represented[ri].target.getBoundingClientRect().top + (window.scrollY || 0);
            if (targetTop <= railLine + 2) activeIdx = ri;
            else break;
          }
        }
        represented.forEach(function (row, idx) {
          var isActive = idx === activeIdx;
          var isPassed = idx < activeIdx;
          row.a.classList.toggle('gbs2-active', isActive);
          row.a.classList.toggle('gbs2-passed', isPassed);
          if (isActive) row.a.setAttribute('aria-current', 'location');
          else row.a.removeAttribute('aria-current');
        });

        var holdA = null;
        if (activeIdx >= 0) {
          var activeSubLi = represented[activeIdx].a.closest('li.gbs2-sub');
          if (activeSubLi) {
            var holdGrp = activeSubLi.getAttribute('data-gbs2-grp');
            var h2Li = qsa('.gbs2-toc > li:not(.gbs2-sub)').filter(function (li) {
              return li.getAttribute('data-gbs2-grp') === holdGrp;
            })[0];
            holdA = h2Li ? qs('a', h2Li) : null;
          }
        }
        qsa('.gbs2-toc a.gbs2-hold').forEach(function (a) { if (a !== holdA) a.classList.remove('gbs2-hold'); });
        if (holdA && !holdA.classList.contains('gbs2-active')) holdA.classList.add('gbs2-hold');

        var activeLi = activeIdx >= 0 ? represented[activeIdx].a.closest('li') : null;
        var activeGrp = activeLi ? activeLi.getAttribute('data-gbs2-grp') : null;
        var activeGroupChanged = activeGrp !== _gbs2ActiveGrp;
        if (activeGroupChanged) {
          _gbs2ActiveGrp = activeGrp;
          qsa('.gbs2-toc li.gbs2-sub').forEach(function (li) {
            var open = !!activeGrp && li.getAttribute('data-gbs2-grp') === activeGrp;
            var collapsed = li.classList.contains('gbs2-collapsed');
            if (open && collapsed) {
              li.classList.remove('gbs2-collapsed');
              li.style.maxHeight = '240px';
            } else if (!open && !collapsed) {
              li.style.maxHeight = li.getBoundingClientRect().height + 'px';
              void li.offsetHeight;
              li.classList.add('gbs2-collapsed');
              li.style.maxHeight = '0px';
            }
          });
          railKick(560);
        }

        var countEl = qs('#gbs2Count');
        if (countEl) countEl.textContent = (activeIdx + 1) + ' / ' + represented.length;

        var railFill = qs('.gbs2-track i');
        if (phase === 'before-content' && railFill) railFill.style.height = '0px';
        else if (phase === 'after-content' && railFill) railFill.style.height = 'var(--gbs2-track-height)';
        else computeRailFill();

        var activeRow = activeIdx >= 0 ? represented[activeIdx] : null;
        var scroller = qs('.gbs2-tocscroll');
        function keepActiveRowVisible(behavior) {
          if (!activeRow || !scroller) return;
          var ar = activeRow.a.getBoundingClientRect();
          var sr = scroller.getBoundingClientRect();
          if (ar.top < sr.top + 18 || ar.bottom > sr.bottom - 18) {
            var desired = activeRow.a.offsetTop - scroller.clientHeight / 2 + activeRow.a.offsetHeight / 2;
            scroller.scrollTo({ top: Math.max(0, desired), behavior: behavior || 'auto' });
          }
        }
        if (activeRow && scroller) {
          keepActiveRowVisible('smooth');
          // Expanding the new sub-group and collapsing the previous one can
          // move the active row after the immediate scroll has completed.
          // Re-check once the 560ms rail follow loop has settled, but only
          // if this row is still the canonical active row.
          if (activeGroupChanged) window.setTimeout(function () {
            if (activeRow.a.classList.contains('gbs2-active')) keepActiveRowVisible('auto');
          }, 620);
        }

        if (!qs('#gbs2PartToc[data-gill-parts-nav]')) {
          qsa('.toc-part-item').forEach(function (el, idx) {
            var isActive = idx === activeIdx;
            var isPassed = idx < activeIdx;
            el.classList.toggle('is-active', isActive);
            el.classList.toggle('is-done', isPassed);
            if (isActive) el.setAttribute('aria-current', 'location');
            else el.removeAttribute('aria-current');
          });
        }
      }

      var partItems = qsa('.toc-part-item');
      var partActiveIdx = -1;
      partItems.forEach(function (el, idx) {
        if (el.classList.contains('is-active') || el.classList.contains('is-current')) partActiveIdx = idx;
      });
      var partPct = partActiveIdx >= 0 ? Math.round(((partActiveIdx + 1) / Math.max(1, partItems.length)) * 100) : pct;
      var scrollBar = qs('.toc-sheet__scroll-bar i');
      if (scrollBar) scrollBar.style.width = partPct + '%';
    }

    if (readerState && readerState.configure && readerState.subscribe) {
      var seriesRoot = qs('[data-gill-v16]');
      readerState.configure({
        surface: 'series',
        seriesId: (document.body && document.body.getAttribute('data-gbs2-series')) || '',
        pageId: seriesRoot ? seriesRoot.getAttribute('data-gill-v16') || '' : '',
        headingSelector: 'h2[id], h3[id]'
      }).init();
      readerState.subscribe(renderReaderState);
    }

    // Initial population
    populateToc();
    if (readerState) setTimeout(maybeOfferResume, 0);
  }

})();
