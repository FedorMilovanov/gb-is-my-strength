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
    var selectors = [
      '[data-search-open]',
      '#searchToggle',
      '#searchButton',
      '[data-gbs2-search]',
      '#hCpBtnNav',
      '#hSearchBtn',
      '[data-open-search]'
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
    return String(path || '/').split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
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

  function handlePlayClick() {
    // В пилоте audioState=none → показываем toast
    var ember = qs('.gb-ember');
    var state = ember ? ember.dataset.state : 'idle';
    if (state === 'idle' || !state) {
      showToast('Озвучка ещё не подключена', false);
      return;
    }
    // Если есть audio engine
    if (window.GBAudio && typeof window.GBAudio.toggle === 'function') {
      window.GBAudio.toggle();
      return;
    }
    // Demo toggle
    var next = state === 'playing' ? 'paused' : 'playing';
    setEmberState(next);
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
  var fontScale = 1;
  function changeFontSize(direction) {
    fontScale = Math.max(0.85, Math.min(1.25, fontScale + direction * 0.05));
    var article = qs('article.article-body') || qs('.article-main') || qs('main');
    if (article) article.style.fontSize = fontScale === 1 ? '' : (fontScale * 100) + '%';
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
    document.addEventListener('keydown', function (e) {
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
  function initCluster(root) {
    if (root._gbClusterInit) return; // P1-8: prevent double init
    root._gbClusterInit = true;
    root.addEventListener('click', function (e) {
      // Также обрабатываем GBS2-style theme buttons (data-gbs2-theme)
      if (e.target.closest('[data-gbs2-theme]')) { toggleTheme(); return; }
      if (e.target.closest('[data-gbs2-search]')) { openSearch(e.target.closest('[data-gbs2-search]')); return; }
      var btn = e.target.closest('[data-fc-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-fc-action');

      if (action === 'theme')     { toggleTheme(); }
      else if (action === 'search')    { openSearch(btn); }
      else if (action === 'play')      { handlePlayClick(); }
      else if (action === 'save')      { saveCurrent(btn); }
      else if (action === 'scroll-top'){ scrollTop(); }
      else if (action === 'font-up')   { changeFontSize(1); }
      else if (action === 'font-down') { changeFontSize(-1); }
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
      btn.addEventListener('click', toggleTheme);
    });
    var gbs2SearchBtns = qsa('[data-gbs2-search]');
    gbs2SearchBtns.forEach(function(btn) {
      btn.addEventListener('click', function() { openSearch(btn); });
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
    var engine = window.BookmarkEngine;
    if (engine && typeof engine.getCurrent === 'function') {
      var current = engine.getCurrent();
      setSaved(isFavorite(normalizePath(location.pathname)));
    } else {
      var key = 'fc:saved:' + normalizePath(location.pathname);
      try {
        if (localStorage.getItem(key)) setSaved(true);
      } catch (_) {}
    }
  }

  /* =====================================================
     MAIN INIT
     ===================================================== */
  ready(function () {
    // 0. Global delegated listeners for GBS2-style controls (works regardless of DOM hierarchy)
    document.addEventListener('click', function(e) {
      if (e.target.closest('[data-gbs2-theme]')) { e.stopPropagation(); toggleTheme(); }
      if (e.target.closest('[data-gbs2-search]')) { e.stopPropagation(); openSearch(e.target.closest('[data-gbs2-search]')); }
    }, true);  // capture phase — fires before any stopPropagation

    // 1. Inject SVG в ember кнопки (если SSR не вставил)
    initEmbers();
    initTocPopups();
    initActionHandlers();
    initPlayExpand();

    // 2. Gill rail / non-root cluster controls (работают без data-fc-root)
    initGillRail();

    // 3. Инициализировать корни с data-fc-root
    var roots = qsa('[data-fc-root]');
    if (!roots.length) return;

    roots.forEach(function(root) {
      var mode = root.getAttribute('data-fc-mode') || 'single';
      if (mode === 'single') activateSinglePilot();
      if (mode === 'series-lite') activateSeriesPilot();
      if (mode === 'nagornaya') activateSinglePilot();
      initCluster(root);
    });

    // 5. Синхронизация состояний
    syncThemeButtons();
    syncSaveState();

    // 7. Keyboard
    initKeyboard();

    // 8. Ember state из data атрибута
    var embers = qsa('.gb-ember');
    embers.forEach(function (ember) {
      var state = ember.dataset.state || 'idle';
      updateEmberAriaLabel(state);
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
  function initTocPopups() {
    var seriesToc = qs('#seriesTocOverlay');
    var partToc = qs('#partTocOverlay');
    var mobTocBtn = qs('#mobTocBtn');
    var backToSeries = qs('#backToSeries');

    function openOverlay(el) {
      if (el) { el.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
    }
    function closeOverlay(el) {
      if (el) { el.classList.remove('is-open'); document.body.style.overflow = ''; }
    }

    // Mobile TOC button opens series
    if (mobTocBtn && seriesToc) {
      mobTocBtn.addEventListener('click', function() { openOverlay(seriesToc); });
    }

    // Back button in Part TOC → Series TOC
    if (backToSeries && seriesToc && partToc) {
      backToSeries.addEventListener('click', function() {
        closeOverlay(partToc);
        openOverlay(seriesToc);
      });
    }

    // Click on series item → open Part TOC (for current part) or navigate
    if (seriesToc) {
      seriesToc.addEventListener('click', function(e) {
        var item = e.target.closest('.toc-item');
        if (!item) return;
        if (item.classList.contains('is-current') && partToc) {
          e.preventDefault();
          closeOverlay(seriesToc);
          openOverlay(partToc);
        }
        // Non-current items are regular links — let them navigate
      });
    }

    // Close overlay on backdrop click
    [seriesToc, partToc].forEach(function(overlay) {
      if (!overlay) return;
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeOverlay(overlay);
      });
      // Close on handle drag down (simple version)
      var handle = overlay.querySelector('.toc-sheet__handle');
      if (handle) {
        handle.addEventListener('click', function() { closeOverlay(overlay); });
      }
    });

    // Escape closes any open overlay
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeOverlay(seriesToc);
        closeOverlay(partToc);
      }
    });
  }

  /* v16 action handlers (non-inline) */
  function initActionHandlers() {
    // Rail back button
    var back = qs('.gbs-rail-back');
    if (back) {
      var href = back.closest('[data-home-href]');
      back.addEventListener('click', function() {
        location.href = href ? href.getAttribute('data-home-href') : '../../biografii/';
      });
    }
    // Share button
    qsa('[data-action="share"]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (navigator.share) navigator.share({ title: document.title, url: location.href });
      });
    });
    // Print button
    qsa('[data-action="print"]').forEach(function(btn) {
      btn.addEventListener('click', function() { window.print(); });
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
      try { currentRate = parseFloat(localStorage.getItem('gbx-tts-rate')) || 1; } catch(_){}

      var panel = document.createElement('div');
      panel.className = 'gb-ember-expand';
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-label', 'Скорость воспроизведения');
      panel.innerHTML = speeds.map(function(s) {
        var active = s === currentRate ? ' is-active' : '';
        return '<button class="gb-ember-expand__btn' + active + '" type="button" data-speed="' + s + '" aria-label="Скорость ' + s + '\u00d7" aria-pressed="' + (s === currentRate ? 'true' : 'false') + '">' + s + '\u00d7</button>';
      }).join('');

      // Wrap ember in a positioned span so the popover anchors exactly to the
      // play circle and expands UPWARD ("из круга") instead of sideways.
      var parent = ember.parentNode;
      var wrap = document.createElement('span');
      wrap.className = 'gb-ember-wrap';
      parent.insertBefore(wrap, ember);
      wrap.appendChild(ember);
      wrap.appendChild(panel);

      function openPanel() {
        panel.classList.add('is-open');
        ember.setAttribute('aria-expanded', 'true');
      }
      function closePanel() {
        panel.classList.remove('is-open');
        ember.setAttribute('aria-expanded', 'false');
      }

      ember.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        panel.classList.contains('is-open') ? closePanel() : openPanel();
      });

      panel.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-speed]');
        if (btn) {
          e.stopPropagation();
          var speed = parseFloat(btn.getAttribute('data-speed'));
          try { localStorage.setItem('gbx-tts-rate', speed); } catch(_){}
          panel.querySelectorAll('.gb-ember-expand__btn').forEach(function(b) {
            var isThis = parseFloat(b.getAttribute('data-speed')) === speed;
            b.classList.toggle('is-active', isThis);
            b.setAttribute('aria-pressed', isThis ? 'true' : 'false');
          });
          // Close smoothly after selection
          setTimeout(closePanel, 240);
          return;
        }
      });

      // Close on mouse leave the wrap (ember + panel), outside click, and Escape.
      var leaveTimer = null;
      wrap.addEventListener('mouseleave', function() {
        clearTimeout(leaveTimer);
        leaveTimer = setTimeout(closePanel, 220);
      });
      wrap.addEventListener('mouseenter', function() { clearTimeout(leaveTimer); });
      document.addEventListener('click', function(e) {
        if (!wrap.contains(e.target)) closePanel();
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closePanel();
      });
    });
  }


})();
