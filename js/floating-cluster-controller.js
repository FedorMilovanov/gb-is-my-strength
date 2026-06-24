(function () {
  'use strict';

  var THEME_KEY = 'theme';
  var FALLBACK_SAVE_KEY = 'fc:saved:' + normalizePath(location.pathname || '/');
  var toastTimer = null;

  function normalizePath(path) {
    var clean = String(path || '/').split('?')[0].split('#')[0].replace(/index\.html$/, '');
    if (clean !== '/' && /\/$/.test(clean)) clean = clean.slice(0, -1);
    return clean || '/';
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
      return;
    }
    fn();
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function getToast() {
    var toast = qs('.fc-toast');
    if (toast) return toast;
    toast = document.createElement('div');
    toast.className = 'fc-toast';
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toast);
    return toast;
  }

  function showToast(message) {
    var toast = getToast();
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  function setTheme(isDark) {
    document.documentElement.classList.toggle('dark', !!isDark);
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch (_) {}
    syncThemeButtons();
  }

  function syncThemeButtons() {
    var isDark = document.documentElement.classList.contains('dark');
    qsa('.gb-fc-theme, .fc-theme-toggle, [data-fc-action="theme"]').forEach(function (button) {
      button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    });
  }

  function openSearch(sourceButton) {
    var selectors = [
      '[data-search-open]',
      '#searchToggle',
      '#searchButton',
      '[data-gbs2-search]',
      '#hCpBtnNav',
      '#hSearchBtn',
      '[data-open-search]'
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var target = qs(selectors[i]);
      if (!target || target === sourceButton) continue;
      if (sourceButton && sourceButton.closest && target.closest && sourceButton.closest('.fc-root') && target.closest('.fc-root')) continue;
      if (typeof target.click === 'function') {
        target.click();
        return;
      }
    }

    document.dispatchEvent(new CustomEvent('gb:search:open', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('gb:openSearch'));
  }

  function getBookmarkState() {
    var engineSaved = false;
    try {
      if (window.BookmarkEngine && typeof window.BookmarkEngine.getCurrent === 'function') {
        engineSaved = !!window.BookmarkEngine.getCurrent();
      }
    } catch (_) {}
    try {
      return engineSaved || localStorage.getItem(FALLBACK_SAVE_KEY) === '1';
    } catch (_) {
      return engineSaved;
    }
  }

  function setBookmarkState(saved) {
    qsa('[data-fc-action="save"]').forEach(function (button) {
      button.classList.toggle('is-saved', !!saved);
      button.setAttribute('aria-pressed', saved ? 'true' : 'false');
    });
  }

  function saveNow() {
    var willSave = !getBookmarkState();

    try {
      if (willSave && window.BookmarkEngine && typeof window.BookmarkEngine.saveNow === 'function') {
        window.BookmarkEngine.saveNow();
      } else if (!willSave && window.BookmarkEngine && typeof window.BookmarkEngine.clearCurrent === 'function') {
        window.BookmarkEngine.clearCurrent();
      }
    } catch (_) {}

    try {
      localStorage.setItem(FALLBACK_SAVE_KEY, willSave ? '1' : '0');
    } catch (_) {}

    setBookmarkState(willSave);
    showToast(willSave ? 'Сохранено' : 'Сохранение снято');
  }

  function togglePlay(button) {
    var state = button.getAttribute('data-audio-state') || 'none';

    if (state === 'none') {
      showToast('Озвучка ещё не подключена');
      return;
    }

    var nextState = state === 'playing' ? 'paused' : 'playing';
    qsa('[data-fc-action="play"]').forEach(function (playButton) {
      playButton.setAttribute('data-audio-state', nextState);
      if (nextState === 'playing') {
        playButton.removeAttribute('aria-disabled');
      }
    });

    showToast(nextState === 'playing' ? 'Озвучка запущена' : 'Озвучка на паузе');
  }

  function initRoots() {
    var roots = qsa('[data-fc-root]');
    if (!roots.length) return;

    document.body.classList.add('gb-fc-active');

    roots.forEach(function (root) {
      var variant = root.getAttribute('data-fc-variant');
      if (variant === 'hermeneutics' || root.classList.contains('fc-single')) {
        document.body.classList.add('fc-single-pilot');
      }
    });

    syncThemeButtons();
    setBookmarkState(getBookmarkState());
  }

  function onClick(event) {
    var button = event.target && event.target.closest && event.target.closest('[data-fc-action]');
    if (!button) return;

    var action = button.getAttribute('data-fc-action');

    if (action === 'theme') {
      event.preventDefault();
      setTheme(!document.documentElement.classList.contains('dark'));
      return;
    }

    if (action === 'search') {
      event.preventDefault();
      openSearch(button);
      return;
    }

    if (action === 'save') {
      event.preventDefault();
      saveNow();
      return;
    }

    if (action === 'play') {
      event.preventDefault();
      togglePlay(button);
    }
  }

  ready(function () {
    initRoots();
    document.addEventListener('click', onClick);

    try {
      new MutationObserver(syncThemeButtons).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });
    } catch (_) {}
  });
})();
