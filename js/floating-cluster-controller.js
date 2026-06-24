(function () {
  'use strict';

  var THEME_KEY = 'theme';
  var FALLBACK_SAVE_KEY = 'fc:saved:' + normalizePath(location.pathname || '/');
  var toastTimer = null;
  var STYLE_ID = 'fc-runtime-styles';

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

  function ensureStyles() {
    if (qs('#' + STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.fc-button{position:relative;display:inline-flex;align-items:center;justify-content:center;padding:0;margin:0;border:none;background:transparent;box-shadow:none}
.fc-button svg{stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.fc-theme-toggle{overflow:hidden}.fc-theme-toggle__sun,.fc-theme-toggle__moon{position:absolute;inset:0;display:inline-flex;align-items:center;justify-content:center;transition:opacity .24s ease,transform .28s cubic-bezier(.22,1,.36,1)}.fc-theme-toggle__sun{opacity:1;transform:rotate(0) scale(1)}.fc-theme-toggle__moon{opacity:0;transform:rotate(-90deg) scale(.6)}html.dark .fc-theme-toggle__sun{opacity:0;transform:rotate(90deg) scale(.6)}html.dark .fc-theme-toggle__moon{opacity:1;transform:rotate(0) scale(1)}
.fc-play-ember__ring{position:absolute;inset:7px;border-radius:999px;border:1px solid currentColor;opacity:.44}.fc-play-ember[data-audio-state='none'] .fc-play-ember__ring{opacity:.22}.fc-play-ember__icon--pause,.fc-play-ember__icon--spark{display:none}.fc-play-ember[data-audio-state='playing'] .fc-play-ember__icon--play,.fc-play-ember[data-audio-state='paused'] .fc-play-ember__icon--play,.fc-play-ember[data-audio-state='loading'] .fc-play-ember__icon--play{display:none}.fc-play-ember[data-audio-state='playing'] .fc-play-ember__icon--pause,.fc-play-ember[data-audio-state='paused'] .fc-play-ember__icon--pause{display:block}.fc-play-ember[data-audio-state='loading'] .fc-play-ember__icon--spark{display:block}
.fc-save.is-saved{color:var(--color-accent-strong)}.fc-save.is-saved svg{fill:currentColor;stroke:currentColor}.fc-roman{font-family:var(--f-body,Lora,Georgia,serif);font-size:14px;font-weight:700;letter-spacing:.08em;color:var(--gbs2-accent2,var(--color-accent-strong))}
.gbs2-rail.fc-rail{box-shadow:18px 0 52px rgba(22,15,10,.16)}.gbs2-rail.fc-rail .fc-rfoot{gap:6px;flex-wrap:wrap;align-items:center}.gbs2-rail.fc-rail .fc-button,.gbs2-mobile-actions.fc-mobile-actions .fc-button{border-radius:12px;transition:transform .22s cubic-bezier(.22,1,.36,1),color .22s ease,background-color .22s ease}.gbs2-rail.fc-rail .fc-button svg,.gbs2-mobile-actions.fc-mobile-actions .fc-button svg{width:17px;height:17px}.gbs2-mobile-actions.fc-mobile-actions{display:flex;gap:6px;margin-left:auto}.gbs2-bbar.fc-bbar{gap:8px}.gbs2-bbar.fc-bbar .fc-roman{display:inline-flex;align-items:center;justify-content:center;min-width:34px;padding:0 6px}.gbs2-rail.fc-rail .fc-font{font-size:12px;letter-spacing:-.02em}.gbs2-rail.fc-rail .fc-play-ember,.gbs2-mobile-actions.fc-mobile-actions .fc-play-ember{position:relative}.gbs2-rail.fc-rail .fc-play-ember__ring,.gbs2-mobile-actions.fc-mobile-actions .fc-play-ember__ring{opacity:.82}.gbs2-rail.fc-rail .fc-save.is-saved,.gbs2-mobile-actions.fc-mobile-actions .fc-save.is-saved{color:var(--gbs2-accent2,var(--color-accent-strong));background:rgba(232,184,120,.08)}.gbs2-rail.fc-rail .fc-button:hover,.gbs2-mobile-actions.fc-mobile-actions .fc-button:hover{background:rgba(0,0,0,.06);transform:scale(1.04)}html.dark .gbs2-rail.fc-rail .fc-button:hover,html.dark .gbs2-mobile-actions.fc-mobile-actions .fc-button:hover{background:rgba(255,255,255,.08);color:#eed093;box-shadow:0 0 14px rgba(216,176,104,.28)}
.gb-floating-controls.fc-single{pointer-events:none;gap:4px}.gb-floating-controls.fc-single .fc-button,.gb-floating-controls.fc-single .gb-fc-btn{pointer-events:auto;width:36px;height:36px;color:var(--color-text-muted);transition:color .2s ease,transform .2s cubic-bezier(.22,1,.36,1)}.gb-floating-controls.fc-single .fc-button svg,.gb-floating-controls.fc-single .gb-fc-btn svg{width:20px;height:20px}.gb-floating-controls.fc-single .gb-fc-theme{color:var(--color-accent)}.gb-floating-controls.fc-single .gb-fc-search,.gb-floating-controls.fc-single .fc-play-ember,.gb-floating-controls.fc-single .fc-save{color:var(--color-text)}.gb-floating-controls.fc-single .fc-play-ember[data-audio-state='none']{color:var(--color-text-muted)}html.dark .gb-floating-controls.fc-single .gb-fc-theme,html.dark .gb-floating-controls.fc-single .fc-save.is-saved,html.dark .gb-floating-controls.fc-single .fc-play-ember[data-audio-state='playing'],html.dark .gb-floating-controls.fc-single .fc-play-ember[data-audio-state='paused']{color:var(--color-accent-strong)}@media (hover:hover) and (pointer:fine){.gb-floating-controls.fc-single .fc-button:hover,.gb-floating-controls.fc-single .gb-fc-btn:hover{background:transparent;color:var(--color-text);transform:translateY(-2px) scale(1.08)}html.dark .gb-floating-controls.fc-single .fc-button:hover,html.dark .gb-floating-controls.fc-single .gb-fc-btn:hover{color:var(--color-accent-strong)}}.gb-floating-controls.fc-single .fc-button:focus-visible,.gb-floating-controls.fc-single .gb-fc-btn:focus-visible,.gbs2-rail.fc-rail .fc-button:focus-visible,.gbs2-mobile-actions.fc-mobile-actions .fc-button:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}@media (max-width:899px){.gb-floating-controls.fc-single{top:auto;left:50%;right:auto;bottom:calc(12px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);flex-direction:row;gap:2px;padding:3px;border:1px solid color-mix(in srgb,var(--color-border) 86%,transparent);border-radius:24px;background:color-mix(in srgb,var(--color-surface) 94%,transparent);-webkit-backdrop-filter:blur(16px) saturate(160%);backdrop-filter:blur(16px) saturate(160%);z-index:var(--z-bottom-bar)}body.fc-single-pilot .article-main{padding-bottom:88px}}
body.fc-single-pilot #reading-progress,body.fc-single-pilot #section-label,body.fc-single-pilot #back-to-top,body.fc-single-pilot #themeToggle,body.fc-single-pilot #tocSidebar,body.fc-single-pilot #bottomBar,body.fc-single-pilot #btocOverlay{display:none!important}
.fc-toast{position:fixed;left:50%;bottom:max(24px,calc(env(safe-area-inset-bottom,0px) + 24px));transform:translateX(-50%) translateY(20px);z-index:var(--z-toast);padding:10px 16px;border-radius:999px;background:color-mix(in srgb,var(--color-text) 94%,transparent);color:var(--color-surface);font-family:var(--f-ui,'Source Sans 3',system-ui,sans-serif);font-size:13px;font-weight:700;letter-spacing:.01em;opacity:0;pointer-events:none;transition:opacity .22s ease,transform .22s ease}.fc-toast.is-visible{opacity:1;transform:translateX(-50%) translateY(0)}
@media (prefers-reduced-motion:reduce){.fc-button,.fc-button *, .fc-toast{animation:none!important;transition-duration:.01ms!important}}
`;
    document.head.appendChild(style);
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
