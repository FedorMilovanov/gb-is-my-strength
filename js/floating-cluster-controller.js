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
    document.documentElement.classList.toggle('dark', !!dark);
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (_) {}
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

  function cancelActiveEngine() {
    if (ttsState.engine === 'vosk' && window.VoskTTSEngine) {
      window.VoskTTSEngine.cancel(ttsState.utterance);
    } else if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
  }

  var _voskEngineScriptPromise = null;
  // js/vosk-tts-engine.js сам по себе не подключён ни одним <script> тегом —
  // ленивая загрузка ровно по первому клику «Слушать», как и модель внутри него.
  function loadVoskEngineScript() {
    if (window.VoskTTSEngine) return Promise.resolve();
    if (_voskEngineScriptPromise) return _voskEngineScriptPromise;
    _voskEngineScriptPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '/js/vosk-tts-engine.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { _voskEngineScriptPromise = null; reject(new Error('vosk-tts-engine.js load failed')); };
      document.head.appendChild(s);
    });
    return _voskEngineScriptPromise;
  }

  // Решает, каким движком озвучивать текущую сессию. Если Vosk уже прогрет
  // (модель скачана и разобрана раньше) — используем сразу, без ожидания.
  // Если нет — ждём его загрузку (первый раз дольше, дальше из кэша браузера);
  // при любой ошибке (сеть, неподдерживаемый браузер, engine-скрипт не подключился)
  // — тихий откат на Web Speech.
  function resolveTtsEngine() {
    return loadVoskEngineScript().catch(function (err) {
      console.warn('[gbx-tts] failed to load vosk-tts-engine.js:', err);
    }).then(function () {
      if (window.VoskTTSEngine && window.VoskTTSEngine.isReady()) return 'vosk';
      if (!(window.VoskTTSEngine && window.VoskTTSEngine.isSupported())) {
        return ('speechSynthesis' in window) ? 'webspeech' : null;
      }
      showToast('Готовим озвучку (в первый раз — дольше, дальше из кэша браузера)…', false);
      return window.VoskTTSEngine.ensureLoaded().then(function () {
        return 'vosk';
      }).catch(function (err) {
        console.warn('[gbx-tts] Vosk engine unavailable, falling back to Web Speech:', err);
        return ('speechSynthesis' in window) ? 'webspeech' : null;
      });
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

  function getArticleText() {
    // Соберём читательский текст: только параграфы внутри <article>
    var article = qs('article.article-body') ||
                  qs('article') ||
                  qs('main[data-pagefind-body]') ||
                  qs('main');
    if (!article) return '';
    var blocks = article.querySelectorAll('p, h2, h3, li');
    var out = [];
    Array.prototype.forEach.call(blocks, function (el) {
      // Пропускаем: метаданные, сноски (английские), tooltips, notice (copyright/source)
      if (el.closest('.summary-card, .gtip, .fn-marker, .tooltip, .notice, ' +
                     '.original-author-card, .footnote, aside, .sources-block, ' +
                     '.reading-list-section, [hidden], [data-pagefind-ignore]')) return;
      var t = (el.textContent || '').trim();
      if (t.length > 0) out.push(t);
    });
    return out.join('. ');
  }

  function splitTtsChunks(text) {
    // speechSynthesis в Chrome падает на utterances длиннее ~32000 chars.
    // Делим на ~200-символьные куски по границам предложений.
    // Без lookbehind (?<=...) — Safari <16.4 его не поддерживает (SyntaxError).
    var parts = text.split(/([.!?]+\s+)/);
    var chunks = [];
    var buf = '';
    for (var i = 0; i < parts.length; i++) {
      buf += parts[i];
      if (buf.length >= 180 && i % 2 === 1) {
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
      setEmberState('complete');
      return;
    }
    var chunk = ttsState.chunks[ttsState.chunkIdx];

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
      ttsState.utterance = null;
      setEmberState('idle');
    }

    if (ttsState.engine === 'vosk' && window.VoskTTSEngine) {
      ttsState.utterance = window.VoskTTSEngine.speak(chunk, getStoredRate(), 0, onChunkEnd, onChunkError);
      return;
    }

    var u = new SpeechSynthesisUtterance(chunk);
    u.rate = getStoredRate();
    u.lang = 'ru-RU';
    if (!ttsState.voice) ttsState.voice = pickRuVoice();
    if (ttsState.voice) u.voice = ttsState.voice;
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
      setEmberState('playing');
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
    setEmberState('paused');
  }

  function resumeTts() {
    if (!ttsAvailable()) return;
    ttsState.paused = false;
    ttsState.suppressEnd = false;
    ttsState.runId += 1;
    setEmberState('playing');
    // Restart from saved chunk position (neither engine supports real resume)
    speakNextChunk();
  }

  function stopTts() {
    if (!ttsAvailable()) return;
    ttsState.runId += 1;
    ttsState.suppressEnd = true;
    cancelActiveEngine();
    ttsState.paused = false;
    ttsState.utterance = null;
    ttsState.chunkIdx = 0;
    ttsState.spokenChars = 0;
    ttsState.engine = null;
    setEmberState('idle');
    qsa('.gb-ember').forEach(function (btn) { btn.style.setProperty('--p', '0'); });
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
    try { var s = parseFloat(localStorage.getItem(FONT_SCALE_KEY)); return (!isNaN(s) && s >= 0.85 && s <= 1.25) ? s : 1; } catch (_) { return 1; }
  })();
  function applyFontScale() {
    var article = qs('article.article-body') || qs('.article-main') || qs('main');
    if (article) article.style.fontSize = fontScale === 1 ? '' : (fontScale * 100) + '%';
  }
  function changeFontSize(direction) {
    fontScale = Math.max(0.85, Math.min(1.25, Math.round((fontScale + direction * 0.05) * 100) / 100));
    try { localStorage.setItem(FONT_SCALE_KEY, String(fontScale)); } catch (_) {}
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

    // 2. Gill rail / non-root cluster controls (работают без data-fc-root)
    initGillRail();

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

    // Current production root HTML may still contain the old one-level bar:
    //   button#mobTocBtn + div#gbs2MobSec + progress + pct + icon row.
    // Upgrade it at runtime so the fix works both for fresh Astro output and
    // for already-synced static root pages before the next full HTML sync.
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

    var GILL_LOCK_KEY = 'gill-toc';

    function openOverlay(el) {
      if (el) {
        el.classList.add('is-open');
        el.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('gb-gill-toc-open');
        // Coordinate with SiteUtils lock system to prevent cross-overlay desync.
        // SiteUtils.lockScroll uses position:fixed which also blocks scroll,
        // and its named-key system prevents unlockScroll from other modals
        // accidentally clearing the lock Gill set.
        var utils = window.SiteUtils;
        if (utils && typeof utils.lockScroll === 'function') {
          utils.lockScroll(GILL_LOCK_KEY);
        } else if (document.body) {
          document.body.style.overflow = 'hidden';
        }
      }
    }
    function closeOverlay(el) {
      if (el) {
        el.classList.remove('is-open');
        el.setAttribute('aria-hidden', 'true');
      }
      if (!qs('.toc-overlay.is-open')) {
        document.documentElement.classList.remove('gb-gill-toc-open');
        var utils = window.SiteUtils;
        if (utils && typeof utils.unlockScroll === 'function') {
          utils.unlockScroll(GILL_LOCK_KEY);
        } else if (document.body) {
          document.body.style.overflow = '';
        }
      }
    }

    // Mobile TOC button opens series
    if (mobTocBtn && seriesToc) {
      addCleanListener(mobTocBtn, 'click', function(e) { e.preventDefault(); openOverlay(seriesToc); });
    }

    // Explicit mobile Part TOC button opens the current article/part submenu.
    if (mobPartTocBtn && partToc) {
      addCleanListener(mobPartTocBtn, 'click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeOverlay(seriesToc);
        openOverlay(partToc);
      });
    }

    // Back button in Part TOC → Series TOC
    if (backToSeries && seriesToc && partToc) {
      addCleanListener(backToSeries, 'click', function() {
        closeOverlay(partToc);
        openOverlay(seriesToc);
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
          closeOverlay(seriesToc);
          openOverlay(partToc);
          return;
        }
        // Non-current items are regular links — let them navigate
      });
    }

    // Close overlay on backdrop click
    [seriesToc, partToc].forEach(function(overlay) {
      if (!overlay) return;
      addCleanListener(overlay, 'click', function(e) {
        if (e.target === overlay) closeOverlay(overlay);
      });
      // Close on handle tap/click (simple version)
      var handle = overlay.querySelector('.toc-sheet__handle');
      if (handle) {
        addCleanListener(handle, 'click', function() { closeOverlay(overlay); });
      }
    });

    // Escape closes any open overlay
    addCleanListener(document, 'keydown', function(e) {
      if (e.key === 'Escape') {
        closeOverlay(seriesToc);
        closeOverlay(partToc);
      }
    });

    // Gill v16 mobile bar scroll progress.
    // initGbs2Controls() skips Gill v16 pages (no gbs2Sheet/gbs2Bbar),
    // so we wire a dedicated lightweight scroll listener here.
    var gillProgressFill = qs('#gbs2MobProgress');
    var gillProgressPct  = qs('#gbs2MobPct');
    if (gillProgressFill || gillProgressPct) {
      var gillScrollTick = false;
      function updateGillProgress() {
        var docH = document.documentElement.scrollHeight - window.innerHeight;
        if (docH <= 0) { gillScrollTick = false; return; }
        var pct = Math.min(100, Math.round((window.scrollY / docH) * 100));
        if (gillProgressFill) gillProgressFill.style.width = pct + '%';
        if (gillProgressPct)  gillProgressPct.textContent  = pct + '%';
        gillScrollTick = false;
      }
      addCleanListener(window, 'scroll', function() {
        if (!gillScrollTick) {
          gillScrollTick = true;
          requestAnimationFrame(updateGillProgress);
        }
      }, { passive: true });
      updateGillProgress(); // initial call
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

      var speeds = [0.75, 1, 1.25, 1.5, 1.75, 2];
      var currentRate = 1;
      try { currentRate = parseFloat(localStorage.getItem('gb:audio:rate') || localStorage.getItem('gbx-tts-rate')) || 1; } catch(_){}
      var pressTimer = null;
      var suppressNextEmberClick = false;

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
      //   • desktop article/series-lite → morph LEFT  (gb-ember-expand: right:0)
      //   • gill-rail (any) + mobile    → morph UP    (gb-ember-expand: bottom:100%+8)
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
        // (see mouseenter below) and tap-driven on touch (handled in the
        // no-hover branch). Keeping click=play/pause means the user can always
        // pause; previously click only toggled the pill so playback got stuck.
        handlePlayClick(ember);
        // On touch devices (no hover) reveal the pill on the play tap too,
        // so speeds are reachable without a hover capability.
        if (!HOVER_CAPABLE) {
          var st = ember.dataset.state || 'idle';
          if (st === 'playing') openPanel(); else closePanel();
        }
      });

      addCleanListener(panel, 'click', function(e) {
        var btn = e.target.closest('[data-speed]');
        if (btn) {
          e.stopPropagation();
          var speed = parseFloat(btn.getAttribute('data-speed'));
          try { localStorage.setItem('gb:audio:rate', speed); try{localStorage.setItem('gbx-tts-rate', speed)}catch(_){}; } catch(_){}
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
          // On touch, collapse after selection; on hover, leave open while pointer stays.
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
            closeSheet();
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
    var SHEET_LOCK_KEY = 'gbs2-sheet';
    function openSheet() {
      if (!sheet || sheet.classList.contains('gbs2-open')) return;
      sheet.setAttribute('aria-hidden', 'false');
      sheet.style.display = 'block';
      sheet.classList.add('gbs2-open');
      // Coordinate with SiteUtils lock system to prevent cross-overlay desync.
      var utils = window.SiteUtils;
      if (utils && typeof utils.lockScroll === 'function') {
        utils.lockScroll(SHEET_LOCK_KEY);
      } else if (document.body) {
        document.body.style.overflow = 'hidden';
      }
    }
    function closeSheet() {
      if (!sheet) return;
      sheet.setAttribute('aria-hidden', 'true');
      sheet.classList.remove('gbs2-open');
      sheet.style.display = '';
      var utils = window.SiteUtils;
      if (utils && typeof utils.unlockScroll === 'function') {
        utils.unlockScroll(SHEET_LOCK_KEY);
      } else if (document.body) {
        document.body.style.overflow = '';
      }
    }

    // Bottom bar opens sheet
    if (bbar && sheet) {
      addCleanListener(bbar, 'click', function() { openSheet(); });
    }

    // Close buttons
    qsa('[data-gbs2-close]').forEach(function(el) {
      addCleanListener(el, 'click', function(e) {
        e.stopPropagation();
        closeSheet();
      });
    });

    // Escape closes sheet
    addCleanListener(document, 'keydown', function(e) {
      if (e.key === 'Escape' && sheet && sheet.classList.contains('gbs2-open')) {
        closeSheet();
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

    // --- Scroll Progress ---
    // GILL UI POLISH 2026-06-29 — gold progress + scrollspy
    function updateScrollProgress() {
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      if (docH <= 0) return;
      var pct = Math.min(100, Math.round((window.scrollY / docH) * 100));
      var pctF = pct / 100;
      // CSS custom properties for gold progress bar (owner screenshots fix)
      try {
        document.documentElement.style.setProperty('--gb-read-pct', String(pctF));
        document.documentElement.style.setProperty('--gb-read-active', pct > 2 ? '1' : '0');
        // also mirror to body for [data-gill-v16] descendant rules
        document.body.style.setProperty('--gb-read-pct', String(pctF));
      } catch(_){}
      var pctEl = qs('#gbs2MobPct');
      if (pctEl) pctEl.textContent = pct + '%';
      var pctSidebar = qs('#gbs2Pct');
      if (pctSidebar) pctSidebar.textContent = pct + '%';
      // Update progress bar
      var curbar = qs('#gbs2Curbar');
      if (curbar) curbar.style.width = pct + '%';
      // Update ring SVG
      var ring = qs('#gbs2Ring');
      if (ring) {
        var circ = 2 * Math.PI * 18; // r=18
        ring.style.strokeDashoffset = circ - (circ * pct / 100);
      }
      // Update mobile bottom bar section
      var mobSec = qs('#gbs2MobSec');
      if (mobSec) {
        var current = getCurrentHeading();
        if (current) mobSec.textContent = current;
      }
      // === Pre-v16 GBS Gill submenu scroll-spy restore ===
      var article = qs('article.article-body') || qs('main');
      if (article) {
        var represented = qsa('.gbs2-toc a[href^="#"]').map(function(a) {
          var href = a.getAttribute('href') || '';
          var id = href.slice(1);
          var target = id ? document.getElementById(id) : null;
          return target ? { a: a, target: target } : null;
        }).filter(Boolean);
        // The active-index walk below assumes targets are in document order.
        // Sort defensively by DOM position so an out-of-order menu row can
        // degrade gracefully instead of freezing the walk.  [spec §9.5]
        represented.sort(function(x, y) {
          if (x.target === y.target) return 0;
          return (x.target.compareDocumentPosition(y.target) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
        });
        if (represented.length) {
          var scrollY = window.scrollY + 140;
          var activeIdx = 0;
          for (var ri = 0; ri < represented.length; ri++) {
            if (represented[ri].target.offsetTop <= scrollY) activeIdx = ri;
            else break;
          }
          var submenuActiveIdx = activeIdx; // captured for rail-fill (see §9.2)
          represented.forEach(function(row, idx) {
            row.a.classList.toggle('gbs2-active', idx === activeIdx);
            row.a.classList.toggle('gbs2-passed', idx < activeIdx);
            // Rail rows carry aria-current="location" on the active row only;
            // never write aria-current="false".  [spec §9.4]
            if (idx === activeIdx) row.a.setAttribute('aria-current', 'location');
            else row.a.removeAttribute('aria-current');
          });
          var track = qs('.gbs2-track');
          var firstDot = represented[0] && qs('.gbs2-dot', represented[0].a);
          var lastDot = represented[represented.length - 1] && qs('.gbs2-dot', represented[represented.length - 1].a);
          var toc = qs('.gbs2-toc');
          if (track && firstDot && lastDot && toc) {
            var baseRect = toc.getBoundingClientRect();
            var firstRect = firstDot.getBoundingClientRect();
            var lastRect = lastDot.getBoundingClientRect();
            var trackTop = firstRect.top + firstRect.height / 2 - baseRect.top;
            var trackHeight = Math.max(0, lastRect.top + lastRect.height / 2 - baseRect.top - trackTop);
            track.style.setProperty('--gbs2-track-top', trackTop + 'px');
            track.style.setProperty('--gbs2-track-height', trackHeight + 'px');

            // Smooth interpolated fill — the historical pre-v16 "metro line"
            // (enhancements.js geo()). The fill flows continuously between the
            // active dot and the next as the reader scrolls WITHIN a section,
            // instead of jumping in discrete percentage steps at each item.
            var fillEl = qs('i', track);
            if (fillEl) {
              var dotCenter = function (idx) {
                var d = represented[idx] && qs('.gbs2-dot', represented[idx].a);
                if (!d) return 0;
                var dr = d.getBoundingClientRect();
                return Math.max(0, Math.min(trackHeight, dr.top + dr.height / 2 - baseRect.top - trackTop));
              };
              var curH = dotCenter(activeIdx);
              var nextIdx = activeIdx + 1;
              if (nextIdx < represented.length) {
                var secStart = represented[activeIdx].target.offsetTop;
                var secEnd = represented[nextIdx].target.offsetTop;
                var secProg = secEnd > secStart
                  ? Math.max(0, Math.min(1, (window.scrollY - secStart + 120) / (secEnd - secStart)))
                  : 0;
                fillEl.style.height = (curH + (dotCenter(nextIdx) - curH) * secProg) + 'px';
              } else {
                fillEl.style.height = curH + 'px';
              }
            }
          }
          var countEl = qs('#gbs2Count');
          if (countEl) countEl.textContent = (activeIdx + 1) + ' / ' + represented.length;
          var activeRow = represented[activeIdx];
          var scroller = qs('.gbs2-tocscroll');
          if (activeRow && scroller) {
            var ar = activeRow.a.getBoundingClientRect();
            var sr = scroller.getBoundingClientRect();
            // Keep only the internal rail scroller in view — never scroll the page
          // itself just because the rail keeps an item visible.  [spec §9.3]
          if (ar.top < sr.top + 18 || ar.bottom > sr.bottom - 18) {
            var desired = activeRow.a.offsetTop - scroller.clientHeight / 2 + activeRow.a.offsetHeight / 2;
            scroller.scrollTo({ top: Math.max(0, desired), behavior: 'smooth' });
          }
          }
          qsa('.toc-part-item').forEach(function(el, idx) {
            var isActive = (idx === activeIdx);
            var isPassed = (idx < activeIdx);
            el.classList.toggle('is-active', !!isActive);
            el.classList.toggle('is-done', !!isPassed);
            // aria-current must be "location" on the active row only; never
            // write the invalid aria-current="false".  [spec §9.4]
            if (isActive) el.setAttribute('aria-current', 'location'); else el.removeAttribute('aria-current');
          });
        }
      }
        // update Part TOC progress bar
        var partItems = qsa('.toc-part-item');
        var activeIdx = -1;
        if (partItems.length) {
          partItems.forEach(function(el, idx) {
            if (el.classList.contains('is-active') || el.classList.contains('is-current')) activeIdx = idx;
          });
          var partPct = activeIdx >= 0 ? Math.round(((activeIdx + 1) / partItems.length) * 100) : pct;
          var scrollBar = qs('.toc-sheet__scroll-bar i');
          if (scrollBar) scrollBar.style.width = partPct + '%';
          // Rail fill is driven directly from the represented rows in the
          // submenu scroll-spy block above (smooth interpolated "metro line"),
          // NOT from part-overlay items — keep the two independent.  [spec §9.2]
        }
    }

    function getCurrentHeading() {
      var article = qs('article.article-body') || qs('#main-content article') || qs('main');
      if (!article) return '';
      var headings = qsa('h2[id]', article);
      var last = '';
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top < 120) {
          last = headings[i].textContent.trim();
        }
      }
      return last;
    }

    // Throttled scroll handler
    var scrollTick = false;
    addCleanListener(window, 'scroll', function() {
      if (!scrollTick) {
        scrollTick = true;
        requestAnimationFrame(function() {
          updateScrollProgress();
          scrollTick = false;
        });
      }
    }, { passive: true });

    // Initial population
    populateToc();
    updateScrollProgress();
  }

})();
