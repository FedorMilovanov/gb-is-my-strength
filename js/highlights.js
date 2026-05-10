/* ============================================================
   highlights.js — Persistent Highlights & Цитаты
   Господь Бог — Сила Моя · v1.1

   Расширяет Selection Share:
   — кнопка «Сохранить цитату» → localStorage
   — плавающая кнопка «Мои цитаты» (если есть сохранённые)
   — модальная панель со всеми цитатами + экспорт в Markdown

   Изменения v1.1:
   · lockScroll/unlockScroll вызываются с source='highlights'
   · Swipe-down для закрытия панели на мобильных
   · Defensive check: панель не открывается повторно если уже open
   · escHtml вынесена в общий scope (используется в renderPanel)
   · DOMContentLoaded guard для всех точек монтирования
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'gb-highlights-v1';

  /* ── Storage helpers ── */
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function saveAll(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
    catch (e) {}
  }

  function addHighlight(text, articleTitle, url) {
    var items = loadAll();
    var id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    items.unshift({ id: id, text: text, articleTitle: articleTitle, url: url, savedAt: Date.now() });
    if (items.length > 200) items = items.slice(0, 200);
    saveAll(items);
    return items;
  }

  function removeHighlight(id) {
    var items = loadAll().filter(function(h){ return h.id !== id; });
    saveAll(items);
    return items;
  }

  /* ── escHtml — общий хелпер ── */
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── CSS ── */
  var STYLES = `
    /* Save quote button in selection popup */
    #ss-save {
      display: flex; align-items: center; gap: 5px;
      background: none; border: none; cursor: pointer;
      padding: 5px 8px; color: inherit; font-size: inherit;
      font-family: inherit; white-space: nowrap;
    }
    #ss-save:hover { opacity: .75; }

    /* Highlights panel */
    #gb-hl-backdrop {
      display: none;
      position: fixed; inset: 0;
      background: rgba(20,16,11,.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 9100;
      align-items: flex-end;
      justify-content: center;
    }
    #gb-hl-backdrop.is-open { display: flex; }

    #gb-hl-panel {
      background: var(--paper, #faf8f4);
      border-radius: 12px 12px 0 0;
      width: min(640px, 100vw);
      max-height: 80vh;
      display: flex; flex-direction: column;
      box-shadow: 0 -8px 40px rgba(20,16,11,.18);
      animation: hlPanelIn .2s ease;
      touch-action: pan-y;
    }
    @keyframes hlPanelIn {
      from { transform: translateY(40px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      #gb-hl-panel { animation: none; }
    }

    #gb-hl-handle {
      width: 36px; height: 4px;
      background: rgba(20,16,11,.18);
      border-radius: 2px;
      margin: 12px auto 0;
      flex-shrink: 0;
      cursor: grab;
    }

    #gb-hl-header {
      display: flex; align-items: center;
      padding: 14px 18px 10px;
      border-bottom: 1px solid rgba(20,16,11,.08);
      gap: 10px; flex-shrink: 0;
    }
    #gb-hl-title {
      font-family: var(--serif, Georgia, serif);
      font-style: italic;
      font-size: 1.15rem;
      flex: 1;
      color: var(--ink, #14100b);
    }
    #gb-hl-count {
      font-family: var(--mono, monospace);
      font-size: 10px; letter-spacing: .08em;
      color: var(--ink-3, #8a7968);
      background: var(--paper-2, #f3efe8);
      padding: 2px 7px; border-radius: 2px;
    }
    #gb-hl-export {
      font-family: var(--mono, monospace);
      font-size: 10px; letter-spacing: .08em;
      border: 1px solid rgba(20,16,11,.16);
      background: none; border-radius: 3px;
      padding: 4px 10px; cursor: pointer;
      color: var(--ink-2, #4a3f35);
      transition: background .1s;
    }
    #gb-hl-export:hover { background: var(--paper-2, #f3efe8); }
    #gb-hl-close {
      background: none; border: none; cursor: pointer;
      color: var(--ink-3, #8a7968); font-size: 1.1rem;
      padding: 4px 6px; border-radius: 3px;
    }
    #gb-hl-close:hover { background: var(--paper-2, #f3efe8); }

    #gb-hl-list {
      overflow-y: auto; flex: 1; padding: 8px 0;
      overscroll-behavior: contain;
    }

    .gb-hl-item {
      padding: 14px 18px;
      border-bottom: 1px solid rgba(20,16,11,.06);
      position: relative;
    }
    .gb-hl-item:last-child { border-bottom: none; }

    .gb-hl-quote {
      font-family: var(--serif, Georgia, serif);
      font-style: italic;
      font-size: .92rem;
      color: var(--ink, #14100b);
      line-height: 1.6;
      margin-bottom: 6px;
    }
    .gb-hl-quote::before { content: '\u00AB'; }
    .gb-hl-quote::after  { content: '\u00BB'; }

    .gb-hl-meta {
      display: flex; align-items: center; gap: 8px;
      font-size: .75rem;
      color: var(--ink-3, #8a7968);
      font-family: var(--mono, monospace);
    }
    .gb-hl-meta a {
      color: var(--gold-2, #7c5c18); text-decoration: none;
    }
    .gb-hl-meta a:hover { text-decoration: underline; }

    .gb-hl-del {
      background: none; border: none; cursor: pointer;
      color: var(--ink-3, #8a7968); font-size: .8rem;
      padding: 2px 5px; border-radius: 3px;
      margin-left: auto; opacity: .6;
    }
    .gb-hl-del:hover { opacity: 1; background: var(--red-soft, #f8e8e8); color: var(--red, #9b2d2d); }

    .gb-hl-empty {
      padding: 40px 18px; text-align: center;
      color: var(--ink-3, #8a7968); font-size: .9rem;
      line-height: 1.7;
    }
    .gb-hl-empty strong {
      display: block; font-size: 1.05rem;
      color: var(--ink-2, #4a3f35); margin-bottom: 6px;
      font-family: var(--serif, Georgia, serif); font-style: italic;
    }

    /* Floating button */
    #gb-hl-fab {
      position: fixed; bottom: 100px; right: 18px;
      background: var(--ink, #14100b);
      color: #f5f0e8;
      border: none; border-radius: 24px;
      padding: 8px 14px 8px 10px;
      display: none; align-items: center; gap: 7px;
      cursor: pointer; z-index: 800;
      font-family: var(--mono, monospace);
      font-size: 10px; letter-spacing: .08em;
      box-shadow: 0 4px 20px rgba(20,16,11,.25);
      transition: transform .15s, opacity .15s;
    }
    #gb-hl-fab.visible { display: flex; }
    #gb-hl-fab:hover { transform: translateY(-2px); }

    html.dark #gb-hl-panel { background: #1a1612; }
    html.dark #gb-hl-export { color: #a09080; border-color: rgba(255,255,255,.14); }
    html.dark #gb-hl-export:hover { background: rgba(255,255,255,.07); }
    html.dark #gb-hl-close:hover { background: rgba(255,255,255,.07); }
    html.dark .gb-hl-item { border-color: rgba(255,255,255,.06); }
    html.dark .gb-hl-del:hover { background: rgba(155,45,45,.25); }
  `;

  var styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  /* ── Panel HTML ── */
  var panelEl = document.createElement('div');
  panelEl.id = 'gb-hl-backdrop';
  panelEl.setAttribute('role', 'dialog');
  panelEl.setAttribute('aria-modal', 'true');
  panelEl.setAttribute('aria-label', 'Мои цитаты');
  panelEl.innerHTML = `
    <div id="gb-hl-panel">
      <div id="gb-hl-handle"></div>
      <div id="gb-hl-header">
        <span id="gb-hl-title">Мои цитаты</span>
        <span id="gb-hl-count">0</span>
        <button id="gb-hl-export" title="Экспорт в Markdown">↓ Markdown</button>
        <button id="gb-hl-close" aria-label="Закрыть">✕</button>
      </div>
      <div id="gb-hl-list"></div>
    </div>
  `;
  document.body.appendChild(panelEl);

  /* ── FAB ── */
  var fabEl = document.createElement('button');
  fabEl.id = 'gb-hl-fab';
  fabEl.setAttribute('aria-label', 'Открыть мои цитаты');
  fabEl.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
    </svg>
    <span id="gb-hl-fab-count">0</span>
  `;
  document.body.appendChild(fabEl);

  /* ── Render panel ── */
  function renderPanel() {
    var items = loadAll();
    var listEl = document.getElementById('gb-hl-list');
    var countEl = document.getElementById('gb-hl-count');
    var fabCountEl = document.getElementById('gb-hl-fab-count');

    if (countEl) countEl.textContent = items.length;
    if (fabCountEl) fabCountEl.textContent = items.length;

    if (items.length > 0) fabEl.classList.add('visible');
    else fabEl.classList.remove('visible');

    if (!listEl) return;

    if (items.length === 0) {
      listEl.innerHTML = `<div class="gb-hl-empty">
        <strong>Пока пусто</strong>
        Выделите текст в статье и нажмите «Сохранить цитату»
      </div>`;
      return;
    }

    listEl.innerHTML = items.map(function(h) {
      var date = new Date(h.savedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      return `<div class="gb-hl-item" data-id="${h.id}">
        <div class="gb-hl-quote">${escHtml(h.text)}</div>
        <div class="gb-hl-meta">
          <a href="${escHtml(h.url)}" target="_blank" rel="noopener">${escHtml(h.articleTitle || 'Статья')}</a>
          <span>·</span>
          <span>${date}</span>
          <button class="gb-hl-del" data-id="${h.id}" aria-label="Удалить цитату">✕</button>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.gb-hl-del').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-id');
        removeHighlight(id);
        renderPanel();
      });
    });
  }

  /* ── Focus trap ── */
  var HL_FOCUSABLE = 'a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])';
  var _prevHlFocus = null;

  function getHlFocusable() {
    return Array.prototype.slice.call(panelEl.querySelectorAll(HL_FOCUSABLE));
  }
  function trapHlTab(e) {
    if (e.key !== 'Tab') return;
    var els = getHlFocusable();
    if (!els.length) return;
    var first = els[0], last = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  /* ── Swipe-down to close (mobile) ── */
  var _swipeStartY = 0;
  var _swipeActive = false;
  var panelInner = null; /* resolved after DOM insert */

  function initSwipe() {
    panelInner = document.getElementById('gb-hl-panel');
    if (!panelInner) return;

    panelInner.addEventListener('touchstart', function(e) {
      _swipeStartY = e.touches[0].clientY;
      _swipeActive = true;
    }, { passive: true });

    panelInner.addEventListener('touchmove', function(e) {
      if (!_swipeActive) return;
      var dy = e.touches[0].clientY - _swipeStartY;
      if (dy > 0) {
        /* Translate panel down as user swipes */
        panelInner.style.transform = 'translateY(' + dy + 'px)';
        panelInner.style.transition = 'none';
      }
    }, { passive: true });

    panelInner.addEventListener('touchend', function(e) {
      if (!_swipeActive) return;
      _swipeActive = false;
      var dy = e.changedTouches[0].clientY - _swipeStartY;
      panelInner.style.transform = '';
      panelInner.style.transition = '';
      if (dy > 80) {
        closePanel();
      }
    }, { passive: true });
  }

  function openPanel() {
    /* Защита от двойного открытия */
    if (panelEl.classList.contains('is-open')) return;
    _prevHlFocus = document.activeElement;
    renderPanel();
    panelEl.classList.add('is-open');
    /* v1.1: передаём source для отладки */
    if (window.SiteUtils && typeof window.SiteUtils.lockScroll === 'function') {
      window.SiteUtils.lockScroll('highlights');
    } else {
      document.body.style.overflow = 'hidden';
    }
    requestAnimationFrame(function () {
      var first = getHlFocusable()[0];
      if (first) first.focus();
    });
    panelEl.removeEventListener('keydown', trapHlTab);
    panelEl.addEventListener('keydown', trapHlTab);
  }

  function closePanel() {
    panelEl.classList.remove('is-open');
    panelEl.removeEventListener('keydown', trapHlTab);
    /* v1.1: передаём source для отладки */
    if (window.SiteUtils && typeof window.SiteUtils.unlockScroll === 'function') {
      window.SiteUtils.unlockScroll('highlights');
    } else {
      document.body.style.removeProperty('overflow');
    }
    if (_prevHlFocus && _prevHlFocus.focus) _prevHlFocus.focus();
    _prevHlFocus = null;
  }

  panelEl.addEventListener('click', function(e) {
    if (e.target === panelEl) closePanel();
  });
  document.getElementById('gb-hl-close').addEventListener('click', closePanel);
  fabEl.addEventListener('click', openPanel);

  /* Keyboard */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && panelEl.classList.contains('is-open')) closePanel();
  });

  /* Export to Markdown */
  document.getElementById('gb-hl-export').addEventListener('click', function() {
    var items = loadAll();
    if (!items.length) return;

    var md = '# Мои цитаты — Господь Бог — Сила Моя\n\n';
    md += '_Экспортировано: ' + new Date().toLocaleDateString('ru-RU') + '_\n\n---\n\n';

    items.forEach(function(h) {
      md += '> ' + h.text + '\n\n';
      md += '— [' + (h.articleTitle || 'Статья') + '](' + h.url + ')' +
            '  \n_' + new Date(h.savedAt).toLocaleDateString('ru-RU') + '_\n\n---\n\n';
    });

    var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'gb-citaty-' + new Date().toISOString().slice(0,10) + '.md';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
  });

  /* ── Inject "Save" button into Selection Share popup ── */
  function injectSaveButton() {
    var popup = document.getElementById('selection-share-popup');
    if (!popup || document.getElementById('ss-save')) return;

    var sep = document.createElement('div');
    sep.className = 'ss-sep';

    var saveBtn = document.createElement('button');
    saveBtn.id = 'ss-save';
    saveBtn.setAttribute('aria-label', 'Сохранить цитату');
    saveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
      </svg>
      <span>Сохранить</span>`;

    popup.appendChild(sep);
    popup.appendChild(saveBtn);

    saveBtn.addEventListener('click', function() {
      var sel = window.getSelection ? window.getSelection() : null;
      var text = '';
      if (sel && !sel.isCollapsed) {
        text = sel.toString().trim();
      }
      if (!text) {
        var ssValid = window.__ssLastText__ && window.__ssLastTextUrl__ === window.location.href;
        if (ssValid) text = window.__ssLastText__;
      }
      if (!text || text.length < 8) {
        var span = saveBtn.querySelector('span');
        var orig = span.textContent;
        span.textContent = '✗ Нет текста';
        setTimeout(function(){ span.textContent = orig; }, 1800);
        return;
      }

      var articleTitle = document.title.replace(/\s*[·—|].*$/, '').trim();
      addHighlight(text, articleTitle, window.location.href);
      renderPanel();

      var span = saveBtn.querySelector('span');
      var orig = span.textContent;
      span.textContent = '✓ Сохранено';
      setTimeout(function(){ span.textContent = orig; }, 2000);

      popup.classList.remove('ss-visible');
      popup.setAttribute('aria-hidden', 'true');
    });
  }

  /* Intercept Selection Share lastText — сохраняем вместе с URL */
  document.addEventListener('mouseup', function() {
    setTimeout(function() {
      var sel = window.getSelection ? window.getSelection() : null;
      if (sel && !sel.isCollapsed) {
        var t = sel.toString().trim();
        if (t.length >= 12) {
          window.__ssLastText__    = t;
          window.__ssLastTextUrl__ = window.location.href;
        }
      } else {
        window.__ssLastText__    = '';
        window.__ssLastTextUrl__ = '';
      }
    }, 25);
  });

  /* Inject after DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(injectSaveButton, 500);
      initSwipe();
    });
  } else {
    setTimeout(injectSaveButton, 500);
    initSwipe();
  }

  /* Render FAB on load */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(renderPanel, 200); });
  } else {
    setTimeout(renderPanel, 200);
  }

  /* Expose */
  window.GBHighlights = { open: openPanel, close: closePanel, getAll: loadAll };
})();
