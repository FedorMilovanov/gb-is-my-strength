/* ============================================================
   search.js — Pagefind ⌘K Search Modal
   Господь Бог — Сила Моя · v1.0
   ============================================================ */
(function () {
  'use strict';

  /* ── DOM Injection ── */
  var STYLES = `
    #gb-search-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(20,16,11,0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 9000;
      align-items: flex-start;
      justify-content: center;
      padding-top: 12vh;
    }
    #gb-search-backdrop.is-open { display: flex; }

    #gb-search-modal {
      background: var(--paper, #faf8f4);
      border: 1px solid rgba(20,16,11,0.12);
      border-radius: 8px;
      width: min(640px, calc(100vw - 32px));
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 64px rgba(20,16,11,0.22);
      overflow: hidden;
      animation: gbSearchIn .15s ease;
    }
    @keyframes gbSearchIn {
      from { opacity:0; transform: translateY(-10px) scale(.98); }
      to   { opacity:1; transform: translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      #gb-search-modal { animation: none; }
    }

    #gb-search-head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      border-bottom: 1px solid rgba(20,16,11,0.08);
      flex-shrink: 0;
    }
    #gb-search-head svg { flex-shrink: 0; color: var(--ink-3, #8a7968); }

    #gb-search-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-family: var(--sans, system-ui, sans-serif);
      font-size: 1.05rem;
      color: var(--ink, #14100b);
      font-weight: 300;
    }
    #gb-search-input::placeholder { color: var(--ink-3, #8a7968); }

    #gb-search-kbd {
      font-family: var(--mono, monospace);
      font-size: 10px;
      letter-spacing: .06em;
      color: var(--ink-3, #8a7968);
      background: var(--paper-2, #f3efe8);
      border: 1px solid rgba(20,16,11,0.12);
      border-radius: 3px;
      padding: 2px 6px;
      white-space: nowrap;
    }

    #gb-search-results {
      overflow-y: auto;
      flex: 1;
      padding: 8px 0;
    }

    .gb-result-item {
      display: block;
      padding: 12px 18px;
      text-decoration: none;
      color: inherit;
      border-bottom: 1px solid rgba(20,16,11,0.06);
      transition: background .1s;
    }
    .gb-result-item:last-child { border-bottom: none; }
    .gb-result-item:hover, .gb-result-item:focus {
      background: var(--paper-2, #f3efe8);
      outline: none;
    }
    .gb-result-item:focus-visible { outline: 2px solid var(--gold, #b8882a); outline-offset: -2px; }

    .gb-result-title {
      font-size: .925rem;
      font-weight: 500;
      color: var(--ink, #14100b);
      margin-bottom: 3px;
      line-height: 1.35;
    }
    .gb-result-excerpt {
      font-size: .8rem;
      color: var(--ink-2, #4a3f35);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .gb-result-excerpt mark {
      background: var(--gold-soft, #f5e9c8);
      color: var(--gold-2, #7c5c18);
      border-radius: 2px;
      padding: 0 2px;
      font-style: normal;
    }

    .gb-search-empty {
      padding: 32px 18px;
      text-align: center;
      color: var(--ink-3, #8a7968);
      font-size: .9rem;
    }
    .gb-search-empty strong {
      display: block;
      font-size: 1.05rem;
      color: var(--ink-2, #4a3f35);
      margin-bottom: 6px;
    }

    .gb-search-hint {
      padding: 18px;
      text-align: center;
      color: var(--ink-3, #8a7968);
      font-size: .82rem;
      font-family: var(--mono, monospace);
      letter-spacing: .04em;
    }

    .gb-search-loading {
      padding: 24px;
      text-align: center;
      color: var(--ink-3, #8a7968);
      font-size: .875rem;
    }

    #gb-search-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 18px;
      border-top: 1px solid rgba(20,16,11,0.08);
      flex-shrink: 0;
      font-family: var(--mono, monospace);
      font-size: 9px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--ink-3, #8a7968);
    }

    /* Search trigger button */
    .gb-search-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--paper-2, #f3efe8);
      border: 1px solid rgba(20,16,11,0.14);
      border-radius: 5px;
      padding: 5px 10px;
      cursor: pointer;
      font-family: var(--mono, monospace);
      font-size: 10px;
      letter-spacing: .08em;
      color: var(--ink-3, #8a7968);
      transition: background .15s, border-color .15s;
      text-decoration: none;
    }
    .gb-search-btn:hover { background: var(--paper-3, #ebe5da); border-color: rgba(20,16,11,0.22); color: var(--ink-2, #4a3f35); }
    .gb-search-btn svg { flex-shrink: 0; }
    .gb-search-btn .kb { background: var(--paper, #faf8f4); border: 1px solid rgba(20,16,11,0.18); border-radius: 3px; padding: 0px 4px; font-size: 9px; }

    html.dark #gb-search-modal { background: #1a1612; border-color: rgba(255,255,255,0.1); }
    html.dark #gb-search-input { color: #f0ece4; }
    html.dark .gb-search-btn { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); color: #8a7968; }
    html.dark .gb-search-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #c4bab0; }
    html.dark .gb-search-btn .kb { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.45); }
    html.dark .gb-result-item:hover { background: rgba(255,255,255,0.06); }
  `;

  /* Inject CSS */
  var styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  /* Inject HTML */
  var backdrop = document.createElement('div');
  backdrop.id = 'gb-search-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Поиск по сайту');
  backdrop.innerHTML = `
    <div id="gb-search-modal">
      <div id="gb-search-head">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input id="gb-search-input" type="search" placeholder="Поиск по всем материалам…" autocomplete="off" spellcheck="false" aria-label="Поиск"/>
        <span id="gb-search-kbd">Esc</span>
      </div>
      <div id="gb-search-results" role="listbox" aria-live="polite">
        <div class="gb-search-hint">Начните вводить запрос — ipsissima vox, Иеремия 17, Chicago Statement…</div>
      </div>
      <div id="gb-search-footer">
        <span>Pagefind · gospod-bog.ru</span>
        <span>↑↓ навигация · Enter открыть · Esc закрыть</span>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  var input = document.getElementById('gb-search-input');
  var results = document.getElementById('gb-search-results');

  /* ── Pagefind lazy-load ── */
  var pagefindLoaded = false;
  var pagefindLoading = false;

  function loadPagefind(cb) {
    if (pagefindLoaded) { cb && cb(); return; }
    if (pagefindLoading) { setTimeout(function(){ loadPagefind(cb); }, 80); return; }
    pagefindLoading = true;

    /* Determine base path — works from any page depth */
    var depth = (window.location.pathname.match(/\//g) || []).length - 1;
    var prefix = depth > 0 ? Array(depth).fill('..').join('/') + '/' : '/';

    var script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import * as p from '${prefix}pagefind/pagefind.js';
      window.__pagefind__ = p;
      window.__pagefindReady__ = true;
    `;
    script.onload = function() {};
    document.head.appendChild(script);

    /* Poll until ready */
    var polls = 0;
    var poll = setInterval(function() {
      polls++;
      if (window.__pagefindReady__) {
        clearInterval(poll);
        pagefindLoaded = true;
        pagefindLoading = false;
        cb && cb();
      }
      if (polls > 50) { clearInterval(poll); pagefindLoading = false; }
    }, 100);
  }

  /* ── Open / Close ── */
  function openModal() {
    backdrop.classList.add('is-open');
    input.focus();
    if (window.SiteUtils) { window.SiteUtils.lockScroll(); } else { document.body.style.overflow = 'hidden'; }
    loadPagefind(function() {
      /* Re-run search if user already typed */
      if (input.value.trim()) runSearch(input.value.trim());
    });
  }

  function closeModal() {
    backdrop.classList.remove('is-open');
    if (window.SiteUtils) { window.SiteUtils.unlockScroll(); } else { document.body.style.overflow = ''; }
    input.value = '';
    results.innerHTML = '<div class="gb-search-hint">Начните вводить запрос — ipsissima vox, Иеремия 17, Chicago Statement…</div>';
  }

  /* ── Search ── */
  var searchTimer;
  function runSearch(query) {
    if (!query || query.length < 2) {
      results.innerHTML = '<div class="gb-search-hint">Начните вводить запрос…</div>';
      return;
    }
    if (!window.__pagefind__) {
      results.innerHTML = '<div class="gb-search-loading">Загружаю индекс…</div>';
      return;
    }
    results.innerHTML = '<div class="gb-search-loading">Ищу…</div>';

    window.__pagefind__.search(query).then(function(res) {
      if (!res || !res.results || res.results.length === 0) {
        results.innerHTML = '<div class="gb-search-empty"><strong>Ничего не найдено</strong>Попробуйте другой запрос</div>';
        return;
      }

      /* Load first 8 results */
      var limited = res.results.slice(0, 8);
      Promise.all(limited.map(function(r){ return r.data(); })).then(function(items) {
        var html = '';
        items.forEach(function(item) {
          var excerpt = item.excerpt || '';
          var title = item.meta && item.meta.title ? item.meta.title : 'Без названия';
          html += `<a class="gb-result-item" href="${item.url}" role="option" tabindex="0">
            <div class="gb-result-title">${title}</div>
            <div class="gb-result-excerpt">${excerpt}</div>
          </a>`;
        });
        results.innerHTML = html;

        /* Keyboard nav within results */
        results.querySelectorAll('.gb-result-item').forEach(function(el, idx, all) {
          el.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); var n = all[idx+1]; if(n) n.focus(); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); var p = all[idx-1]; if(p) p.focus(); else input.focus(); }
            if (e.key === 'Escape')    { closeModal(); }
          });
        });
      });
    }).catch(function() {
      results.innerHTML = '<div class="gb-search-empty"><strong>Ошибка поиска</strong>Попробуйте ещё раз</div>';
    });
  }

  input.addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function(){ runSearch(input.value.trim()); }, 180);
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      var first = results.querySelector('.gb-result-item');
      if (first) first.focus();
    }
  });

  /* Close on backdrop click */
  backdrop.addEventListener('click', function(e) {
    if (e.target === backdrop) closeModal();
  });

  /* Global keyboard shortcut ⌘K / Ctrl+K */
  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (backdrop.classList.contains('is-open')) closeModal();
      else openModal();
    }
    if (e.key === 'Escape' && backdrop.classList.contains('is-open')) closeModal();
  });

  /* ── Inject search button into nav ── */
  function injectSearchButton() {
    var SEARCH_BTN_HTML = `<button class="gb-search-btn" id="gbSearchBtn" aria-label="Поиск (⌘K)" title="Поиск ⌘K">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span>Поиск</span>
      <span class="kb">⌘K</span>
    </button>`;

    /* Home page nav */
    var hNavLinks = document.querySelector('.h-nav-links');
    if (hNavLinks && !document.getElementById('gbSearchBtn')) {
      var li = document.createElement('li');
      li.innerHTML = SEARCH_BTN_HTML;
      hNavLinks.insertBefore(li, hNavLinks.firstChild);
    }

    /* Article topnav */
    var topnav = document.querySelector('.article-topnav');
    if (topnav && !document.getElementById('gbSearchBtn')) {
      var btn = document.createElement('button');
      btn.className = 'gb-search-btn';
      btn.id = 'gbSearchBtn';
      btn.setAttribute('aria-label', 'Поиск (⌘K)');
      btn.setAttribute('title', 'Поиск ⌘K');
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
      btn.style.cssText = 'margin-left:auto; margin-right:8px; padding:5px 8px;';
      topnav.appendChild(btn);
    }

    /* Nagornaya pages — inject before #menuBtn in mobile header */
    var menuBtn = document.getElementById('menuBtn');
    if (menuBtn && !document.getElementById('gbSearchBtn')) {
      var nagBtn = document.createElement('button');
      nagBtn.className = 'gb-search-btn';
      nagBtn.id = 'gbSearchBtn';
      nagBtn.setAttribute('aria-label', 'Поиск (⌘K)');
      nagBtn.setAttribute('title', 'Поиск ⌘K');
      nagBtn.style.cssText = 'background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.15);color:#e7e5e4;margin-right:8px;';
      nagBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
      menuBtn.parentNode.insertBefore(nagBtn, menuBtn);
    }

    /* Fallback: generic nav ul */
    if (!hNavLinks && !topnav && !menuBtn) {
      var nav = document.querySelector('nav[role="navigation"] ul, .nav-links, .h-nav-links');
      if (nav && !document.getElementById('gbSearchBtn')) {
        var li2 = document.createElement('li');
        li2.innerHTML = SEARCH_BTN_HTML;
        nav.insertBefore(li2, nav.firstChild);
      }
    }

    document.querySelectorAll('#gbSearchBtn').forEach(function(btn) {
      btn.addEventListener('click', openModal);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSearchButton);
  } else {
    injectSearchButton();
  }

  /* Expose API */
  window.GBSearch = { open: openModal, close: closeModal };
})();
